import { dateInfo, deadlineOf } from './deadline'
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
  return out
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
