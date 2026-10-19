import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Clock, Plus, Trash2 } from 'lucide-react'
import { get } from '../lib/api'
import { useStore } from '../lib/store'
import { fmt } from '../lib/dates'
import { dateOf, dayKey, fmtH, hoursSettings, parseDuration, quantize } from '../lib/hours'
import { clientOfProject, DurationChips } from './HoursParts'
import { Button, IconButton } from './ui'

/* Horas de una tarjeta: lo imputado frente a la estimación y un atajo para
   imputar sin salir de ella. Solo en proyectos con el parte activado. */
export function CardHours({ card, project }) {
  const s = useStore()
  const total = s.cardHours[card.id] || 0
  const settings = hoursSettings(s.user)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [day, setDay] = useState(() => dayKey(new Date()))
  const [list, setList] = useState([])

  // Los partes de la tarjeta: se piden al abrirla y cuando cambia su total
  useEffect(() => {
    let alive = true
    get(`/hours/cards/${card.id}`)
      .then((r) => {
        if (!alive) return
        setList(r)
        s.mergeEntries(r)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [card.id, total])

  const minutes = parseDuration(text)
  const est = card.estimate_minutes
  const submit = async () => {
    if (!minutes || minutes <= 0) return
    const m = Math.max(settings.step, quantize(minutes, settings.step))
    const e = await s.addEntry({ day, client: clientOfProject(project), task: card.title || 'Sin título', minutes: m, card_id: card.id })
    if (e) {
      setText('')
      setAdding(false)
    }
  }
  const pct = est ? Math.min(1, total / est) : 0
  const over = est && total > est

  return (
    <div className="mt-5">
      <div className="flex items-center gap-1.5 px-2 text-[12.5px] font-medium text-muted">
        <Clock size={13} /> Horas
        <span className="font-normal tabular-nums text-faint">
          · {fmtH(total, settings.format)} imputadas{est ? ` de ${fmtH(est, settings.format)} estimadas` : ''}
        </span>
        <div className="flex-1" />
        {!adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus size={14} /> Imputar
          </Button>
        )}
      </div>
      {est > 0 && (
        <div className="mx-2 mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className="h-full origin-left rounded-full" style={{ transform: `scaleX(${pct})`, background: over ? 'var(--tc-ambar)' : 'var(--accent)', transition: 'transform .45s cubic-bezier(.32,.72,0,1)' }} />
        </div>
      )}
      {adding && (
        <div className="entra mx-1 mt-2 rounded-xl border border-line bg-sunken p-2.5" style={{ '--entra-dura': '200ms' }}>
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setAdding(false)
                }
              }}
              inputMode="decimal"
              placeholder="Horas"
              className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-right text-[15px] tabular-nums outline-none"
            />
            <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13.5px] outline-none" />
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button size="sm" variant="primary" onClick={submit} disabled={!minutes}>
              Imputar
            </Button>
          </div>
          <div className="mt-2">
            <DurationChips step={settings.step} value={minutes} onPick={(m) => setText(fmtH(m, settings.format))} />
          </div>
          <p className="mt-2 text-[12px] text-faint">
            Cliente «{clientOfProject(project)}», tarea «{card.title || 'Sin título'}». Se ve en <Link to="/horas" className="text-accent">Horas</Link>.
          </p>
        </div>
      )}
      {list.length > 0 && (
        <div className="mt-1">
          {list.filter((e) => s.entries[e.id]).slice(0, 6).map((e) => (
            <div key={e.id} className="group flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] hover:bg-hover">
              <span className="w-24 shrink-0 text-faint first-letter:uppercase">{fmt(dateOf(e.day), 'EEE d MMM')}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{e.task}</span>
              <span className="tabular-nums text-ink">{fmtH(e.minutes, settings.format)}</span>
              <IconButton label="Eliminar parte" size="sm" onClick={() => s.deleteEntry(e.id)} className="size-7 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100">
                <Trash2 size={13} />
              </IconButton>
            </div>
          ))}
          {list.length > 6 && <p className="px-2 text-[12px] text-faint">y {list.length - 6} más</p>}
        </div>
      )}
    </div>
  )
}
