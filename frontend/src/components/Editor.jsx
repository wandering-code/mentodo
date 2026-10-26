import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Extension } from '@tiptap/core'
import { EditorContent, ReactRenderer, useEditor, useEditorState } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { Placeholder } from '@tiptap/extensions'
import Suggestion from '@tiptap/suggestion'
import {
  Bold, ChevronDown, Code, Heading1, Heading2, Heading3, Italic, Link2, List, ListChecks, ListOrdered, Minus, Quote, SquareCode,
  Strikethrough, Type, Underline, KeyRound,
} from 'lucide-react'
import { cx, shortcut } from './ui'
import { CodeBlockWithCopy, SecretNode } from './Blocks'
import { fixedFrame } from '../lib/layers'

/* Colores del texto y del resaltado: se guardan como variables CSS (no como
   hex) para que cambien solos entre modo claro y oscuro. */
export const TEXT_COLORS = ['gris', 'marron', 'naranja', 'ambar', 'verde', 'azul', 'morado', 'rosa', 'rojo']
const COLOR_NAMES = { gris: 'Gris', marron: 'Marrón', naranja: 'Naranja', ambar: 'Ámbar', verde: 'Verde', azul: 'Azul', morado: 'Morado', rosa: 'Rosa', rojo: 'Rojo' }

const BLOCKS = [
  { id: 'p', name: 'Texto', icon: Type, keys: 'texto parrafo', run: (c) => c.setParagraph() },
  { id: 'h1', name: 'Título grande', icon: Heading1, keys: 'titulo h1 encabezado', run: (c) => c.setHeading({ level: 1 }) },
  { id: 'h2', name: 'Título mediano', icon: Heading2, keys: 'titulo h2 subtitulo', run: (c) => c.setHeading({ level: 2 }) },
  { id: 'h3', name: 'Título pequeño', icon: Heading3, keys: 'titulo h3', run: (c) => c.setHeading({ level: 3 }) },
  { id: 'ul', name: 'Lista', icon: List, keys: 'lista viñetas', run: (c) => c.toggleBulletList() },
  { id: 'ol', name: 'Lista numerada', icon: ListOrdered, keys: 'lista numerada', run: (c) => c.toggleOrderedList() },
  { id: 'task', name: 'Casillas', icon: ListChecks, keys: 'casillas tareas checklist pasos', run: (c) => c.toggleTaskList() },
  { id: 'quote', name: 'Cita', icon: Quote, keys: 'cita', run: (c) => c.toggleBlockquote() },
  { id: 'code', name: 'Código', icon: SquareCode, keys: 'codigo', run: (c) => c.toggleCodeBlock() },
  { id: 'hr', name: 'Separador', icon: Minus, keys: 'separador linea', run: (c) => c.setHorizontalRule() },
  { id: 'secret', name: 'Secreto', icon: KeyRound, keys: 'secreto contraseña password clave cuenta usuario', run: (c) => c.insertContent({ type: 'secret' }) },
]

const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/* ── Menú "/" ─────────────────────────────────────────────────────────────── */

const isTouch = () => window.matchMedia('(pointer: coarse)').matches
const STRIP_H = 58

const SlashList = forwardRef(function SlashList({ items, command, strip }, ref) {
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [items])
  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false
      if (event.key === 'ArrowDown') return setIndex((i) => (i + 1) % items.length), true
      if (event.key === 'ArrowUp') return setIndex((i) => (i - 1 + items.length) % items.length), true
      if (event.key === 'Enter') return command(items[index]), true
      return false
    },
  }))
  if (!items.length) return null
  if (strip) {
    // Táctil: una sola fila, deslizable de lado. Tan baja que siempre cabe
    // justo encima de la línea, con el teclado abierto o no.
    return (
      <div className="entra flex gap-1.5 overflow-x-auto touch-pan-x overflow-y-hidden overscroll-x-contain rounded-2xl border border-line bg-surface p-1.5 shadow-float [scrollbar-width:none]" style={{ "--entra-desde": "translateY(6px)", "--entra-dura": "200ms" }}>
        {items.map((it, i) => (
          <button
            key={it.id}
            onMouseDown={(e) => (e.preventDefault(), command(it))}
            className={cx(
              'flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-[14.5px] active:bg-hover',
              i === index ? 'bg-hover text-ink' : 'text-ink',
            )}
          >
            <it.icon size={17} className="text-muted" />
            {it.name}
          </button>
        ))}
      </div>
    )
  }
  return (
    <div className="max-h-[inherit] w-60 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface p-1.5 shadow-float">
      <div className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-medium uppercase tracking-wide text-faint">Bloques</div>
      {items.map((it, i) => (
        <button
          key={it.id}
          ref={i === index ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
          onMouseDown={(e) => (e.preventDefault(), command(it))}
          onMouseEnter={() => setIndex(i)}
          className={cx('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[14px]', i === index && 'bg-hover')}
        >
          <span className="grid size-7 place-items-center rounded-md border border-line bg-bg text-muted">
            <it.icon size={15} />
          </span>
          {it.name}
        </button>
      ))}
    </div>
  )
})

