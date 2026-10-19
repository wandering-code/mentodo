import { useEffect, useState } from 'react'
import { addDays, format, startOfWeek } from 'date-fns'
import { get } from './api'

/* Parte de horas (módulo opcional). Todo va en minutos enteros; la interfaz
   los enseña como «8,25» o «8:15» según la preferencia del usuario. Mismos
   valores por defecto que el servidor (backend/app/hours.py). */

const DAY = { target: 480, lunch: 45, lunch_from: '14:30' }
export const DEFAULT_SCHEDULE = [DAY, DAY, DAY, DAY, { target: 480, lunch: 0, lunch_from: '14:30' }, { target: 0, lunch: 0, lunch_from: '14:30' }, { target: 0, lunch: 0, lunch_from: '14:30' }]
export const DEFAULTS = { schedule: DEFAULT_SCHEDULE, step: 15, format: 'dec', region: null, notify_exit: null, notify_close: null, today_widget: true }
export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// Por debajo de esto (en minutos) cuenta como cero: medio minuto de margen
const EPS = 0.5

export const hoursOn = (user) => !!user?.prefs?.mod_hours

export function hoursSettings(user) {
  const raw = user?.prefs?.hours || {}
  const out = { ...DEFAULTS, ...raw }
  const sched = Array.isArray(out.schedule) && out.schedule.length === 7 ? out.schedule : DEFAULT_SCHEDULE
  out.schedule = sched.map((d) => ({ ...DAY, ...d }))
  return out
}

