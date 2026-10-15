import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlarmClock, CalendarDays, CircleCheckBig, Clock3, Folder, ListTodo, Maximize2, Minimize2, MoreHorizontal, Tag, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { projectGroups } from '../lib/cards'
import { humanDate, toDateTimeInput } from '../lib/dates'
import { Editor } from './Editor'
import { DatePicker, LabelPicker, ProjectPicker } from './Pickers'
import { Checkbox, cx, IconButton, LabelChip, MenuItem, Popover, softSpring, Toggle, useIsMobile, usePopover } from './ui'

export function CardPanel({ cardId, onClose }) {
  const card = useStore((s) => (cardId ? s.cards[cardId] : null))
  const mobile = useIsMobile()
  const [wide, setWide] = useState(() => localStorage.getItem('mentodo:wide') === '1')
  const open = !!card

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('[data-popover-open]')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const toggleWide = () =>
    setWide((w) => {
      try {
        localStorage.setItem('mentodo:wide', w ? '0' : '1')
      } catch {}
      return !w
    })

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="card" className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/20 sm:bg-black/15" onClick={onClose} />
          <motion.section
            initial={mobile ? { y: '100%' } : { x: 40, opacity: 0 }}
            animate={mobile ? { y: 0 } : { x: 0, opacity: 1 }}
            exit={mobile ? { y: '100%' } : { x: 40, opacity: 0 }}
            transition={softSpring}
            className={cx(
              'absolute flex flex-col bg-surface shadow-float',
              mobile ? 'inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),12px)] rounded-t-2xl border-t border-line' : 'inset-y-2 right-2 rounded-2xl border border-line',
              !mobile && (wide ? 'left-2 lg:left-[12vw]' : 'w-[min(620px,calc(100vw-16px))]'),
            )}
          >
            <CardBody card={card} onClose={onClose} mobile={mobile} wide={wide} onToggleWide={toggleWide} />
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function CardBody({ card, onClose, mobile, wide, onToggleWide }) {
  const s = useStore()
  const { updateCard, deleteCard } = s
  const project = card.project_id ? s.projects[card.project_id] : null
  const groups = useMemo(() => projectGroups(s, card.project_id), [s.groups, card.project_id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [title, setTitle] = useState(card.title)
  const titleRef = useRef(null)
  const more = usePopover()
  const move = usePopover()
  const date = usePopover()

  useEffect(() => {
    if (document.activeElement !== titleRef.current) setTitle(card.title)
  }, [card.title])

  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [title])

  // Tarjeta recién creada: el cursor va directo al título
  useEffect(() => {
    if (!card.title) setTimeout(() => titleRef.current?.focus(), 250)
  }, [card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTitle = () => title !== card.title && updateCard(card.id, { title })

  return (
    <>
      <header className="flex items-center gap-1 px-3 pt-3">
        <button onClick={move.toggle} className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted transition-colors hover:bg-hover hover:text-ink">
          <span>{project ? project.icon : '📥'}</span>
          <span className="truncate">{project ? project.name : 'Bandeja'}</span>
        </button>
        <div className="flex-1" />
        {!mobile && (
          <IconButton label={wide ? 'Reducir' : 'Ampliar'} onClick={onToggleWide}>
            {wide ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </IconButton>
        )}
        <IconButton label="Más" onClick={more.toggle}>
          <MoreHorizontal size={17} />
        </IconButton>
        <IconButton label="Cerrar" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cx('mx-auto px-5 pb-6 pt-3 sm:px-8', wide && 'max-w-3xl')}>
          <div className="flex items-start gap-3">
            <Checkbox checked={card.done} onChange={(done) => updateCard(card.id, { done })} size={24} className="mt-[7px]" />
            <textarea
              ref={titleRef}
              rows={1}
              value={title}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
              placeholder="Sin título"
              className={cx(
                'flex-1 resize-none overflow-hidden bg-transparent text-[22px] sm:text-[26px] font-semibold leading-[1.25] tracking-[-0.022em] outline-none placeholder:text-faint',
                card.done && 'text-muted',
              )}
            />
          </div>

          <div className="mt-5 flex flex-col gap-0.5 text-[14px]">
            {groups.map((g) => (
              <GroupRow key={g.id} group={g} card={card} />
            ))}
            {!project && (
              <Row icon={Folder} label="Proyecto">
                <button onClick={move.toggle} className="h-8 rounded-lg px-2 text-faint hover:bg-hover">
                  Elegir proyecto…
                </button>
              </Row>
            )}
            <Row icon={CalendarDays} label="Fecha">
              <button
                onClick={date.toggle}
                className={cx('h-8 rounded-lg px-2 transition-colors hover:bg-hover', card.due_at ? 'text-ink' : 'text-faint')}
              >
                {card.due_at ? humanDate(card.due_at, card.due_all_day) : 'Sin fecha'}
              </button>
            </Row>
            <Row icon={AlarmClock} label="Recordarme">
              <ReminderInput card={card} />
            </Row>
            <Row icon={Clock3} label="Estimación">
              <EstimateInput card={card} />
            </Row>
            <Row icon={ListTodo} label="En To Do">
              <div className="flex h-8 items-center px-2">
                <Toggle checked={card.in_todo} onChange={(in_todo) => updateCard(card.id, { in_todo })} label="Mostrar en To Do general" />
              </div>
            </Row>
          </div>

          <div className="my-5 h-px bg-line" />
          <Editor cardId={card.id} content={card.content} onSave={(content) => updateCard(card.id, { content })} />
        </div>
      </div>

      <footer className="flex items-center gap-2 border-t border-line px-5 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))] text-[12px] text-faint sm:px-8">
        {card.done && card.completed_at ? (
          <span className="flex items-center gap-1.5">
            <CircleCheckBig size={13} /> Terminada hace {formatDistanceToNowStrict(new Date(card.completed_at), { locale: es })}
          </span>
        ) : (
          <span>Creada hace {formatDistanceToNowStrict(new Date(card.created_at), { locale: es })}</span>
        )}
        <span className="flex-1" />
        <span>Editada hace {formatDistanceToNowStrict(new Date(card.updated_at), { locale: es })}</span>
      </footer>

      <Popover open={more.open} anchor={more.anchor} onClose={more.close} align="end" width={220}>
        <MenuItem icon={Folder} onClick={() => {
            const a = more.anchor
            more.close()
            move.openAt(a)
          }}>
          Mover a otro proyecto
        </MenuItem>
        <MenuItem
          icon={Trash2}
          danger
          onClick={() => {
            more.close()
            onClose()
            deleteCard(card.id)
          }}
        >
          Eliminar tarjeta
        </MenuItem>
      </Popover>
      <Popover open={move.open} anchor={move.anchor} onClose={move.close} width={240}>
        <ProjectPicker
          value={card.project_id}
          onChange={(project_id) => {
            move.close()
            updateCard(card.id, { project_id })
          }}
        />
      </Popover>
      <Popover open={date.open} anchor={date.anchor} onClose={date.close} width={272}>
        <DatePicker
          value={card.due_at}
          allDay={card.due_all_day}
          onChange={(due_at, due_all_day) => {
            updateCard(card.id, { due_at, due_all_day })
            if (due_all_day) date.close()
          }}
          onClear={() => {
            date.close()
            updateCard(card.id, { due_at: null })
          }}
        />
      </Popover>
    </>
  )
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      <div className="flex w-32 shrink-0 items-center gap-2 text-muted sm:w-36">
        <Icon size={15} className="text-faint" />
        <span className="truncate">{label}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center">{children}</div>
    </div>
  )
}

function GroupRow({ group, card }) {
  const labels = useStore((s) => s.labels)
  const updateCard = useStore((s) => s.updateCard)
  const pop = usePopover()
  const mine = card.label_ids.map((id) => labels[id]).filter((l) => l && l.group_id === group.id).sort((a, b) => a.position - b.position)
  return (
    <Row icon={Tag} label={group.name}>
      <button onClick={pop.toggle} className="flex min-h-8 flex-wrap items-center gap-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-hover">
        {mine.length ? mine.map((l) => <LabelChip key={l.id} label={l} />) : <span className="text-faint">Vacío</span>}
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={250}>
        <LabelPicker
          group={group}
          selected={card.label_ids}
          onChange={(label_ids) => {
            updateCard(card.id, { label_ids })
            if (!group.multi) pop.close()
          }}
        />
      </Popover>
    </Row>
  )
}

function EstimateInput({ card }) {
  const updateCard = useStore((s) => s.updateCard)
  const opts = [5, 15, 30, 60, 120, 240]
  const label = (m) => (m < 60 ? `${m} min` : `${m / 60} h`)
  return (
    <div className="flex flex-wrap gap-1 px-1">
      {opts.map((m) => (
        <button
          key={m}
          onClick={() => updateCard(card.id, { estimate_minutes: card.estimate_minutes === m ? null : m })}
          className={cx(
            'h-7 rounded-md px-2 text-[12.5px] transition-colors',
            card.estimate_minutes === m ? 'bg-accent-soft font-medium text-accent' : 'text-faint hover:bg-hover hover:text-muted',
          )}
        >
          {label(m)}
        </button>
      ))}
    </div>
  )
}

function ReminderInput({ card }) {
  const updateCard = useStore((s) => s.updateCard)
  const ref = useRef(null)
  return (
    <div className="relative flex items-center">
      <button
        onClick={() => {
          try {
            ref.current.showPicker()
          } catch {
            ref.current.focus()
          }
        }}
        className={cx('h-8 rounded-lg px-2 transition-colors hover:bg-hover', card.remind_at ? 'text-ink' : 'text-faint')}
      >
        {card.remind_at ? humanDate(card.remind_at, false) : 'Sin recordatorio'}
      </button>
      {card.remind_at && (
        <IconButton size="sm" label="Quitar recordatorio" onClick={() => updateCard(card.id, { remind_at: null })}>
          <X size={14} />
        </IconButton>
      )}
      <input
        ref={ref}
        type="datetime-local"
        tabIndex={-1}
        aria-hidden
        value={toDateTimeInput(card.remind_at)}
        onChange={(e) => updateCard(card.id, { remind_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
        className="pointer-events-none absolute left-0 top-full h-0 w-0 opacity-0"
      />
    </div>
  )
}
