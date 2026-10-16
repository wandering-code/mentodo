import { addDays, isAfter, isBefore, isSameDay, isSameMonth, isSameWeek, startOfDay } from 'date-fns'
import { dateInfo, deadlineOf, readDate } from './deadline'
import { useStore } from './store'

// Ordenación y filtrado comunes a todas las vistas.

export function projectGroups(s, projectId) {
  return Object.values(s.groups)
    .filter((g) => g.project_id === projectId)
    .sort((a, b) => a.position - b.position)
}

export function groupLabels(s, groupId) {
  return Object.values(s.labels)
    .filter((l) => l.group_id === groupId)
    .sort((a, b) => a.position - b.position)
}

export function projectViews(s, projectId) {
  return Object.values(s.views)
    .filter((v) => v.project_id === projectId)
    .sort((a, b) => a.position - b.position)
}

export function visibleCards(s, projectId) {
  return Object.values(s.cards).filter((c) => c.project_id === projectId && !s.hidden[c.id])
}

export function applyFilter(cards, filter = {}, s) {
  let out = cards
  if (filter.hide_done) out = out.filter((c) => !c.done)
  if (filter.labels?.length) {
    // Dentro de un mismo grupo basta con una (O); entre grupos, todas (Y)
    const byGroup = {}
    for (const lid of filter.labels) {
      const g = s.labels[lid]?.group_id
      if (g != null) (byGroup[g] ||= []).push(lid)
    }
    out = out.filter((c) => Object.values(byGroup).every((ids) => ids.some((id) => c.label_ids.includes(id))))
  }
  if (filter.text) {
    const q = filter.text.toLowerCase()
    out = out.filter((c) => c.title.toLowerCase().includes(q))
  }
  // Resto de propiedades: { clave: condición } (todas se tienen que cumplir)
  for (const [key, cond] of Object.entries(filter.props || {})) {
    if (cond == null || cond === '') continue
    out = out.filter((c) => matchProp(c, key, cond, s))
  }
  return out
}

/* Opciones de filtro según el tipo de propiedad */
export const DATE_FILTERS = [
  ['overdue', 'Atrasada'],
  ['today', 'Hoy'],
  ['week', 'Esta semana'],
  ['month', 'Este mes'],
  ['next30', 'Próximos 30 días'],
  ['set', 'Con fecha'],
  ['empty', 'Sin fecha'],
]
export const YESNO_FILTERS = [
  ['yes', 'Sí'],
  ['no', 'No'],
]
export const VALUE_FILTERS = [
  ['set', 'Con valor'],
  ['empty', 'Vacío'],
]

/* Tipo de filtro de una propiedad: date | yesno | text | value */
export function filterKind(key, s) {
  if (key === 'due') return 'date'
  if (key === 'todo' || key === 'repeat') return 'yesno'
  if (key === 'remind' || key === 'estimate') return 'value'
  if (key.startsWith('f:')) {
    const kind = s.fields[key.slice(2)]?.kind
    return kind === 'date' ? 'date' : kind === 'checkbox' ? 'yesno' : kind === 'text' || kind === 'url' ? 'text' : 'value'
  }
  return null
}

function rawValue(card, key) {
  if (key.startsWith('f:')) return card.values?.[key.slice(2)]
  return { due: card.due_at, remind: card.remind_at, repeat: card.recurrence, estimate: card.estimate_minutes, todo: card.in_todo }[key]
}
const empty = (v) => v === undefined || v === null || v === '' || v === false

function matchProp(card, key, cond, s) {
  const kind = filterKind(key, s)
  const v = rawValue(card, key)
  if (kind === 'yesno') return cond === 'yes' ? !empty(v) : empty(v)
  if (kind === 'text' && cond.startsWith('has:')) return String(v || '').toLowerCase().includes(cond.slice(4).toLowerCase())
  if (cond === 'set') return !empty(v)
  if (cond === 'empty') return empty(v)
  if (kind !== 'date') return true
  const d = readDate(card, key)
  if (!d) return false
  const at = startOfDay(new Date(d.at))
  const today = startOfDay(new Date())
  if (cond === 'overdue') return !card.done && isBefore(at, today)
  if (cond === 'today') return isSameDay(at, today)
  if (cond === 'week') return isSameWeek(at, today, { weekStartsOn: 1 })
  if (cond === 'month') return isSameMonth(at, today)
  if (cond === 'next30') return !isBefore(at, today) && !isAfter(at, addDays(today, 30))
  return true
}

/* Número de filtros activos (etiquetas + propiedades) */
export function filterCount(filter = {}) {
  return (filter.labels?.length || 0) + Object.values(filter.props || {}).filter((v) => v != null && v !== '' && v !== 'has:').length
}

function labelRank(s, card, groupId) {
  const ranks = card.label_ids.map((id) => s.labels[id]).filter((l) => l && l.group_id === groupId).map((l) => l.position)
  return ranks.length ? Math.min(...ranks) : Infinity
}

export function sortCards(cards, sort = [], s) {
  const rules = sort.length ? sort : [{ field: 'position', dir: 'asc' }]
  return [...cards].sort((a, b) => {
    for (const { field, dir } of rules) {
      const m = dir === 'desc' ? -1 : 1
      let va, vb
      if (field.startsWith('group:')) {
        const gid = Number(field.slice(6))
        va = labelRank(s, a, gid)
        vb = labelRank(s, b, gid)
      } else if (field.startsWith('f:')) {
        const v = (c) => {
          const x = c.values?.[field.slice(2)]
          if (x === undefined || x === null || x === '') return null
          if (typeof x === 'object') return x.at ?? null
          if (typeof x === 'boolean') return x ? 1 : 0
          return typeof x === 'string' ? x.toLowerCase() : x
        }
        va = v(a)
        vb = v(b)
        if (va === null && vb !== null) return 1
        if (vb === null && va !== null) return -1
      } else if (field === 'title') {
        const r = a.title.localeCompare(b.title, 'es', { sensitivity: 'base' })
        if (r) return r * m
        continue
      } else if (field === 'done') {
        va = a.done ? 1 : 0
        vb = b.done ? 1 : 0
      } else {
        va = a[field] ?? null
        vb = b[field] ?? null
        // Lo que no tiene valor (sin fecha) siempre al final, suba o baje
        if (va === null && vb !== null) return 1
        if (vb === null && va !== null) return -1
      }
      if (va < vb) return -1 * m
      if (va > vb) return 1 * m
    }
    return a.position - b.position || a.id - b.id
  })
}

// Posición nueva para soltar algo entre dos vecinos (índices fraccionarios)
export function between(before, after) {
  if (before == null && after == null) return 0
  if (before == null) return after - 1
  if (after == null) return before + 1
  return (before + after) / 2
}

export const SORT_FIELDS = [
  { id: 'position', name: 'Manual' },
  { id: 'title', name: 'Título' },
  { id: 'due_at', name: 'Fecha' },
  { id: 'created_at', name: 'Creación' },
  { id: 'updated_at', name: 'Última edición' },
  { id: 'done', name: 'Terminadas' },
]

/* Estado de la fecha de entrega de una tarjeta (la que marque su proyecto) */
export function dueInfo(card, s = useStore.getState()) {
  return dateInfo(deadlineOf(s, card), card.done)
}

/* Tarjeta en un estado que «no cuenta» (p. ej. un archivo de despliegues):
   no sale en Hoy ni en To Do ni genera avisos */
export function isInactive(s, card) {
  return card.label_ids.some((id) => s.labels[id]?.inactive)
}
