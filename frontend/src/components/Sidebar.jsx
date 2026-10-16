import { useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { SortableList, SortableRow } from './Sortable'
import { Archive, Bell, ChevronRight, CircleCheckBig, Inbox, NotebookText, Plus, Search, Settings, Shield, Sun, CalendarRange } from 'lucide-react'
import { useStore } from '../lib/store'
import { Collapse, cx, IconButton, IS_MAC, Kbd, spring } from './ui'
import { Logo, Wordmark } from './Logo'
import { isInactive } from '../lib/cards'

export function useNav() {
  const cards = useStore((s) => s.cards)
  const hidden = useStore((s) => s.hidden)
  const labels = useStore((s) => s.labels)
  return useMemo(() => {
    const list = Object.values(cards).filter((c) => !hidden[c.id])
    return {
      inbox: list.filter((c) => c.project_id === null && !c.done).length,
      todo: list.filter((c) => c.in_todo && !c.done && !isInactive({ labels }, c)).length,
    }
  }, [cards, hidden, labels])
}

function NavItem({ to, icon: Icon, children, count, onClick, end, touch }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          'group relative flex items-center rounded-lg transition-colors duration-150',
          touch ? 'h-11 gap-3 px-3 text-[15.5px]' : 'h-8 gap-2.5 px-2.5 text-[14px]',
          isActive ? 'text-ink' : 'text-muted hover:bg-hover hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId={touch ? 'nav-active-t' : 'nav-active'} transition={touch ? { duration: 0 } : spring} className="absolute inset-0 rounded-lg bg-hover" />}
          <Icon size={touch ? 19 : 16} className={cx('relative', isActive && 'text-accent')} />
          <span className="relative flex-1 truncate">{children}</span>
          {count > 0 && <span className="relative text-[12px] tabular-nums text-faint">{count}</span>}
        </>
      )}
    </NavLink>
  )
}

