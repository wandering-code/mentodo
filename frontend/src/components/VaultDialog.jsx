import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { useStore } from '../lib/store'
import { createVault, unlockVault, vaultSupported } from '../lib/vault'
import { Button, Input, Modal, Toggle } from './ui'

export async function copy(text, what = 'Copiado') {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(what)
  } catch {
    toast.error('No se pudo copiar')
  }
}

/* ── Diálogo de la bóveda: crear o desbloquear ───────────────────────────── */

export function VaultDialog({ open, onClose, onDone }) {
  const user = useStore((s) => s.user)
  const creating = !user?.vault_salt
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [keep, setKeep] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setPass('')
      setPass2('')
      setError('')
    }
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (creating && pass.length < 10) return setError('Usa al menos 10 caracteres (mejor una frase: «mi gato duerme en la terraza»)')
    if (creating && pass !== pass2) return setError('Las dos frases no coinciden')
    setBusy(true)
    try {
      if (creating) await createVault(pass, keep)
      else await unlockVault(pass, keep)
      onClose()
      onDone?.()
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <Modal open={open} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="mb-3 grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">
          <KeyRound size={20} />
        </div>
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{creating ? 'Crea tu bóveda' : 'Desbloquear secretos'}</h2>
        <p className="mt-1 text-[13.5px] text-muted">
          {creating
            ? 'Tus contraseñas se cifran en este dispositivo con una frase maestra que solo tú sabes. Ni el servidor puede leerlas. Si la olvidas, no se pueden recuperar: apúntala en un sitio seguro.'
            : 'Escribe tu frase maestra para ver y copiar tus secretos.'}
        </p>
        {!vaultSupported() ? (
          <p className="mt-4 text-[13.5px] text-danger">Los secretos necesitan HTTPS: ábrelo desde mentodo.wanderingcode.dev.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            <Input type="password" autoFocus autoComplete={creating ? 'new-password' : 'current-password'} placeholder="Frase maestra" value={pass} onChange={(e) => setPass(e.target.value)} />
            {creating && <Input type="password" autoComplete="new-password" placeholder="Repítela" value={pass2} onChange={(e) => setPass2(e.target.value)} />}
            <label className="mt-1 flex items-center gap-3 text-[14px]">
              <span className="flex-1">
                Recordar en este dispositivo
                <span className="block text-[12.5px] text-faint">No te la volverá a pedir aquí hasta que bloquees la bóveda.</span>
              </span>
              <Toggle checked={keep} onChange={setKeep} label="Recordar en este dispositivo" />
            </label>
            {error && <p className="text-[13.5px] text-danger">{error}</p>}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={busy || !pass || !vaultSupported()}>
            {busy ? 'Un momento…' : creating ? 'Crear bóveda' : 'Desbloquear'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

