import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { BellOff, CheckCheck, Trash2, X } from 'lucide-react'
import { useEffect } from 'react'
import { useStore } from '../lib/store'
import { cx, Empty, IconButton, softSpring } from './ui'

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

  const goTo = (n) => {
    onClose()
    if (n.card_id) {
      const card = useStore.getState().cards[n.card_id]
      if (card) nav(card.project_id ? `/p/${card.project_id}?card=${card.id}` : `/inbox?card=${card.id}`)
    } else if (n.title.startsWith('Nueva cuenta')) nav('/admin')
    else nav('/')
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[65]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/20" onClick={onClose} />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={softSpring}
            className="absolute inset-y-0 left-0 flex w-full max-w-sm flex-col border-r border-line bg-surface shadow-float"
          >
            <div className="flex items-center gap-1 px-4 pb-2 pt-safe">
              <h2 className="flex-1 pt-4 text-[17px] font-semibold tracking-[-0.01em]">Avisos</h2>
              <div className="flex gap-1 pt-4">
                <IconButton label="Marcar todo como leído" onClick={readAll}>
                  <CheckCheck size={17} />
                </IconButton>
                <IconButton label="Vaciar" onClick={clear}>
                  <Trash2 size={16} />
                </IconButton>
                <IconButton label="Cerrar" onClick={onClose}>
                  <X size={17} />
                </IconButton>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
              {notifications.length === 0 ? (
                <Empty icon={BellOff} title="Nada por aquí">
                  Configura avisos por fecha o por etiqueta en los ajustes de cada proyecto.
                </Empty>
              ) : (
                notifications.map((n, i) => (
                  <motion.button
                    key={n.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.025 }}
                    onClick={() => goTo(n)}
                    className="flex w-full gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-hover"
                  >
                    <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-accent')} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium leading-snug">{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{n.body}</span>}
                      <span className="mt-1 block text-[12px] text-faint">
                        hace {formatDistanceToNowStrict(new Date(n.created_at), { locale: es })}
                      </span>
                    </span>
                  </motion.button>
                ))
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
