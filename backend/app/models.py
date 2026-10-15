from datetime import datetime, timezone

from sqlalchemy import (
    JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Table, Text, UniqueConstraint,
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
