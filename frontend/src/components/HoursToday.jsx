import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Clock, LogIn } from 'lucide-react'
import { useStore } from '../lib/store'
import { dayKey, dayOf, dayStatus, extraOf, fmtDelta, entriesByDay, fmtH, fmtSpan, hoursOn, hoursSettings, quantize, toHM, useHolidays, weekOf } from '../lib/hours'

/* Recuadro del parte de horas arriba de Hoy (si el módulo está activo y no se
   ha apagado en Ajustes → Parte de horas) */
export function HoursToday() {
  const s = useStore()
  const on = hoursOn(s.user) && hoursSettings(s.user).today_widget !== false
  const [now, setNow] = useState(() => new Date())
  const today = dayKey(now)
  useEffect(() => {
    if (!on) return
    const w = weekOf(now)
    s.loadHours(dayKey(w[0]), dayKey(w[6]))
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [on, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const settings = hoursSettings(s.user)
  const holidays = useHolidays(on ? settings.region : null, [now.getFullYear()])
  const list = useMemo(() => entriesByDay(s.entries)[today] || [], [s.entries, today])
  if (!on) return null
  const day = dayOf(s.workdays, today, settings, holidays)
  if (day.target_minutes === 0 && !list.length) return null
  const st = dayStatus(day, today, list, now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const f = (m) => fmtH(m, settings.format)
  const extra = settings.today_extra ? extraOf(day, today, now) : null

  return (
    <div className="entra mt-5 flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 shadow-soft" style={{ '--entra-espera': '100ms' }}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
        <Clock size={17} />
      </span>
      <div className="min-w-0 flex-1 text-[13.5px]">
        {!day.start ? (
          <span className="text-muted">Aún no has fichado la entrada</span>
        ) : (
          <>
            <span className="font-semibold tabular-nums text-ink">
              {st.pendNow > 0.5 ? `${f(st.pendNow)} sin imputar` : st.pendTot <= 0.5 ? 'Todo imputado ✓' : 'Al día'}
            </span>
            <span className="block truncate text-[12.5px] text-muted">
              {f(st.imputed)} de {f(day.target_minutes)}
              {st.exit != null && !day.end && ` · sales a las ${toHM(st.exit)}${nowMin < st.exit ? ` (en ${fmtSpan(st.exit - nowMin)})` : ''}`}
              {extra && Math.abs(extra.minutes) >= 1 && (
                <span className="font-medium" style={{ color: extra.minutes > 0 ? 'var(--tc-ambar)' : undefined }}>
                  {' · '}
                  {fmtDelta(extra.minutes)} {extra.minutes > 0 ? 'de más' : 'antes de hora'}
                </span>
              )}
            </span>
          </>
        )}
      </div>
      {!day.start && (
        <button onClick={() => s.saveDay(today, { start: toHM(quantize(nowMin, settings.step)) })} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-2.5 text-[13px] font-medium text-accent-ink">
          <LogIn size={14} /> Fichar
        </button>
      )}
      <Link to="/horas" aria-label="Abrir Horas" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-hover hover:text-ink">
        <ChevronRight size={17} />
      </Link>
    </div>
  )
}
