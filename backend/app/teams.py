"""Equipos: quién comparte con quién.

Es algo general de la cuenta (no depende de ningún módulo): las invitaciones
llegan siempre. Lo que se comparte de momento son las vacaciones.
"""
from datetime import date, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .models import DayOff, TeamMember, User, Vacation

# Colores para distinguir a cada persona en el calendario (mismos ids que las
# etiquetas). Cada uno elige el suyo; si no, se le da uno según su id.
PERSON_COLORS = ["azul", "coral", "morado", "menta", "ambar", "rosa", "verde", "naranja"]
MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
          "septiembre", "octubre", "noviembre", "diciembre"]
STATUS_NAMES = {"posible": "Posible", "pedida": "Pedida", "confirmada": "Confirmada"}


def person_color(user: User) -> str:
    c = ((user.prefs or {}).get("vacations") or {}).get("color")
    return c if c in PERSON_COLORS else PERSON_COLORS[user.id % len(PERSON_COLORS)]


def vacations_on(user: User) -> bool:
    return bool((user.prefs or {}).get("mod_vacations"))


def active_team_ids(db: Session, user_id: int) -> list[int]:
    return list(db.scalars(select(TeamMember.team_id).where(TeamMember.user_id == user_id, TeamMember.status == "active")))


def teammate_ids(db: Session, user_id: int) -> set[int]:
    """Gente con la que comparto al menos un equipo activo (sin contarme)."""
    tids = active_team_ids(db, user_id)
    if not tids:
        return set()
    ids = db.scalars(select(TeamMember.user_id).where(TeamMember.team_id.in_(tids), TeamMember.status == "active"))
    return {i for i in ids if i != user_id}


def is_vacation(db: Session, user_id: int, day: date) -> bool:
    """¿Ese día cae en unas vacaciones confirmadas? (para el parte de horas)"""
    return db.scalar(select(Vacation.id).where(
        Vacation.user_id == user_id, Vacation.status == "confirmada",
        Vacation.start <= day, Vacation.end >= day).limit(1)) is not None


def days_off_query(db: Session, user_id: int):
    """Festivos propios que valen para mí: los míos sin equipo y los de mis
    equipos activos."""
    tids = active_team_ids(db, user_id)
    cond = (DayOff.team_id.is_(None)) & (DayOff.user_id == user_id)
    if tids:
        cond = or_(cond, DayOff.team_id.in_(tids))
    return select(DayOff).where(cond)


def is_day_off(db: Session, user_id: int, day: date) -> bool:
    """¿Ese día es un festivo propio (mío o de mi equipo)? (para el parte de horas)"""
    q = days_off_query(db, user_id).where(DayOff.start <= day, DayOff.end >= day).limit(1)
    return db.scalars(q).first() is not None


def fmt_range(start: date, end: date) -> str:
    """«el 3 de agosto» · «del 3 al 14 de agosto» · «del 28 de julio al 8 de agosto»"""
    if start == end:
        return f"el {start.day} de {MONTHS[start.month - 1]}"
    if (start.year, start.month) == (end.year, end.month):
        return f"del {start.day} al {end.day} de {MONTHS[end.month - 1]}"
    year = f" de {start.year}" if start.year != end.year else ""
    return f"del {start.day} de {MONTHS[start.month - 1]}{year} al {end.day} de {MONTHS[end.month - 1]}"


def vacation_region(user: User):
    """Festivos de la comunidad que usa en Vacaciones (como vacSettings en el
    cliente): los suyos, o los de Horas si no eligió, o solo nacionales."""
    vac = (user.prefs or {}).get("vacations") or {}
    if "region" in vac:
        return vac["region"]
    hours = (user.prefs or {}).get("hours") or {}
    return hours["region"] if hours.get("region") is not None else ""


def off_dates(db: Session, user: User, years: set[int]) -> set[date]:
    """Días que no son laborables para esa persona, aparte del fin de semana:
    festivos de su comunidad y festivos propios (suyos y de sus equipos)."""
    out: set[date] = set()
    region = vacation_region(user)
    if region is not None and years:
        try:
            import holidays as hol
            out |= {d for d in hol.country_holidays("ES", subdiv=region or None, years=sorted(years)) if isinstance(d, date)}
        except Exception:  # noqa: BLE001
            pass
    for d in db.scalars(days_off_query(db, user.id)):
        day = d.start
        while day <= d.end:
            out.add(day)
            day += timedelta(days=1)
    return out


def workdays_by_year(start: date, end: date, off: set[date]) -> dict[str, int]:
    """Días laborables de un periodo, por año: {"2026": 6, "2027": 2}"""
    out: dict[str, int] = {}
    day = start
    while day <= end:
        if day.weekday() < 5 and day not in off:
            out[str(day.year)] = out.get(str(day.year), 0) + 1
        day += timedelta(days=1)
    return out


def reload_vacations_for(em, db: Session, user_ids) -> None:
    """Las cuentas de las vacaciones de esa gente han cambiado (festivos
    nuevos, otra comunidad…): que las vuelvan a pedir quienes las ven."""
    viewers: set[int] = set()
    for uid in set(user_ids):
        viewers |= teammate_ids(db, uid) | {uid}
    viewers.discard(em.user.id)
    em.to_users(viewers, [{"t": "reload_vacations"}])
