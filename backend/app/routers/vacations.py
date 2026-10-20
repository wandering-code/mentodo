"""Vacaciones: periodos de días enteros con estado (posible, pedida,
confirmada). Cada uno edita las suyas y ve las de sus compañeros de equipo.

Al crear, cambiar fechas o estado, o borrar unas vacaciones, se avisa a los
compañeros que tengan el módulo de vacaciones encendido. Las confirmadas
cuentan en el parte de horas como días con jornada 0.
"""
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Emitter, emitter
from ..models import User, Vacation
from ..notify import create_notification
from ..teams import STATUS_NAMES, fmt_range, off_dates, teammate_ids, vacations_on, workdays_by_year

router = APIRouter(prefix="/vacations", tags=["vacations"])

Status = Literal["posible", "pedida", "confirmada"]
MAX_SPAN = timedelta(days=366)


class VacationIn(BaseModel):
    start: date
    end: date
    status: Status = "posible"
    note: str = Field("", max_length=200)

    @model_validator(mode="after")
    def _check(self):
        if self.end < self.start:
            self.start, self.end = self.end, self.start
        if self.end - self.start > MAX_SPAN:
            raise ValueError("Como mucho un año seguido")
        return self


class VacationPatch(BaseModel):
    start: date | None = None
    end: date | None = None
    status: Status | None = None
    note: str | None = Field(None, max_length=200)


def vacation_out(v: Vacation, off: set | None = None, db: Session | None = None) -> dict:
    """`days`: días laborables por año, contados con los festivos de su dueño
    (los demás no los conocen todos: su comunidad, sus festivos propios)."""
    if off is None and db is not None:
        off = off_dates(db, db.get(User, v.user_id), set(range(v.start.year, v.end.year + 1)))
    return {"id": v.id, "user_id": v.user_id, "start": v.start.isoformat(), "end": v.end.isoformat(),
            "status": v.status, "note": v.note,
            "days": workdays_by_year(v.start, v.end, off) if off is not None else None,
            "updated_at": v.updated_at.isoformat() if v.updated_at else None}


def visible_vacations(db: Session, user_id: int) -> list[dict]:
    ids = teammate_ids(db, user_id) | {user_id}
    rows = db.scalars(select(Vacation).where(Vacation.user_id.in_(ids)).order_by(Vacation.start, Vacation.id)).all()
    # Los festivos de cada persona, una sola vez para todos sus periodos
    off = {}
    for uid in {v.user_id for v in rows}:
        years = {y for v in rows if v.user_id == uid for y in range(v.start.year, v.end.year + 1)}
        off[uid] = off_dates(db, db.get(User, uid), years)
    return [vacation_out(v, off[v.user_id]) for v in rows]


def _own(db: Session, user_id: int, vid: int) -> Vacation:
    v = db.get(Vacation, vid)
    if not v or v.user_id != user_id:
        raise HTTPException(404, "Vacaciones no encontradas")
    return v


def _share(em: Emitter, db: Session, events: list[dict], key: str, title: str, body: str, day: date | None):
    """Reenvía el cambio a los compañeros y avisa a los que usan el módulo."""
    mates = teammate_ids(db, em.user.id)
    em.to_users(mates, events)
    if not key:
        return
    url = f"/vacaciones?d={day.isoformat()}" if day else "/vacaciones"
    for uid in mates:
        other = db.get(User, uid)
        if not other or not vacations_on(other):
            continue
        n = create_notification(db, uid, key, title, body, url=url)
        if n:
            em.to_users([uid], [{"t": "upsert", "k": "notification", "d": n}])


def _body(v: Vacation) -> str:
    out = STATUS_NAMES.get(v.status, v.status)
    return f"{out} · {v.note}" if v.note else out


@router.get("")
def list_vacations(em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    return visible_vacations(db, em.user.id)


@router.post("", status_code=201)
def create_vacation(body: VacationIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    v = Vacation(user_id=em.user.id, start=body.start, end=body.end, status=body.status, note=body.note.strip())
    db.add(v)
    db.commit()
    out = vacation_out(v, db=db)
    em.upsert("vacation", out)
    who = em.user.display_name
    _share(em, db, [{"t": "upsert", "k": "vacation", "d": out}], f"vac-new:{v.id}",
           f"🌴 {who}: vacaciones {fmt_range(v.start, v.end)}", _body(v), v.start)
    return out


@router.patch("/{vid}")
def patch_vacation(vid: int, body: VacationPatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    v = _own(db, em.user.id, vid)
    before = (v.start, v.end, v.status)
    data = body.model_dump(exclude_unset=True)
    for k, val in data.items():
        if val is not None:
            setattr(v, k, val.strip() if isinstance(val, str) else val)
    if v.end < v.start:
        v.start, v.end = v.end, v.start
    if v.end - v.start > MAX_SPAN:
        raise HTTPException(422, "Como mucho un año seguido")
    db.commit()
    out = vacation_out(v, db=db)
    em.upsert("vacation", out)
    # Solo avisa si cambia algo que importa a los demás (fechas o estado, no la nota)
    changed = before != (v.start, v.end, v.status)
    who = em.user.display_name
    title = (f"✅ {who} ha confirmado sus vacaciones" if v.status == "confirmada" and before[2] != "confirmada"
             else f"🌴 {who} ha cambiado sus vacaciones")
    _share(em, db, [{"t": "upsert", "k": "vacation", "d": out}],
           f"vac-edit:{v.id}:{v.updated_at.timestamp():.0f}" if changed else "",
           title, f"{fmt_range(v.start, v.end).capitalize()} · {_body(v)}", v.start)
    return out


@router.delete("/{vid}")
def delete_vacation(vid: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    v = _own(db, em.user.id, vid)
    start, end, status = v.start, v.end, v.status
    db.delete(v)
    db.commit()
    em.delete("vacation", vid)
    _share(em, db, [{"t": "delete", "k": "vacation", "id": vid}], f"vac-del:{vid}",
           f"{em.user.display_name} ha quitado unas vacaciones",
           f"{fmt_range(start, end).capitalize()} ({STATUS_NAMES.get(status, status).lower()})", start)
    return {"ok": True}
