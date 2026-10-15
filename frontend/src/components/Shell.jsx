import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, CircleCheckBig, FolderKanban, Inbox, PanelLeft, Plus, WifiOff } from 'lucide-react'
import { useStore } from '../lib/store'
import { Sidebar, useNav } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { NewProjectModal } from './NewProject'
import { NotificationsPanel } from './Notifications'
import { CardPanel } from './CardPanel'
import { cx, IconButton, softSpring, spring } from './ui'

function useWide(bp) {
  const [w, setW] = useState(() => window.innerWidth >= bp)
  useEffect(() => {
    const on = () => setW(window.innerWidth >= bp)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [bp])
  return w
}

export function Shell() {
  const [palette, setPalette] = useState(false)
  const [newProject, setNewProject] = useState(false)
  const [notifs, setNotifs] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mentodo:sidebar') === '0')
  const desktop = useWide(1024)
  const phone = !useWide(640)
  const online = useStore((s) => s.online)
  const [params, setParams] = useSearchParams()
  const loc = useLocation()
  const cardId = params.get('card') ? Number(params.get('card')) : null

  useEffect(() => setDrawer(false), [loc.pathname])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toggleSidebar = () => {
    if (!desktop) return setDrawer((v) => !v)
    setCollapsed((v) => {
      try {
        localStorage.setItem('mentodo:sidebar', v ? '1' : '0')
      } catch {}
      return !v
    })
  }

  const closeCard = useCallback(() => {
    const p = new URLSearchParams(params)
    p.delete('card')
    setParams(p, { replace: true })
  }, [params, setParams])

  const sidebarProps = {
    onSearch: () => setPalette(true),
    onNewProject: () => setNewProject(true),
    onNotifications: () => setNotifs(true),
  }
  const showSidebar = desktop && !collapsed

  return (
    <div className="flex h-full">
      {/* Barra lateral fija en escritorio */}
      <motion.aside
        initial={false}
        animate={{ width: showSidebar ? 264 : 0, opacity: showSidebar ? 1 : 0 }}
        transition={softSpring}
        className="hidden shrink-0 overflow-hidden border-r border-line bg-[color-mix(in_oklab,var(--sunken)_55%,var(--bg))] lg:block"
      >
        <div className="h-full w-[264px]">
          <Sidebar {...sidebarProps} />
        </div>
      </motion.aside>

      {/* Cajón en tablet/móvil */}
      <AnimatePresence>
        {!desktop && drawer && (
          <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={softSpring}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.5, right: 0 }}
              onDragEnd={(_, i) => (i.offset.x < -60 || i.velocity.x < -400) && setDrawer(false)}
              className="absolute inset-y-0 left-0 w-[284px] border-r border-line bg-bg pt-safe shadow-float"
            >
              <Sidebar {...sidebarProps} onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <div className={cx('absolute left-3 top-3 z-20', showSidebar && 'lg:hidden', phone && 'hidden')}>
          <IconButton label="Barra lateral (⌘\)" onClick={toggleSidebar}>
            <PanelLeft size={17} />
          </IconButton>
        </div>
        {showSidebar && (
          <div className="absolute left-3 top-3 z-20 hidden lg:block">
            <IconButton label="Ocultar barra lateral (⌘\)" onClick={toggleSidebar} className="opacity-0 transition-opacity hover:opacity-100 focus:opacity-100">
              <PanelLeft size={17} />
            </IconButton>
          </div>
        )}
        <AnimatePresence>
          {!online && (
            <motion.div
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -40, opacity: 0 }}
              transition={spring}
              className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted shadow-soft"
            >
              <WifiOff size={13} /> Reconectando…
            </motion.div>
          )}
        </AnimatePresence>
        <div className={cx('min-h-0 flex-1 overflow-y-auto', phone && 'pb-24')} id="scroller">
          <Outlet context={{ openPalette: () => setPalette(true), newProject: () => setNewProject(true) }} />
        </div>
        {phone && <MobileBar onSearch={() => setPalette(true)} onProjects={() => setDrawer(true)} onNotifs={() => setNotifs(true)} />}
      </main>

      <CardPanel cardId={cardId} onClose={closeCard} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} onNewProject={() => setNewProject(true)} />
      <NewProjectModal open={newProject} onClose={() => setNewProject(false)} />
      <NotificationsPanel open={notifs} onClose={() => setNotifs(false)} />
    </div>
  )
}

function MobileBar({ onSearch, onProjects, onNotifs }) {
  const { inbox, todo } = useNav()
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length)
  const loc = useLocation()
  const inProject = loc.pathname.startsWith('/p/')
  const tab = 'relative flex flex-1 flex-col items-center gap-0.5 pt-2 text-[10.5px] font-medium'
  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onSearch}
        aria-label="Capturar"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] right-4 z-30 grid size-14 place-items-center rounded-2xl bg-accent text-accent-ink shadow-float"
      >
        <Plus size={24} />
      </motion.button>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] pb-safe backdrop-blur-xl">
        {[
          { to: '/', icon: CircleCheckBig, label: 'To Do', count: todo, end: true },
          { to: '/inbox', icon: Inbox, label: 'Bandeja', count: inbox },
        ].map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => cx(tab, isActive ? 'text-accent' : 'text-muted')}>
            <t.icon size={21} />
            {t.label}
            {t.count > 0 && <span className="absolute right-[calc(50%-20px)] top-1 rounded-full bg-accent px-1 text-[9.5px] leading-[14px] text-accent-ink">{t.count}</span>}
          </NavLink>
        ))}
        <button onClick={onProjects} className={cx(tab, inProject ? 'text-accent' : 'text-muted')}>
          <FolderKanban size={21} /> Proyectos
        </button>
        <button onClick={onNotifs} className={cx(tab, 'text-muted')}>
          <Bell size={21} /> Avisos
          {unread > 0 && <span className="absolute right-[calc(50%-14px)] top-1.5 size-2 rounded-full bg-accent" />}
        </button>
      </nav>
    </>
  )
}
