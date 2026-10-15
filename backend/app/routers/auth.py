import re

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import COOKIE, current_user, hash_password, set_session_cookie, verify_password
from ..db import get_db
from ..models import User
from ..notify import notify_admins_new_user
from ..serialize import user_out

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    display_name: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=8, max_length=200)


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/register", status_code=201)
def register(body: RegisterIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    username = body.username.strip().lower()
    if not re.fullmatch(r"[a-z0-9_.-]+", username):
        raise HTTPException(422, "El usuario solo puede tener letras, números, punto, guion y guion bajo")
    if db.scalar(select(User).where(func.lower(User.username) == username)):
        raise HTTPException(409, "Ese nombre de usuario ya existe")
    user = User(username=username, display_name=body.display_name.strip(),
                password_hash=hash_password(body.password), status="pending")
    db.add(user)
    db.commit()
    background.add_task(notify_admins_new_user, user.id)
    return {"status": "pending"}


@router.post("/login")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.username) == body.username.strip().lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Usuario o contraseña incorrectos")
    if user.status == "pending":
        raise HTTPException(403, "Tu cuenta está pendiente de aprobación")
    if user.status != "approved":
        raise HTTPException(403, "Tu cuenta no ha sido aprobada")
    set_session_cookie(response, user.id)
    return user_out(user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)
