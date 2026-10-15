import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { CircleCheckBig, Folder, Maximize2, Minimize2, MoreHorizontal, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { Editor } from './Editor'
import { ProjectPicker } from './Pickers'
import { Properties } from './Properties'
import { Checkbox, cx, IconButton, MenuItem, Popover, softSpring, useIsMobile, usePopover } from './ui'

export function CardPanel({ cardId, onClose }) {
  const card = useStore((s) => (cardId ? s.cards[cardId] : null))
  const mobile = useIsMobile()
  const [wide, setWide] = useState(() => localStorage.getItem('mentodo:wide') === '1')
  const open = !!card

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('[data-popover-open]')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const toggleWide = () =>
    setWide((w) => {
      try {
        localStorage.setItem('mentodo:wide', w ? '0' : '1')
      } catch {}
      return !w
    })

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="card" className="fixed inset-0 z-40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/20 sm:bg-black/15" onClick={onClose} />
          <motion.section
            initial={mobile ? { y: '100%' } : { x: 40, opacity: 0 }}
            animate={mobile ? { y: 0 } : { x: 0, opacity: 1 }}
            exit={mobile ? { y: '100%' } : { x: 40, opacity: 0 }}
            transition={softSpring}
            className={cx(
              'absolute flex flex-col bg-surface shadow-float',
              mobile ? 'inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),12px)] rounded-t-2xl border-t border-line' : 'inset-y-2 right-2 rounded-2xl border border-line',
              !mobile && (wide ? 'left-2 lg:left-[12vw]' : 'w-[min(620px,calc(100vw-16px))]'),
            )}
          >
            <CardBody card={card} onClose={onClose} mobile={mobile} wide={wide} onToggleWide={toggleWide} />
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function CardBody({ card, onClose, mobile, wide, onToggleWide }) {
  const s = useStore()
  const { updateCard, deleteCard } = s
  const project = card.project_id ? s.projects[card.project_id] : null
  const [title, setTitle] = useState(card.title)
  const titleRef = useRef(null)
  const more = usePopover()
  const move = usePopover()

  useEffect(() => {
    if (document.activeElement !== titleRef.current) setTitle(card.title)
  }, [card.title])

  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [title])

  // Tarjeta recién creada: el cursor va directo al título
  useEffect(() => {
    if (!card.title) setTimeout(() => titleRef.current?.focus(), 250)
  }, [card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTitle = () => title !== card.title && updateCard(card.id, { title })

  return (
    <>
      <header className="flex items-center gap-1 px-3 pt-3">
        <button onClick={move.toggle} className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted transition-colors hover:bg-hover hover:text-ink">
          <span>{project ? project.icon : '📥'}</span>
          <span className="truncate">{project ? project.name : 'Bandeja'}</span>
        </button>
        <div className="flex-1" />
        {!mobile && (
          <IconButton label={wide ? 'Reducir' : 'Ampliar'} onClick={onToggleWide}>
            {wide ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </IconButton>
        )}
        <IconButton label="Más" onClick={more.toggle}>
          <MoreHorizontal size={17} />
        </IconButton>
        <IconButton label="Cerrar" onClick={onClose}>
          <X size={18} />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cx('mx-auto px-5 pb-6 pt-3 sm:px-8', wide && 'max-w-3xl')}>
          <div className="flex items-start gap-3">
            <Checkbox checked={card.done} onChange={(done) => updateCard(card.id, { done })} size={24} className="mt-[7px]" />
            <textarea
              ref={titleRef}
              rows={1}
              value={title}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
              placeholder="Sin título"
              className={cx(
                'flex-1 resize-none overflow-hidden bg-transparent text-[22px] sm:text-[26px] font-semibold leading-[1.25] tracking-[-0.022em] outline-none placeholder:text-faint',
                card.done && 'text-muted',
              )}
            />
          </div>

          <Properties card={card} project={project} onMove={move.toggle} />

          <div className="my-5 h-px bg-line" />
          <Editor cardId={card.id} content={card.content} onSave={(content) => updateCard(card.id, { content })} />
        </div>
      </div>

      <footer className="flex items-center gap-2 border-t border-line px-5 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))] text-[12px] text-faint sm:px-8">
        {card.done && card.completed_at ? (
          <span className="flex items-center gap-1.5">
            <CircleCheckBig size={13} /> Terminada hace {formatDistanceToNowStrict(new Date(card.completed_at), { locale: es })}
          </span>
        ) : (
          <span>Creada hace {formatDistanceToNowStrict(new Date(card.created_at), { locale: es })}</span>
        )}
        <span className="flex-1" />
        <span>Editada hace {formatDistanceToNowStrict(new Date(card.updated_at), { locale: es })}</span>
      </footer>

      <Popover open={more.open} anchor={more.anchor} onClose={more.close} align="end" width={220}>
        <MenuItem icon={Folder} onClick={() => {
            const a = more.anchor
            more.close()
            move.openAt(a)
          }}>
          Mover a otro proyecto
        </MenuItem>
        <MenuItem
          icon={Trash2}
          danger
          onClick={() => {
            more.close()
            onClose()
            deleteCard(card.id)
          }}
        >
          Eliminar tarjeta
        </MenuItem>
      </Popover>
      <Popover open={move.open} anchor={move.anchor} onClose={move.close} width={240}>
        <ProjectPicker
          value={card.project_id}
          onChange={(project_id) => {
            move.close()
            updateCard(card.id, { project_id })
          }}
        />
      </Popover>
    </>
  )
}
