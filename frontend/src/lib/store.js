import { create } from 'zustand'
import { toast } from 'sonner'
import { ApiError, del, get, patch, post } from './api'
import { applyLook } from './theme'

const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]))
const without = (obj, id) => {
  const { [id]: _, ...rest } = obj
  return rest
}

const KIND_KEY = {
  user: null,
  project: 'projects',
  group: 'groups',
  label: 'labels',
  view: 'views',
  card: 'cards',
  rule: 'rules',
}

function fail(e) {
  toast.error(e instanceof ApiError ? e.message : 'Sin conexión con el servidor')
}

export const useStore = create((set, getState) => ({
  status: 'loading', // loading | anon | ready
  online: true,
  user: null,
  projects: {},
  groups: {},
  labels: {},
  views: {},
  cards: {},
  rules: {},
  notifications: [],
  vapidKey: null,
  // Tarjetas con borrado pendiente (el aviso de Deshacer sigue en pantalla)
  hidden: {},

  async bootstrap() {
    try {
      const d = await get('/bootstrap')
      applyLook(d.user)
      set({
        status: 'ready',
        user: d.user,
        projects: byId(d.projects),
        groups: byId(d.groups),
        labels: byId(d.labels),
        views: byId(d.views),
        cards: byId(d.cards),
        rules: byId(d.rules),
        notifications: d.notifications,
        vapidKey: d.vapid_public_key,
      })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) set({ status: 'anon', user: null })
      else if (getState().status === 'loading') setTimeout(() => getState().bootstrap(), 2000)
    }
  },

  setOnline: (online) => set({ online }),

  // ── Eventos que llegan por WebSocket ──
  applyEvents(events) {
    set((s) => {
      const next = { ...s }
      for (const ev of events) {
        if (ev.t === 'upsert') {
          if (ev.k === 'user') {
            next.user = ev.d
            applyLook(ev.d)
          } else if (ev.k === 'notification') {
            if (!next.notifications.some((n) => n.id === ev.d.id)) next.notifications = [ev.d, ...next.notifications]
          } else if (KIND_KEY[ev.k]) {
            const key = KIND_KEY[ev.k]
            next[key] = { ...next[key], [ev.d.id]: ev.d }
          }
        } else if (ev.t === 'delete') {
          removeLocal(next, ev.k, ev.id)
        } else if (ev.t === 'notifications_read') {
          next.notifications = next.notifications.map((n) => ({ ...n, read: true }))
        } else if (ev.t === 'notifications_cleared') {
          next.notifications = []
        }
      }
      return next
    })
  },

  // ── Perfil ──
  async updateMe(body) {
    const prev = getState().user
    const optimistic = { ...prev, ...body }
    if (body.clear_todo_projects) optimistic.todo_projects = null
    set({ user: optimistic })
    applyLook(optimistic)
    try {
      const user = await patch('/me', body)
      set({ user })
    } catch (e) {
      set({ user: prev })
      applyLook(prev)
      fail(e)
    }
  },

  // ── Proyectos ──
  async createProject(body) {
    try {
      const d = await post('/projects', body)
      set((s) => ({
        projects: { ...s.projects, [d.project.id]: d.project },
        groups: { ...s.groups, ...byId(d.groups) },
        labels: { ...s.labels, ...byId(d.labels) },
        views: { ...s.views, ...byId(d.views) },
      }))
      return d.project
    } catch (e) {
      fail(e)
    }
  },
  updateProject: (id, body) => optimisticPatch(set, getState, 'projects', `/projects/${id}`, id, body),
  async deleteProject(id) {
    set((s) => {
      const next = { ...s }
      removeLocal(next, 'project', id)
      return next
    })
    try {
      await del(`/projects/${id}`)
    } catch (e) {
      fail(e)
      getState().bootstrap()
    }
  },

  // ── Grupos y etiquetas ──
  async createGroup(body) {
    try {
      const g = await post('/groups', body)
      set((s) => ({ groups: { ...s.groups, [g.id]: g } }))
      return g
    } catch (e) {
      fail(e)
    }
  },
  updateGroup: (id, body) => optimisticPatch(set, getState, 'groups', `/groups/${id}`, id, body),
  async deleteGroup(id) {
    set((s) => {
      const next = { ...s }
      removeLocal(next, 'group', id)
      return next
    })
    try {
      await del(`/groups/${id}`)
    } catch (e) {
      fail(e)
    }
  },
  async createLabel(body) {
    try {
      const l = await post('/labels', body)
      set((s) => ({ labels: { ...s.labels, [l.id]: l } }))
      return l
    } catch (e) {
      fail(e)
    }
  },
  updateLabel: (id, body) => optimisticPatch(set, getState, 'labels', `/labels/${id}`, id, body),
  async deleteLabel(id) {
    set((s) => {
      const next = { ...s }
      removeLocal(next, 'label', id)
      return next
    })
    try {
      await del(`/labels/${id}`)
    } catch (e) {
      fail(e)
    }
  },

  // ── Vistas ──
  async createView(body) {
    try {
      const v = await post('/views', body)
      set((s) => ({ views: { ...s.views, [v.id]: v } }))
      return v
    } catch (e) {
      fail(e)
    }
  },
  updateView: (id, body) => optimisticPatch(set, getState, 'views', `/views/${id}`, id, body),
  async deleteView(id) {
    set((s) => ({ views: without(s.views, id) }))
    try {
      await del(`/views/${id}`)
    } catch (e) {
      fail(e)
    }
  },

  // ── Tarjetas ──
  async createCard(body) {
    try {
      const c = await post('/cards', body)
      set((s) => ({ cards: { ...s.cards, [c.id]: c } }))
      return c
    } catch (e) {
      fail(e)
    }
  },
  updateCard(id, body) {
    const local = { ...body }
    // El servidor sincroniza "hecho" con la etiqueta de terminado; aquí se
    // adelanta el mismo cálculo para que el cambio se vea sin esperar.
    const s = getState()
    const card = s.cards[id]
    if (card && body.done !== undefined && body.label_ids === undefined) {
      local.label_ids = syncDoneLabels(s, card, body.done)
      local.completed_at = body.done ? new Date().toISOString() : null
    }
    if (card && body.label_ids !== undefined && body.done === undefined) {
      const doneNow = body.label_ids.some((lid) => s.labels[lid]?.marks_done)
      const doneBefore = card.label_ids.some((lid) => s.labels[lid]?.marks_done)
      if (doneNow && !card.done) local.done = true
      if (doneBefore && !doneNow && card.done) local.done = false
    }
    if (card && body.project_id !== undefined && body.project_id !== card.project_id) local.label_ids = []
    return optimisticPatch(set, getState, 'cards', `/cards/${id}`, id, body, local)
  },
  deleteCard(id) {
    const card = getState().cards[id]
    if (!card) return
    set((s) => ({ hidden: { ...s.hidden, [id]: true } }))
    let undone = false
    const timer = setTimeout(async () => {
      if (undone) return
      set((s) => ({ cards: without(s.cards, id), hidden: without(s.hidden, id) }))
      try {
        await del(`/cards/${id}`)
      } catch (e) {
        fail(e)
      }
    }, 5000)
    toast(`«${card.title || 'Sin título'}» eliminada`, {
      duration: 5000,
      action: {
        label: 'Deshacer',
        onClick: () => {
          undone = true
          clearTimeout(timer)
          set((s) => ({ hidden: without(s.hidden, id) }))
        },
      },
    })
  },

  // ── Reglas y avisos ──
  async createRule(body) {
    try {
      const r = await post('/rules', body)
      set((s) => ({ rules: { ...s.rules, [r.id]: r } }))
    } catch (e) {
      fail(e)
    }
  },
  updateRule: (id, body) => optimisticPatch(set, getState, 'rules', `/rules/${id}`, id, body),
  async deleteRule(id) {
    set((s) => ({ rules: without(s.rules, id) }))
    try {
      await del(`/rules/${id}`)
    } catch (e) {
      fail(e)
    }
  },
  async readAllNotifications() {
    set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }))
    try {
      await post('/notifications/read-all')
    } catch {}
  },
  async clearNotifications() {
    set({ notifications: [] })
    try {
      await del('/notifications')
    } catch {}
  },

  async logout() {
    try {
      await post('/auth/logout')
    } catch {}
    set({ status: 'anon', user: null, projects: {}, cards: {}, groups: {}, labels: {}, views: {}, rules: {}, notifications: [] })
  },
}))