export const dayKey = (d) => format(d, 'yyyy-MM-dd') // en hora local, no UTC
export const dateOf = (k) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const weekdayIdx = (d) => (d.getDay() + 6) % 7 // 0 = lunes
export const weekOf = (d) => {
  const s = startOfWeek(d, { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}

export const toMin = (hm) => {
  if (!hm) return null
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + (m || 0)
}
export const toHM = (min) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
export const quantize = (min, step = 15) => Math.round(min / step) * step

/* 8,25 · 8:15 (con signo si se pide) */
export function fmtH(min, style = 'dec', signed = false) {
  const neg = min < -EPS
  const a = Math.abs(min) < EPS ? 0 : Math.abs(min)
  const body = style === 'hm' ? `${Math.floor(a / 60)}:${String(Math.round(a % 60)).padStart(2, '0')}` : (a / 60).toFixed(2).replace('.', ',')
  return (neg ? '−' : signed && a > 0 ? '+' : '') + body
}

/* Duración legible para la cuenta atrás: «2 h 15», «40 min» */
export function fmtSpan(min) {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} min`
  return m % 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m / 60} h`
}

/* Lo que se escribe en «Horas»: 1,25 · 1.5 · 1:15 · 90m · 45 min */
export function parseDuration(text) {
  const t = String(text || '').trim().toLowerCase().replace(/\s+/g, '')
  if (!t) return null
  let m = t.match(/^(\d{1,2}):(\d{1,2})$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  m = t.match(/^(\d+)(m|min)$/)
  if (m) return Number(m[1])
  m = t.match(/^(\d+(?:[.,]\d+)?)h?$/)
  if (m) return Math.round(Number(m[1].replace(',', '.')) * 60)
  return null
}

/* Un día con todo resuelto: lo guardado o, si aún no existe, su horario */
export function dayOf(workdays, key, settings, holidays) {
  const saved = workdays[key]
  if (saved) return { ...saved, exists: true }
  const d = settings.schedule[weekdayIdx(dateOf(key))]
  const holiday = holidays?.has(key)
  return { day: key, start: null, end: null, target_minutes: holiday ? 0 : d.target, lunch_minutes: d.lunch, lunch_from: d.lunch_from, exists: false }
}

/* Salida prevista: la comida solo se suma si la jornada llega a ella */
export function exitOf(day) {
  const start = toMin(day.start)
  if (start == null) return null
  const base = start + day.target_minutes
  return base + (base >= toMin(day.lunch_from) ? day.lunch_minutes : 0)
}

/* Lo que llevas trabajado. Hoy: según el reloj, sin contar el rato de comida
   y sin pasar de la jornada (lo de más se ve en el balance). Un día pasado:
   hasta la salida real si se puso, y si no, la jornada entera. Un día
   futuro: nada. */
export function workedOf(day, key, now = new Date()) {
  const today = dayKey(now)
  const start = toMin(day.start)
  const t = day.target_minutes
  if (key > today) return 0
  if (start == null) return key < today ? t : null
  const end = toMin(day.end)
  const at = key < today ? (end ?? null) : end != null ? Math.min(end, now.getHours() * 60 + now.getMinutes()) : now.getHours() * 60 + now.getMinutes()
  if (at == null) return t
  const from = toMin(day.lunch_from)
  const lunch = start + t >= from ? day.lunch_minutes : 0
  const discount = at <= from ? 0 : Math.min(lunch, at - from)
  return Math.max(0, Math.min(t, at - start - discount))
}

export const sumMinutes = (list) => list.reduce((a, e) => a + e.minutes, 0)

export function entriesByDay(entries) {
  const out = {}
  for (const e of Object.values(entries)) (out[e.day] ||= []).push(e)
  for (const k in out) out[k].sort((a, b) => a.position - b.position || a.id - b.id)
  return out
}

/* Estado del día para el anillo y los textos */
export function dayStatus(day, key, entries, now = new Date()) {
  const imputed = sumMinutes(entries)
  const worked = workedOf(day, key, now)
  const pendNow = worked == null ? null : worked - imputed
  const pendTot = day.target_minutes - imputed
  return { imputed, worked, pendNow, pendTot, exit: exitOf(day) }
}
export const isZero = (m) => Math.abs(m) < EPS

/* Balance de la semana: solo cuentan los días con partes (un lunes vacío no
   es un −8, es un día sin rellenar todavía) */
export function weekBalance(keys, workdays, byDay, settings, holidays) {
  let bal = 0
  for (const k of keys) {
    const list = byDay[k]
    if (!list?.length) continue
    bal += sumMinutes(list) - dayOf(workdays, k, settings, holidays).target_minutes
  }
  return bal
}

/* Festivos de la comunidad elegida (null = sin festivos) */
const holidayCache = {}
export function useHolidays(region, years) {
  const [set, setSet] = useState(() => new Set())
  const key = `${region}|${years.join(',')}`
  useEffect(() => {
    if (region == null) return setSet(new Set())
    let alive = true
    const done = (d) => alive && setSet(new Set(d.holidays.map((h) => h.date)))
    if (holidayCache[key]) done(holidayCache[key])
    else
      get(`/holidays?region=${region}&years=${years.join(',')}`)
        .then((d) => {
          holidayCache[key] = d
          done(d)
        })
        .catch(() => {})
    return () => {
      alive = false
    }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return set
}

/* CSV para Excel en español: «;» y coma decimal. Una línea por parte y los
   días sin partes también (registro de presencia). Mismas columnas que
   Cuarto de Hora, para que lo que se haga después con él no cambie. */
export function hoursCsv({ keys, workdays, byDay, settings, holidays }) {
  const clean = (v) => String(v ?? '').replace(/[;\r\n]+/g, ', ')
  const n = (m) => (m / 60).toFixed(2).replace('.', ',')
  const rows = ['Fecha;Día;Entrada;Salida prevista;Jornada;Comida;Comida desde;Cliente;Tarea;Horas']
  for (const k of keys) {
    const d = dayOf(workdays, k, settings, holidays)
    const list = byDay[k] || []
    if (!d.exists && !list.length) continue
    const ex = exitOf(d)
    const head = [k.split('-').reverse().join('/'), WEEKDAYS[weekdayIdx(dateOf(k))], d.start || '', ex == null ? '' : toHM(ex) + (ex >= 1440 ? ' (+1)' : ''), n(d.target_minutes), n(d.lunch_minutes), d.lunch_from]
    if (!list.length) rows.push([...head, '', '', ''].join(';'))
    for (const e of list) rows.push([...head, clean(e.client), clean(e.task), n(e.minutes)].join(';'))
  }
  return rows.join('\r\n')
}
