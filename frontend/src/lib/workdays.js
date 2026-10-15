import { addDays, format, isAfter, startOfDay } from 'date-fns'

/* Jornadas: días laborables (lunes a viernes, sin festivos) entre la fecha de
   inicio y la de fin de cada tarjeta, ambas incluidas, repartidos por mes. Si
   no hay fin todavía, cuenta hasta hoy (corrección en curso). */

export const dayKey = (d) => format(d, 'yyyy-MM-dd')
export const monthKey = (d) => format(d, 'yyyy-MM')

/* Fecha (día local) de una propiedad de fecha de la tarjeta: "due" o "f:<id>" */
export function propDate(card, key) {
  if (!key) return null
  if (key === 'due') return card.due_at ? startOfDay(new Date(card.due_at)) : null
  if (key.startsWith('f:')) {
    const v = card.values?.[key.slice(2)]
    return v?.at ? startOfDay(new Date(v.at)) : null
  }
  return null
}

export function workdaysByMonth(start, end, holidays) {
  const out = {}
  if (!start || !end || isAfter(start, end)) return out
  for (let d = start; !isAfter(d, end); d = addDays(d, 1)) {
    const wd = d.getDay()
    if (wd === 0 || wd === 6 || holidays.has(dayKey(d))) continue
    const m = monthKey(d)
    const slot = (out[m] ||= { days: 0, from: d, to: d })
    slot.days += 1
    slot.to = d
  }
  return out
}

/* Filas del informe: una por tarjeta y mes, con el ajuste manual aplicado */
export function buildReport({ cards, config, holidays, today = startOfDay(new Date()) }) {
  const labels = config.label_ids || []
  const rows = []
  const missing = []
  for (const card of cards) {
    if (!labels.length || !card.label_ids.some((id) => labels.includes(id))) continue
    const start = propDate(card, config.start)
    if (!start) {
      missing.push(card)
      continue
    }
    const endRaw = propDate(card, config.end)
    const ongoing = !endRaw
    const end = endRaw || today
    const months = workdaysByMonth(start, end, holidays)
    for (const [month, slot] of Object.entries(months)) {
      const key = `${card.id}:${month}`
      const override = config.overrides?.[key]
      rows.push({
        key,
        card,
        month,
        from: slot.from,
        to: slot.to,
        auto: slot.days,
        days: override ?? slot.days,
        adjusted: override != null && override !== slot.days,
        ongoing,
      })
    }
  }
  rows.sort((a, b) => a.month.localeCompare(b.month) || a.from - b.from)
  return { rows, missing }
}

export function toCsv(rows) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
  const head = ['Mes', 'Corrección', 'Desde', 'Hasta', 'Jornadas']
  const lines = rows.map((r) => [r.month, r.card.title || 'Sin título', dayKey(r.from), dayKey(r.to), String(r.days).replace('.', ',')].map(esc).join(';'))
  return '﻿' + [head.map(esc).join(';'), ...lines].join('\r\n')
}
