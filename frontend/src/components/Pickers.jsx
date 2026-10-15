import { useMemo, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { addDays, addMonths, endOfMonth, endOfWeek, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { groupLabels } from '../lib/cards'
import { LABEL_COLORS } from '../lib/palette'
import { allDayIso, fmt, QUICK_DATES, toTimeInput } from '../lib/dates'
import { cx, Divider, IconButton, MenuItem, MenuLabel, Toggle } from './ui'

/* Selector de etiquetas de un grupo: buscar, marcar y crear al vuelo */
export function LabelPicker({ group, selected, onChange }) {
  const labelsMap = useStore((s) => s.labels)
  const createLabel = useStore((s) => s.createLabel)
  const [q, setQ] = useState('')
  const labels = useMemo(() => groupLabels({ labels: labelsMap }, group.id), [labelsMap, group.id])
  const shown = labels.filter((l) => l.name.toLowerCase().includes(q.trim().toLowerCase()))
  const exact = labels.some((l) => l.name.toLowerCase() === q.trim().toLowerCase())

  const toggle = (id) => {
    const inGroup = selected.filter((sid) => labelsMap[sid]?.group_id === group.id)
    const others = selected.filter((sid) => labelsMap[sid]?.group_id !== group.id)
    let next
    if (group.multi) next = inGroup.includes(id) ? inGroup.filter((x) => x !== id) : [...inGroup, id]
    else next = inGroup.includes(id) ? [] : [id]
    onChange([...others, ...next])
  }

  const create = async () => {
    const name = q.trim()
    if (!name) return
    const color = LABEL_COLORS[(labels.length + 2) % LABEL_COLORS.length].id
    const l = await createLabel({ group_id: group.id, name, color })
    if (l) {
      setQ('')
      toggle(l.id)
    }
  }

  return (
    <div>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (shown.length === 1 && q) toggle(shown[0].id)
            else if (!exact) create()
          }
        }}
        placeholder={`Buscar o crear en ${group.name}…`}
        className="mb-1 h-9 w-full rounded-lg bg-sunken px-2.5 text-[14px] outline-none placeholder:text-faint"
      />
      {shown.map((l) => (
        <button key={l.id} onClick={() => toggle(l.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-hover">
          <span data-c={l.color} className="lbl rounded-md px-2 py-0.5 text-[13px] font-medium">
            {l.name}
          </span>
          <span className="flex-1" />
          {selected.includes(l.id) && <Check size={15} className="text-accent" />}
        </button>
      ))}
      {q.trim() && !exact && (
        <MenuItem icon={Plus} onClick={create}>
          Crear «{q.trim()}»
        </MenuItem>
      )}
    </div>
  )
}

/* Fecha: atajos + mini calendario + hora opcional */
export function DatePicker({ value, allDay = true, onChange, onClear }) {
  const current = value ? new Date(value) : null
  const [month, setMonth] = useState(() => startOfMonth(current || new Date()))
  const [withTime, setWithTime] = useState(!allDay && !!value)
  const days = useMemo(() => {
    const out = []
    let d = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    while (d <= end) {
      out.push(d)
      d = addDays(d, 1)
    }
    return out
  }, [month])

  const pick = (date, time = withTime ? toTimeInput(value) || '09:00' : null) => {
    if (time) {
      const [h, m] = time.split(':').map(Number)
      const d = new Date(date)
      d.setHours(h, m, 0, 0)
      onChange(d.toISOString(), false)
    } else onChange(allDayIso(date), true)
  }

  return (
    <div className="p-1">
      <div className="grid grid-cols-2 gap-1">
        {QUICK_DATES.map((q) => (
          <button key={q.id} onClick={() => pick(q.get())} className="rounded-lg bg-sunken px-2 py-1.5 text-[13px] text-ink transition-colors hover:bg-hover">
            {q.name}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center px-1">
        <span className="flex-1 text-[13.5px] font-medium capitalize">{fmt(month, 'MMMM yyyy')}</span>
        <IconButton size="sm" label="Mes anterior" onClick={() => setMonth((m) => subMonths(m, 1))}>
          <ChevronLeft size={15} />
        </IconButton>
        <IconButton size="sm" label="Mes siguiente" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight size={15} />
        </IconButton>
      </div>
      <div className="mt-1 grid grid-cols-7 text-center text-[11px] text-faint">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const sel = current && isSameDay(d, current)
          const today = isSameDay(d, new Date())
          return (
            <button
              key={d.toISOString()}
              onClick={() => pick(d)}
              className={cx(
                'm-px grid aspect-square place-items-center rounded-lg text-[13px] transition-colors',
                sel ? 'bg-accent font-medium text-accent-ink' : 'hover:bg-hover',
                !sel && !isSameMonth(d, month) && 'text-faint',
                !sel && isSameMonth(d, month) && 'text-ink',
                today && !sel && 'font-semibold text-accent',
              )}
            >
              {fmt(d, 'd')}
            </button>
          )
        })}
      </div>
      <Divider />
      <div className="flex items-center gap-2 px-2 py-1.5 text-[13.5px]">
        <span className="flex-1 text-muted">Con hora</span>
        {withTime && current && (
          <input
            type="time"
            value={toTimeInput(value)}
            onChange={(e) => e.target.value && pick(current, e.target.value)}
            className="rounded-md bg-sunken px-2 py-1 text-[13px] outline-none"
          />
        )}
        <Toggle
          checked={withTime}
          onChange={(v) => {
            setWithTime(v)
            if (current) pick(current, v ? '09:00' : null)
          }}
        />
      </div>
      {value && (
        <MenuItem icon={X} onClick={onClear}>
          Quitar fecha
        </MenuItem>
      )}
    </div>
  )
}

export function ProjectPicker({ value, onChange, generalLabel = '📥 Bandeja' }) {
  const projects = useStore((s) => s.projects)
  const list = Object.values(projects).filter((p) => !p.archived).sort((a, b) => a.position - b.position)
  return (
    <div>
      <MenuLabel>Mover a</MenuLabel>
      <MenuItem active={value === null} onClick={() => onChange(null)}>
        {generalLabel}
      </MenuItem>
      {list.map((p) => (
        <MenuItem key={p.id} active={value === p.id} onClick={() => onChange(p.id)}>
          <span className="mr-1">{p.icon}</span> {p.name}
        </MenuItem>
      ))}
    </div>
  )
}

export function ColorPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 p-1.5">
      {LABEL_COLORS.map((c) => (
        <button
          key={c.id}
          title={c.name}
          onClick={() => onChange(c.id)}
          className={cx('grid aspect-square place-items-center rounded-lg transition-transform hover:scale-110', value === c.id && 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface)]')}
          style={{ background: c.hex }}
        />
      ))}
    </div>
  )
}
