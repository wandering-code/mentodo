import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { MotionConfig } from 'motion/react'
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
import { NotesPage } from './pages/NotesPage'
import { TodayPage } from './pages/TodayPage'
import { restoreVault } from './lib/vault'

export default function App() {
  const status = useStore((s) => s.status)
  const theme = useStore((s) => s.user?.theme)

  useEffect(() => {
    useStore.getState().bootstrap()
  }, [])

  useEffect(() => {
    if (status === 'ready') {
      startSync()
      restoreVault()
    } else stopSync()
  }, [status])

  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        {status === 'loading' && (
          <div className="grid h-full place-items-center">
            <div className="animate-[latido_1.4s_ease-in-out_infinite]">
              <Logo size={44} />
            </div>
          </div>
        )}
        {status === 'anon' && <AuthPage />}
        {status === 'ready' && (
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<TodoPage />} />
              <Route path="hoy" element={<TodayPage />} />
              <Route path="inbox" element={<InboxPage />} />
              <Route path="apuntes" element={<NotesPage />} />
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
