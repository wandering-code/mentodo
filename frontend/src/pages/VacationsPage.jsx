import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { addDays, endOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Trash2, TreePalm, Users } from 'lucide-react'
import { useStore } from '../lib/store'
import { fmt } from '../lib/dates'
import { dateOf, dayKey, useFestivos, WEEKDAYS_SHORT } from '../lib/hours'
import {
  allowanceFor, daysOf, indexByDay, isWorkday, overlaps, peopleOf, personHex, STATUSES, statusName, vacationsOn, vacSettings, workdaysIn, yearCount,
} from '../lib/vacations'
import { Block, Button, cx, IconButton, Input, Modal } from '../components/ui'

/* Vacaciones: el año entero de un vistazo, con las tuyas y las de tu equipo.
   Tocar un día libre empieza a marcar un periodo (el segundo toque lo
   cierra); tocar uno de tus periodos lo abre para cambiarlo. */

const RED = 'var(--tc-rojo)'
// Coincidencias: un contorno neutro, que no se confunda con el color de nadie
const CLASH = 'var(--ink)'

/* Cómo se pinta cada estado: confirmada sólida, pedida a rayas, posible
   solo el contorno (lo menos «firme»). */
export function statusStyle(color, status) {
  const c = personHex(color)
  if (status === 'confirmada') return { background: c }
  if (status === 'pedida') return { background: `repeating-linear-gradient(-45deg, ${c} 0 3px, color-mix(in oklab, ${c} 30%, transparent) 3px 6px)` }
  return { background: `color-mix(in oklab, ${c} 18%, transparent)`, boxShadow: `inset 0 0 0 1.5px ${c}` }
}

function Swatch({ color, status, className }) {
  return <span className={cx('inline-block h-2.5 w-4 shrink-0 rounded-[3px]', className)} style={statusStyle(color, status)} />
}

