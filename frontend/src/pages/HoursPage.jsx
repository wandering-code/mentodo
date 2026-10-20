import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { addDays } from 'date-fns'
import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Download, LogIn, Plus, RotateCcw, SlidersHorizontal, Trash2, Utensils, Wand2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useCardNav } from '../lib/nav'
import { fmt } from '../lib/dates'
import {
  dateOf, dayKey, dayOf, dayStatus, fmtDelta, entriesByDay, fmtH, fmtSpan, hoursOn, hoursSettings, isZero, parseDuration, quantize, sumMinutes, toHM, toMin,
  extraOf, useHolidays, weekBalance, weekExtra, WEEKDAYS_SHORT, weekOf,
} from '../lib/hours'
import { DurationChips, projectOfClient, SuggestInput, TimeField, useClientSuggestions } from '../components/HoursParts'
import { HoursExport } from '../components/HoursExport'
import { HoursBreakdown } from '../components/HoursBreakdown'
import { Block, Button, Collapse, cx, Empty, IconButton } from '../components/ui'

/* Reloj de la página: lo que depende de la hora (trabajado, cuenta atrás) se
   recalcula cada 30 s, y a medianoche la vista salta al día nuevo */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    const wake = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', wake)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [])
  return now
}

const TONE = { over: 'var(--tc-ambar)', full: 'var(--tc-verde)' }

/* Anillo de dos arcos: tenue = trabajado, sólido = imputado. El hueco entre
   los dos es justo lo que falta por imputar ahora. */
function Ring({ worked, imputed, target, tone, children }) {
  const R = 86
  const C = 2 * Math.PI * R
  const frac = (m) => (target > 0 ? Math.max(0, Math.min(1, m / target)) : m > 0 ? 1 : 0)
  const color = TONE[tone] || 'var(--accent)'
  return (
    <div className="relative grid size-[200px] shrink-0 place-items-center sm:size-[212px]">
      <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90">
        <circle cx="100" cy="100" r={R} fill="none" stroke="var(--sunken)" strokeWidth="14" />
        <circle
          cx="100" cy="100" r={R} fill="none" strokeWidth="14" strokeLinecap="round"
          stroke={`color-mix(in oklab, ${color} 28%, transparent)`}
          strokeDasharray={C} style={{ strokeDashoffset: C * (1 - frac(worked || 0)), transition: 'stroke-dashoffset .7s cubic-bezier(.32,.72,0,1), stroke .3s' }}
        />
        <circle
          cx="100" cy="100" r={R} fill="none" strokeWidth="14" strokeLinecap="round"
          stroke={color}
          strokeDasharray={C} style={{ strokeDashoffset: C * (1 - frac(imputed)), opacity: imputed > 0 ? 1 : 0, transition: 'stroke-dashoffset .7s cubic-bezier(.32,.72,0,1), stroke .3s, opacity .2s' }}
        />
      </svg>
      <div className="relative flex flex-col items-center px-8 text-center">{children}</div>
    </div>
  )
}

function Stat({ label, children, sub, extra }) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] font-medium text-faint">{label}</div>
      <div className="mt-0.5 text-[19px] font-semibold tabular-nums tracking-[-0.02em]">{children}</div>
      {sub && <div className="text-[12px] text-muted">{sub}</div>}
      {extra}
    </div>
  )
}

// De más en ámbar (te has quedado); antes de hora, en neutro
const extraStyle = (m) =>
  m > 0 ? { color: TONE.over, background: `color-mix(in oklab, ${TONE.over} 13%, transparent)` } : { color: 'var(--muted)', background: 'var(--sunken)' }

