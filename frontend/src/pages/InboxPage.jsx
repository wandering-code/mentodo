import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Inbox, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { useCardNav } from '../lib/nav'
import { CardRow } from '../components/CardRow'
import { ProjectPicker } from '../components/Pickers'
import { Block, Empty, IconButton, Popover, shortcut, usePopover } from '../components/ui'
import { differenceInCalendarDays } from 'date-fns'

/* Bandeja: todo lo capturado sin decidir aún dónde va. La idea es vaciarla
   de vez en cuando moviendo cada cosa a su proyecto (o borrándola). */
export function InboxPage() {
  const s = useStore()
  const [draft, setDraft] = useState('')
  const cards = useMemo(
    () => Object.values(s.cards).filter((c) => c.project_id === null && !s.hidden[c.id] && !c.done).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [s.cards, s.hidden],
  )
  // En bloques según cuándo se capturó: lo reciente arriba
  const groups = useMemo(() => {
    const out = [['Hoy', []], ['Ayer', []], ['Esta semana', []], ['Antes', []]]
    const now = new Date()
    for (const c of cards) {
      const d = differenceInCalendarDays(now, new Date(c.created_at))
      out[d <= 0 ? 0 : d === 1 ? 1 : d < 7 ? 2 : 3][1].push(c)
    }
    return out.filter(([, list]) => list.length)
  }, [cards])
  const { open: openCard } = useCardNav()
  const add = async (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    const title = draft.trim()
    setDraft('')
    await s.createCard({ title, project_id: null })
  }
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-8 lg:pt-12">
      <h1 className="text-[30px] font-semibold tracking-[-0.03em]">Bandeja</h1>
      <p className="mt-1.5 text-[15px] text-muted">Primero captura, después organiza. Mueve cada cosa a su sitio cuando tengas un momento.</p>
      <form onSubmit={add} className="mt-6 flex h-11 items-center gap-3 rounded-xl border border-line bg-surface px-3.5 shadow-soft focus-within:border-[color-mix(in_oklab,var(--accent)_50%,var(--line))]">
        <Plus size={17} className="text-faint" />
        <input autoFocus={window.innerWidth > 640} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="¿Qué tienes en la cabeza?" className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
      </form>
      <div className="mt-2">
        {groups.map(([title, list]) => (
          <Block key={title} title={title} count={list.length}>
            <AnimatePresence initial={false}>
              {list.map((c) => (
                <motion.div key={c.id} layout="position" exit={{ opacity: 0, transform: 'translateX(40px)', transition: { duration: 0.2 } }} className="group relative">
                  <CardRow card={c} onOpen={openCard} />
                  <MoveButton card={c} />
                </motion.div>
              ))}
            </AnimatePresence>
          </Block>
        ))}
        {cards.length === 0 && (
          <Empty icon={Inbox} title="Bandeja vacía">
            Mente despejada. Usa {shortcut('K')} o el botón + para capturar algo al vuelo.
          </Empty>
        )}
      </div>
    </div>
  )
}

function MoveButton({ card }) {
  const pop = usePopover()
  const updateCard = useStore((s) => s.updateCard)
  return (
    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
      <IconButton label="Mover a un proyecto" size="sm" onClick={pop.toggle} className="bg-surface shadow-soft">
        <ArrowRight size={15} />
      </IconButton>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={240} align="end">
        <ProjectPicker
          value={null}
          onChange={(project_id) => {
            pop.close()
            if (project_id) updateCard(card.id, { project_id })
          }}
        />
      </Popover>
    </div>
  )
}
