from fastapi import BackgroundTasks, Depends, Header

from .auth import current_user
from .models import User
from .realtime import hub


class Emitter:
    """Junta los cambios de una petición y los reenvía por WebSocket a los
    demás dispositivos del perfil cuando la respuesta ya ha salido."""

    def __init__(self, user: User, background: BackgroundTasks, client_id: str | None):
        self.user = user
        self.events: list[dict] = []
        self._bg = background
        self._origin = client_id
        self._scheduled = False

    def upsert(self, kind: str, data: dict):
        # Las plantillas viajan aparte de las tarjetas: el cliente las guarda
        # en su propia colección y no salen en ninguna vista
        if kind == "card" and data.get("is_template"):
            kind = "template"
        self.events.append({"t": "upsert", "k": kind, "d": data})
        self._schedule()

    def delete(self, kind: str, id_: int):
        self.events.append({"t": "delete", "k": kind, "id": id_})
        self._schedule()

    def _schedule(self):
        if not self._scheduled:
            self._scheduled = True
            self._bg.add_task(self._flush)

    async def _flush(self):
        await hub.publish(self.user.id, self.events, self._origin)


def emitter(
    background: BackgroundTasks,
    user: User = Depends(current_user),
    x_client_id: str | None = Header(None),
) -> Emitter:
    return Emitter(user, background, x_client_id)
