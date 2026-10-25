import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, EyeOff, Trophy, Users } from 'lucide-react'
import { get } from '../lib/api'
import { useStore } from '../lib/store'
import { fmt } from '../lib/dates'
import { dateOf, fmtDelta } from '../lib/hours'
import { personHex } from '../lib/vacations'
import { funFacts } from '../lib/funfacts'
import { cx, IconButton } from '../components/ui'

/* Ranking: horas de más y balance de la gente de tus equipos que usa el
   parte de horas. Lo ve cualquiera que esté en un equipo, use o no el
   módulo. Las cifras las calcula el servidor; cuando alguien cambia sus
   horas llega «reload_ranking» por el socket y se vuelve a pedir. */

const METRICS = [
  { id: 'extra', name: 'Horas de más', hint: 'Salida real − salida prevista, en los días con salida real.' },
  { id: 'balance', name: 'Balance', hint: 'Imputado − jornada, solo en los días con partes (un día vacío no resta).' },
]
const PERIODS = [
  { id: 'week', name: 'Semana' },
  { id: 'month', name: 'Mes' },
  { id: 'year', name: 'Año' },
]
const KEY = 'mentodo:ranking'
const MEDALS = ['#d4a72c', '#a3a8b0', '#b87a4b']

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}
function save(v) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {}
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
const fmtMin = (m) => (Math.round(m) === 0 ? '0 min' : fmtDelta(m))

function periodLabel(d) {
  if (!d) return ''
  const s = dateOf(d.start)
  const e = dateOf(d.end)
  if (d.period === 'year') return String(s.getFullYear())
  if (d.period === 'month') return fmt(s, 'MMMM yyyy')
  if (d.start.slice(0, 7) === d.end.slice(0, 7)) return `${fmt(s, 'd')}–${fmt(e, 'd MMM')}`
  return `${fmt(s, 'd MMM')} – ${fmt(e, 'd MMM')}`
}

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

