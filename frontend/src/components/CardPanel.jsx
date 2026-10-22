import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { CircleCheckBig, Copy, CopyPlus, Folder, LayoutTemplate, Maximize2, Minimize2, MoreHorizontal, Trash2, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useStore } from '../lib/store'
import { ProjectPicker } from './Pickers'
import { Properties } from './Properties'
import { Relations } from './Relations'
import { Attachments, useUploader } from './Attachments'
import { CardHours } from './CardHours'
import { hoursOn } from '../lib/hours'
import { Checkbox, cx, Divider, IconButton, MenuItem, Popover, Scrim, useDragToClose, useIsMobile, usePopover } from './ui'
import { ARRIVE, css, LEAVE, useLatest, usePresence } from '../lib/layers'

// El editor (TipTap) es lo más pesado de la app: se descarga al abrir la
// primera tarjeta, no en el arranque
const loadEditor = () => import('./Editor')
const Editor = lazy(() => loadEditor().then((m) => ({ default: m.Editor })))
// …y se precarga en cuanto la app se queda ociosa, para que la primera
// tarjeta tampoco espere
;(window.requestIdleCallback || ((f) => setTimeout(f, 2500)))(() => loadEditor())

/* Si el editor fallara, falla solo él: el resto de la tarjeta y de la app
   siguen funcionando */
class EditorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <p className="py-6 text-[14px] text-muted">
        No se pudieron cargar las notas.{' '}
        <button className="text-accent underline underline-offset-4" onClick={() => this.setState({ failed: false })}>
          Reintentar
        </button>
      </p>
    )
  }
}

export function CardPanel({ cardId, onClose }) {
  const live = useStore((s) => (cardId ? s.cards[cardId] || s.templates[cardId] : null))
  // Mientras se cierra, se sigue pintando la última tarjeta (no un hueco)
  const card = useLatest(live)
  const mobile = useIsMobile()
  const [wide, setWide] = useState(() => localStorage.getItem('mentodo:wide') === '1')
  const open = !!live
  const { mounted, shown } = usePresence(open)
  const drag = useDragToClose(onClose)

  // Escape cierra la tarjeta si no hay otra capa (popover, hoja…) encima: las
  // capas lo capturan antes y no lo dejan llegar aquí
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
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

  if (!mounted || !card) return null
  const t = shown ? ARRIVE : LEAVE
  return createPortal(
    <>
      <Scrim shown={shown} onClick={onClose} z="z-40" />
      <section
        role="dialog"
        className={cx(
          'fixed z-40 flex flex-col bg-surface shadow-float',
          mobile ? 'inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),10px)] rounded-t-[20px] border-t border-line' : 'inset-y-2 right-2 rounded-2xl border border-line',
          !mobile && (wide ? 'left-2 lg:left-[12vw]' : 'w-[min(620px,calc(100vw-16px))]'),
        )}
        style={
          mobile
            ? {
                transform: shown ? `translateY(${drag.offset}px)` : 'translateY(100%)',
                transition: drag.dragging ? 'none' : css(t, ['transform']),
                willChange: 'transform',
              }
            : {
                transform: shown ? 'none' : 'translateX(28px)',
                opacity: shown ? 1 : 0,
                transition: css(t),
              }
        }
      >
        <CardBody card={card} onClose={onClose} mobile={mobile} wide={wide} onToggleWide={toggleWide} dragHandlers={mobile ? drag.handlers : null} />
      </section>
    </>,
    document.body,
  )
}

