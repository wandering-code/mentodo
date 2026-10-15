import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, File, FileText, ImageIcon, Paperclip, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { ARRIVE, css, LEAVE, useBackToClose, usePresence } from '../lib/layers'
import { cx, IconButton, Scrim } from './ui'

export const fileUrl = (a, download) => `/api/attachments/${a.id}/file${download ? '?download=1' : ''}`
const isImage = (a) => a.mime.startsWith('image/') && !a.mime.includes('svg')
const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`)

/* Subir archivos (botón, arrastrar o pegar) a una tarjeta o a un apunte */
export function useUploader(target) {
  const upload = useStore((s) => s.uploadAttachment)
  const [busy, setBusy] = useState(0)
  const send = async (files) => {
    const list = [...files].filter(Boolean)
    if (!list.length) return
    setBusy((n) => n + list.length)
    await Promise.all(list.map((f) => upload(f, target).finally(() => setBusy((n) => n - 1))))
  }
  // Props para el contenedor que acepta archivos soltados o pegados
  const dropProps = {
    onDragOver: (e) => {
      if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault()
    },
    onDrop: (e) => {
      if (!e.dataTransfer?.files?.length) return
      e.preventDefault()
      send(e.dataTransfer.files)
    },
    onPaste: (e) => {
      const files = [...(e.clipboardData?.files || [])]
      if (!files.length) return
      e.preventDefault()
      send(files)
    },
  }
  return { send, busy, dropProps }
}

export function Attachments({ cardId, noteId }) {
  const all = useStore((s) => s.attachments)
  const remove = useStore((s) => s.deleteAttachment)
  const list = useMemo(
    () => Object.values(all).filter((a) => (cardId ? a.card_id === cardId : a.note_id === noteId)).sort((a, b) => a.id - b.id),
    [all, cardId, noteId],
  )
  const { send, busy } = useUploader(cardId ? { card_id: cardId } : { note_id: noteId })
  const input = useRef(null)
  const [viewer, setViewer] = useState(null)
  const images = list.filter(isImage)
  const files = list.filter((a) => !isImage(a))

  return (
    <div className="mt-5">
      {(list.length > 0 || busy > 0) && (
        <div className="mb-1 flex items-center gap-1.5 px-2 text-[12.5px] font-medium text-muted">
          <Paperclip size={13} /> Adjuntos{list.length ? ` · ${list.length}` : ''}
          {busy > 0 && <span className="font-normal text-faint">· subiendo {busy}…</span>}
        </div>
      )}
      {images.length > 0 && (
        <div className="mb-2 grid grid-cols-3 gap-2 px-1 sm:grid-cols-4">
          {images.map((a) => (
            <div key={a.id} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-sunken">
              <button onClick={() => setViewer(a)} className="block size-full">
                <img src={fileUrl(a)} alt={a.filename} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              </button>
              <button
                onClick={() => confirm(`¿Borrar «${a.filename}»?`) && remove(a.id)}
                aria-label="Borrar"
                className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-lg bg-black/45 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 max-sm:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {files.map((a) => (
        <div key={a.id} className="group flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-hover">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sunken text-muted">
            {a.mime === 'application/pdf' || a.mime.startsWith('text/') ? <FileText size={17} /> : <File size={17} />}
          </span>
          <a href={fileUrl(a)} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
            <span className="block truncate text-[14px]">{a.filename}</span>
            <span className="block text-[12px] text-faint">{fmtSize(a.size)}</span>
          </a>
          <a href={fileUrl(a, true)} download>
            <IconButton size="sm" label="Descargar">
              <Download size={15} />
            </IconButton>
          </a>
          <IconButton size="sm" label="Borrar" onClick={() => confirm(`¿Borrar «${a.filename}»?`) && remove(a.id)} className="opacity-0 group-hover:opacity-100 max-sm:opacity-100">
            <Trash2 size={14} />
          </IconButton>
        </div>
      ))}
      <button onClick={() => input.current?.click()} className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13.5px] text-faint transition-colors hover:bg-hover hover:text-muted">
        <Paperclip size={14} /> Adjuntar archivo
        <span className="hidden text-[12px] sm:inline">· o arrástralo / pégalo aquí</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          send(e.target.files)
          e.target.value = ''
        }}
      />
      <ImageViewer images={images} current={viewer} onChange={setViewer} onClose={() => setViewer(null)} />
    </div>
  )
}

/* Visor de imágenes a pantalla completa (flechas para pasar) */
function ImageViewer({ images, current, onChange, onClose }) {
  const last = useRef(current)
  if (current) last.current = current
  const shown = current || last.current
  const { mounted, shown: visible } = usePresence(!!current)
  useBackToClose(!!current, onClose)
  if (!mounted || !shown) return null
  const i = images.findIndex((a) => a.id === shown.id)
  const go = (d) => images.length > 1 && onChange(images[(i + d + images.length) % images.length])
  return createPortal(
    <>
      <Scrim shown={visible} onClick={onClose} z="z-[85]" strong />
      <div
        className="fixed inset-0 z-[85] flex flex-col items-center justify-center p-4 pt-[max(16px,env(safe-area-inset-top))]"
        onClick={onClose}
        onKeyDown={(e) => (e.key === 'ArrowRight' ? go(1) : e.key === 'ArrowLeft' ? go(-1) : null)}
        tabIndex={-1}
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'scale(0.97)', transition: css(visible ? ARRIVE : LEAVE) }}
      >
        <img src={fileUrl(shown)} alt={shown.filename} onClick={(e) => (e.stopPropagation(), go(1))} className="max-h-[82vh] max-w-full rounded-xl object-contain shadow-float" />
        <div className="mt-3 flex items-center gap-2 text-[13px] text-white/85" onClick={(e) => e.stopPropagation()}>
          <ImageIcon size={14} />
          <span className="max-w-[60vw] truncate">{shown.filename}</span>
          {images.length > 1 && (
            <span className="text-white/60">
              {i + 1}/{images.length}
            </span>
          )}
          <a href={fileUrl(shown, true)} download className="ml-2 inline-flex items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 hover:bg-white/25">
            <Download size={13} /> Descargar
          </a>
        </div>
      </div>
    </>,
    document.body,
  )
}
