import { CLIENT_ID } from './api'
import { useStore } from './store'

// Canal en tiempo real con el servidor. Al reconectar (móvil que vuelve de
// segundo plano, wifi que se cae) se vuelve a pedir todo: lo que pasó
// mientras estaba desconectado no llegó por el socket.
let ws = null
let retry = 0
let pingTimer = null
let stopped = true
let lastPong = 0
const STALE_MS = 60000 // sin respuesta al ping en este tiempo: conexión muerta

/* Un socket puede quedarse «abierto» sin conexión real (el Mac se duerme,
   cambia la red, se reinicia el túnel) y el navegador no avisa: los cambios
   que nacen en el servidor se perdían hasta recargar. Si deja de responder
   al ping, se cierra y se reconecta (y al reconectar se recarga todo). */
function checkAlive() {
  if (!ws || ws.readyState !== 1) return
  if (Date.now() - lastPong > STALE_MS) {
    const dead = ws
    dead.onclose?.({ code: 4000 })
    try {
      dead.close()
    } catch {}
  }
}

function open() {
  if (stopped) return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const sock = new WebSocket(`${proto}://${location.host}/ws?client_id=${CLIENT_ID}`)
  ws = sock
  sock.onopen = () => {
    const firstTime = retry === 0 && useStore.getState().status === 'ready'
    retry = 0
    lastPong = Date.now()
    useStore.getState().setOnline(true)
    if (!firstTime) useStore.getState().bootstrap()
    clearInterval(pingTimer)
    pingTimer = setInterval(() => {
      checkAlive()
      if (sock.readyState === 1) sock.send('ping')
    }, 20000)
  }
  sock.onmessage = (e) => {
    lastPong = Date.now() // cualquier mensaje demuestra que la conexión vive
    if (e.data === 'pong') return
    try {
      const msg = JSON.parse(e.data)
      // Lo propio ya está aplicado; salvo lo marcado «echo» (p. ej. la
      // siguiente repetición de una tarea, que nace en el servidor)
      const events = msg.origin === CLIENT_ID ? (msg.events || []).filter((ev) => ev.echo) : msg.events || []
      if (!events.length) return
      useStore.getState().applyEvents(events)
      if ((msg.events || []).some((ev) => ev.t === 'reload_admin')) window.dispatchEvent(new Event('mentodo:admin'))
    } catch {}
  }
  sock.onclose = (e) => {
    clearInterval(pingTimer)
    if (ws !== sock) return
    ws = null
    if (e.code === 4401) {
      useStore.getState().bootstrap()
      return
    }
    useStore.getState().setOnline(false)
    retry += 1
    setTimeout(open, Math.min(1000 * 2 ** retry, 15000))
  }
}

export function startSync() {
  if (!stopped) return
  stopped = false
  retry = 0
  open()
}

export function stopSync() {
  stopped = true
  const s = ws
  ws = null
  s?.close()
}

function wake() {
  if (stopped) return
  if (!ws || ws.readyState > 1) {
    retry = 1
    open()
    return
  }
  // Abierto en apariencia: se pide un ping y, si no contesta pronto, fuera
  try {
    ws.send('ping')
  } catch {}
  const sent = Date.now()
  setTimeout(() => {
    if (lastPong < sent) {
      lastPong = 0
      checkAlive()
    }
  }, 5000)
}

document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wake())
window.addEventListener('online', wake)
window.addEventListener('focus', wake)
