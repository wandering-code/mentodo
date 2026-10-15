import { useMemo, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { ChevronRight, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { groupLabels, sortCards } from '../lib/cards'
import { CardRow } from '../components/CardRow'
import { Collapse, cx } from '../components/ui'

function Section({ title, cards, onOpen, hideGroupId, onAdd, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const [draft, setDraft] = useState('')
  return (
    <section className="mb-6">
      <button onClick={() => setOpen((v) => !v)} className="mb-1 flex h-8 items-center gap-1.5 rounded-lg pr-2 text-left">
        <ChevronRight size={15} className="text-faint" style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .25s cubic-bezier(.32,.72,0,1)' }} />
        {title}
        <span className="ml-1 text-[12.5px] tabular-nums text-faint">{cards.length}</span>
      </button>
      <Collapse open={open}>
            <AnimatePresence initial={false}>
              {cards.map((c) => (
                <CardRow key={c.id} card={c} onOpen={onOpen} hideGroupId={hideGroupId} />
              ))}
            </AnimatePresence>
            {onAdd && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!draft.trim()) return
                  await onAdd(draft.trim())
                  setDraft('')
                }}
                className="flex h-10 items-center gap-3 px-3 text-faint"
              >
                <Plus size={16} />
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Añadir…" className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint" />
              </form>
            )}
      </Collapse>
    </section>
  )
}

export function ListView({ project, view, cards, onOpen }) {
  const s = useStore()
  const group = s.groups[view.config.group_by]
  const sorted = useMemo(() => sortCards(cards, view.config.sort, s), [cards, view.config.sort, s.labels]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!group) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-8">
        <Section title={<span className="text-[13.5px] font-medium">Todas</span>} cards={sorted} onOpen={onOpen} onAdd={(title) => s.createCard({ project_id: project.id, title })} />
      </div>
    )
  }

  const labels = groupLabels(s, group.id)
  const none = sorted.filter((c) => !c.label_ids.some((id) => s.labels[id]?.group_id === group.id))
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-8">
      {none.length > 0 && (
        <Section title={<span className="text-[13.5px] font-medium text-muted">Sin {group.name.toLowerCase()}</span>} cards={none} onOpen={onOpen} hideGroupId={group.id} />
      )}
      {labels.map((l) => (
        <Section
          key={l.id}
          defaultOpen={!l.marks_done}
          title={
            <span data-c={l.color} className={cx('lbl rounded-md px-2 py-0.5 text-[13px] font-medium')}>
              {l.name}
            </span>
          }
          cards={sorted.filter((c) => c.label_ids.includes(l.id))}
          onOpen={onOpen}
          hideGroupId={group.id}
          onAdd={(title) => s.createCard({ project_id: project.id, title, label_ids: [l.id] })}
        />
      ))}
    </div>
  )
}