const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        items: ({ query }) => BLOCKS.filter((b) => !query || norm(b.name).includes(norm(query)) || b.keys.includes(norm(query))),
        command: ({ editor, range, props }) => props.run(editor.chain().focus().deleteRange(range)).run(),
        render: () => {
          let comp
          let rectFn = null
          let strip = false
          let host = null // táctil: el contenedor del editor, donde va la tira
          // Se coloca dentro de lo que DE VERDAD se ve: en el móvil, con el
          // teclado abierto, eso es el visualViewport (no window.innerHeight,
          // que no encoge con el teclado). Pegado a la línea, debajo si cabe;
          // si no cabe entero, se ajusta al hueco y se desplaza por dentro.
          const place = () => {
            const r = rectFn?.()
            if (!r || !comp) return
            const el = comp.element
            const f = fixedFrame()
            if (strip && host) {
              // La tira va DENTRO del contenido de las notas (absolute en su
              // contenedor), no flotando sobre la pantalla: su distancia a la
              // línea es una resta entre dos medidas del mismo sistema, así
              // que no depende de cómo desplace Safari la vista con el
              // teclado abierto. Se mueve con el texto, como si fuera parte de él.
              const h = host.getBoundingClientRect()
              const up = r.top - STRIP_H - 8 >= f.top + 4
              const y = (up ? r.top - STRIP_H - 8 : r.bottom + 8) - h.top
              Object.assign(el.style, { position: 'absolute', zIndex: 30, left: '-4px', right: '-4px', top: `${y}px` })
              return
            }
            const below = f.top + f.height - r.bottom - 10
            const above = r.top - f.top - 10
            const down = below >= 220 || below >= above
            const maxH = Math.max(120, Math.min(420, down ? below : above))
            const width = 240
            const left = Math.max(f.left + 8, Math.min(r.left, f.left + f.width - width - 8))
            Object.assign(el.style, {
              position: 'fixed',
              zIndex: 90,
              maxHeight: `${maxH}px`,
              left: `${f.x(left)}px`,
              top: down ? `${f.y(r.bottom + 6)}px` : 'auto',
              // Hacia arriba se ancla por abajo: pegado a la línea mida lo que mida
              bottom: down ? 'auto' : `${document.documentElement.clientHeight - f.y(r.top - 6)}px`,
            })
          }
          const onViewport = () => place()
          return {
            onStart: (props) => {
              strip = isTouch()
              comp = new ReactRenderer(SlashList, { props: { ...props, strip }, editor: props.editor })
              rectFn = props.clientRect
              host = strip ? props.editor.view.dom.parentElement : null
              if (host) {
                if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
                host.appendChild(comp.element)
              } else document.body.appendChild(comp.element)
              place()
              window.visualViewport?.addEventListener('resize', onViewport)
              window.visualViewport?.addEventListener('scroll', onViewport)
            },
            onUpdate: (props) => {
              comp?.updateProps({ ...props, strip })
              rectFn = props.clientRect
              place()
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                comp?.element.remove()
                return true
              }
              return comp?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              window.visualViewport?.removeEventListener('resize', onViewport)
              window.visualViewport?.removeEventListener('scroll', onViewport)
              comp?.element.remove()
              comp?.destroy()
              comp = null
            },
          }
        },
      }),
    ]
  },
})

/* ── Tab escribe una tabulación ──────────────────────────────────────────────
   Va con prioridad baja: las listas (sangrar/quitar sangría) y el bloque de
   código (sangrar con espacios) se quedan antes con la tecla. Si nadie la
   usa, en vez de saltar al siguiente campo se escribe una tabulación. */
