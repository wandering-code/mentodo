import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { get } from '../lib/api'
import { useStore } from '../lib/store'
import { DEFAULT_SCHEDULE, fmtH, hoursOn, hoursSettings, parseDuration, quantize, WEEKDAYS } from '../lib/hours'
import { cx, Toggle } from './ui'

/* Ajustes → Módulos y Ajustes → Parte de horas. Todo va en user.prefs: el
   módulo apagado no deja rastro en ninguna otra parte de la app. */

export function ModulesSettings() {
  const s = useStore()
  const on = hoursOn(s.user)
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 text-[14px] shadow-soft">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Clock size={18} />
        </span>
        <span className="flex-1">
          <span className="font-medium">Parte de horas</span>
          <span className="block text-[12.5px] text-muted">
            Ficha la entrada, imputa horas a cliente y tarea, mira tu salida prevista y el balance de la semana, y exporta a CSV. Añade «Horas» al menú y, en los proyectos donde lo actives, imputar desde las tarjetas.
          </span>
        </span>
        <Toggle checked={on} onChange={(v) => s.updateMe({ prefs: { mod_hours: v } })} label="Parte de horas" />
      </label>
    </div>
  )
}

function SmallDuration({ minutes, onCommit, style, step }) {
  const [text, setText] = useState(fmtH(minutes, style))
  useEffect(() => setText(fmtH(minutes, style)), [minutes, style])
  return (
    <input
      inputMode="decimal"
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const v = parseDuration(text)
        if (v == null || v < 0) return setText(fmtH(minutes, style))
        const q = Math.min(1440, quantize(v, step))
        setText(fmtH(q, style))
        if (q !== minutes) onCommit(q)
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-right text-[14.5px] tabular-nums outline-none focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--line))]"
    />
  )
}

