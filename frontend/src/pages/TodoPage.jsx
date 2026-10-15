import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { addDays, endOfDay, isBefore, isToday, startOfDay } from 'date-fns'
import { ChevronRight, CircleCheckBig, Plus, SlidersHorizontal } from 'lucide-react'
import { useStore } from '../lib/store'
import { fmt } from '../lib/dates'
import { CardRow } from '../components/CardRow'
import { cx, Divider, MenuItem, MenuLabel, Popover, spring, usePopover } from '../components/ui'

function greeting(name) {
  const h = new Date().getHours()
  const first = (name || '').split(' ')[0]
  if (h < 6) return `Buenas noches, ${first}`
  if (h < 14) return `Buenos días, ${first}`
  if (h < 21) return `Buenas tardes, ${first}`
  return `Buenas noches, ${first}`
}

function Section({ title, tone, cards, onOpen, collapsed: initial = false }) {
  const [collapsed, setCollapsed] = useState(initial)
  if (!cards.length) return null
  return (
    <motion.section layout="position" className="mb-5">
      <button onClick={() => setCollapsed((v) => !v)} className="mb-0.5 flex h-8 items-center gap-1.5 px-1 text-[13px] font-medium">
        <motion.span animate={{ rotate: collapsed ? 0 : 90 }} transition={spring} className="text-faint">
          <ChevronRight size={14} />
        </motion.span>
        <span className={tone}>{title}</span>
        <span className="ml-0.5 tabular-nums text-faint">{cards.length}</span>
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
            <AnimatePresence initial={false}>
              {cards.map((c) => (
                <CardRow key={c.id} card={c} onOpen={onOpen} showProject />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

export function TodoPage() {
  const s = useStore()
  const [params, setParams] = useSearchParams()
  const pop = usePopover()
  const [draft, setDraft] = useState('')
  const selected = s.user?.todo_projects // null = todos

  const projects = useMemo(() => Object.values(s.projects).filter((p) => !p.archived).sort((a, b) => a.position - b.position), [s.projects])

  const groups = useMemo(() => {
    const now = new Date()
    const today0 = startOfDay(now)
    const weekEnd = endOfDay(addDays(now, 7))
    const list = Object.values(s.cards).filter(
      (c) =>
        c.in_todo &&
        !s.hidden[c.id] &&
        (c.project_id === null || !s.projects[c.project_id]?.archived) &&
        (selected == null || selected.includes(c.project_id ?? 0)),
    )
    const out = { overdue: [], today: [], week: [], later: [], nodate: [], doneToday: [] }
    for (const c of list) {
      if (c.done) {
        if (c.completed_at && isToday(new Date(c.completed_at))) out.doneToday.push(c)
        continue
      }
      if (!c.due_at) out.nodate.push(c)
      else {
        const d = new Date(c.due_at)
        if (isBefore(d, today0)) out.overdue.push(c)
        else if (isToday(d)) out.today.push(c)
        else if (isBefore(d, weekEnd)) out.week.push(c)
        else out.later.push(c)
      }
    }
    const byDue = (a, b) => (a.due_at || '').localeCompare(b.due_at || '') || a.position - b.position
    for (const k in out) out[k].sort(k === 'nodate' ? (a, b) => (b.updated_at || '').localeCompare(a.updated_at || '') : byDue)
    out.doneToday.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''))
    return out
  }, [s.cards, s.hidden, s.projects, selected])

  const pending = groups.overdue.length + groups.today.length + groups.week.length + groups.later.length + groups.nodate.length
  const openCard = (c) => {
    const p = new URLSearchParams(params)
    p.set('card', c.id)
    setParams(p)
  }

  const toggleProject = (pid) => {
    const all = [0, ...projects.map((p) => p.id)]
    const cur = selected == null ? all : selected
    const next = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid]
    if (next.length === all.length) s.updateMe({ clear_todo_projects: true })
    else s.updateMe({ todo_projects: next })
  }

  const add = async (e) => {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setDraft('')
    await s.createCard({ title, project_id: null, in_todo: true })
  }

  const todayDone = groups.doneToday.length
  const todayTotal = todayDone + groups.today.length + groups.overdue.length

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-14 sm:px-8 lg:pt-12">
      <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-[13px] font-medium text-faint first-letter:uppercase">
        {fmt(new Date(), "EEEE, d 'de' MMMM")}
      </motion.p>
      <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }} className="mt-1 text-[30px] font-semibold leading-tight tracking-[-0.03em]">
        {greeting(s.user?.display_name)}
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-1.5 text-[15px] text-muted">
        {pending === 0
          ? 'Nada pendiente en tu lista. Disfrútalo.'
          : todayTotal > 0
            ? `${todayDone} de ${todayTotal} para hoy hechas · ${pending} pendientes en total`
            : `${pending} pendientes, ninguna para hoy`}
      </motion.p>

      <div className="mt-6 flex items-center gap-2">
        <form onSubmit={add} className="flex h-11 flex-1 items-center gap-3 rounded-xl border border-line bg-surface px-3.5 shadow-soft transition-[border-color,box-shadow] focus-within:border-[color-mix(in_oklab,var(--accent)_50%,var(--line))] focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_14%,transparent)]">
          <Plus size={17} className="text-faint" />
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Añadir a To Do…" className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
        </form>
        <button
          onClick={pop.toggle}
          className={cx('grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-surface shadow-soft transition-colors hover:text-ink', selected != null ? 'text-accent' : 'text-muted')}
          aria-label="Elegir proyectos"
        >
          <SlidersHorizontal size={17} />
        </button>
      </div>
      {selected != null && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[{ id: 0, icon: '📥', name: 'Bandeja' }, ...projects]
            .filter((p) => selected.includes(p.id))
            .map((p) => (
              <span key={p.id} className="rounded-md bg-sunken px-2 py-0.5 text-[12.5px] text-muted">
                {p.icon} {p.name}
              </span>
            ))}
        </div>
      )}

      <div className="mt-6">
        <Section title="Atrasadas" tone="text-danger" cards={groups.overdue} onOpen={openCard} />
        <Section title="Hoy" tone="text-accent" cards={groups.today} onOpen={openCard} />
        <Section title="Próximos 7 días" cards={groups.week} onOpen={openCard} />
        <Section title="Más adelante" cards={groups.later} onOpen={openCard} />
        <Section title="Sin fecha" tone="text-muted" cards={groups.nodate} onOpen={openCard} />
        <Section title="Terminadas hoy" tone="text-faint" cards={groups.doneToday} onOpen={openCard} collapsed />
        {pending === 0 && todayDone === 0 && (
          <div className="mt-10 text-center">
            <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
              <CircleCheckBig size={22} />
            </div>
            <p className="text-[15px] font-medium">Tu To Do está vacío</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Activa «En To Do» en cualquier tarjeta de tus proyectos para traerla aquí, o añade algo arriba.</p>
          </div>
        )}
      </div>

      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={260} align="end">
        <MenuLabel>Mostrar tarjetas de</MenuLabel>
        <MenuItem active={selected == null || selected.includes(0)} onClick={() => toggleProject(0)}>
          📥 Bandeja
        </MenuItem>
        {projects.map((p) => (
          <MenuItem key={p.id} active={selected == null || selected.includes(p.id)} onClick={() => toggleProject(p.id)}>
            <span className="mr-1">{p.icon}</span> {p.name}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => s.updateMe({ clear_todo_projects: true })}>Todos los proyectos</MenuItem>
      </Popover>
    </div>
  )
}
