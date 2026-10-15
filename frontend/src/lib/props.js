import { AlarmClock, AlignLeft, CalendarDays, CheckSquare, Clock3, Hash, Link2, ListTodo, Tag } from 'lucide-react'

// Todas las propiedades de una tarjeta en un mismo formato, para que panel,
// tabla y ajustes las traten igual. Claves: "due", "remind", "estimate",
// "todo", "g:<grupo>", "f:<campo>".

export const BUILTIN = [
  { key: 'due', name: 'Fecha', icon: CalendarDays, builtin: true },
  { key: 'remind', name: 'Recordarme', icon: AlarmClock, builtin: true },
  { key: 'estimate', name: 'Estimación', icon: Clock3, builtin: true },
  { key: 'todo', name: 'En To Do', icon: ListTodo, builtin: true },
]

export const FIELD_KINDS = [
  { id: 'date', name: 'Fecha', icon: CalendarDays },
  { id: 'text', name: 'Texto', icon: AlignLeft },
  { id: 'number', name: 'Número', icon: Hash },
  { id: 'checkbox', name: 'Casilla', icon: CheckSquare },
  { id: 'url', name: 'Enlace', icon: Link2 },
]

export const fieldIcon = (kind) => FIELD_KINDS.find((k) => k.id === kind)?.icon || AlignLeft

export function projectProps(s, projectId) {
  const groups = Object.values(s.groups)
    .filter((g) => g.project_id === projectId)
    .sort((a, b) => a.position - b.position)
    .map((g) => ({ key: `g:${g.id}`, name: g.name, icon: Tag, group: g }))
  const fields = Object.values(s.fields)
    .filter((f) => f.project_id === projectId)
    .sort((a, b) => a.position - b.position)
    .map((f) => ({ key: `f:${f.id}`, name: f.name, icon: fieldIcon(f.kind), field: f }))
  return [...groups, ...BUILTIN, ...fields]
}

export const hiddenInProject = (project, key) => !!project?.hidden_props?.includes(key)
export const hiddenInCard = (card, key) => !!card?.hidden_props?.includes(key)
export const propVisible = (project, card, key) => !hiddenInProject(project, key) && !hiddenInCard(card, key)

export function fieldValue(card, field) {
  return card.values?.[String(field.id)]
}

export function hasValue(card, prop) {
  if (prop.group) return card.label_ids.length > 0
  if (prop.field) {
    const v = fieldValue(card, prop.field)
    return v !== undefined && v !== null && v !== '' && v !== false
  }
  return { due: !!card.due_at, remind: !!card.remind_at, estimate: !!card.estimate_minutes, todo: card.in_todo }[prop.key]
}
