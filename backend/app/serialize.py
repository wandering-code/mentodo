from .models import Card, Label, LabelGroup, Notification, NotificationRule, Project, User, View


def iso(dt):
    return dt.isoformat() if dt else None


def user_out(u: User):
    return {
        "id": u.id, "username": u.username, "display_name": u.display_name, "status": u.status,
        "is_admin": u.is_admin, "accent": u.accent, "theme": u.theme, "timezone": u.timezone,
        "todo_projects": u.todo_projects, "created_at": iso(u.created_at),
    }


def project_out(p: Project):
    return {
        "id": p.id, "name": p.name, "icon": p.icon, "color": p.color, "description": p.description,
        "position": p.position, "archived": p.archived,
        "created_at": iso(p.created_at), "updated_at": iso(p.updated_at),
    }


def group_out(g: LabelGroup):
    return {"id": g.id, "project_id": g.project_id, "name": g.name, "multi": g.multi, "position": g.position}


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
