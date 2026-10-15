import { lazy, Suspense, useMemo, useRef, useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, FileText, Folder, ListRestart, MoreHorizontal, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { ProjectPicker } from './Pickers'
import { Button, cx, Empty, IconButton, MenuItem, Popover, useIsMobile, usePopover } from './ui'

const Editor = lazy(() => import('./Editor').then((m) => ({ default: m.Editor })))

export const NOTE_ICONS = ['📝', '📌', '🔑', '🚀', '🛠️', '📋', '🐞', '📚', '💡', '🗂️', '⚙️', '🧾', '🔗', '🗓️', '📦', '🧪']

export function noteText(n) {
  const out = []
  const walk = (x) => {
    if (x.text) out.push(x.text)
    if (x.type === 'secret' && x.attrs?.label) out.push(x.attrs.label)
    x.content?.forEach(walk)
  }
  if (n.content) walk(n.content)
  return out.join(' ')
}

export function notePath(n) {
  return n.project_id ? `/p/${n.project_id}?v=notes&nota=${n.id}` : `/apuntes?nota=${n.id}`
}

function hasChecked(content) {
  let found = false
  const walk = (x) => {
    if (x.type === 'taskItem' && x.attrs?.checked) found = true
    x.content?.forEach(walk)
  }
  if (content) walk(content)
  return found
}

function uncheckAll(content) {
  const walk = (x) => ({
    ...x,
    ...(x.type === 'taskItem' ? { attrs: { ...x.attrs, checked: false } } : {}),
    ...(x.content ? { content: x.content.map(walk) } : {}),
  })
  return walk(content)
}

/* Apuntes: lista + apunte abierto. scope = null (generales y de todos los
   proyectos, con filtro) o el id de un proyecto (solo los suyos). */
export function NotesBoard({ projectId = null }) {
  const notesMap = useStore((s) => s.notes)
  const projects = useStore((s) => s.projects)
  const createNote = useStore((s) => s.createNote)
  const [params, setParams] = useSearchParams()
  const mobile = useIsMobile(768)
  const nav = useNavigate()
  const loc = useLocation()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all') // all | general | <projectId>
  const openId = Number(params.get('nota')) || null

  const notes = useMemo(() => {
    let list = Object.values(notesMap)
    if (projectId) list = list.filter((n) => n.project_id === projectId)
    else if (filter === 'general') list = list.filter((n) => n.project_id === null)
    else if (filter !== 'all') list = list.filter((n) => n.project_id === Number(filter))
    const term = q.trim().toLowerCase()
    if (term) list = list.filter((n) => n.title.toLowerCase().includes(term) || noteText(n).toLowerCase().includes(term))
    return list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updated_at || '').localeCompare(a.updated_at || ''))
  }, [notesMap, projectId, filter, q])

  const open = (n) => {
    const p = new URLSearchParams(params)
    p.set('nota', n.id)
    // En el móvil abrir es "entrar" (el gesto de volver regresa a la lista);
    // en escritorio solo cambia el panel de la derecha
    nav({ pathname: loc.pathname, search: `?${p}` }, { replace: !mobile && !!openId })
  }
  const create = async () => {
    const n = await createNote({ title: '', project_id: projectId ?? (filter !== 'all' && filter !== 'general' ? Number(filter) : null) })
    if (n) open(n)
  }

  const current = openId ? notesMap[openId] : null
  const projectsWithNotes = useMemo(() => {
    const ids = new Set(Object.values(notesMap).map((n) => n.project_id).filter(Boolean))
    return Object.values(projects).filter((p) => ids.has(p.id))
  }, [notesMap, projects])

  const list = (
    <div className={cx('flex min-w-0 flex-col', !mobile && 'w-[300px] shrink-0 border-r border-line pr-3')}>
      <div className="flex items-center gap-2">
        <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 shadow-soft sm:h-9">
          <Search size={15} className="text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en apuntes…" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint sm:text-[14px]" />
        </div>
        <Button variant="primary" aria-label="Nuevo apunte" title="Nuevo apunte" onClick={create} className="w-10 shrink-0 px-0 sm:w-9">
          <Plus size={18} />
        </Button>
      </div>
      {!projectId && projectsWithNotes.length > 0 && (
        <div className="-mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {[
            { id: 'all', name: 'Todos' },
            { id: 'general', name: 'Generales' },
            ...projectsWithNotes.map((p) => ({ id: String(p.id), name: `${p.icon} ${p.name}` })),
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cx('h-8 shrink-0 whitespace-nowrap rounded-lg px-2.5 text-[13px] transition-colors', filter === f.id ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-hover')}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-col">
        {notes.map((n) => (
          <button
            key={n.id}
            onClick={() => open(n)}
            className={cx('flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors active:bg-hover', current?.id === n.id && !mobile ? 'bg-hover' : 'hover:bg-hover')}
          >
            <span className="mt-0.5 text-[18px] leading-none">{n.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className={cx('truncate text-[15px] font-medium sm:text-[14px]', !n.title && 'text-faint')}>{n.title || 'Sin título'}</span>
                {n.pinned && <Pin size={12} className="shrink-0 text-accent" />}
              </span>
              <span className="mt-0.5 block truncate text-[12.5px] text-faint">
                {!projectId && n.project_id ? `${projects[n.project_id]?.icon} ${projects[n.project_id]?.name} · ` : ''}
                {noteText(n).slice(0, 80) || 'Vacío'}
              </span>
            </span>
          </button>
        ))}
        {notes.length === 0 && (
          <Empty icon={FileText} title={q ? 'Nada coincide' : 'Sin apuntes todavía'}>
            {q ? 'Prueba con otras palabras.' : 'Instrucciones, referencias, cuentas… lo que no es una tarea.'}
          </Empty>
        )}
      </div>
    </div>
  )

  if (mobile) {
    return current ? (
      <div key={current.id} className="entra">
        <button onClick={() => nav(-1)} className="mb-3 inline-flex h-9 items-center gap-1.5 rounded-lg pr-2 text-[14px] text-muted">
          <ArrowLeft size={16} /> Apuntes
        </button>
        <NoteEditor note={current} />
      </div>
    ) : (
      list
    )
  }

  return (
    <div className="flex min-h-[60vh] gap-6">
      {list}
      <div className="min-w-0 flex-1">
        {current ? (
          <div key={current.id} className="entra mx-auto max-w-3xl" style={{ '--entra-desde': 'translateY(4px)', '--entra-dura': '200ms' }}>
            <NoteEditor note={current} />
          </div>
        ) : (
          <Empty icon={FileText} title="Elige un apunte">
            O crea uno nuevo con el +.
          </Empty>
        )}
      </div>
    </div>
  )
}

function NoteEditor({ note }) {
  const s = useStore()
  const [title, setTitle] = useState(note.title)
  const titleRef = useRef(null)
  const icon = usePopover()
  const more = usePopover()
  const move = usePopover()
  const [params, setParams] = useSearchParams()
  const project = note.project_id ? s.projects[note.project_id] : null

  useEffect(() => {
    if (document.activeElement !== titleRef.current) setTitle(note.title)
  }, [note.title])
  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [title])
  useEffect(() => {
    if (!note.title) setTimeout(() => titleRef.current?.focus(), 200)
  }, [note.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const [resetKey, setResetKey] = useState(0)
  const restart = () => {
    s.updateNote(note.id, { content: uncheckAll(note.content) })
    setResetKey((k) => k + 1)
  }

  return (
    <article>
      <div className="flex items-start gap-2">
        <button onClick={icon.toggle} className="grid size-11 shrink-0 place-items-center rounded-xl text-[26px] transition-colors hover:bg-hover">
          {note.icon}
        </button>
        <textarea
          ref={titleRef}
          rows={1}
          value={title}
          placeholder="Sin título"
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
          onBlur={() => title !== note.title && s.updateNote(note.id, { title })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
          className="mt-1 min-w-0 flex-1 resize-none overflow-hidden bg-transparent text-[24px] font-semibold leading-tight tracking-[-0.022em] outline-none placeholder:text-faint sm:text-[28px]"
        />
        <IconButton label={note.pinned ? 'Desfijar' : 'Fijar arriba'} onClick={() => s.updateNote(note.id, { pinned: !note.pinned })} className={cx(note.pinned && 'text-accent')}>
          {note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
        </IconButton>
        <IconButton label="Más" onClick={more.toggle}>
          <MoreHorizontal size={17} />
        </IconButton>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-[52px] text-[12.5px] text-faint">
        <button onClick={move.toggle} className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 hover:bg-hover hover:text-muted">
          <Folder size={13} />
          {project ? `${project.icon} ${project.name}` : 'General'}
        </button>
        <span>· editado hace {formatDistanceToNowStrict(new Date(note.updated_at), { locale: es })}</span>
        {hasChecked(note.content) && (
          <Button size="sm" variant="soft" onClick={restart} className="ml-auto">
            <ListRestart size={14} /> Empezar de nuevo
          </Button>
        )}
      </div>
      <div className="mt-5 border-t border-line pt-5">
        <Suspense fallback={<div className="min-h-[200px]" />}>
          <Editor
            key={`${note.id}:${resetKey}`}
            cardId={`note-${note.id}:${resetKey}`}
            content={note.content}
            placeholder="Escribe aquí. Con «/» añades títulos, pasos con casillas, código, secretos…"
            onSave={(content) => s.updateNote(note.id, { content })}
          />
        </Suspense>
      </div>

      <Popover open={icon.open} anchor={icon.anchor} onClose={icon.close} width={260}>
        <div className="grid grid-cols-8 gap-1 p-1">
          {NOTE_ICONS.map((i) => (
            <button key={i} onClick={() => (s.updateNote(note.id, { icon: i }), icon.close())} className={cx('grid aspect-square place-items-center rounded-lg text-[20px] hover:bg-hover', note.icon === i && 'bg-accent-soft')}>
              {i}
            </button>
          ))}
        </div>
      </Popover>
      <Popover open={move.open} anchor={move.anchor} onClose={move.close} width={240}>
        <ProjectPicker
          value={note.project_id}
          generalLabel="📝 General"
          onChange={(project_id) => {
            move.close()
            s.updateNote(note.id, { project_id })
          }}
        />
      </Popover>
      <Popover open={more.open} anchor={more.anchor} onClose={more.close} align="end" width={220}>
        <MenuItem
          icon={Trash2}
          danger
          onClick={() => {
            more.close()
            if (!confirm(`¿Borrar «${note.title || 'Sin título'}»?`)) return
            const p = new URLSearchParams(params)
            p.delete('nota')
            setParams(p, { replace: true })
            s.deleteNote(note.id)
          }}
        >
          Borrar apunte
        </MenuItem>
      </Popover>
    </article>
  )
}
