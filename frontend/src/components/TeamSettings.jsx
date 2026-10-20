import { useEffect, useState } from 'react'
import { Check, Crown, LogOut, UserPlus, Users, X } from 'lucide-react'
import { get } from '../lib/api'
import { useStore } from '../lib/store'
import { baseFor, PERSON_COLORS, personHex, vacSettings } from '../lib/vacations'
import { Button, cx, IconButton, Input } from './ui'

/* Ajustes → Equipo. Es general (no depende de ningún módulo): crear un
   equipo, invitar por usuario, aceptar o rechazar invitaciones y salir. */

const sub = 'text-[13.5px] font-medium text-muted'

/* Botón que pide un segundo toque antes de hacer algo delicado */
function ConfirmButton({ children, confirm, onConfirm, ...props }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3500)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <Button {...props} variant={armed ? 'danger' : props.variant} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirm : children}
    </Button>
  )
}

function Dot({ color, className }) {
  return <span className={cx('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: personHex(color) }} />
}

function TeamCard({ team }) {
  const s = useStore()
  const me = s.user.id
  const owner = team.owner_id === me
  const [name, setName] = useState(team.name)
  const [invite, setInvite] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setName(team.name), [team.name])

  const sendInvite = async (e) => {
    e.preventDefault()
    if (!invite.trim()) return
    setBusy(true)
    const ok = await s.teamAction('POST', `/teams/${team.id}/invite`, { username: invite.trim() })
    setBusy(false)
    if (ok) setInvite('')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
      <div className="flex items-center gap-2 border-b border-line bg-sunken px-3 py-2">
        <Users size={16} className="shrink-0 text-muted" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== team.name ? s.teamAction('PATCH', `/teams/${team.id}`, { name: name.trim() }) : setName(team.name)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="Nombre del equipo"
          className="h-8 min-w-0 flex-1 rounded-lg bg-transparent px-1.5 text-[15px] font-semibold outline-none hover:bg-hover focus:bg-hover"
        />
      </div>
      <ul className="p-1.5">
        {team.members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[14px]">
            <Dot color={m.color} />
            <span className="min-w-0 flex-1 truncate">
              {m.display_name}
              {m.user_id === me && <span className="text-faint"> (tú)</span>}
              <span className="ml-1.5 text-[12.5px] text-faint">@{m.username}</span>
            </span>
            {team.owner_id === m.user_id && <Crown size={14} className="shrink-0 text-faint" aria-label="Creó el equipo" />}
            {m.status === 'invited' && <span className="shrink-0 rounded-md bg-sunken px-1.5 py-0.5 text-[11.5px] text-muted">Invitación enviada</span>}
            {owner && m.user_id !== me && (
              <IconButton
                label={m.status === 'invited' ? 'Anular invitación' : `Quitar a ${m.display_name}`}
                size="sm"
                onClick={() => s.teamAction('DELETE', `/teams/${team.id}/members/${m.user_id}`)}
                className="hover:text-danger"
              >
                <X size={15} />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={sendInvite} className="flex gap-2 border-t border-line p-2.5">
        <Input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="@usuario" aria-label="Usuario a invitar" autoCapitalize="none" autoCorrect="off" className="h-9 min-w-0 flex-1" />
        <Button variant="outline" disabled={!invite.trim() || busy}>
          <UserPlus size={15} /> Invitar
        </Button>
      </form>
      <div className="flex justify-end border-t border-line px-2.5 py-2">
        <ConfirmButton size="sm" variant="ghost" confirm="¿Seguro? Salir" onConfirm={() => s.teamAction('POST', `/teams/${team.id}/leave`)}>
          <LogOut size={14} /> Salir del equipo
        </ConfirmButton>
      </div>
    </div>
  )
}

export function TeamSettings() {
  const s = useStore()
  const me = s.user.id
  const [name, setName] = useState('')
  const statusOf = (t) => t.members.find((m) => m.user_id === me)?.status
  const invites = s.teams.filter((t) => statusOf(t) === 'invited')
  const active = s.teams.filter((t) => statusOf(t) === 'active')

  // Al abrir Ajustes, lo último (por si llegó una invitación con la app dormida)
  useEffect(() => {
    s.loadTeams()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    if (await s.teamAction('POST', '/teams', { name: name.trim() })) setName('')
  }

  return (
    <div className="flex flex-col gap-4">
      {invites.map((t) => {
        const from = t.members.find((m) => m.user_id === t.owner_id)
        return (
          <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--accent)_35%,var(--line))] bg-accent-soft p-3.5">
            <span className="min-w-0 flex-1 text-[14px]">
              <span className="font-medium">{from ? from.display_name : 'Alguien'}</span> te invita a <span className="font-medium">«{t.name}»</span>
              <span className="block text-[12.5px] text-muted">Al aceptar, veréis las vacaciones del otro (si usáis el módulo).</span>
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => s.teamAction('POST', `/teams/${t.id}/leave`)}>
                Rechazar
              </Button>
              <Button variant="primary" onClick={() => s.teamAction('POST', `/teams/${t.id}/accept`)}>
                <Check size={15} /> Aceptar
              </Button>
            </div>
          </div>
        )
      })}
      {active.map((t) => (
        <TeamCard key={t.id} team={t} />
      ))}
      <form onSubmit={create} className="flex max-w-md gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={active.length ? 'Otro equipo…' : 'Nombre del equipo (p. ej. Oficina)'} aria-label="Nombre del equipo nuevo" className="h-9 min-w-0 flex-1" />
        <Button variant={active.length ? 'outline' : 'primary'} disabled={!name.trim()}>
          Crear equipo
        </Button>
      </form>
    </div>
  )
}

/* Ajustes → Vacaciones: días al año, festivos y tu color */
export function VacationSettings() {
  const s = useStore()
  const st = vacSettings(s.user)
  const year = new Date().getFullYear()
  const [regions, setRegions] = useState(null)
  useEffect(() => {
    get(`/holidays?region=&years=${year}`)
      .then((d) => setRegions(d.regions))
      .catch(() => {})
  }, [year])
  const save = (patch) => s.updateMe({ prefs: { vacations: { ...(s.user.prefs?.vacations || {}), ...patch } } })
  const num = (v) => {
    const n = Number(String(v).replace(',', '.'))
    return Number.isFinite(n) && n >= 0 && n <= 365 ? Math.round(n) : null
  }
  const yearDays = (y) => (
    <input
      key={`${y}-${baseFor(st, y)}`}
      inputMode="numeric"
      defaultValue={baseFor(st, y)}
      onFocus={(e) => e.target.select()}
      onBlur={(e) => {
        const n = num(e.target.value)
        if (n == null) return (e.target.value = baseFor(st, y))
        if (n !== baseFor(st, y)) save({ days_by_year: { ...st.days_by_year, [y]: n } })
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      aria-label={`Días de vacaciones en ${y}`}
      className="h-9 w-16 rounded-lg border border-line bg-surface px-2 text-right text-[14.5px] tabular-nums outline-none focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--line))]"
    />
  )

  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className={sub}>Días al año</div>
        <p className="mt-0.5 text-[12.5px] text-faint">Días laborables (sin fines de semana ni festivos). Cada año puede ser distinto. Los que pasas de un año a otro se apuntan en Vacaciones → «Arrastrar días».</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {[year, year + 1].map((y) => (
            <label key={y} className="flex items-center gap-2 text-[14px]">
              <span className="text-muted">{y}</span>
              {yearDays(y)}
              <span className="text-faint">días</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className={sub}>Festivos</div>
        <p className="mt-0.5 text-[12.5px] text-faint">No cuentan como días de vacaciones gastados.</p>
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

      <div>
        <div className={sub}>Tu color</div>
        <p className="mt-0.5 text-[12.5px] text-faint">Así te ven tus compañeros en el calendario.</p>
        <div className="mt-2 flex flex-wrap gap-2.5">
          {PERSON_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => save({ color: c })}
              aria-label={c}
              className={cx('grid size-8 place-items-center rounded-full transition-transform hover:scale-[1.08] active:scale-[0.92]', st.color === c && 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--bg)]')}
              style={{ background: personHex(c) }}
            >
              {st.color === c && <Check size={15} color="#fff" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