export function RankingPage() {
  const online = useStore((s) => s.online)
  const saved = useMemo(load, [])
  const [metric, setMetric] = useState(saved.metric === 'balance' ? 'balance' : 'extra')
  const [period, setPeriod] = useState(PERIODS.some((p) => p.id === saved.period) ? saved.period : 'week')
  const [offset, setOffset] = useState(0)
  const [team, setTeam] = useState(null) // null = todos mis equipos
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const seq = useRef(0)
  const seed = useMemo(() => Math.random().toString(36).slice(2), [])

  useEffect(() => save({ metric, period }), [metric, period])

  const fetchIt = useCallback(() => {
    const n = ++seq.current
    get(`/ranking?period=${period}&offset=${offset}`)
      .then((d) => n === seq.current && (setData(d), setError(null)))
      .catch((e) => n === seq.current && setError(e.message))
  }, [period, offset])

  useEffect(() => {
    fetchIt()
  }, [fetchIt])

  // Tiempo real: alguien de tus equipos ha cambiado sus horas (o el equipo)
  useEffect(() => {
    let t = null
    const on = () => {
      clearTimeout(t)
      t = setTimeout(fetchIt, 250)
    }
    window.addEventListener('mentodo:ranking', on)
    return () => {
      clearTimeout(t)
      window.removeEventListener('mentodo:ranking', on)
    }
  }, [fetchIt])

  // Al reconectar lo que pasó mientras tanto no llegó por el socket
  const wasOnline = useRef(online)
  useEffect(() => {
    if (online && !wasOnline.current) fetchIt()
    wasOnline.current = online
  }, [online, fetchIt])

  const teams = data?.teams || []
  useEffect(() => {
    if (team != null && !teams.some((t) => t.id === team)) setTeam(null)
  }, [teams, team])

  const rows = useMemo(() => {
    if (!data) return []
    const daysKey = `${metric}_days`
    return data.people
      .filter((p) => team == null || p.teams.includes(team))
      .map((p) => ({ ...p, value: p[metric], days: p[daysKey] }))
      .sort((a, b) => (b.days > 0) - (a.days > 0) || b.value - a.value || a.display_name.localeCompare(b.display_name))
  }, [data, metric, team])
  const facts = useMemo(() => (metric === 'extra' && data ? funFacts(rows, { seed, period: data.period, offset: data.offset }) : {}), [rows, metric, data, seed])
  const max = Math.max(1, ...rows.filter((r) => r.days).map((r) => Math.abs(r.value)))

  const seg = (active) => cx('h-8 rounded-lg px-3 text-[13px] transition-colors', active ? 'bg-surface font-medium text-ink shadow-soft' : 'text-muted hover:text-ink')
  const noTeam = data && !teams.length

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:px-8 lg:pt-12">
      <div className="entra flex flex-wrap items-center gap-2">
        <h1 className="flex flex-1 items-center gap-2.5 text-[30px] font-semibold tracking-[-0.03em]">
          <Trophy size={26} className="text-accent" /> Ranking
        </h1>
      </div>

      {noTeam ? (
        <div className="entra mt-8 rounded-2xl border border-line bg-surface p-6 text-center shadow-soft">
          <Users size={28} className="mx-auto text-faint" />
          <p className="mt-3 text-[15px] font-medium">El ranking es entre la gente de tus equipos</p>
          <p className="mt-1 text-[13.5px] text-muted">
            Crea un equipo o acepta una invitación en{' '}
            <Link to="/ajustes" className="text-accent underline-offset-4 hover:underline">
              Ajustes → Equipo
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <div className="entra mt-4 flex flex-wrap items-center gap-2" style={{ '--entra-espera': '40ms' }}>
            <div className="inline-flex rounded-xl bg-sunken p-1">
              {METRICS.map((m) => (
                <button key={m.id} onClick={() => setMetric(m.id)} className={seg(metric === m.id)}>
                  {m.name}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-xl bg-sunken p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPeriod(p.id)
                    setOffset(0)
                  }}
                  className={seg(period === p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {teams.length > 1 && (
              <select
                value={team ?? ''}
                onChange={(e) => setTeam(e.target.value ? Number(e.target.value) : null)}
                className="h-10 rounded-lg border border-line bg-surface px-2.5 text-[13.5px] outline-none"
                aria-label="Equipo"
              >
                <option value="">Todos mis equipos</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="entra mt-3 flex items-center gap-1" style={{ '--entra-espera': '60ms' }}>
            <IconButton label="Anterior" onClick={() => setOffset((o) => o - 1)}>
              <ChevronLeft size={17} />
            </IconButton>
            <IconButton label="Siguiente" onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset === 0} className={offset === 0 ? 'opacity-30' : ''}>
              <ChevronRight size={17} />
            </IconButton>
            <span className={cx('ml-1 text-[15px] font-medium', data?.period === 'month' && 'capitalize')}>{periodLabel(data)}</span>
            {offset !== 0 && (
              <button onClick={() => setOffset(0)} className="ml-2 text-[12.5px] text-faint underline-offset-4 hover:text-muted hover:underline">
                Volver a hoy
              </button>
            )}
          </div>

          {error && <p className="mt-4 text-[13.5px] text-[var(--tc-rojo)]">{error}</p>}

          <ol className="entra mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft" style={{ '--entra-espera': '80ms' }}>
            {data && !rows.length && (
              <li className="px-4 py-6 text-center text-[13.5px] text-muted">Nadie de tu equipo usa el parte de horas todavía (o lo han ocultado).</li>
            )}
            {rows.map((r, i) => {
              const has = r.days > 0
              const pos = has ? i + 1 : null
              const hex = personHex(r.color)
              const neg = r.value < 0
              return (
                <li key={r.user_id} className={cx('border-b border-line px-3 py-2.5 last:border-b-0 sm:px-4', r.me && 'bg-accent-soft/50')}>
                  <div className="flex items-center gap-3">
                    <span
                      className={cx('grid size-7 shrink-0 place-items-center rounded-full text-[12.5px] font-semibold tabular-nums', !(pos && pos <= 3 && r.value > 0) && 'text-faint')}
                      style={pos && pos <= 3 && r.value > 0 ? { background: `color-mix(in oklab, ${MEDALS[pos - 1]} 22%, transparent)`, color: MEDALS[pos - 1] } : undefined}
                    >
                      {pos ?? '–'}
                    </span>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white" style={{ background: hex }}>
                      {initials(r.display_name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-[14.5px] font-medium">
                          {r.display_name}
                          {r.me && <span className="ml-1.5 text-[12px] font-normal text-faint">(tú)</span>}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
                        {has && Math.round(r.value) !== 0 && (
                          <div
                            className="h-full rounded-full transition-[width] duration-500"
                            style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%`, background: neg ? 'var(--tc-rojo)' : hex }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={cx('text-[15px] font-semibold tabular-nums', !has && 'text-faint', neg && 'text-[var(--tc-rojo)]')}>{has ? fmtMin(r.value) : '—'}</div>
                      <div className="text-[11.5px] text-faint tabular-nums">
                        {has ? `${plural(r.days, 'día', 'días')} · ${fmtMin(r.value / r.days)}/día` : 'sin datos'}
                      </div>
                    </div>
                  </div>
                  {facts[r.user_id] && <p className="mt-1.5 text-[12.5px] italic leading-snug text-muted sm:pl-[5.25rem]">{facts[r.user_id]}</p>}
                </li>
              )
            })}
          </ol>

          <p className="mt-3 text-[12.5px] text-faint">
            {METRICS.find((m) => m.id === metric).hint} Solo sale quien usa el parte de horas y no se ha ocultado; se actualiza solo cuando alguien cambia sus horas.
          </p>
          {data?.me_hidden && (
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-faint">
              <EyeOff size={13} /> Tú no sales: lo tienes apagado en{' '}
              <Link to="/ajustes" className="text-accent underline-offset-4 hover:underline">
                Ajustes → Parte de horas
              </Link>
              .
            </p>
          )}
        </>
      )}
    </div>
  )
}
