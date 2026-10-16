from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Emitter, emitter
from ..models import Card, CardEvent, Label, LabelGroup
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
    is_template: bool = False
    template: dict | None = None
    hidden_props: list[str] = []


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
    template: dict | None = None
    recurrence: dict | None = None
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
             estimate_minutes=body.estimate_minutes, position=position, values=body.values,
             is_template=body.is_template, template=body.template if body.is_template else None,
             hidden_props=body.hidden_props)
    db.add(c)
    db.flush()
    if body.label_ids:
        _apply_labels(db, c, body.label_ids)
    db.commit()
    out = card_out(c)
    em.upsert("card", out)
    return out


# ── Repetición ───────────────────────────────────────────────────────────────

def next_date(rule: dict, base, today):
    """Siguiente fecha de una tarea que se repite, estrictamente después de
    `base`; si aun así queda en el pasado, se sigue avanzando hasta hoy o
    después (lo atrasado no se acumula).
    rule: {"freq": daily|weekly|monthly|yearly, "interval": N, "weekdays": [0..6] (0 = lunes)}"""
    import calendar
    from datetime import timedelta

    freq = rule.get("freq", "weekly")
    n = max(1, int(rule.get("interval") or 1))
    days = sorted({int(d) for d in rule.get("weekdays") or [] if 0 <= int(d) <= 6})

    def step(d):
        if freq == "daily":
            return d + timedelta(days=n)
        if freq == "weekly":
            if not days:
                return d + timedelta(weeks=n)
            monday = d - timedelta(days=d.weekday())
            c = d + timedelta(days=1)
            for _ in range(7 * n + 7):
                weeks = (c - timedelta(days=c.weekday()) - monday).days // 7
                if c.weekday() in days and weeks % n == 0:
                    return c
                c += timedelta(days=1)
            return d + timedelta(weeks=n)
        if freq == "monthly":
            m = d.month - 1 + n
            y, m = d.year + m // 12, m % 12 + 1
            return d.replace(year=y, month=m, day=min(d.day, calendar.monthrange(y, m)[1]))
        if freq == "yearly":
            y = d.year + n
            return d.replace(year=y, day=min(d.day, calendar.monthrange(y, d.month)[1]))
        return d + timedelta(days=1)

    nxt = step(base)
    for _ in range(1000):
        if nxt >= today:
            break
        nxt = step(nxt)
    return nxt


def first_due(db_user, c: Card):
    """Una tarea que se repite y no tiene fecha recibe la de su primera
    repetición (hoy o la siguiente que toque): así sale en el calendario y
    las siguientes heredan el ritmo."""
    from datetime import time, timedelta
    from zoneinfo import ZoneInfo

    rule = c.recurrence
    if not rule or c.due_at or c.done or c.is_template:
        return
    try:
        tz = ZoneInfo(db_user.timezone or "Europe/Madrid")
    except Exception:
        tz = ZoneInfo("Europe/Madrid")
    today = datetime.now(tz).date()
    day = next_date(rule, today - timedelta(days=1), today) if rule.get("freq") == "weekly" and rule.get("weekdays") else today
    c.due_at, c.due_all_day = datetime.combine(day, time(12), tz).astimezone(timezone.utc), True


def _uncheck(content):
    if not isinstance(content, dict):
        return content
    out = dict(content)
    if out.get("type") == "taskItem":
        out["attrs"] = {**(out.get("attrs") or {}), "checked": False}
    if isinstance(out.get("content"), list):
        out["content"] = [_uncheck(x) for x in out["content"]]
    return out


def spawn_next(db: Session, user, done_card: Card) -> Card | None:
    """Al terminar una tarea que se repite: crea la siguiente (mismo
    contenido con las casillas desmarcadas, fechas avanzadas) y le pasa la
    repetición, para que volver a marcar o desmarcar la vieja no duplique."""
    from datetime import timedelta
    from zoneinfo import ZoneInfo

    rule = done_card.recurrence
    if not rule or done_card.is_template:
        return None
    try:
        tz = ZoneInfo(user.timezone or "Europe/Madrid")
    except Exception:
        tz = ZoneInfo("Europe/Madrid")
    today = datetime.now(tz).date()
    due_local = done_card.due_at.astimezone(tz).date() if done_card.due_at else None
    base = today if rule.get("from") == "done" or not due_local else due_local
    nxt = next_date(rule, base, today if rule.get("from") != "done" else today + timedelta(days=1))
    delta = timedelta(days=(nxt - (due_local or base)).days)

    c = Card(user_id=user.id, project_id=done_card.project_id, title=done_card.title,
             content=_uncheck(done_card.content), in_todo=done_card.in_todo,
             estimate_minutes=done_card.estimate_minutes, hidden_props=list(done_card.hidden_props or []),
             recurrence=rule, position=done_card.position)
    if done_card.due_at:
        c.due_at, c.due_all_day = done_card.due_at + delta, done_card.due_all_day
    else:
        from datetime import time
        c.due_at, c.due_all_day = datetime.combine(nxt, time(12), tz).astimezone(timezone.utc), True
    if done_card.remind_at:
        c.remind_at = done_card.remind_at + delta
    values = {}
    for k, v in (done_card.values or {}).items():
        if isinstance(v, dict) and v.get("at"):
            try:
                at = datetime.fromisoformat(v["at"].replace("Z", "+00:00")) + delta
                values[k] = {**v, "at": at.isoformat()}
            except ValueError:
                values[k] = v
        else:
            values[k] = v
    c.values = values
    db.add(c)
    db.flush()
    c.labels = _start_labels(db, list(done_card.labels))
    done_card.recurrence = None
    return c


