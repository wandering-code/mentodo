"""Ranking de horas: horas de más y balance de la gente de mis equipos.

Lo ve cualquiera (aunque no use el parte de horas); salen solo quienes tienen
el módulo encendido y no lo han ocultado en Ajustes → Parte de horas. Mismas
cuentas que el cliente (frontend/src/lib/hours.js):

- Horas de más: salida real − salida prevista, solo en los días con entrada y
  salida real (sin la cuenta en vivo de hoy, para que no se mueva sola).
- Balance: imputado − jornada, solo en los días con partes.
"""
from calendar import monthrange
from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Emitter, emitter
from ..hours import enabled, exit_minutes, to_min
from ..models import Team, TeamMember, TimeEntry, User, WorkDay
from ..teams import active_team_ids, person_color, teammate_ids

router = APIRouter(prefix="/ranking", tags=["ranking"])

RELOAD = {"t": "reload_ranking"}


def notify_ranking(em: Emitter, db: Session) -> None:
    """Mis horas han cambiado: que recargue el ranking quien lo tenga abierto
    (mis compañeros y mis otros dispositivos)."""
    em.to_users(teammate_ids(db, em.user.id), [RELOAD])
    em.events.append({**RELOAD, "echo": True})
    em._schedule()


def visible(user: User) -> bool:
    return user.status == "approved" and enabled(user) and ((user.prefs or {}).get("hours") or {}).get("ranking", True) is not False


def today_of(user: User) -> date:
    try:
        return datetime.now(ZoneInfo(user.timezone or "Europe/Madrid")).date()
    except Exception:  # noqa: BLE001
        return date.today()


def period_range(period: str, offset: int, today: date) -> tuple[date, date]:
    if period == "week":
        start = today - timedelta(days=today.weekday()) + timedelta(weeks=offset)
        return start, start + timedelta(days=6)
    if period == "month":
        m = today.year * 12 + today.month - 1 + offset
        y, mo = divmod(m, 12)
        start = date(y, mo + 1, 1)
        return start, date(y, mo + 1, monthrange(y, mo + 1)[1])
    y = today.year + offset
    return date(y, 1, 1), date(y, 12, 31)


def extra_of(d: WorkDay) -> int | None:
    start, end = to_min(d.start), to_min(d.end)
    if start is None or end is None:
        return None
    if end < start:
        end += 1440  # salida pasada la medianoche
    return end - exit_minutes(start, d.target_minutes, d.lunch_minutes, to_min(d.lunch_from))


@router.get("")
def get_ranking(period: Literal["week", "month", "year"] = "week", offset: int = Query(0, ge=-100, le=0),
                em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    me = em.user
    today = today_of(me)
    start, end = period_range(period, offset, today)
    last = min(end, today)

    my_teams = active_team_ids(db, me.id)
    teams = db.scalars(select(Team).where(Team.id.in_(my_teams)).order_by(Team.created_at)).all() if my_teams else []
    # Con quién comparto cada equipo (para filtrar por equipo en la página)
    shared: dict[int, list[int]] = {}
    if my_teams:
        for tid, uid in db.execute(select(TeamMember.team_id, TeamMember.user_id)
                                   .where(TeamMember.team_id.in_(my_teams), TeamMember.status == "active")):
            shared.setdefault(uid, []).append(tid)
    ids = set(shared) | {me.id}
    users = [u for u in db.scalars(select(User).where(User.id.in_(ids))) if visible(u)]
    uids = [u.id for u in users]

    days: dict[int, list[WorkDay]] = {}
    imputed: dict[tuple[int, date], int] = {}
    if uids and start <= last:
        for d in db.scalars(select(WorkDay).where(WorkDay.user_id.in_(uids), WorkDay.day >= start, WorkDay.day <= last)):
            days.setdefault(d.user_id, []).append(d)
        for uid, day, mins in db.execute(select(TimeEntry.user_id, TimeEntry.day, func.sum(TimeEntry.minutes))
                                         .where(TimeEntry.user_id.in_(uids), TimeEntry.day >= start, TimeEntry.day <= last)
                                         .group_by(TimeEntry.user_id, TimeEntry.day)):
            imputed[(uid, day)] = int(mins)

    people = []
    for u in users:
        by_day = {d.day: d for d in days.get(u.id, [])}
        extra, extra_days = 0, 0
        for d in by_day.values():
            x = extra_of(d)
            if x is not None:
                extra += x
                extra_days += 1
        balance, balance_days = 0, 0
        for (uid, day), mins in imputed.items():
            if uid != u.id:
                continue
            target = by_day[day].target_minutes if day in by_day else 0
            balance += mins - target
            balance_days += 1
        people.append({
            "user_id": u.id, "display_name": u.display_name, "username": u.username, "color": person_color(u),
            "me": u.id == me.id, "teams": sorted(shared.get(u.id, [])) if u.id != me.id else my_teams,
            "extra": extra, "extra_days": extra_days, "balance": balance, "balance_days": balance_days,
        })

    return {
        "period": period, "offset": offset, "start": start, "end": end,
        "teams": [{"id": t.id, "name": t.name} for t in teams],
        "people": people,
        "me_hidden": enabled(me) and not visible(me),
        "me_module": enabled(me),
    }
