import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { Command } from 'cmdk'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'motion/react'
import { CircleCheckBig, CornerDownLeft, FileText, Inbox, Plus, Settings, Zap } from 'lucide-react'
import { useStore } from '../lib/store'
import { spring } from './ui'

/* ⌘K: buscar cualquier cosa y, si no existe, capturarla a la bandeja con
   Enter. Capturar no debería pedir decidir antes dónde va. */
export function CommandPalette({ open, onClose, onNewProject }) {
  const [q, setQ] = useState('')
  const cards = useStore((s) => s.cards)
  const projects = useStore((s) => s.projects)
  const createCard = useStore((s) => s.createCard)
  const nav = useNavigate()

  useEffect(() => {
    if (open) setQ('')
  }, [open])

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return { cards: [], projects: [] }
    return {
      projects: Object.values(projects).filter((p) => p.name.toLowerCase().includes(term)).slice(0, 5),
      cards: Object.values(cards)
        .filter((c) => c.title.toLowerCase().includes(term))
        .sort((a, b) => Number(a.done) - Number(b.done) || (b.updated_at > a.updated_at ? 1 : -1))
        .slice(0, 12),
    }
  }, [q, cards, projects])

  const go = (path) => {
    onClose()
    nav(path)
  }
  const cardPath = (c) => (c.project_id ? `/p/${c.project_id}?card=${c.id}` : `/inbox?card=${c.id}`)

  const capture = async () => {
    const title = q.trim()
    if (!title) return
    onClose()
    await createCard({ title, project_id: null })
    toast.success('Guardado en la bandeja', { action: { label: 'Ver', onClick: () => nav('/inbox') } })
  }

  const item = 'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-ink data-[selected=true]:bg-hover'

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-start justify-center p-3 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -4 }}
            transition={spring}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-float"
          >
            <Command shouldFilter={false} loop onKeyDown={(e) => e.key === 'Escape' && onClose()}>
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Zap size={17} className="text-accent" />
                <Command.Input
                  autoFocus
                  value={q}
                  onValueChange={setQ}
                  placeholder="Busca, o escribe algo para capturarlo…"
                  className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
                />
              </div>
              <Command.List className="max-h-[52vh] overflow-y-auto p-2">
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
                    <Command.Item value="todo" onSelect={() => go('/')} className={item}>
                      <CircleCheckBig size={16} className="text-muted" /> Ir a To Do
                    </Command.Item>
                    <Command.Item value="inbox" onSelect={() => go('/inbox')} className={item}>
                      <Inbox size={16} className="text-muted" /> Ir a la bandeja
                    </Command.Item>
                    <Command.Item value="newproject" onSelect={() => (onClose(), onNewProject())} className={item}>
                      <Plus size={16} className="text-muted" /> Nuevo proyecto
                    </Command.Item>
                    <Command.Item value="settings" onSelect={() => go('/ajustes')} className={item}>
                      <Settings size={16} className="text-muted" /> Ajustes
                    </Command.Item>
                  </>
                )}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
