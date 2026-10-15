from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Cookie, Depends, HTTPException, Response

from .config import settings
from .db import SessionLocal
from .models import User

COOKIE = "mentodo_session"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode()[:72], hashed.encode())
    except ValueError:
        return False


def create_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=settings.session_days)
    return jwt.encode({"sub": str(user_id), "exp": exp}, settings.secret_key, algorithm="HS256")


def set_session_cookie(response: Response, user_id: int):
    response.set_cookie(
        COOKIE, create_token(user_id), max_age=settings.session_days * 86400,
        httponly=True, samesite="lax", secure=settings.cookie_secure, path="/",
    )


def user_id_from_token(token: str | None) -> int | None:
    if not token:
        return None
    try:
        return int(jwt.decode(token, settings.secret_key, algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def current_user(mentodo_session: str | None = Cookie(None)) -> User:
    uid = user_id_from_token(mentodo_session)
    if uid is None:
        raise HTTPException(401, "No has iniciado sesión")
    with SessionLocal() as db:
        user = db.get(User, uid)
    if not user or user.status != "approved":
        raise HTTPException(401, "Sesión no válida")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Solo para administración")
    return user
