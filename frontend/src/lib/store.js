import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { create } from 'zustand'
import { toast } from 'sonner'
import { ApiError, CLIENT_ID, del, get, patch, post } from './api'
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
  field: 'fields',
  note: 'notes',
  template: 'templates',
  link: 'links',
  attachment: 'attachments',
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
  fields: {},
  notes: {},
  templates: {},
  links: {},
  attachments: {},
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
        fields: byId(d.fields || []),
        notes: byId(d.notes || []),
        templates: byId(d.templates || []),
        links: byId(d.links || []),
        attachments: byId(d.attachments || []),
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
  deleteProject(id) {
    deferDelete(set, getState, { kind: 'project', id, path: `/projects/${id}`, message: `Proyecto «${getState().projects[id]?.name || ''}» eliminado` })
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
  updateGroup(id, body) {
    // Solo un grupo de estado por proyecto y sus etiquetas "de terminado" van
    // con él: el servidor lo garantiza, aquí se adelanta para verlo al instante
    const g = getState().groups[id]
    if (g && body.is_status !== undefined && body.is_status !== g.is_status) {
      set((s) => {
        const groups = { ...s.groups }
        const labels = { ...s.labels }
        const clear = (gid) => {
          for (const l of Object.values(labels)) if (l.group_id === gid && l.marks_done) labels[l.id] = { ...l, marks_done: false }
        }
        if (body.is_status) {
          for (const o of Object.values(groups))
            if (o.project_id === g.project_id && o.is_status && o.id !== id) {
              groups[o.id] = { ...o, is_status: false }
              clear(o.id)
            }
        } else clear(id)
        return { groups, labels }
      })
    }
    const local = body.is_status ? { ...body, multi: false } : body
    return optimisticPatch(set, getState, 'groups', `/groups/${id}`, id, body, local)
  },
  deleteGroup(id) {
    deferDelete(set, getState, { kind: 'group', id, path: `/groups/${id}`, message: `Propiedad «${getState().groups[id]?.name || ''}» eliminada` })
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
  updateLabel(id, body) {
    const l = getState().labels[id]
    if (l && body.marks_done) {
      set((s) => ({
        labels: Object.fromEntries(
          Object.entries(s.labels).map(([k, o]) => [k, o.group_id === l.group_id && o.id !== id && o.marks_done ? { ...o, marks_done: false } : o]),
        ),
      }))
    }
    return optimisticPatch(set, getState, 'labels', `/labels/${id}`, id, body)
  },
  deleteLabel(id) {
    deferDelete(set, getState, { kind: 'label', id, path: `/labels/${id}`, message: `Etiqueta «${getState().labels[id]?.name || ''}» eliminada` })
  },

  // ── Campos propios ──
  async createField(body) {
    try {
      const f = await post('/fields', body)
      set((s) => ({ fields: { ...s.fields, [f.id]: f } }))
      return f
    } catch (e) {
      fail(e)
    }
  },
  updateField: (id, body) => optimisticPatch(set, getState, 'fields', `/fields/${id}`, id, body),
  deleteField(id) {
    deferDelete(set, getState, { kind: 'field', id, path: `/fields/${id}`, message: `Propiedad «${getState().fields[id]?.name || ''}» eliminada` })
  },

  // ── Apuntes ──
  async createNote(body) {
    try {
      const n = await post('/notes', body)
      set((s) => ({ notes: { ...s.notes, [n.id]: n } }))
      return n
    } catch (e) {
      fail(e)
    }
  },
  updateNote: (id, body) => optimisticPatch(set, getState, 'notes', `/notes/${id}`, id, body),
  deleteNote(id) {
    deferDelete(set, getState, { kind: 'note', id, path: `/notes/${id}`, message: `Apunte «${getState().notes[id]?.title || 'Sin título'}» eliminado` })
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
  deleteView(id) {
    deferDelete(set, getState, { kind: 'view', id, path: `/views/${id}`, message: `Vista «${getState().views[id]?.name || ''}» eliminada` })
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
  // ── Adjuntos ──
  async uploadAttachment(file, target) {
    const form = new FormData()
    form.append('file', file)
    if (target.card_id) form.append('card_id', target.card_id)
    if (target.note_id) form.append('note_id', target.note_id)
    try {
      const res = await fetch('/api/attachments', { method: 'POST', body: form, credentials: 'include', headers: { 'x-client-id': CLIENT_ID } })
      if (!res.ok) {
        let msg = 'No se pudo subir el archivo'
        try {
          msg = (await res.json()).detail || msg
        } catch {}
        throw new ApiError(res.status, msg)
      }
      const a = await res.json()
      set((s) => ({ attachments: { ...s.attachments, [a.id]: a } }))
      return a
    } catch (e) {
      fail(e)
    }
  },
  deleteAttachment(id) {
    deferDelete(set, getState, { kind: 'attachment', id, path: `/attachments/${id}`, message: `Adjunto «${getState().attachments[id]?.filename || ''}» eliminado` })
  },

  // ── Relaciones ──
  async createLink(body) {
    try {
      const l = await post('/links', body)
      set((s) => ({ links: { ...s.links, [l.id]: l } }))
      return l
    } catch (e) {
      fail(e)
    }
  },
  deleteLink(id) {
    deferDelete(set, getState, { kind: 'link', id, path: `/links/${id}`, message: 'Relación quitada' })
  },

  // ── Plantillas ──
  async createTemplate(projectId) {
    try {
      const t = await post('/cards', { project_id: projectId, is_template: true, title: '', template: { name: 'Nueva plantilla', offsets: {} } })
      set((s) => ({ templates: { ...s.templates, [t.id]: t } }))
      return t
    } catch (e) {
      fail(e)
    }
  },
  async saveAsTemplate(cardId, profile) {
    try {
      const t = await post(`/cards/${cardId}/as-template`, { profile })
      set((s) => ({ templates: { ...s.templates, [t.id]: t } }))
      return t
    } catch (e) {
      fail(e)
    }
  },
  async cardFromTemplate(templateId, body) {
    try {
      const c = await post(`/cards/from-template/${templateId}`, body)
      set((s) => ({ cards: { ...s.cards, [c.id]: c } }))
      return c
    } catch (e) {
      fail(e)
    }
  },
  deleteTemplate(id) {
    deferDelete(set, getState, { kind: 'card', id, path: `/cards/${id}`, message: `Plantilla «${getState().templates[id]?.template?.name || ''}» eliminada` })
  },
  async duplicateCard(id, withContent) {
    try {
      const c = await post(`/cards/${id}/duplicate`, { with_content: withContent })
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
    const isTemplate = !s.cards[id] && !!s.templates[id]
    const card = s.cards[id] || s.templates[id]
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
    if (card && body.values) {
      const merged = { ...card.values }
      for (const [k, v] of Object.entries(body.values)) {
        if (v === null || v === '') delete merged[k]
        else merged[k] = v
      }
      local.values = merged
    }
    if (card && body.project_id !== undefined && body.project_id !== card.project_id) {
      local.label_ids = []
      local.values = {}
    }
    const res = optimisticPatch(set, getState, isTemplate ? 'templates' : 'cards', `/cards/${id}`, id, body, local)
    // Al terminar una tarea que se repite, el servidor crea la siguiente:
    // se avisa para que no parezca que la repetición se ha perdido
    if (card?.recurrence && local.done)
      res.then((fresh) => {
        const sp = fresh?.spawned
        if (!sp) return
        // La nueva llega en la propia respuesta: no depende del tiempo real
        if (sp.card) set((st) => (st.cards[sp.card.id] ? {} : { cards: { ...st.cards, [sp.card.id]: sp.card } }))
        const when = sp.at ? format(new Date(sp.at), "EEE d 'de' MMM", { locale: es }) : null
        toast.success(when ? `Se repite: nueva para el ${when}` : 'Se repite: creada la siguiente', {
          action: { label: 'Abrir', onClick: () => window.dispatchEvent(new CustomEvent('mentodo:open-card', { detail: sp.id })) },
        })
      })
    return res
  },
  deleteCard(id) {
    deferDelete(set, getState, { kind: 'card', id, path: `/cards/${id}`, message: `«${getState().cards[id]?.title || 'Sin título'}» eliminada` })
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
  deleteRule(id) {
    deferDelete(set, getState, { kind: 'rule', id, path: `/rules/${id}`, message: 'Aviso eliminado' })
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
    set({ status: 'anon', user: null, projects: {}, cards: {}, groups: {}, labels: {}, views: {}, fields: {}, notes: {}, templates: {}, links: {}, attachments: {}, rules: {}, notifications: [] })
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

// ── Deshacer ─────────────────────────────────────────────────────────────────
// Las acciones delicadas muestran un aviso con «Deshacer». Los borrados se
// aplazan: se quitan al momento de la pantalla, pero el servidor no los
// recibe hasta que pasa el plazo; si se cierra la página antes, se envían
// igualmente (keepalive).
export const UNDO_MS = 8000
const SLICES = ['projects', 'groups', 'labels', 'views', 'fields', 'notes', 'templates', 'links', 'attachments', 'cards', 'rules']
const pendingDeletes = new Map() // clave → ruta de la API

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    for (const path of pendingDeletes.values()) {
      fetch(`/api${path}`, { method: 'DELETE', keepalive: true, credentials: 'include', headers: { 'x-client-id': CLIENT_ID } }).catch(() => {})
    }
    pendingDeletes.clear()
  })
}

/* Aviso con «Deshacer» para un cambio ya hecho (undo lo revierte) */
export function undoToast(message, undo) {
  toast(message, { duration: UNDO_MS, action: { label: 'Deshacer', onClick: undo } })
}

/* Devuelve lo que quitó un borrado sin pisar lo que haya cambiado mientras */
function restoreSnapshot(set, snap) {
  set((s) => {
    const next = {}
    for (const k of SLICES) {
      const cur = s[k]
      const back = { ...cur }
      for (const [id, v] of Object.entries(snap[k])) if (!(id in cur)) back[id] = v
      next[k] = back
    }
    // Etiquetas quitadas de las tarjetas al borrar su grupo o la etiqueta
    const lostLabels = new Set(Object.keys(snap.labels).filter((id) => !(id in s.labels)).map(Number))
    if (lostLabels.size) {
      next.cards = Object.fromEntries(
        Object.entries(next.cards).map(([id, c]) => {
          const old = snap.cards[id]
          const add = old ? old.label_ids.filter((l) => lostLabels.has(l) && !c.label_ids.includes(l)) : []
          return [id, add.length ? { ...c, label_ids: [...c.label_ids, ...add] } : c]
        }),
      )
    }
    return next
  })
}

function deferDelete(set, getState, { kind, id, path, message }) {
  const state = getState()
  const snap = Object.fromEntries(SLICES.map((k) => [k, state[k]]))
  set((s) => {
    const next = { ...s }
    removeLocal(next, kind, id)
    return next
  })
  const key = `${kind}:${id}`
  pendingDeletes.set(key, path)
  const timer = setTimeout(async () => {
    if (!pendingDeletes.has(key)) return
    pendingDeletes.delete(key)
    try {
      await del(path)
    } catch (e) {
      fail(e)
      getState().bootstrap()
    }
  }, UNDO_MS)
  undoToast(message, () => {
    pendingDeletes.delete(key)
    clearTimeout(timer)
    restoreSnapshot(set, snap)
  })
}

function removeLocal(next, kind, id) {
  if (kind === 'project') {
    next.projects = without(next.projects, id)
    const gids = Object.values(next.groups).filter((g) => g.project_id === id).map((g) => g.id)
    next.groups = Object.fromEntries(Object.entries(next.groups).filter(([, g]) => g.project_id !== id))
    next.labels = Object.fromEntries(Object.entries(next.labels).filter(([, l]) => !gids.includes(l.group_id)))
    next.views = Object.fromEntries(Object.entries(next.views).filter(([, v]) => v.project_id !== id))
    next.fields = Object.fromEntries(Object.entries(next.fields).filter(([, f]) => f.project_id !== id))
    next.notes = Object.fromEntries(Object.entries(next.notes).filter(([, n]) => n.project_id !== id))
    next.templates = Object.fromEntries(Object.entries(next.templates).filter(([, t]) => t.project_id !== id))
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
  } else if (kind === 'card') {
    next.cards = without(next.cards, id)
    next.templates = without(next.templates, id)
    // El servidor borra sus relaciones en cascada (sin avisar de cada una)
    next.links = Object.fromEntries(Object.entries(next.links).filter(([, l]) => l.from_id !== id && l.to_id !== id))
    next.attachments = Object.fromEntries(Object.entries(next.attachments).filter(([, a]) => a.card_id !== id))
  } else if (KIND_KEY[kind]) {
    next[KIND_KEY[kind]] = without(next[KIND_KEY[kind]], id)
  }
}
