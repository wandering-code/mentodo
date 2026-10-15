import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, ExternalLink, EyeOff, Folder, Pencil, Plus, Tag, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { humanDate, toDateTimeInput } from '../lib/dates'
import { FIELD_KINDS, fieldValue, hasValue, hiddenInCard, hiddenInProject, movedOrder, projectProps, repeatText, WD } from '../lib/props'
import { DatePicker, LabelPicker } from './Pickers'
import { cx, Divider, IconButton, LabelChip, MenuItem, MenuLabel, Popover, Toggle, usePopover } from './ui'

/* Propiedades de una tarjeta: las de serie, los grupos de etiquetas y los
   campos propios del proyecto. Cada una se puede ocultar solo en esta tarjeta
   o en todo el proyecto, y recuperar desde «Añadir propiedad». */
export function Properties({ card, project, onMove }) {
  const s = useStore()
  const props = useMemo(() => projectProps(s, card.project_id), [s.groups, s.fields, s.projects, card.project_id]) // eslint-disable-line react-hooks/exhaustive-deps
  const visible = props.filter((p) => !hiddenInProject(project, p.key) && !hiddenInCard(card, p.key))
  const hidden = props.filter((p) => hiddenInProject(project, p.key) || hiddenInCard(card, p.key))

  return (
    <div className="mt-5 flex flex-col gap-0.5 text-[14px]">
      {!project && (
        <Row icon={Folder} label="Proyecto">
          <button onClick={onMove} className="h-8 rounded-lg px-2 text-faint hover:bg-hover">
            Elegir proyecto…
          </button>
        </Row>
      )}
      <AnimatePresence initial={false}>
        {visible.map((p) => (
          <motion.div key={p.key} layout="position" initial={{ opacity: 0, transform: 'translateY(-4px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}>
            <PropRow prop={p} card={card} project={project} all={props} />
          </motion.div>
        ))}
      </AnimatePresence>
      <AddProperty card={card} project={project} hidden={hidden} />
    </div>
  )
}

export function Row({ icon: Icon, label, children, onLabel }) {
  return (
    <div className="flex min-h-9 items-center gap-2">
      <button
        onClick={onLabel}
        disabled={!onLabel}
        className="flex h-8 w-32 shrink-0 items-center gap-2 rounded-lg px-1 text-left text-muted transition-colors enabled:hover:bg-hover enabled:hover:text-ink sm:w-36"
      >
        <Icon size={15} className="shrink-0 text-faint" />
        <span className="truncate">{label}</span>
      </button>
      <div className="flex min-w-0 flex-1 flex-wrap items-center">{children}</div>
    </div>
  )
}

function PropRow({ prop, card, project, all }) {
  const menu = usePopover()
  const s = useStore.getState()
  const [renaming, setRenaming] = useState(false)

  const hideInCard = () => {
    menu.close()
    s.updateCard(card.id, { hidden_props: [...(card.hidden_props || []), prop.key] })
  }
  const hideInProject = () => {
    menu.close()
    s.updateProject(project.id, { hidden_props: [...(project.hidden_props || []), prop.key] })
  }
  const remove = () => {
    menu.close()
    if (prop.group && confirm(`¿Borrar el grupo «${prop.name}» y sus etiquetas en todo el proyecto?`)) s.deleteGroup(prop.group.id)
    if (prop.field && confirm(`¿Borrar la propiedad «${prop.name}» y sus valores en todo el proyecto?`)) s.deleteField(prop.field.id)
  }
  const rename = (name) => {
    setRenaming(false)
    if (!name.trim() || name === prop.name) return
    if (prop.group) s.updateGroup(prop.group.id, { name: name.trim() })
    else if (prop.field) s.updateField(prop.field.id, { name: name.trim() })
    else s.updateProject(project.id, { prop_names: { ...(project.prop_names || {}), [prop.key]: name.trim() } })
  }
  // Subir/bajar dentro del orden completo del proyecto (también cuenta lo
  // oculto, para que al volver a mostrarlo aparezca donde estaba)
  const i = all.findIndex((p) => p.key === prop.key)
  const move = (dir) => {
    const order = movedOrder(all, prop.key, dir)
    if (order) s.updateProject(project.id, { prop_order: order })
  }
  const canRename = !!project || prop.group || prop.field

  return (
    <>
      <Row icon={prop.icon} label={prop.name} onLabel={menu.toggle}>
        <PropValue prop={prop} card={card} />
      </Row>
      <Popover open={menu.open} anchor={menu.anchor} onClose={() => (menu.close(), setRenaming(false))} width={250}>
        {canRename &&
          (renaming ? (
            <div className="px-1 pb-1">
              <input
                autoFocus
                defaultValue={prop.name}
                onBlur={(e) => rename(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (rename(e.currentTarget.value), menu.close())}
                className="h-9 w-full rounded-lg bg-sunken px-2.5 text-[14px] outline-none"
              />
            </div>
          ) : (
            <MenuItem icon={Pencil} onClick={() => setRenaming(true)}>
              Renombrar
            </MenuItem>
          ))}
        {project && (
          <>
            <MenuItem icon={ArrowUp} onClick={() => move(-1)} className={i <= 0 ? 'pointer-events-none opacity-40' : ''}>
              Subir
            </MenuItem>
            <MenuItem icon={ArrowDown} onClick={() => move(1)} className={i >= all.length - 1 ? 'pointer-events-none opacity-40' : ''}>
              Bajar
            </MenuItem>
            <Divider />
          </>
        )}
        <MenuItem icon={EyeOff} onClick={hideInCard}>
          Ocultar en esta tarjeta
        </MenuItem>
        {project && (
          <MenuItem icon={EyeOff} onClick={hideInProject}>
            Ocultar en todo el proyecto
          </MenuItem>
        )}
        {(prop.group || prop.field) && (
          <>
            <Divider />
            <MenuItem icon={Trash2} danger onClick={remove}>
              Borrar propiedad
            </MenuItem>
          </>
        )}
      </Popover>
    </>
  )
}

function AddProperty({ card, project, hidden }) {
  const pop = usePopover()
  const s = useStore.getState()
  const [creating, setCreating] = useState(null) // tipo que se está creando
  const [name, setName] = useState('')

  const show = (p) => {
    if (hiddenInCard(card, p.key)) s.updateCard(card.id, { hidden_props: card.hidden_props.filter((k) => k !== p.key) })
    if (hiddenInProject(project, p.key)) s.updateProject(project.id, { hidden_props: project.hidden_props.filter((k) => k !== p.key) })
    pop.close()
  }

  const create = async () => {
    const n = name.trim()
    if (!n) return
    if (creating === 'labels') await s.createGroup({ project_id: project.id, name: n })
    else await s.createField({ project_id: project.id, name: n, kind: creating })
    setCreating(null)
    setName('')
    pop.close()
  }

  return (
    <>
      <button onClick={pop.toggle} className="mt-1 flex h-8 w-fit items-center gap-2 rounded-lg px-1 text-[13.5px] text-faint transition-colors hover:bg-hover hover:text-muted">
        <Plus size={15} /> Añadir propiedad
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={() => (pop.close(), setCreating(null))} width={260}>
        {creating ? (
          <div className="p-1">
            <MenuLabel>{creating === 'labels' ? 'Nuevo grupo de etiquetas' : `Nueva propiedad: ${FIELD_KINDS.find((k) => k.id === creating)?.name}`}</MenuLabel>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') create()
                if (e.key === 'Escape') setCreating(null)
              }}
              placeholder={creating === 'date' ? 'p. ej. Entrega, Revisión…' : 'Nombre'}
              className="h-9 w-full rounded-lg bg-sunken px-2.5 text-[14px] outline-none placeholder:text-faint"
            />
            <p className="px-1 pt-2 text-[12px] text-faint">Se añade a todas las tarjetas del proyecto.</p>
          </div>
        ) : (
          <>
            {hidden.length > 0 && (
              <>
                <MenuLabel>Ocultas</MenuLabel>
                {hidden.map((p) => (
                  <MenuItem
                    key={p.key}
                    icon={p.icon}
                    onClick={() => show(p)}
                    right={<span className="text-[11.5px] text-faint">{hiddenInProject(project, p.key) ? 'en el proyecto' : 'aquí'}</span>}
                  >
                    {p.name}
                  </MenuItem>
                ))}
                {project && <Divider />}
              </>
            )}
            {project ? (
              <>
                <MenuLabel>Nueva propiedad</MenuLabel>
                <MenuItem icon={Tag} onClick={() => setCreating('labels')}>
                  Etiquetas
                </MenuItem>
                {FIELD_KINDS.map((k) => (
                  <MenuItem key={k.id} icon={k.icon} onClick={() => setCreating(k.id)}>
                    {k.name}
                  </MenuItem>
                ))}
              </>
            ) : (
              hidden.length === 0 && <p className="px-2.5 py-2 text-[13px] text-faint">Mueve la tarjeta a un proyecto para crear propiedades propias.</p>
            )}
          </>
        )}
      </Popover>
    </>
  )
}

/* Valor editable de una propiedad (lo usan el panel y la tabla) */
export function PropValue({ prop, card, compact }) {
  // En una plantilla, las fechas son relativas al día en que se crea la tarjeta
  if (card.is_template && (prop.key === 'due' || prop.key === 'remind' || prop.field?.kind === 'date')) return <RelativeDate card={card} dateKey={prop.key} />
  if (prop.group) return <GroupValue group={prop.group} card={card} compact={compact} />
  if (prop.field) return <FieldValue field={prop.field} card={card} compact={compact} />
  if (prop.key === 'due') return <DueValue card={card} compact={compact} />
  if (prop.key === 'remind') return <ReminderValue card={card} compact={compact} />
  if (prop.key === 'estimate') return <EstimateValue card={card} compact={compact} />
  if (prop.key === 'repeat') return <RepeatValue card={card} compact={compact} />
  if (prop.key === 'todo') return <TodoValue card={card} />
  return null
}

const REL = [
  [0, 'Hoy'],
  [1, 'Mañana'],
  [2, 'En 2 días'],
  [3, 'En 3 días'],
  [7, 'En 1 semana'],
  [14, 'En 2 semanas'],
  [30, 'En 1 mes'],
]
const relText = (d) => (d == null ? null : REL.find(([n]) => n === d)?.[1] || `En ${d} días`)

function RelativeDate({ card, dateKey }) {
  const updateCard = useStore((s) => s.updateCard)
  const pop = usePopover()
  const offsets = card.template?.offsets || {}
  const value = offsets[dateKey]
  const set = (days) => {
    const next = { ...offsets }
    if (days == null) delete next[dateKey]
    else next[dateKey] = days
    updateCard(card.id, { template: { ...card.template, offsets: next } })
    pop.close()
  }
  return (
    <>
      <button onClick={pop.toggle} className={cx('h-8 rounded-lg px-2 transition-colors hover:bg-hover', value == null ? 'text-faint' : 'text-ink')}>
        {relText(value) || 'Sin fecha'}
        {dateKey === 'remind' && value != null && <span className="text-faint"> · 9:00</span>}
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={230}>
        <MenuLabel>Al crear la tarjeta</MenuLabel>
        <MenuItem active={value == null} onClick={() => set(null)}>
          Sin fecha
        </MenuItem>
        {REL.map(([d, t]) => (
          <MenuItem key={d} active={value === d} onClick={() => set(d)}>
            {t}
          </MenuItem>
        ))}
        <Divider />
        <div className="flex items-center gap-2 px-3 py-2 text-[14px] sm:px-2.5">
          En
          <input
            type="number"
            min={0}
            max={3650}
            inputMode="numeric"
            defaultValue={value ?? ''}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.value !== '' && set(Math.max(0, Number(e.currentTarget.value)))}
            className="h-9 w-16 rounded-lg bg-sunken px-2 text-[16px] outline-none sm:h-8 sm:text-[14px]"
          />
          días
        </div>
      </Popover>
    </>
  )
}

