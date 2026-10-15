import { useMemo, useState } from 'react'
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { addDays, addMonths, endOfMonth, endOfWeek, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { haptic } from '../lib/layers'
import { allDayIso, fmt } from '../lib/dates'
import { dueInfo } from '../lib/cards'
import { Button, cx, IconButton, useIsMobile } from '../components/ui'
import { CardRow } from '../components/CardRow'

const key = (d) => fmt(d, 'yyyy-MM-dd')

function Chip({ card, onOpen, overlay }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: card.id, disabled: overlay })
  return (
    <button
      data-c="rojo"
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={(e) => (e.stopPropagation(), onOpen?.(card))}
      className={cx(
        'touch-drag flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-[3px] text-left text-[12px] leading-tight transition-colors [touch-action:manipulation]',
        card.done ? 'text-faint line-through' : dueInfo(card)?.overdue ? 'lbl text-danger' : 'bg-accent-soft text-ink hover:brightness-95',
        isDragging && 'opacity-30',
        overlay && 'shadow-float bg-surface',
      )}
    >
      {!card.due_all_day && <span className="shrink-0 tabular-nums text-muted">{fmt(new Date(card.due_at), 'HH:mm')}</span>}
      <span className="truncate">{card.title || 'Sin título'}</span>
    </button>
  )
}

function Day({ day, month, cards, onOpen, onAdd, compact, selected, onSelect }) {
  const { setNodeRef, isOver } = useDroppable({ id: key(day) })
  const today = isSameDay(day, new Date())
  return (
    <div
      ref={setNodeRef}
      onDoubleClick={() => !compact && onAdd(day)}
      onClick={() => compact && onSelect(day)}
      className={cx(
        'group relative flex flex-col gap-0.5 border-b border-r border-line p-1 transition-colors',
        compact ? 'min-h-[54px] items-center' : 'min-h-[118px]',
        !isSameMonth(day, month) && 'bg-[color-mix(in_oklab,var(--sunken)_50%,transparent)]',
        (isOver || (compact && selected)) && 'bg-accent-soft',
      )}
    >
      <div className="flex items-center justify-between px-1 pb-0.5">
        <span
          className={cx(
            'grid size-6 place-items-center rounded-full text-[12.5px] tabular-nums',
            today ? 'bg-accent font-semibold text-accent-ink' : isSameMonth(day, month) ? 'text-ink' : 'text-faint',
          )}
        >
          {fmt(day, 'd')}
        </span>
        {!compact && (
          <button onClick={() => onAdd(day)} className="hidden text-[16px] leading-none text-faint hover:text-ink group-hover:block" aria-label="Añadir">
            +
          </button>
        )}
      </div>
      {compact && cards.length > 0 && (
        <div className="flex gap-[3px]">
          {cards.slice(0, 3).map((c) => (
            <span key={c.id} className={cx('size-[5px] rounded-full', c.done ? 'bg-line' : dueInfo(c)?.overdue ? 'bg-danger' : 'bg-accent')} />
          ))}
        </div>
      )}
      {!compact && cards.slice(0, 4).map((c) => (
        <Chip key={c.id} card={c} onOpen={onOpen} />
      ))}
      {!compact && cards.length > 4 && <span className="px-1.5 text-[11.5px] text-faint">+{cards.length - 4} más</span>}
    </div>
  )
}

