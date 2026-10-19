import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { endOfMonth, startOfMonth } from 'date-fns'
import { useStore } from '../lib/store'
import { dateOf, dayKey, fmtH } from '../lib/hours'
import { clientOfProject } from './HoursParts'
import { Collapse, cx } from './ui'
import { HoursCalendar } from './HoursCalendar'

const TABS = [
  { id: 'projects', name: 'Por proyecto' },
  { id: 'calendar', name: 'Calendario' },
]

/* Panel que se abre desde el Balance: reparto por proyecto o calendario del
   mes. La pestaña elegida se recuerda en el dispositivo. */
export function HoursBreakdown({ keys, viewKey, style, settings, onPick }) {
  const userId = useStore((s) => s.user?.id)
  const storeKey = `mentodo:hours-panel:${userId}`
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem(storeKey) === 'calendar' ? 'calendar' : 'projects'
    } catch {
      return 'projects'
    }
  })
  const choose = (t) => {
    setTab(t)
    try {
      localStorage.setItem(storeKey, t)
    } catch {}
  }
  return (
    <div className="mt-3 rounded-2xl border border-line bg-surface p-3 shadow-soft sm:p-4">
      <div className="mb-2 inline-flex rounded-xl bg-sunken p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => choose(t.id)} className={cx('h-8 rounded-lg px-3 text-[13px] transition-colors', tab === t.id ? 'bg-surface font-medium text-ink shadow-soft' : 'text-muted hover:text-ink')}>
            {t.name}
          </button>
        ))}
      </div>
      {tab === 'projects' ? <ProjectBreakdown keys={keys} viewKey={viewKey} style={style} /> : <HoursCalendar viewKey={viewKey} style={style} settings={settings} onPick={onPick} />}
    </div>
  )
}

/* Desglose de lo imputado por proyecto (o por cliente, si el parte no va
   unido a ningún proyecto), de la semana vista o de su mes. El balance en sí
   no se reparte: la jornada es del día, no de un proyecto. */
function ProjectBreakdown({ keys, viewKey, style }) {
  const s = useStore()
  const [period, setPeriod] = useState('week')
  const [openKey, setOpenKey] = useState(null)
  const range = useMemo(() => {
    if (period === 'week') return { start: keys[0], end: keys[6] }
    const d = dateOf(viewKey)
    return { start: dayKey(startOfMonth(d)), end: dayKey(endOfMonth(d)) }
  }, [period, keys, viewKey])

  useEffect(() => {
    if (period === 'month') s.loadHours(range.start, range.end)
  }, [period, range.start]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const map = new Map()
    for (const e of Object.values(s.entries)) {
      if (e.day < range.start || e.day > range.end) continue
      const p = e.project_id ? s.projects[e.project_id] : null
      const key = p ? `p:${p.id}` : `c:${(e.client || '').trim().toLowerCase()}`
      const g = map.get(key) || { key, project: p, name: p ? p.name : e.client.trim() || 'Sin cliente', client: p ? clientOfProject(p) : null, minutes: 0, tasks: new Map() }
      g.minutes += e.minutes
      const t = e.task.trim() || 'Sin tarea'
      g.tasks.set(t, (g.tasks.get(t) || 0) + e.minutes)
      map.set(key, g)
    }
    return [...map.values()].sort((a, b) => b.minutes - a.minutes)
  }, [s.entries, s.projects, range])
  const total = groups.reduce((a, g) => a + g.minutes, 0)
  const seg = (on) => cx('h-7 rounded-md px-2.5 text-[12.5px] transition-colors', on ? 'bg-surface font-medium text-ink shadow-soft' : 'text-muted hover:text-ink')

  return (
    <div>
      <div className="flex items-center justify-end gap-2">
        <div className="inline-flex rounded-lg bg-sunken p-0.5">
          <button onClick={() => setPeriod('week')} className={seg(period === 'week')}>
            Semana
          </button>
          <button onClick={() => setPeriod('month')} className={seg(period === 'month')}>
            Mes
          </button>
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-faint">Nada imputado {period === 'week' ? 'esta semana' : 'este mes'}.</p>
      ) : (
        <div className="mt-2">
          {groups.map((g) => {
            const open = openKey === g.key
            const pct = total ? g.minutes / total : 0
            return (
              <div key={g.key}>
                <button onClick={() => setOpenKey(open ? null : g.key)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-hover">
                  <ChevronRight size={14} className="shrink-0 text-faint" style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: 'transform .25s cubic-bezier(.32,.72,0,1)' }} />
                  <span className="w-4 shrink-0 text-center text-[13px]">{g.project?.icon || ''}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px]">{g.name}</span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sunken">
                      <span className="block h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${pct})`, transition: 'transform .45s cubic-bezier(.32,.72,0,1)' }} />
                    </span>
                  </span>
                  <span className="w-14 shrink-0 text-right text-[14px] font-semibold tabular-nums">{fmtH(g.minutes, style)}</span>
                  <span className="w-10 shrink-0 text-right text-[12px] tabular-nums text-faint">{Math.round(pct * 100)} %</span>
                </button>
                <Collapse open={open}>
                  <div className="pb-1.5 pl-[3.25rem] pr-[3.6rem]">
                    {[...g.tasks.entries()].sort((a, b) => b[1] - a[1]).map(([t, m]) => (
                      <div key={t} className="flex items-center gap-2 py-1 text-[13px]">
                        <span className="min-w-0 flex-1 truncate text-muted">{t}</span>
                        <span className="tabular-nums text-ink">{fmtH(m, style)}</span>
                      </div>
                    ))}
                  </div>
                </Collapse>
              </div>
            )
          })}
          <div className="mt-1 flex items-center border-t border-line px-1.5 pt-2 text-[12.5px] text-muted">
            <span className="flex-1">Total imputado</span>
            <span className="font-semibold tabular-nums text-ink">{fmtH(total, style)}</span>
            <span className="w-10" />
          </div>
        </div>
      )}
    </div>
  )
}
