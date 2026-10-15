from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import admin_user
from ..db import get_db
from ..models import User
from ..serialize import user_out

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
def list_users(_: User = Depends(admin_user), db: Session = Depends(get_db)):
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    return [user_out(u) for u in users]


def _set_status(db: Session, admin: User, user_id: int, status: str):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    if user.id == admin.id:
        raise HTTPException(400, "No puedes cambiar tu propia cuenta")
    user.status = status
    db.commit()
    return user_out(user)


@router.post("/users/{user_id}/approve")
def approve(user_id: int, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    return _set_status(db, admin, user_id, "approved")


@router.post("/users/{user_id}/reject")
def reject(user_id: int, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    return _set_status(db, admin, user_id, "rejected")


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or user.id == admin.id:
        raise HTTPException(400, "No se puede borrar esa cuenta")
    db.delete(user)
    db.commit()
    return {"ok": True}
