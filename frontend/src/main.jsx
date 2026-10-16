import { toast } from 'sonner'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Sin menú contextual del navegador (clic derecho / pulsación larga en
// Android): en una app confunde, y deja el gesto libre para menús propios.
// Se respeta en los campos de texto, donde sirve para pegar y corregir.
// Para un menú propio: escuchar «contextmenu» en el elemento y hacer
// e.preventDefault() ahí; este listener global solo actúa si nadie lo ha hecho.
document.addEventListener('contextmenu', (e) => {
  if (e.defaultPrevented) return
  const t = e.target
  if (t instanceof Element && t.closest('input, textarea, select, [contenteditable="true"], .ProseMirror')) return
  e.preventDefault()
})

// Safari ignora user-scalable=no: el pellizco para hacer zoom se bloquea aquí
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false })
}

// El service worker solo en producción: en dev cachearía una versión vieja
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // La versión nueva se descarga sola, pero la ventana abierta sigue con la
  // vieja hasta recargar (en la app instalada puede pasar días así): se
  // busca actualización cada 30 min y al volver a la ventana, y cuando el
  // service worker nuevo toma el control se avisa (o se recarga si no se ve)
  let hadController = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true
      return
    }
    if (document.visibilityState === 'hidden') location.reload()
    else toast('Hay una versión nueva de Mentodo', { duration: Infinity, action: { label: 'Actualizar', onClick: () => location.reload() } })
  })
  navigator.serviceWorker
    .register('/sw.js', { type: 'module' })
    .then((reg) => {
      const check = () => reg.update().catch(() => {})
      setInterval(check, 30 * 60 * 1000)
      window.addEventListener('focus', check)
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
    })
    .catch(() => {})
}
