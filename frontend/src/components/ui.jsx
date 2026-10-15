import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'
import { ARRIVE, css, LEAVE, QUICK, useBackToClose, usePresence } from '../lib/layers'

// Muelles para lo poco que sigue en Motion (pastillas con layoutId)
export const spring = { type: 'spring', stiffness: 520, damping: 38, mass: 0.7 }
export const softSpring = { type: 'spring', stiffness: 300, damping: 32 }

export function cx(...a) {
  return a.filter(Boolean).join(' ')
}

export function useIsMobile(bp = 640) {
  const [m, setM] = useState(() => window.innerWidth < bp)
  useEffect(() => {
    const on = () => setM(window.innerWidth < bp)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [bp])
  return m
}

export const Button = forwardRef(function Button({ variant = 'ghost', size = 'md', className, children, ...props }, ref) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium select-none transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap'
  const sizes = { sm: 'h-8 px-2.5 text-[13px] sm:h-7', md: 'h-10 px-3.5 text-sm sm:h-9', lg: 'h-12 px-5 text-[15px] sm:h-11' }
  const variants = {
    primary: 'bg-accent text-accent-ink hover:brightness-[1.06] shadow-soft',
    soft: 'bg-accent-soft text-accent hover:bg-[color-mix(in_oklab,var(--accent)_20%,transparent)]',
    ghost: 'text-muted hover:text-ink hover:bg-hover',
    outline: 'border border-line text-ink hover:bg-hover',
    danger: 'text-danger hover:bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]',
  }
  return (
    <button ref={ref} className={cx(base, sizes[size], variants[variant], className)} {...props}>
      {children}
    </button>
  )
})

export const IconButton = forwardRef(function IconButton({ className, label, size = 'md', active, ...props }, ref) {
  // En táctil, 40px como mínimo: por debajo se falla el toque
  const sizes = { sm: 'size-8 sm:size-7', md: 'size-10 sm:size-8', lg: 'size-11 sm:size-10' }
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-muted transition-[background-color,color,transform] duration-150 hover:text-ink hover:bg-hover active:scale-90',
        active && 'text-ink bg-hover',
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})

/* Check redondo. Todo por CSS (transform/opacity y el trazo con
   stroke-dashoffset): a la frecuencia nativa de la pantalla. */
export function Checkbox({ checked, onChange, size = 18, className }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className={cx('group relative grid shrink-0 place-items-center rounded-full before:absolute before:-inset-2.5 before:content-[""]', className)}
      style={{ width: size, height: size }}
    >
      <span
        className={cx('absolute inset-0 rounded-full border-[1.5px]', checked ? 'chk-pop border-[var(--accent)] bg-accent' : 'border-[var(--faint)] group-hover:border-[var(--muted)]')}
        style={{ transition: 'background-color .2s, border-color .2s' }}
      />
      <svg viewBox="0 0 16 16" className="relative" style={{ width: size * 0.62, height: size * 0.62 }}>
        <path
          d="M3.5 8.4l3 3 6-6.6"
          fill="none"
          stroke="var(--accent-ink)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
          strokeDasharray="1"
          style={{ strokeDashoffset: checked ? 0 : 1, transition: `stroke-dashoffset .26s cubic-bezier(.32,.72,0,1) ${checked ? '.06s' : '0s'}` }}
        />
      </svg>
    </button>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cx('relative h-[24px] w-[40px] shrink-0 rounded-full transition-colors duration-200 sm:h-[22px] sm:w-[38px]', checked ? 'bg-accent' : 'bg-line')}
    >
      <span
        className="absolute left-[3px] top-[3px] size-[18px] rounded-full bg-white shadow-sm sm:size-4"
        style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)', transition: css(QUICK, ['transform']) }}
      />
    </button>
  )
}

export function LabelChip({ label, onRemove, size = 'md', className }) {
  if (!label) return null
  return (
    <span
      data-c={label.color}
      className={cx(
        'lbl inline-flex max-w-full items-center gap-1 rounded-md font-medium',
        size === 'sm' ? 'h-5 px-1.5 text-[11.5px]' : 'h-6 px-2 text-[12.5px]',
        className,
      )}
    >
      <span className="truncate">{label.name}</span>
      {onRemove && (
        <button onClick={onRemove} className="-mr-0.5 opacity-60 hover:opacity-100">
          <X size={12} />
        </button>
      )}
    </span>
  )
}

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        // 16px en móvil: con menos, iOS hace zoom al enfocar el campo
        'h-11 w-full rounded-lg border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow] duration-150 focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--line))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_16%,transparent)] sm:h-10 sm:text-[15px]',
        className,
      )}
      {...props}
    />
  )
})