function RepeatValue({ card, compact }) {
  const updateCard = useStore((s) => s.updateCard)
  const pop = usePopover()
  const r = card.recurrence
  const today = (card.due_at ? new Date(card.due_at) : new Date()).getDay()
  const wd = (today + 6) % 7 // lunes = 0
  const set = (rule) => updateCard(card.id, { recurrence: rule })
  const presets = [
    ['Cada día', { freq: 'daily', interval: 1 }],
    ['Días laborables', { freq: 'weekly', interval: 1, weekdays: [0, 1, 2, 3, 4] }],
    ['Cada semana', { freq: 'weekly', interval: 1, weekdays: [wd] }],
    ['Cada 2 semanas', { freq: 'weekly', interval: 2, weekdays: [wd] }],
    ['Cada mes', { freq: 'monthly', interval: 1 }],
    ['Cada año', { freq: 'yearly', interval: 1 }],
  ]
  const cur = r || { freq: 'weekly', interval: 1, weekdays: [wd] }
  const patch = (p) => set({ ...cur, ...p })
  const text = repeatText(r)
  return (
    <>
      <button
        onClick={pop.toggle}
        className={cx('h-8 min-w-0 truncate rounded-lg px-2 text-left transition-colors hover:bg-hover', r ? 'text-ink' : 'text-faint', compact && 'w-full text-[13px]')}
      >
        {text || (compact ? '' : 'No se repite')}
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={290}>
        <MenuItem active={!r} onClick={() => (set(null), pop.close())}>
          No se repite
        </MenuItem>
        {presets.map(([t, rule]) => (
          <MenuItem key={t} active={!!r && repeatText(r) === repeatText({ ...rule, from: r.from })} onClick={() => (set({ ...rule, from: r?.from }), pop.close())}>
            {t}
          </MenuItem>
        ))}
        <Divider />
        <MenuLabel>Personalizar</MenuLabel>
        <div className="flex items-center gap-2 px-3 pb-2 text-[14px] sm:px-2.5">
          Cada
          <input
            type="number"
            min={1}
            max={365}
            inputMode="numeric"
            key={cur.interval}
            defaultValue={cur.interval || 1}
            onBlur={(e) => patch({ interval: Math.max(1, Number(e.target.value) || 1) })}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="h-9 w-14 rounded-lg bg-sunken px-2 text-[16px] outline-none sm:h-8 sm:text-[14px]"
          />
          <select
            value={cur.freq}
            onChange={(e) => patch({ freq: e.target.value, weekdays: e.target.value === 'weekly' ? cur.weekdays?.length ? cur.weekdays : [wd] : undefined })}
            className="h-9 flex-1 rounded-lg bg-sunken px-2 text-[16px] outline-none sm:h-8 sm:text-[14px]"
          >
            <option value="daily">días</option>
            <option value="weekly">semanas</option>
            <option value="monthly">meses</option>
            <option value="yearly">años</option>
          </select>
        </div>
        {cur.freq === 'weekly' && (
          <div className="flex gap-1 px-3 pb-2 sm:px-2.5">
            {WD.map((d, i) => {
              const on = (cur.weekdays || []).includes(i)
              return (
                <button
                  key={i}
                  onClick={() => {
                    const next = on ? cur.weekdays.filter((x) => x !== i) : [...(cur.weekdays || []), i]
                    if (next.length) patch({ weekdays: next.sort() })
                  }}
                  className={cx('grid size-9 place-items-center rounded-lg text-[13px] font-medium transition-colors sm:size-8', on ? 'bg-accent text-accent-ink' : 'bg-sunken text-muted hover:text-ink')}
                >
                  {d}
                </button>
              )
            })}
          </div>
        )}
        <label className="flex items-center gap-3 px-3 py-2 text-[14px] sm:px-2.5">
          <span className="flex-1">
            Contar desde que la termino
            <span className="block text-[12px] text-faint">Si no, desde su fecha (aunque la termines tarde)</span>
          </span>
          <Toggle checked={cur.from === 'done'} onChange={(v) => patch({ from: v ? 'done' : undefined })} />
        </label>
      </Popover>
    </>
  )
}

