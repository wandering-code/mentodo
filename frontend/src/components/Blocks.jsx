import { useEffect, useState } from 'react'
import { mergeAttributes, Node } from '@tiptap/core'
import CodeBlock from '@tiptap/extension-code-block'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { Check, Copy, ExternalLink, Eye, EyeOff, KeyRound, Lock, Pencil, Trash2, Wand2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { generatePassword, openSecret, sealSecret, useVault } from '../lib/vault'
import { copy, VaultDialog } from './VaultDialog'
import { Button, cx, IconButton, Input, Modal } from './ui'

/* ── Bloque de código con botón «Copiar» ─────────────────────────────────── */

function CodeView({ node }) {
  const [done, setDone] = useState(false)
  return (
    <NodeViewWrapper className="group/code relative">
      <pre>
        <NodeViewContent as="code" />
      </pre>
      <button
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={async () => {
          await copy(node.textContent, 'Código copiado')
          setDone(true)
          setTimeout(() => setDone(false), 1400)
        }}
        className="absolute right-2 top-2 inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2 text-[12px] text-muted opacity-0 shadow-soft transition-opacity hover:text-ink group-hover/code:opacity-100 max-sm:opacity-100"
      >
        {done ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
        {done ? 'Copiado' : 'Copiar'}
      </button>
    </NodeViewWrapper>
  )
}

export const CodeBlockWithCopy = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeView)
  },
})

/* ── Bloque «Secreto» ────────────────────────────────────────────────────── */

const EMPTY = { user: '', password: '', url: '', notes: '' }

