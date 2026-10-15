import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '../lib/store'
import { PROJECT_ICONS } from '../lib/palette'
import { Button, cx, Input, Modal } from './ui'

export function NewProjectModal({ open, onClose }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📁')
  const [busy, setBusy] = useState(false)
  const createProject = useStore((s) => s.createProject)
  const nav = useNavigate()

  useEffect(() => {
    if (open) {
      setName('')
      setIcon(PROJECT_ICONS[Math.floor(Math.random() * 8)])
    }
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    const p = await createProject({ name: name.trim(), icon })
    setBusy(false)
    if (p) {
      nav(`/p/${p.id}`)
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Nuevo proyecto</h2>
        <p className="mt-1 text-sm text-muted">Empieza con Estado y Prioridad; podrás cambiar las etiquetas cuando quieras.</p>
        <div className="mt-4 flex gap-2">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-sunken text-xl">{icon}</div>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del proyecto" />
        </div>
        <div className="mt-3 grid grid-cols-10 gap-1">
          {PROJECT_ICONS.map((i) => (
            <button
              type="button"
              key={i}
              onClick={() => setIcon(i)}
              className={cx('grid aspect-square place-items-center rounded-lg text-lg transition-colors', icon === i ? 'bg-accent-soft' : 'hover:bg-hover')}
            >
              {i}
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={!name.trim() || busy}>
            Crear proyecto
          </Button>
        </div>
      </form>
    </Modal>
  )
}
