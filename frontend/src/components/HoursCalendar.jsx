import { useEffect, useMemo, useState } from 'react'
import { addDays, addMonths, endOfMonth, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { fmt } from '../lib/dates'
import { dateOf, dayKey, dayOf, entriesByDay, extraOf, fmtDelta, fmtH, isZero, sumMinutes, useHolidays, WEEKDAYS_SHORT } from '../lib/hours'
import { cx, IconButton } from './ui'

/* Para las casillas del calendario, lo más corto posible: +45m · +1h · +1h30 */
const shortDelta = (min) => {
  const m = Math.round(Math.abs(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  return (min < 0 ? '−' : '+') + (h ? `${h}h${r ? String(r).padStart(2, '0') : ''}` : `${r}m`)
}

const RED = 'var(--tc-rojo)'
const GREEN = 'var(--tc-verde)'
const AMBER = 'var(--tc-ambar)'

/* Calendario del mes: en cada día, su balance (imputado − jornada, solo si
   tiene partes) y sus horas de más. En rojo, los días en que te quedaste más
   allá de la salida prevista. Tocar un día lo abre arriba. */
export function HoursCalendar({ viewKey, style, settings, onPick }) {
  const s = useStore()
  const [month, setMonth] = useState(() => startOfMonth(dateOf(viewKey)))
  // Si arriba se cambia a otro mes (flechas de la semana), el calendario lo sigue
  useEffect(() => setMonth(startOfMonth(dateOf(viewKey))), [viewKey.slice(0, 7)]) // eslint-disable-line react-hooks/exhaustive-deps

  const first = dayKey(month)
  const last = dayKey(endOfMonth(month))
  useEffect(() => {
    s.loadHours(first, last)
  }, [first]) // eslint-disable-line react-hooks/exhaustive-deps

  const holidays = useHolidays(settings.region, [month.getFullYear()])
  const byDay = useMemo(() => entriesByDay(s.entries), [s.entries])
  const now = new Date()
  const today = dayKey(now)

  const cells = useMemo(() => {
    const out = []
    const start = startOfWeek(month, { weekStartsOn: 1 })
    for (let d = start; out.length < 42; d = addDays(d, 1)) {
      const k = dayKey(d)
      if (out.length >= 35 && k > last) break
      out.push(k)
    }
    return out
  }, [month, last])

  const info = (k) => {
    const day = dayOf(s.workdays, k, settings, holidays)
    const list = byDay[k] || []
    const imputed = sumMinutes(list)
    const balance = list.length ? imputed - day.target_minutes : null
    const x = extraOf(day, k, now)
    return { day, imputed, balance, extra: x && !isZero(x.minutes) ? x : null }
  }

  // Resumen del mes
  const sum = useMemo(() => {
    let imputed = 0
    let balance = 0
    let extra = 0
    let over = 0
    for (let d = month; dayKey(d) <= last; d = addDays(d, 1)) {
      const i = info(dayKey(d))
      imputed += i.imputed
      if (i.balance != null) balance += i.balance
      if (i.extra) {
        extra += i.extra.minutes
        if (i.extra.minutes > 0) over += 1
      }
    }
    return { imputed, balance, extra, over }
  }, [month, last, s.entries, s.workdays, holidays, settings]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-center gap-1">
        <IconButton label="Mes anterior" size="sm" onClick={() => setMonth((m) => addMonths(m, -1))}>
          <ChevronLeft size={16} />
        </IconButton>
        <span className="min-w-[8.5rem] text-center text-[13.5px] font-medium first-letter:uppercase">{fmt(month, "MMMM 'de' yyyy")}</span>
        <IconButton label="Mes siguiente" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight size={16} />
        </IconButton>
        <div className="flex-1" />
        <span className="hidden items-center gap-3 text-[11.5px] text-faint sm:flex">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: RED }} /> Horas de más
          </span>
        </span>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="pb-0.5 text-center text-[11px] font-medium text-faint">
            {w}
          </div>
        ))}
        {cells.map((k) => {
          const inMonth = k >= first && k <= last
          const { day, imputed, balance, extra } = info(k)
          const over = extra && extra.minutes > 0
          const off = day.target_minutes === 0 && !imputed
          const title = [
            fmt(dateOf(k), "EEEE d 'de' MMMM"),
            holidays.has(k) ? 'festivo' : null,
            imputed ? `imputado ${fmtH(imputed, style)} de ${fmtH(day.target_minutes, style)}` : null,
            balance != null ? `balance ${fmtH(balance, style, true)}` : null,
            extra ? `${fmtDelta(extra.minutes)} ${extra.minutes > 0 ? 'de más' : 'antes de hora'}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <button
              key={k}
              title={title}
              onClick={() => onPick(k)}
              className={cx(
                'relative flex min-h-[3.6rem] flex-col items-start rounded-lg border p-1 text-left transition-colors sm:min-h-[4.4rem] sm:p-1.5',
                !inMonth && 'opacity-35',
                k === viewKey ? 'border-[color-mix(in_oklab,var(--accent)_45%,var(--line))]' : over ? 'border-transparent' : 'border-transparent hover:bg-hover',
                             )}
              style={over ? { background: `color-mix(in oklab, ${RED} 14%, transparent)` } : undefined}
            >
              <span className={cx('text-[12px] font-semibold tabular-nums leading-none', off ? 'text-faint' : 'text-ink', k === today && 'text-accent')} style={over ? { color: RED } : undefined}>
                {Number(k.slice(8))}
              </span>
              <span className="mt-auto flex w-full flex-col gap-0.5">
                {balance != null && (
                  <span
                    className="truncate text-[10.5px] font-medium tabular-nums leading-none sm:text-[11.5px]"
                    style={{ color: isZero(balance) ? GREEN : balance < 0 ? AMBER : GREEN }}
                  >
                    {fmtH(balance, style, true)}
                  </span>
                )}
                {extra && (
                  <span className="truncate text-[10.5px] font-semibold tabular-nums leading-none sm:text-[11.5px]" style={{ color: extra.minutes > 0 ? RED : 'var(--muted)' }}>
                    {shortDelta(extra.minutes)}
                  </span>
                )}
              </span>
              {k === today && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" />}
            </button>
          )
        })}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-[12.5px] sm:grid-cols-4">
        <div>
          <div className="text-faint">Imputado</div>
          <div className="text-[14px] font-semibold tabular-nums">{fmtH(sum.imputed, style)}</div>
        </div>
        <div>
          <div className="text-faint">Balance</div>
          <div className="text-[14px] font-semibold tabular-nums" style={{ color: isZero(sum.balance) ? GREEN : sum.balance < 0 ? AMBER : GREEN }}>
            {fmtH(sum.balance, style, true)}
          </div>
        </div>
        <div>
          <div className="text-faint">Horas de más</div>
          <div className="text-[14px] font-semibold tabular-nums" style={{ color: sum.extra > 0 ? RED : undefined }}>
            {isZero(sum.extra) ? '—' : fmtDelta(sum.extra)}
          </div>
        </div>
        <div>
          <div className="text-faint">Días pasados</div>
          <div className="text-[14px] font-semibold tabular-nums" style={{ color: sum.over ? RED : undefined }}>
            {sum.over}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11.5px] text-faint">Arriba, el balance del día (imputado − jornada); debajo, lo que te quedaste de más según tu salida real. En rojo, los días que te pasaste.</p>
    </div>
  )
}