const TabKey = Extension.create({
  name: 'tabKey',
  priority: 50,
  addKeyboardShortcuts() {
    const inText = () => this.editor.state.selection.$from.parent.inlineContent
    return {
      Tab: () => inText() && this.editor.commands.insertContent('\t'),
      'Shift-Tab': () => {
        const { $from, empty } = this.editor.state.selection
        if (!inText()) return false
        // Borra la tabulación justo antes del cursor, si la hay
        if (empty && $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset) === '\t')
          this.editor.commands.deleteRange({ from: $from.pos - 1, to: $from.pos })
        return true
      },
    }
  },
})

/* ── Barra flotante al seleccionar texto ──────────────────────────────────── */

function Btn({ active, onClick, label, children }) {
  return (
    <button
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx('grid h-8 min-w-8 place-items-center rounded-lg px-1.5 transition-colors', active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-hover hover:text-ink')}
    >
      {children}
    </button>
  )
}

function FormatBar({ editor }) {
  const [panel, setPanel] = useState(null) // 'block' | 'color' | 'link'
  const [url, setUrl] = useState('')
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      link: e.isActive('link'),
      color: e.getAttributes('textStyle').color,
      highlight: e.getAttributes('highlight').color,
      block: BLOCKS.find((b) => b.id !== 'p' && b.id !== 'hr' && isBlock(e, b.id))?.name || 'Texto',
    }),
  })
  const chain = () => editor.chain().focus()

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-float" onMouseDown={(e) => e.target.tagName !== 'INPUT' && e.preventDefault()}>
      <div className="flex items-center gap-0.5 p-1">
        <button
          onClick={() => setPanel((p) => (p === 'block' ? null : 'block'))}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] text-ink transition-colors hover:bg-hover"
        >
          {st.block} <ChevronDown size={13} className="text-faint" />
        </button>
        <span className="mx-0.5 h-5 w-px bg-line" />
        <Btn label={`Negrita (${shortcut('B')})`} active={st.bold} onClick={() => chain().toggleBold().run()}>
          <Bold size={15} />
        </Btn>
        <Btn label={`Cursiva (${shortcut('I')})`} active={st.italic} onClick={() => chain().toggleItalic().run()}>
          <Italic size={15} />
        </Btn>
        <Btn label={`Subrayado (${shortcut('U')})`} active={st.underline} onClick={() => chain().toggleUnderline().run()}>
          <Underline size={15} />
        </Btn>
        <Btn label="Tachado" active={st.strike} onClick={() => chain().toggleStrike().run()}>
          <Strikethrough size={15} />
        </Btn>
        <Btn label="Código" active={st.code} onClick={() => chain().toggleCode().run()}>
          <Code size={15} />
        </Btn>
        <Btn
          label="Enlace"
          active={st.link || panel === 'link'}
          onClick={() => {
            setUrl(editor.getAttributes('link').href || '')
            setPanel((p) => (p === 'link' ? null : 'link'))
          }}
        >
          <Link2 size={15} />
        </Btn>
        <span className="mx-0.5 h-5 w-px bg-line" />
        <Btn label="Color y resaltado" active={panel === 'color'} onClick={() => setPanel((p) => (p === 'color' ? null : 'color'))}>
          <span
            className="grid size-5 place-items-center rounded text-[13px] font-semibold"
            style={{ color: st.color || 'var(--ink)', background: st.highlight || 'transparent', boxShadow: st.highlight ? 'none' : 'inset 0 0 0 1px var(--line)' }}
          >
            A
          </span>
        </Btn>
      </div>

      {panel === 'block' && (
        <div className="grid grid-cols-2 gap-0.5 border-t border-line p-1 sm:grid-cols-3">
          {BLOCKS.filter((b) => b.id !== 'hr' && b.id !== 'secret').map((b) => (
            <button
              key={b.id}
              onClick={() => {
                b.run(chain()).run()
                setPanel(null)
              }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-hover"
            >
              <b.icon size={14} className="text-muted" /> {b.name}
            </button>
          ))}
        </div>
      )}

      {panel === 'color' && (
        <div className="border-t border-line p-2">
          <div className="px-0.5 pb-1.5 text-[11.5px] font-medium uppercase tracking-wide text-faint">Texto</div>
          <div className="flex flex-wrap gap-1">
            <Swatch label="Por defecto" active={!st.color} onClick={() => chain().unsetColor().run()}>
              <span className="text-[13px] font-semibold text-ink">A</span>
            </Swatch>
            {TEXT_COLORS.map((c) => (
              <Swatch key={c} label={COLOR_NAMES[c]} active={st.color === `var(--tc-${c})`} onClick={() => chain().setColor(`var(--tc-${c})`).run()}>
                <span className="text-[13px] font-semibold" style={{ color: `var(--tc-${c})` }}>
                  A
                </span>
              </Swatch>
            ))}
          </div>
          <div className="px-0.5 pb-1.5 pt-2.5 text-[11.5px] font-medium uppercase tracking-wide text-faint">Resaltado</div>
          <div className="flex flex-wrap gap-1">
            <Swatch label="Sin resaltado" active={!st.highlight} onClick={() => chain().unsetHighlight().run()}>
              <span className="size-4 rounded border border-line" />
            </Swatch>
            {TEXT_COLORS.map((c) => (
              <Swatch key={c} label={COLOR_NAMES[c]} active={st.highlight === `var(--hl-${c})`} onClick={() => chain().setHighlight({ color: `var(--hl-${c})` }).run()}>
                <span className="size-4 rounded" style={{ background: `var(--hl-${c})` }} />
              </Swatch>
            ))}
          </div>
        </div>
      )}

      {panel === 'link' && (
        <form
          className="flex items-center gap-1 border-t border-line p-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            const href = url.trim()
            if (!href) chain().extendMarkRange('link').unsetLink().run()
            else chain().extendMarkRange('link').setLink({ href: /^(https?:|mailto:)/.test(href) ? href : `https://${href}` }).run()
            setPanel(null)
          }}
        >
          <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Pega un enlace…" className="h-8 min-w-0 flex-1 rounded-lg bg-sunken px-2.5 text-[13.5px] outline-none placeholder:text-faint" />
          <button className="h-8 rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-ink">OK</button>
        </form>
      )}
    </div>
  )
}

