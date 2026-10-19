import { useEffect, useMemo, useRef, useState } from 'react'
import { get } from '../lib/api'
import { useStore } from '../lib/store'
import { quantize, toHM, toMin } from '../lib/hours'
import { cx } from './ui'

/* Piezas del parte de horas que se usan en más de un sitio (página Horas y
   panel de la tarjeta). */

// Clientes usados hace poco (del servidor) + proyectos: así un cliente nuevo
// se escribe una vez y luego se elige
let recentCache = null
export function useClientSuggestions() {
  const projects = useStore((s) => s.projects)
  const entries = useStore((s) => s.entries)
  const [recent, setRecent] = useState(recentCache || [])
  const n = Object.keys(entries).length
  useEffect(() => {
    let alive = true
    get('/hours/clients')
      .then((r) => {
        recentCache = r
        alive && setRecent(r)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [n])
  return useMemo(() => {
    const out = []
    const seen = new Set()
    const add = (name, project) => {
      const k = name.trim().toLowerCase()
      if (!k || seen.has(k)) return
      seen.add(k)
      out.push({ name: name.trim(), project })
    }
    const active = Object.values(projects).filter((p) => !p.archived).sort((a, b) => a.position - b.position)
    for (const p of active) if (p.features?.hours) add(clientOfProject(p), p)
    for (const c of recent) add(c, active.find((p) => clientOfProject(p).toLowerCase() === c.toLowerCase()))
    for (const p of active) add(clientOfProject(p), p)
    return out
  }, [projects, recent])
}

export const clientOfProject = (p) => (p?.features?.client || p?.name || '').trim()

/* El proyecto al que corresponde un cliente escrito (por nombre) */
export function projectOfClient(projects, client) {
  const k = (client || '').trim().toLowerCase()
  if (!k) return null
  return Object.values(projects).find((p) => !p.archived && clientOfProject(p).toLowerCase() === k) || null
}

/* Campo de texto con sugerencias debajo (flechas + Enter para elegir). No se
   usa <datalist>: en iOS se ve y se comporta distinto en cada versión. */
export function SuggestInput({ value, onChange, onPick, suggestions, placeholder, className, inputRef, onKeyDown, render, ...rest }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const own = useRef(null)
  const ref = inputRef || own
  const q = (value || '').trim().toLowerCase()
  const list = useMemo(
    () => suggestions.filter((s) => s.label.toLowerCase() !== q && (!q || s.label.toLowerCase().includes(q))).slice(0, 7),
    [suggestions, q],
  )
  const shown = open && list.length > 0
  const pick = (s) => {
    onChange(s.label)
    onPick?.(s)
    setOpen(false)
  }
  return (
    <div className="relative min-w-0">
      <input
        ref={ref}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHi(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (shown && e.key === 'ArrowDown') {
            e.preventDefault()
            setHi((h) => (h + 1) % list.length)
          } else if (shown && e.key === 'ArrowUp') {
            e.preventDefault()
            setHi((h) => (h - 1 + list.length) % list.length)
          } else if (shown && e.key === 'Enter' && q && list[hi]) {
            e.preventDefault()
            pick(list[hi])
            return
          } else if (e.key === 'Escape' && shown) {
            e.stopPropagation()
            setOpen(false)
            return
          }
          onKeyDown?.(e)
        }}
        className={className}
        autoComplete="off"
        {...rest}
      />
      {shown && (
        <div data-layer className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-float">
          {list.map((s, i) => (
            <button
              key={s.key || s.label}
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              onMouseEnter={() => setHi(i)}
              className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[14px] sm:py-1.5', i === hi ? 'bg-hover text-ink' : 'text-muted')}
            >
              {render ? render(s) : <span className="truncate">{s.label}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* Horas de un parte: acepta 1,25 · 1.5 · 1:15 · 90m; las fichas rápidas
   suman o ponen un valor de golpe */
export function DurationChips({ step, value, onPick, extra }) {
  const opts = [step, 30, 60, 120].filter((m, i, a) => a.indexOf(m) === i && m >= step)
  return (
    <div className="flex flex-wrap items-center gap-1">
      {opts.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onPick(m)}
          className={cx('h-8 rounded-lg px-2.5 text-[13px] tabular-nums transition-colors', value === m ? 'bg-accent text-accent-ink' : 'bg-sunken text-muted hover:text-ink')}
        >
          {m < 60 ? `${m}′` : `${m / 60} h`}
        </button>
      ))}
      {extra}
    </div>
  )
}

/* Hora «HH:MM». Se guarda al salir del campo (o con Intro), no en cada
   pulsación: mientras se escribe «08:30», el navegador entrega antes
   «08:03», y redondearlo ahí lo dejaba en 08:00 sin poder terminar. Al
   guardar se redondea a la precisión elegida. */
export function TimeField({ value, onChange, step = 1, className, allowEmpty = true, label }) {
  const [text, setText] = useState(value || '')
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(value || '')
  }, [value])
  const commit = () => {
    focused.current = false
    if (!text) {
      if (allowEmpty && value) onChange(null)
      else setText(value || '')
      return
    }
    const v = toHM(quantize(toMin(text), step))
    setText(v)
    if (v !== value) onChange(v)
  }
  return (
    <input
      type="time"
      aria-label={label}
      value={text}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={cx('h-9 rounded-lg border border-line bg-surface px-2 text-[15px] tabular-nums text-ink outline-none transition-[border-color,box-shadow] focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--line))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_16%,transparent)]', className)}
    />
  )
}
