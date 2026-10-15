import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select

from .auth import COOKIE, hash_password, user_id_from_token
from .config import settings
from .db import SessionLocal
from .models import User
from .notify import scheduler_loop
from .realtime import hub
from .routers import admin, attachments, auth, cards, links, me, notes, projects, workspace

logging.basicConfig(level=logging.INFO)


def ensure_admin():
    """La cuenta de administración se crea sola desde el .env: así nadie puede
    "adelantarse" registrando ese nombre antes que el dueño."""
    if not settings.admin_password:
        return
    with SessionLocal() as db:
        name = settings.admin_username.lower()
        user = db.scalar(select(User).where(func.lower(User.username) == name))
        if not user:
            db.add(User(username=name, display_name=settings.admin_username.capitalize(),
                        password_hash=hash_password(settings.admin_password), status="approved", is_admin=True))
        elif not user.is_admin or user.status != "approved":
            user.is_admin, user.status = True, "approved"
        db.commit()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_admin()
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()


app = FastAPI(title="Mentodo", lifespan=lifespan)
for r in (auth.router, me.router, admin.router, projects.router, cards.router, links.router, notes.router, attachments.router, workspace.router):
    app.include_router(r)


@app.get("/health")
def health():
    return {"ok": True}


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket, client_id: str = "anon"):
    uid = user_id_from_token(ws.cookies.get(COOKIE))
    if uid is None:
        await ws.close(code=4401)
        return
    with SessionLocal() as db:
        user = db.get(User, uid)
    if not user or user.status != "approved":
        await ws.close(code=4401)
        return
    await hub.connect(uid, client_id, ws)
    try:
        while True:
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(uid, client_id, ws)
