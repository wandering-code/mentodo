import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDown, ArrowUp, Calendar, ChartNoAxesColumn, Columns3, NotebookText, Eye, EyeOff, Filter, Layers, List, Plus, Search, Settings2, SortAsc, Table2, Trash2, X,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { useCardNav } from '../lib/nav'
import { fieldIcon, projectProps } from '../lib/props'
import { applyFilter, groupLabels, projectGroups, projectViews, SORT_FIELDS, visibleCards } from '../lib/cards'
import { BoardView } from '../views/BoardView'
import { TableView } from '../views/TableView'
import { ListView } from '../views/ListView'
import { CalendarView } from '../views/CalendarView'
import { ReportView } from '../views/ReportView'
import { NotesBoard } from '../components/Notes'
import { Button, cx, Divider, IconButton, LabelChip, MenuItem, MenuLabel, Popover, spring, Toggle, usePopover } from '../components/ui'

export const VIEW_KINDS = [
  { id: 'board', name: 'Tablero', icon: Columns3 },
  { id: 'table', name: 'Tabla', icon: Table2 },
  { id: 'list', name: 'Lista', icon: List },
  { id: 'calendar', name: 'Calendario', icon: Calendar },
  { id: 'report', name: 'Informe de jornadas', icon: ChartNoAxesColumn },
]
const kindIcon = (k) => VIEW_KINDS.find((v) => v.id === k)?.icon || List

export function ProjectPage() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const s = useStore()
  const project = s.projects[id]
  const views = useMemo(() => projectViews(s, id), [s.views, id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const storedView = (() => {
    try {
      return localStorage.getItem(`mentodo:view:${id}`)
    } catch {
      return null
    }
  })()
  const rawView = params.get('v') || storedView
  // «Apuntes» es una pestaña fija del proyecto, no una vista guardada
  const notesTab = rawView === 'notes'
  const view = notesTab ? null : views.find((v) => v.id === Number(rawView)) || views[0]
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const notesCount = useMemo(() => Object.values(s.notes).filter((n) => n.project_id === id).length, [s.notes, id])

  useEffect(() => {
    try {
      localStorage.setItem(`mentodo:view:${id}`, notesTab ? 'notes' : String(view?.id ?? ''))
    } catch {}
  }, [view, id, notesTab])

  useEffect(() => {
    setSearch('')
    setSearching(false)
  }, [id])

  const cards = useMemo(() => {
    if (!view) return []
    const filter = { ...(view.config.filter || {}), hide_done: view.config.hide_done, text: search }
    return applyFilter(visibleCards(s, id), filter, s)
  }, [s.cards, s.hidden, s.labels, view, id, search]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return s.status === 'ready' ? <Navigate to="/" replace /> : null

  const selectView = (v) => {
    const p = new URLSearchParams(params)
    p.delete('nota')
    p.set('v', v.id)
    setParams(p, { replace: true })
  }
  const { open: openCard } = useCardNav()

  const total = visibleCards(s, id)
  const done = total.filter((c) => c.done).length

  return (
    <div className="min-h-full">
      <ProjectHeader project={project} done={done} total={total.length} onSettings={() => nav(`/p/${id}/ajustes`)} />

      <div className="sticky top-0 z-10 bg-[color-mix(in_oklab,var(--bg)_90%,transparent)] backdrop-blur-md">
        <div className="flex items-center gap-1 border-b border-line px-4 sm:px-8">
          {/* La fila baja 1px sobre la línea divisoria (-mb-px) para que el
              subrayado de la pestaña activa la tape; el subrayado va DENTRO
              de la fila (bottom-0) y el scroll vertical queda prohibido: si
              no, ese píxel daba un mini scroll vertical */}
          <div className="-mb-px flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {views.map((v) => (
              <ViewTab key={v.id} view={v} active={v.id === view?.id} onSelect={() => selectView(v)} canDelete={views.length > 1} />
            ))}
            <NotesTab active={notesTab} count={notesCount} onSelect={() => selectView({ id: 'notes' })} />
            <NewViewButton project={project} onCreated={selectView} />
          </div>
          {searching && (
              <input
                style={{ '--entra-desde': 'translateX(8px)', '--entra-dura': '200ms' }}
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onBlur={() => !search && setSearching(false)}
                onKeyDown={(e) => e.key === 'Escape' && (setSearch(''), setSearching(false))}
                placeholder="Filtrar por título…"
                className="entra h-9 w-36 shrink-0 rounded-lg bg-sunken px-2.5 text-[16px] outline-none placeholder:text-faint sm:h-8 sm:w-44 sm:text-[13.5px]"
              />
            )}
          {!searching && (
            <IconButton label="Buscar en el proyecto" onClick={() => setSearching(true)}>
              <Search size={16} />
            </IconButton>
          )}
        </div>
        {view && view.kind !== 'report' && <Toolbar project={project} view={view} />}
      </div>

      <div key={notesTab ? 'notes' : view?.id} className="entra pt-3" style={{ '--entra-desde': 'translateY(6px)', '--entra-dura': '240ms' }}>
          {notesTab && (
            <div className="px-4 pb-16 pt-2 sm:px-8">
              <NotesBoard projectId={project.id} />
            </div>
          )}
          {view?.kind === 'board' && <BoardView project={project} view={view} cards={cards} onOpen={openCard} />}
          {view?.kind === 'table' && <TableView project={project} view={view} cards={cards} onOpen={openCard} />}
          {view?.kind === 'list' && <ListView project={project} view={view} cards={cards} onOpen={openCard} />}
          {view?.kind === 'calendar' && <CalendarView project={project} view={view} cards={cards} onOpen={openCard} />}
          {view?.kind === 'report' && <ReportView project={project} view={view} onOpen={openCard} />}
      </div>
    </div>
  )
}

