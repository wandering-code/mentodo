import { useEffect, useMemo, useState } from 'react'
import { addDays, addMonths, endOfMonth, startOfMonth } from 'date-fns'
import { Copy, Download, X } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../lib/store'
import { dateOf, dayKey, entriesByDay, fmtH, hoursCsv, sumMinutes, useHolidays, weekOf } from '../lib/hours'
import { Button, cx, IconButton, Modal } from './ui'

/* Exportar el parte a CSV: mismo formato que Cuarto de Hora (Excel en
   español). Se puede copiar al portapapeles o descargar. */
export function HoursExport({ open, onClose, viewKey, settings }) {
  const s = useStore()
  const [preset, setPreset] = useState('week')
  const [custom, setCustom] = useState(() => ({ start: viewKey, end: viewKey }))
  const range = useMemo(() => {
    const d = dateOf(viewKey)
    if (preset === 'week') {
      const w = weekOf(d)
      return { start: dayKey(w[0]), end: dayKey(w[6]) }
    }
    if (preset === 'month') return { start: dayKey(startOfMonth(d)), end: dayKey(endOfMonth(d)) }
    if (preset === 'prev') {
      const p = addMonths(d, -1)
      return { start: dayKey(startOfMonth(p)), end: dayKey(endOfMonth(p)) }
    }
    return custom.start <= custom.end ? custom : { start: custom.end, end: custom.start }
  }, [preset, viewKey, custom])

  useEffect(() => {
    if (open) s.loadHours(range.start, range.end)
  }, [open, range.start, range.end]) // eslint-disable-line react-hooks/exhaustive-deps

  const years = useMemo(() => [...new Set([range.start, range.end].map((k) => Number(k.slice(0, 4))))], [range])
  const holidays = useHolidays(settings.region, years)
  const keys = useMemo(() => {
    const out = []
    for (let d = dateOf(range.start); dayKey(d) <= range.end && out.length < 400; d = addDays(d, 1)) out.push(dayKey(d))
    return out
  }, [range])
  const byDay = useMemo(() => entriesByDay(s.entries), [s.entries])
  const csv = useMemo(() => hoursCsv({ keys, workdays: s.workdays, byDay, settings, holidays }), [keys, s.workdays, byDay, settings, holidays])
  const total = keys.reduce((a, k) => a + sumMinutes(byDay[k] || []), 0)
  const lines = csv.split('\r\n').length - 1

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csv)
      toast.success('CSV copiado: pégalo en Excel')
    } catch {
      toast('No se pudo copiar: selecciona el texto y pulsa Ctrl+C')
    }
  }
  const download = () => {
    // Con BOM, Excel abre bien las tildes
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `horas_${range.start}_${range.end}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const PRESETS = [
    { id: 'week', name: 'Esta semana' },
    { id: 'month', name: 'Este mes' },
    { id: 'prev', name: 'Mes anterior' },
    { id: 'custom', name: 'Fechas' },
  ]
  const dateInput = 'h-9 rounded-lg border border-line bg-surface px-2 text-[14px] text-ink outline-none'

  return (
    <Modal open={open} onClose={onClose} className="max-w-xl">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Exportar a CSV</h2>
          <p className="mt-0.5 text-[13px] text-muted">Separado por «;» y con coma decimal, listo para Excel. Una línea por parte; los días sin partes también salen.</p>
        </div>
        <IconButton label="Cerrar" size="sm" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>
      <div className="mt-4 inline-flex flex-wrap rounded-xl bg-sunken p-1">
        {PRESETS.map((p) => (
          <button key={p.id} onClick={() => setPreset(p.id)} className={cx('h-8 rounded-lg px-3 text-[13px] transition-colors', preset === p.id ? 'bg-surface font-medium text-ink shadow-soft' : 'text-muted hover:text-ink')}>
            {p.name}
          </button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
          Del <input type="date" value={custom.start} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, start: e.target.value }))} className={dateInput} />
          al <input type="date" value={custom.end} onChange={(e) => e.target.value && setCustom((c) => ({ ...c, end: e.target.value }))} className={dateInput} />
        </div>
      )}
      <textarea
        readOnly
        wrap="off"
        value={csv}
        onFocus={(e) => e.target.select()}
        className="mt-3 h-44 w-full resize-none rounded-xl border border-line bg-sunken p-3 font-mono text-[11.5px] leading-relaxed text-muted outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex-1 text-[12.5px] tabular-nums text-faint">
          {lines} {lines === 1 ? 'línea' : 'líneas'} · {fmtH(total, settings.format)} h imputadas
        </span>
        <Button variant="outline" onClick={download}>
          <Download size={15} /> Descargar
        </Button>
        <Button variant="primary" onClick={copy}>
          <Copy size={15} /> Copiar
        </Button>
      </div>
    </Modal>
  )
}