export function Sidebar({ onSearch, onNewProject, onNotifications, onNavigate, touch }) {
  const user = useStore((s) => s.user)
  const projectsMap = useStore((s) => s.projects)
  const notifications = useStore((s) => s.notifications)
  const updateProject = useStore((s) => s.updateProject)
  const { inbox, todo } = useNav()
  const [showArchived, setShowArchived] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()

  const projects = useMemo(
    () => Object.values(projectsMap).filter((p) => !p.archived).sort((a, b) => a.position - b.position),
    [projectsMap],
  )
  const archived = useMemo(() => Object.values(projectsMap).filter((p) => p.archived), [projectsMap])
  const unread = notifications.filter((n) => !n.read).length
  const shown = projects

  const reorder = (ids) =>
    ids.forEach((id, i) => {
      if (projectsMap[id] && projectsMap[id].position !== i) updateProject(id, { position: i })
    })

  return (
    <div className="flex h-full flex-col">
      <div className={cx("flex items-center gap-2 px-3 pb-2", touch ? "pt-5" : "pt-4")}>
        <button onClick={() => nav('/')} className="flex items-center gap-2 rounded-lg px-1 py-0.5">
          <Logo size={22} />
          <Wordmark height={15} className="mt-0.5" />
        </button>
        <div className="flex-1" />
        {!touch && <IconButton label="Avisos" size="sm" onClick={onNotifications} className="relative">
          <Bell size={16} />
          {unread > 0 && <span className="absolute right-1 top-1 size-2 rounded-full bg-accent ring-2 ring-[var(--bg)]" />}
        </IconButton>}
      </div>

      <div className="px-2">
        <button
          onClick={onSearch}
          className={cx('mb-2 flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 text-faint shadow-soft transition-colors hover:text-muted', touch ? 'h-11 text-[15px]' : 'h-8 text-[13.5px]')}
        >
          <Search size={touch ? 17 : 15} />
          <span className="flex-1 text-left">Buscar o capturar…</span>
          {!touch && <Kbd>{IS_MAC ? '⌘K' : 'Ctrl K'}</Kbd>}
        </button>
        <NavItem touch={touch} to="/hoy" icon={Sun} onClick={onNavigate}>
          Hoy
        </NavItem>
        <NavItem touch={touch} to="/" end icon={CircleCheckBig} count={todo} onClick={onNavigate}>
          To Do
        </NavItem>
        <NavItem touch={touch} to="/inbox" icon={Inbox} count={inbox} onClick={onNavigate}>
          Bandeja
        </NavItem>
        <NavItem touch={touch} to="/apuntes" icon={NotebookText} onClick={onNavigate}>
          Apuntes
        </NavItem>
        <NavItem touch={touch} to="/semana" icon={CalendarRange} onClick={onNavigate}>
          Semana
        </NavItem>
      </div>

      <div className="mt-5 flex items-center px-4 pb-1">
        <span className="flex-1 text-[11.5px] font-medium uppercase tracking-wide text-faint">Proyectos</span>
        <IconButton label="Nuevo proyecto" size="sm" onClick={onNewProject} className="-mr-1.5 size-6">
          <Plus size={15} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <div className="flex flex-col">
        <SortableList ids={shown.map((p) => p.id)} onReorder={reorder} handle={false}>
          {() => shown.map((p) => (
            <SortableRow key={p.id} id={p.id} handle={false} className="relative">
              {() => (
              <NavLink
                to={`/p/${p.id}`}
                onClick={onNavigate}
                draggable={false}
                className={({ isActive }) =>
                  cx(
                    'group relative flex items-center rounded-lg transition-colors duration-150',
                    touch ? 'h-11 gap-3 px-3 text-[15.5px]' : 'h-8 gap-2.5 px-2.5 text-[14px]',
                    isActive || loc.pathname.startsWith(`/p/${p.id}/`) ? 'text-ink' : 'text-muted hover:bg-hover hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {(isActive || loc.pathname.startsWith(`/p/${p.id}/`)) && (
                      <motion.span layoutId={touch ? 'nav-active-t' : 'nav-active'} transition={touch ? { duration: 0 } : spring} className="absolute inset-0 rounded-lg bg-hover" />
                    )}
                    <span className="relative w-4 text-center text-[14px] leading-none">{p.icon}</span>
                    <span className="relative flex-1 truncate">{p.name}</span>
                  </>
                )}
              </NavLink>
              )}
            </SortableRow>
          ))}
        </SortableList>
        </div>
        {projects.length === 0 && (
          <button onClick={onNewProject} className="flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[14px] text-faint hover:bg-hover hover:text-muted">
            <Plus size={15} /> Crea tu primer proyecto
          </button>
        )}
        {archived.length > 0 && (
          <div className="mt-3">
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex h-7 w-full items-center gap-2 rounded-lg px-2.5 text-[13px] text-faint hover:text-muted"
            >
              <ChevronRight size={14} style={{ transform: `rotate(${showArchived ? 90 : 0}deg)`, transition: 'transform .25s cubic-bezier(.32,.72,0,1)' }} />
              <Archive size={14} /> Aparcados ({archived.length})
            </button>
            <Collapse open={showArchived}>
                  {archived.map((p) => (
                    <NavLink
                      key={p.id}
                      to={`/p/${p.id}`}
                      onClick={onNavigate}
                      className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[14px] text-faint hover:bg-hover hover:text-muted"
                    >
                      <span className="w-4 text-center opacity-60 grayscale">{p.icon}</span>
                      <span className="truncate">{p.name}</span>
                    </NavLink>
                  ))}
            </Collapse>
          </div>
        )}
      </div>

      <div className="border-t border-line px-2 py-2">
        {user?.is_admin && (
          <NavItem touch={touch} to="/admin" icon={Shield} onClick={onNavigate}>
            Administración
          </NavItem>
        )}
        <NavItem touch={touch} to="/ajustes" icon={Settings} onClick={onNavigate}>
          Ajustes
        </NavItem>
        <div className="mt-1 flex items-center gap-2.5 px-2.5 py-1.5">
          <Avatar user={user} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium">{user?.display_name}</div>
            <div className="truncate text-[12px] text-faint">@{user?.username}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Avatar({ user, size = 26 }) {
  const initial = (user?.display_name || '?').trim().charAt(0).toUpperCase()
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-accent-soft font-semibold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.44 }}
    >
      {initial}
    </span>
  )
}
