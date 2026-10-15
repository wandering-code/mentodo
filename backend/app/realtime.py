import asyncio
import json

from fastapi import WebSocket


class Hub:
    """Conexiones WebSocket abiertas, agrupadas por usuario. Cada pestaña o
    dispositivo es una conexión distinta (identificada por su client_id): un
    cambio hecho en una se reenvía a todas las demás del mismo perfil."""

    def __init__(self):
        self._conns: dict[int, dict[str, WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, client_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            devices = self._conns.setdefault(user_id, {})
            old = devices.get(client_id)
            devices[client_id] = ws
        if old:
            try:
                await old.close()
            except Exception:
                pass

    async def disconnect(self, user_id: int, client_id: str, ws: WebSocket):
        async with self._lock:
            devices = self._conns.get(user_id)
            if devices and devices.get(client_id) is ws:
                devices.pop(client_id, None)
                if not devices:
                    self._conns.pop(user_id, None)

    async def publish(self, user_id: int, events: list[dict], origin: str | None = None):
        if not events:
            return
        text = json.dumps({"events": events, "origin": origin}, default=str)
        async with self._lock:
            targets = list(self._conns.get(user_id, {}).items())
        for cid, ws in targets:
            try:
                await ws.send_text(text)
            except Exception:
                await self.disconnect(user_id, cid, ws)


hub = Hub()
