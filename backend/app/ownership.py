from fastapi import HTTPException
from sqlalchemy.orm import Session

from .models import Card, Label, LabelGroup, NotificationRule, Project, View


def own_project(db: Session, user_id: int, project_id: int) -> Project:
    p = db.get(Project, project_id)
    if not p or p.user_id != user_id:
        raise HTTPException(404, "Proyecto no encontrado")
    return p


def own_group(db: Session, user_id: int, group_id: int) -> LabelGroup:
    g = db.get(LabelGroup, group_id)
    if not g:
        raise HTTPException(404, "Grupo no encontrado")
    own_project(db, user_id, g.project_id)
    return g


def own_label(db: Session, user_id: int, label_id: int) -> Label:
    l = db.get(Label, label_id)
    if not l:
        raise HTTPException(404, "Etiqueta no encontrada")
    own_group(db, user_id, l.group_id)
    return l


def own_card(db: Session, user_id: int, card_id: int) -> Card:
    c = db.get(Card, card_id)
    if not c or c.user_id != user_id:
        raise HTTPException(404, "Tarjeta no encontrada")
    return c


def own_view(db: Session, user_id: int, view_id: int) -> View:
    v = db.get(View, view_id)
    if not v:
        raise HTTPException(404, "Vista no encontrada")
    own_project(db, user_id, v.project_id)
    return v


def own_rule(db: Session, user_id: int, rule_id: int) -> NotificationRule:
    r = db.get(NotificationRule, rule_id)
    if not r or r.user_id != user_id:
        raise HTTPException(404, "Regla no encontrada")
    return r
