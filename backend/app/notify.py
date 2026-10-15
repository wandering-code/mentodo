"""Motor de notificaciones.

Cada minuto revisa las reglas activas de cada usuario y genera avisos. Cada
aviso tiene una `dedupe_key` única por usuario: así se dispara una sola vez
aunque el bucle pase muchas veces por la misma tarjeta, y si cambia la fecha
de la tarjeta la clave cambia y vuelve a avisar.

Tipos de regla (`params` entre paréntesis):
- before_due (minutes, field): X minutos antes del vencimiento.
- overdue (field): cuando una tarjeta sin terminar pasa su fecha.
  `field` es "due" (la fecha principal, por defecto) o el id de un campo de fecha propio.
- daily_digest (hour): resumen diario a esa hora con lo que vence hoy.
- stale (label_id, days): tarjeta que lleva N días con esa etiqueta sin tocarse.
Además, `remind_at` de cada tarjeta es un recordatorio puntual.
"""
import asyncio
import json
import logging
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .config import settings
from .db import SessionLocal
from .models import Card, Field, Label, Notification, NotificationRule, Project, PushSubscription, User
from .realtime import hub
from .serialize import notification_out

log = logging.getLogger("mentodo.notify")

ALL_DAY_HOUR = 9  # una tarjeta "todo el día" vence, a efectos de aviso, a las 9:00 locales


def _tz(user: User) -> ZoneInfo:
    try:
        return ZoneInfo(user.timezone or "Europe/Madrid")
    except Exception:
        return ZoneInfo("Europe/Madrid")


def effective_due(card: Card, tz: ZoneInfo) -> datetime | None:
    if not card.due_at:
        return None
    if card.due_all_day:
        d = card.due_at.astimezone(tz).date()
        return datetime.combine(d, time(ALL_DAY_HOUR), tz)
    return card.due_at


def rule_due(card: Card, rule: NotificationRule, tz: ZoneInfo) -> datetime | None:
    """Fecha que vigila una regla: la principal de la tarjeta o un campo de fecha propio."""
    field = rule.params.get("field") or "due"
    if field == "due":
        return effective_due(card, tz)
    v = (card.values or {}).get(str(field))
    if not isinstance(v, dict) or not v.get("at"):
        return None
    try:
        at = datetime.fromisoformat(v["at"].replace("Z", "+00:00"))
    except ValueError:
        return None
    if v.get("all_day", True):
        return datetime.combine(at.astimezone(tz).date(), time(ALL_DAY_HOUR), tz)
    return at


def _fmt_offset(minutes: int) -> str:
    if minutes % 1440 == 0:
        d = minutes // 1440
        return "mañana" if d == 1 else f"en {d} días"
    if minutes % 60 == 0:
        h = minutes // 60
        return "en 1 hora" if h == 1 else f"en {h} horas"
    return f"en {minutes} minutos"


def _send_push(db, user_id: int, payload: dict):
    if not (settings.vapid_private_key and settings.vapid_public_key):
        return
    from pywebpush import WebPushException, webpush

    subs = db.scalars(select(PushSubscription).where(PushSubscription.user_id == user_id)).all()
    for s in subs:
        try:
            webpush(
                subscription_info={"endpoint": s.endpoint, "keys": s.keys},
                data=json.dumps(payload),
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={"sub": settings.vapid_subject},
                ttl=3600,
            )
        except WebPushException as e:
            status = getattr(e.response, "status_code", None)
            if status in (404, 410):  # suscripción caducada: el navegador ya no la quiere
                db.delete(s)
                db.commit()
            else:
                log.warning("push falló: %s", e)
        except Exception as e:  # noqa: BLE001
            log.warning("push falló: %s", e)


def create_notification(db, user_id: int, key: str, title: str, body: str = "",
                        card_id: int | None = None, project_id: int | None = None, url: str = "/") -> dict | None:
    """Crea el aviso si no existía ya; devuelve su JSON o None si estaba repetido."""
    n = Notification(user_id=user_id, dedupe_key=key[:120], title=title[:200], body=body[:500],
                     card_id=card_id, project_id=project_id)
    db.add(n)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return None
    _send_push(db, user_id, {"title": title, "body": body, "url": url, "tag": key[:60]})
    return notification_out(n)


def _card_url(card: Card) -> str:
    return f"/p/{card.project_id}?card={card.id}" if card.project_id else f"/inbox?card={card.id}"


def _rules_for(rules: list[NotificationRule], kind: str, project_id: int | None):
    return [r for r in rules if r.enabled and r.kind == kind and (r.project_id is None or r.project_id == project_id)]


