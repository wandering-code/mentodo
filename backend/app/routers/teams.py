"""Equipos: crear, invitar por usuario, aceptar o rechazar, salir.

Las invitaciones avisan siempre (aviso en Mentodo + push), tenga o no la otra
persona activado algún módulo: un equipo es algo general de la cuenta.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Emitter, emitter
from ..models import Team, TeamMember, User
from ..notify import create_notification
from ..teams import person_color

router = APIRouter(prefix="/teams", tags=["teams"])

RELOAD = [{"t": "reload_teams"}]


class TeamIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class InviteIn(BaseModel):
    username: str = Field(min_length=1, max_length=40)


def team_out(db: Session, team: Team) -> dict:
    rows = db.execute(select(TeamMember, User).join(User, User.id == TeamMember.user_id)
                      .where(TeamMember.team_id == team.id).order_by(TeamMember.created_at, TeamMember.id)).all()
    return {
        "id": team.id, "name": team.name, "owner_id": team.owner_id,
        "members": [{"user_id": u.id, "username": u.username, "display_name": u.display_name,
                     "status": m.status, "color": person_color(u)} for m, u in rows],
    }


def teams_of(db: Session, user_id: int) -> list[dict]:
    """Los equipos donde estoy (también los que tengo pendientes de aceptar)."""
    tids = db.scalars(select(TeamMember.team_id).where(TeamMember.user_id == user_id)).all()
    teams = db.scalars(select(Team).where(Team.id.in_(tids)).order_by(Team.created_at)).all() if tids else []
    return [team_out(db, t) for t in teams]


def _member(db: Session, team_id: int, user_id: int) -> TeamMember | None:
    return db.scalar(select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id))


def _team_as_active(db: Session, team_id: int, user_id: int) -> Team:
    team = db.get(Team, team_id)
    m = _member(db, team_id, user_id) if team else None
    if not team or not m or m.status != "active":
        raise HTTPException(404, "Equipo no encontrado")
    return team


def _member_ids(db: Session, team_id: int) -> list[int]:
    return list(db.scalars(select(TeamMember.user_id).where(TeamMember.team_id == team_id)))


def _notify(em: Emitter, db: Session, user_id: int, key: str, title: str, body: str):
    n = create_notification(db, user_id, key, title, body, url="/ajustes#equipo")
    if n:
        em.to_users([user_id], [{"t": "upsert", "k": "notification", "d": n}])


@router.get("")
def list_teams(em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    return teams_of(db, em.user.id)


@router.post("", status_code=201)
def create_team(body: TeamIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    team = Team(name=body.name.strip(), owner_id=em.user.id)
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=em.user.id, status="active", invited_by=em.user.id))
    db.commit()
    em.events.extend(RELOAD)
    em._schedule()
    return team_out(db, team)


@router.patch("/{team_id}")
def rename_team(team_id: int, body: TeamIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    team = _team_as_active(db, team_id, em.user.id)
    team.name = body.name.strip()
    db.commit()
    em.to_users(_member_ids(db, team.id), RELOAD)
    em.events.extend(RELOAD)
    em._schedule()
    return team_out(db, team)


@router.post("/{team_id}/invite")
def invite(team_id: int, body: InviteIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    team = _team_as_active(db, team_id, em.user.id)
    name = body.username.strip().lstrip("@").lower()
    other = db.scalar(select(User).where(func.lower(User.username) == name, User.status == "approved"))
    if not other:
        raise HTTPException(404, f"No hay ninguna cuenta @{name}")
    if other.id == em.user.id:
        raise HTTPException(422, "Ya estás en el equipo")
    if _member(db, team.id, other.id):
        raise HTTPException(409, f"@{other.username} ya está en el equipo o invitado")
    m = TeamMember(team_id=team.id, user_id=other.id, status="invited", invited_by=em.user.id)
    db.add(m)
    db.commit()
    # Siempre, sin mirar módulos: es una invitación a la cuenta
    _notify(em, db, other.id, f"team-invite:{m.id}",
            f"{em.user.display_name} te invita a «{team.name}»",
            "Acepta en Ajustes → Equipo para compartir vuestras vacaciones.")
    em.to_users(_member_ids(db, team.id), RELOAD)
    em.events.extend(RELOAD)
    em._schedule()
    return team_out(db, team)


@router.post("/{team_id}/accept")
def accept(team_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    team = db.get(Team, team_id)
    m = _member(db, team_id, em.user.id) if team else None
    if not team or not m:
        raise HTTPException(404, "Invitación no encontrada")
    if m.status != "active":
        m.status = "active"
        db.commit()
        if m.invited_by and m.invited_by != em.user.id:
            _notify(em, db, m.invited_by, f"team-join:{m.id}",
                    f"{em.user.display_name} se ha unido a «{team.name}»", "Ya podéis ver las vacaciones del otro.")
    # Cambia quién ve qué: todos vuelven a pedir equipos y vacaciones
    ev = RELOAD + [{"t": "reload_vacations"}]
    em.to_users(_member_ids(db, team.id), ev)
    em.events.extend(ev)
    em._schedule()
    return team_out(db, team)


def _drop_member(em: Emitter, db: Session, team: Team, user_id: int):
    m = _member(db, team.id, user_id)
    if not m:
        raise HTTPException(404, "No está en el equipo")
    others = _member_ids(db, team.id)
    db.delete(m)
    db.flush()
    if team.owner_id == user_id:
        # Si se va quien lo creó, pasa al siguiente miembro activo; sin nadie, se borra
        heir = db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.status == "active")
                         .order_by(TeamMember.created_at, TeamMember.id))
        if heir:
            team.owner_id = heir.user_id
        else:
            db.delete(team)
    db.commit()
    ev = RELOAD + [{"t": "reload_vacations"}]
    em.to_users(others, ev)
    em.events.extend(ev)
    em._schedule()


@router.post("/{team_id}/leave")
def leave(team_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    """Salir de un equipo o rechazar la invitación."""
    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(404, "Equipo no encontrado")
    _drop_member(em, db, team, em.user.id)
    return {"ok": True}


@router.delete("/{team_id}/members/{user_id}")
def remove_member(team_id: int, user_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    """Quien creó el equipo puede quitar a alguien o anular su invitación."""
    team = _team_as_active(db, team_id, em.user.id)
    if team.owner_id != em.user.id:
        raise HTTPException(403, "Solo quien creó el equipo puede quitar a alguien")
    _drop_member(em, db, team, user_id)
    return {"ok": True}
