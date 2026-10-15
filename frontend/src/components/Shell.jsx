import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, CircleCheckBig, Inbox, Menu, PanelLeft, Plus, WifiOff } from 'lucide-react'
import { useStore } from '../lib/store'
import { useCardNav } from '../lib/nav'
import { ARRIVE, css, LEAVE, useBackToClose } from '../lib/layers'
import { Sidebar, useNav } from './Sidebar'
import { CommandPalette } from './CommandPalette'
import { NewProjectModal } from './NewProject'
import { NotificationsPanel } from './Notifications'
import { CardPanel } from './CardPanel'
import { cx, IconButton, Scrim } from './ui'

function useWide(bp) {
  const [w, setW] = useState(() => window.innerWidth >= bp)
  useEffect(() => {
    const on = () => setW(window.innerWidth >= bp)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [bp])
  return w
}

// Solo al abrir la app (o recargar): volver a lo último que se estaba viendo
let restoredLast = false

/* Lo último que se veía (página, vista, tarjeta o apunte abiertos) se guarda
   por usuario en este dispositivo, y al volver a entrar se recupera. Solo si
   se entra por la raíz: un enlace directo a otra cosa manda. */
function useRememberPlace() {
  const loc = useLocation()
  const nav = useNavigate()
  const userId = useStore((s) => s.user?.id)
  const storeKey = `mentodo:last:${userId}`

  useEffect(() => {
    if (restoredLast || !userId) return
    restoredLast = true
    if (loc.pathname !== '/' || loc.search) return
    try {
      const last = localStorage.getItem(storeKey)
      if (last && last !== '/') nav(last, { replace: true })
    } catch {}
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId || !restoredLast) return
    try {
      localStorage.setItem(storeKey, loc.pathname + loc.search)
    } catch {}
  }, [loc.pathname, loc.search, userId, storeKey])
}

export function Shell() {
  useRememberPlace()
  const [palette, setPalette] = useState(false)
  const [newProject, setNewProject] = useState(false)
  const [notifs, setNotifs] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mentodo:sidebar') === '0')
  const desktop = useWide(1024)
  const phone = !useWide(640)
  const online = useStore((s) => s.online)
  const [params] = useSearchParams()
  const loc = useLocation()
  const { close: closeCard } = useCardNav()
  const cardId = params.get('card') ? Number(params.get('card')) : null

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

  // Abrir algo encima desde el menú lateral lo cierra: no se quedan dos capas
  const sidebarProps = {
    onSearch: () => (setDrawer(false), setPalette(true)),
    onNewProject: () => (setDrawer(false), setNewProject(true)),
    onNotifications: () => (setDrawer(false), setNotifs(true)),
  }
  const showSidebar = desktop && !collapsed

  // Las rutas, memoizadas por ubicación: abrir el menú o una capa cambia
  // estado de este componente y no debe volver a pintar la página de debajo
  // (con muchas tarjetas, eso caía justo en el primer fotograma del gesto).
  const pageKey = loc.pathname
  const page = useMemo(
    () => (
      <div key={pageKey} className="entra min-h-full" style={{ '--entra-desde': 'translateY(6px)', '--entra-dura': '260ms' }}>
        <Outlet context={{ openPalette: () => setPalette(true), newProject: () => setNewProject(true) }} />
      </div>
    ),
    [pageKey],
  )

  return (
    <div className="flex h-full">
      {/* Barra lateral fija en escritorio */}
      <aside
        className="hidden shrink-0 overflow-hidden border-r border-line bg-[color-mix(in_oklab,var(--sunken)_55%,var(--bg))] lg:block"
        style={{ width: showSidebar ? 264 : 0, transition: 'width .3s cubic-bezier(.32,.72,0,1)' }}
      >
        <div className="h-full w-[264px]" style={{ opacity: showSidebar ? 1 : 0, transition: 'opacity .2s' }}>
          <Sidebar {...sidebarProps} />
        </div>
      </aside>

      {/* Menú lateral en móvil y tablet: siempre montado (abrirlo no construye
          nada, solo se mueve), con transición CSS y arrastrable para cerrar */}
      {!desktop && <Drawer open={drawer} onClose={() => setDrawer(false)} sidebarProps={sidebarProps} />}

      <main className="relative flex min-w-0 flex-1 flex-col">
        {!desktop ? (
          <TopBar onMenu={() => setDrawer(true)} onNotifs={() => setNotifs(true)} />
        ) : (
          <div className="absolute left-3 top-3 z-20">
            <IconButton
              label={showSidebar ? 'Ocultar barra lateral (⌘\\)' : 'Mostrar barra lateral (⌘\\)'}
              onClick={toggleSidebar}
              className={cx(showSidebar && 'opacity-0 transition-opacity hover:opacity-100 focus:opacity-100')}
            >
              <PanelLeft size={17} />
            </IconButton>
          </div>
        )}
        <AnimatePresence>
          {!online && (
            <motion.div
              initial={{ opacity: 0, transform: 'translate(-50%, -12px)' }}
              animate={{ opacity: 1, transform: 'translate(-50%, 0px)' }}
              exit={{ opacity: 0, transform: 'translate(-50%, -12px)' }}
              transition={{ duration: 0.25 }}
              className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+64px)] z-30 flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted shadow-soft lg:top-3"
            >
              <WifiOff size={13} /> Reconectando…
            </motion.div>
          )}
        </AnimatePresence>
        <div className={cx('min-h-0 flex-1 overflow-y-auto overscroll-contain', phone && 'pb-24')} id="scroller">
          {page}
        </div>
        {phone && (loc.pathname === '/' || loc.pathname === '/inbox' || /^\/p\/\d+$/.test(loc.pathname)) && (
          <button
            onClick={() => setPalette(true)}
            aria-label="Capturar"
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+20px)] right-5 z-30 grid size-14 place-items-center rounded-2xl bg-accent text-accent-ink shadow-float transition-transform duration-150 active:scale-90"
          >
            <Plus size={24} />
          </button>
        )}
      </main>

      <CardPanel cardId={cardId} onClose={closeCard} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} onNewProject={() => setNewProject(true)} />
      <NewProjectModal open={newProject} onClose={() => setNewProject(false)} />
      <NotificationsPanel open={notifs} onClose={() => setNotifs(false)} />
    </div>
  )
}

