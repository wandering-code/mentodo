import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import Emitter, emitter
from ..models import Card, Label, LabelGroup, Project, View
from ..models import Field as CustomField
from ..ownership import own_field, own_group, own_label, own_project, own_view
from ..serialize import card_out, field_out, group_out, label_out, project_out, view_out

router = APIRouter(tags=["projects"])


# ── Proyectos ────────────────────────────────────────────────────────────────

class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    icon: str = Field("📁", max_length=16)
    color: str = Field("salvia", max_length=20)
    description: str = ""


class ProjectPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    icon: str | None = Field(None, max_length=16)
    color: str | None = Field(None, max_length=20)
    description: str | None = None
    position: float | None = None
    archived: bool | None = None
    hidden_props: list[str] | None = None
    prop_names: dict[str, str] | None = None
    prop_order: list[str] | None = None
    notes_tab_position: float | None = None
    deadline_key: str | None = Field(None, max_length=24)
    features: dict | None = None  # se fusiona con las guardadas


# (nombre, varias por tarjeta, es el estado, etiquetas)
DEFAULT_GROUPS = [
    ("Estado", False, True, [("Por hacer", "gris", False), ("En curso", "azul", False), ("Hecho", "verde", True)]),
    ("Prioridad", False, False, [("Alta", "rojo", False), ("Media", "ambar", False), ("Baja", "gris", False)]),
]


