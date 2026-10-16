import { isBefore, isToday, isTomorrow, startOfDay } from 'date-fns'
import { useStore } from './store'

/* La fecha de entrega de una tarjeta: la que su proyecto marque como tal
   (la principal, «due», o una propia de tipo fecha, «f:<id>»). Con ella se
   calcula lo atrasado, lo de hoy, los avisos y las repeticiones. */

export function deadlineKey(s, projectId) {
  const k = projectId ? s.projects[projectId]?.deadline_key : null
  if (k && k.startsWith('f:') && s.fields[k.slice(2)]?.kind === 'date') return k
  return 'due'
}

/* { at, allDay } de la fecha `key` de la tarjeta, o null */
export function readDate(card, key) {
  if (!key || key === 'due') return card.due_at ? { at: card.due_at, allDay: card.due_all_day } : null
  const v = card.values?.[key.slice(2)]
  return v?.at ? { at: v.at, allDay: v.all_day ?? true } : null
}

export const deadlineOf = (s, card) => readDate(card, deadlineKey(s, card.project_id))

export function useDeadlineKey(projectId) {
  return useStore((s) => deadlineKey(s, projectId))
}

/* Estado de una fecha de entrega: atrasada, hoy, mañana */
export function dateInfo(d, done) {
  if (!d) return null
  const date = new Date(d.at)
  const overdue = !done && isBefore(d.allDay ? startOfDay(date) : date, d.allDay ? startOfDay(new Date()) : new Date())
  return { date, overdue, today: isToday(date), tomorrow: isTomorrow(date) }
}
