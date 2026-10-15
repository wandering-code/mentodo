from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from ..auth import current_user
from ..config import settings
from ..db import get_db
from ..deps import Emitter, emitter
from ..models import (
    Card, Label, LabelGroup, Notification, NotificationRule, Project, PushSubscription, User, View,
)
from ..models import Field as CustomField
from ..models import Attachment, CardLink, Note
from ..notify import create_notification
from ..ownership import own_project, own_rule
from ..serialize import (
    attachment_out, card_out, field_out, group_out, link_out, note_out, label_out, notification_out, project_out, rule_out, user_out, view_out,
)

router = APIRouter(tags=["workspace"])


@router.get("/bootstrap")
def bootstrap(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Todo el espacio de trabajo de una vez. El cliente lo guarda en memoria y
    a partir de ahí solo recibe cambios por WebSocket."""
    projects = db.scalars(select(Project).where(Project.user_id == user.id)).all()
    pids = [p.id for p in projects]
    groups = db.scalars(select(LabelGroup).where(LabelGroup.project_id.in_(pids))).all() if pids else []
    gids = [g.id for g in groups]
    labels = db.scalars(select(Label).where(Label.group_id.in_(gids))).all() if gids else []
    views = db.scalars(select(View).where(View.project_id.in_(pids))).all() if pids else []
    fields = db.scalars(select(CustomField).where(CustomField.project_id.in_(pids))).all() if pids else []
    all_cards = db.scalars(select(Card).where(Card.user_id == user.id)).all()
    cards = [c for c in all_cards if not c.is_template]
    templates = [c for c in all_cards if c.is_template]
    notes = db.scalars(select(Note).where(Note.user_id == user.id)).all()
    links = db.scalars(select(CardLink).where(CardLink.user_id == user.id)).all()
    attachments = db.scalars(select(Attachment).where(Attachment.user_id == user.id)).all()
    rules = db.scalars(select(NotificationRule).where(NotificationRule.user_id == user.id)).all()
    notifs = db.scalars(select(Notification).where(Notification.user_id == user.id)
                        .order_by(Notification.created_at.desc()).limit(60)).all()
    return {
        "user": user_out(user),
        "projects": [project_out(p) for p in projects],
        "groups": [group_out(g) for g in groups],
        "labels": [label_out(l) for l in labels],
        "views": [view_out(v) for v in views],
        "fields": [field_out(f) for f in fields],
        "notes": [note_out(n) for n in notes],
        "links": [link_out(l) for l in links],
        "attachments": [attachment_out(a) for a in attachments],
        "cards": [card_out(c) for c in cards],
        "templates": [card_out(c) for c in templates],
        "rules": [rule_out(r) for r in rules],
        "notifications": [notification_out(n) for n in notifs],
        "vapid_public_key": settings.vapid_public_key or None,
    }


@router.get("/export")
def export_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Todo el espacio de trabajo en un JSON descargable (los secretos de la
    bóveda van tal cual: cifrados). Copia propia, independiente del servidor."""
    from datetime import datetime, timezone

    from fastapi.responses import JSONResponse

    data = bootstrap(user, db)
    data.pop("vapid_public_key", None)
    data["notifications"] = []
    data["exported_at"] = datetime.now(timezone.utc).isoformat()
    data["format"] = "mentodo-export-1"
    stamp = datetime.now().strftime("%Y-%m-%d")
    return JSONResponse(data, headers={"Content-Disposition": f'attachment; filename="mentodo-{user.username}-{stamp}.json"'})


# ── Reglas de notificación ───────────────────────────────────────────────────

class RuleIn(BaseModel):
    project_id: int | None = None
    kind: str = Field(pattern="^(before_due|overdue|daily_digest|stale)$")
    params: dict = {}
    enabled: bool = True


class RulePatch(BaseModel):
    params: dict | None = None
    enabled: bool | None = None


@router.post("/rules", status_code=201)
def create_rule(body: RuleIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    if body.project_id is not None:
        own_project(db, em.user.id, body.project_id)
    r = NotificationRule(user_id=em.user.id, **body.model_dump())
    db.add(r)
    db.commit()
    out = rule_out(r)
    em.upsert("rule", out)
    return out


@router.patch("/rules/{rule_id}")
def patch_rule(rule_id: int, body: RulePatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    r = own_rule(db, em.user.id, rule_id)
    if body.params is not None:
        r.params = body.params
    if body.enabled is not None:
        r.enabled = body.enabled
    db.commit()
    out = rule_out(r)
    em.upsert("rule", out)
    return out


@router.delete("/rules/{rule_id}")
def delete_rule(rule_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    r = own_rule(db, em.user.id, rule_id)
    db.delete(r)
    db.commit()
    em.delete("rule", rule_id)
    return {"ok": True}


# ── Avisos ───────────────────────────────────────────────────────────────────

@router.post("/notifications/read-all")
def read_all(em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.user_id == em.user.id, Notification.read.is_(False))
               .values(read=True))
    db.commit()
    em.events.append({"t": "notifications_read"})
    em._schedule()
    return {"ok": True}


@router.delete("/notifications")
def clear_notifications(em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    for n in db.scalars(select(Notification).where(Notification.user_id == em.user.id)).all():
        db.delete(n)
    db.commit()
    em.events.append({"t": "notifications_cleared"})
    em._schedule()
    return {"ok": True}


class PushSubIn(BaseModel):
    endpoint: str
    keys: dict


@router.post("/push/subscribe")
def push_subscribe(body: PushSubIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    sub = db.scalar(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint))
    if sub:
        sub.user_id, sub.keys = user.id, body.keys
    else:
        db.add(PushSubscription(user_id=user.id, endpoint=body.endpoint, keys=body.keys))
    db.commit()
    return {"ok": True}


@router.post("/push/unsubscribe")
def push_unsubscribe(body: PushSubIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    sub = db.scalar(select(PushSubscription).where(PushSubscription.endpoint == body.endpoint,
                                                   PushSubscription.user_id == user.id))
    if sub:
        db.delete(sub)
        db.commit()
    return {"ok": True}


@router.post("/push/test")
def push_test(em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    from datetime import datetime
    n = create_notification(db, em.user.id, f"test:{datetime.now().isoformat()}",
                            "Mentodo funciona 🎉", "Así se verán tus avisos.", url="/")
    if n:
        em.upsert("notification", n)
    return {"ok": True}
