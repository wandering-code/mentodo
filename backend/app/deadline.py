"""La fecha de entrega de una tarjeta: la que su proyecto marque como tal."""
from datetime import datetime

from .models import Card, Project


def deadline_key(project: Project | None) -> str:
    k = getattr(project, "deadline_key", None) or "due"
    return k if k == "due" or k.startswith("f:") else "due"


def read_date(card: Card, key: str):
    """(fecha, todo_el_día) de la propiedad `key` de la tarjeta, o None."""
    if key == "due":
        return (card.due_at, bool(card.due_all_day)) if card.due_at else None
    v = (card.values or {}).get(key[2:])
    if not isinstance(v, dict) or not v.get("at"):
        return None
    try:
        return datetime.fromisoformat(v["at"].replace("Z", "+00:00")), bool(v.get("all_day", True))
    except ValueError:
        return None
