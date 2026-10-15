import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Placeholder } from '@tiptap/extensions'

/* Editor de contenido estilo bloques: markdown al escribir (#, -, [ ], >, ```),
   guardado con retardo para no mandar una petición por tecla. */
export function Editor({ cardId, content, onSave }) {
  const timer = useRef(null)
  const latest = useRef(null)
  const saveRef = useRef(onSave)
  saveRef.current = onSave

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: true, autolink: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Escribe notas, pega enlaces o usa [ ] para una lista de pasos…' }),
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
  }, [cardId])

  // Al cambiar de tarjeta o cerrar, se guarda lo pendiente en el momento
  useEffect(() => {
    return () => {
      clearTimeout(timer.current)
      if (latest.current) saveRef.current(latest.current)
    }
  }, [cardId])

  // Cambios que llegan de otro dispositivo, solo si aquí no se está escribiendo
  useEffect(() => {
    if (!editor || editor.isFocused || latest.current) return
    const incoming = JSON.stringify(content || null)
    if (incoming !== JSON.stringify(editor.getJSON())) editor.commands.setContent(content || '', { emitUpdate: false })
  }, [content, editor])

  return <EditorContent editor={editor} />
}
