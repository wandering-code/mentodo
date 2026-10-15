import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { sortCards } from '../lib/cards'
import { hiddenInCard, hiddenInProject, projectProps } from '../lib/props'
import { PropValue } from '../components/Properties'
import { Checkbox, cx } from '../components/ui'

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

const SORT_KEY = { due: 'due_at', remind: 'remind_at', estimate: 'estimate_minutes', todo: 'in_todo' }
const sortKey = (p) => (p.group ? `group:${p.group.id}` : p.field ? `f:${p.field.id}` : SORT_KEY[p.key])

export function TableView({ project, view, cards, onOpen }) {
  const s = useStore()
  const props = useMemo(
    () => projectProps(s, project.id).filter((p) => !hiddenInProject(project, p.key)),
    [s.groups, s.fields, project], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const sorted = useMemo(() => sortCards(cards, view.config.sort, s), [cards, view.config.sort, s.labels, s.fields]) // eslint-disable-line react-hooks/exhaustive-deps
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
            <HeaderCell field="title" view={view} className="w-[34%] min-w-60">
              Título
            </HeaderCell>
            {props.map((p) => (
              <HeaderCell key={p.key} field={sortKey(p)} view={view} className="min-w-28">
                <p.icon size={13} className="text-faint" />
                {p.name}
              </HeaderCell>
            ))}
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
              {props.map((p) => (
                <td key={p.key} className="border-b border-line px-1.5">
                  {!hiddenInCard(c, p.key) && <PropValue prop={p} card={c} compact />}
                </td>
              ))}
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
