import { useMemo, useRef, useState } from 'react'
import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, pointerWithin, TouchSensor,
  useDroppable, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion } from 'motion/react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { between, groupLabels, sortCards } from '../lib/cards'
import { LABEL_COLORS } from '../lib/palette'
import { CardTile } from '../components/CardTile'
import { ColorPicker } from '../components/Pickers'
import { cx, Divider, IconButton, MenuItem, Popover, Toggle, usePopover } from '../components/ui'

const NONE = 'none'

function SortableCard({ card, groupId, onOpen, disabled }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card' },
    disabled,
  })
  return (
    <CardTile
      ref={setNodeRef}
      card={card}
      hideGroupId={groupId}
      onOpen={onOpen}
      dragging={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
    />
  )
}

function Column({ id, label, group, cards, onOpen, onAdd, manual }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${id}`, data: { type: 'column', col: id } })
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const menu = usePopover()
  const color = usePopover()
  const { updateLabel, deleteLabel } = useStore.getState()
  const inputRef = useRef(null)

  const submit = async () => {
    const t = text.trim()
    if (!t) return setAdding(false)
    setText('')
    await onAdd(t, id)
    inputRef.current?.focus()
  }

  return (
    <div className="flex w-[290px] shrink-0 flex-col sm:w-[300px]">
      <div className="group/col mb-2 flex h-8 items-center gap-2 px-1.5">
        {label ? (
          <span data-c={label.color} className="lbl rounded-md px-2 py-0.5 text-[13px] font-medium">
            {label.name}
          </span>
        ) : (
          <span className="text-[13px] font-medium text-muted">Sin {group.name.toLowerCase()}</span>
        )}
        <span className="text-[12.5px] tabular-nums text-faint">{cards.length}</span>
        <span className="flex-1" />
        <IconButton size="sm" label="Añadir tarjeta" onClick={() => setAdding(true)} className="opacity-0 group-hover/col:opacity-100 max-sm:opacity-100">
          <Plus size={15} />
        </IconButton>
        {label && (
          <IconButton size="sm" label="Opciones de columna" onClick={menu.toggle} className="opacity-0 group-hover/col:opacity-100 max-sm:opacity-100">
            <MoreHorizontal size={15} />
          </IconButton>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cx(
          'flex min-h-24 flex-1 flex-col gap-2 rounded-2xl p-1.5 transition-colors duration-200',
          isOver ? 'bg-accent-soft' : 'bg-[color-mix(in_oklab,var(--sunken)_70%,transparent)]',
        )}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((c) => (
            <SortableCard key={c.id} card={c} groupId={group.id} onOpen={onOpen} disabled={!manual && false} />
          ))}
        </SortableContext>
        <AnimatePresence initial={false}>
          {adding ? (
            <motion.div key="add" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-line bg-surface p-2 shadow-soft">
              <textarea
                ref={inputRef}
                autoFocus
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submit()
                  }
                  if (e.key === 'Escape') setAdding(false)
                }}
                onBlur={() => !text.trim() && setAdding(false)}
                placeholder="Título de la tarjeta…"
                className="w-full resize-none bg-transparent text-[14px] outline-none placeholder:text-faint"
              />
            </motion.div>
          ) : (
            <motion.button
              key="btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setAdding(true)}
              className="flex h-9 items-center gap-2 rounded-xl px-2.5 text-[13.5px] text-faint transition-colors hover:bg-hover hover:text-muted"
            >
              <Plus size={15} /> Nueva
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {label && (
        <>
          <Popover open={menu.open} anchor={menu.anchor} onClose={menu.close} width={230}>
            <div className="px-1 pb-1">
              <input
                defaultValue={label.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== label.name && updateLabel(label.id, { name: e.target.value.trim() })}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="h-9 w-full rounded-lg bg-sunken px-2.5 text-[14px] outline-none"
              />
            </div>
            <MenuItem
              onClick={() => {
                const a = menu.anchor
                menu.close()
                color.openAt(a)
              }}
              right={<span data-c={label.color} className="lbl-dot size-3 rounded-full" />}
            >
              Color
            </MenuItem>
            {group.is_status && (
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[14px]">
                <span className="flex-1">Significa terminado</span>
                <Toggle checked={label.marks_done} onChange={(v) => updateLabel(label.id, { marks_done: v })} />
              </div>
            )}
            <Divider />
            <MenuItem
              danger
              onClick={() => {
                menu.close()
                if (confirm(`¿Borrar la etiqueta «${label.name}»? Las tarjetas se quedan, sin ella.`)) deleteLabel(label.id)
              }}
            >
              Borrar etiqueta
            </MenuItem>
          </Popover>
          <Popover open={color.open} anchor={color.anchor} onClose={color.close} width={200}>
            <ColorPicker
              value={label.color}
              onChange={(c) => {
                updateLabel(label.id, { color: c })
                color.close()
              }}
            />
          </Popover>
        </>
      )}
    </div>
  )
}

export function BoardView({ project, view, cards, onOpen }) {
  const s = useStore()
  const groupId = view.config.group_by
  const group = s.groups[groupId]
  const labels = useMemo(() => (group ? groupLabels(s, group.id) : []), [s.labels, group]) // eslint-disable-line react-hooks/exhaustive-deps
  const manual = !view.config.sort?.length
  const [active, setActive] = useState(null)
  // Columnas "en vivo" mientras se arrastra: { colId: [cardIds] }
  const [live, setLive] = useState(null)

  const columns = useMemo(() => {
    if (!group) return {}
    const cols = { [NONE]: [] }
    for (const l of labels) cols[l.id] = []
    const sorted = sortCards(cards, view.config.sort, s)
    for (const c of sorted) {
      const mine = c.label_ids.filter((id) => s.labels[id]?.group_id === group.id)
      if (!mine.length) cols[NONE].push(c.id)
      for (const id of mine) cols[id]?.push(c.id)
    }
    return cols
  }, [cards, labels, group, view.config.sort, s.labels]) // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (!group) {
    return <div className="px-6 py-16 text-center text-sm text-muted">Elige por qué grupo de etiquetas agrupar este tablero (arriba, en «Agrupar»).</div>
  }

  const cols = live || columns
  const findCol = (id) => {
    if (typeof id === 'string' && id.startsWith('col:')) return id.slice(4)
    return Object.keys(cols).find((k) => cols[k].includes(id))
  }

  const onDragStart = ({ active }) => {
    setActive(active.id)
    setLive(columns)
  }

  const onDragOver = ({ active, over }) => {
    if (!over) return
    const from = findCol(active.id)
    const to = findCol(over.id)
    if (!from || !to || from === to) return
    setLive((prev) => {
      const p = prev || columns
      const target = p[to].filter((x) => x !== active.id)
      const overIdx = target.indexOf(over.id)
      const idx = overIdx >= 0 ? overIdx : target.length
      target.splice(idx, 0, active.id)
      return { ...p, [from]: p[from].filter((x) => x !== active.id), [to]: target }
    })
  }

  const onDragEnd = ({ active, over }) => {
    const p = live || columns
    setActive(null)
    setLive(null)
    if (!over) return
    const card = s.cards[active.id]
    const origin = Object.keys(columns).find((k) => columns[k].includes(active.id))
    const to = findCol(over.id)
    if (!card || !to) return
    let list = p[to].filter((x) => x !== active.id)
    let idx = over.id === `col:${to}` ? list.length : list.indexOf(over.id)
    if (idx < 0) idx = list.length
    // Dentro de la misma columna, soltar sobre una tarjeta inferior va detrás de ella
    if (origin === to && over.id !== active.id) {
      const oldIdx = columns[to].indexOf(active.id)
      const overIdx = columns[to].indexOf(over.id)
      if (oldIdx < overIdx) idx = list.indexOf(over.id) + 1
    }
    if (origin === to && over.id === active.id) return
    list.splice(idx, 0, active.id)
    const body = {}
    if (manual) {
      const prev = s.cards[list[idx - 1]]?.position
      const next = s.cards[list[idx + 1]]?.position
      body.position = between(prev, next)
    }
    if (origin !== to) {
      let ids = card.label_ids.filter((id) => (group.multi ? String(id) !== origin : s.labels[id]?.group_id !== group.id))
      if (to !== NONE) ids = [...ids, Number(to)]
      body.label_ids = ids
    }
    if (Object.keys(body).length) s.updateCard(card.id, body)
  }

  const add = async (title, col) => {
    const first = s.cards[columns[col]?.[0]]
    await s.createCard({
      project_id: project.id,
      title,
      label_ids: col === NONE ? [] : [Number(col)],
      position: columns[col]?.length ? s.cards[columns[col][columns[col].length - 1]].position + 1 : first ? first.position - 1 : 0,
    })
  }

  const order = [...(cols[NONE]?.length || active ? [NONE] : []), ...labels.map((l) => String(l.id))]
  const activeCard = active ? s.cards[active] : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const p = pointerWithin(args)
        return p.length ? p : closestCorners(args)
      }}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => (setActive(null), setLive(null))}
    >
      <div className="flex min-h-[60vh] items-start gap-3 overflow-x-auto px-4 pb-10 pt-1 sm:px-8 [scroll-snap-type:x_proximity] max-sm:[&>*]:snap-start">
        {order.map((col) => (
          <Column
            key={col}
            id={col}
            group={group}
            label={col === NONE ? null : s.labels[col]}
            cards={(cols[col] || []).map((id) => s.cards[id]).filter(Boolean)}
            onOpen={onOpen}
            onAdd={add}
            manual={manual}
          />
        ))}
        <NewColumn group={group} count={labels.length} />
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}>
        {activeCard ? <CardTile card={activeCard} hideGroupId={group.id} overlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function NewColumn({ group, count }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const createLabel = useStore((s) => s.createLabel)
  const submit = async () => {
    if (name.trim()) await createLabel({ group_id: group.id, name: name.trim(), color: LABEL_COLORS[(count + 3) % LABEL_COLORS.length].id })
    setName('')
    setEditing(false)
  }
  return (
    <div className="w-[260px] shrink-0 pt-0.5">
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="Nombre de la etiqueta"
          className="h-8 w-full rounded-lg border border-line bg-surface px-2.5 text-[13.5px] outline-none"
        />
      ) : (
        <button onClick={() => setEditing(true)} className="flex h-8 items-center gap-2 rounded-lg px-2 text-[13.5px] text-faint transition-colors hover:bg-hover hover:text-muted">
          <Plus size={15} /> Nueva columna
        </button>
      )}
    </div>
  )
}
