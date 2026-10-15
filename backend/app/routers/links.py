from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Emitter, emitter
from ..models import CardLink
from ..ownership import own_card
from ..serialize import link_out

router = APIRouter(prefix="/links", tags=["links"])


class LinkIn(BaseModel):
    from_id: int
    to_id: int
    kind: str = Field(pattern="^(parent|blocks|relates)$")


def _reaches(db: Session, start: int, target: int, kind: str) -> bool:
    """¿Se llega de start a target siguiendo enlaces de ese tipo? (para no
    crear ciclos: una tarjeta no puede ser subtarea de su propia subtarea)"""
    seen, todo = set(), [start]
    while todo:
        cur = todo.pop()
        if cur == target:
            return True
        if cur in seen:
            continue
        seen.add(cur)
        todo += db.scalars(select(CardLink.to_id).where(CardLink.from_id == cur, CardLink.kind == kind)).all()
    return False


@router.post("", status_code=201)
def create_link(body: LinkIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    if body.from_id == body.to_id:
        raise HTTPException(422, "Una tarjeta no se puede relacionar consigo misma")
    a = own_card(db, em.user.id, body.from_id)
    b = own_card(db, em.user.id, body.to_id)
    if a.is_template or b.is_template:
        raise HTTPException(422, "Las plantillas no se relacionan")
    if body.kind in ("parent", "blocks") and _reaches(db, body.to_id, body.from_id, body.kind):
        raise HTTPException(422, "Eso crearía un círculo")
    if body.kind == "parent":
        # Una subtarea tiene una sola madre: la anterior se sustituye
        for old in db.scalars(select(CardLink).where(CardLink.to_id == body.to_id, CardLink.kind == "parent")).all():
            db.delete(old)
            em.delete("link", old.id)
    # «Relacionadas» no tiene dirección: no se duplica al revés
    dup = db.scalar(select(CardLink).where(CardLink.kind == body.kind, or_(
        (CardLink.from_id == body.from_id) & (CardLink.to_id == body.to_id),
        (CardLink.from_id == body.to_id) & (CardLink.to_id == body.from_id) if body.kind == "relates" else False,
    )))
    if dup:
        return link_out(dup)
    link = CardLink(user_id=em.user.id, from_id=body.from_id, to_id=body.to_id, kind=body.kind)
    db.add(link)
    db.commit()
    out = link_out(link)
    em.upsert("link", out)
    return out


@router.delete("/{link_id}")
def delete_link(link_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    link = db.get(CardLink, link_id)
    if not link or link.user_id != em.user.id:
        raise HTTPException(404, "Relación no encontrada")
    db.delete(link)
    db.commit()
    em.delete("link", link_id)
    return {"ok": True}