// Las peticiones de cada entidad salen en orden: si se escribe rápido en un
// título, la respuesta de una petición vieja nunca pisa la de una más nueva.
const seq = {}

async function optimisticPatch(set, getState, key, url, id, body, local = body) {
  const prev = getState()[key][id]
  if (!prev) return
  set((s) => ({ [key]: { ...s[key], [id]: { ...s[key][id], ...local } } }))
  const tag = `${key}:${id}`
  const mine = (seq[tag] = (seq[tag] || 0) + 1)
  try {
    const fresh = await patch(url, body)
    if (seq[tag] === mine) set((s) => (s[key][id] ? { [key]: { ...s[key], [id]: fresh } } : {}))
    return fresh
  } catch (e) {
    if (seq[tag] === mine) set((s) => ({ [key]: { ...s[key], [id]: prev } }))
    fail(e)
  }
}

function syncDoneLabels(s, card, done) {
  let ids = [...card.label_ids]
  const groups = Object.values(s.groups).filter((g) => g.project_id === card.project_id && !g.multi)
  for (const g of groups) {
    const labels = Object.values(s.labels).filter((l) => l.group_id === g.id)
    const doneLabel = labels.find((l) => l.marks_done)
    if (!doneLabel) continue
    const inGroup = ids.filter((lid) => s.labels[lid]?.group_id === g.id)
    if (done && !inGroup.includes(doneLabel.id)) {
      ids = ids.filter((lid) => s.labels[lid]?.group_id !== g.id).concat(doneLabel.id)
    } else if (!done && inGroup.some((lid) => s.labels[lid]?.marks_done)) {
      const first = labels.filter((l) => !l.marks_done).sort((a, b) => a.position - b.position)[0]
      ids = ids.filter((lid) => s.labels[lid]?.group_id !== g.id).concat(first ? [first.id] : [])
    }
  }
  return ids
}

