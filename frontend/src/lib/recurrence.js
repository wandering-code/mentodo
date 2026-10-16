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

/* Próximas repeticiones de una tarea pendiente (sin contar la actual),
   hasta `until`. Las que cuentan «desde que la termino» no se pueden prever. */
export function upcoming(card, until, max = 60) {
  const r = card.recurrence
  if (!r || card.done || !card.due_at || r.from === 'done') return []
  const out = []
  let d = new Date(card.due_at)
  for (let i = 0; i < max; i++) {
    d = stepDate(r, d)
    if (d > until) break
    out.push(d)
  }
  return out
}