/* Texto editable en el sitio que crece hacia abajo en vez de cortarse */
function AutoText({ defaultValue, onCommit, className, placeholder }) {
  const ref = useRef(null)
  const fit = () => {
    const el = ref.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }
  useLayoutEffect(fit, [])
  return (
    <textarea
      ref={ref}
      rows={1}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onInput={fit}
      onBlur={(e) => onCommit(e.target.value.replace(/\n/g, ' '))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      className={cx('block resize-none overflow-hidden bg-transparent outline-none', className)}
    />
  )
}

function ProjectHeader({ project, done, total, onSettings }) {
  const updateProject = useStore((s) => s.updateProject)
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className="px-4 pb-3 pt-5 sm:px-8 sm:pb-4 lg:pt-10">
      <div className="flex items-start gap-3">
        <div className="text-[30px] leading-none sm:text-[34px]">{project.icon}</div>
        <div className="min-w-0 flex-1">
          <AutoText
            key={project.id + project.name}
            defaultValue={project.name}
            onCommit={(v) => v.trim() && v !== project.name && updateProject(project.id, { name: v.trim() })}
            className="w-full text-[24px] font-semibold leading-tight tracking-[-0.025em] sm:text-[28px]"
          />
          <AutoText
            key={project.id + 'd' + project.description}
            defaultValue={project.description}
            placeholder="Añade una descripción o el porqué del proyecto…"
            onCommit={(v) => v !== project.description && updateProject(project.id, { description: v })}
            className="mt-1 w-full text-[14.5px] text-muted placeholder:text-faint"
          />
        </div>
        <IconButton label="Ajustes del proyecto" onClick={onSettings}>
          <Settings2 size={17} />
        </IconButton>
      </div>
      {total > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-1.5 max-w-60 flex-1 overflow-hidden rounded-full bg-sunken">
            <div className="h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${pct / 100})`, transition: 'transform .6s cubic-bezier(.32,.72,0,1)' }} />
          </div>
          <span className="text-[12.5px] tabular-nums text-faint">
            {done}/{total} terminadas
          </span>
          {project.archived && <span className="rounded-md bg-sunken px-2 py-0.5 text-[12px] text-muted">Aparcado</span>}
        </div>
      )}
    </div>
  )
}

