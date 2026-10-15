import { motion } from 'motion/react'
import { CalendarClock, Clock3, ListTree, Lock, Repeat } from 'lucide-react'
import { useStore } from '../lib/store'
import { checklist, DueBadge } from './CardTile'
import { Checkbox, cx, LabelChip } from './ui'
import { useCardMeta } from './Properties'
import { humanDate } from '../lib/dates'
import { badgesFromKey, linkBadgesKey } from '../lib/links'

/* Fila de tarjeta para listas (To Do, bandeja, vista lista) */
export function CardRow({ card, onOpen, hideGroupId, showProject }) {
  const labels = useStore((s) => s.labels)
  const meta = useCardMeta(card)
  const badges = badgesFromKey(useStore((s) => linkBadgesKey(s, card.id)))
  const project = useStore((s) => (card.project_id ? s.projects[card.project_id] : null))
  const updateCard = useStore((s) => s.updateCard)
  const chips = card.label_ids
    .map((id) => labels[id])
    .filter((l) => l && meta.show(`g:${l.group_id}`) && l.group_id !== hideGroupId && !l.marks_done)
    .slice(0, 3)
  const cl = checklist(card)
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, transform: 'translateY(-4px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transform: 'translateX(14px)', transition: { duration: 0.16 } }}
      transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
      onClick={() => onOpen(card)}
      className="group flex min-h-12 cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-hover active:bg-hover sm:min-h-11 sm:items-center sm:py-2"
    >
      <Checkbox checked={card.done} onChange={(done) => updateCard(card.id, { done })} size={19} className="mt-px sm:mt-0" />
      <div className="min-w-0 flex-1">
        <div className={cx('text-[15px] leading-snug transition-colors duration-300 sm:truncate sm:text-[14.5px]', card.done ? 'text-faint line-through decoration-[var(--faint)]' : 'text-ink')}>
          {card.title || <span className="text-faint">Sin título</span>}
        </div>
        {(showProject || chips.length > 0 || card.due_at || badges.blocked || badges.subtasks || meta.dates.length > 0 || cl || card.estimate_minutes) && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:hidden">
            <Meta card={card} chips={chips} cl={cl} meta={meta} badges={badges} project={showProject && project} />
          </div>
        )}
      </div>
      <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
        <Meta card={card} chips={chips} cl={cl} meta={meta} badges={badges} project={showProject && project} />
      </div>
    </motion.div>
  )
}

function Meta({ card, chips, cl, meta, badges, project }) {
  return (
    <>
      {chips.map((l) => (
        <LabelChip key={l.id} label={l} size="sm" />
      ))}
      {cl && (
        <span className="text-[12px] tabular-nums text-muted">
          {cl.done}/{cl.total}
        </span>
      )}
      {meta.show('estimate') && card.estimate_minutes && (
        <span className="inline-flex items-center gap-1 text-[12px] text-muted">
          <Clock3 size={12} />
          {card.estimate_minutes < 60 ? `${card.estimate_minutes}m` : `${card.estimate_minutes / 60}h`}
        </span>
      )}
      {meta.show('due') && <DueBadge card={card} />}
      {card.recurrence && <Repeat size={12} className="text-muted" />}
      {badges.blocked && !card.done && <Lock size={12} className="text-danger" />}
      {badges.subtasks && (
        <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-muted">
          <ListTree size={12} />
          {badges.subtasks.done}/{badges.subtasks.total}
        </span>
      )}
      {meta.dates.map(({ field, value }) => (
        <span key={field.id} className="inline-flex items-center gap-1 text-[12px] text-muted" title={field.name}>
          <CalendarClock size={12} />
          <span className="text-faint">{field.name}</span> {humanDate(value.at, value.all_day)}
        </span>
      ))}
      {project && (
        <span className="inline-flex max-w-40 items-center gap-1 truncate text-[12px] text-faint">
          <span>{project.icon}</span>
          <span className="truncate">{project.name}</span>
        </span>
      )}
    </>
  )
}
