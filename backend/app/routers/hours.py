"""Parte de horas: días (entrada, jornada, comida) y partes imputados.

Es un módulo opcional: solo lo usa quien lo enciende en Ajustes. Los días se
crean al tocarlos (al fichar la entrada o al añadir el primer parte) copiando
el horario de ese día de la semana.
"""
import re
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Emitter, emitter
from ..hours import day_defaults
from ..models import TimeEntry, WorkDay
from ..ownership import own_card, own_project
from ..serialize import entry_out, workday_out

router = APIRouter(prefix="/hours", tags=["hours"])

HM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _hm(v):
    if v is None or v == "":
        return None
    if not HM.match(v):
        raise ValueError("Hora no válida (HH:MM)")
    return v


class DayPatch(BaseModel):
    start: str | None = None
    end: str | None = None
    target_minutes: int | None = Field(None, ge=0, le=1440)
    lunch_minutes: int | None = Field(None, ge=0, le=600)
    lunch_from: str | None = None

    @field_validator("start", "end", "lunch_from")
    @classmethod
    def _check(cls, v):
        return _hm(v)


class EntryIn(BaseModel):
    day: date
    client: str = Field("", max_length=120)
    task: str = Field("", max_length=300)
    minutes: int = Field(ge=1, le=1440)
    card_id: int | None = None
    project_id: int | None = None


class EntryPatch(BaseModel):
    day: date | None = None
    client: str | None = Field(None, max_length=120)
    task: str | None = Field(None, max_length=300)
    minutes: int | None = Field(None, ge=1, le=1440)
    position: float | None = None


def _ensure_day(db: Session, user, day: date) -> tuple[WorkDay, bool]:
    d = db.scalar(select(WorkDay).where(WorkDay.user_id == user.id, WorkDay.day == day))
    if d:
        return d, False
    d = WorkDay(user_id=user.id, day=day, **day_defaults(user, day))
    db.add(d)
    db.flush()
    return d, True


def _own_entry(db: Session, user_id: int, entry_id: int) -> TimeEntry:
    e = db.get(TimeEntry, entry_id)
    if not e or e.user_id != user_id:
        raise HTTPException(404, "Parte no encontrado")
    return e


def _card_total(db: Session, user_id: int, card_id: int) -> dict:
    total = db.scalar(select(func.coalesce(func.sum(TimeEntry.minutes), 0))
                      .where(TimeEntry.user_id == user_id, TimeEntry.card_id == card_id))
    return {"card_id": card_id, "minutes": int(total or 0)}


def card_totals(db: Session, user_id: int) -> dict[int, int]:
    rows = db.execute(select(TimeEntry.card_id, func.sum(TimeEntry.minutes))
                      .where(TimeEntry.user_id == user_id, TimeEntry.card_id.is_not(None))
                      .group_by(TimeEntry.card_id)).all()
    return {cid: int(m) for cid, m in rows}


def _emit_card_total(em: Emitter, db: Session, card_id: int | None):
    if card_id:
        em.events.append({"t": "card_hours", "d": _card_total(db, em.user.id, card_id)})
        em._schedule()


@router.get("")
def get_range(start: date, end: date, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    if end < start or (end - start) > timedelta(days=400):
        raise HTTPException(422, "Rango no válido")
    uid = em.user.id
    days = db.scalars(select(WorkDay).where(WorkDay.user_id == uid, WorkDay.day >= start, WorkDay.day <= end)).all()
    entries = db.scalars(select(TimeEntry).where(TimeEntry.user_id == uid, TimeEntry.day >= start, TimeEntry.day <= end)
                         .order_by(TimeEntry.day, TimeEntry.position, TimeEntry.id)).all()
    return {"days": [workday_out(d) for d in days], "entries": [entry_out(e) for e in entries]}


@router.put("/days/{day}")
def put_day(day: date, body: DayPatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    d, _ = _ensure_day(db, em.user, day)
    for k, v in body.model_dump(exclude_unset=True).items():
        if k in ("target_minutes", "lunch_minutes", "lunch_from") and v is None:
            continue  # estos no se quedan vacíos
        setattr(d, k, v)
    db.commit()
    out = workday_out(d)
    em.upsert("workday", out)
    return out


@router.delete("/days/{day}")
def reset_day(day: date, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    """Vuelve a poner el horario de la semana (no toca los partes)."""
    d, _ = _ensure_day(db, em.user, day)
    for k, v in day_defaults(em.user, day).items():
        setattr(d, k, v)
    db.commit()
    out = workday_out(d)
    em.upsert("workday", out)
    return out


@router.post("/entries", status_code=201)
def create_entry(body: EntryIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    uid = em.user.id
    project_id = body.project_id
    if body.card_id is not None:
        card = own_card(db, uid, body.card_id)
        project_id = card.project_id
    if project_id is not None:
        own_project(db, uid, project_id)
    d, created = _ensure_day(db, em.user, body.day)
    top = db.scalar(select(func.max(TimeEntry.position)).where(TimeEntry.user_id == uid, TimeEntry.day == body.day)) or 0
    e = TimeEntry(user_id=uid, day=body.day, client=body.client.strip(), task=body.task.strip(),
                  minutes=body.minutes, card_id=body.card_id, project_id=project_id, position=top + 1)
    db.add(e)
    db.commit()
    if created:
        em.upsert("workday", workday_out(d), echo=True)
    out = entry_out(e)
    em.upsert("entry", out)
    _emit_card_total(em, db, e.card_id)
    return {"entry": out, "day": workday_out(d)}


@router.patch("/entries/{entry_id}")
def patch_entry(entry_id: int, body: EntryPatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    e = _own_entry(db, em.user.id, entry_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("day"):
        _ensure_day(db, em.user, data["day"])
    for k, v in data.items():
        if v is not None:
            setattr(e, k, v.strip() if isinstance(v, str) else v)
    db.commit()
    out = entry_out(e)
    em.upsert("entry", out)
    _emit_card_total(em, db, e.card_id)
    return out


@router.delete("/entries/{entry_id}")
def delete_entry(entry_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    e = _own_entry(db, em.user.id, entry_id)
    card_id = e.card_id
    db.delete(e)
    db.commit()
    em.delete("entry", entry_id)
    _emit_card_total(em, db, card_id)
    return {"ok": True}


@router.get("/clients")
def recent_clients(em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    """Clientes usados, el más reciente primero (máx. 25), para autocompletar."""
    rows = db.execute(select(TimeEntry.client, func.max(TimeEntry.created_at).label("last"))
                      .where(TimeEntry.user_id == em.user.id, TimeEntry.client != "")
                      .group_by(TimeEntry.client).order_by(func.max(TimeEntry.created_at).desc()).limit(25)).all()
    return [r[0] for r in rows]


@router.get("/cards/{card_id}")
def card_entries(card_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    own_card(db, em.user.id, card_id)
    entries = db.scalars(select(TimeEntry).where(TimeEntry.user_id == em.user.id, TimeEntry.card_id == card_id)
                         .order_by(TimeEntry.day.desc(), TimeEntry.id.desc())).all()
    return [entry_out(e) for e in entries]

