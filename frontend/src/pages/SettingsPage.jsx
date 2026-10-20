import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Bell, BellOff, Check, Download, Lock, LockOpen, LogOut, Monitor, Moon, Send, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../lib/store'
import { post } from '../lib/api'
import { ACCENTS } from '../lib/palette'
import { currentSubscription, disablePush, enablePush, pushSupported } from '../lib/push'
import { stopSync } from '../lib/sync'
import { RulesEditor } from '../components/RulesEditor'
import { VaultDialog } from '../components/VaultDialog'
import { TemplatesManager } from '../components/Templates'
import { lockVault, useVault, vaultSupported } from '../lib/vault'
import { Button, cx, Input, spring, Toggle } from '../components/ui'
import { SettingsSection } from './ProjectSettings'
import { HoursSettings, ModulesSettings } from '../components/HoursSettings'
import { hoursOn } from '../lib/hours'
import { vacationsOn } from '../lib/vacations'
import { TeamSettings, VacationSettings } from '../components/TeamSettings'
import { useLocation } from 'react-router'

const THEMES = [
  { id: 'light', name: 'Claro', icon: Sun },
  { id: 'dark', name: 'Oscuro', icon: Moon },
  { id: 'system', name: 'Sistema', icon: Monitor },
]

function VaultSection() {
  const hasVault = useStore((s) => !!s.user?.vault_salt)
  const key = useVault((v) => v.key)
  const [dialog, setDialog] = useState(false)
  return (
    <SettingsSection
      title="Bóveda de secretos"
      description="Contraseñas y cuentas cifradas en tus dispositivos con una frase maestra que solo tú sabes. Se guardan como bloques «Secreto» dentro de cualquier apunte (escribe /secreto)."
    >
      {!vaultSupported() ? (
        <p className="text-[13.5px] text-muted">Necesita HTTPS: ábrelo desde mentodo.wanderingcode.dev.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className={cx('inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13.5px]', key ? 'bg-accent-soft text-accent' : 'bg-sunken text-muted')}>
            {key ? <LockOpen size={15} /> : <Lock size={15} />}
            {!hasVault ? 'Sin crear' : key ? 'Desbloqueada en este dispositivo' : 'Bloqueada'}
          </span>
          {!key && (
            <Button variant="primary" onClick={() => setDialog(true)}>
              {hasVault ? 'Desbloquear' : 'Crear bóveda'}
            </Button>
          )}
          {key && (
            <Button variant="outline" onClick={() => lockVault()}>
              <Lock size={15} /> Bloquear
            </Button>
          )}
        </div>
      )}
      <VaultDialog open={dialog} onClose={() => setDialog(false)} />
    </SettingsSection>
  )
}