@router.post("/projects", status_code=201)
def create_project(body: ProjectIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    top = db.scalar(select(func.max(Project.position)).where(Project.user_id == em.user.id)) or 0
    p = Project(user_id=em.user.id, name=body.name, icon=body.icon, color=body.color,
                description=body.description, position=top + 1)
    db.add(p)
    db.flush()
    groups, labels = [], []
    for gi, (gname, multi, is_status, opts) in enumerate(DEFAULT_GROUPS):
        g = LabelGroup(project_id=p.id, name=gname, multi=multi, is_status=is_status, position=gi)
        db.add(g)
        db.flush()
        groups.append(g)
        for li, (lname, color, done) in enumerate(opts):
            l = Label(group_id=g.id, name=lname, color=color, position=li, marks_done=done)
            db.add(l)
            labels.append(l)
    estado = groups[0]
    views = [
        View(project_id=p.id, name="Tablero", kind="board", position=0,
             config={"group_by": estado.id, "sort": [], "filter": {}, "hide_done": False}),
        View(project_id=p.id, name="Tabla", kind="table", position=1,
             config={"sort": [{"field": "due_at", "dir": "asc"}], "filter": {}, "hide_done": False}),
        View(project_id=p.id, name="Calendario", kind="calendar", position=2, config={"filter": {}}),
    ]
    db.add_all(views)
    db.commit()
    out = {
        "project": project_out(p),
        "groups": [group_out(g) for g in groups],
        "labels": [label_out(l) for l in labels],
        "views": [view_out(v) for v in views],
    }
    em.upsert("project", out["project"])
    for g in out["groups"]:
        em.upsert("group", g)
    for l in out["labels"]:
        em.upsert("label", l)
    for v in out["views"]:
        em.upsert("view", v)
    return out


@router.patch("/projects/{project_id}")
def patch_project(project_id: int, body: ProjectPatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    p = own_project(db, em.user.id, project_id)
    if body.deadline_key and body.deadline_key != "due":
        f = db.get(CustomField, int(body.deadline_key[2:])) if re.fullmatch(r"f:\d+", body.deadline_key) else None
        if not f or f.project_id != p.id or f.kind != "date":
            raise HTTPException(422, "La fecha de entrega tiene que ser una propiedad de fecha del proyecto")
    data = body.model_dump(exclude_unset=True)
    if data.get("features") is not None:
        if len(str(data["features"])) > 2000:
            raise HTTPException(422, "Demasiados ajustes")
        data["features"] = {k: v for k, v in {**(p.features or {}), **data["features"]}.items() if v is not None}
    for k, v in data.items():
        if v is not None:
            setattr(p, k, v)
    db.commit()
    out = project_out(p)
    em.upsert("project", out)
    return out


@router.delete("/projects/{project_id}")
def delete_project(project_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    p = own_project(db, em.user.id, project_id)
    db.delete(p)
    db.commit()
    em.delete("project", project_id)
    return {"ok": True}


# ── Grupos de etiquetas ──────────────────────────────────────────────────────

class GroupIn(BaseModel):
    project_id: int
    name: str = Field(min_length=1, max_length=60)
    multi: bool = False
    opt_in: bool = False


class GroupPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=60)
    multi: bool | None = None
    is_status: bool | None = None
    position: float | None = None
    opt_in: bool | None = None


def _clear_done_labels(db: Session, em: Emitter, group_id: int, keep: int | None = None):
    for other in db.scalars(select(Label).where(Label.group_id == group_id, Label.marks_done.is_(True))).all():
        if other.id != keep:
            other.marks_done = False
            em.upsert("label", label_out(other))


@router.post("/groups", status_code=201)
def create_group(body: GroupIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    own_project(db, em.user.id, body.project_id)
    top = db.scalar(select(func.max(LabelGroup.position)).where(LabelGroup.project_id == body.project_id)) or 0
    g = LabelGroup(project_id=body.project_id, name=body.name, multi=body.multi, opt_in=body.opt_in, position=top + 1)
    db.add(g)
    db.commit()
    out = group_out(g)
    em.upsert("group", out)
    return out


@router.patch("/groups/{group_id}")
def patch_group(group_id: int, body: GroupPatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    g = own_group(db, em.user.id, group_id)
    if body.name is not None:
        g.name = body.name
    if body.position is not None:
        g.position = body.position
    if body.opt_in is not None:
        g.opt_in = body.opt_in
    if body.is_status is True and not g.is_status:
        # Solo un grupo de estado por proyecto: el anterior deja de serlo
        for other in db.scalars(select(LabelGroup).where(LabelGroup.project_id == g.project_id,
                                                         LabelGroup.is_status.is_(True))).all():
            other.is_status = False
            _clear_done_labels(db, em, other.id)
            em.upsert("group", group_out(other))
        g.is_status, g.multi = True, False  # el estado es siempre una sola etiqueta
    elif body.is_status is False and g.is_status:
        g.is_status = False
        _clear_done_labels(db, em, g.id)
    if body.multi is not None:
        if body.multi and g.is_status:
            raise HTTPException(422, "El grupo de estado solo admite una etiqueta por tarjeta")
        g.multi = body.multi
    db.commit()
    out = group_out(g)
    em.upsert("group", out)
    return out


@router.delete("/groups/{group_id}")
def delete_group(group_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    g = own_group(db, em.user.id, group_id)
    db.delete(g)
    db.commit()
    em.delete("group", group_id)
    return {"ok": True}


# ── Etiquetas ────────────────────────────────────────────────────────────────

class LabelIn(BaseModel):
    group_id: int
    name: str = Field(min_length=1, max_length=60)
    color: str = Field("gris", max_length=20)
    marks_done: bool = False


class LabelPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=60)
    color: str | None = Field(None, max_length=20)
    position: float | None = None
    marks_done: bool | None = None
    inactive: bool | None = None


@router.post("/labels", status_code=201)
def create_label(body: LabelIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    g = own_group(db, em.user.id, body.group_id)
    top = db.scalar(select(func.max(Label.position)).where(Label.group_id == body.group_id)) or 0
    marks_done = body.marks_done and g.is_status
    if marks_done:
        _clear_done_labels(db, em, g.id)
    l = Label(group_id=body.group_id, name=body.name, color=body.color, marks_done=marks_done, position=top + 1)
    db.add(l)
    db.commit()
    out = label_out(l)
    em.upsert("label", out)
    return out


@router.patch("/labels/{label_id}")
def patch_label(label_id: int, body: LabelPatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    l = own_label(db, em.user.id, label_id)
    if body.marks_done:
        if not db.get(LabelGroup, l.group_id).is_status:
            raise HTTPException(422, "Solo las etiquetas del grupo de estado pueden significar terminado")
        _clear_done_labels(db, em, l.group_id, keep=l.id)
    if body.inactive and not db.get(LabelGroup, l.group_id).is_status:
        raise HTTPException(422, "Solo las etiquetas del grupo de estado pueden no contar")
    if body.marks_done:
        l.inactive = False  # terminado y «no cuenta» son excluyentes
    if body.inactive:
        l.marks_done = False
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(l, k, v)
    db.commit()
    out = label_out(l)
    em.upsert("label", out)
    return out


@router.delete("/labels/{label_id}")
def delete_label(label_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    l = own_label(db, em.user.id, label_id)
    affected = db.scalars(select(Card).where(Card.labels.any(Label.id == label_id))).all()
    db.delete(l)
    db.commit()
    em.delete("label", label_id)
    for c in affected:
        db.refresh(c)
        em.upsert("card", card_out(c))
    return {"ok": True}


# ── Vistas ───────────────────────────────────────────────────────────────────

class ViewIn(BaseModel):
    project_id: int
    name: str = Field(min_length=1, max_length=60)
    kind: str = Field("board", pattern="^(board|table|list|calendar|report)$")
    config: dict = {}


class ViewPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=60)
    kind: str | None = Field(None, pattern="^(board|table|list|calendar|report)$")
    config: dict | None = None
    position: float | None = None


@router.post("/views", status_code=201)
def create_view(body: ViewIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    own_project(db, em.user.id, body.project_id)
    top = db.scalar(select(func.max(View.position)).where(View.project_id == body.project_id)) or 0
    v = View(project_id=body.project_id, name=body.name, kind=body.kind, config=body.config, position=top + 1)
    db.add(v)
    db.commit()
    out = view_out(v)
    em.upsert("view", out)
    return out


@router.patch("/views/{view_id}")
def patch_view(view_id: int, body: ViewPatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    v = own_view(db, em.user.id, view_id)
    for k, val in body.model_dump(exclude_unset=True).items():
        if val is not None:
            setattr(v, k, val)
    db.commit()
    out = view_out(v)
    em.upsert("view", out)
    return out


@router.delete("/views/{view_id}")
def delete_view(view_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    v = own_view(db, em.user.id, view_id)
    db.delete(v)
    db.commit()
    em.delete("view", view_id)
    return {"ok": True}


# ── Campos propios ───────────────────────────────────────────────────────────

FIELD_KINDS = "^(date|text|number|checkbox|url)$"


class FieldIn(BaseModel):
    project_id: int
    name: str = Field(min_length=1, max_length=60)
    kind: str = Field(pattern=FIELD_KINDS)
    opt_in: bool = False


class FieldPatch(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=60)
    position: float | None = None
    opt_in: bool | None = None


@router.post("/fields", status_code=201)
def create_field(body: FieldIn, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    own_project(db, em.user.id, body.project_id)
    top = db.scalar(select(func.max(CustomField.position)).where(CustomField.project_id == body.project_id)) or 0
    f = CustomField(project_id=body.project_id, name=body.name, kind=body.kind, opt_in=body.opt_in, position=top + 1)
    db.add(f)
    db.commit()
    out = field_out(f)
    em.upsert("field", out)
    return out


@router.patch("/fields/{field_id}")
def patch_field(field_id: int, body: FieldPatch, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    f = own_field(db, em.user.id, field_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(f, k, v)
    db.commit()
    out = field_out(f)
    em.upsert("field", out)
    return out


@router.delete("/fields/{field_id}")
def delete_field(field_id: int, em: Emitter = Depends(emitter), db: Session = Depends(get_db)):
    f = own_field(db, em.user.id, field_id)
    p = db.get(Project, f.project_id)
    reset = p and p.deadline_key == f"f:{f.id}"
    if reset:
        p.deadline_key = "due"  # sin esa fecha, vuelve a contar la principal
    db.delete(f)
    db.commit()
    em.delete("field", field_id)
    if reset:
        em.upsert("project", project_out(p))
    return {"ok": True}
