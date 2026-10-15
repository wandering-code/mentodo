/* Relaciones de una tarjeta, ya resueltas a tarjetas (se ignoran las que
   apunten a algo que ya no existe o está oculto por un borrado pendiente) */
export function linksOf(s, cardId) {
  const card = (id) => (s.hidden[id] ? null : s.cards[id])
  const out = { parent: null, parentLink: null, children: [], blockedBy: [], blocks: [], related: [] }
  for (const l of Object.values(s.links)) {
    if (l.kind === 'parent') {
      if (l.to_id === cardId && card(l.from_id)) (out.parent = card(l.from_id)), (out.parentLink = l)
      if (l.from_id === cardId && card(l.to_id)) out.children.push({ card: card(l.to_id), link: l })
    } else if (l.kind === 'blocks') {
      if (l.to_id === cardId && card(l.from_id)) out.blockedBy.push({ card: card(l.from_id), link: l })
      if (l.from_id === cardId && card(l.to_id)) out.blocks.push({ card: card(l.to_id), link: l })
    } else if (l.kind === 'relates') {
      const other = l.from_id === cardId ? l.to_id : l.to_id === cardId ? l.from_id : null
      if (other && card(other)) out.related.push({ card: card(other), link: l })
    }
  }
  const byPos = (a, b) => a.card.position - b.card.position || a.card.id - b.card.id
  out.children.sort(byPos)
  return out
}

/* Indicadores para tablero y listas: ¿bloqueada? y progreso de subtareas */
export function linkBadges(s, cardId) {
  let blocked = false
  let total = 0
  let done = 0
  for (const l of Object.values(s.links)) {
    if (l.kind === 'blocks' && l.to_id === cardId) {
      const b = s.cards[l.from_id]
      if (b && !b.done) blocked = true
    } else if (l.kind === 'parent' && l.from_id === cardId) {
      const c = s.cards[l.to_id]
      if (c) {
        total++
        if (c.done) done++
      }
    }
  }
  return { blocked, subtasks: total ? { total, done } : null }
}

/* Para usar dentro de un selector de zustand: devuelve un texto (se compara
   por valor), y badgesFromKey lo convierte de vuelta. Un objeto nuevo en cada
   llamada haría que la tarjeta se volviera a pintar sin parar. */
export function linkBadgesKey(s, cardId) {
  const b = linkBadges(s, cardId)
  return `${b.blocked ? 1 : 0}|${b.subtasks ? `${b.subtasks.done}/${b.subtasks.total}` : ''}`
}
export function badgesFromKey(key) {
  const [blocked, sub] = key.split('|')
  if (!sub) return { blocked: blocked === '1', subtasks: null }
  const [done, total] = sub.split('/').map(Number)
  return { blocked: blocked === '1', subtasks: { done, total } }
}
