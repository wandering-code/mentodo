import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { Command } from 'cmdk'
import { toast } from 'sonner'
import { BookOpen, CircleCheckBig, Clock, CornerDownLeft, FileText, Inbox, LayoutTemplate, NotebookText, Plus, Settings, Sun, Zap, CalendarRange } from 'lucide-react'
import { useStore } from '../lib/store'
import { hoursOn } from '../lib/hours'
import { Scrim } from './ui'
import { ARRIVE, css, LEAVE, useBackToClose, usePresence } from '../lib/layers'
import { cardPath } from '../lib/nav'
import { notePath, noteText } from './Notes'
import { useFromTemplate } from './Templates'

/* ⌘K: buscar cualquier cosa y, si no existe, capturarla a la bandeja con
   Enter. Capturar no debería pedir decidir antes dónde va. */
export function CommandPalette({ open, onClose, onNewProject }) {
  const [q, setQ] = useState('')
  const cards = useStore((s) => s.cards)
  const notes = useStore((s) => s.notes)
  const templates = useStore((s) => s.templates)
  const hours = useStore((s) => hoursOn(s.user))
  const fromTemplate = useFromTemplate()
  const here = Number(location.pathname.match(/^\/p\/(\d+)/)?.[1]) || null
  const projects = useStore((s) => s.projects)
  const createCard = useStore((s) => s.createCard)
  const nav = useNavigate()

  useEffect(() => {
    if (open) setQ('')
  }, [open])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return { cards: [], projects: [], notes: [], templates: [] }
    return {
      templates: Object.values(templates).filter((t) => (t.template?.name || '').toLowerCase().includes(term)).slice(0, 4),
      notes: Object.values(notes)
        .filter((n) => n.title.toLowerCase().includes(term) || noteText(n).toLowerCase().includes(term))
        .sort((a, b) => Number(b.title.toLowerCase().includes(term)) - Number(a.title.toLowerCase().includes(term)))
        .slice(0, 6),
      projects: Object.values(projects).filter((p) => p.name.toLowerCase().includes(term)).slice(0, 5),
      cards: Object.values(cards)
        .filter((c) => c.title.toLowerCase().includes(term))
        .sort((a, b) => Number(a.done) - Number(b.done) || (b.updated_at > a.updated_at ? 1 : -1))
        .slice(0, 12),
    }
  }, [q, cards, projects, notes, templates])

  const go = (path) => {
    nav(path)
    onClose()
  }

  const capture = async () => {
    const title = q.trim()
    if (!title) return
    onClose()
    await createCard({ title, project_id: null })
    toast.success('Guardado en la bandeja', { action: { label: 'Ver', onClick: () => nav('/inbox') } })
  }

  const item = 'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-ink data-[selected=true]:bg-hover'

  const { mounted, shown } = usePresence(open)
  useBackToClose(open, onClose)
  if (!mounted) return null
  return createPortal(
    <>
      <Scrim shown={shown} onClick={onClose} z="z-[80]" />
      <div className="pointer-events-none fixed inset-0 z-[80] flex items-start justify-center px-3 pt-[calc(env(safe-area-inset-top)+12px)] sm:pt-[12vh]">
        <div
          className="pointer-events-auto relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-float"
          style={{ opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(-8px) scale(0.98)', transition: css(shown ? ARRIVE : LEAVE) }}
        >
            <Command shouldFilter={false} loop>
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Zap size={17} className="text-accent" />
                <Command.Input
                  autoFocus
                  value={q}
                  onValueChange={setQ}
                  placeholder="Busca, o escribe algo para capturarlo…"
                  className="h-14 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
                />
              </div>
              <Command.List className="max-h-[min(52vh,calc(100dvh-180px))] overflow-y-auto p-2">
                {q.trim() && (
                  <Command.Item value="__capture" onSelect={capture} className={item}>
                    <Plus size={16} className="text-accent" />
                    <span className="flex-1 truncate">
                      Capturar «<span className="font-medium">{q.trim()}</span>» en la bandeja
                    </span>
                    <CornerDownLeft size={14} className="text-faint" />
                  </Command.Item>
                )}
                {results.projects.length > 0 && (
                  <Command.Group heading="Proyectos" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-faint">
                    {results.projects.map((p) => (
                      <Command.Item key={p.id} value={`p${p.id}`} onSelect={() => go(`/p/${p.id}`)} className={item}>
                        <span className="w-4 text-center">{p.icon}</span>
                        {p.name}
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {results.templates.length > 0 && (
                  <Command.Group heading="Nueva tarjeta desde plantilla" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-faint">
                    {results.templates.map((t) => (
                      <Command.Item
                        key={t.id}
                        value={`t${t.id}`}
                        onSelect={() => {
                          onClose()
                          // Las de proyecto, en su proyecto; las generales, en el
                          // proyecto que se esté viendo (o en la bandeja)
                          fromTemplate(t, { projectId: t.project_id ?? here })
                        }}
                        className={item}
                      >
                        <LayoutTemplate size={16} className="text-accent" />
                        <span className="flex-1 truncate">{t.template?.name || 'Sin nombre'}</span>
                        <span className="truncate text-[12.5px] text-faint">{t.project_id ? `${projects[t.project_id]?.icon} ${projects[t.project_id]?.name}` : 'General'}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {results.notes.length > 0 && (
                  <Command.Group heading="Apuntes" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-faint">
                    {results.notes.map((n) => (
                      <Command.Item key={n.id} value={`n${n.id}`} onSelect={() => go(notePath(n))} className={item}>
                        <span className="w-4 text-center">{n.icon}</span>
                        <span className="flex-1 truncate">{n.title || 'Sin título'}</span>
                        <span className="truncate text-[12.5px] text-faint">{n.project_id ? `${projects[n.project_id]?.icon} ${projects[n.project_id]?.name}` : 'General'}</span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {results.cards.length > 0 && (
                  <Command.Group heading="Tarjetas" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-faint">
                    {results.cards.map((c) => (
                      <Command.Item key={c.id} value={`c${c.id}`} onSelect={() => go(cardPath(c))} className={item}>
                        <FileText size={16} className="text-muted" />
                        <span className={`flex-1 truncate ${c.done ? 'text-faint line-through' : ''}`}>{c.title || 'Sin título'}</span>
                        <span className="truncate text-[12.5px] text-faint">
                          {c.project_id ? `${projects[c.project_id]?.icon} ${projects[c.project_id]?.name}` : 'Bandeja'}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
                {!q.trim() && (
                  <>
                    <Command.Item value="hoy" onSelect={() => go('/hoy')} className={item}>
                      <Sun size={16} className="text-muted" /> Ir a Hoy
                    </Command.Item>
                    <Command.Item value="semana" onSelect={() => go('/semana')} className={item}>
                      <CalendarRange size={16} className="text-muted" /> Revisión semanal
                    </Command.Item>
                    {hours && (
                      <Command.Item value="horas" onSelect={() => go('/horas')} className={item}>
                        <Clock size={16} className="text-muted" /> Ir a Horas
                      </Command.Item>
                    )}
                    <Command.Item value="todo" onSelect={() => go('/')} className={item}>
                      <CircleCheckBig size={16} className="text-muted" /> Ir a To Do
                    </Command.Item>
                    <Command.Item value="inbox" onSelect={() => go('/inbox')} className={item}>
                      <Inbox size={16} className="text-muted" /> Ir a la bandeja
                    </Command.Item>
                    <Command.Item value="notes" onSelect={() => go('/apuntes')} className={item}>
                      <NotebookText size={16} className="text-muted" /> Ir a apuntes
                    </Command.Item>
                    <Command.Item value="newproject" onSelect={() => (onClose(), onNewProject())} className={item}>
                      <Plus size={16} className="text-muted" /> Nuevo proyecto
                    </Command.Item>
                    <Command.Item value="guia" onSelect={() => go('/guia')} className={item}>
                      <BookOpen size={16} className="text-muted" /> Guía de Mentodo
                    </Command.Item>
                    <Command.Item value="settings" onSelect={() => go('/ajustes')} className={item}>
                      <Settings size={16} className="text-muted" /> Ajustes
                    </Command.Item>
                  </>
                )}
              </Command.List>
            </Command>
        </div>
      </div>
    </>,
    document.body,
  )
}