function Swatch({ label, active, onClick, children }) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cx('grid size-8 place-items-center rounded-lg border transition-colors hover:bg-hover', active ? 'border-[var(--accent)]' : 'border-transparent')}
    >
      {children}
    </button>
  )
}

function isBlock(e, id) {
  if (id === 'h1') return e.isActive('heading', { level: 1 })
  if (id === 'h2') return e.isActive('heading', { level: 2 })
  if (id === 'h3') return e.isActive('heading', { level: 3 })
  if (id === 'ul') return e.isActive('bulletList')
  if (id === 'ol') return e.isActive('orderedList')
  if (id === 'task') return e.isActive('taskList')
  if (id === 'quote') return e.isActive('blockquote')
  if (id === 'code') return e.isActive('codeBlock')
  return false
}

/* ── Editor ───────────────────────────────────────────────────────────────── */

/* Editor de contenido estilo bloques: markdown al escribir (#, -, [ ], >, ```),
   barra de formato al seleccionar y menú "/" para insertar bloques. Guarda con
   retardo para no mandar una petición por tecla. */
export function Editor({ cardId, content, onSave, placeholder }) {
  const timer = useRef(null)
  const latest = useRef(null)
  const saveRef = useRef(onSave)
  saveRef.current = onSave

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ link: { openOnClick: true, autolink: true }, codeBlock: false }),
        CodeBlockWithCopy.configure({ enableTabIndentation: true, tabSize: 4 }),
        SecretNode,
        TaskList,
        TaskItem.configure({ nested: true }),
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        Placeholder.configure({ placeholder: placeholder || 'Escribe notas, o pulsa «/» para títulos, listas, casillas…' }),
        SlashCommand,
        TabKey,
      ],
      content: content || '',
      editorProps: { attributes: { class: 'prose-m min-h-[160px] pb-24' } },
      onUpdate: ({ editor }) => {
        latest.current = editor.getJSON()
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          saveRef.current(latest.current)
          latest.current = null
        }, 700)
      },
    },
    [cardId],
  )

  // Al cambiar de tarjeta o cerrar, se guarda lo pendiente en el momento
  useEffect(() => {
    return () => {
      clearTimeout(timer.current)
      if (latest.current) saveRef.current(latest.current)
    }
  }, [cardId])

  // Cambios que llegan de otro dispositivo, solo si aquí no se está escribiendo
  useEffect(() => {
    if (!editor || editor.isDestroyed || editor.isFocused || latest.current) return
    const incoming = JSON.stringify(content || null)
    if (incoming !== JSON.stringify(editor.getJSON())) editor.commands.setContent(content || '', { emitUpdate: false })
  }, [content, editor])

  return (
    <>
      {editor && (
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top-start', offset: 8 }}
          shouldShow={({ editor: e, from, to }) => from !== to && !e.isActive('codeBlock') && !e.isActive('secret')}
          className="z-[80]"
        >
          <FormatBar editor={editor} />
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </>
  )
}
