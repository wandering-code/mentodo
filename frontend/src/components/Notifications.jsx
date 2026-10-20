import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { BellOff, CheckCheck, Trash2, X } from 'lucide-react'
import { useEffect } from 'react'
import { useStore } from '../lib/store'
import { cx, Empty, IconButton, Scrim } from './ui'
import { ARRIVE, css, LEAVE, useBackToClose, usePresence } from '../lib/layers'
import { cardPath } from '../lib/nav'

export function NotificationsPanel({ open, onClose }) {
  const notifications = useStore((s) => s.notifications)
  const readAll = useStore((s) => s.readAllNotifications)
  const clear = useStore((s) => s.clearNotifications)
  const nav = useNavigate()

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => notifications.some((n) => !n.read) && readAll(), 1500)
    return () => clearTimeout(t)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Primero se navega y luego se cierra: al revés, el "atrás" con el que se
  // deshace la capa se llevaría por delante la navegación
  const goTo = (n) => {
    const card = n.card_id ? useStore.getState().cards[n.card_id] : null
    if (card) nav(cardPath(card))
    else if (n.url) nav(n.url)
    else if (n.title.startsWith('Nueva cuenta')) nav('/admin')
    else nav('/')
    onClose()
  }

  const { mounted, shown } = usePresence(open)
  useBackToClose(open, onClose)
  if (!mounted) return null
  return createPortal(
    <>
      <Scrim shown={shown} onClick={onClose} z="z-[65]" />
      <aside
        role="dialog"
        aria-label="Avisos"
        className="fixed inset-y-0 right-0 z-[65] flex w-full max-w-sm flex-col border-l border-line bg-surface pt-safe shadow-float"
        style={{ transform: shown ? 'none' : 'translateX(100%)', transition: css(shown ? ARRIVE : LEAVE, ['transform']), willChange: 'transform' }}
      >
        <div className="flex items-center gap-1 px-4 pb-2 pt-3">
          <h2 className="flex-1 text-[17px] font-semibold tracking-[-0.01em]">Avisos</h2>
          <IconButton label="Marcar todo como leído" onClick={readAll}>
            <CheckCheck size={17} />
          </IconButton>
          <IconButton label="Vaciar" onClick={clear}>
            <Trash2 size={16} />
          </IconButton>
          <IconButton label="Cerrar" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(24px,env(safe-area-inset-bottom))]">
          {notifications.length === 0 ? (
            <Empty icon={BellOff} title="Nada por aquí">
              Configura avisos por fecha o por etiqueta en los ajustes de cada proyecto.
            </Empty>
          ) : (
            notifications.map((n, i) => (
              <button
                key={n.id}
                onClick={() => goTo(n)}
                className={cx('flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-hover active:bg-hover', shown && 'entra')}
                style={{ '--entra-espera': `${Math.min(i, 8) * 25}ms`, '--entra-desde': 'translateX(12px)' }}
              >
                <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-accent')} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-medium leading-snug">{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{n.body}</span>}
                  <span className="mt-1 block text-[12px] text-faint">hace {formatDistanceToNowStrict(new Date(n.created_at), { locale: es })}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>
    </>,
    document.body,
  )
}