/* «3–14 ago» · «28 jul – 8 ago» · «5 ago» */
export function shortRange(a, b) {
  const s = dateOf(a)
  const e = dateOf(b)
  if (a === b) return fmt(s, 'd MMM')
  if (a.slice(0, 7) === b.slice(0, 7)) return `${fmt(s, 'd')}–${fmt(e, 'd MMM')}`
  return `${fmt(s, 'd MMM')} – ${fmt(e, a.slice(0, 4) === b.slice(0, 4) ? 'd MMM' : 'd MMM yyyy')}`
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

function Month({ year, month, byDay, people, holidays, today, sel, onDay, onHover, focus }) {
  const first = new Date(year, month, 1)
  const last = dayKey(endOfMonth(first))
  const firstKey = dayKey(first)
  const cells = []
  for (let d = startOfWeek(first, { weekStartsOn: 1 }); cells.length < 42; d = addDays(d, 1)) {
    const k = dayKey(d)
    if (cells.length % 7 === 0 && k > last) break
    cells.push(k)
  }
  const inSel = (k) => sel && k >= (sel.start < sel.end ? sel.start : sel.end) && k <= (sel.start < sel.end ? sel.end : sel.start)
  const byId = Object.fromEntries(people.map((p) => [p.id, p]))
  return (
    <section id={`mes-${firstKey.slice(0, 7)}`} className="scroll-mt-20 rounded-2xl border border-line bg-surface p-2.5 shadow-soft sm:p-3">
      <h3 className="mb-1.5 px-1 text-[14px] font-semibold capitalize tracking-[-0.01em]">{fmt(first, 'MMMM')}</h3>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="pb-1 text-center text-[10.5px] font-medium text-faint">
            {w}
          </div>
        ))}
        {cells.map((k) => {
          const inMonth = k >= firstKey && k <= last
          if (!inMonth) return <div key={k} />
          const list = (byDay[k] || []).filter((v) => byId[v.user_id])
          const users = new Set(list.map((v) => v.user_id))
          const clash = users.size > 1
          const weekend = !isWorkday(k, new Set()) // sábado o domingo
          const fest = holidays.has(k)
          const picked = inSel(k)
          const title = [
            fmt(dateOf(k), "EEEE d 'de' MMMM"),
            fest ? 'festivo' : null,
            ...list.map((v) => `${byId[v.user_id].me ? 'Tú' : byId[v.user_id].name}: ${statusName(v.status).toLowerCase()}${v.note ? ` (${v.note})` : ''}`),
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <button
              key={k}
              type="button"
              title={title}
              onClick={() => onDay(k)}
              onMouseEnter={() => onHover(k)}
              className={cx(
                'relative flex h-11 flex-col items-center justify-start gap-1 rounded-lg pt-1.5 transition-colors',
                picked ? 'bg-accent-soft' : 'hover:bg-hover',
                focus === k && 'ring-2 ring-accent',
              )}
              style={clash && !picked ? { boxShadow: `inset 0 0 0 1.5px ${CLASH}` } : undefined}
            >
              <span
                className={cx(
                  'text-[12.5px] tabular-nums leading-none',
                  k === today ? 'grid size-5 place-items-center rounded-full bg-accent font-semibold text-accent-ink' : weekend || fest ? 'text-faint' : 'text-ink',
                  fest && k !== today && 'underline decoration-dotted underline-offset-2',
                )}
              >
                {Number(k.slice(8))}
              </span>
              <span className="flex w-full flex-col gap-[2px] px-1">
                {list.slice(0, 3).map((v) => (
                  <span key={v.id} className="block h-[5px] rounded-full" style={statusStyle(byId[v.user_id].color, v.status)} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Editor({ open, onClose, draft, people, byDay, holidays }) {
  const s = useStore()
  const [form, setForm] = useState(draft)
  // Se queda con el último borrador al cerrar: así no se vacía durante la animación
  useEffect(() => {
    if (draft) setForm(draft)
  }, [draft])
  if (!form) return null
  const editing = !!form.id
  const start = form.start <= form.end ? form.start : form.end
  const end = form.start <= form.end ? form.end : form.start
  const n = workdaysIn({ start, end }, holidays)
  const total = daysOf({ start, end }).length
  // Con quién coincide (sin contarte a ti)
  const mates = new Map()
  for (const k of daysOf({ start, end }))
    for (const v of byDay[k] || []) if (v.user_id !== s.user.id) mates.set(v.user_id, (mates.get(v.user_id) || 0) + 1)
  const name = (id) => people.find((p) => p.id === id)?.name || 'Alguien'

  const save = async () => {
    const body = { start, end, status: form.status, note: form.note.trim() }
    if (editing) s.updateVacation(form.id, body)
    else await s.createVacation(body)
    onClose()
  }
  const field = 'mt-1 h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-[14.5px] outline-none focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--line))]'

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.01em]">
        <TreePalm size={18} className="text-accent" /> {editing ? 'Tus vacaciones' : 'Nuevas vacaciones'}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-[13px] text-muted">
          Desde
          <input type="date" value={form.start} onChange={(e) => e.target.value && setForm({ ...form, start: e.target.value })} className={field} />
        </label>
        <label className="text-[13px] text-muted">
          Hasta
          <input type="date" value={form.end} onChange={(e) => e.target.value && setForm({ ...form, end: e.target.value })} className={field} />
        </label>
      </div>
      <p className="mt-2 text-[12.5px] text-muted">
        {plural(n, 'día laborable', 'días laborables')}
        {total !== n && <span className="text-faint"> · {plural(total, 'día', 'días')} en total</span>}
      </p>
      {mates.size > 0 && (
        <p className="mt-1 text-[12.5px]" style={{ color: RED }}>
          Coincide con {[...mates].map(([id, d]) => `${name(id)} (${plural(d, 'día', 'días')})`).join(', ')}
        </p>
      )}

      <div className="mt-4 text-[13px] text-muted">Estado</div>
      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-3">
        {STATUSES.map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setForm({ ...form, status: st.id })}
            className={cx(
              'flex flex-col items-start gap-1 rounded-xl border px-3 py-2 text-left transition-colors',
              form.status === st.id ? 'border-[color-mix(in_oklab,var(--accent)_50%,var(--line))] bg-accent-soft' : 'border-line hover:bg-hover',
            )}
          >
            <span className="flex items-center gap-2 text-[14px] font-medium">
              <Swatch color={vacSettings(s.user).color} status={st.id} /> {st.name}
            </span>
            <span className="text-[11.5px] leading-snug text-muted">{st.hint}</span>
          </button>
        ))}
      </div>

      <label className="mt-4 block text-[13px] text-muted">
        Nota <span className="text-faint">(opcional)</span>
        <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Japón, puente, boda de…" maxLength={200} className="mt-1" />
      </label>

      <div className="mt-5 flex items-center gap-2">
        {editing && (
          <Button
            variant="danger"
            onClick={() => {
              s.deleteVacation(form.id)
              onClose()
            }}
          >
            <Trash2 size={15} /> Quitar
          </Button>
        )}
        <span className="flex-1" />
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={save}>
          {editing ? 'Guardar' : 'Añadir'}
        </Button>
      </div>
    </Modal>
  )
}

function Counter({ c, allowance, year, color }) {
  const used = c.enjoyed + c.confirmed + c.requested
  const scale = Math.max(allowance, used + c.possible, 1)
  const seg = (n, status, extra) => n > 0 && <span className={cx('block h-full', extra)} style={{ width: `${(n / scale) * 100}%`, ...statusStyle(color, status) }} />
  const over = c.left < 0
  return (
    <section className="entra mt-5 rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5" style={{ '--entra-espera': '60ms' }}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div>
          <div className="text-[12.5px] font-medium text-muted">{over ? 'Te pasas' : 'Te quedan'}</div>
          <div className="text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums" style={over ? { color: RED } : undefined}>
            {Math.abs(c.left)} <span className="text-[16px] font-medium text-muted">{Math.abs(c.left) === 1 ? 'día' : 'días'}</span>
          </div>
          <div className="mt-1 text-[12.5px] text-faint">
            de {allowance} en {year} ·{' '}
            <Link to="/ajustes#vacaciones" className="underline-offset-4 hover:text-muted hover:underline">
              cambiar
            </Link>
          </div>
        </div>
        {c.possible > 0 && (
          <div className="text-[12.5px] text-muted">
            Si confirmas las posibles: <span className="font-medium text-ink tabular-nums">{c.leftIfAll < 0 ? `te pasas ${-c.leftIfAll}` : `te quedan ${c.leftIfAll}`}</span>
          </div>
        )}
      </div>
      <div className="mt-4 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-sunken">
        {seg(c.enjoyed, 'confirmada', 'opacity-60')}
        {seg(c.confirmed, 'confirmada')}
        {seg(c.requested, 'pedida')}
        {seg(c.possible, 'posible')}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <Swatch color={color} status="confirmada" className="opacity-60" /> Disfrutados <b className="font-medium text-ink tabular-nums">{c.enjoyed}</b>
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch color={color} status="confirmada" /> Confirmados <b className="font-medium text-ink tabular-nums">{c.confirmed}</b>
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch color={color} status="pedida" /> Pedidos <b className="font-medium text-ink tabular-nums">{c.requested}</b>
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch color={color} status="posible" /> Posibles <b className="font-medium text-ink tabular-nums">{c.possible}</b>
        </span>
      </div>
    </section>
  )
}

function PeriodRow({ v, person, holidays, year, onOpen }) {
  const n = workdaysIn(v, holidays, year)
  const Tag = onOpen ? 'button' : 'div'
  return (
    <Tag {...(onOpen ? { type: 'button', onClick: onOpen } : {})} className={cx('flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left', onOpen && 'hover:bg-hover')}>
      <Swatch color={person.color} status={v.status} />
      <span className="min-w-0 flex-1">
        <span className="text-[14.5px] font-medium">{shortRange(v.start, v.end)}</span>
        {v.note && <span className="ml-2 text-[13px] text-muted">{v.note}</span>}
      </span>
      <span className="shrink-0 text-[12px] text-muted">{statusName(v.status)}</span>
      <span className="w-14 shrink-0 text-right text-[12.5px] tabular-nums text-faint">{plural(n, 'día', 'días')}</span>
    </Tag>
  )
}

export function VacationsPage() {
  const s = useStore()
  const user = s.user
  const [params, setParams] = useSearchParams()
  const focusKey = params.get('d')
  const [year, setYear] = useState(() => (focusKey ? Number(focusKey.slice(0, 4)) : new Date().getFullYear()))
  const [sel, setSel] = useState(null) // { start, end } mientras se marca un periodo
  const [draft, setDraft] = useState(null)
  const [hiddenPeople, setHiddenPeople] = useState(() => new Set())
  const today = dayKey(new Date())
  const st = vacSettings(user)
  const holidays = useFestivos(st.region, [year - 1, year, year + 1])
  const scrolled = useRef(false)

  useEffect(() => {
    s.loadTeams()
    s.loadVacations()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Enlace desde un aviso o desde Horas: ir a ese mes
  useEffect(() => {
    if (!focusKey || scrolled.current) return
    scrolled.current = true
    setTimeout(() => document.getElementById(`mes-${focusKey.slice(0, 7)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
  }, [focusKey])

  useEffect(() => {
    if (!sel) return
    const onKey = (e) => e.key === 'Escape' && setSel(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sel])

  const people = useMemo(() => peopleOf(user, s.teams), [user, s.teams])
  const visiblePeople = people.filter((p) => !hiddenPeople.has(p.id))
  const all = useMemo(() => Object.values(s.vacations), [s.vacations])
  const hiddenKey = [...hiddenPeople].join(',')
  const byDay = useMemo(() => indexByDay(all.filter((v) => !hiddenPeople.has(v.user_id))), [all, hiddenKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const allByDay = useMemo(() => indexByDay(all), [all])
  const inYear = (v) => v.start.slice(0, 4) <= String(year) && v.end.slice(0, 4) >= String(year)
  const mine = all.filter((v) => v.user_id === user.id)
  const count = yearCount(mine.filter(inYear), holidays, year, allowanceFor(st, year), today)
  const clashes = overlaps(Object.fromEntries(Object.entries(allByDay).filter(([k]) => k.startsWith(String(year))))).filter((o) => [...o.users].every((id) => visiblePeople.some((p) => p.id === id)))
  const mates = people.filter((p) => !p.me)

  if (!vacationsOn(user)) return <Navigate to="/ajustes#modulos" replace />

  const ownAt = (k) => (allByDay[k] || []).find((v) => v.user_id === user.id)
  const onDay = (k) => {
    if (sel) {
      const [a, b] = sel.start <= k ? [sel.start, k] : [k, sel.start]
      setSel(null)
      setDraft({ start: a, end: b, status: 'posible', note: '' })
      return
    }
    const own = ownAt(k)
    if (own) return setDraft({ ...own })
    setSel({ start: k, end: k })
  }
  const togglePerson = (id) =>
    setHiddenPeople((h) => {
      const n = new Set(h)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-8 lg:pt-12">
      <div className="entra flex flex-wrap items-center gap-2">
        <h1 className="flex flex-1 items-center gap-2.5 text-[30px] font-semibold tracking-[-0.03em]">
          <TreePalm size={26} className="text-accent" /> Vacaciones
        </h1>
        <div className="flex items-center gap-1">
          <IconButton label="Año anterior" onClick={() => setYear(year - 1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <button onClick={() => setYear(new Date().getFullYear())} className="min-w-[3.5rem] rounded-lg px-1 text-[16px] font-semibold tabular-nums hover:bg-hover" title="Volver a este año">
            {year}
          </button>
          <IconButton label="Año siguiente" onClick={() => setYear(year + 1)}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
        <Button variant="primary" onClick={() => setDraft({ start: today < `${year}-01-01` || today > `${year}-12-31` ? `${year}-01-01` : today, end: today < `${year}-01-01` || today > `${year}-12-31` ? `${year}-01-01` : today, status: 'posible', note: '' })}>
          <Plus size={16} /> Añadir
        </Button>
      </div>

      <Counter c={count} allowance={allowanceFor(st, year)} year={year} color={st.color} />

      {/* Leyenda: personas (tocar para ocultar) y estados */}
      <div className="entra mt-4 flex flex-wrap items-center gap-2" style={{ '--entra-espera': '100ms' }}>
        {people.map((p) => (
          <button
            key={p.id}
            onClick={() => people.length > 1 && togglePerson(p.id)}
            className={cx('flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[13px] transition-opacity', hiddenPeople.has(p.id) && 'opacity-40')}
            title={people.length > 1 ? (hiddenPeople.has(p.id) ? 'Mostrar' : 'Ocultar') : undefined}
          >
            <span className="size-2.5 rounded-full" style={{ background: personHex(p.color) }} />
            {p.name}
          </button>
        ))}
        {mates.length === 0 && (
          <Link to="/ajustes#equipo" className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] text-muted hover:text-ink">
            <Users size={14} /> Invita a tu equipo para ver sus vacaciones
          </Link>
        )}
        <span className="flex-1" />
        <span className="flex flex-wrap items-center gap-3 text-[12px] text-muted">
          {STATUSES.map((x) => (
            <span key={x.id} className="flex items-center gap-1.5">
              <Swatch color="gris" status={x.id} /> {x.name}
            </span>
          ))}
          {mates.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-[4px]" style={{ boxShadow: `inset 0 0 0 1.5px ${CLASH}` }} /> Coincidís
            </span>
          )}
        </span>
      </div>

      <div className="entra mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" style={{ '--entra-espera': '140ms' }} onMouseLeave={() => sel && setSel({ ...sel, end: sel.start })}>
        {Array.from({ length: 12 }, (_, m) => (
          <Month
            key={`${year}-${m}`}
            year={year}
            month={m}
            byDay={byDay}
            people={visiblePeople}
            holidays={holidays}
            today={today}
            sel={sel}
            focus={focusKey}
            onDay={onDay}
            onHover={(k) => sel && setSel({ ...sel, end: k })}
          />
        ))}
      </div>

      {clashes.length > 0 && (
        <Block title="Coincidencias" count={clashes.length} className="mt-6">
          {clashes.map((o) => (
            <div key={o.start} className="flex items-center gap-3 rounded-xl px-2.5 py-2">
              <span className="size-3 shrink-0 rounded-[4px]" style={{ boxShadow: `inset 0 0 0 1.5px ${CLASH}` }} />
              <span className="flex-1 text-[14.5px] font-medium">{shortRange(o.start, o.end)}</span>
              <span className="text-[13px] text-muted">{people.filter((p) => o.users.has(p.id)).map((p) => p.name).join(' y ')}</span>
            </div>
          ))}
        </Block>
      )}

      <Block title={`Tus vacaciones de ${year}`} count={mine.filter(inYear).length} className="mt-6">
        {mine.filter(inYear).length ? (
          mine
            .filter(inYear)
            .sort((a, b) => a.start.localeCompare(b.start))
            .map((v) => <PeriodRow key={v.id} v={v} person={people[0]} holidays={holidays} year={year} onOpen={() => setDraft({ ...v })} />)
        ) : (
          <p className="px-2.5 py-3 text-[13.5px] text-muted">Toca el primer día en el calendario y luego el último, o pulsa «Añadir».</p>
        )}
      </Block>

      {mates.map((p) => {
        const list = all.filter((v) => v.user_id === p.id && inYear(v)).sort((a, b) => a.start.localeCompare(b.start))
        return (
          <Block key={p.id} title={p.name} count={list.length} className="mt-4" right={<span className="size-2.5 rounded-full" style={{ background: personHex(p.color) }} />}>
            {list.length ? (
              list.map((v) => <PeriodRow key={v.id} v={v} person={p} holidays={holidays} year={year} />)
            ) : (
              <p className="px-2.5 py-3 text-[13.5px] text-muted">Sin vacaciones apuntadas en {year}.</p>
            )}
          </Block>
        )
      })}

      {/* Marcando un periodo: aviso fijo abajo */}
      {sel && (
        <div className="fixed inset-x-0 bottom-[max(16px,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface py-2 pl-4 pr-2 text-[14px] shadow-float">
            <span>
              Desde el <b className="font-semibold">{fmt(dateOf(sel.start), "d 'de' MMMM")}</b> · toca el último día
            </span>
            <Button size="sm" variant="ghost" onClick={() => setSel(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <Editor
        open={!!draft}
        draft={draft}
        onClose={() => {
          setDraft(null)
          if (focusKey) setParams({}, { replace: true })
        }}
        people={people}
        byDay={allByDay}
        holidays={holidays}
      />
    </div>
  )
}
