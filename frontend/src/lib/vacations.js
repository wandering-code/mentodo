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
    // Días arrastrados: carry[año] = los que pasan del año anterior a ese
    carry: raw.carry || {},
    // Festivos: los mismos que en Horas si no se elige otra cosa
    region: raw.region !== undefined ? raw.region : hoursRegion !== undefined && hoursRegion !== null ? hoursRegion : '',
    color: PERSON_COLORS.includes(raw.color) ? raw.color : PERSON_COLORS[(user?.id || 0) % PERSON_COLORS.length],
  }
}
// Días que da el año en sí (sin contar los arrastrados)
export const baseFor = (st, year) => (Number.isFinite(st.days_by_year[year]) ? st.days_by_year[year] : st.days)
// Días que pasan del año anterior a `year`
export const carryInto = (st, year) => (Number.isFinite(st.carry[year]) ? st.carry[year] : 0)
/* Días con los que cuenta el año: los suyos, más los que le llegan del
   anterior, menos los que pasa al siguiente (así no cuentan dos veces). */
export const allowanceFor = (st, year) => baseFor(st, year) + carryInto(st, year) - carryInto(st, year + 1)

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

/* Días laborables en que coincide más de una persona fuera, agrupados en
   tramos (un tramo sigue aunque en medio haya un fin de semana o festivo) */
export function overlaps(byDay, holidays = new Set()) {
  const keys = Object.keys(byDay)
    .filter((k) => isWorkday(k, holidays) && new Set(byDay[k].map((v) => v.user_id)).size > 1)
    .sort()
  // ¿Entre el final del tramo y `k` solo hay días no laborables?
  const follows = (end, k) => {
    for (let d = addDays(dateOf(end), 1); dayKey(d) < k; d = addDays(d, 1)) if (isWorkday(dayKey(d), holidays)) return false
    return true
  }
  const out = []
  for (const k of keys) {
    const last = out[out.length - 1]
    if (last && follows(last.end, k)) {
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

/* Festivos propios por día: { 'AAAA-MM-DD': [festivo, …] } */
export function daysOffByDay(daysOff) {
  const out = {}
  for (const d of daysOff) for (const k of daysOf(d)) (out[k] ||= []).push(d)
  return out
}

/* Los festivos de la comunidad más los propios (los tuyos y los de tus
   equipos), todos en un mismo Set. Los propios van también aparte en `.off`. */
export function withDaysOff(fest, daysOff) {
  const off = new Set(Object.keys(daysOffByDay(daysOff)))
  return Object.assign(new Set([...fest, ...off]), { off })
}

/* «Solo para ti» o el nombre del equipo */
export const dayOffScope = (d, teams) => (d.team_id == null ? 'Solo para ti' : teams.find((t) => t.id === d.team_id)?.name || 'Equipo')

/* Equipos en los que estás activo (a los que puedes poner un festivo) */
export const activeTeams = (user, teams) => teams.filter((t) => t.members.find((m) => m.user_id === user.id)?.status === 'active')
