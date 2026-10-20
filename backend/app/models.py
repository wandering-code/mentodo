from datetime import datetime, timezone

from sqlalchemy import (
    JSON, Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Table, Text, UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .db import Base


def now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(40), unique=True, nullable=False, index=True)
    display_name = Column(String(80), nullable=False)
    password_hash = Column(String, nullable=False)
    # pending → approved / rejected. Solo "approved" puede iniciar sesión.
    status = Column(String(12), nullable=False, default="pending")
    is_admin = Column(Boolean, nullable=False, default=False)
    # Preferencias de interfaz: viajan con el perfil, no con el dispositivo
    accent = Column(String(20), nullable=False, default="bosque")
    theme = Column(String(8), nullable=False, default="system")  # light | dark | system
    timezone = Column(String(64), nullable=False, default="Europe/Madrid")
    # Proyectos visibles en la vista To Do general (null = todos)
    todo_projects = Column(JSON, nullable=True)
    # Bóveda de secretos: cifrado en el navegador con una frase maestra. El
    # servidor solo guarda la sal y una comprobación cifrada, nunca la frase.
    # Preferencias sueltas de la interfaz: {"today_time": false, ...}
    prefs = Column(JSON, nullable=False, default=dict, server_default="{}")
    vault_salt = Column(String(64), nullable=True)
    vault_check = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    icon = Column(String(16), nullable=False, default="📁")
    color = Column(String(20), nullable=False, default="bosque")
    description = Column(Text, nullable=False, default="")
    position = Column(Float, nullable=False, default=0)
    archived = Column(Boolean, nullable=False, default=False)
    # Propiedades ocultas en todo el proyecto: "due", "remind", "estimate",
    # "todo", "g:<grupo>", "f:<campo>"
    hidden_props = Column(JSON, nullable=False, default=list)
    # Nombres propios para las propiedades de serie: {"due": "Inicio", ...}
    prop_names = Column(JSON, nullable=False, default=dict)
    # Orden de las propiedades en tarjeta y tabla (mismas claves que hidden_props)
    prop_order = Column(JSON, nullable=False, default=list)
    # Sitio de la pestaña «Apuntes» entre las vistas (null = al final)
    notes_tab_position = Column(Float, nullable=True)
    # Qué fecha cuenta como entrega: la principal («due») o una propia de
    # tipo fecha («f:<id>»). Con ella se calcula lo atrasado, lo de hoy, los
    # avisos, los aplazamientos y las repeticiones.
    deadline_key = Column(String(24), nullable=False, default="due", server_default="due")
    # Módulos opcionales activados en este proyecto (apagados por defecto):
    # {"hours": true, "client": "Nombre del cliente"}
    features = Column(JSON, nullable=False, default=dict, server_default="{}")
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)


class LabelGroup(Base):
    """Una "propiedad" del proyecto (Estado, Prioridad, Área...). Las etiquetas
    viven siempre dentro de un grupo: así el tablero sabe qué columnas pintar."""
    __tablename__ = "label_groups"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(60), nullable=False)
    multi = Column(Boolean, nullable=False, default=False)  # ¿una tarjeta puede tener varias del grupo?
    # El grupo que hace de "estado" de la tarjeta (uno por proyecto como mucho).
    # Solo en él tiene sentido una etiqueta "de terminado".
    is_status = Column(Boolean, nullable=False, default=False)
    position = Column(Float, nullable=False, default=0)
    # Solo aparece en las tarjetas donde se añade (o que tienen etiqueta), no en todas
    opt_in = Column(Boolean, nullable=False, default=False, server_default="false")


