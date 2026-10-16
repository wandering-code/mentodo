import { forwardRef, memo } from 'react'
import { AlarmClock, CalendarClock, ListTree, Lock, Paperclip, Repeat, CalendarDays, Clock3, FileText, ListTodo } from 'lucide-react'
import { useStore } from '../lib/store'
import { dateInfo, readDate, useDeadlineKey } from '../lib/deadline'
import { humanDate } from '../lib/dates'
import { Checkbox, cx, LabelChip } from './ui'
import { CheckBadge, useCardMeta } from './Properties'
import { badgesFromKey, linkBadgesKey } from '../lib/links'
import { cardMenu } from './CardMenu'

function hasContent(c) {
  return !!c.content?.content?.some((n) => n.content?.length || n.type !== 'paragraph')
}

export function checklist(c) {
  let total = 0
  let done = 0
  const walk = (n) => {
    if (n.type === 'taskItem') {
      total++
      if (n.attrs?.checked) done++
    }
    n.content?.forEach(walk)
  }
  if (c.content) walk(c.content)
  return total ? { total, done } : null
}

/* La fecha de entrega (la que marque el proyecto), con colores de urgencia */
export function DueBadge({ card, className }) {
  const key = useDeadlineKey(card.project_id)
  const d = readDate(card, key)
  const info = dateInfo(d, card.done)
  if (!info) return null
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 text-[12px]',
        card.done ? 'text-faint' : info.overdue ? 'text-danger' : info.today ? 'text-accent' : 'text-muted',
        className,
      )}
    >
      <CalendarDays size={12} />
      {humanDate(d.at, d.allDay)}
    </span>
  )
}

/* Tarjeta tal como se ve en el tablero */
export const CardTile = memo(
  forwardRef(function CardTile({ card, hideGroupId, onOpen, dragging, overlay, style, ...rest }, ref) {
    const labels = useStore((s) => s.labels)
    const meta = useCardMeta(card)
    const badges = badgesFromKey(useStore((s) => linkBadgesKey(s, card.id)))
    const files = useStore((s) => Object.values(s.attachments).reduce((n, a) => n + (a.card_id === card.id ? 1 : 0), 0))
    const updateCard = useStore((s) => s.updateCard)
    const chips = card.label_ids
      .map((id) => labels[id])
      .filter((l) => l && meta.show(`g:${l.group_id}`) && l.group_id !== hideGroupId)
      .sort((a, b) => a.group_id - b.group_id || a.position - b.position)
    const cl = checklist(card)
    return (
      <div
        ref={ref}
        style={style}
        {...rest}
        onClick={() => onOpen?.(card)}
        onContextMenu={overlay ? undefined : cardMenu(card)}
        className={cx(
          'touch-drag group relative cursor-pointer rounded-xl border bg-surface px-3 py-2.5 text-left transition-[box-shadow,border-color,opacity,transform] duration-150 [touch-action:manipulation]',
          'border-line hover:border-[color-mix(in_oklab,var(--ink)_14%,var(--line))]',
          overlay ? 'lift shadow-float' : 'shadow-[0_1px_1.5px_rgb(0_0_0/0.04)] hover:shadow-soft',
          dragging && 'opacity-30',
        )}
      >
        <div className="flex items-start gap-2.5">
          <Checkbox checked={card.done} onChange={(done) => updateCard(card.id, { done })} size={16} className="mt-[2px]" />
          <div className={cx('min-w-0 flex-1 text-[14px] leading-[1.4]', card.done ? 'text-faint line-through decoration-[var(--faint)]' : 'text-ink')}>
            {card.title || <span className="text-faint">Sin título</span>}
          </div>
        </div>
        {(chips.length > 0 || card.due_at || Object.keys(card.values || {}).length > 0 || files > 0 || card.recurrence || badges.blocked || badges.subtasks || meta.dates.length > 0 || meta.checks.length > 0 || cl || card.in_todo || card.estimate_minutes || card.remind_at || hasContent(card)) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pl-[26px]">
            {chips.map((l) => (
              <LabelChip key={l.id} label={l} size="sm" />
            ))}
            {meta.show(meta.deadline) && <DueBadge card={card} />}
            {meta.checks.map(({ field: f, on }) => (
              <CheckBadge key={f.id} field={f} on={on} />
            ))}
            {meta.dates.map(({ field, value }) => (
              <span key={field.id} className="inline-flex items-center gap-1 text-[12px] text-muted" title={field.name}>
                <CalendarClock size={12} />
                <span className="text-faint">{field.name}</span> {humanDate(value.at, value.all_day)}
              </span>
            ))}
            {meta.show('estimate') && card.estimate_minutes && (
              <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                <Clock3 size={12} />
                {card.estimate_minutes < 60 ? `${card.estimate_minutes}m` : `${card.estimate_minutes / 60}h`}
              </span>
            )}
            {cl && (
              <span className={cx('inline-flex items-center gap-1 text-[12px] tabular-nums', cl.done === cl.total ? 'text-accent' : 'text-muted')}>
                <ListTodo size={12} />
                {cl.done}/{cl.total}
              </span>
            )}
            {badges.blocked && !card.done && (
              <span className="inline-flex items-center gap-1 text-[12px] text-danger" title="Bloqueada por otra tarjeta sin terminar">
                <Lock size={12} /> Bloqueada
              </span>
            )}
            {badges.subtasks && (
              <span className={cx('inline-flex items-center gap-1 text-[12px] tabular-nums', badges.subtasks.done === badges.subtasks.total ? 'text-accent' : 'text-muted')}>
                <ListTree size={12} />
                {badges.subtasks.done}/{badges.subtasks.total}
              </span>
            )}
            {files > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[12px] tabular-nums text-muted" title="Adjuntos">
                <Paperclip size={12} />
                {files}
              </span>
            )}
            {card.recurrence && <Repeat size={12} className="text-muted" title="Se repite" />}
            {meta.show('remind') && card.remind_at && <AlarmClock size={12} className="text-muted" />}
            {!cl && hasContent(card) && <FileText size={12} className="text-faint" />}
            {meta.show('todo') && card.in_todo && <span className="size-1.5 rounded-full bg-accent" title="En To Do" />}
          </div>
        )}
      </div>
    )
  }),
)
