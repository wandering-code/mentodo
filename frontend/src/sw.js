/* Service worker: caché de la app (instalable como PWA) + avisos Web Push */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

self.skipWaiting()
self.addEventListener('activate', () => self.clients.claim())

cleanupOutdatedCaches()
// Iconos y manifest fuera de la caché del service worker: iOS los pide al
// añadir a la pantalla de inicio y, servidos desde aquí, puede no usarlos
// (letra gris en vez del logo). Así van siempre directos a la red.
const BYPASS = /(^|\/)(icons\/|apple-touch-icon|icon-\d+\.png|manifest\.webmanifest)/
precacheAndRoute(self.__WB_MANIFEST.filter((e) => !BYPASS.test(typeof e === 'string' ? e : e.url)))
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api/, /^\/ws/] }))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: 'Mentodo', body: event.data?.text() }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Mentodo', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
