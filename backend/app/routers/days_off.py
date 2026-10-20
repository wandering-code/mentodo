"""Festivos propios: días que no salen en el calendario de la comunidad pero
que no se trabajan (p. ej. los que da la empresa a final de año).

Sin equipo son solo de quien los crea. Con equipo valen para todos sus
miembros activos: cualquiera puede cambiarlos o quitarlos, y al crear uno se
avisa a los demás. Cuentan como festivo en Vacaciones (no gastan días) y en
el parte de horas (jornada 0).
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Emitter, emitter
from ..models import DayOff, Team, TeamMember, User
from ..notify import create_notification
from ..teams import active_team_ids, days_off_query, fmt_range, vacations_on

router = APIRouter(prefix="/days-off", tags=["days-off"])

MAX_SPAN = timedelta(days=366)


class DayOffIn(BaseModel):
    start: date
    end: date
    name: str = Field("", max_length=120)
    team_id: int | None = None

    @model_validator(mode="after")
    def _check(self):
        if self.end < self.start:
            self.start, self.end = self.end, self.start
        if self.end - self.start > MAX_SPAN:
            raise ValueError("Como mucho un año seguido")
        return self


class DayOffPatch(BaseModel):
    start: date | None = None
    end: date | None = None
    name: str | None = Field(None, max_length=120)
    # Cambiar a «solo para mí» se manda como team_id = null
    team_id: int | None = None


def day_off_out(d: DayOff) -> dict:
    return {"id": d.id, "user_id": d.user_id, "team_id": d.team_id, "start": d.start.isoformat(),
            "end": d.end.isoformat(), "name": d.name,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None}


def visible_days_off(db: Session, user_id: int) -> list[dict]:
    rows = db.scalars(days_off_query(db, user_id).order_by(DayOff.start, DayOff.id)).all()
    return [day_off_out(d) for d in rows]


def _members(db: Session, team_id: int | None) -> set[int]:
    if team_id is None:
        return set()
    return set(db.scalars(select(TeamMember.user_id).where(TeamMember.team_id == team_id, TeamMember.status == "active")))


def _check_team(db: Session, user_id: int, team_id: int | None):
    if team_id is not None and team_id not in active_team_ids(db, user_id):
        raise HTTPException(404, "Equipo no encontrado")


def _own(db: Session, user_id: int, did: int) -> DayOff:
    d = db.get(DayOff, did)
    if not d:
        raise HTTPException(404, "Festivo no encontrado")
    if d.team_id is None and d.user_id != user_id:
        raise HTTPException(404, "Festivo no encontrado")
    if d.team_id is not None and d.team_id not in active_team_ids(db, user_id):
        raise HTTPException(404, "Festivo no encontrado")
    return d


def _notify(em: Emitter, db: Session, d: DayOff):
    team = db.get(Team, d.team_id)
    url = f"/vacaciones?d={d.start.isoformat()}"
    name = f"«{d.name}» " if d.name else ""
    for uid in _members(db, d.team_id) - {em.user.id}:
        other = db.get(User, uid)
        if not other or not vacations_on(other):
            continue
        n = create_notification(db, uid, f"dayoff-new:{d.id}",
                                f"📅 {em.user.display_name} ha marcado un festivo para «{team.name}»",
                                f"{name}{fmt_range(d.start, d.end)}".strip().capitalize(), url=url)
        if n:
            em.to_users([uid], [{"t": "upsert", "k": "notification", "d": n}])


@router.get("")
def list_days_off(em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    return visible_days_off(db, em.user.id)


@router.post("", status_code=201)
def create_day_off(body: DayOffIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    _check_team(db, em.user.id, body.team_id)
    d = DayOff(user_id=em.user.id, team_id=body.team_id, start=body.start, end=body.end, name=body.name.strip())
    db.add(d)
    db.commit()
    out = day_off_out(d)
    em.upsert("dayoff", out)
    em.to_users(_members(db, d.team_id), [{"t": "upsert", "k": "dayoff", "d": out}])
    if d.team_id is not None:
        _notify(em, db, d)
    return out


@router.patch("/{did}")
def patch_day_off(did: int, body: DayOffPatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    d = _own(db, em.user.id, did)
    data = body.model_dump(exclude_unset=True)
    before = _members(db, d.team_id)
    if "team_id" in data:
        _check_team(db, em.user.id, data["team_id"])
        d.team_id = data["team_id"]
    for k in ("start", "end"):
        if data.get(k) is not None:
            setattr(d, k, data[k])
    if data.get("name") is not None:
        d.name = data["name"].strip()
    if d.end < d.start:
        d.start, d.end = d.end, d.start
    if d.end - d.start > MAX_SPAN:
        raise HTTPException(422, "Como mucho un año seguido")
    db.commit()
    out = day_off_out(d)
    em.upsert("dayoff", out)
    after = _members(db, d.team_id)
    em.to_users(after, [{"t": "upsert", "k": "dayoff", "d": out}])
    # Quien estaba en el equipo de antes y ya no lo ve
    em.to_users(before - after, [{"t": "delete", "k": "dayoff", "id": d.id}])
    return out


@router.delete("/{did}")
def delete_day_off(did: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    d = _own(db, em.user.id, did)
    members = _members(db, d.team_id)
    db.delete(d)
    db.commit()
    em.delete("dayoff", did)
    em.to_users(members, [{"t": "delete", "k": "dayoff", "id": did}])
    return {"ok": True}
