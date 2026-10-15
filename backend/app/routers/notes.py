from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..deps import Emitter, emitter
from ..models import Note, User
from ..ownership import own_project
from ..serialize import note_out

router = APIRouter(tags=["notes"])


class NoteIn(BaseModel):
    project_id: int | None = None
    title: str = Field("", max_length=300)
    icon: str = Field("📝", max_length=16)
    content: dict | None = None


class NotePatch(BaseModel):
    project_id: int | None = None
    title: str | None = Field(None, max_length=300)
    icon: str | None = Field(None, max_length=16)
    content: dict | None = None
    pinned: bool | None = None
    position: float | None = None


def own_note(db: Session, user_id: int, note_id: int) -> Note:
    n = db.get(Note, note_id)
    if not n or n.user_id != user_id:
        raise HTTPException(404, "Apunte no encontrado")
    return n


@router.post("/notes", status_code=201)
def create_note(body: NoteIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    if body.project_id is not None:
        own_project(db, em.user.id, body.project_id)
    top = db.scalar(select(func.min(Note.position)).where(Note.user_id == em.user.id)) or 0
    n = Note(user_id=em.user.id, project_id=body.project_id, title=body.title, icon=body.icon,
             content=body.content, position=top - 1)
    db.add(n)
    db.commit()
    out = note_out(n)
    em.upsert("note", out)
    return out


@router.patch("/notes/{note_id}")
def patch_note(note_id: int, body: NotePatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    n = own_note(db, em.user.id, note_id)
    data = body.model_dump(exclude_unset=True)
    if "project_id" in data and data["project_id"] is not None:
        own_project(db, em.user.id, data["project_id"])
    for k, v in data.items():
        if k in ("project_id", "content") or v is not None:
            setattr(n, k, v)
    db.commit()
    out = note_out(n)
    em.upsert("note", out)
    return out


@router.delete("/notes/{note_id}")
def delete_note(note_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    n = own_note(db, em.user.id, note_id)
    db.delete(n)
    db.commit()
    em.delete("note", note_id)
    return {"ok": True}


# ── Festivos (para el informe de jornadas) ───────────────────────────────────

REGIONS = {
    "": "Solo nacionales", "AN": "Andalucía", "AR": "Aragón", "AS": "Asturias", "CB": "Cantabria",
    "CE": "Ceuta", "CL": "Castilla y León", "CM": "Castilla-La Mancha", "CN": "Canarias", "CT": "Cataluña",
    "EX": "Extremadura", "GA": "Galicia", "IB": "Islas Baleares", "MC": "Murcia", "MD": "Madrid",
    "ML": "Melilla", "NC": "Navarra", "PV": "País Vasco", "RI": "La Rioja", "VC": "Comunitat Valenciana",
}


@router.get("/holidays")
def get_holidays(region: str = "VC", years: str = Query(...), _: User = Depends(current_user)):
    import holidays as hol

    if region not in REGIONS:
        raise HTTPException(422, "Comunidad desconocida")
    try:
        ys = sorted({int(y) for y in years.split(",") if y})[:10]
    except ValueError:
        raise HTTPException(422, "Años no válidos")
    cal = hol.country_holidays("ES", subdiv=region or None, years=ys, language="es")
    return {
        "regions": REGIONS,
        "holidays": [{"date": d.isoformat(), "name": name} for d, name in sorted(cal.items()) if isinstance(d, date)],
    }