def run_checks() -> list[tuple[int, dict]]:
    """Una pasada del motor. Devuelve los avisos nuevos (user_id, json) para
    reenviarlos por WebSocket a los dispositivos abiertos."""
    created: list[tuple[int, dict]] = []
    now = datetime.now(timezone.utc)
    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.status == "approved")).all()
        for user in users:
            tz = _tz(user)
            rules = db.scalars(select(NotificationRule).where(NotificationRule.user_id == user.id)).all()
            projects = {p.id: p for p in db.scalars(select(Project).where(Project.user_id == user.id)).all()}
            cards = db.scalars(select(Card).where(Card.user_id == user.id, Card.done.is_(False), Card.is_template.is_(False))).all()
            field_names = {f.id: f.name for f in db.scalars(select(Field).where(Field.project_id.in_(list(projects) or [0]))).all()}

            def emit(key, title, body, card=None, project_id=None, url="/"):
                n = create_notification(db, user.id, key, title, body,
                                        card_id=card.id if card else None,
                                        project_id=card.project_id if card else project_id, url=url)
                if n:
                    created.append((user.id, n))

            for card in cards:
                if card.project_id and projects.get(card.project_id) and projects[card.project_id].archived:
                    continue
                pname = projects[card.project_id].name if card.project_id in projects else "Bandeja"
                title = card.title or "Sin título"
                # Recordatorio puntual de la tarjeta
                if card.remind_at and card.remind_at <= now and now - card.remind_at < timedelta(hours=12):
                    emit(f"remind:{card.id}:{card.remind_at.isoformat()}", f"⏰ {title}", pname,
                         card, url=_card_url(card))
                for r in _rules_for(rules, "before_due", card.project_id):
                    due = rule_due(card, r, tz)
                    if not due:
                        continue
                    minutes = int(r.params.get("minutes", 1440))
                    fire_at = due - timedelta(minutes=minutes)
                    what = field_names.get(r.params.get("field"), "Vence")
                    if fire_at <= now < due:
                        emit(f"before:{r.id}:{card.id}:{due.isoformat()}", f"{what} {_fmt_offset(minutes)}: {title}",
                             pname, card, url=_card_url(card))
                for r in _rules_for(rules, "overdue", card.project_id):
                    due = rule_due(card, r, tz)
                    if due and due <= now and now - due < timedelta(days=3):
                        what = field_names.get(r.params.get("field"))
                        emit(f"overdue:{r.id}:{card.id}:{due.isoformat()}",
                             f"{what} pasada: {title}" if what else f"Vencida: {title}", pname,
                             card, url=_card_url(card))

            # Tarjetas estancadas con una etiqueta concreta
            for r in [r for r in rules if r.enabled and r.kind == "stale"]:
                label_id, days = r.params.get("label_id"), int(r.params.get("days", 5))
                if not label_id:
                    continue
                for card in cards:
                    if any(l.id == label_id for l in card.labels) and card.updated_at and now - card.updated_at >= timedelta(days=days):
                        label = db.get(Label, label_id)
                        emit(f"stale:{r.id}:{card.id}:{card.updated_at.isoformat()}",
                             f"Atascada: {card.title or 'Sin título'}",
                             f"Lleva {days}+ días en «{label.name if label else '?'}» sin moverse",
                             card, url=_card_url(card))

            # Resumen diario
            local_now = now.astimezone(tz)
            for r in [r for r in rules if r.enabled and r.kind == "daily_digest"]:
                hour = int(r.params.get("hour", 8))
                if local_now.hour != hour:
                    continue
                today = local_now.date()
                todays = [c for c in cards if c.due_at and (r.project_id is None or c.project_id == r.project_id)
                          and c.due_at.astimezone(tz).date() <= today]
                if not todays:
                    continue
                overdue = sum(1 for c in todays if c.due_at.astimezone(tz).date() < today)
                scope = projects[r.project_id].name if r.project_id in projects else "Hoy"
                body = ", ".join((c.title or "Sin título") for c in todays[:4]) + ("…" if len(todays) > 4 else "")
                head = f"{scope}: {len(todays)} para hoy" + (f" ({overdue} atrasadas)" if overdue else "")
                emit(f"digest:{r.id}:{today.isoformat()}", head, body, project_id=r.project_id, url="/todo")
    return created


def purge_orphan_files():
    """Borra del disco los adjuntos que ya no pertenecen a nada (su tarjeta,
    apunte o proyecto se borró: la base de datos borra la fila en cascada,
    pero el fichero se quedaba). Solo los de más de una hora, para no pisar
    una subida a medias."""
    import os
    import time as _time
    from pathlib import Path

    from .models import Attachment

    root = Path(os.getenv("UPLOADS_DIR", "/app/uploads"))
    if not root.exists():
        return 0
    with SessionLocal() as db:
        keep = {(a.user_id, a.stored_name) for a in db.query(Attachment.user_id, Attachment.stored_name)}
    removed = 0
    for folder in root.iterdir():
        if not folder.is_dir() or not folder.name.isdigit():
            continue
        for f in folder.iterdir():
            if (int(folder.name), f.name) not in keep and _time.time() - f.stat().st_mtime > 3600:
                f.unlink(missing_ok=True)
                removed += 1
    return removed


async def scheduler_loop():
    await asyncio.sleep(5)
    ticks = 0
    while True:
        ticks += 1
        if ticks % 60 == 1:
            try:
                n = await asyncio.to_thread(purge_orphan_files)
                if n:
                    log.info("adjuntos huérfanos borrados: %s", n)
            except Exception:  # noqa: BLE001
                log.exception("fallo limpiando adjuntos")
        try:
            created = await asyncio.to_thread(run_checks)
            for user_id, n in created:
                await hub.publish(user_id, [{"t": "upsert", "k": "notification", "d": n}])
        except Exception:  # noqa: BLE001
            log.exception("fallo en el motor de notificaciones")
        await asyncio.sleep(60)


async def notify_admins_new_user(user_id: int):
    def work():
        out = []
        with SessionLocal() as db:
            new = db.get(User, user_id)
            if not new:
                return out
            for admin in db.scalars(select(User).where(User.is_admin.is_(True))).all():
                n = create_notification(db, admin.id, f"signup:{new.id}", "Nueva cuenta pendiente",
                                        f"{new.display_name} (@{new.username}) quiere entrar", url="/admin")
                if n:
                    out.append((admin.id, n))
        return out

    for uid, n in await asyncio.to_thread(work):
        await hub.publish(uid, [{"t": "upsert", "k": "notification", "d": n}, {"t": "reload_admin"}])
