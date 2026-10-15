import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { formatDistanceToNowStrict } from 'date-fns'
import { es } from 'date-fns/locale'
import { Check, Trash2, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { del, get, post } from '../lib/api'
import { useStore } from '../lib/store'
import { Avatar } from '../components/Sidebar'
import { Button, cx, IconButton } from '../components/ui'

const STATUS = {
  pending: { name: 'Pendiente', cls: 'bg-[color-mix(in_oklab,#c99a1c_18%,transparent)] text-[#a67c12]' },
  approved: { name: 'Aprobada', cls: 'bg-accent-soft text-accent' },
  rejected: { name: 'Rechazada', cls: 'bg-sunken text-muted' },
}

export function AdminPage() {
  const me = useStore((s) => s.user)
  const [users, setUsers] = useState([])
  const load = useCallback(() => get('/admin/users').then(setUsers).catch(() => {}), [])
  useEffect(() => {
    load()
    window.addEventListener('mentodo:admin', load)
    return () => window.removeEventListener('mentodo:admin', load)
  }, [load])

  const act = async (u, action) => {
    try {
      if (action === 'delete') {
        if (!confirm(`¿Borrar la cuenta de ${u.display_name} y todos sus datos?`)) return
        await del(`/admin/users/${u.id}`)
      } else await post(`/admin/users/${u.id}/${action}`)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (!me?.is_admin) return null
  const pending = users.filter((u) => u.status === 'pending')
  const rest = users.filter((u) => u.status !== 'pending')

  const Row = ({ u }) => (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-hover">
      <Avatar user={u} size={34} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-medium">
          {u.display_name} {u.is_admin && <span className="ml-1 text-[12px] font-normal text-faint">admin</span>}
        </div>
        <div className="truncate text-[12.5px] text-faint">
          @{u.username} · hace {formatDistanceToNowStrict(new Date(u.created_at), { locale: es })}
        </div>
      </div>
      <span className={cx('rounded-md px-2 py-0.5 text-[12px] font-medium', STATUS[u.status].cls)}>{STATUS[u.status].name}</span>
      {u.id !== me.id && (
        <div className="flex items-center gap-1">
          {u.status !== 'approved' && (
            <Button size="sm" variant="primary" onClick={() => act(u, 'approve')}>
              <Check size={14} /> Aprobar
            </Button>
          )}
          {u.status === 'pending' && (
            <IconButton size="sm" label="Rechazar" onClick={() => act(u, 'reject')}>
              <UserX size={15} />
            </IconButton>
          )}
          {u.status !== 'pending' && (
            <IconButton size="sm" label="Borrar cuenta" onClick={() => act(u, 'delete')}>
              <Trash2 size={15} />
            </IconButton>
          )}
        </div>
      )}
    </motion.div>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-14 sm:px-8 lg:pt-12">
      <h1 className="text-[30px] font-semibold tracking-[-0.03em]">Administración</h1>
      <p className="mt-1.5 text-[15px] text-muted">Las cuentas nuevas no pueden entrar hasta que las apruebes.</p>
      {pending.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-[13px] font-medium uppercase tracking-wide text-faint">Pendientes de aprobar</h2>
          <AnimatePresence>
            {pending.map((u) => (
              <Row key={u.id} u={u} />
            ))}
          </AnimatePresence>
        </>
      )}
      <h2 className="mb-2 mt-8 text-[13px] font-medium uppercase tracking-wide text-faint">Cuentas</h2>
      <AnimatePresence>
        {rest.map((u) => (
          <Row key={u.id} u={u} />
        ))}
      </AnimatePresence>
    </div>
  )
}
