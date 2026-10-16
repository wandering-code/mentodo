import { deadlineKey } from './deadline'
import { addDays, addMonths, addWeeks, addYears, differenceInCalendarDays, startOfWeek } from 'date-fns'

/* Misma regla que el backend (cards.next_date): la repetición siguiente,
   estrictamente después de `d`. Días de la semana: 0 = lunes. */
export function stepDate(rule, d) {
  const n = Math.max(1, Number(rule.interval) || 1)
  const days = [...new Set(rule.weekdays || [])].map(Number)
  if (rule.freq === 'daily') return addDays(d, n)
  if (rule.freq === 'monthly') return addMonths(d, n)
  if (rule.freq === 'yearly') return addYears(d, n)
  if (rule.freq === 'weekly') {
    if (!days.length) return addWeeks(d, n)
    const monday = startOfWeek(d, { weekStartsOn: 1 })
    let c = addDays(d, 1)
    for (let i = 0; i < 7 * n + 7; i++) {
      const weeks = Math.floor(differenceInCalendarDays(startOfWeek(c, { weekStartsOn: 1 }), monday) / 7)
      if (days.includes((c.getDay() + 6) % 7) && weeks % n === 0) return c
      c = addDays(c, 1)
    }
    return addWeeks(d, n)
  }
  return addDays(d, 1)
}

const readAt = (card, key) => {
  if (!key || key === 'due') return card.due_at ? new Date(card.due_at) : null
  const v = card.values?.[key.slice(2)]
  return v?.at ? new Date(v.at) : null
}

/* Qué fecha marca el ritmo si la regla no elige: la de entrega del proyecto */
export const defaultRepeatKey = deadlineKey

/* Próximas repeticiones de una tarea pendiente (sin contar la actual), tal
   como caerían en la fecha `dateKey`, hasta `until`. Todas las fechas de la
   tarjeta avanzan lo mismo que la que marca el ritmo. Las que cuentan «desde
   que la termino» no se pueden prever. */
export function upcoming(card, until, dateKey = 'due', max = 60) {
  const r = card.recurrence
  if (!r || card.done || r.from === 'done') return []
  const anchor = readAt(card, r.key || 'due')
  const target = readAt(card, dateKey)
  if (!anchor || !target) return []
  const out = []
  let d = anchor
  for (let i = 0; i < max; i++) {
    d = stepDate(r, d)
    const at = addDays(target, differenceInCalendarDays(d, anchor))
    if (at > until) break
    out.push(at)
  }
  return out
}
