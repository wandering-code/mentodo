import { addDays, format, isThisYear, isToday, isTomorrow, isYesterday, nextMonday, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'

export const fmt = (d, f) => format(d, f, { locale: es })

export function humanDate(iso, allDay = true) {
  if (!iso) return ''
  const d = new Date(iso)
  let day
  if (isToday(d)) day = 'Hoy'
  else if (isTomorrow(d)) day = 'Mañana'
  else if (isYesterday(d)) day = 'Ayer'
  else day = fmt(d, isThisYear(d) ? 'EEE d MMM' : 'd MMM yyyy')
  return allDay ? day : `${day}, ${fmt(d, 'HH:mm')}`
}

// Las fechas "todo el día" se guardan a mediodía local: así ningún cambio de
// zona horaria razonable las mueve al día anterior o siguiente.
export function allDayIso(date) {
  const d = startOfDay(date)
  d.setHours(12)
  return d.toISOString()
}

export const QUICK_DATES = [
  { id: 'today', name: 'Hoy', get: () => new Date() },
  { id: 'tomorrow', name: 'Mañana', get: () => addDays(new Date(), 1) },
  { id: 'weekend', name: 'Este finde', get: () => { const d = new Date(); return addDays(d, (6 - d.getDay() + 7) % 7 || 7) } },
  { id: 'nextweek', name: 'Próx. semana', get: () => nextMonday(new Date()) },
]

export const toDateInput = (iso) => (iso ? fmt(new Date(iso), 'yyyy-MM-dd') : '')
export const toTimeInput = (iso) => (iso ? fmt(new Date(iso), 'HH:mm') : '')
export const toDateTimeInput = (iso) => (iso ? fmt(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '')
