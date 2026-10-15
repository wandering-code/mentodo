import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/* Curvas de las capas (paneles, hojas, menús), las mismas que Puchi midió:
   salen disparadas y frenan al final sin rebote ni cola.

   El movimiento de abrir y cerrar va por TRANSICIONES CSS de transform y
   opacity, no por Motion: lo que Motion anima desde JavaScript (x, y, scale)
   Safari lo deja a 60 fps aunque la pantalla vaya a 120 (iPhone Pro, iPad
   Pro). Una transición CSS la hace el navegador en la GPU, a la frecuencia
   nativa de la pantalla. */
export const ARRIVE = { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
export const LEAVE = { duration: 0.24, ease: [0.4, 0, 0.6, 1] }
export const QUICK = { duration: 0.18, ease: [0.32, 0.72, 0, 1] }

export const css = (t, props = ['transform', 'opacity']) =>
  props.map((p) => `${p} ${t.duration}s cubic-bezier(${t.ease.join(', ')})`).join(', ')

/* Montaje con entrada y salida: `mounted` mantiene la capa en el DOM mientras
   sale, y `shown` cambia un fotograma después de montar para que la
   transición CSS tenga un estado de partida. */
export function usePresence(open, exitMs = LEAVE.duration * 1000 + 30) {
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)

  useLayoutEffect(() => {
    if (open) setMounted(true)
  }, [open])

  useEffect(() => {
    if (open && mounted) {
      let r2
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setShown(true))
      })
      return () => {
        cancelAnimationFrame(r1)
        cancelAnimationFrame(r2)
      }
    }
    if (!open && mounted) {
      setShown(false)
      const t = setTimeout(() => setMounted(false), exitMs)
      return () => clearTimeout(t)
    }
  }, [open, mounted, exitMs])

  return { mounted, shown }
}

/* El último valor no vacío: para seguir pintando el contenido de una capa
   mientras se va (la tarjeta que se cierra no debe quedarse en blanco). */
export function useLatest(value) {
  const ref = useRef(value)
  if (value) ref.current = value
  return value || ref.current
}

/* El gesto de volver del móvil (y el botón atrás de Android) cierra la última
   capa abierta en vez de salir de la app. Escape hace lo mismo en escritorio.

   Cada capa abierta mete una entrada en el historial. Al cerrarla con un
   botón se deshace esa entrada, salvo que ya no sea la de arriba (porque se
   navegó a otra página desde dentro de la capa): entonces se deja enterrada,
   o el back() desharía esa navegación. Un único listener para todas: con
   uno por capa, un solo "atrás" cerraba varias. */
const stack = []
let ownBacks = 0
let listening = false
let seq = 0

function ensureListener() {
  if (listening) return
  listening = true
  window.addEventListener('popstate', () => {
    if (ownBacks > 0) {
      ownBacks--
      return
    }
    const top = stack[stack.length - 1]
    if (top) {
      top.popped = true
      top.close()
    }
  })
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return
      const top = stack[stack.length - 1]
      if (top) {
        e.stopPropagation()
        top.close()
      }
    },
    true,
  )
}

export function useBackToClose(open, onClose) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    ensureListener()
    const id = `layer-${++seq}`
    window.history.pushState({ ...(window.history.state || {}), mentodoLayer: id }, '')
    const entry = { id, popped: false, close: () => closeRef.current() }
    stack.push(entry)
    return () => {
      const i = stack.indexOf(entry)
      if (i >= 0) stack.splice(i, 1)
      if (!entry.popped && window.history.state?.mentodoLayer === id) {
        ownBacks++
        window.history.back()
      }
    }
  }, [open])
}

export const isTouch = () => window.matchMedia('(pointer: coarse)').matches

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms)
  } catch {}
}

/* Convierte coordenadas de getBoundingClientRect a coordenadas para un
   elemento position: fixed, y da la zona que de verdad se ve en ese mismo
   sistema.

   No se puede dar por hecho cómo mide cada navegador: en el iPhone, con el
   teclado abierto, Safari desplaza la vista (visualViewport.offsetTop > 0) y
   getBoundingClientRect cuenta desde lo que se ve, mientras que un fixed se
   coloca respecto a la página. Sumar o no ese desplazamiento a ciegas deja el
   menú fuera de la pantalla en un navegador u otro. Así que se mide: una sonda
   fija en (0,0) dice dónde cae ese origen en el sistema de getBoundingClientRect. */
let probe = null
export function fixedFrame() {
  if (!probe) {
    probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)
  }
  const o = probe.getBoundingClientRect()
  const vv = window.visualViewport
  const vTop = vv ? vv.offsetTop : 0
  const vLeft = vv ? vv.offsetLeft : 0
  return {
    // rect → fixed
    x: (rx) => rx - o.left,
    y: (ry) => ry - o.top,
    // zona visible, en coordenadas de rect
    top: vTop + o.top,
    left: vLeft + o.left,
    height: vv ? vv.height : window.innerHeight,
    width: vv ? vv.width : window.innerWidth,
  }
}
