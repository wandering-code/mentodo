import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { endOfDay, isBefore, isToday, startOfDay } from 'date-fns'
import { ChevronRight, Coffee, Lock, Sun, Timer } from 'lucide-react'
import { useStore } from '../lib/store'
import { useCardNav } from '../lib/nav'
import { fmt } from '../lib/dates'
import { linkBadges } from '../lib/links'
import { deadlineOf } from '../lib/deadline'
import { CardRow } from '../components/CardRow'
import { Collapse, cx } from '../components/ui'

const AVAIL = [2, 4, 6, 8]
const QUICK = [10, 30, 60]
const fmtMin = (m) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`)

/* Rango de prioridad de una tarjeta: posición de su etiqueta en el grupo
   «Prioridad» de su proyecto (0 = la más alta). Sin grupo o sin etiqueta,
   en medio. */
function priorityRank(s, card) {
  const groups = Object.values(s.groups).filter((g) => g.project_id === card.project_id && /prioridad|priority/i.test(g.name))
  for (const g of groups) {
    const labels = Object.values(s.labels).filter((l) => l.group_id === g.id).sort((a, b) => a.position - b.position)
    const i = labels.findIndex((l) => card.label_ids.includes(l.id))
    if (i >= 0) return i
    return labels.length ? (labels.length - 1) / 2 : 1
  }
  return 1
}

function readAvail(userId) {
  try {
    const v = JSON.parse(localStorage.getItem(`mentodo:avail:${userId}`) || 'null')
    return v && v.day === fmt(new Date(), 'yyyy-MM-dd') ? v.hours : null
  } catch {
    return null
  }
}

export function TodayPage() {
  const s = useStore()
  const { open } = useCardNav()
  const userId = s.user?.id
  // Planificar el tiempo se puede apagar en Ajustes → Hoy
  const timeOn = s.user?.prefs?.today_time !== false
  const [availRaw, setAvail] = useState(() => readAvail(userId))
  const [quickRaw, setQuick] = useState(null)
  const avail = timeOn ? availRaw : null
  const quick = timeOn ? quickRaw : null
  const [showDone, setShowDone] = useState(false)

  const chooseAvail = (h) => {
    const v = avail === h ? null : h
    setAvail(v)
    try {
      localStorage.setItem(`mentodo:avail:${userId}`, JSON.stringify({ day: fmt(new Date(), 'yyyy-MM-dd'), hours: v }))
    } catch {}
  }

  const plan = useMemo(() => {
    const today0 = startOfDay(new Date())
    const today1 = endOfDay(new Date())
    const active = (c) => !s.hidden[c.id] && (c.project_id === null || !s.projects[c.project_id]?.archived)
    const doneToday = []
    const items = []
    for (const c of Object.values(s.cards)) {
      if (!active(c)) continue
      if (c.done) {
        if (c.completed_at && isToday(new Date(c.completed_at))) doneToday.push(c)
        continue
      }
      const dl = deadlineOf(s, c)
      const due = dl ? new Date(dl.at) : null
      const overdue = due && isBefore(due, today0)
      const dueToday = due && !overdue && !isBefore(today1, due)
      const remindToday = c.remind_at && isToday(new Date(c.remind_at))
      const flagged = c.in_todo && !due
      if (!overdue && !dueToday && !remindToday && !flagged) continue
      items.push({ card: c, due: dl?.at || '9', overdue, rank: priorityRank(s, c), blocked: linkBadges(s, c.id).blocked, urgency: overdue ? 0 : dueToday || remindToday ? 1 : 2 })
    }
    items.sort((a, b) => a.rank - b.rank || a.urgency - b.urgency || a.due.localeCompare(b.due) || a.card.position - b.card.position)
    const ready = items.filter((x) => !x.blocked)
    const blocked = items.filter((x) => x.blocked)
    doneToday.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
    return { ready, blocked, doneToday }
  }, [s.cards, s.hidden, s.projects, s.groups, s.labels, s.links, s.fields])

  // Con «tengo X minutos», solo lo que cabe (y tiene estimación)
  const ready = quick ? plan.ready.filter((x) => x.card.estimate_minutes && x.card.estimate_minutes <= quick) : plan.ready
  const main = ready[0]
  const next = ready.slice(1, 4)
  const rest = ready.slice(4)

  // Tiempo: lo estimado frente a lo disponible (por orden, lo que no cabe)
  const planned = plan.ready.reduce((a, x) => a + (x.card.estimate_minutes || 0), 0)
  const availMin = avail ? avail * 60 : null
  const overflowIds = useMemo(() => {
    if (!availMin) return new Set()
    let acc = 0
    const out = new Set()
    for (const x of plan.ready) {
      acc += x.card.estimate_minutes || 0
      if (acc > availMin) out.add(x.card.id)
    }
    return out
  }, [plan.ready, availMin])
  const doneN = plan.doneToday.length
  const totalN = doneN + plan.ready.length + plan.blocked.length

  const rowList = (list) => (
    <AnimatePresence initial={false}>
      {list.map((x) => (
        <div key={x.card.id} className={cx('relative', overflowIds.has(x.card.id) && 'opacity-55')}>
          <CardRow card={x.card} onOpen={open} showProject />
          {overflowIds.has(x.card.id) && <span className="pointer-events-none absolute right-3 top-1 text-[11px] text-faint">no cabe hoy</span>}
        </div>
      ))}
    </AnimatePresence>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-8 lg:pt-12">
      <p className="entra text-[13px] font-medium text-faint first-letter:uppercase">{fmt(new Date(), "EEEE, d 'de' MMMM")}</p>
      <h1 className="entra mt-1 flex items-center gap-2.5 text-[30px] font-semibold tracking-[-0.03em]" style={{ '--entra-espera': '40ms' }}>
        <Sun size={26} className="text-accent" /> Hoy
      </h1>
      <p className="entra mt-1.5 text-[15px] text-muted" style={{ '--entra-espera': '80ms' }}>
        {totalN === 0
          ? 'Nada para hoy. Buen momento para adelantar algo o descansar.'
          : `${doneN} de ${totalN} hechas${planned ? ` · ${fmtMin(planned)} estimadas por delante` : ''}`}
      </p>

      {/* Tiempo disponible y «tengo X minutos» */}
      {timeOn && (
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <span className="mr-1 text-[13px] text-muted">Hoy tengo</span>
          {AVAIL.map((h) => (
            <button key={h} onClick={() => chooseAvail(h)} className={cx('h-8 rounded-lg px-2.5 text-[13px] tabular-nums transition-colors', avail === h ? 'bg-accent text-accent-ink' : 'bg-sunken text-muted hover:text-ink')}>
              {h} h
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Timer size={14} className="mr-0.5 text-faint" />
          <span className="mr-1 text-[13px] text-muted">Solo un rato:</span>
          {QUICK.map((m) => (
            <button key={m} onClick={() => setQuick((q) => (q === m ? null : m))} className={cx('h-8 rounded-lg px-2.5 text-[13px] tabular-nums transition-colors', quick === m ? 'bg-accent text-accent-ink' : 'bg-sunken text-muted hover:text-ink')}>
              {m < 60 ? `${m}′` : '1 h'}
            </button>
          ))}
        </div>
      </div>
      )}
      {availMin != null && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-sunken">
            <div
              className={cx('h-full origin-left rounded-full', planned > availMin ? 'bg-danger' : 'bg-accent')}
              style={{ transform: `scaleX(${Math.min(1, planned / availMin)})`, transition: 'transform .5s cubic-bezier(.32,.72,0,1)' }}
            />
          </div>
          <p className={cx('mt-1.5 text-[12.5px]', planned > availMin ? 'text-danger' : 'text-faint')}>
            {planned > availMin
              ? `Tienes ${fmtMin(planned)} de tareas para ${fmtMin(availMin)}: lo atenuado no cabe hoy.`
              : `${fmtMin(planned)} de ${fmtMin(availMin)}${planned < availMin ? ` · te sobran ${fmtMin(availMin - planned)}` : ''}`}
          </p>
        </div>
      )}

      {quick && ready.length === 0 && <p className="mt-8 text-center text-[14px] text-faint">Nada de {fmtMin(quick)} o menos con estimación. Pon estimaciones a tus tareas para usar esto.</p>}

      {main && (
        <section className="entra mt-7">
          <h2 className="mb-1 px-1 text-[12.5px] font-medium uppercase tracking-wide text-accent">Lo principal</h2>
          <div className={cx('rounded-2xl border border-[color-mix(in_oklab,var(--accent)_30%,var(--line))] bg-accent-soft p-1', overflowIds.has(main.card.id) && 'opacity-60')}>
            <CardRow card={main.card} onOpen={open} showProject />
          </div>
        </section>
      )}
      {next.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 px-1 text-[12.5px] font-medium uppercase tracking-wide text-muted">Después</h2>
          {rowList(next)}
        </section>
      )}
      {rest.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 flex items-center gap-1.5 px-1 text-[12.5px] font-medium uppercase tracking-wide text-faint">
            <Coffee size={13} /> Si sobra tiempo
          </h2>
          {rowList(rest)}
        </section>
      )}
      {plan.blocked.length > 0 && !quick && (
        <section className="mt-6">
          <h2 className="mb-1 flex items-center gap-1.5 px-1 text-[12.5px] font-medium uppercase tracking-wide text-danger">
            <Lock size={13} /> Esperando a otras
          </h2>
          {rowList(plan.blocked)}
        </section>
      )}
      {doneN > 0 && (
        <section className="mt-6">
          <button onClick={() => setShowDone((v) => !v)} className="mb-1 flex h-8 items-center gap-1.5 px-1 text-[12.5px] font-medium uppercase tracking-wide text-faint">
            <ChevronRight size={14} style={{ transform: `rotate(${showDone ? 90 : 0}deg)`, transition: 'transform .25s cubic-bezier(.32,.72,0,1)' }} />
            Hecho hoy · {doneN}
          </button>
          <Collapse open={showDone}>
            {plan.doneToday.map((c) => (
              <CardRow key={c.id} card={c} onOpen={open} showProject />
            ))}
          </Collapse>
        </section>
      )}
    </div>
  )
}
