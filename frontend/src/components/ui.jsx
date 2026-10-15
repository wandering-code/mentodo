import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Check, X } from 'lucide-react'

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
  const sizes = { sm: 'h-7 px-2.5 text-[13px]', md: 'h-9 px-3.5 text-sm', lg: 'h-11 px-5 text-[15px]' }
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
  const sizes = { sm: 'size-7', md: 'size-8', lg: 'size-10' }
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex items-center justify-center rounded-lg text-muted transition-[background-color,color,transform] duration-150 hover:text-ink hover:bg-hover active:scale-90',
        active && 'text-ink bg-hover',
        sizes[size],
        className,
      )}
      {...props}
    />
  )
})

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
      className={cx('group relative shrink-0 grid place-items-center rounded-full', className)}
      style={{ width: size, height: size }}
    >
      <motion.span
        initial={false}
        animate={{
          backgroundColor: checked ? 'var(--accent)' : 'rgba(0,0,0,0)',
          borderColor: checked ? 'var(--accent)' : 'var(--faint)',
          scale: checked ? [1, 0.82, 1.08, 1] : 1,
        }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 rounded-full border-[1.5px] group-hover:border-[var(--muted)]"
      />
      <svg viewBox="0 0 16 16" className="relative" style={{ width: size * 0.62, height: size * 0.62 }}>
        <motion.path
          d="M3.5 8.4l3 3 6-6.6"
          fill="none"
          stroke="var(--accent-ink)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.25, delay: checked ? 0.08 : 0, ease: 'easeOut' }}
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
      onClick={() => onChange(!checked)}
      className={cx('relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-accent' : 'bg-line')}
    >
      <motion.span
        layout
        transition={spring}
        className={cx('absolute top-[3px] size-4 rounded-full bg-white shadow-sm', checked ? 'right-[3px]' : 'left-[3px]')}
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
        'h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px] text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow] duration-150 focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--line))] focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_16%,transparent)]',
        className,
      )}
      {...props}
    />
  )
})

export function Kbd({ children }) {
  return <kbd className="rounded border border-line bg-sunken px-1.5 py-px font-sans text-[11px] text-muted">{children}</kbd>
}

/* Popover anclado a un elemento. En móvil se convierte en hoja inferior,
   que es lo que el pulgar alcanza bien. */
export function Popover({ anchor, open, onClose, children, width = 260, align = 'start', className }) {
  const mobile = useIsMobile()
  const ref = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    if (!open || mobile || !anchor) return
    const place = () => {
      const r = anchor.getBoundingClientRect()
      const h = ref.current?.offsetHeight || 300
      let left = align === 'end' ? r.right - width : r.left
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
      let top = r.bottom + 6
      if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6
      setPos({ left, top, origin: top < r.top ? 'bottom' : 'top' })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor, mobile, width, align])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && (e.stopPropagation(), onClose())
    const onDown = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [open, onClose, anchor])

  return createPortal(
    <AnimatePresence>
      {open &&
        (mobile ? (
          <motion.div key="sheet" className="fixed inset-0 z-[70]">
            <motion.div
              className="absolute inset-0 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              ref={ref}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={softSpring}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, i) => (i.offset.y > 80 || i.velocity.y > 500) && onClose()}
              className={cx('absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-2 pb-safe shadow-float', className)}
            >
              <div className="mx-auto mb-2 mt-1 h-1 w-9 rounded-full bg-line" />
              {children}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="pop"
            ref={ref}
            initial={{ opacity: 0, scale: 0.96, y: pos?.origin === 'bottom' ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }}
            transition={spring}
            style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, width, transformOrigin: `${align === 'end' ? 'right' : 'left'} ${pos?.origin || 'top'}` }}
            className={cx('fixed z-[70] max-h-[min(460px,70vh)] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-float', className)}
          >
            {children}
          </motion.div>
        ))}
    </AnimatePresence>,
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
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[14px] transition-colors duration-100 sm:py-1.5',
        danger ? 'text-danger hover:bg-[color-mix(in_oklab,var(--danger)_10%,transparent)]' : 'text-ink hover:bg-hover',
        active && 'bg-hover',
        className,
      )}
    >
      {Icon && <Icon size={16} className={danger ? '' : 'text-muted'} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {right}
      {active === true && !right && <Check size={15} className="text-accent" />}
    </button>
  )
}

export function MenuLabel({ children }) {
  return <div className="px-2.5 pb-1 pt-2 text-[11.5px] font-medium uppercase tracking-wide text-faint">{children}</div>
}

export function Divider() {
  return <div className="my-1 h-px bg-line" />
}

export function Modal({ open, onClose, children, className }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={spring}
            className={cx('relative w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-float', className)}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
      {Icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <Icon size={22} />
        </div>
      )}
      <div className="text-[15px] font-medium text-ink">{title}</div>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </motion.div>
  )
}