export function Kbd({ children }) {
  return <kbd className="rounded border border-line bg-sunken px-1.5 py-px font-sans text-[11px] text-muted">{children}</kbd>
}

/* Velo detrás de las capas */
export function Scrim({ shown, onClick, z = 'z-[60]', strong }) {
  return (
    <div
      onClick={onClick}
      aria-hidden
      className={cx('fixed inset-0', z, strong ? 'bg-[var(--scrim-strong)]' : 'bg-[var(--scrim)]')}
      style={{ opacity: shown ? 1 : 0, transition: css(shown ? ARRIVE : LEAVE, ['opacity']), pointerEvents: shown ? 'auto' : 'none' }}
    />
  )
}

/* Tirar hacia abajo para cerrar una hoja. Va en la cabecera (asa incluida),
   no en toda la hoja: si estuviera en toda, dentro no se podría hacer scroll.
   El gesto solo se adueña del dedo cuando de verdad baja (más de 6px y más
   vertical que horizontal): así los botones de la cabecera siguen
   respondiendo a un toque normal. */
export function useDragToClose(onClose) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const g = useRef(null)
  const end = (e) => {
    const d = g.current
    g.current = null
    if (!d?.active) return
    const dy = Math.max(0, e.clientY - d.y)
    const v = (dy / Math.max(1, performance.now() - d.t)) * 1000
    setDragging(false)
    setOffset(0)
    if (dy > 90 || v > 520) onClose()
  }
  const handlers = {
    onPointerDown: (e) => {
      g.current = { x: e.clientX, y: e.clientY, t: performance.now(), active: false, id: e.pointerId, el: e.currentTarget }
    },
    onPointerMove: (e) => {
      const d = g.current
      if (!d) return
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (!d.active) {
        if (dy > 6 && dy > Math.abs(dx)) {
          d.active = true
          d.t = performance.now()
          try {
            d.el.setPointerCapture(d.id)
          } catch {}
          setDragging(true)
        } else if (Math.abs(dx) > 10 || dy < -10) {
          g.current = null
          return
        } else return
      }
      setOffset(Math.max(0, dy))
    },
    onPointerUp: end,
    onPointerCancel: end,
    style: { touchAction: 'none' },
  }
  return { offset, dragging, handlers }
}

/* Hoja inferior (móvil): entra desde abajo, se cierra con el velo, con el asa
   arrastrándola o con el gesto de volver. */
export function Sheet({ open, onClose, children, className, z = 'z-[70]', full }) {
  const { mounted, shown } = usePresence(open)
  useBackToClose(open, onClose)
  const drag = useDragToClose(onClose)
  if (!mounted) return null
  const y = shown ? drag.offset : null
  return createPortal(
    <>
      <Scrim shown={shown} onClick={onClose} z={z} />
      <div
        role="dialog"
        className={cx('fixed inset-x-0 bottom-0 flex flex-col rounded-t-[20px] border-t border-line bg-surface shadow-float', full ? 'top-[max(env(safe-area-inset-top),10px)]' : 'max-h-[86dvh]', z, className)}
        style={{
          transform: y === null ? 'translateY(100%)' : `translateY(${y}px)`,
          transition: drag.dragging ? 'none' : css(shown ? ARRIVE : LEAVE, ['transform']),
          willChange: 'transform',
        }}
      >
        <div {...drag.handlers} className="flex shrink-0 cursor-grab justify-center pb-3 pt-3">
          <div className="h-[5px] w-10 rounded-full bg-line" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(12px,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </>,
    document.body,
  )
}

/* Popover anclado a un elemento. En móvil se convierte en hoja inferior,
   que es lo que el pulgar alcanza bien. */
export function Popover({ anchor, open, onClose, children, width = 260, align = 'start', className }) {
  const mobile = useIsMobile()
  if (mobile)
    return (
      <Sheet open={open} onClose={onClose} className={className}>
        {children}
      </Sheet>
    )
  return (
    <DesktopPopover anchor={anchor} open={open} onClose={onClose} width={width} align={align} className={className}>
      {children}
    </DesktopPopover>
  )
}

function DesktopPopover({ anchor, open, onClose, children, width, align, className }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  const { mounted, shown } = usePresence(open, 180)
  const lastAnchor = useRef(anchor)
  if (anchor) lastAnchor.current = anchor
  useBackToClose(open, onClose)

  useLayoutEffect(() => {
    if (!mounted) return
    const place = () => {
      const a = lastAnchor.current
      if (!a) return
      const r = a.getBoundingClientRect()
      const h = ref.current?.offsetHeight || 300
      let left = align === 'end' ? r.right - width : r.left
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
      let top = r.bottom + 6
      if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6
      setPos({ left, top, up: top < r.top })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [mounted, width, align])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || lastAnchor.current?.contains(e.target)) return
      // Un clic dentro de otra capa que esté encima (otro popover) no cierra este
      if (e.target.closest?.('[data-layer]') && !ref.current?.contains(e.target)) return
      onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [open, onClose])

  if (!mounted) return null
  return createPortal(
    <div
      ref={ref}
      data-layer
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        width,
        transformOrigin: `${align === 'end' ? 'right' : 'left'} ${pos?.up ? 'bottom' : 'top'}`,
        opacity: shown && pos ? 1 : 0,
        transform: shown && pos ? 'none' : `translateY(${pos?.up ? 4 : -4}px) scale(0.97)`,
        transition: css(shown ? QUICK : { duration: 0.14, ease: LEAVE.ease }),
      }}
      className={cx('fixed z-[70] max-h-[min(460px,70vh)] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-float', className)}
    >
      {children}
    </div>,
    document.body,
  )
}