function GroupValue({ group, card, compact }) {
  const labels = useStore((s) => s.labels)
  const updateCard = useStore((s) => s.updateCard)
  const pop = usePopover()
  const mine = card.label_ids
    .map((id) => labels[id])
    .filter((l) => l && l.group_id === group.id)
    .sort((a, b) => a.position - b.position)
  return (
    <>
      <button onClick={pop.toggle} className="flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-hover">
        {mine.length ? mine.map((l) => <LabelChip key={l.id} label={l} size={compact ? 'sm' : 'md'} />) : !compact && <span className="text-faint">Vacío</span>}
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
    </>
  )
}

function DateButton({ at, allDay, onChange, onClear, empty = 'Sin fecha', compact, overdue }) {
  const pop = usePopover()
  return (
    <>
      <button
        onClick={pop.toggle}
        className={cx('h-8 whitespace-nowrap rounded-lg px-2 text-left transition-colors hover:bg-hover', at ? (overdue ? 'text-danger' : 'text-ink') : 'text-faint', compact && 'w-full text-[13px]')}
      >
        {at ? humanDate(at, allDay) : compact ? '' : empty}
      </button>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={272}>
        <DatePicker
          value={at}
          allDay={allDay}
          onChange={(iso, all) => {
            onChange(iso, all)
            if (all) pop.close()
          }}
          onClear={() => {
            pop.close()
            onClear()
          }}
        />
      </Popover>
    </>
  )
}

