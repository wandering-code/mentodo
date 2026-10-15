import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Hourglass } from 'lucide-react'
import { ApiError, post } from '../lib/api'
import { useStore } from '../lib/store'
import { Logo, Wordmark } from '../components/Logo'
import { Button, Collapse, cx, Input, spring } from '../components/ui'

export function AuthPage() {
  const [mode, setMode] = useState('login') // login | register | pending
  const [form, setForm] = useState({ username: '', display_name: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const bootstrap = useStore((s) => s.bootstrap)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await post('/auth/login', { username: form.username, password: form.password })
        await bootstrap()
      } else {
        await post('/auth/register', form)
        setMode('pending')
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && /pendiente/.test(err.message)) setMode('pending')
      else setError(err.message)
    }
    setBusy(false)
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-5 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 size-[520px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,#aec99a_38%,transparent),transparent)] blur-2xl" />
        <div className="absolute -bottom-48 -right-32 size-[560px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--accent)_16%,transparent),transparent)] blur-2xl" />
      </div>
      <div className="entra relative w-full max-w-[380px]" style={{ '--entra-desde': 'translateY(14px)', '--entra-dura': '600ms' }}>
        <div className="mb-9 flex flex-col items-center">
          <div className="entra" style={{ '--entra-desde': 'scale(0.8) rotate(-8deg)', '--entra-dura': '700ms', '--entra-espera': '80ms' }}>
            <Logo size={64} className="drop-shadow-[0_10px_24px_rgb(31_50_40/0.28)]" />
          </div>
          <Wordmark height={30} className="mt-5" />
          <p className="mt-2.5 text-[14.5px] text-muted">Tu mente. Todo en orden.</p>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {mode === 'pending' ? (
            <motion.div key="pending" initial={{ opacity: 0, transform: 'scale(0.97)' }} animate={{ opacity: 1, transform: 'scale(1)' }} exit={{ opacity: 0 }} className="rounded-2xl border border-line bg-surface p-6 text-center shadow-soft">
              <div className="mx-auto mb-3 grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Hourglass size={20} />
              </div>
              <div className="text-[15.5px] font-semibold">Cuenta pendiente de aprobación</div>
              <p className="mt-1.5 text-[14px] text-muted">En cuanto se apruebe podrás entrar con tu usuario y contraseña.</p>
              <Button variant="ghost" className="mt-4" onClick={() => setMode('login')}>
                Volver a iniciar sesión
              </Button>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-5 grid grid-cols-2 rounded-xl bg-sunken p-1">
                {[
                  ['login', 'Entrar'],
                  ['register', 'Crear cuenta'],
                ].map(([m, t]) => (
                  <button
                    key={m}
                    onClick={() => (setMode(m), setError(''))}
                    className={cx('relative h-9 rounded-lg text-[13.5px] font-medium transition-colors', mode === m ? 'text-ink' : 'text-muted hover:text-ink')}
                  >
                    {mode === m && <motion.span layoutId="auth-pill" transition={spring} className="absolute inset-0 rounded-lg bg-surface shadow-soft" />}
                    <span className="relative">{t}</span>
                  </button>
                ))}
              </div>
              <form onSubmit={submit} className="flex flex-col gap-2.5">
                <Input autoFocus placeholder="Usuario" autoCapitalize="none" autoComplete="username" value={form.username} onChange={set('username')} className="h-11" />
                <Collapse open={mode === 'register'} className="-m-1 p-1">
                  <Input placeholder="Tu nombre" value={form.display_name} onChange={set('display_name')} className="h-11" />
                </Collapse>
                <Input
                  type="password"
                  placeholder={mode === 'register' ? 'Contraseña (mín. 8 caracteres)' : 'Contraseña'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  value={form.password}
                  onChange={set('password')}
                  className="h-11"
                />
                <AnimatePresence>
                  {error && (
                    <motion.p initial={{ opacity: 0, transform: 'translateY(-4px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} exit={{ opacity: 0 }} className="px-1 text-[13.5px] text-danger">
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
                <Button variant="primary" size="lg" className="mt-2" disabled={busy || !form.username || !form.password || (mode === 'register' && !form.display_name)}>
                  {mode === 'login' ? 'Entrar' : 'Solicitar acceso'} <ArrowRight size={16} />
                </Button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