export function CalendarView({ project, cards, onOpen }) {
  const s = useStore()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  // En el móvil no caben los títulos en cada día: puntos en la rejilla y,
  // debajo, la agenda del día elegido (como el calendario del sistema)
  const compact = useIsMobile()
  const [selected, setSelected] = useState(() => new Date())
  const [dir, setDir] = useState(0)
  const [active, setActive] = useState(null)
  const sensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 5 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }))

  const days = useMemo(() => {
    const out = []
    let d = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    while (d <= end) {
      out.push(d)
      d = addDays(d, 1)
    }
    return out
  }, [month])

  const byDay = useMemo(() => {
    const m = {}
    for (const c of cards) if (c.due_at) (m[key(new Date(c.due_at))] ||= []).push(c)
    for (const k in m) m[k].sort((a, b) => Number(a.done) - Number(b.done) || (a.due_all_day ? 0 : 1) - (b.due_all_day ? 0 : 1) || a.due_at.localeCompare(b.due_at))
    return m
  }, [cards])
  const undated = cards.filter((c) => !c.due_at && !c.done).length

  const go = (n) => {
    setDir(n)
    setMonth((m) => (n > 0 ? addMonths(m, 1) : subMonths(m, 1)))
  }

  const onDragEnd = ({ active, over }) => {
    setActive(null)
    if (!over) return
    const card = s.cards[active.id]
    const [y, mo, d] = over.id.split('-').map(Number)
    const target = new Date(y, mo - 1, d)
    if (card.due_all_day || !card.due_at) s.updateCard(card.id, { due_at: allDayIso(target), due_all_day: true })
    else {
      const old = new Date(card.due_at)
      target.setHours(old.getHours(), old.getMinutes())
      s.updateCard(card.id, { due_at: target.toISOString() })
    }
  }

  const add = async (day) => {
    const c = await s.createCard({ project_id: project.id, title: '', due_at: allDayIso(day), due_all_day: true })
    if (c) onOpen(c)
  }

  return (
    <div className="px-4 pb-16 sm:px-8">
      <div className="mb-3 flex items-center gap-1">
        <h3 className="mr-2 text-[17px] font-semibold capitalize tracking-[-0.01em]">{fmt(month, 'MMMM yyyy')}</h3>
        <IconButton label="Mes anterior" onClick={() => go(-1)}>
          <ChevronLeft size={17} />
        </IconButton>
        <IconButton label="Mes siguiente" onClick={() => go(1)}>
          <ChevronRight size={17} />
        </IconButton>
        <Button size="sm" variant="outline" onClick={() => (setDir(0), setMonth(startOfMonth(new Date())))}>
          Hoy
        </Button>
        <span className="flex-1" />
        {undated > 0 && <span className="text-[12.5px] text-faint">{undated} sin fecha</span>}
      </div>
      <DndContext sensors={sensors} onDragStart={(e) => (haptic(10), setActive(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
        <div className="overflow-hidden rounded-2xl border-l border-t border-line bg-surface">
          <div className="grid grid-cols-7 border-b border-line">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
              <div key={d} className="border-r border-line px-1 py-1.5 text-center text-[11.5px] font-medium uppercase tracking-wide text-faint sm:px-2 sm:text-left">
                {d}
              </div>
            ))}
          </div>
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={key(month)}
              custom={dir}
              initial={{ opacity: 0, transform: `translateX(${dir * 24}px)` }}
              animate={{ opacity: 1, transform: 'translateX(0px)' }}
              exit={{ opacity: 0, transform: `translateX(${dir * -24}px)` }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-7"
            >
              {days.map((d) => (
                <Day
                  key={key(d)}
                  day={d}
                  month={month}
                  cards={byDay[key(d)] || []}
                  onOpen={onOpen}
                  onAdd={add}
                  compact={compact}
                  selected={isSameDay(d, selected)}
                  onSelect={setSelected}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
        {compact && (
          <div key={key(selected)} className="entra mt-5" style={{ '--entra-dura': '220ms' }}>
            <div className="mb-1 flex items-center px-1">
              <h4 className="flex-1 text-[14px] font-semibold first-letter:uppercase">{fmt(selected, "EEEE d 'de' MMMM")}</h4>
              <Button size="sm" variant="ghost" onClick={() => add(selected)}>
                <Plus size={15} /> Añadir
              </Button>
            </div>
            {(byDay[key(selected)] || []).map((c) => (
              <CardRow key={c.id} card={c} onOpen={onOpen} />
            ))}
            {!(byDay[key(selected)] || []).length && <p className="px-1 py-3 text-[14px] text-faint">Nada para este día.</p>}
          </div>
        )}
        <DragOverlay dropAnimation={null}>{active ? <div className="w-36"><Chip card={s.cards[active]} overlay /></div> : null}</DragOverlay>
      </DndContext>
    </div>
  )
}
