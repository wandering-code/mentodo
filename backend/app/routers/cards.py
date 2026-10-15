from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Emitter, emitter
from ..models import Card, Label, LabelGroup
from ..ownership import own_card, own_project
from ..serialize import card_out

router = APIRouter(prefix="/cards", tags=["cards"])


class CardIn(BaseModel):
    project_id: int | None = None
    title: str = Field("", max_length=500)
    content: dict | None = None
    in_todo: bool = False
    due_at: datetime | None = None
    due_all_day: bool = True
    estimate_minutes: int | None = None
    label_ids: list[int] = []
    position: float | None = None
    values: dict = {}


class CardPatch(BaseModel):
    project_id: int | None = None
    title: str | None = Field(None, max_length=500)
    content: dict | None = None
    done: bool | None = None
    in_todo: bool | None = None
    due_at: datetime | None = None
    due_all_day: bool | None = None
    remind_at: datetime | None = None
    estimate_minutes: int | None = None
    position: float | None = None
    label_ids: list[int] | None = None
    hidden_props: list[str] | None = None
    # Cambios parciales de campos propios: {"<field_id>": valor | null}
    values: dict | None = None


def _project_labels(db: Session, project_id: int | None) -> dict[int, tuple[Label, LabelGroup]]:
    if project_id is None:
        return {}
    rows = db.execute(
        select(Label, LabelGroup).join(LabelGroup, Label.group_id == LabelGroup.id)
        .where(LabelGroup.project_id == project_id)
    ).all()
    return {l.id: (l, g) for l, g in rows}


def _apply_labels(db: Session, card: Card, label_ids: list[int]):
    """Asigna etiquetas respetando los grupos de selección única (gana la
    última de cada grupo) y sincroniza `done` con las etiquetas "de terminado"."""
    available = _project_labels(db, card.project_id)
    chosen: dict[int, list[Label]] = {}
    for lid in label_ids:
        if lid not in available:
            raise HTTPException(422, "Etiqueta de otro proyecto")
        l, g = available[lid]
        bucket = chosen.setdefault(g.id, [])
        if g.multi:
            if l not in bucket:
                bucket.append(l)
        else:
            chosen[g.id] = [l]
    had_done = any(l.marks_done for l in card.labels)
    card.labels = [l for ls in chosen.values() for l in ls]
    has_done = any(l.marks_done for l in card.labels)
    if has_done and not card.done:
        _set_done(card, True)
    elif had_done and not has_done and card.done:
        _set_done(card, False)


def _set_done(card: Card, done: bool):
    card.done = done
    card.completed_at = datetime.now(timezone.utc) if done else None


def _sync_labels_with_done(db: Session, card: Card):
    """Marcar el check mueve la tarjeta a la etiqueta "Hecho" del grupo (y
    desmarcarlo la devuelve a la primera etiqueta normal del mismo grupo)."""
    available = _project_labels(db, card.project_id)
    by_group: dict[int, list[Label]] = {}
    groups: dict[int, LabelGroup] = {}
    for l, g in available.values():
        by_group.setdefault(g.id, []).append(l)
        groups[g.id] = g
    current = list(card.labels)
    for gid, labels in by_group.items():
        if groups[gid].multi:
            continue
        done_label = next((l for l in labels if l.marks_done), None)
        if not done_label:
            continue
        in_group = [l for l in current if l.group_id == gid]
        if card.done and done_label not in in_group:
            current = [l for l in current if l.group_id != gid] + [done_label]
        elif not card.done and any(l.marks_done for l in in_group):
            first = min((l for l in labels if not l.marks_done), key=lambda l: l.position, default=None)
            current = [l for l in current if l.group_id != gid] + ([first] if first else [])
    card.labels = current


@router.post("", status_code=201)
def create_card(body: CardIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    if body.project_id is not None:
        own_project(db, em.user.id, body.project_id)
    position = body.position
    if position is None:
        top = db.scalar(select(func.min(Card.position)).where(
            Card.user_id == em.user.id, Card.project_id == body.project_id))
        position = (top or 0) - 1
    c = Card(user_id=em.user.id, project_id=body.project_id, title=body.title, content=body.content,
             in_todo=body.in_todo, due_at=body.due_at, due_all_day=body.due_all_day,
             estimate_minutes=body.estimate_minutes, position=position, values=body.values)
    db.add(c)
    db.flush()
    if body.label_ids:
        _apply_labels(db, c, body.label_ids)
    db.commit()
    out = card_out(c)
    em.upsert("card", out)
    return out


@router.patch("/{card_id}")
def patch_card(card_id: int, body: CardPatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    c = own_card(db, em.user.id, card_id)
    data = body.model_dump(exclude_unset=True)
    if "project_id" in data and data["project_id"] != c.project_id:
        if data["project_id"] is not None:
            own_project(db, em.user.id, data["project_id"])
        c.project_id = data["project_id"]
        c.labels = []  # las etiquetas y los campos son de cada proyecto
        c.values = {}
    for k in ("title", "content", "in_todo", "due_at", "due_all_day", "remind_at", "estimate_minutes", "position",
              "hidden_props"):
        if k in data and not (k == "hidden_props" and data[k] is None):
            setattr(c, k, data[k])
    if data.get("values"):
        merged = dict(c.values or {})
        for key, val in data["values"].items():
            if val is None or val == "":
                merged.pop(str(key), None)
            else:
                merged[str(key)] = val
        c.values = merged
    if data.get("label_ids") is not None:
        _apply_labels(db, c, data["label_ids"])
    elif data.get("done") is not None and data["done"] != c.done:
        _set_done(c, data["done"])
        _sync_labels_with_done(db, c)
    c.updated_at = datetime.now(timezone.utc)
    db.commit()
    out = card_out(c)
    em.upsert("card", out)
    return out


@router.delete("/{card_id}")
def delete_card(card_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    c = own_card(db, em.user.id, card_id)
    db.delete(c)
    db.commit()
    em.delete("card", card_id)
    return {"ok": True}