export function SettingsPage() {
  const s = useStore()
  const user = s.user
  const [pushOn, setPushOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState({ current: '', new: '' })
  const { hash } = useLocation()

  // Enlaces a una sección concreta (#modulos, #horas…)
  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    return () => clearTimeout(t)
  }, [hash])

  useEffect(() => {
    currentSubscription().then((sub) => setPushOn(!!sub)).catch(() => {})
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && user && tz !== user.timezone) s.updateMe({ timezone: tz })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePush = async () => {
    setBusy(true)
    try {
      if (pushOn) {
        await disablePush()
        setPushOn(false)
      } else {
        await enablePush(s.vapidKey)
        setPushOn(true)
        toast.success('Avisos activados en este dispositivo')
      }
    } catch (e) {
      toast.error(e.message || 'No se pudieron activar los avisos')
    }
    setBusy(false)
  }

  const changePassword = async (e) => {
    e.preventDefault()
    try {
      await post('/me/password', pw)
      setPw({ current: '', new: '' })
      toast.success('Contraseña cambiada')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const ios = /iphone|ipad/i.test(navigator.userAgent)

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-8 lg:pt-12">
      <h1 className="text-[30px] font-semibold tracking-[-0.03em]">Ajustes</h1>

      <SettingsSection title="Apariencia" description="Se guarda en tu perfil: se aplica igual en todos tus dispositivos.">
        <div className="inline-flex rounded-xl bg-sunken p-1">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => s.updateMe({ theme: t.id })}
              className={cx('relative flex h-9 items-center gap-2 rounded-lg px-4 text-[13.5px] font-medium transition-colors', user.theme === t.id ? 'text-ink' : 'text-muted hover:text-ink')}
            >
              {user.theme === t.id && <motion.span layoutId="theme-pill" transition={spring} className="absolute inset-0 rounded-lg bg-surface shadow-soft" />}
              <t.icon size={15} className="relative" />
              <span className="relative">{t.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 text-[13.5px] font-medium text-muted">Tono principal</div>
        <div className="mt-3 flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button key={a.id} onClick={() => s.updateMe({ accent: a.id })} className="group flex flex-col items-center gap-1.5">
              <span
                className={cx('grid size-11 place-items-center rounded-full transition-[box-shadow,transform] duration-200 hover:scale-[1.08] active:scale-[0.92]', user.accent === a.id && 'ring-2 ring-[var(--ink)] ring-offset-[3px] ring-offset-[var(--bg)]')}
                style={{ background: a.hex }}
              >
                {user.accent === a.id && <Check size={18} color="#fff" />}
              </span>
              <span className={cx('text-[12px]', user.accent === a.id ? 'text-ink' : 'text-faint')}>{a.name}</span>
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Hoy" description="Qué aparece en la página Hoy.">
        <label className="flex items-center gap-3 text-[14px]">
          <span className="flex-1">
            Planificar el tiempo
            <span className="block text-[12.5px] text-faint">«Hoy tengo X h» y «Solo un rato», para ver qué cabe en tu día según las estimaciones</span>
          </span>
          <Toggle checked={user.prefs?.today_time !== false} onChange={(v) => s.updateMe({ prefs: { today_time: v } })} />
        </label>
      </SettingsSection>

      <SettingsSection id="modulos" title="Módulos" description="Funciones opcionales. Vienen apagadas: actívalas solo si te sirven; apagarlas las esconde sin borrar nada.">
        <ModulesSettings />
      </SettingsSection>

      {hoursOn(user) && (
        <SettingsSection id="horas" title="Parte de horas" description="Tu horario, cómo se cuentan las horas y los avisos del parte. En cada proyecto puedes además activar imputar desde sus tarjetas (Ajustes del proyecto).">
          <HoursSettings />
        </SettingsSection>
      )}

      {vacationsOn(user) && (
        <SettingsSection id="vacaciones" title="Vacaciones" description="Cuántos días tienes, qué festivos no cuentan y con qué color te ven los demás.">
          <VacationSettings />
        </SettingsSection>
      )}

      <SettingsSection id="equipo" title="Equipo" description="Gente con la que compartes cosas en Mentodo; de momento, las vacaciones. Invita por nombre de usuario: le llega un aviso y, cuando acepte, os veréis el uno al otro.">
        <TeamSettings />
      </SettingsSection>

      <SettingsSection title="Avisos" description="Notificaciones en este dispositivo aunque Mentodo esté cerrado.">
        {!pushSupported() ? (
          <p className="text-[13.5px] text-muted">
            {!window.isSecureContext
              ? 'Los avisos push necesitan HTTPS: funcionan en mentodo.wanderingcode.dev, no en la IP local.'
              : ios && !standalone
                ? 'En iPhone/iPad, primero añade Mentodo a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrelo desde ahí.'
                : 'Este navegador no admite notificaciones push.'}
          </p>
        ) : !s.vapidKey ? (
          <p className="text-[13.5px] text-muted">El servidor no tiene claves VAPID configuradas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant={pushOn ? 'outline' : 'primary'} onClick={togglePush} disabled={busy}>
              {pushOn ? <BellOff size={15} /> : <Bell size={15} />}
              {pushOn ? 'Desactivar en este dispositivo' : 'Activar en este dispositivo'}
            </Button>
            <Button variant="ghost" onClick={() => post('/push/test').then(() => toast('Aviso de prueba enviado'))}>
              <Send size={15} /> Enviar prueba
            </Button>
          </div>
        )}
        <div className="mt-6 text-[13.5px] font-medium text-muted">Reglas generales (todos los proyectos)</div>
        <div className="mt-3">
          <RulesEditor projectId={null} />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Plantillas generales"
        description="Sirven en cualquier proyecto (y en la bandeja): cuerpo, propiedades de serie y fechas relativas. Las que usan etiquetas o campos de un proyecto se crean en los ajustes de ese proyecto."
      >
        <TemplatesManager projectId={null} />
      </SettingsSection>

      <VaultSection />

      <SettingsSection
        title="Tus datos"
        description="Cada noche se hace una copia de seguridad automática en el servidor. Además, puedes descargar aquí una copia de todo lo tuyo (proyectos, tarjetas, apuntes…) en un archivo; los secretos de la bóveda van cifrados."
      >
        <a href="/api/export" download>
          <Button variant="outline" type="button">
            <Download size={15} /> Exportar todo
          </Button>
        </a>
      </SettingsSection>

      <SettingsSection title="Perfil">
        <div className="grid max-w-md gap-3">
          <label className="text-[13px] text-muted">
            Nombre
            <Input
              className="mt-1"
              defaultValue={user.display_name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== user.display_name && s.updateMe({ display_name: e.target.value.trim() })}
            />
          </label>
          <div className="text-[13px] text-faint">
            Usuario @{user.username} · Zona horaria {user.timezone}
          </div>
        </div>
        <form onSubmit={changePassword} className="mt-6 grid max-w-md gap-2">
          <div className="text-[13.5px] font-medium text-muted">Cambiar contraseña</div>
          <Input type="password" placeholder="Contraseña actual" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
          <Input type="password" placeholder="Nueva (mín. 8 caracteres)" value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} autoComplete="new-password" />
          <div>
            <Button variant="outline" disabled={!pw.current || pw.new.length < 8}>
              Guardar contraseña
            </Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection title="Sesión">
        <Button
          variant="danger"
          onClick={() => {
            stopSync()
            s.logout()
          }}
        >
          <LogOut size={15} /> Cerrar sesión
        </Button>
        <p className="mt-6 text-[12px] text-faint">Mentodo · versión {__VERSION__}</p>
      </SettingsSection>
    </div>
  )
}