function removeLocal(next, kind, id) {
  if (kind === 'project') {
    next.projects = without(next.projects, id)
    const gids = Object.values(next.groups).filter((g) => g.project_id === id).map((g) => g.id)
    next.groups = Object.fromEntries(Object.entries(next.groups).filter(([, g]) => g.project_id !== id))
    next.labels = Object.fromEntries(Object.entries(next.labels).filter(([, l]) => !gids.includes(l.group_id)))
    next.views = Object.fromEntries(Object.entries(next.views).filter(([, v]) => v.project_id !== id))
    next.cards = Object.fromEntries(Object.entries(next.cards).filter(([, c]) => c.project_id !== id))
    next.rules = Object.fromEntries(Object.entries(next.rules).filter(([, r]) => r.project_id !== id))
  } else if (kind === 'group') {
    const lids = Object.values(next.labels).filter((l) => l.group_id === id).map((l) => l.id)
    next.groups = without(next.groups, id)
    next.labels = Object.fromEntries(Object.entries(next.labels).filter(([, l]) => l.group_id !== id))
    next.cards = Object.fromEntries(
      Object.entries(next.cards).map(([k, c]) => [k, { ...c, label_ids: c.label_ids.filter((l) => !lids.includes(l)) }]),
    )
  } else if (kind === 'label') {
    next.labels = without(next.labels, id)
    next.cards = Object.fromEntries(
      Object.entries(next.cards).map(([k, c]) => [k, c.label_ids.includes(id) ? { ...c, label_ids: c.label_ids.filter((l) => l !== id) } : c]),
    )
  } else if (KIND_KEY[kind]) {
    next[KIND_KEY[kind]] = without(next[KIND_KEY[kind]], id)
  }
}
