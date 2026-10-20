import { addDays } from 'date-fns'
import { dateOf, dayKey } from './hours'
import { colorHex } from './palette'

/* Vacaciones (módulo opcional). Periodos de días enteros, ambos incluidos,
   con estado. Se ven las propias y las de la gente con la que compartes un
   equipo activo. Los ajustes van en user.prefs.vacations. */

export const STATUSES = [
  { id: 'posible', name: 'Posible', hint: 'Me lo estoy planteando' },
  { id: 'pedida', name: 'Pedida', hint: 'Pedida a la empresa, sin respuesta' },
  { id: 'confirmada', name: 'Confirmada', hint: 'Aprobada: cuenta en Horas' },
]
export const statusName = (id) => STATUSES.find((s) => s.id === id)?.name || id

// Mismos ids que en el servidor (backend/app/teams.py)
export const PERSON_COLORS = ['azul', 'coral', 'morado', 'menta', 'ambar', 'rosa', 'verde', 'naranja']
export const personHex = (id) => colorHex(id)

export const vacationsOn = (user) => !!user?.prefs?.mod_vacations

export function vacSettings(user) {
  const raw = user?.prefs?.vacations || {}
  const hoursRegion = user?.prefs?.hours?.region
  return {
    days: Number.isFinite(raw.days) ? raw.days : 22,
    // Días de un año concreto (p. ej. con los que te sobraron del anterior)
    days_by_year: raw.days_by_year || {},
    // Festivos: los mismos que en Horas si no se elige otra cosa
    region: raw.region !== undefined ? raw.region : hoursRegion !== undefined && hoursRegion !== null ? hoursRegion : '',
    color: PERSON_COLORS.includes(raw.color) ? raw.color : PERSON_COLORS[(user?.id || 0) % PERSON_COLORS.length],
  }
}
export const allowanceFor = (st, year) => (Number.isFinite(st.days_by_year[year]) ? st.days_by_year[year] : st.days)

/* Gente que sale en el calendario: tú primero y luego tus compañeros de
   equipos activos (sin repetir aunque coincidáis en varios). */
export function peopleOf(user, teams) {
  const me = { id: user.id, name: 'Tú', full: user.display_name, color: vacSettings(user).color, me: true }
  const out = [me]
  const seen = new Set([user.id])
  for (const t of teams) {
    if (t.members.find((m) => m.user_id === user.id)?.status !== 'active') continue
    for (const m of t.members) {
      if (m.status !== 'active' || seen.has(m.user_id)) continue
      seen.add(m.user_id)
      out.push({ id: m.user_id, name: m.display_name, full: m.display_name, username: m.username, color: m.color })
    }
  }
  return out
}

export function daysOf(v) {
  const out = []
  const end = dateOf(v.end)
  for (let d = dateOf(v.start); d <= end; d = addDays(d, 1)) out.push(dayKey(d))
  return out
}

/* Índice por día: { 'AAAA-MM-DD': [vacación, …] } */
export function indexByDay(vacations) {
  const out = {}
  for (const v of vacations) for (const k of daysOf(v)) (out[k] ||= []).push(v)
  return out
}

export const isWorkday = (k, holidays) => {
  const wd = dateOf(k).getDay()
  return wd !== 0 && wd !== 6 && !holidays.has(k)
}

/* Días laborables (lunes a viernes, sin festivos) de un periodo; con `year`,
   solo los que caen en ese año. */
export function workdaysIn(v, holidays, year) {
  let n = 0
  for (const k of daysOf(v)) if ((year == null || k.startsWith(String(year))) && isWorkday(k, holidays)) n++
  return n
}

/* El contador del año: disfrutados (confirmados ya pasados), confirmados por
   venir, pedidos y posibles. «Te quedan» descuenta confirmados y pedidos. */
export function yearCount(mine, holidays, year, allowance, today = dayKey(new Date())) {
  const c = { enjoyed: 0, confirmed: 0, requested: 0, possible: 0 }
  for (const v of mine) {
    for (const k of daysOf(v)) {
      if (!k.startsWith(String(year)) || !isWorkday(k, holidays)) continue
      if (v.status === 'confirmada') c[k < today ? 'enjoyed' : 'confirmed']++
      else if (v.status === 'pedida') c.requested++
      else c.possible++
    }
  }
  c.left = allowance - c.enjoyed - c.confirmed - c.requested
  c.leftIfAll = c.left - c.possible
  return c
}

/* Días en que coincide más de una persona fuera, agrupados en tramos seguidos */
export function overlaps(byDay) {
  const keys = Object.keys(byDay).filter((k) => new Set(byDay[k].map((v) => v.user_id)).size > 1).sort()
  const out = []
  for (const k of keys) {
    const last = out[out.length - 1]
    if (last && dayKey(addDays(dateOf(last.end), 1)) === k) {
      last.end = k
      for (const id of byDay[k].map((v) => v.user_id)) last.users.add(id)
    } else out.push({ start: k, end: k, users: new Set(byDay[k].map((v) => v.user_id)) })
  }
  return out
}

/* Días de tus vacaciones confirmadas (para Horas: jornada 0) */
export function confirmedDays(vacations, userId) {
  const out = new Set()
  for (const v of vacations) if (v.user_id === userId && v.status === 'confirmada') for (const k of daysOf(v)) out.add(k)
  return out
}
