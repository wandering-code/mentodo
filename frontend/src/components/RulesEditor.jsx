import { AnimatePresence, motion } from 'motion/react'
import { AlarmClock, CalendarClock, Hourglass, Sunrise, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { groupLabels, projectGroups } from '../lib/cards'
import { Button, IconButton, Toggle } from './ui'

export const RULE_KINDS = [
  { id: 'before_due', icon: CalendarClock, name: 'Antes del vencimiento', defaults: { minutes: 1440 } },
  { id: 'overdue', icon: AlarmClock, name: 'Cuando se pase la fecha', defaults: {} },
  { id: 'daily_digest', icon: Sunrise, name: 'Resumen diario', defaults: { hour: 8 } },
  { id: 'stale', icon: Hourglass, name: 'Tarjeta atascada', defaults: { days: 5 } },
]

const OFFSETS = [
  [15, '15 minutos antes'],
  [60, '1 hora antes'],
  [180, '3 horas antes'],
  [1440, '1 día antes'],
  [2880, '2 días antes'],
  [10080, '1 semana antes'],
]

const select = 'h-8 rounded-lg border border-line bg-surface px-2 text-[13.5px] outline-none'

function RuleRow({ rule, projectId }) {
  const s = useStore()
  const kind = RULE_KINDS.find((k) => k.id === rule.kind)
  const set = (params) => s.updateRule(rule.id, { params: { ...rule.params, ...params } })
  const dateFields = Object.values(s.fields).filter((f) => f.project_id === projectId && f.kind === 'date')
  const labels = projectId ? projectGroups(s, projectId).flatMap((g) => groupLabels(s, g.id).map((l) => ({ ...l, group: g.name }))) : []
  return (
    <motion.div
      layout
      initial={{ opacity: 0, transform: 'translateY(-4px)' }}
      animate={{ opacity: 1, transform: 'translateY(0px)' }}
      exit={{ opacity: 0, transform: 'scale(0.98)', transition: { duration: 0.15 } }}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface px-3.5 py-3"
    >
      <kind.icon size={17} className="text-accent" />
      <span className="text-[14px] font-medium">{kind.name}</span>
      <div className="flex flex-1 flex-wrap items-center gap-2 text-[13.5px] text-muted">
        {(rule.kind === 'before_due' || rule.kind === 'overdue') && dateFields.length > 0 && (
          <select className={select} value={rule.params.field || 'due'} onChange={(e) => set({ field: e.target.value === 'due' ? 'due' : Number(e.target.value) })}>
            <option value="due">{s.projects[projectId]?.prop_names?.due || 'Fecha'}</option>
            {dateFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
        {rule.kind === 'before_due' && (
          <select className={select} value={rule.params.minutes} onChange={(e) => set({ minutes: Number(e.target.value) })}>
            {OFFSETS.map(([m, t]) => (
              <option key={m} value={m}>
                {t}
              </option>
            ))}
          </select>
        )}
        {rule.kind === 'daily_digest' && (
          <>
            a las
            <select className={select} value={rule.params.hour} onChange={(e) => set({ hour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </>
        )}
        {rule.kind === 'stale' && (
          <>
            en
            <select className={select} value={rule.params.label_id || ''} onChange={(e) => set({ label_id: Number(e.target.value) || null })}>
              <option value="">elige etiqueta…</option>
              {labels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.group}: {l.name}
                </option>
              ))}
            </select>
            más de
            <select className={select} value={rule.params.days} onChange={(e) => set({ days: Number(e.target.value) })}>
              {[1, 2, 3, 5, 7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? 'día' : 'días'}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <Toggle checked={rule.enabled} onChange={(enabled) => s.updateRule(rule.id, { enabled })} label="Activa" />
      <IconButton size="sm" label="Borrar" onClick={() => s.deleteRule(rule.id)}>
        <Trash2 size={15} />
      </IconButton>
    </motion.div>
  )
}

export function RulesEditor({ projectId = null }) {
  const s = useStore()
  const rules = Object.values(s.rules)
    .filter((r) => r.project_id === projectId)
    .sort((a, b) => a.id - b.id)
  const kinds = RULE_KINDS.filter((k) => projectId || k.id !== 'stale')
  return (
    <div>
      <div className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {rules.map((r) => (
            <RuleRow key={r.id} rule={r} projectId={projectId} />
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {kinds.map((k) => (
          <Button key={k.id} size="sm" variant="outline" onClick={() => s.createRule({ project_id: projectId, kind: k.id, params: k.defaults })}>
            <k.icon size={14} /> {k.name}
          </Button>
        ))}
      </div>
    </div>
  )
}
