import { AlarmClock, AlignLeft, CalendarDays, CheckSquare, Clock3, Hash, Link2, ListTodo, Repeat, Tag } from 'lucide-react'

// Todas las propiedades de una tarjeta en un mismo formato, para que panel,
// tabla y ajustes las traten igual. Claves: "due", "remind", "estimate",
// "todo", "g:<grupo>", "f:<campo>".

export const BUILTIN = [
  { key: 'due', name: 'Fecha', icon: CalendarDays, builtin: true },
  { key: 'remind', name: 'Recordarme', icon: AlarmClock, builtin: true },
  { key: 'repeat', name: 'Repetir', icon: Repeat, builtin: true },
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
  const project = projectId ? s.projects[projectId] : null
  const names = project?.prop_names || {}
  const groups = Object.values(s.groups)
    .filter((g) => g.project_id === projectId)
    .sort((a, b) => a.position - b.position)
    .map((g) => ({ key: `g:${g.id}`, name: g.name, icon: Tag, group: g }))
  const builtin = BUILTIN.map((b) => ({ ...b, name: names[b.key] || b.name }))
  const fields = Object.values(s.fields)
    .filter((f) => f.project_id === projectId)
    .sort((a, b) => a.position - b.position)
    .map((f) => ({ key: `f:${f.id}`, name: f.name, icon: fieldIcon(f.kind), field: f }))
  const all = [...groups, ...builtin, ...fields]
  // El orden elegido en el proyecto manda; lo que no esté en él (una
  // propiedad recién creada) va detrás, en el orden de siempre
  const order = project?.prop_order || []
  const rank = (p) => {
    const i = order.indexOf(p.key)
    return i === -1 ? order.length + all.indexOf(p) : i
  }
  return all.sort((a, b) => rank(a) - rank(b))
}

/* Mueve una propiedad un puesto arriba (-1) o abajo (+1) y devuelve el orden
   completo nuevo, listo para guardar en el proyecto */
export function movedOrder(props, key, dir) {
  const keys = props.map((p) => p.key)
  const i = keys.indexOf(key)
  const j = i + dir
  if (i < 0 || j < 0 || j >= keys.length) return null
  ;[keys[i], keys[j]] = [keys[j], keys[i]]
  return keys
}

/* Nombre por defecto de una propiedad de serie (para «Restablecer nombre») */
export const defaultName = (key) => BUILTIN.find((b) => b.key === key)?.name

export const hiddenInProject = (project, key) => !!project?.hidden_props?.includes(key)
export const hiddenInCard = (card, key) => !!card?.hidden_props?.includes(key)
export const propVisible = (project, card, key) => !hiddenInProject(project, key) && !hiddenInCard(card, key)

/* ¿Tiene valor la tarjeta en la propiedad `key`? (grupos: alguna etiqueta
   de ese grupo) */
export function hasKeyValue(card, key, labels) {
  if (key.startsWith('g:')) return card.label_ids.some((id) => labels?.[id]?.group_id === Number(key.slice(2)))
  if (key.startsWith('f:')) {
    const v = card.values?.[key.slice(2)]
    return v !== undefined && v !== null && v !== '' && v !== false
  }
  return !!{ due: card.due_at, remind: card.remind_at, repeat: card.recurrence, estimate: card.estimate_minutes, todo: card.in_todo }[key]
}

/* Oculta en todo el proyecto, salvo en las tarjetas que la han vuelto a
   mostrar o que ya tienen valor en ella */
export function hiddenByProject(project, card, key, labels) {
  return hiddenInProject(project, key) && !card?.extra_props?.includes(key) && !hasKeyValue(card, key, labels)
}

/* Propiedad «solo donde se añade» que esta tarjeta no ha añadido (ni tiene
   valor): no se muestra, pero se puede añadir desde «Añadir propiedad» */
export function notAdded(card, prop, labels) {
  const optIn = prop.field?.opt_in || prop.group?.opt_in
  if (!optIn || card?.extra_props?.includes(prop.key)) return false
  if (prop.group) return !card.label_ids.some((id) => labels?.[id]?.group_id === prop.group.id)
  return !hasValue(card, prop)
}

export function fieldValue(card, field) {
  return card.values?.[String(field.id)]
}

export function hasValue(card, prop) {
  if (prop.group) return card.label_ids.length > 0
  if (prop.field) {
    const v = fieldValue(card, prop.field)
    return v !== undefined && v !== null && v !== '' && v !== false
  }
  return { due: !!card.due_at, remind: !!card.remind_at, repeat: !!card.recurrence, estimate: !!card.estimate_minutes, todo: card.in_todo }[prop.key]
}

/* Texto corto de una regla de repetición */
const WD = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const WD_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
export function repeatText(r) {
  if (!r) return null
  const n = Math.max(1, Number(r.interval) || 1)
  const days = [...new Set(r.weekdays || [])].sort()
  let t
  if (r.freq === 'daily') t = n === 1 ? 'Cada día' : `Cada ${n} días`
  else if (r.freq === 'weekly') {
    if (n === 1 && days.join() === '0,1,2,3,4') t = 'Días laborables'
    else if (n === 1 && days.length === 1) t = `Cada ${WD_LONG[days[0]]}`
    else t = (n === 1 ? 'Cada semana' : `Cada ${n} semanas`) + (days.length ? `: ${days.map((d) => WD[d]).join(', ')}` : '')
  } else if (r.freq === 'monthly') t = n === 1 ? 'Cada mes' : `Cada ${n} meses`
  else if (r.freq === 'yearly') t = n === 1 ? 'Cada año' : `Cada ${n} años`
  else t = 'Se repite'
  return r.from === 'done' ? `${t} · desde que la termino` : t
}
export { WD }
