import { useMemo, useRef, useState } from 'react'
import { haptic } from '../lib/layers'
import {
  closestCorners, DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, MouseSensor, pointerWithin, TouchSensor,
  useDroppable, useSensor, useSensors,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronsLeftRight, ChevronsRightLeft, MoreHorizontal, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { between, groupLabels, sortCards } from '../lib/cards'
import { LABEL_COLORS } from '../lib/palette'
import { CardTile } from '../components/CardTile'
import { ColorPicker } from '../components/Pickers'
import { TemplateButton } from '../components/Templates'
import { cx, Divider, IconButton, MenuItem, Popover, Toggle, useIsMobile, usePopover } from '../components/ui'

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

function Column({ id, label, group, cards, onOpen, onAdd, manual, projectId, collapsed, onToggle }) {
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

  const name = label ? label.name : `Sin ${group.name.toLowerCase()}`

  // Plegada: una tira estrecha con el nombre en vertical (sigue aceptando
  // tarjetas que se suelten encima)
  if (collapsed) {
    return (
      <div className="flex w-11 shrink-0 flex-col">
        <div className="mb-2 h-8" />
        <button
          ref={setNodeRef}
          onClick={onToggle}
          title={`Desplegar «${name}»`}
          className={cx(
            'entra flex min-h-48 flex-1 flex-col items-center gap-2 rounded-2xl py-3 transition-colors duration-200',
            isOver ? 'bg-accent-soft' : 'bg-[color-mix(in_oklab,var(--sunken)_70%,transparent)] hover:bg-sunken',
          )}
          style={{ '--entra-desde': 'translateX(-6px)', '--entra-dura': '220ms' }}
        >
          <ChevronsLeftRight size={14} className="shrink-0 text-faint" />
          <span className="text-[12.5px] tabular-nums text-faint">{cards.length}</span>
          <span
            data-c={label?.color}
            className={cx('rounded-md px-0.5 py-2 text-[13px] font-medium [writing-mode:vertical-rl]', label ? 'lbl' : 'text-muted')}
          >
            {name}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className="entra flex w-[84vw] max-w-[300px] shrink-0 flex-col sm:w-[300px]" style={{ '--entra-dura': '220ms' }}>
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
        <IconButton size="sm" label="Plegar columna" onClick={onToggle} className="opacity-0 group-hover/col:opacity-100 max-sm:opacity-100">
          <ChevronsRightLeft size={15} />
        </IconButton>
        <TemplateButton projectId={projectId} labelIds={id === NONE ? [] : [Number(id)]} className="opacity-0 group-hover/col:opacity-100 max-sm:opacity-100" />
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
            <motion.div key="add" initial={{ opacity: 0, transform: 'translateY(-4px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} exit={{ opacity: 0 }} className="rounded-xl border border-line bg-surface p-2 shadow-soft">
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
  // Columnas plegadas: se guardan en la vista (se mantienen y se sincronizan)
  const collapsed = (view.config.collapsed || []).map(String)
  const toggleCollapsed = (col) => {
    const key = String(col)
    const cur = (useStore.getState().views[view.id]?.config || view.config)
    const list = (cur.collapsed || []).map(String)
    s.updateView(view.id, { config: { ...cur, collapsed: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] } })
  }
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

  // Ratón y dedo por separado. Con un sensor de puntero genérico, el dedo
  // también arrancaba el arrastre al moverse 6px: se comía el scroll del
  // tablero y competía con "mantener pulsado". En táctil solo se coge una
  // tarjeta manteniéndola pulsada; deslizar sigue siendo hacer scroll.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const lastDrop = useRef(0)
  const boardRef = useRef(null)
  const dragDx = useRef(0)
  const phone = useIsMobile()

  if (!group) {
    return <div className="px-6 py-16 text-center text-sm text-muted">Elige por qué grupo de etiquetas agrupar este tablero (arriba, en «Agrupar»).</div>
  }

  const cols = live || columns
  const findCol = (id) => {
    if (typeof id === 'string' && (id.startsWith('col:') || id.startsWith('dock:'))) return id.slice(id.indexOf(':') + 1)
    return Object.keys(cols).find((k) => cols[k].includes(id))
  }

  const onDragStart = ({ active }) => {
    dragDx.current = 0
    haptic(10)
    setActive(active.id)
    setLive(columns)
  }

  const onDragOver = ({ active, over }) => {
    // Sobre el muelle no se recoloca nada en el tablero: se decide al soltar
    if (!over || String(over.id).startsWith('dock:')) return
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

  // Al soltar se usa exactamente lo que se está viendo: la copia en vivo de
  // las columnas (live), no el orden de antes de arrastrar. Antes se
  // mezclaban los dos y, tras pasar por otra columna y volver, la tarjeta
  // acababa en otro sitio (o el movimiento se perdía al soltar sobre su hueco).
  const onDragEnd = ({ active, over }) => {
    const p = live || columns
    lastDrop.current = performance.now()
    setActive(null)
    setLive(null)
    if (!over) return
    const card = s.cards[active.id]
    if (!card) return
    const origin = Object.keys(columns).find((k) => columns[k].includes(active.id))
    let col = Object.keys(p).find((k) => p[k].includes(active.id)) || origin
    let list = [...(p[col] || [])]
    const overId = String(over.id)
    const overCol = findCol(over.id)
    if (overId.startsWith('dock:') && overCol && overCol !== col) {
      // Soltada en el muelle: al final de esa columna
      col = overCol
      list = [...(p[col] || []).filter((x) => x !== active.id), active.id]
    } else if (overCol === col && !overId.startsWith('col:') && !overId.startsWith('dock:')) {
      // Sobre otra tarjeta de la misma columna: ocupa su sitio
      const from = list.indexOf(active.id)
      const to = list.indexOf(over.id)
      if (from >= 0 && to >= 0) list = arrayMove(list, from, to)
    }
    if (!list.includes(active.id)) return
    const unchanged = origin === col && list.join() === (columns[col] || []).join()
    if (unchanged) return
    const idx = list.indexOf(active.id)
    const body = {}
    if (manual) {
      const prev = s.cards[list[idx - 1]]?.position
      const next = s.cards[list[idx + 1]]?.position
      body.position = between(prev, next)
    }
    if (origin !== col) {
      let ids = card.label_ids.filter((id) => (group.multi ? String(id) !== origin : s.labels[id]?.group_id !== group.id))
      if (col !== NONE) ids = [...ids, Number(col)]
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

  // «Sin …» solo si ya tiene tarjetas. Antes también aparecía al empezar a
  // arrastrar, y esa columna nueva al principio hacía que el navegador
  // corrigiera el scroll (+1 columna) y, al soltar y desaparecer, el tablero
  // saltaba de lado aunque solo se hubiera reordenado en vertical
  const order = [...(columns[NONE]?.length ? [NONE] : []), ...labels.map((l) => String(l.id))]
  const activeCard = active ? s.cards[active] : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={(args) => {
        const p = pointerWithin(args)
        const dock = p.filter((c) => String(c.id).startsWith('dock:'))
        if (dock.length) return dock
        return p.length ? p : closestCorners(args)
      }}
      // Desplazamiento automático suave y solo pegado al borde. Y de lado
      // SOLO si la tarjeta se ha movido de verdad en horizontal: al reordenar
      // dentro de una columna cerca del borde, el tablero se desplazaba solo y
      // al soltar el imán de columnas lo encajaba de lado
      autoScroll={{
        threshold: { x: 0.08, y: 0.12 },
        acceleration: 4,
        canScroll: (el) => el !== boardRef.current || Math.abs(dragDx.current) > 60,
      }}
      onDragMove={({ delta }) => (dragDx.current = delta.x)}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => (setActive(null), setLive(null))}
    >
      <div
        ref={boardRef}
        className={cx(
          'flex min-h-[60vh] items-start gap-3 overflow-x-auto overscroll-x-contain px-4 pb-10 pt-1 sm:px-8 max-sm:scroll-px-4 max-sm:[&>*]:snap-start',
          // El imán de columnas se apaga mientras se arrastra: peleaba con el
          // desplazamiento automático hacia la columna de destino
          !active && 'max-sm:snap-x max-sm:snap-mandatory',
        )}
      >
        {order.map((col) => (
          <Column
            key={col}
            id={col}
            group={group}
            label={col === NONE ? null : s.labels[col]}
            cards={(cols[col] || []).map((id) => s.cards[id]).filter(Boolean)}
            onOpen={(c) => performance.now() - lastDrop.current > 350 && onOpen(c)}
            onAdd={add}
            manual={manual}
            projectId={project.id}
            collapsed={collapsed.includes(String(col))}
            onToggle={() => toggleCollapsed(col)}
          />
        ))}
        <NewColumn group={group} count={labels.length} />
      </div>
      {phone && active && <Dock columns={order} group={group} labels={s.labels} />}
      <DragOverlay dropAnimation={{ duration: 240, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }}>
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

/* Muelle de columnas (móvil): al coger una tarjeta aparece abajo una tira con
   todas las columnas, y soltarla encima la mueve ahí sin tener que desplazar
   el tablero con la tarjeta en el dedo. */
function Dock({ columns, group, labels }) {
  return (
    <div
      className="entra fixed inset-x-0 bottom-0 z-[45] border-t border-line bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5 shadow-float backdrop-blur-xl"
      style={{ '--entra-desde': 'translateY(100%)', '--entra-dura': '260ms' }}
    >
      <div className="mb-2 text-center text-[11.5px] font-medium uppercase tracking-wide text-faint">Suelta para mover a…</div>
      <div className="-mx-3 flex gap-2 overflow-x-auto touch-pan-x overflow-y-hidden overscroll-x-contain px-3 [scrollbar-width:none]">
        {columns.filter((c) => c !== NONE).map((col) => (
          <DockTarget key={col} col={col} label={col === NONE ? null : labels[col]} group={group} />
        ))}
      </div>
    </div>
  )
}

function DockTarget({ col, label, group }) {
  const { setNodeRef, isOver } = useDroppable({ id: `dock:${col}` })
  return (
    <div
      ref={setNodeRef}
      data-c={label?.color || 'gris'}
      className={cx(
        'lbl flex h-12 min-w-[30%] flex-1 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-4 text-[14px] font-medium transition-transform duration-150',
        isOver && 'scale-[1.06] ring-2 ring-[var(--accent)]',
      )}
    >
      {label ? label.name : `Sin ${group.name.toLowerCase()}`}
    </div>
  )
}
