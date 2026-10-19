"""Parte de horas: horario por día de la semana y cálculos del día.

Los ajustes viven en `user.prefs["hours"]` y el módulo se enciende con
`user.prefs["mod_hours"]`. Todo lo que no esté guardado cae en estos valores
por defecto (los de Cuarto de Hora: de lunes a jueves 8 h con 45 min de
comida desde las 14:30, viernes 8 h sin comida, fin de semana libre).
"""
from datetime import date

DEFAULT_DAY = {"target": 480, "lunch": 45, "lunch_from": "14:30"}
DEFAULT_SCHEDULE = [
    dict(DEFAULT_DAY), dict(DEFAULT_DAY), dict(DEFAULT_DAY), dict(DEFAULT_DAY),
    {"target": 480, "lunch": 0, "lunch_from": "14:30"},
    {"target": 0, "lunch": 0, "lunch_from": "14:30"},
    {"target": 0, "lunch": 0, "lunch_from": "14:30"},
]
DEFAULTS = {
    "schedule": DEFAULT_SCHEDULE,
    "step": 15,  # precisión en minutos (5, 15, 30)
    "format": "dec",  # dec = 8,25 · hm = 8:15
    "region": None,  # festivos: código de comunidad (VC, MD…), "" solo nacionales, None sin festivos
    "notify_exit": None,  # minutos antes de la salida prevista para avisar (None = no)
    "notify_close": None,  # "HH:MM": aviso si quedan horas sin imputar (None = no)
    "today_widget": True,
}


def enabled(user) -> bool:
    return bool((user.prefs or {}).get("mod_hours"))


def settings_of(user) -> dict:
    raw = (user.prefs or {}).get("hours") or {}
    out = {**DEFAULTS, **{k: v for k, v in raw.items() if k in DEFAULTS}}
    sched = out["schedule"] if isinstance(out["schedule"], list) and len(out["schedule"]) == 7 else DEFAULT_SCHEDULE
    out["schedule"] = [{**DEFAULT_DAY, **(d if isinstance(d, dict) else {})} for d in sched]
    return out


def is_holiday(day: date, region) -> bool:
    if region is None:
        return False
    try:
        import holidays as hol
        return day in hol.country_holidays("ES", subdiv=region or None, years=[day.year])
    except Exception:  # noqa: BLE001
        return False


def day_defaults(user, day: date) -> dict:
    """Lo que copia un día al nacer: su horario de la semana (0 si es festivo)."""
    st = settings_of(user)
    d = st["schedule"][day.weekday()]
    target = 0 if is_holiday(day, st["region"]) else int(d["target"])
    return {"target_minutes": target, "lunch_minutes": int(d["lunch"]), "lunch_from": d["lunch_from"]}


def to_min(hm: str | None) -> int | None:
    if not hm:
        return None
    h, m = hm.split(":")
    return int(h) * 60 + int(m)


def exit_minutes(start: int, target: int, lunch: int, lunch_from: int) -> int:
    """Salida prevista: la comida solo alarga el día si la jornada llega a ella."""
    base = start + target
    return base + (lunch if base >= lunch_from else 0)


def worked_minutes(start: int, target: int, lunch: int, lunch_from: int, now: int) -> int:
    discount = lunch if now >= lunch_from + lunch else max(0, now - lunch_from) if now >= lunch_from else 0
    return max(0, min(target, now - start - discount))