/* Duración editable en el formato del usuario; se guarda al salir del campo */
function DurationField({ minutes, onCommit, style, step, min = 0, className, label }) {
  const [text, setText] = useState(fmtH(minutes, style))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(fmtH(minutes, style))
  }, [minutes, style])
  const commit = () => {
    focused.current = false
    const v = parseDuration(text)
    if (v == null || v < min) return setText(fmtH(minutes, style))
    const q = Math.min(1440, quantize(v, step))
    setText(fmtH(q, style))
    if (q !== minutes) onCommit(q)
  }
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        focused.current = true
        e.target.select()
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className={cx('h-9 w-[4.5rem] rounded-lg border border-line bg-surface px-2 text-right text-[15px] tabular-nums text-ink outline-none transition-[border-color,box-shadow] focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--line))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_16%,transparent)]', className)}
    />
  )
}

function WeekStrip({ keys, viewKey, today, onPick, workdays, byDay, settings, holidays }) {
  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
      {keys.map((k, i) => {
        const d = dayOf(workdays, k, settings, holidays)
        const imp = sumMinutes(byDay[k] || [])
        const t = d.target_minutes
        const frac = t > 0 ? Math.min(1, imp / t) : imp > 0 ? 1 : 0
        const over = t > 0 ? imp - t > 0.5 : imp > 0
        const full = t > 0 && isZero(imp - t)
        const active = k === viewKey
        const off = t === 0
        return (
          <button
            key={k}
            onClick={() => onPick(k)}
            className={cx(
              'relative flex flex-col items-center gap-1 rounded-xl border px-0.5 pb-2 pt-1.5 transition-[background-color,border-color,box-shadow] duration-150',
              active ? 'border-[color-mix(in_oklab,var(--accent)_40%,var(--line))] bg-surface shadow-soft' : 'border-transparent hover:bg-hover',
            )}
          >
            <span className={cx('text-[11.5px] font-medium', active ? 'text-accent' : 'text-faint')}>{WEEKDAYS_SHORT[i]}</span>
            <span className={cx('text-[16px] font-semibold tabular-nums leading-none', off && !imp ? 'text-faint' : 'text-ink')}>{Number(k.slice(8))}</span>
            <span className="mt-0.5 h-1 w-[70%] overflow-hidden rounded-full bg-sunken">
              <span
                className="block h-full origin-left rounded-full"
                style={{ transform: `scaleX(${frac})`, background: over ? TONE.over : full ? TONE.full : 'var(--accent)', transition: 'transform .45s cubic-bezier(.32,.72,0,1)' }}
              />
            </span>
            <span className="h-3.5 text-[10.5px] tabular-nums text-faint">{imp ? fmtH(imp, settings.format) : holidays.has(k) ? 'fest.' : ''}</span>
            {k === today && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" />}
          </button>
        )
      })}
    </div>
  )
}

