import { CLIENT_ID } from './api'
import { useStore } from './store'

// Canal en tiempo real con el servidor. Al reconectar (móvil que vuelve de
// segundo plano, wifi que se cae) se vuelve a pedir todo: lo que pasó
// mientras estaba desconectado no llegó por el socket.
let ws = null
let retry = 0
let pingTimer = null
let stopped = true

function open() {
  if (stopped) return
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  const sock = new WebSocket(`${proto}://${location.host}/ws?client_id=${CLIENT_ID}`)
  ws = sock
  sock.onopen = () => {
    const firstTime = retry === 0 && useStore.getState().status === 'ready'
    retry = 0
    useStore.getState().setOnline(true)
    if (!firstTime) useStore.getState().bootstrap()
    clearInterval(pingTimer)
    pingTimer = setInterval(() => sock.readyState === 1 && sock.send('ping'), 25000)
  }
  sock.onmessage = (e) => {
    if (e.data === 'pong') return
    try {
      const msg = JSON.parse(e.data)
      if (msg.origin === CLIENT_ID) return
      useStore.getState().applyEvents(msg.events || [])
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

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !stopped && (!ws || ws.readyState > 1)) {
    retry = 1
    open()
  }
})
