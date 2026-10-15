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

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: { 'content-type': 'application/json', 'x-client-id': CLIENT_ID },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = 'Algo ha fallado'
    try {
      const data = await res.json()
      msg = typeof data.detail === 'string' ? data.detail : data.detail?.[0]?.msg || msg
    } catch {}
    throw new ApiError(res.status, msg)
  }
  return res.status === 204 ? null : res.json()
}

export const get = (p) => api(p)
export const post = (p, body = {}) => api(p, { method: 'POST', body })
export const patch = (p, body) => api(p, { method: 'PATCH', body })
export const del = (p) => api(p, { method: 'DELETE' })