/* Botón + popover en uno: lo más habitual */
export function usePopover() {
  const [anchor, setAnchor] = useState(null)
  return {
    open: !!anchor,
    anchor,
    toggle: (e) => setAnchor((a) => (a ? null : e.currentTarget)),
    openAt: (el) => setAnchor(el),
    close: () => setAnchor(null),
  }
}

export function MenuItem({ icon: Icon, children, onClick, danger, active, right, className }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] transition-colors duration-100 sm:gap-2.5 sm:rounded-lg sm:px-2.5 sm:py-1.5 sm:text-[14px]',
        danger ? 'text-danger hover:bg-[color-mix(in_oklab,var(--danger)_10%,transparent)]' : 'text-ink hover:bg-hover active:bg-hover',
        active && 'bg-hover',
        className,
      )}
    >
      {Icon && <Icon size={17} className={cx('shrink-0', danger ? '' : 'text-muted')} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {right}
      {active === true && !right && <Check size={16} className="text-accent" />}
    </button>
  )
}

export function MenuLabel({ children }) {
  return <div className="px-3 pb-1 pt-2 text-[11.5px] font-medium uppercase tracking-wide text-faint sm:px-2.5">{children}</div>
}

export function Divider() {
  return <div className="my-1 h-px bg-line" />
}

/* Diálogo centrado (en móvil, arriba: así el teclado no lo tapa) */
export function Modal({ open, onClose, children, className }) {
  const { mounted, shown } = usePresence(open)
  useBackToClose(open, onClose)
  if (!mounted) return null
  return createPortal(
    <>
      <Scrim shown={shown} onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 z-[60] flex items-start justify-center px-3 pt-[max(calc(env(safe-area-inset-top)+12px),8vh)] sm:items-center sm:p-4">
        <div
          role="dialog"
          className={cx('pointer-events-auto w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-float', className)}
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? 'none' : 'translateY(10px) scale(0.97)',
            transition: css(shown ? ARRIVE : LEAVE),
          }}
        >
          {children}
        </div>
      </div>
    </>,
    document.body,
  )
}

/* Plegar/desplegar sin medir alturas desde JavaScript: grid 0fr → 1fr */
export function Collapse({ open, children, className }) {
  return (
    <div
      className="grid"
      style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0, transition: `grid-template-rows .28s cubic-bezier(.32,.72,0,1), opacity .2s` }}
    >
      <div className={cx('min-h-0 overflow-hidden', className)} inert={!open}>
        {children}
      </div>
    </div>
  )
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="entra mx-auto flex max-w-sm flex-col items-center py-16 text-center">
      {Icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon size={22} />
        </div>
      )}
      <div className="text-[15px] font-medium text-ink">{title}</div>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  )
}
