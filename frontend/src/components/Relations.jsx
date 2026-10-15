import { useMemo, useState } from 'react'
import { ArrowUpRight, GitMerge, Link2, ListTree, Lock, Plus, Search, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { useCardNav } from '../lib/nav'
import { linksOf } from '../lib/links'
import { groupLabels, projectGroups } from '../lib/cards'
import { Checkbox, cx, IconButton, Popover, usePopover } from './ui'

const KINDS = [
  { id: 'child', name: 'Subtarea', hint: 'La otra tarjeta pasa a ser parte de esta' },
  { id: 'parent', name: 'Es parte de', hint: 'Esta tarjeta es una subtarea de la otra' },
  { id: 'blockedBy', name: 'Bloqueada por', hint: 'Hay que terminar la otra antes' },
  { id: 'blocks', name: 'Bloquea a', hint: 'La otra espera a que termines esta' },
  { id: 'relates', name: 'Relacionada', hint: 'Solo un enlace, sin orden' },
]

/* Relaciones de una tarjeta: subtareas, «parte de», bloqueos y relacionadas */
export function Relations({ card }) {
  const s = useStore()
  const { open } = useCardNav()
  const r = useMemo(() => linksOf(s, card.id), [s.links, s.cards, s.hidden, card.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const pop = usePopover()

  const doneCount = r.children.filter((x) => x.card.done).length
  const anything = r.parent || r.children.length || r.blockedBy.length || r.blocks.length || r.related.length

  // Subtarea nueva: mismo proyecto, en el estado inicial del tablero
  const addSubtask = async (e) => {
    e.preventDefault()
    const title = draft.trim()
    if (!title) return
    setDraft('')
    let label_ids = []
    if (card.project_id) {
      const status = projectGroups(s, card.project_id).find((g) => g.is_status)
      const first = status && groupLabels(s, status.id).find((l) => !l.marks_done)
      if (first) label_ids = [first.id]
    }
    const c = await s.createCard({ project_id: card.project_id, title, label_ids })
    if (c) await s.createLink({ from_id: card.id, to_id: c.id, kind: 'parent' })
  }

  // Funciones de pintado, no componentes: definidos aquí dentro, cada tecla
  // en «Nueva subtarea» los recrearía y el campo perdería el foco
  const row = (c, link, check) => (
    <div key={link?.id ?? c.id} className="group flex min-h-9 items-center gap-2.5 rounded-lg px-2 py-1 transition-colors hover:bg-hover">
      {check ? (
        <Checkbox checked={c.done} onChange={(done) => s.updateCard(c.id, { done })} size={16} />
      ) : (
        <span className={cx('size-1.5 shrink-0 rounded-full', c.done ? 'bg-faint' : 'bg-accent')} />
      )}
      <button onClick={() => open(c)} className={cx('min-w-0 flex-1 truncate text-left text-[14px]', c.done && 'text-faint line-through')}>
        {c.title || 'Sin título'}
      </button>
      {c.project_id !== card.project_id && (
        <span className="hidden max-w-32 truncate text-[12px] text-faint sm:inline">{c.project_id ? s.projects[c.project_id]?.name : 'Bandeja'}</span>
      )}
      {link && (
        <IconButton size="sm" label="Quitar relación" onClick={() => s.deleteLink(link.id)} className="opacity-0 group-hover:opacity-100 max-sm:opacity-100">
          <X size={14} />
        </IconButton>
      )}
    </div>
  )

  const section = (Icon, title, children, tone) => (
    <div className="mt-3">
      <div className={cx('mb-0.5 flex items-center gap-1.5 px-2 text-[12.5px] font-medium', tone || 'text-muted')}>
        <Icon size={13} /> {title}
      </div>
      {children}
    </div>
  )

  return (
    <div className="mt-5">
      {r.parent && (
        <button onClick={() => open(r.parent)} className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13.5px] text-muted hover:bg-hover">
          <ArrowUpRight size={14} className="text-faint" />
          Parte de <b className="truncate font-medium text-ink">{r.parent.title || 'Sin título'}</b>
        </button>
      )}
      {r.blockedBy.length > 0 && (
        section(Lock, 'Bloqueada por', r.blockedBy.map((x) => row(x.card, x.link)), r.blockedBy.some((x) => !x.card.done) ? 'text-danger' : 'text-muted')
      )}
      {(r.children.length > 0 || adding) && (
        section(
          ListTree,
          `Subtareas${r.children.length ? ` · ${doneCount}/${r.children.length}` : ''}`,
          <>
          {r.children.length > 0 && (
            <div className="mx-2 mb-1 h-1 overflow-hidden rounded-full bg-sunken">
              <div className="h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${doneCount / r.children.length})`, transition: 'transform .5s cubic-bezier(.32,.72,0,1)' }} />
            </div>
          )}
          {r.children.map((x) => row(x.card, x.link, true))}
          {adding && (
            <form onSubmit={addSubtask} className="flex items-center gap-2.5 px-2 py-1">
              <Plus size={16} className="text-faint" />
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => !draft && setAdding(false)}
                onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
                placeholder="Nueva subtarea…"
                className="h-8 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint sm:text-[14px]"
              />
            </form>
          )}
          </>,
        )
      )}
      {r.blocks.length > 0 && (
        section(GitMerge, 'Bloquea a', r.blocks.map((x) => row(x.card, x.link)))
      )}
      {r.related.length > 0 && (
        section(Link2, 'Relacionadas', r.related.map((x) => row(x.card, x.link)))
      )}

      <div className={cx('flex flex-wrap gap-1', anything && 'mt-2')}>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13.5px] text-faint transition-colors hover:bg-hover hover:text-muted">
            <ListTree size={14} /> Añadir subtarea
          </button>
        )}
        <button onClick={pop.toggle} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13.5px] text-faint transition-colors hover:bg-hover hover:text-muted">
          <Link2 size={14} /> Relacionar con otra tarjeta
        </button>
      </div>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={340}>
        <LinkPicker card={card} onDone={pop.close} />
      </Popover>
    </div>
  )
}

