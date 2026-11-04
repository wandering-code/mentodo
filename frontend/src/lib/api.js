// Identifica esta pestaña/dispositivo: el servidor reenvía cada cambio a las
// demás conexiones del perfil y esta ignora el eco de los suyos propios.
export const CLIENT_ID = (() => {
  try {
    let id = sessionStorage.getItem('mentodo:client')
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem('mentodo:client', id)
    }
    return id
  } catch {
    return Math.random().toString(36).slice(2)
  }
})()

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/* Mensaje para una respuesta fallida. El backend siempre contesta en JSON con
   «detail»; si no viene JSON, la respuesta es de algo que hay por el camino
   (proxy o cortafuegos de una red de empresa, Cloudflare, nginx) y se dice
   así, con el código, para no confundirlo con un fallo de Mentodo. */
export async function errorMessage(res, fallback = 'Algo ha fallado') {
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    try {
      const data = await res.json()
      const msg = typeof data.detail === 'string' ? data.detail : data.detail?.[0]?.msg
      if (msg) return msg
    } catch {}
    return `${fallback} (${res.status})`
  }
  if (res.status === 403 || res.status === 407) return `La red ha bloqueado la petición (${res.status})`
  if (res.status === 413) return `Demasiado grande para enviarlo (${res.status})`
  if (res.status >= 500) return `El servidor no responde (${res.status})`
  return `${fallback} (${res.status})`
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: { 'content-type': 'application/json', 'x-client-id': CLIENT_ID },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  return res.status === 204 ? null : res.json()
}

export const get = (p) => api(p)
export const post = (p, body = {}) => api(p, { method: 'POST', body })
export const patch = (p, body) => api(p, { method: 'PATCH', body })
export const del = (p) => api(p, { method: 'DELETE' })