class Label(Base):
    __tablename__ = "labels"
    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("label_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(60), nullable=False)
    color = Column(String(20), nullable=False, default="gris")
    position = Column(Float, nullable=False, default=0)
    # Una tarjeta con esta etiqueta cuenta como terminada (p. ej. "Hecho"). Solo
    # puede estar activa en una etiqueta del grupo de estado: el servidor lo garantiza.
    marks_done = Column(Boolean, nullable=False, default=False)
    # Estado que «no cuenta» (p. ej. "Despliegues", un archivo de referencia):
    # sus tarjetas no salen en Hoy ni en To Do ni generan avisos, aunque su
    # fecha haya pasado. Solo en el grupo de estado.
    inactive = Column(Boolean, nullable=False, default=False, server_default="false")


card_labels = Table(
    "card_labels",
    Base.metadata,
    Column("card_id", Integer, ForeignKey("cards.id", ondelete="CASCADE"), primary_key=True),
    Column("label_id", Integer, ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True),
)


class Card(Base):
    __tablename__ = "cards"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # null = bandeja de entrada (capturado sin decidir dónde va)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(500), nullable=False, default="")
    content = Column(JSON, nullable=True)  # documento TipTap
    done = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    in_todo = Column(Boolean, nullable=False, default=False)
    due_at = Column(DateTime(timezone=True), nullable=True)
    due_all_day = Column(Boolean, nullable=False, default=True)
    remind_at = Column(DateTime(timezone=True), nullable=True)
    estimate_minutes = Column(Integer, nullable=True)
    position = Column(Float, nullable=False, default=0)
    # Valores de los campos propios del proyecto: {"<field_id>": valor}. Las
    # fechas se guardan como {"at": iso, "all_day": bool}.
    values = Column(JSON, nullable=False, default=dict)
    # Propiedades ocultas solo en esta tarjeta (mismas claves que en Project)
    hidden_props = Column(JSON, nullable=False, default=list)
    # Propiedades «solo donde se añaden» que esta tarjeta sí muestra
    extra_props = Column(JSON, nullable=False, default=list, server_default="[]")
    # Plantilla: tarjeta modelo que no sale en las vistas. `template` guarda su
    # nombre y las fechas relativas: {"name": "...", "offsets": {"due": 0, "f:3": 7}}
    is_template = Column(Boolean, nullable=False, default=False, server_default="false", index=True)
    template = Column(JSON, nullable=True)
    # Repetición: {"freq": "daily|weekly|monthly", "interval": 1, "weekdays": [0..6]}
    recurrence = Column(JSON, nullable=True)
    # Cuántas veces se ha aplazado (fecha movida a más tarde estando pendiente)
    postpone_count = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)

    labels = relationship("Label", secondary=card_labels, lazy="selectin")


class Field(Base):
    """Propiedad creada por el usuario en un proyecto (además de las etiquetas)."""
    __tablename__ = "fields"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(60), nullable=False)
    kind = Column(String(12), nullable=False)  # date | text | number | checkbox | url
    position = Column(Float, nullable=False, default=0)
    # Solo aparece en las tarjetas donde se añade (o que tienen valor), no en todas
    opt_in = Column(Boolean, nullable=False, default=False, server_default="false")


class Note(Base):
    """Apunte: página de texto libre (instrucciones, referencias…), general o
    de un proyecto. No es una tarea: sin estados ni fechas."""
    __tablename__ = "notes"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    title = Column(String(300), nullable=False, default="")
    icon = Column(String(16), nullable=False, default="📝")
    content = Column(JSON, nullable=True)
    pinned = Column(Boolean, nullable=False, default=False)
    position = Column(Float, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)


class Attachment(Base):
    """Archivo adjunto a una tarjeta o a un apunte. El fichero vive en
    uploads/<user_id>/<stored_name> (fuera de la imagen de Docker)."""
    __tablename__ = "attachments"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    card_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=True, index=True)
    note_id = Column(Integer, ForeignKey("notes.id", ondelete="CASCADE"), nullable=True, index=True)
    filename = Column(String(255), nullable=False)
    mime = Column(String(120), nullable=False, default="application/octet-stream")
    size = Column(Integer, nullable=False, default=0)
    stored_name = Column(String(80), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), default=now)


class CardEvent(Base):
    """Historial mínimo para la revisión semanal: de momento, aplazamientos."""
    __tablename__ = "card_events"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    card_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(12), nullable=False)  # postpone
    data = Column(JSON, nullable=False, default=dict)  # {"from": iso, "to": iso}
    at = Column(DateTime(timezone=True), default=now, index=True)


