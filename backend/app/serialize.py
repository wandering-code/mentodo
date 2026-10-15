from .models import Attachment, Card, CardLink, Field, Label, Note, LabelGroup, Notification, NotificationRule, Project, User, View


def iso(dt):
    return dt.isoformat() if dt else None


def user_out(u: User):
    return {
        "id": u.id, "username": u.username, "display_name": u.display_name, "status": u.status,
        "is_admin": u.is_admin, "accent": u.accent, "theme": u.theme, "timezone": u.timezone,
        "todo_projects": u.todo_projects, "created_at": iso(u.created_at),
        "vault_salt": u.vault_salt, "vault_check": u.vault_check,
    }


def project_out(p: Project):
    return {
        "id": p.id, "name": p.name, "icon": p.icon, "color": p.color, "description": p.description,
        "position": p.position, "archived": p.archived, "hidden_props": p.hidden_props or [],
        "prop_names": p.prop_names or {}, "prop_order": p.prop_order or [],
        "notes_tab_position": p.notes_tab_position,
        "created_at": iso(p.created_at), "updated_at": iso(p.updated_at),
    }


def group_out(g: LabelGroup):
    return {"id": g.id, "project_id": g.project_id, "name": g.name, "multi": g.multi,
            "is_status": g.is_status, "position": g.position}


def label_out(l: Label):
    return {
        "id": l.id, "group_id": l.group_id, "name": l.name, "color": l.color,
        "position": l.position, "marks_done": l.marks_done,
    }


def card_out(c: Card):
    return {
        "id": c.id, "project_id": c.project_id, "title": c.title, "content": c.content,
        "done": c.done, "completed_at": iso(c.completed_at), "in_todo": c.in_todo,
        "due_at": iso(c.due_at), "due_all_day": c.due_all_day, "remind_at": iso(c.remind_at),
        "estimate_minutes": c.estimate_minutes, "position": c.position,
        "label_ids": sorted(l.id for l in c.labels),
        "values": c.values or {}, "hidden_props": c.hidden_props or [],
        "is_template": c.is_template, "template": c.template, "recurrence": c.recurrence,
        "postpone_count": c.postpone_count or 0,
        "created_at": iso(c.created_at), "updated_at": iso(c.updated_at),
    }


def view_out(v: View):
    return {
        "id": v.id, "project_id": v.project_id, "name": v.name, "kind": v.kind,
        "config": v.config or {}, "position": v.position,
    }


def rule_out(r: NotificationRule):
    return {
        "id": r.id, "project_id": r.project_id, "kind": r.kind, "params": r.params or {}, "enabled": r.enabled,
    }


def notification_out(n: Notification):
    return {
        "id": n.id, "card_id": n.card_id, "project_id": n.project_id, "title": n.title,
        "body": n.body, "read": n.read, "created_at": iso(n.created_at),
    }


def field_out(f: Field):
    return {"id": f.id, "project_id": f.project_id, "name": f.name, "kind": f.kind, "position": f.position}


def note_out(n: Note):
    return {
        "id": n.id, "project_id": n.project_id, "title": n.title, "icon": n.icon, "content": n.content,
        "pinned": n.pinned, "position": n.position, "created_at": iso(n.created_at), "updated_at": iso(n.updated_at),
    }


def link_out(l: CardLink):
    return {"id": l.id, "from_id": l.from_id, "to_id": l.to_id, "kind": l.kind}


def attachment_out(a: Attachment):
    return {
        "id": a.id, "card_id": a.card_id, "note_id": a.note_id, "filename": a.filename,
        "mime": a.mime, "size": a.size, "created_at": iso(a.created_at),
    }
