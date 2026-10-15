import { post } from './api'

function urlB64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export async function currentSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

export async function enablePush(vapidKey) {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Permiso denegado en el navegador')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(vapidKey) })
  const json = sub.toJSON()
  await post('/push/subscribe', { endpoint: json.endpoint, keys: json.keys })
  return sub
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  const json = sub.toJSON()
  await post('/push/unsubscribe', { endpoint: json.endpoint, keys: json.keys || {} })
  await sub.unsubscribe()
}
