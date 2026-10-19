from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import hash_password, verify_password
from ..db import get_db
from ..deps import Emitter, emitter
from ..models import User
from ..serialize import user_out

router = APIRouter(prefix="/me", tags=["me"])


class MePatch(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=80)
    accent: str | None = Field(None, max_length=20)
    theme: Literal["light", "dark", "system"] | None = None
    timezone: str | None = Field(None, max_length=64)
    todo_projects: list[int] | None = None
    clear_todo_projects: bool = False
    vault_salt: str | None = Field(None, max_length=64)
    vault_check: str | None = Field(None, max_length=200)
    prefs: dict[str, Any] | None = None  # se fusiona con las guardadas (clave a clave)


class PasswordIn(BaseModel):
    current: str
    new: str = Field(min_length=8, max_length=200)


@router.patch("")
def patch_me(body: MePatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    user = db.get(User, em.user.id)
    if body.vault_salt is not None and user.vault_salt and body.vault_salt != user.vault_salt:
        # Cambiar la frase dejaría ilegibles los secretos ya guardados
        raise HTTPException(409, "La bóveda ya está creada")
    for field in ("display_name", "accent", "theme", "timezone", "todo_projects", "vault_salt", "vault_check"):
        val = getattr(body, field)
        if val is not None:
            setattr(user, field, val)
    if body.prefs:
        if len(str(body.prefs)) > 8000:
            raise HTTPException(422, "Preferencias demasiado grandes")
        user.prefs = {k: v for k, v in {**(user.prefs or {}), **body.prefs}.items() if v is not None}
    if body.clear_todo_projects:
        user.todo_projects = None
    db.commit()
    out = user_out(user)
    em.upsert("user", out)
    return out


@router.post("/password")
def change_password(body: PasswordIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    user = db.get(User, em.user.id)
    if not verify_password(body.current, user.password_hash):
        raise HTTPException(400, "La contraseña actual no es correcta")
    user.password_hash = hash_password(body.new)
    db.commit()
    return {"ok": True}
