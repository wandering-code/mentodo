import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { MotionConfig, motion } from 'motion/react'
import { Toaster } from 'sonner'
import { useStore } from './lib/store'
import { startSync, stopSync } from './lib/sync'
import { Shell } from './components/Shell'
import { Logo } from './components/Logo'
import { AuthPage } from './pages/AuthPage'
import { TodoPage } from './pages/TodoPage'
import { InboxPage } from './pages/InboxPage'
import { ProjectPage } from './pages/ProjectPage'
import { ProjectSettings } from './pages/ProjectSettings'
import { SettingsPage } from './pages/SettingsPage'
import { AdminPage } from './pages/AdminPage'

export default function App() {
  const status = useStore((s) => s.status)
  const theme = useStore((s) => s.user?.theme)

  useEffect(() => {
    useStore.getState().bootstrap()
  }, [])

  useEffect(() => {
    if (status === 'ready') startSync()
    else stopSync()
  }, [status])

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        {status === 'loading' && (
          <div className="grid h-full place-items-center">
            <motion.div animate={{ scale: [1, 0.92, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}>
              <Logo size={44} />
            </motion.div>
          </div>
        )}
        {status === 'anon' && <AuthPage />}
        {status === 'ready' && (
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<TodoPage />} />
              <Route path="inbox" element={<InboxPage />} />
              <Route path="p/:projectId" element={<ProjectPage />} />
              <Route path="p/:projectId/ajustes" element={<ProjectSettings />} />
              <Route path="ajustes" element={<SettingsPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        )}
        <Toaster
          position="bottom-center"
          theme={theme === 'system' ? 'system' : theme}
          offset={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}
          toastOptions={{
            style: { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: '14px', fontFamily: 'inherit' },
          }}
        />
      </BrowserRouter>
    </MotionConfig>
  )
}