function LinkPicker({ card, onDone }) {
  const s = useStore()
  const [kind, setKind] = useState('relates')
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    return Object.values(s.cards)
      .filter((c) => c.id !== card.id && !s.hidden[c.id] && (!term || c.title.toLowerCase().includes(term)))
      .sort((a, b) => Number(a.done) - Number(b.done) || Number(b.project_id === card.project_id) - Number(a.project_id === card.project_id) || (b.updated_at || '').localeCompare(a.updated_at || ''))
      .slice(0, 30)
  }, [s.cards, s.hidden, q, card.id, card.project_id])

  const pick = async (other) => {
    const body =
      kind === 'child' ? { from_id: card.id, to_id: other.id, kind: 'parent' }
      : kind === 'parent' ? { from_id: other.id, to_id: card.id, kind: 'parent' }
      : kind === 'blockedBy' ? { from_id: other.id, to_id: card.id, kind: 'blocks' }
      : kind === 'blocks' ? { from_id: card.id, to_id: other.id, kind: 'blocks' }
      : { from_id: card.id, to_id: other.id, kind: 'relates' }
    const l = await s.createLink(body)
    if (l) onDone()
  }

  return (
    <div className="p-1">
      <div className="mb-2 flex flex-wrap gap-1">
        {KINDS.map((k) => (
          <button
            key={k.id}
            title={k.hint}
            onClick={() => setKind(k.id)}
            className={cx('h-8 rounded-lg px-2.5 text-[13px] transition-colors', kind === k.id ? 'bg-accent-soft font-medium text-accent' : 'text-muted hover:bg-hover')}
          >
            {k.name}
          </button>
        ))}
      </div>
      <p className="px-1 pb-2 text-[12px] text-faint">{KINDS.find((k) => k.id === kind).hint}</p>
      <div className="mb-1 flex h-9 items-center gap-2 rounded-lg bg-sunken px-2.5">
        <Search size={14} className="text-faint" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tarjeta…" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint sm:text-[14px]" />
      </div>
      <div className="max-h-64 overflow-y-auto">
        {results.map((c) => (
          <button key={c.id} onClick={() => pick(c)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-hover">
            <span className={cx('min-w-0 flex-1 truncate text-[14px]', c.done && 'text-faint line-through')}>{c.title || 'Sin título'}</span>
            <span className="max-w-28 shrink-0 truncate text-[12px] text-faint">{c.project_id ? `${s.projects[c.project_id]?.icon} ${s.projects[c.project_id]?.name}` : 'Bandeja'}</span>
          </button>
        ))}
        {results.length === 0 && <p className="px-2.5 py-3 text-[13px] text-faint">Nada coincide.</p>}
      </div>
    </div>
  )
}