function EntryRow({ entry, style, step, onOpenCard }) {
  const s = useStore()
  const card = entry.card_id ? s.cards[entry.card_id] : null
  const project = entry.project_id ? s.projects[entry.project_id] : null
  const [client, setClient] = useState(entry.client)
  const [task, setTask] = useState(entry.task)
  useEffect(() => setClient(entry.client), [entry.client])
  useEffect(() => setTask(entry.task), [entry.task])
  const save = (k, v) => v.trim() !== entry[k] && s.updateEntry(entry.id, { [k]: v.trim() })
  const taskRef = useRef(null)
  useLayoutEffect(() => {
    const el = taskRef.current
    if (!el) return
    const fit = () => {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [task])
  const cell = 'h-9 min-w-0 rounded-lg bg-transparent px-2 text-[14.5px] outline-none transition-colors hover:bg-hover focus:bg-hover'
  return (
    <div className="group flex items-center gap-1 rounded-xl px-1 py-1 sm:gap-2">
      <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-start sm:gap-1">
        {/* Textarea que crece: un input de una línea cortaba las tareas largas */}
        <textarea
          ref={taskRef}
          rows={1}
          value={task}
          onChange={(e) => setTask(e.target.value.replace(/\n/g, ' '))}
          onBlur={() => save('task', task)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          placeholder="Sin tarea"
          aria-label="Tarea"
          className={cx(cell, 'block h-auto min-h-9 w-full resize-none overflow-hidden py-[7px] font-medium leading-[22px] text-ink placeholder:text-faint sm:order-2 sm:flex-1')}
        />
        <div className="flex min-w-0 items-center sm:order-1 sm:w-32 sm:shrink-0">
          {project && <span className="pl-2 text-[13px] leading-none">{project.icon}</span>}
          <input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            onBlur={() => save('client', client)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="Sin cliente"
            aria-label="Cliente"
            title={client}
            className={cx(cell, 'h-7 w-full text-ellipsis text-[13px] text-muted placeholder:text-faint sm:h-9 sm:text-[14px]')}
          />
        </div>
      </div>
      {card && (
        <button onClick={() => onOpenCard(card)} title="Abrir la tarjeta" className="hidden max-w-[9rem] shrink-0 items-center gap-1 truncate rounded-md bg-sunken px-1.5 py-0.5 text-[11.5px] text-muted hover:text-ink sm:inline-flex">
          <ArrowRight size={11} /> <span className="truncate">{card.title || 'Sin título'}</span>
        </button>
      )}
      <DurationField minutes={entry.minutes} style={style} step={step} min={1} onCommit={(m) => s.updateEntry(entry.id, { minutes: m })} label="Horas" className="border-transparent bg-transparent hover:bg-hover" />
      <IconButton label="Eliminar parte" size="sm" onClick={() => s.deleteEntry(entry.id)} className="opacity-100 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
        <Trash2 size={15} />
      </IconButton>
    </div>
  )
}

function AddEntry({ viewKey, settings, suggestedMinutes, onAdded }) {
  const s = useStore()
  const clients = useClientSuggestions()
  const [client, setClient] = useState(() => {
    try {
      return localStorage.getItem(`mentodo:hours-client:${s.user.id}`) || ''
    } catch {
      return ''
    }
  })
  const [task, setTask] = useState('')
  const [cardId, setCardId] = useState(null)
  const [text, setText] = useState('')
  const taskRef = useRef(null)
  const project = projectOfClient(s.projects, client)
  const minutes = parseDuration(text)
  const valid = minutes != null && minutes > 0

  // Tareas sugeridas: las tarjetas abiertas del proyecto de ese cliente
  const taskSuggestions = useMemo(() => {
    if (!project) return []
    return Object.values(s.cards)
      .filter((c) => c.project_id === project.id && !c.done && c.title)
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .slice(0, 40)
      .map((c) => ({ key: c.id, label: c.title, card: c }))
  }, [project, s.cards])

  const submit = async () => {
    if (!valid) return
    const m = Math.min(1440, Math.max(settings.step, quantize(minutes, settings.step)))
    const linked = cardId && s.cards[cardId]?.title === task.trim() ? cardId : null
    const e = await s.addEntry({ day: viewKey, client: client.trim(), task: task.trim(), minutes: m, card_id: linked, project_id: linked ? undefined : project?.id ?? null })
    if (!e) return
    try {
      localStorage.setItem(`mentodo:hours-client:${s.user.id}`, client.trim())
    } catch {}
    // Se deja el cliente: lo normal es imputar varias tareas seguidas al mismo
    setTask('')
    setText('')
    setCardId(null)
    taskRef.current?.focus()
    onAdded?.()
  }
  const onKey = (e) => e.key === 'Enter' && (e.preventDefault(), submit())
  const field = 'h-11 w-full rounded-lg border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow] duration-150 focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--line))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_16%,transparent)] sm:h-10 sm:text-[15px]'

  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-soft sm:p-4">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,34%)_minmax(0,1fr)_5.5rem]">
        <SuggestInput
          value={client}
          onChange={setClient}
          suggestions={clients.map((c) => ({ key: c.name, label: c.name, project: c.project }))}
          render={(c) => (
            <>
              <span className="w-4 text-center text-[13px]">{c.project?.icon || ''}</span>
              <span className="truncate">{c.label}</span>
            </>
          )}
          onPick={() => setTimeout(() => taskRef.current?.focus(), 0)}
          onKeyDown={onKey}
          placeholder="Cliente"
          aria-label="Cliente"
          className={field}
        />
        <SuggestInput
          inputRef={taskRef}
          value={task}
          onChange={(v) => {
            setTask(v)
            if (cardId && s.cards[cardId]?.title !== v) setCardId(null)
          }}
          suggestions={taskSuggestions}
          onPick={(x) => setCardId(x.card.id)}
          onKeyDown={onKey}
          placeholder={project ? `Tarea (o una tarjeta de ${project.name})` : 'Tarea'}
          aria-label="Tarea"
          className={field}
        />
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} inputMode="decimal" placeholder="Horas" aria-label="Horas" className={cx(field, 'text-right tabular-nums')} />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <DurationChips
          step={settings.step}
          value={minutes}
          onPick={(m) => setText(fmtH(m, settings.format))}
          extra={
            suggestedMinutes > 0 && (
              <button type="button" onClick={() => setText(fmtH(suggestedMinutes, settings.format))} className="inline-flex h-8 items-center gap-1 rounded-lg bg-accent-soft px-2.5 text-[13px] font-medium tabular-nums text-accent">
                <Wand2 size={13} /> Lo que queda · {fmtH(suggestedMinutes, settings.format)}
              </button>
            )
          }
        />
        <div className="flex-1" />
        {cardId && <span className="text-[12px] text-faint">Se imputará a la tarjeta</span>}
        <Button variant="primary" onClick={submit} disabled={!valid}>
          <Plus size={15} /> Añadir parte
        </Button>
      </div>
    </div>
  )
}

export function HoursPage() {
  const s = useStore()
  const { open } = useCardNav()
  const now = useNow()
  const today = dayKey(now)
  const [viewKey, setViewKey] = useState(today)
  const [setup, setSetup] = useState(false)
  const [exporting, setExporting] = useState(false)
  // Desglose por proyecto: plegado salvo que se abra (se recuerda en el dispositivo)
  const bdKey = `mentodo:hours-breakdown:${s.user?.id}`
  const [breakdown, setBreakdown] = useState(() => {
    try {
      return localStorage.getItem(bdKey) === '1'
    } catch {
      return false
    }
  })
  const toggleBreakdown = () =>
    setBreakdown((v) => {
      try {
        localStorage.setItem(bdKey, v ? '0' : '1')
      } catch {}
      return !v
    })
  const settings = hoursSettings(s.user)
  const style = settings.format
  const keys = useMemo(() => weekOf(dateOf(viewKey)).map(dayKey), [viewKey])
  const years = useMemo(() => [...new Set(keys.map((k) => Number(k.slice(0, 4))))], [keys])
  const holidays = useHolidays(settings.region, years)

  // Medianoche con la página abierta: si se miraba «hoy», se pasa al nuevo
  const lastToday = useRef(today)
  useEffect(() => {
    if (lastToday.current !== today) {
      setViewKey((v) => (v === lastToday.current ? today : v))
      lastToday.current = today
    }
  }, [today])

  useEffect(() => {
    if (hoursOn(s.user)) s.loadHours(keys[0], keys[6])
  }, [keys[0]]) // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => entriesByDay(s.entries), [s.entries])
  if (!hoursOn(s.user)) return <Navigate to="/ajustes#modulos" replace />

  const day = dayOf(s.workdays, viewKey, settings, holidays)
  const list = byDay[viewKey] || []
  const st = dayStatus(day, viewKey, list, now)
  const isToday = viewKey === today
  const balance = weekBalance(keys, s.workdays, byDay, settings, holidays)
  const extra = extraOf(day, viewKey, now)
  const weekExtraMin = weekExtra(keys, s.workdays, settings, holidays, now)
  const tone = st.imputed - day.target_minutes > 0.5 ? 'over' : day.target_minutes > 0 && isZero(st.pendTot) ? 'full' : null
  const suggested = st.pendNow > 0.5 ? quantize(st.pendNow, settings.step) : st.pendTot > 0.5 ? quantize(st.pendTot, settings.step) : 0
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const lunchFrom = toMin(day.lunch_from)
  const lunchApplies = day.start && day.lunch_minutes > 0 && toMin(day.start) + day.target_minutes >= lunchFrom
  const moveWeek = (n) => setViewKey(dayKey(addDays(dateOf(viewKey), n * 7)))
  const save = (body) => s.saveDay(viewKey, body)

  // Centro del anillo
  let big = null
  let caption = null
  if (st.worked == null) {
    caption = 'Indica la entrada'
  } else if (st.pendNow < -0.5) {
    big = fmtH(-st.pendNow, style)
    caption = 'de adelanto'
  } else if (isZero(st.pendNow)) {
    big = <Check size={40} strokeWidth={2.4} />
    caption = st.pendTot <= 0.5 ? 'Todo imputado' : 'Al día · nada pendiente'
  } else {
    big = fmtH(st.pendNow, style)
    caption = 'sin imputar'
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-8 lg:pt-12">
      <p className="entra text-[13px] font-medium text-faint first-letter:uppercase">
        {isToday ? 'Hoy · ' : ''}
        {fmt(dateOf(viewKey), "EEEE, d 'de' MMMM")}
        {holidays.has(viewKey) && ' · festivo'}
      </p>
      <div className="entra mt-1 flex items-center gap-2" style={{ '--entra-espera': '40ms' }}>
        <h1 className="flex flex-1 items-center gap-2.5 text-[30px] font-semibold tracking-[-0.03em]">
          <Clock size={26} className="text-accent" /> Horas
        </h1>
        <Button variant="outline" size="sm" onClick={() => setExporting(true)}>
          <Download size={14} /> <span className="hidden sm:inline">Exportar</span> CSV
        </Button>
      </div>

      {/* Semana */}
      <div className="entra mt-5" style={{ '--entra-espera': '80ms' }}>
        <div className="mb-2 flex flex-wrap items-center gap-x-1 gap-y-1.5">
          <div className="flex items-center gap-1">
          <IconButton label="Semana anterior" onClick={() => moveWeek(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton label="Semana siguiente" onClick={() => moveWeek(1)}>
            <ChevronRight size={18} />
          </IconButton>
          <span className="ml-1 whitespace-nowrap text-[13.5px] text-muted">
            {fmt(dateOf(keys[0]), 'd MMM')} – {fmt(dateOf(keys[6]), 'd MMM')}
          </span>
          {!keys.includes(today) && (
            <Button size="sm" variant="soft" className="ml-1" onClick={() => setViewKey(today)}>
              Hoy
            </Button>
          )}
          </div>
          {/* En móvil, los dos indicadores bajan a su propia fila */}
          <div className="ml-auto flex items-center gap-1">
          {weekExtraMin != null && !isZero(weekExtraMin) && (
            <span
              className="flex items-center gap-1.5 pr-1"
              title="Horas de más de la semana: lo que te has quedado después de la salida prevista (o, en negativo, lo que te fuiste antes). Cuenta los días con salida real y hoy."
            >
              <span className="whitespace-nowrap text-[12.5px] text-faint">De más</span>
              <span className="rounded-lg px-2 py-0.5 text-[13.5px] font-semibold tabular-nums" style={extraStyle(weekExtraMin)}>
                {fmtDelta(weekExtraMin)}
              </span>
            </span>
          )}
          <button
            onClick={toggleBreakdown}
            aria-expanded={breakdown}
            title="Imputado menos jornada, solo en los días con partes. Toca para ver el desglose por proyecto."
            className={cx('flex items-center gap-1.5 rounded-lg py-0.5 pl-2 pr-1 transition-colors hover:bg-hover', breakdown && 'bg-hover')}
          >
            <span className="text-[12.5px] text-faint">Balance</span>
            <span
              className="rounded-lg px-2 py-0.5 text-[13.5px] font-semibold tabular-nums"
              style={{ color: isZero(balance) ? TONE.full : balance < 0 ? TONE.over : TONE.full, background: `color-mix(in oklab, ${balance < -0.5 ? TONE.over : TONE.full} 13%, transparent)` }}
            >
              {fmtH(balance, style, true)}
            </span>
            <ChevronDown size={14} className="text-faint" style={{ transform: `rotate(${breakdown ? 180 : 0}deg)`, transition: 'transform .25s cubic-bezier(.32,.72,0,1)' }} />
          </button>
          </div>
        </div>
        <WeekStrip keys={keys} viewKey={viewKey} today={today} onPick={setViewKey} workdays={s.workdays} byDay={byDay} settings={settings} holidays={holidays} />
        <Collapse open={breakdown}>
          <HoursBreakdown keys={keys} viewKey={viewKey} style={style} settings={settings} onPick={setViewKey} />
        </Collapse>
      </div>

      {/* Anillo y cifras del día */}
      <section className="entra mt-4 rounded-2xl border border-line bg-surface p-4 shadow-soft sm:p-5" style={{ '--entra-espera': '120ms' }}>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
          <Ring worked={st.worked} imputed={st.imputed} target={day.target_minutes} tone={tone}>
            {big != null && <span className="text-[38px] font-semibold tabular-nums leading-none tracking-[-0.03em]" style={{ color: tone ? TONE[tone] : undefined }}>{big}</span>}
            <span className={cx('mt-1.5 text-[13px]', big == null ? 'text-[15px] font-medium text-muted' : 'text-muted')}>{caption}</span>
            {big != null && st.pendTot > 0.5 && !isZero(st.pendNow - st.pendTot) && <span className="mt-1 text-[11.5px] text-faint">{fmtH(st.pendTot, style)} en todo el día</span>}
          </Ring>

          <div className="grid w-full flex-1 grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <div className="text-[12px] font-medium text-faint">Entrada</div>
              <div className="mt-1 flex items-center gap-1.5">
                <TimeField value={day.start} step={settings.step} onChange={(v) => save({ start: v })} label="Hora de entrada" className="w-[6.5rem]" />
                {!day.start && isToday && (
                  <IconButton label="Fichar ahora" size="sm" onClick={() => save({ start: toHM(quantize(nowMin, settings.step)) })} className="text-accent">
                    <LogIn size={16} />
                  </IconButton>
                )}
              </div>
            </div>
            <Stat
              label="Salida prevista"
              sub={
                st.exit != null && isToday && !day.end
                  ? nowMin < st.exit
                    ? `Para salir: ${fmtSpan(st.exit - nowMin)}`
                    : 'Ya puedes salir'
                  : day.end
                    ? `Salida real ${day.end}`
                    : null
              }
              extra={
                extra && !isZero(extra.minutes) && (
                  <span className="mt-1 inline-flex rounded-md px-1.5 py-0.5 text-[12px] font-semibold tabular-nums" style={extraStyle(extra.minutes)}>
                    {fmtDelta(extra.minutes)} {extra.minutes > 0 ? 'de más' : 'antes de hora'}
                    {extra.live && <span className="ml-1 font-normal opacity-75">· contando</span>}
                  </span>
                )
              }
            >
              {st.exit == null ? <span className="text-faint">—</span> : (
                <>
                  {toHM(st.exit)}
                  {st.exit >= 1440 && <span className="ml-1 text-[12px] font-normal text-faint">(+1 día)</span>}
                </>
              )}
            </Stat>
            <Stat label="Trabajado" sub={`de ${fmtH(day.target_minutes, style)} de jornada`}>
              {st.worked == null ? <span className="text-faint">—</span> : fmtH(st.worked, style)}
            </Stat>
            <Stat label="Imputado" sub={st.pendTot > 0.5 ? `faltan ${fmtH(st.pendTot, style)}` : st.pendTot < -0.5 ? `${fmtH(-st.pendTot, style)} por encima` : day.target_minutes ? 'jornada cubierta' : null}>
              <span style={{ color: tone ? TONE[tone] : undefined }}>{fmtH(st.imputed, style)}</span>
            </Stat>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Utensils size={13} className="text-faint" />
            {day.lunch_minutes === 0
              ? 'Sin comida hoy'
              : !day.start
                ? `Comida ${fmtSpan(day.lunch_minutes)} desde las ${day.lunch_from}`
                : !lunchApplies
                  ? 'La jornada acaba antes de comer: no se descuenta'
                  : isToday && nowMin < lunchFrom
                    ? `Comida a las ${day.lunch_from} (${fmtSpan(day.lunch_minutes)})`
                    : isToday && nowMin < lunchFrom + day.lunch_minutes
                      ? 'Comiendo ahora'
                      : `Comida descontada (${fmtSpan(day.lunch_minutes)})`}
          </span>
          <div className="flex-1" />
          <button onClick={() => setSetup((v) => !v)} className={cx('inline-flex h-8 items-center gap-1.5 rounded-lg px-2 transition-colors hover:bg-hover hover:text-ink', setup && 'bg-hover text-ink')}>
            <SlidersHorizontal size={13} /> Ajustes del día
          </button>
        </div>
        <Collapse open={setup}>
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3 pt-3">
            <label className="text-[12px] font-medium text-faint">
              Jornada
              <div className="mt-1">
                <DurationField minutes={day.target_minutes} style={style} step={settings.step} onCommit={(m) => save({ target_minutes: m })} label="Jornada" />
              </div>
            </label>
            <label className="text-[12px] font-medium text-faint">
              Comida
              <div className="mt-1">
                <DurationField minutes={day.lunch_minutes} style={style} step={5} onCommit={(m) => save({ lunch_minutes: m })} label="Comida" />
              </div>
            </label>
            <label className="text-[12px] font-medium text-faint">
              Comida desde
              <div className="mt-1">
                <TimeField value={day.lunch_from} step={5} allowEmpty={false} onChange={(v) => save({ lunch_from: v })} label="Comida desde" className="w-[6.5rem]" />
              </div>
            </label>
            <label className="text-[12px] font-medium text-faint">
              Salida real
              <div className="mt-1">
                <TimeField value={day.end} step={settings.step} onChange={(v) => save({ end: v })} label="Salida real" className="w-[6.5rem]" />
              </div>
            </label>
            {day.exists && (
              <Button variant="ghost" size="sm" onClick={() => s.resetDay(viewKey)} title="Vuelve a poner la jornada y la comida de tu horario para este día de la semana">
                <RotateCcw size={13} /> Horario de la semana
              </Button>
            )}
          </div>
          <p className="pt-2 text-[12px] text-faint">
            Solo cambia este día. El horario de cada día de la semana, la precisión y los festivos están en{' '}
            <Link to="/ajustes#horas" className="text-accent underline-offset-4 hover:underline">Ajustes → Parte de horas</Link>.
          </p>
        </Collapse>
      </section>

      <div className="entra mt-4" style={{ '--entra-espera': '160ms' }}>
        <AddEntry viewKey={viewKey} settings={settings} suggestedMinutes={suggested} />
      </div>

      {list.length > 0 ? (
        <Block
          title="Partes"
          right={<span className="text-[12.5px] tabular-nums text-muted">{fmtH(st.imputed, style)}{day.target_minutes ? ` / ${fmtH(day.target_minutes, style)}` : ''}</span>}
        >
          {list.map((e) => (
            <EntryRow key={e.id} entry={e} style={style} step={settings.step} onOpenCard={open} />
          ))}
        </Block>
      ) : (
        <Empty icon={Clock} title={isToday ? 'Aún no has imputado nada hoy' : 'Sin partes este día'}>
          Escribe el cliente, la tarea y las horas, y pulsa Intro. El cliente se queda puesto para la siguiente.
        </Empty>
      )}

      <HoursExport open={exporting} onClose={() => setExporting(false)} viewKey={viewKey} settings={settings} />
    </div>
  )
}