# ── Plantillas ───────────────────────────────────────────────────────────────

def _local_dt(user_tz: str, days: int, hour: int) -> datetime:
    """Hoy (en la zona del usuario) + días, a esa hora local, en UTC."""
    from datetime import time, timedelta
    from zoneinfo import ZoneInfo
    try:
        tz = ZoneInfo(user_tz or "Europe/Madrid")
    except Exception:
        tz = ZoneInfo("Europe/Madrid")
    d = datetime.now(tz).date() + timedelta(days=days)
    return datetime.combine(d, time(hour), tz).astimezone(timezone.utc)


def _start_labels(db: Session, labels: list[Label]) -> list[Label]:
    """Las etiquetas de partida de una tarjeta nueva: sin la de terminado, que
    se cambia por la primera etiqueta normal de su grupo."""
    out = [l for l in labels if not l.marks_done]
    for done_label in [l for l in labels if l.marks_done]:
        first = db.scalar(select(Label).where(Label.group_id == done_label.group_id, Label.marks_done.is_(False))
                          .order_by(Label.position))
        if first:
            out.append(first)
    return out


def instantiate(db: Session, user, src: Card, project_id: int | None, *, position: float | None = None,
                extra_label_ids: list[int] | None = None, dates_from_offsets: bool = True) -> Card:
    """Tarjeta nueva a partir de una plantilla: mismo contenido, propiedades
    visibles y valores; fechas calculadas desde hoy con sus desplazamientos."""
    same_project = src.project_id == project_id
    offsets = (src.template or {}).get("offsets", {}) if dates_from_offsets else {}
    values = {k: v for k, v in (src.values or {}).items()} if same_project else {}
    if position is None:
        top = db.scalar(select(func.min(Card.position)).where(Card.user_id == user.id, Card.project_id == project_id))
        position = (top or 0) - 1
    c = Card(user_id=user.id, project_id=project_id, title=src.title, content=src.content, in_todo=src.in_todo,
             estimate_minutes=src.estimate_minutes, hidden_props=list(src.hidden_props or []),
             recurrence=src.recurrence, position=position, values=values)
    for key, days in offsets.items():
        if days is None:
            continue
        if key == "due":
            c.due_at, c.due_all_day = _local_dt(user.timezone, int(days), 12), True
        elif key == "remind":
            c.remind_at = _local_dt(user.timezone, int(days), 9)
        elif key.startswith("f:") and same_project:
            c.values = {**(c.values or {}), key[2:]: {"at": _local_dt(user.timezone, int(days), 12).isoformat(), "all_day": True}}
    db.add(c)
    db.flush()
    labels = _start_labels(db, list(src.labels)) if same_project else []
    ids = [l.id for l in labels] + list(extra_label_ids or [])
    if ids:
        _apply_labels(db, c, ids)
    return c


class FromTemplateIn(BaseModel):
    project_id: int | None = None
    label_ids: list[int] = []
    position: float | None = None


