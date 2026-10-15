import { useEffect, useMemo, useState } from 'react'
import { ChartNoAxesColumn, ChevronLeft, ChevronRight, Download, Minus, Plus, RotateCcw, Settings2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { get } from '../lib/api'
import { fmt } from '../lib/dates'
import { groupLabels, projectGroups } from '../lib/cards'
import { buildReport, dayKey, propDate, toCsv } from '../lib/workdays'
import { projectProps } from '../lib/props'
import { Button, cx, Divider, Empty, IconButton, LabelChip, MenuLabel, Popover, usePopover } from '../components/ui'

const holidayCache = {}

function useHolidays(region, years, extra) {
  const [state, setState] = useState({ set: new Set(), list: [], regions: {} })
  const yearsKey = years.join(',')
  useEffect(() => {
    let alive = true
    const k = `${region}|${yearsKey}`
    const done = (d) => {
      if (!alive) return
      const set = new Set(d.holidays.map((h) => h.date))
      for (const x of extra) set.add(x)
      setState({ set, list: d.holidays, regions: d.regions })
    }
    if (holidayCache[k]) done(holidayCache[k])
    else
      get(`/holidays?region=${region}&years=${yearsKey}`)
        .then((d) => {
          holidayCache[k] = d
          done(d)
        })
        .catch(() => {})
    return () => {
      alive = false
    }
  }, [region, yearsKey, extra.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  return state
}

/* Fechas escritas a mano: 22/01/2026, 2026-01-22… */
function parseExtra(text) {
  return text
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
      if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
      m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
      if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
      return null
    })
    .filter(Boolean)
}

const nf = (n) => String(n).replace('.', ',')

export function ReportView({ project, view, onOpen }) {
  const s = useStore()
  const cfg = { region: 'VC', label_ids: [], start: 'due', end: null, extra_holidays: [], overrides: {}, ...view.config }
  const setCfg = (patch) => s.updateView(view.id, { config: { ...view.config, ...patch } })
  const [year, setYear] = useState(() => new Date().getFullYear())
  const conf = usePopover()

  const cards = useMemo(() => Object.values(s.cards).filter((c) => c.project_id === project.id && !s.hidden[c.id]), [s.cards, s.hidden, project.id])

  // Años que tocan las tarjetas (para pedir sus festivos)
  const years = useMemo(() => {
    const ys = new Set([year, new Date().getFullYear()])
    for (const c of cards) {
      for (const k of [cfg.start, cfg.end]) {
        const d = propDate(c, k)
        if (d) ys.add(d.getFullYear())
      }
    }
    return [...ys].sort().slice(-6)
  }, [cards, cfg.start, cfg.end, year])

  const hol = useHolidays(cfg.region, years, cfg.extra_holidays || [])
  const { rows, missing } = useMemo(() => buildReport({ cards, config: cfg, holidays: hol.set }), [cards, view.config, hol.set]) // eslint-disable-line react-hooks/exhaustive-deps

  const yearRows = rows.filter((r) => r.month.startsWith(String(year)))
  const byMonth = useMemo(() => {
    const m = {}
    for (const r of yearRows) (m[r.month] ||= []).push(r)
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
  }, [yearRows])
  const yearTotal = yearRows.reduce((a, r) => a + r.days, 0)

  const adjust = (row, delta) => {
    const next = Math.max(0, Math.round((row.days + delta) * 2) / 2)
    const overrides = { ...(cfg.overrides || {}) }
    if (next === row.auto) delete overrides[row.key]
    else overrides[row.key] = next
    setCfg({ overrides })
  }

  const download = () => {
    const blob = new Blob([toCsv(yearRows)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `jornadas-${project.name.toLowerCase().replace(/\s+/g, '-')}-${year}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const props = projectProps(s, project.id)
  const dateProps = props.filter((p) => p.key === 'due' || p.field?.kind === 'date')
  const propName = (k) => props.find((p) => p.key === k)?.name || '—'
  const chosen = (cfg.label_ids || []).map((id) => s.labels[id]).filter(Boolean)
  const configured = chosen.length > 0 && cfg.start

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 sm:px-8">
      {/* Qué se cuenta */}
      <button
        onClick={conf.toggle}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left text-[13.5px] shadow-soft transition-colors hover:border-[color-mix(in_oklab,var(--ink)_14%,var(--line))]"
      >
        <Settings2 size={15} className="text-faint" />
        <span className="text-muted">Cuenta</span>
        {chosen.length ? chosen.map((l) => <LabelChip key={l.id} label={l} size="sm" />) : <span className="text-faint">elige etiqueta…</span>}
        <span className="text-muted">
          · de <b className="font-medium text-ink">{propName(cfg.start)}</b> a <b className="font-medium text-ink">{cfg.end ? propName(cfg.end) : 'hoy'}</b>
        </span>
        <span className="text-muted">· festivos de {hol.regions[cfg.region] || cfg.region}</span>
      </button>

      {!configured ? (
        <Empty icon={ChartNoAxesColumn} title="Configura el informe">
          Elige qué etiqueta cuenta y qué fechas marcan el inicio y el fin de cada corrección.
        </Empty>
      ) : (
        <>
          <div className="mb-2 mt-6 flex items-center gap-1">
            <IconButton label="Año anterior" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft size={17} />
            </IconButton>
            <h3 className="min-w-14 text-center text-[17px] font-semibold tabular-nums">{year}</h3>
            <IconButton label="Año siguiente" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight size={17} />
            </IconButton>
            <span className="ml-2 text-[14px] text-muted">
              <b className="font-semibold tabular-nums text-ink">{nf(yearTotal)}</b> {yearTotal === 1 ? 'jornada' : 'jornadas'}
            </span>
            <span className="flex-1" />
            {yearRows.length > 0 && (
              <Button size="sm" variant="outline" onClick={download}>
                <Download size={14} /> CSV
              </Button>
            )}
          </div>

          {byMonth.length === 0 && <p className="py-10 text-center text-[14px] text-faint">Nada en {year}.</p>}

          {byMonth.map(([month, list]) => {
            const total = list.reduce((a, r) => a + r.days, 0)
            const mDate = new Date(`${month}-01T12:00:00`)
            return (
              <section key={month} className="entra mt-5" style={{ '--entra-dura': '220ms' }}>
                <div className="mb-1 flex items-baseline gap-2 border-b border-line px-1 pb-1.5">
                  <h4 className="flex-1 text-[15px] font-semibold first-letter:uppercase">{fmt(mDate, 'MMMM')}</h4>
                  <span className="text-[13.5px] text-muted">
                    <b className="font-semibold tabular-nums text-ink">{nf(total)}</b> {total === 1 ? 'jornada' : 'jornadas'}
                  </span>
                </div>
                {list.map((r) => (
                  <div key={r.key} className="group flex items-center gap-3 rounded-xl px-1 py-1.5 transition-colors hover:bg-hover sm:px-2">
                    <button onClick={() => onOpen(r.card)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[14.5px]">{r.card.title || 'Sin título'}</span>
                      <span className="block text-[12.5px] text-faint">
                        {dayKey(r.from) === dayKey(r.to) ? fmt(r.from, "d 'de' MMM") : `del ${fmt(r.from, 'd')} al ${fmt(r.to, "d 'de' MMM")}`}
                        {r.ongoing && ' · en curso'}
                      </span>
                    </button>
                    {r.adjusted && (
                      <IconButton size="sm" label={`Volver a lo calculado (${nf(r.auto)})`} onClick={() => adjust(r, r.auto - r.days)}>
                        <RotateCcw size={13} />
                      </IconButton>
                    )}
                    <div className="flex shrink-0 items-center rounded-lg border border-line bg-surface">
                      <IconButton size="sm" label="Media jornada menos" onClick={() => adjust(r, -0.5)} className="rounded-r-none">
                        <Minus size={13} />
                      </IconButton>
                      <span className={cx('w-10 text-center text-[14px] font-medium tabular-nums', r.adjusted && 'text-accent')}>{nf(r.days)}</span>
                      <IconButton size="sm" label="Media jornada más" onClick={() => adjust(r, 0.5)} className="rounded-l-none">
                        <Plus size={13} />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </section>
            )
          })}

          {missing.length > 0 && (
            <p className="mt-6 text-[13px] text-faint">
              {missing.length} {missing.length === 1 ? 'tarjeta no tiene' : 'tarjetas no tienen'} «{propName(cfg.start)}» y no {missing.length === 1 ? 'cuenta' : 'cuentan'}:{' '}
              {missing.slice(0, 4).map((c, i) => (
                <button key={c.id} onClick={() => onOpen(c)} className="underline underline-offset-2 hover:text-muted">
                  {c.title || 'Sin título'}
                  {i < Math.min(3, missing.length - 1) ? ', ' : ''}
                </button>
              ))}
              {missing.length > 4 && '…'}
            </p>
          )}
        </>
      )}

      <Popover open={conf.open} anchor={conf.anchor} onClose={conf.close} width={340}>
        <ReportConfig project={project} cfg={cfg} setCfg={setCfg} dateProps={dateProps} hol={hol} year={year} />
      </Popover>
    </div>
  )
}

function ReportConfig({ project, cfg, setCfg, dateProps, hol, year }) {
  const s = useStore()
  const groups = projectGroups(s, project.id)
  const [extra, setExtra] = useState((cfg.extra_holidays || []).join('\n'))
  const sel = 'h-10 w-full rounded-lg border border-line bg-surface px-2 text-[15px] outline-none sm:h-9 sm:text-[14px]'
  const toggleLabel = (id) => {
    const cur = cfg.label_ids || []
    setCfg({ label_ids: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }
  const yearHolidays = hol.list.filter((h) => h.date.startsWith(String(year)))
  return (
    <div className="p-1">
      <MenuLabel>Cuenta las tarjetas con</MenuLabel>
      {groups.map((g) => (
        <div key={g.id} className="flex flex-wrap gap-1 px-2 pb-2">
          {groupLabels(s, g.id).map((l) => {
            const on = (cfg.label_ids || []).includes(l.id)
            return (
              <button key={l.id} onClick={() => toggleLabel(l.id)} className={cx('rounded-md transition-[opacity,box-shadow]', on ? 'ring-2 ring-[var(--accent)]' : 'opacity-60 hover:opacity-100')}>
                <LabelChip label={l} />
              </button>
            )
          })}
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2 px-2 pb-2">
        <label className="text-[12.5px] text-muted">
          Inicio
          <select className={cx(sel, 'mt-1')} value={cfg.start || ''} onChange={(e) => setCfg({ start: e.target.value })}>
            {dateProps.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[12.5px] text-muted">
          Fin
          <select className={cx(sel, 'mt-1')} value={cfg.end || ''} onChange={(e) => setCfg({ end: e.target.value || null })}>
            <option value="">Hasta hoy</option>
            {dateProps.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {dateProps.length < 2 && <p className="px-2 pb-2 text-[12.5px] text-faint">¿Necesitas otra fecha? Añádela como propiedad (tipo Fecha) desde una tarjeta.</p>}
      <Divider />
      <MenuLabel>Festivos</MenuLabel>
      <div className="px-2 pb-2">
        <select className={sel} value={cfg.region} onChange={(e) => setCfg({ region: e.target.value })}>
          {Object.entries(hol.regions).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <details className="mt-2 text-[12.5px] text-faint">
          <summary className="cursor-pointer select-none hover:text-muted">
            {yearHolidays.length} festivos en {year}
          </summary>
          <ul className="mt-1 max-h-40 overflow-y-auto">
            {yearHolidays.map((h) => (
              <li key={h.date} className="flex gap-2 py-0.5">
                <span className="w-16 tabular-nums">{fmt(new Date(`${h.date}T12:00:00`), 'd MMM')}</span>
                <span className="text-muted">{h.name}</span>
              </li>
            ))}
          </ul>
        </details>
        <label className="mt-3 block text-[12.5px] text-muted">
          Festivos locales o días libres (uno por línea, p. ej. 22/01/2026)
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            onBlur={() => setCfg({ extra_holidays: parseExtra(extra) })}
            rows={3}
            className="mt-1 w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-2 text-[15px] outline-none sm:text-[14px]"
          />
        </label>
      </div>
    </div>
  )
}