export function HoursSettings() {
  const s = useStore()
  const st = hoursSettings(s.user)
  const [regions, setRegions] = useState(null)
  useEffect(() => {
    get(`/holidays?region=&years=${new Date().getFullYear()}`)
      .then((d) => setRegions(d.regions))
      .catch(() => {})
  }, [])
  const save = (patch) => s.updateMe({ prefs: { hours: { ...(s.user.prefs?.hours || {}), ...patch } } })
  const setDay = (i, patch) => save({ schedule: st.schedule.map((d, j) => (j === i ? { ...d, ...patch } : d)) })
  const seg = (active) => cx('h-8 rounded-lg px-3 text-[13px] transition-colors', active ? 'bg-surface font-medium text-ink shadow-soft' : 'text-muted hover:text-ink')
  const sub = 'text-[13.5px] font-medium text-muted'

  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className={sub}>Horario de la semana</div>
        <p className="mt-0.5 text-[12.5px] text-faint">Lo que copia cada día al empezar a usarlo. Cambiarlo no toca los días ya rellenados (cada día se puede ajustar suelto en Horas).</p>
        <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_6.2rem] items-center gap-2 border-b border-line bg-sunken px-3 py-2 text-[11.5px] font-medium uppercase tracking-wide text-faint sm:grid-cols-[minmax(0,1fr)_6rem_6rem_7rem]">
            <span>Día</span>
            <span className="text-right">Jornada</span>
            <span className="text-right">Comida</span>
            <span>Desde</span>
          </div>
          {st.schedule.map((d, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_6.2rem] items-center gap-2 border-b border-line px-3 py-1.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_6rem_6rem_7rem]">
              <span className={cx('truncate text-[14px]', d.target ? 'text-ink' : 'text-faint')}>{WEEKDAYS[i]}</span>
              <SmallDuration minutes={d.target} style={st.format} step={st.step} onCommit={(m) => setDay(i, { target: m })} />
              <SmallDuration minutes={d.lunch} style={st.format} step={5} onCommit={(m) => setDay(i, { lunch: m })} />
              <input
                type="time"
                step={300}
                value={d.lunch_from}
                onChange={(e) => e.target.value && setDay(i, { lunch_from: e.target.value })}
                className="h-9 w-full rounded-lg border border-line bg-surface px-1.5 text-[14px] tabular-nums outline-none"
              />
            </div>
          ))}
        </div>
        <button onClick={() => save({ schedule: DEFAULT_SCHEDULE })} className="mt-2 text-[12.5px] text-faint underline-offset-4 hover:text-muted hover:underline">
          Volver al horario por defecto (L–J 8 h + 45 min de comida desde las 14:30, viernes 8 h sin comida)
        </button>
        <p className="mt-1 text-[12.5px] text-faint">La comida solo alarga el día si la jornada llega a la hora de comer: entrar a las 6:00 con 6 h acaba a las 12:00.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className={sub}>Precisión</div>
          <p className="mt-0.5 text-[12.5px] text-faint">Todo se redondea a este paso: horas, entrada y salida.</p>
          <div className="mt-2 inline-flex rounded-xl bg-sunken p-1">
            {[5, 15, 30].map((m) => (
              <button key={m} onClick={() => save({ step: m })} className={seg(st.step === m)}>
                {m === 15 ? 'Cuartos' : `${m} min`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className={sub}>Formato</div>
          <p className="mt-0.5 text-[12.5px] text-faint">Cómo se ven y se escriben las horas.</p>
          <div className="mt-2 inline-flex rounded-xl bg-sunken p-1">
            <button onClick={() => save({ format: 'dec' })} className={seg(st.format === 'dec')}>
              8,25
            </button>
            <button onClick={() => save({ format: 'hm' })} className={seg(st.format === 'hm')}>
              8:15
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className={sub}>Festivos</div>
        <p className="mt-0.5 text-[12.5px] text-faint">Un festivo nace con jornada 0: no resta en el balance ni pide horas.</p>
        <select
          value={st.region == null ? 'none' : st.region}
          onChange={(e) => save({ region: e.target.value === 'none' ? null : e.target.value })}
          className="mt-2 h-10 w-full max-w-xs rounded-lg border border-line bg-surface px-2.5 text-[14.5px] outline-none"
        >
          <option value="none">Sin festivos</option>
          {regions && Object.entries(regions).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-4">
        <div className={sub}>Avisos y Hoy</div>
        <label className="flex items-center gap-3 text-[14px]">
          <span className="flex-1">
            Avisar de la hora de salida
            <span className="block text-[12.5px] text-faint">Un aviso (también push) antes de la salida prevista, con lo que te queda por imputar</span>
          </span>
          {st.notify_exit != null && (
            <select value={st.notify_exit} onChange={(e) => save({ notify_exit: Number(e.target.value) })} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13.5px] outline-none">
              {[0, 5, 10, 15, 30].map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? 'A la hora' : `${m} min antes`}
                </option>
              ))}
            </select>
          )}
          <Toggle checked={st.notify_exit != null} onChange={(v) => save({ notify_exit: v ? 10 : null })} />
        </label>
        <label className="flex items-center gap-3 text-[14px]">
          <span className="flex-1">
            Cierre del día
            <span className="block text-[12.5px] text-faint">A esa hora, aviso si queda jornada sin imputar</span>
          </span>
          {st.notify_close && (
            <input type="time" step={300} value={st.notify_close} onChange={(e) => e.target.value && save({ notify_close: e.target.value })} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13.5px] tabular-nums outline-none" />
          )}
          <Toggle checked={!!st.notify_close} onChange={(v) => save({ notify_close: v ? '18:00' : null })} />
        </label>
        <label className="flex items-center gap-3 text-[14px]">
          <span className="flex-1">
            Recuadro en Hoy
            <span className="block text-[12.5px] text-faint">Lo que llevas sin imputar y tu salida, arriba de la página Hoy</span>
          </span>
          <Toggle checked={st.today_widget !== false} onChange={(v) => save({ today_widget: v })} />
        </label>
      </div>
    </div>
  )
}