/* Título de la sección actual, para la barra superior del móvil */
function useTitle() {
  const loc = useLocation()
  const projects = useStore((s) => s.projects)
  const m = loc.pathname.match(/^\/p\/(\d+)/)
  if (m) {
    const p = projects[Number(m[1])]
    return p ? (
      <span className="flex items-center gap-2">
        <span>{p.icon}</span>
        <span className="truncate">{p.name}</span>
      </span>
    ) : ''
  }
  return { '/': 'To Do', '/inbox': 'Bandeja', '/apuntes': 'Apuntes', '/ajustes': 'Ajustes', '/admin': 'Administración' }[loc.pathname] || ''
}

function TopBar({ onMenu, onNotifs }) {
  const title = useTitle()
  const { inbox, todo } = useNav()
  const unread = useStore((s) => s.notifications.filter((n) => !n.read).length)
  const nav = useNavigate()
  const loc = useLocation()
  const counter = (active) =>
    cx('relative flex h-9 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium tabular-nums transition-colors active:bg-hover', active ? 'text-accent' : 'text-muted')
  return (
    <header className="relative z-20 shrink-0 border-b border-line bg-[color-mix(in_oklab,var(--bg)_86%,transparent)] pt-safe backdrop-blur-xl">
      <div className="flex h-14 items-center gap-1 px-2">
        <IconButton label="Abrir menú" size="lg" onClick={onMenu} className="text-ink">
          <Menu size={22} />
        </IconButton>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={typeof title === 'string' ? title : loc.pathname}
              initial={{ opacity: 0, transform: 'translateY(6px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              exit={{ opacity: 0, transform: 'translateY(-6px)' }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className="truncate pl-1 text-[16px] font-semibold tracking-[-0.01em]"
            >
              {title}
            </motion.p>
          </AnimatePresence>
        </div>
        {/* Lo que espera, en pequeñito: To Do, bandeja y avisos sin leer */}
        <div className="flex items-center">
          <button aria-label={`To Do: ${todo}`} onClick={() => nav('/')} className={counter(loc.pathname === '/')}>
            <CircleCheckBig size={17} />
            {todo > 0 && <span>{todo}</span>}
          </button>
          <button aria-label={`Bandeja: ${inbox}`} onClick={() => nav('/inbox')} className={counter(loc.pathname === '/inbox')}>
            <Inbox size={17} />
            {inbox > 0 && <span>{inbox}</span>}
          </button>
          <button aria-label={`Avisos: ${unread} sin leer`} onClick={onNotifs} className={counter(false)}>
            <Bell size={17} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-ink">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}

function Drawer({ open, onClose, sidebarProps }) {
  const loc = useLocation()
  const [dx, setDx] = useState(0)
  const drag = useRef(null)
  useBackToClose(open, onClose)

  // Al navegar desde dentro, el menú se cierra
  const first = useRef(true)
  useEffect(() => {
    if (first.current) return void (first.current = false)
    onClose()
  }, [loc.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Arrastrar hacia la izquierda para cerrarlo. El gesto solo se adueña del
  // dedo cuando el movimiento es claramente horizontal: así el scroll vertical
  // de la lista y los toques normales siguen funcionando.
  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, y: e.clientY, t: performance.now(), active: false, id: e.pointerId, el: e.currentTarget }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    const mx = e.clientX - d.x
    const my = e.clientY - d.y
    if (!d.active) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3 && mx < 0) {
        d.active = true
        try {
          d.el.setPointerCapture(d.id)
        } catch {}
      } else if (Math.abs(my) > 10) {
        drag.current = null
        return
      } else return
    }
    setDx(Math.min(0, mx))
  }
  const onPointerUp = (e) => {
    const d = drag.current
    drag.current = null
    if (!d?.active) return
    const mx = Math.min(0, e.clientX - d.x)
    const v = (mx / Math.max(1, performance.now() - d.t)) * 1000
    setDx(0)
    if (mx < -70 || v < -450) onClose()
  }

  return (
    <>
      <Scrim shown={open} onClick={onClose} z="z-50" />
      <aside
        role="dialog"
        aria-label="Menú"
        inert={!open}
        className="fixed inset-y-0 left-0 z-50 w-[82%] max-w-[300px]"
        style={{
          transform: open ? `translateX(${dx}px)` : 'translateX(-104%)',
          transition: dx ? 'none' : css(open ? ARRIVE : LEAVE, ['transform']),
          willChange: 'transform',
          touchAction: 'pan-y',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="h-full border-r border-line bg-bg pt-safe pb-safe shadow-float">
          <Sidebar {...sidebarProps} touch />
        </div>
      </aside>
    </>
  )
}