function DueValue({ card, compact }) {
  const updateCard = useStore((s) => s.updateCard)
  const overdue = card.due_at && !card.done && new Date(card.due_at) < new Date(new Date().setHours(0, 0, 0, 0))
  return (
    <DateButton
      at={card.due_at}
      allDay={card.due_all_day}
      compact={compact}
      overdue={overdue}
      onChange={(due_at, due_all_day) => updateCard(card.id, { due_at, due_all_day })}
      onClear={() => updateCard(card.id, { due_at: null })}
    />
  )
}

function ReminderValue({ card, compact }) {
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
        className={cx('h-8 whitespace-nowrap rounded-lg px-2 transition-colors hover:bg-hover', card.remind_at ? 'text-ink' : 'text-faint', compact && 'min-w-full text-left text-[13px]')}
      >
        {card.remind_at ? humanDate(card.remind_at, false) : compact ? '' : 'Sin recordatorio'}
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

const ESTIMATES = [5, 15, 30, 60, 120, 240]
const estLabel = (m) => (m < 60 ? `${m} min` : `${m / 60} h`)

function EstimateValue({ card, compact }) {
  const updateCard = useStore((s) => s.updateCard)
  if (compact) {
    return (
      <select
        value={card.estimate_minutes || ''}
        onChange={(e) => updateCard(card.id, { estimate_minutes: Number(e.target.value) || null })}
        className={cx('h-8 w-full cursor-pointer appearance-none rounded-lg bg-transparent px-2 text-[13px] outline-none hover:bg-hover', !card.estimate_minutes && 'text-transparent hover:text-faint')}
      >
        <option value="">Sin estimar</option>
        {ESTIMATES.map((m) => (
          <option key={m} value={m}>
            {estLabel(m)}
          </option>
        ))}
      </select>
    )
  }
  return (
    <div className="flex flex-wrap gap-1 px-1">
      {ESTIMATES.map((m) => (
        <button
          key={m}
          onClick={() => updateCard(card.id, { estimate_minutes: card.estimate_minutes === m ? null : m })}
          className={cx(
            'h-7 rounded-md px-2 text-[12.5px] transition-colors',
            card.estimate_minutes === m ? 'bg-accent-soft font-medium text-accent' : 'text-faint hover:bg-hover hover:text-muted',
          )}
        >
          {estLabel(m)}
        </button>
      ))}
    </div>
  )
}

function TodoValue({ card }) {
  const updateCard = useStore((s) => s.updateCard)
  return (
    <div className="flex h-8 items-center px-2">
      <Toggle checked={card.in_todo} onChange={(in_todo) => updateCard(card.id, { in_todo })} label="Mostrar en To Do general" />
    </div>
  )
}

function FieldValue({ field, card, compact }) {
  const updateCard = useStore((s) => s.updateCard)
  const value = fieldValue(card, field)
  const set = (v) => updateCard(card.id, { values: { [field.id]: v } })
  const input = cx('h-8 w-full rounded-lg bg-transparent px-2 outline-none transition-colors placeholder:text-faint hover:bg-hover focus:bg-sunken', compact && 'text-[13px]')

  if (field.kind === 'date') {
    return (
      <DateButton
        at={value?.at}
        allDay={value?.all_day ?? true}
        compact={compact}
        onChange={(at, all_day) => set({ at, all_day })}
        onClear={() => set(null)}
      />
    )
  }
  if (field.kind === 'checkbox') {
    return (
      <div className="flex h-8 items-center px-2">
        <Toggle checked={!!value} onChange={(v) => set(v || null)} label={field.name} />
      </div>
    )
  }
  if (field.kind === 'number') {
    return (
      <input
        key={`${card.id}:${value ?? ''}`}
        type="number"
        inputMode="decimal"
        defaultValue={value ?? ''}
        placeholder={compact ? '' : 'Vacío'}
        onBlur={(e) => {
          const v = e.target.value === '' ? null : Number(e.target.value)
          if (v !== (value ?? null)) set(v)
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={cx(input, 'tabular-nums')}
      />
    )
  }
  return (
    <div className="flex w-full items-center">
      <input
        key={`${card.id}:${value ?? ''}`}
        type={field.kind === 'url' ? 'url' : 'text'}
        defaultValue={value ?? ''}
        placeholder={compact ? '' : field.kind === 'url' ? 'https://…' : 'Vacío'}
        onBlur={(e) => e.target.value !== (value ?? '') && set(e.target.value || null)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={cx(input, field.kind === 'url' && value && 'text-accent')}
      />
      {field.kind === 'url' && value && (
        <a href={/^https?:\/\//.test(value) ? value : `https://${value}`} target="_blank" rel="noreferrer" className="shrink-0">
          <IconButton size="sm" label="Abrir enlace">
            <ExternalLink size={14} />
          </IconButton>
        </a>
      )}
    </div>
  )
}

/* Para la tarjeta del tablero y las filas de lista */
export function useCardMeta(card) {
  const project = useStore((s) => (card.project_id ? s.projects[card.project_id] : null))
  const fields = useStore((s) => s.fields)
  const show = (key) => !hiddenInProject(project, key) && !hiddenInCard(card, key)
  const dates = Object.values(fields)
    .filter((f) => f.project_id === card.project_id && f.kind === 'date' && show(`f:${f.id}`))
    .map((f) => ({ field: f, value: fieldValue(card, f) }))
    .filter((d) => d.value?.at)
  return { show, dates, hasValue: (p) => hasValue(card, p) }
}