function ViewTab({ view, active, onSelect, canDelete }) {
  const Icon = kindIcon(view.kind)
  const menu = usePopover()
  const { updateView, deleteView } = useStore.getState()
  return (
    <div className="relative">
      <button
        onClick={(e) => (active ? menu.toggle(e) : onSelect())}
        className={cx('relative flex h-10 items-center gap-1.5 whitespace-nowrap px-2.5 text-[13.5px] transition-colors', active ? 'text-ink' : 'text-muted hover:text-ink')}
      >
        <Icon size={15} />
        {view.name}
        {active && <motion.span layoutId="view-underline" transition={spring} className="absolute inset-x-1.5 bottom-0 h-[2px] rounded-full bg-ink" />}
      </button>
      <Popover open={menu.open} anchor={menu.anchor} onClose={menu.close} width={230}>
        <div className="px-1 pb-1">
          <input
            defaultValue={view.name}
            onBlur={(e) => e.target.value.trim() && e.target.value !== view.name && updateView(view.id, { name: e.target.value.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="h-9 w-full rounded-lg bg-sunken px-2.5 text-[14px] outline-none"
          />
        </div>
        <MenuLabel>Tipo de vista</MenuLabel>
        {VIEW_KINDS.map((k) => (
          <MenuItem key={k.id} icon={k.icon} active={view.kind === k.id} onClick={() => updateView(view.id, { kind: k.id })}>
            {k.name}
          </MenuItem>
        ))}
        {canDelete && (
          <>
            <Divider />
            <MenuItem icon={Trash2} danger onClick={() => (menu.close(), deleteView(view.id))}>
              Eliminar vista
            </MenuItem>
          </>
        )}
      </Popover>
    </div>
  )
}

function NotesTab({ active, count, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={cx('relative flex h-10 items-center gap-1.5 whitespace-nowrap px-2.5 text-[13.5px] transition-colors', active ? 'text-ink' : 'text-muted hover:text-ink')}
    >
      <NotebookText size={15} />
      Apuntes
      {count > 0 && <span className="text-[12px] tabular-nums text-faint">{count}</span>}
      {active && <motion.span layoutId="view-underline" transition={spring} className="absolute inset-x-1.5 bottom-0 h-[2px] rounded-full bg-ink" />}
    </button>
  )
}

function NewViewButton({ project, onCreated }) {
  const pop = usePopover()
  const s = useStore()
  const create = async (kind) => {
    pop.close()
    const groups = projectGroups(s, project.id)
    const k = VIEW_KINDS.find((x) => x.id === kind)
    const v = await s.createView({
      project_id: project.id,
      name: k.name,
      kind,
      config: { group_by: kind === 'board' ? groups[0]?.id : null, sort: [], filter: {}, hide_done: false },
    })
    if (v) onCreated(v)
  }
  return (
    <>
      <IconButton label="Nueva vista" size="sm" onClick={pop.toggle} className="ml-1 shrink-0">
        <Plus size={15} />
      </IconButton>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={200}>
        <MenuLabel>Nueva vista</MenuLabel>
        {VIEW_KINDS.map((k) => (
          <MenuItem key={k.id} icon={k.icon} onClick={() => create(k.id)}>
            {k.name}
          </MenuItem>
        ))}
      </Popover>
    </>
  )
}

function Toolbar({ project, view }) {
  const s = useStore()
  const groups = useMemo(() => projectGroups(s, project.id), [s.groups, project.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const group = usePopover()
  const sort = usePopover()
  const filter = usePopover()
  const dateSel = usePopover()
  const cfg = view.config
  const dateProps = projectProps(s, project.id).filter((p) => p.key === 'due' || p.field?.kind === 'date')
  const setCfg = (patch) => s.updateView(view.id, { config: { ...cfg, ...patch } })
  const sorts = cfg.sort || []
  const filterLabels = cfg.filter?.labels || []
  const sortName = (f) =>
    (f.startsWith('group:')
      ? s.groups[Number(f.slice(6))]?.name
      : f.startsWith('f:')
        ? s.fields[Number(f.slice(2))]?.name
        : (f === 'due_at' && project.prop_names?.due) || SORT_FIELDS.find((x) => x.id === f)?.name) || f

  const pill = (activeState) =>
    cx('inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-[13px] transition-colors', activeState ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-ink')

  return (
    <div className="flex items-center gap-1 overflow-x-auto px-4 py-1.5 [scrollbar-width:none] sm:px-8">
      {(view.kind === 'board' || view.kind === 'list') && (
        <button onClick={group.toggle} className={pill(false)}>
          <Layers size={14} />
          {s.groups[cfg.group_by] ? <span><span className="max-sm:hidden">Agrupar: </span>{s.groups[cfg.group_by].name}</span> : 'Agrupar'}
        </button>
      )}
      {view.kind !== 'calendar' && (
        <button onClick={sort.toggle} className={pill(sorts.length)}>
          <SortAsc size={14} />
          {sorts.length ? `Orden: ${sorts.map((x) => sortName(x.field)).join(', ')}` : 'Ordenar'}
        </button>
      )}
      {view.kind === 'calendar' && (
        <button onClick={dateSel.toggle} className={pill(false)}>
          <Calendar size={14} />
          <span><span className="max-sm:hidden">Fecha: </span>{dateProps.find((p) => p.key === (cfg.date_key || 'due'))?.name || 'Fecha'}</span>
        </button>
      )}
      <button onClick={filter.toggle} className={pill(filterLabels.length)}>
        <Filter size={14} />
        Filtrar{filterLabels.length ? ` · ${filterLabels.length}` : ''}
      </button>
      <button onClick={() => setCfg({ hide_done: !cfg.hide_done })} className={pill(cfg.hide_done)}>
        {cfg.hide_done ? <EyeOff size={14} /> : <Eye size={14} />}
        <span className="max-sm:hidden">{cfg.hide_done ? 'Ocultando terminadas' : 'Terminadas visibles'}</span>
        <span className="sm:hidden">{cfg.hide_done ? 'Sin terminadas' : 'Terminadas'}</span>
      </button>

      <Popover open={dateSel.open} anchor={dateSel.anchor} onClose={dateSel.close} width={240}>
        <MenuLabel>Mostrar en el calendario</MenuLabel>
        {dateProps.map((p) => (
          <MenuItem key={p.key} icon={p.icon} active={(cfg.date_key || 'due') === p.key} onClick={() => (setCfg({ date_key: p.key }), dateSel.close())}>
            {p.name}
          </MenuItem>
        ))}
        {dateProps.length < 2 && <p className="px-3 pb-2 pt-1 text-[12.5px] text-faint">Añade otra propiedad de tipo Fecha desde una tarjeta para poder elegirla aquí.</p>}
      </Popover>
      <Popover open={group.open} anchor={group.anchor} onClose={group.close} width={220}>
        <MenuLabel>Agrupar por</MenuLabel>
        {view.kind === 'list' && (
          <MenuItem active={!cfg.group_by} onClick={() => (setCfg({ group_by: null }), group.close())}>
            Sin agrupar
          </MenuItem>
        )}
        {groups.map((g) => (
          <MenuItem key={g.id} active={cfg.group_by === g.id} onClick={() => (setCfg({ group_by: g.id }), group.close())}>
            {g.name}
          </MenuItem>
        ))}
      </Popover>

      <Popover open={sort.open} anchor={sort.anchor} onClose={sort.close} width={300}>
        <MenuLabel>Ordenar por (en orden de prioridad)</MenuLabel>
        {sorts.map((x, i) => (
          <div key={i} className="flex items-center gap-1 px-1 py-0.5">
            <span className="w-4 text-center text-[12px] text-faint">{i + 1}</span>
            <span className="flex-1 truncate px-1 text-[14px]">{sortName(x.field)}</span>
            <Button size="sm" onClick={() => setCfg({ sort: sorts.map((y, j) => (j === i ? { ...y, dir: y.dir === 'asc' ? 'desc' : 'asc' } : y)) })}>
              {x.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
              {x.field.startsWith('group:') ? (x.dir === 'asc' ? 'Orden etiquetas' : 'Inverso') : x.dir === 'asc' ? 'Asc' : 'Desc'}
            </Button>
            <IconButton size="sm" label="Quitar" onClick={() => setCfg({ sort: sorts.filter((_, j) => j !== i) })}>
              <X size={14} />
            </IconButton>
          </div>
        ))}
        {sorts.length > 0 && <Divider />}
        <MenuLabel>Añadir criterio</MenuLabel>
        {groups
          .filter((g) => !sorts.some((x) => x.field === `group:${g.id}`))
          .map((g) => (
            <MenuItem key={g.id} icon={Layers} onClick={() => setCfg({ sort: [...sorts, { field: `group:${g.id}`, dir: 'asc' }] })}>
              {g.name}
            </MenuItem>
          ))}
        {Object.values(s.fields)
          .filter((f) => f.project_id === project.id && !sorts.some((x) => x.field === `f:${f.id}`))
          .map((f) => (
            <MenuItem key={`f${f.id}`} icon={fieldIcon(f.kind)} onClick={() => setCfg({ sort: [...sorts, { field: `f:${f.id}`, dir: 'asc' }] })}>
              {f.name}
            </MenuItem>
          ))}
        {SORT_FIELDS.filter((f) => f.id !== 'position' && !sorts.some((x) => x.field === f.id)).map((f) => (
          <MenuItem key={f.id} onClick={() => setCfg({ sort: [...sorts, { field: f.id, dir: 'asc' }] })}>
            {sortName(f.id)}
          </MenuItem>
        ))}
        {sorts.length > 0 && (
          <>
            <Divider />
            <MenuItem onClick={() => setCfg({ sort: [] })}>Volver a orden manual</MenuItem>
          </>
        )}
      </Popover>

      <Popover open={filter.open} anchor={filter.anchor} onClose={filter.close} width={280}>
        {groups.map((g) => (
          <div key={g.id} className="pb-1">
            <MenuLabel>{g.name}</MenuLabel>
            <div className="flex flex-wrap gap-1 px-2 pb-1">
              {groupLabels(s, g.id).map((l) => {
                const on = filterLabels.includes(l.id)
                return (
                  <button
                    key={l.id}
                    onClick={() => setCfg({ filter: { ...cfg.filter, labels: on ? filterLabels.filter((x) => x !== l.id) : [...filterLabels, l.id] } })}
                    className={cx('rounded-md transition-[opacity,box-shadow]', on ? 'ring-2 ring-[var(--accent)]' : 'opacity-70 hover:opacity-100')}
                  >
                    <LabelChip label={l} />
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <Divider />
        <div className="flex items-center gap-2 px-2.5 py-1.5 text-[14px]">
          <span className="flex-1">Ocultar terminadas</span>
          <Toggle checked={!!cfg.hide_done} onChange={(v) => setCfg({ hide_done: v })} />
        </div>
        {filterLabels.length > 0 && <MenuItem onClick={() => setCfg({ filter: { ...cfg.filter, labels: [] } })}>Quitar filtros</MenuItem>}
      </Popover>
    </div>
  )
}

