import { useEffect, useMemo, useState } from 'react'
import { addDays, addWeeks, differenceInCalendarDays, endOfWeek, isWithinInterval, startOfWeek } from 'date-fns'
import { Archive, CalendarRange, ChevronLeft, ChevronRight, CircleCheckBig, Hourglass, PauseCircle, Plus, Undo2 } from 'lucide-react'
import { undoToast, useStore } from '../lib/store'
import { useCardNav } from '../lib/nav'
import { get } from '../lib/api'
import { fmt } from '../lib/dates'
import { CardRow } from '../components/CardRow'
import { Button, cx, IconButton } from '../components/ui'
import { isInactive } from '../lib/cards'

const fmtMin = (m) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`)

function Stat({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 shadow-soft">
      <div className={cx('flex items-center gap-1.5 text-[12.5px] font-medium', tone || 'text-muted')}>
        <Icon size={14} /> {label}
      </div>
      <div className="mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.02em]">{value}</div>
      {sub && <div className="text-[12px] text-faint">{sub}</div>}
    </div>
  )
}

export function WeekPage() {
  const s = useStore()
  const { open } = useCardNav()
  const [offset, setOffset] = useState(0)
  const start = startOfWeek(addWeeks(new Date(), offset), { weekStartsOn: 1 })
  const end = endOfWeek(start, { weekStartsOn: 1 })
  const range = { start, end }
  const [postponed, setPostponed] = useState([])

  useEffect(() => {
    let alive = true
    get(`/cards/events/postpones?start=${fmt(start, 'yyyy-MM-dd')}&end=${fmt(end, 'yyyy-MM-dd')}`)
      .then((r) => alive && setPostponed(r))
      .catch(() => alive && setPostponed([]))
    return () => {
      alive = false
    }
  }, [offset]) // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => {
    const cards = Object.values(s.cards).filter((c) => !s.hidden[c.id])
    const inWeek = (iso) => iso && isWithinInterval(new Date(iso), range)
    const done = cards.filter((c) => c.done && inWeek(c.completed_at))
    const created = cards.filter((c) => inWeek(c.created_at))
    const perDay = Array.from({ length: 7 }, (_, i) => done.filter((c) => differenceInCalendarDays(new Date(c.completed_at), start) === i).length)
    const byProject = {}
    for (const c of done) (byProject[c.project_id ?? 0] ||= []).push(c)
    const now = new Date()
    // Atascadas: pendientes, sin tocar en 7 días y en un estado que no es el
    // inicial (empezadas y paradas)
    const stuck = offset === 0
      ? cards.filter((c) => {
          if (c.done || !c.project_id || s.projects[c.project_id]?.archived || isInactive(s, c)) return false
          if (differenceInCalendarDays(now, new Date(c.updated_at)) < 7) return false
          const status = Object.values(s.groups).find((g) => g.project_id === c.project_id && g.is_status)
          if (!status) return false
          const first = Object.values(s.labels).filter((l) => l.group_id === status.id && !l.marks_done).sort((a, b) => a.position - b.position)[0]
          return c.label_ids.some((id) => s.labels[id]?.group_id === status.id && id !== first?.id)
        })
      : []
    // Proyectos quietos: activos, con algo pendiente y nada tocado en 14 días
    const quiet = offset === 0
      ? Object.values(s.projects).filter((p) => {
          if (p.archived) return false
          const own = cards.filter((c) => c.project_id === p.id)
          if (!own.some((c) => !c.done)) return false
          const last = Math.max(new Date(p.updated_at).getTime(), ...own.map((c) => new Date(c.updated_at).getTime()))
          return differenceInCalendarDays(now, new Date(last)) >= 14
        })
      : []
    const estimate = done.reduce((a, c) => a + (c.estimate_minutes || 0), 0)
    return { done, created, perDay, byProject, stuck, quiet, estimate }
  }, [s.cards, s.hidden, s.projects, s.groups, s.labels, offset]) // eslint-disable-line react-hooks/exhaustive-deps

  // Aplazadas esta semana (una vez por tarjeta) y las reincidentes
  const postponedCards = useMemo(() => {
    const ids = [...new Set(postponed.map((p) => p.card_id))]
    return ids.map((id) => s.cards[id]).filter(Boolean)
  }, [postponed, s.cards])
  const chronic = Object.values(s.cards).filter((c) => !c.done && (c.postpone_count || 0) >= 3).sort((a, b) => b.postpone_count - a.postpone_count)
  const maxDay = Math.max(1, ...data.perDay)
  const label = offset === 0 ? 'Esta semana' : offset === -1 ? 'La semana pasada' : `Semana del ${fmt(start, "d 'de' MMMM")}`

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-8 lg:pt-12">
      <div className="flex items-center gap-1">
        <h1 className="flex flex-1 items-center gap-2.5 text-[30px] font-semibold tracking-[-0.03em]">
          <CalendarRange size={26} className="text-accent" /> Semana
        </h1>
        <IconButton label="Semana anterior" onClick={() => setOffset((o) => o - 1)}>
          <ChevronLeft size={18} />
        </IconButton>
        <IconButton label="Semana siguiente" onClick={() => setOffset((o) => Math.min(0, o + 1))} className={cx(offset === 0 && 'pointer-events-none opacity-30')}>
          <ChevronRight size={18} />
        </IconButton>
      </div>
      <p className="mt-1.5 text-[15px] text-muted">
        {label} · {fmt(start, 'd MMM')} – {fmt(end, 'd MMM')}
      </p>

      <div key={offset} className="entra" style={{ '--entra-dura': '240ms' }}>
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat icon={CircleCheckBig} label="Terminadas" value={data.done.length} sub={data.estimate ? `${fmtMin(data.estimate)} estimadas` : null} tone="text-accent" />
          <Stat icon={Plus} label="Nuevas" value={data.created.length} />
          <Stat icon={Undo2} label="Aplazadas" value={postponedCards.length} tone={postponedCards.length ? 'text-[#a67c12]' : undefined} />
          <Stat icon={PauseCircle} label="Atascadas" value={offset === 0 ? data.stuck.length : '—'} sub={offset === 0 ? '7+ días quietas' : 'solo la actual'} tone={data.stuck.length ? 'text-danger' : undefined} />
        </div>

        {/* Terminadas por día */}
        <div className="mt-5 rounded-2xl border border-line bg-surface p-4 shadow-soft">
          <div className="flex items-end gap-2">
            {data.perDay.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[11.5px] tabular-nums text-faint">{n || ''}</span>
                <div className="flex h-20 w-full items-end">
                  <div className="w-full origin-bottom rounded-md bg-accent" style={{ height: `${(n / maxDay) * 100}%`, minHeight: n ? 4 : 0, opacity: differenceInCalendarDays(addDays(start, i), new Date()) > 0 ? 0.25 : 1 }} />
                </div>
                <span className="text-[11.5px] text-muted">{['L', 'M', 'X', 'J', 'V', 'S', 'D'][i]}</span>
              </div>
            ))}
          </div>
        </div>

        {chronic.length > 0 && offset === 0 && (
          <div className="mt-5 rounded-2xl border border-[color-mix(in_oklab,#c99a1c_35%,var(--line))] bg-[color-mix(in_oklab,#c99a1c_10%,var(--surface))] p-4">
            <div className="text-[14px] font-medium">Llevas tiempo aplazando esto</div>
            <p className="mt-0.5 text-[13px] text-muted">¿Sigue siendo importante? Hazla, pártela en algo más pequeño, cámbiale la fecha con honestidad o bórrala.</p>
            <div className="mt-2">
              {chronic.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <CardRow card={c} onOpen={open} showProject />
                  </div>
                  <span className="shrink-0 rounded-md bg-surface px-2 py-0.5 text-[12px] tabular-nums text-[#a67c12]">×{c.postpone_count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Object.keys(data.byProject).length > 0 && (
          <section className="mt-7">
            <h2 className="mb-1 px-1 text-[12.5px] font-medium uppercase tracking-wide text-accent">Terminado</h2>
            {Object.entries(data.byProject).map(([pid, list]) => {
              const p = s.projects[pid]
              return (
                <div key={pid} className="mb-3">
                  <div className="px-1 pb-0.5 pt-1 text-[13px] font-medium text-muted">
                    {p ? `${p.icon} ${p.name}` : '📥 Bandeja'} · {list.length}
                  </div>
                  {list.map((c) => (
                    <CardRow key={c.id} card={c} onOpen={open} />
                  ))}
                </div>
              )
            })}
          </section>
        )}

        {postponedCards.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-1 px-1 text-[12.5px] font-medium uppercase tracking-wide text-[#a67c12]">Aplazado</h2>
            {postponedCards.map((c) => (
              <CardRow key={c.id} card={c} onOpen={open} showProject />
            ))}
          </section>
        )}

        {data.stuck.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-1 flex items-center gap-1.5 px-1 text-[12.5px] font-medium uppercase tracking-wide text-danger">
              <Hourglass size={13} /> Atascado
            </h2>
            {data.stuck.map((c) => (
              <CardRow key={c.id} card={c} onOpen={open} showProject />
            ))}
          </section>
        )}

        {data.quiet.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 px-1 text-[12.5px] font-medium uppercase tracking-wide text-muted">Proyectos sin movimiento (14+ días)</h2>
            {data.quiet.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-hover">
                <span className="text-[18px]">{p.icon}</span>
                <span className="min-w-0 flex-1 truncate text-[14.5px]">{p.name}</span>
                <Button size="sm" variant="ghost" onClick={() => (s.updateProject(p.id, { archived: true }), undoToast(`«${p.name}» aparcado`, () => s.updateProject(p.id, { archived: false })))}>
                  <Archive size={14} /> Aparcar
                </Button>
              </div>
            ))}
          </section>
        )}

        {data.done.length === 0 && data.created.length === 0 && postponedCards.length === 0 && (
          <p className="mt-10 text-center text-[14px] text-faint">Nada registrado esta semana.</p>
        )}
      </div>
    </div>
  )
}