@router.post("/from-template/{template_id}", status_code=201)
def from_template(template_id: int, body: FromTemplateIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    src = own_card(db, em.user.id, template_id)
    if not src.is_template:
        raise HTTPException(422, "No es una plantilla")
    if body.project_id is not None:
        own_project(db, em.user.id, body.project_id)
    c = instantiate(db, em.user, src, body.project_id, position=body.position, extra_label_ids=body.label_ids)
    db.commit()
    out = card_out(c)
    em.upsert("card", out)
    return out


class AsTemplateIn(BaseModel):
    profile: bool = False  # True = plantilla general (para cualquier proyecto)


@router.post("/{card_id}/as-template", status_code=201)
def as_template(card_id: int, body: AsTemplateIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    """Guarda una tarjeta como plantilla. Sus fechas pasan a ser relativas
    (días desde hoy) y la de terminado se cambia por el estado inicial."""
    from datetime import date as _date
    src = own_card(db, em.user.id, card_id)
    today = datetime.now(timezone.utc).date()

    def off(dt):
        return max(0, (dt.date() - today).days) if dt else None

    offsets = {"due": off(src.due_at), "remind": off(src.remind_at)}
    keep_values = {}
    for k, v in (src.values or {}).items():
        if isinstance(v, dict) and v.get("at"):
            try:
                offsets[f"f:{k}"] = max(0, (_date.fromisoformat(v["at"][:10]) - today).days)
            except ValueError:
                pass
        else:
            keep_values[k] = v
    offsets = {k: v for k, v in offsets.items() if v is not None}
    project_id = None if body.profile else src.project_id
    t = Card(user_id=em.user.id, project_id=project_id, title=src.title, content=src.content, in_todo=src.in_todo,
             estimate_minutes=src.estimate_minutes, hidden_props=list(src.hidden_props or []),
             values={} if body.profile else keep_values, recurrence=src.recurrence, position=0,
             is_template=True, template={"name": src.title or "Plantilla", "offsets": offsets})
    db.add(t)
    db.flush()
    if not body.profile:
        t.labels = _start_labels(db, list(src.labels))
    db.commit()
    out = card_out(t)
    em.upsert("card", out)
    return out


class DuplicateIn(BaseModel):
    with_content: bool = True


@router.get("/events/postpones")
def postpones(start: str, end: str, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    """Aplazamientos en un rango (para la revisión semanal)."""
    from datetime import date as _date, time as _time
    try:
        a = datetime.combine(_date.fromisoformat(start), _time.min, timezone.utc)
        b = datetime.combine(_date.fromisoformat(end), _time.max, timezone.utc)
    except ValueError:
        raise HTTPException(422, "Fechas no válidas")
    rows = db.scalars(select(CardEvent).where(CardEvent.user_id == em.user.id, CardEvent.kind == "postpone",
                                              CardEvent.at >= a, CardEvent.at <= b).order_by(CardEvent.at)).all()
    return [{"card_id": r.card_id, "at": r.at.isoformat(), **(r.data or {})} for r in rows]


@router.post("/{card_id}/duplicate", status_code=201)
def duplicate_card(card_id: int, body: DuplicateIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    """Copia de una tarjeta: mismas propiedades (proyecto, etiquetas, fechas,
    campos propios…) y, si se pide, el mismo contenido. Sale sin terminar y
    justo detrás de la original."""
    src = own_card(db, em.user.id, card_id)
    nxt = db.scalar(select(func.min(Card.position)).where(
        Card.user_id == em.user.id, Card.project_id == src.project_id, Card.position > src.position))
    c = Card(
        user_id=em.user.id, project_id=src.project_id, title=f"{src.title} (copia)".strip(),
        content=src.content if body.with_content else None, in_todo=src.in_todo,
        due_at=src.due_at, due_all_day=src.due_all_day, remind_at=src.remind_at,
        estimate_minutes=src.estimate_minutes, values=dict(src.values or {}),
        hidden_props=list(src.hidden_props or []), recurrence=src.recurrence,
        position=(src.position + nxt) / 2 if nxt is not None else src.position + 1,
    )
    db.add(c)
    db.flush()
    # Las etiquetas, salvo la de terminado: la copia empieza pendiente, en la
    # primera etiqueta normal del grupo de estado
    labels = [l for l in src.labels if not l.marks_done]
    for done_label in [l for l in src.labels if l.marks_done]:
        first = db.scalar(select(Label).where(Label.group_id == done_label.group_id, Label.marks_done.is_(False))
                          .order_by(Label.position))
        if first:
            labels.append(first)
    c.labels = labels
    db.commit()
    out = card_out(c)
    em.upsert("card", out)
    return out


@router.patch("/{card_id}")
def patch_card(card_id: int, body: CardPatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    c = own_card(db, em.user.id, card_id)
    was_done = c.done
    data = body.model_dump(exclude_unset=True)
    if "project_id" in data and data["project_id"] != c.project_id:
        if data["project_id"] is not None:
            own_project(db, em.user.id, data["project_id"])
        c.project_id = data["project_id"]
        c.labels = []  # las etiquetas y los campos son de cada proyecto
        c.values = {}
    # Aplazamiento: una tarea pendiente cuya fecha pasa a ser más tarde (no
    # cuenta ponerle fecha por primera vez ni adelantarla)
    if ("due_at" in data and data["due_at"] and c.due_at and not c.done and not c.is_template
            and data["due_at"].date() > c.due_at.date()):
        c.postpone_count = (c.postpone_count or 0) + 1
        db.add(CardEvent(user_id=em.user.id, card_id=c.id, kind="postpone",
                         data={"from": c.due_at.isoformat(), "to": data["due_at"].isoformat()}))
    for k in ("title", "content", "in_todo", "due_at", "due_all_day", "remind_at", "estimate_minutes", "position",
              "hidden_props", "template", "recurrence"):
        if k in data and not (k in ("hidden_props", "template") and data[k] is None):
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
    if "recurrence" in data:
        first_due(em.user, c)
    c.updated_at = datetime.now(timezone.utc)
    spawned = spawn_next(db, em.user, c) if (c.done and not was_done) else None
    db.commit()
    out = card_out(c)
    em.upsert("card", out)
    if spawned:
        # echo: también al dispositivo que la ha terminado (la respuesta solo
        # trae la tarjeta terminada)
        em.upsert("card", card_out(spawned), echo=True)
    return out


@router.delete("/{card_id}")
def delete_card(card_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    c = own_card(db, em.user.id, card_id)
    db.delete(c)
    db.commit()
    em.delete("card", card_id)
    return {"ok": True}