function Field({ label, value, secret, onCopy, href }) {
  const [show, setShow] = useState(false)
  if (!value) return null
  return (
    <div className="flex min-h-9 items-center gap-2 border-t border-line px-3 first:border-t-0">
      <span className="w-24 shrink-0 text-[12.5px] text-faint">{label}</span>
      <span className={cx('min-w-0 flex-1 truncate text-[14px]', secret && !show && 'tracking-[0.2em]')}>{secret && !show ? '••••••••••' : value}</span>
      {secret && (
        <IconButton size="sm" label={show ? 'Ocultar' : 'Ver'} onClick={() => setShow((v) => !v)}>
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </IconButton>
      )}
      {href && (
        <a href={/^https?:\/\//.test(value) ? value : `https://${value}`} target="_blank" rel="noreferrer">
          <IconButton size="sm" label="Abrir">
            <ExternalLink size={14} />
          </IconButton>
        </a>
      )}
      <IconButton size="sm" label={`Copiar ${label.toLowerCase()}`} onClick={() => onCopy(value, label)}>
        <Copy size={14} />
      </IconButton>
    </div>
  )
}

function SecretView({ node, updateAttributes, deleteNode, editor }) {
  const { label, iv, ct } = node.attrs
  const key = useVault((v) => v.key)
  const restoring = useVault((v) => v.restoring)
  const hasVault = useStore((s) => !!s.user?.vault_salt)
  const [data, setData] = useState(null)
  const [editing, setEditing] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [form, setForm] = useState({ label: '', ...EMPTY })
  const [showPass, setShowPass] = useState(false)
  const editable = editor.isEditable

  // Descifrar al tener la clave
  useEffect(() => {
    let alive = true
    setData(null)
    if (key && ct) openSecret({ iv, ct }).then((d) => alive && setData(d)).catch(() => alive && setData({ broken: true }))
    return () => {
      alive = false
    }
  }, [key, iv, ct])

  // Bloque recién insertado: abrir el formulario directamente
  useEffect(() => {
    if (!ct && key && editable) startEdit()
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => {
    setForm({ label: label || '', ...EMPTY, ...(data && !data.broken ? data : {}) })
    setShowPass(false)
    setEditing(true)
  }
  const save = async (e) => {
    e.preventDefault()
    const { label: l, ...rest } = form
    const sealed = await sealSecret(rest)
    updateAttributes({ label: l.trim() || 'Secreto', ...sealed })
    setEditing(false)
  }
  const doCopy = (value, what) => copy(value, `${what} copiado`)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <NodeViewWrapper className="not-prose my-3" contentEditable={false} data-secret>
      <div className="overflow-hidden rounded-xl border border-line bg-[color-mix(in_oklab,var(--sunken)_55%,var(--surface))]">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="grid size-7 place-items-center rounded-lg bg-accent-soft text-accent">
            <KeyRound size={15} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{label || 'Secreto nuevo'}</span>
          {key && ct && editable && (
            <IconButton size="sm" label="Editar" onClick={startEdit}>
              <Pencil size={14} />
            </IconButton>
          )}
          {editable && (
            <IconButton size="sm" label="Borrar secreto" onClick={() => confirm('¿Borrar este secreto?') && deleteNode()}>
              <Trash2 size={14} />
            </IconButton>
          )}
        </div>
        <div className="border-t border-line bg-surface">
          {!key ? (
            <button
              onClick={() => setDialog(true)}
              disabled={restoring}
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-[14px] text-muted hover:text-ink"
            >
              <Lock size={15} /> {hasVault ? 'Desbloquear para ver' : 'Crea tu bóveda para guardar secretos'}
            </button>
          ) : data?.broken ? (
            <p className="px-3 py-3 text-[13.5px] text-danger">No se puede descifrar con esta bóveda.</p>
          ) : data ? (
            <div>
              <Field label="Usuario" value={data.user} onCopy={doCopy} />
              <Field label="Contraseña" value={data.password} secret onCopy={doCopy} />
              <Field label="URL" value={data.url} href onCopy={doCopy} />
              {data.notes && <p className="whitespace-pre-wrap border-t border-line px-3 py-2 text-[13.5px] text-muted">{data.notes}</p>}
            </div>
          ) : !ct ? (
            <button onClick={startEdit} className="w-full px-3 py-3 text-left text-[14px] text-muted hover:text-ink">
              Rellenar…
            </button>
          ) : (
            <p className="px-3 py-3 text-[13.5px] text-faint">Descifrando…</p>
          )}
        </div>
      </div>

      <VaultDialog open={dialog} onClose={() => setDialog(false)} />
      <Modal open={editing} onClose={() => setEditing(false)}>
        <form onSubmit={save} className="flex flex-col gap-2">
          <h2 className="mb-1 text-[17px] font-semibold tracking-[-0.01em]">Secreto</h2>
          <Input autoFocus placeholder="Nombre (p. ej. «Correo de la empresa»)" value={form.label} onChange={set('label')} />
          <Input placeholder="Usuario o correo" autoComplete="off" value={form.user} onChange={set('user')} />
          <div className="flex gap-1.5">
            <Input type={showPass ? 'text' : 'password'} placeholder="Contraseña" autoComplete="new-password" value={form.password} onChange={set('password')} />
            <IconButton type="button" label={showPass ? 'Ocultar' : 'Ver'} onClick={() => setShowPass((v) => !v)} className="size-11 sm:size-10">
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </IconButton>
            <IconButton
              type="button"
              label="Generar contraseña"
              onClick={() => {
                setForm((f) => ({ ...f, password: generatePassword() }))
                setShowPass(true)
              }}
              className="size-11 sm:size-10"
            >
              <Wand2 size={16} />
            </IconButton>
          </div>
          <Input placeholder="URL (opcional)" value={form.url} onChange={set('url')} />
          <textarea
            placeholder="Notas (opcional)"
            value={form.notes}
            onChange={set('notes')}
            rows={3}
            className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-[16px] outline-none placeholder:text-faint sm:text-[15px]"
          />
          <p className="text-[12px] text-faint">Se cifra en este dispositivo antes de guardarse.</p>
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button variant="primary">Guardar</Button>
          </div>
        </form>
      </Modal>
    </NodeViewWrapper>
  )
}

export const SecretNode = Node.create({
  name: 'secret',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() {
    return { label: { default: '' }, iv: { default: null }, ct: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'div[data-secret]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-secret': '' })]
  },
  addNodeView() {
    return ReactNodeViewRenderer(SecretView)
  },
})
