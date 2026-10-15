import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { projectGroups, sortCards } from '../lib/cards'
import { DueBadge } from '../components/CardTile'
import { DatePicker, LabelPicker } from '../components/Pickers'
import { Checkbox, cx, LabelChip, Popover, Toggle, usePopover } from '../components/ui'

function HeaderCell({ field, children, view, className }) {
  const updateView = useStore((s) => s.updateView)
  const sort = view.config.sort || []
  const current = sort[0]?.field === field ? sort[0].dir : null
  const cycle = () => {
    const next = current === null ? 'asc' : current === 'asc' ? 'desc' : null
    updateView(view.id, { config: { ...view.config, sort: next ? [{ field, dir: next }] : [] } })
  }
  return (
    <th className={cx('sticky top-0 z-[1] h-9 border-b border-line bg-bg px-3 text-left text-[12.5px] font-medium text-muted', className)}>
      <button onClick={cycle} className="inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-ink">
        {children}
        {current === 'asc' && <ArrowUp size={12} className="text-accent" />}
        {current === 'desc' && <ArrowDown size={12} className="text-accent" />}
      </button>
    </th>
  )
}

function LabelCell({ card, group }) {
  const labels = useStore((s) => s.labels)
  const updateCard = useStore((s) => s.updateCard)
  const pop = usePopover()
  const mine = card.label_ids.map((id) => labels[id]).filter((l) => l && l.group_id === group.id)
  return (
    <td className="border-b border-line px-1.5">
      <button onClick={pop.toggle} className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md px-1.5 py-1 hover:bg-hover">
        {mine.map((l) => (
          <LabelChip key={l.id} label={l} size="sm" />
        ))}
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={240}>
        <LabelPicker
          group={group}
          selected={card.label_ids}
          onChange={(label_ids) => {
            updateCard(card.id, { label_ids })
            if (!group.multi) pop.close()
          }}
        />
      </Popover>
    </td>
  )
}

function DateCell({ card }) {
  const updateCard = useStore((s) => s.updateCard)
  const pop = usePopover()
  return (
    <td className="border-b border-line px-1.5">
      <button onClick={pop.toggle} className="flex h-9 w-full items-center whitespace-nowrap rounded-md px-1.5 hover:bg-hover">
        <DueBadge card={card} />
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={272}>
        <DatePicker
          value={card.due_at}
          allDay={card.due_all_day}
          onChange={(due_at, due_all_day) => {
            updateCard(card.id, { due_at, due_all_day })
            if (due_all_day) pop.close()
          }}
          onClear={() => (pop.close(), updateCard(card.id, { due_at: null }))}
        />
      </Popover>
    </td>
  )
}

function TitleCell({ card, onOpen }) {
  const updateCard = useStore((s) => s.updateCard)
  const [editing, setEditing] = useState(false)
  return (
    <td className="border-b border-line px-3">
      <div className="flex min-h-9 items-center gap-2.5">
        <Checkbox checked={card.done} onChange={(done) => updateCard(card.id, { done })} size={16} />
        {editing ? (
          <input
            autoFocus
            defaultValue={card.title}
            onBlur={(e) => {
              setEditing(false)
              if (e.target.value !== card.title) updateCard(card.id, { title: e.target.value })
            }}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && e.currentTarget.blur()}
            className="h-8 flex-1 bg-transparent text-[14px] outline-none"
          />
        ) : (
          <button
            onClick={() => onOpen(card)}
            onDoubleClick={(e) => (e.preventDefault(), setEditing(true))}
            className={cx('min-w-0 flex-1 truncate py-2 text-left text-[14px] hover:underline hover:decoration-line hover:underline-offset-4', card.done && 'text-faint line-through')}
          >
            {card.title || <span className="text-faint">Sin título</span>}
          </button>
        )}
      </div>
    </td>
  )
}

export function TableView({ project, view, cards, onOpen }) {
  const s = useStore()
  const groups = useMemo(() => projectGroups(s, project.id), [s.groups, project.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const sorted = useMemo(() => sortCards(cards, view.config.sort, s), [cards, view.config.sort, s.labels]) // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState('')

  const add = async (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    await s.createCard({ project_id: project.id, title: draft.trim() })
    setDraft('')
  }

  return (
    <div className="overflow-x-auto px-4 pb-16 sm:px-8">
      <table className="w-full min-w-[720px] border-separate border-spacing-0">
        <thead>
          <tr>
            <HeaderCell field="title" view={view} className="w-[38%] min-w-60">
              Título
            </HeaderCell>
            {groups.map((g) => (
              <HeaderCell key={g.id} field={`group:${g.id}`} view={view}>
                {g.name}
              </HeaderCell>
            ))}
            <HeaderCell field="due_at" view={view}>
              Fecha
            </HeaderCell>
            <HeaderCell field="estimate_minutes" view={view}>
              Est.
            </HeaderCell>
            <th className="sticky top-0 z-[1] h-9 border-b border-line bg-bg px-3 text-left text-[12.5px] font-medium text-muted">To Do</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => (
            <motion.tr
              key={c.id}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: Math.min(i, 20) * 0.012 }}
              className="group transition-colors hover:bg-[color-mix(in_oklab,var(--hover)_60%,transparent)]"
            >
              <TitleCell card={c} onOpen={onOpen} />
              {groups.map((g) => (
                <LabelCell key={g.id} card={c} group={g} />
              ))}
              <DateCell card={c} />
              <td className="border-b border-line px-3 text-[13px] tabular-nums text-muted">
                {c.estimate_minutes ? (c.estimate_minutes < 60 ? `${c.estimate_minutes} min` : `${c.estimate_minutes / 60} h`) : ''}
              </td>
              <td className="border-b border-line px-3">
                <Toggle checked={c.in_todo} onChange={(in_todo) => s.updateCard(c.id, { in_todo })} label="En To Do" />
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={add} className="flex h-10 items-center gap-2.5 border-b border-line px-3 text-faint">
        <Plus size={16} />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Nueva tarjeta" className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint" />
      </form>
    </div>
  )
}