function CardBody({ card, onClose, mobile, wide, onToggleWide, dragHandlers }) {
  const s = useStore()
  const { updateCard, deleteCard, duplicateCard } = s
  const isTemplate = !!card.is_template
  // Soltar o pegar archivos en cualquier parte de la tarjeta los adjunta
  const uploader = useUploader({ card_id: card.id })
  const nav = useNavigate()
  const loc = useLocation()
  // La copia se abre en el sitio de la original (sin dejar otra entrada en el
  // historial: «atrás» sigue cerrando la tarjeta)
  const openCopy = (c) => {
    const p = new URLSearchParams(loc.search)
    p.set('card', c.id)
    nav({ pathname: loc.pathname, search: `?${p}` }, { replace: true, state: loc.state })
  }
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
  const fresh = useRef(false)
  useEffect(() => {
    fresh.current = !card.title
    if (!card.title) setTimeout(() => titleRef.current?.focus(), 250)
  }, [card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveTitle = () => title !== card.title && updateCard(card.id, { title })

  return (
    <>
      {/* En el móvil toda la cabecera (asa incluida) se puede arrastrar hacia
          abajo para cerrar la tarjeta */}
      <div {...(dragHandlers || {})} className={cx('shrink-0', dragHandlers && 'cursor-grab')}>
      {dragHandlers && (
        <div className="flex justify-center pb-1 pt-2.5">
          <div className="h-[5px] w-10 rounded-full bg-line" />
        </div>
      )}
      <header className="flex items-center gap-1 px-2 pt-1 sm:px-3 sm:pt-3">
        {isTemplate ? (
          <span className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg bg-accent-soft px-2 text-[13px] font-medium text-accent">
            <LayoutTemplate size={14} />
            <span className="truncate">Plantilla · {project ? `${project.icon} ${project.name}` : 'general'}</span>
          </span>
        ) : (
          <button onClick={move.toggle} className="flex h-8 min-w-0 items-center gap-1.5 rounded-lg px-2 text-[13px] text-muted transition-colors hover:bg-hover hover:text-ink">
            <span>{project ? project.icon : '📥'}</span>
            <span className="truncate">{project ? project.name : 'Bandeja'}</span>
          </button>
        )}
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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" {...(isTemplate ? {} : uploader.dropProps)}>
        <div className={cx('mx-auto px-5 pb-6 pt-3 sm:px-8', wide && 'max-w-3xl')}>
          {isTemplate && <TemplateName card={card} />}
          <div className="flex items-start gap-3">
            {!isTemplate && <Checkbox checked={card.done} onChange={(done) => updateCard(card.id, { done })} size={24} className="mt-[7px]" />}
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
                  // Recién creada (p. ej. desde el calendario): Enter la deja
                  // hecha y cierra, como al añadir en el tablero
                  if (fresh.current && title.trim()) {
                    fresh.current = false
                    onClose?.()
                  }
                }
              }}
              placeholder={isTemplate ? 'Título con el que nacen las tarjetas (opcional)' : 'Sin título'}
              className={cx(
                'flex-1 resize-none overflow-hidden bg-transparent text-[22px] sm:text-[26px] font-semibold leading-[1.25] tracking-[-0.022em] outline-none placeholder:text-faint',
                card.done && 'text-muted',
              )}
            />
          </div>

          <Properties card={card} project={project} onMove={move.toggle} />
          {!isTemplate && <Relations card={card} />}
          {!isTemplate && <Attachments cardId={card.id} />}
          {!isTemplate && hoursOn(s.user) && project?.features?.hours && <CardHours card={card} project={project} />}

          <div className="my-5 h-px bg-line" />
          <EditorBoundary key={card.id}>
            <Suspense fallback={<div className="min-h-[160px]" />}>
              <Editor cardId={card.id} content={card.content} onSave={(content) => updateCard(card.id, { content })} />
            </Suspense>
          </EditorBoundary>
        </div>
      </div>

      <footer className="flex items-center gap-2 border-t border-line px-5 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))] text-[12px] text-faint sm:px-8">
        {isTemplate ? (
          <span>Las fechas de la plantilla son relativas: se calculan desde el día en que se crea cada tarjeta.</span>
        ) : card.done && card.completed_at ? (
          <span className="flex items-center gap-1.5">
            <CircleCheckBig size={13} /> Terminada hace {formatDistanceToNowStrict(new Date(card.completed_at), { locale: es })}
          </span>
        ) : (
          <span>Creada hace {formatDistanceToNowStrict(new Date(card.created_at), { locale: es })}</span>
        )}
        <span className="flex-1" />
        <span className={cx(isTemplate && 'max-sm:hidden')}>Editada hace {formatDistanceToNowStrict(new Date(card.updated_at), { locale: es })}</span>
      </footer>

      <Popover open={more.open} anchor={more.anchor} onClose={more.close} align="end" width={270}>
        {isTemplate ? (
          <MenuItem
            icon={Trash2}
            danger
            onClick={() => {
              more.close()
              if (!confirm(`¿Borrar la plantilla «${card.template?.name}»? Las tarjetas creadas con ella no se tocan.`)) return
              onClose()
              s.deleteTemplate(card.id)
            }}
          >
            Borrar plantilla
          </MenuItem>
        ) : (
        <>
        <MenuItem icon={Folder} onClick={() => {
            const a = more.anchor
            more.close()
            move.openAt(a)
          }}>
          Mover a otro proyecto
        </MenuItem>
        <MenuItem
          icon={CopyPlus}
          onClick={async () => {
            more.close()
            const c = await duplicateCard(card.id, true)
            if (c) {
              openCopy(c)
              toast.success('Tarjeta duplicada con su contenido')
            }
          }}
        >
          Duplicar con contenido
        </MenuItem>
        <MenuItem
          icon={Copy}
          onClick={async () => {
            more.close()
            const c = await duplicateCard(card.id, false)
            if (c) {
              openCopy(c)
              toast.success('Tarjeta duplicada (solo propiedades)')
            }
          }}
        >
          Duplicar solo propiedades
        </MenuItem>
        <Divider />
        {project && (
          <MenuItem
            icon={LayoutTemplate}
            onClick={async () => {
              more.close()
              const t = await s.saveAsTemplate(card.id, false)
              if (t) toast.success(`Plantilla «${t.template.name}» creada en ${project.name}`, { action: { label: 'Editar', onClick: () => openCopy(t) } })
            }}
          >
            Guardar como plantilla del proyecto
          </MenuItem>
        )}
        <MenuItem
          icon={LayoutTemplate}
          onClick={async () => {
            more.close()
            const t = await s.saveAsTemplate(card.id, true)
            if (t) toast.success(`Plantilla general «${t.template.name}» creada`, { action: { label: 'Editar', onClick: () => openCopy(t) } })
          }}
        >
          Guardar como plantilla general
        </MenuItem>
        <Divider />
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
        </>
        )}
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

/* Nombre de la plantilla (con el que aparece al elegirla) */
function TemplateName({ card }) {
  const updateCard = useStore((s) => s.updateCard)
  return (
    <input
      key={card.id + (card.template?.name || '')}
      defaultValue={card.template?.name || ''}
      placeholder="Nombre de la plantilla"
      onBlur={(e) => {
        const name = e.target.value.trim()
        if (name && name !== card.template?.name) updateCard(card.id, { template: { ...card.template, name } })
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="mb-2 h-9 w-full rounded-lg border border-dashed border-[color-mix(in_oklab,var(--accent)_40%,var(--line))] bg-accent-soft px-3 text-[15px] font-medium text-accent outline-none placeholder:text-[color-mix(in_oklab,var(--accent)_55%,transparent)]"
    />
  )
}