class CardLink(Base):
    """Relación entre dos tarjetas:
    - parent: `from` es la tarjeta madre y `to`, una subtarea
    - blocks: `from` bloquea a `to` (hay que terminar `from` antes)
    - relates: relacionadas, sin dirección"""
    __tablename__ = "card_links"
    __table_args__ = (UniqueConstraint("from_id", "to_id", "kind"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    from_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False, index=True)
    to_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(10), nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)


class View(Base):
    """Vista guardada de un proyecto: tipo + agrupación + orden + filtros."""
    __tablename__ = "views"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(60), nullable=False)
    kind = Column(String(12), nullable=False, default="board")  # board | table | list | calendar
    config = Column(JSON, nullable=False, default=dict)  # {group_by, sort: [...], filter: {...}, hide_done}
    position = Column(Float, nullable=False, default=0)


class NotificationRule(Base):
    __tablename__ = "notification_rules"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # null = se aplica a todos los proyectos
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, index=True)
    kind = Column(String(20), nullable=False)  # before_due | overdue | daily_digest | stale
    params = Column(JSON, nullable=False, default=dict)
    enabled = Column(Boolean, nullable=False, default=True)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (UniqueConstraint("user_id", "dedupe_key"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    card_id = Column(Integer, ForeignKey("cards.id", ondelete="CASCADE"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    dedupe_key = Column(String(120), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(String(500), nullable=False, default="")
    read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=now)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    endpoint = Column(String(1000), unique=True, nullable=False)
    keys = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), default=now)


# ── Parte de horas (módulo opcional, prefs["mod_hours"]) ─────────────────────

class WorkDay(Base):
    """Un día del parte de horas. Solo existe cuando se toca: al nacer copia el
    horario del día de la semana (Ajustes), así cambiar el horario después no
    reescribe los días ya pasados. Horas como "HH:MM" locales; duraciones en
    minutos."""
    __tablename__ = "work_days"
    __table_args__ = (UniqueConstraint("user_id", "day"),)
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    day = Column(Date, nullable=False, index=True)
    start = Column(String(5), nullable=True)  # entrada; null = sin fichar
    end = Column(String(5), nullable=True)  # salida real (opcional)
    target_minutes = Column(Integer, nullable=False, default=480)
    lunch_minutes = Column(Integer, nullable=False, default=0)
    lunch_from = Column(String(5), nullable=False, default="14:00")
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)


class TimeEntry(Base):
    """Un parte: tiempo imputado a un cliente y una tarea en un día. Puede venir
    de una tarjeta; si la tarjeta o el proyecto se borran, el parte se queda
    (las horas ya se imputaron)."""
    __tablename__ = "time_entries"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    day = Column(Date, nullable=False, index=True)
    client = Column(String(120), nullable=False, default="")
    task = Column(String(300), nullable=False, default="")
    minutes = Column(Integer, nullable=False)
    card_id = Column(Integer, ForeignKey("cards.id", ondelete="SET NULL"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)
    position = Column(Float, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)


class Team(Base):
    """Un equipo: gente que comparte cosas entre sí (de momento, las
    vacaciones). Es general, no depende de ningún módulo."""
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True)
    name = Column(String(80), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=now)


class TeamMember(Base):
    """invited → active al aceptar. Rechazar o salir borra la fila."""
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id"),)
    id = Column(Integer, primary_key=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(10), nullable=False, default="invited")
    invited_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=now)


class Vacation(Base):
    """Un periodo de vacaciones (días enteros, ambos incluidos). Es de su
    dueño; lo ve quien comparte un equipo activo con él."""
    __tablename__ = "vacations"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    start = Column(Date, nullable=False, index=True)
    end = Column(Date, nullable=False, index=True)
    status = Column(String(12), nullable=False, default="posible")  # posible | pedida | confirmada
    note = Column(String(200), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)


class DayOff(Base):
    """Un festivo propio (días enteros, ambos incluidos), p. ej. los que da
    la empresa a final de año. Sin equipo es solo de quien lo crea; con
    equipo vale para todos sus miembros activos, y cualquiera de ellos puede
    cambiarlo o quitarlo."""
    __tablename__ = "days_off"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=True, index=True)
    start = Column(Date, nullable=False, index=True)
    end = Column(Date, nullable=False, index=True)
    name = Column(String(120), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), default=now)
    updated_at = Column(DateTime(timezone=True), default=now, onupdate=now)
