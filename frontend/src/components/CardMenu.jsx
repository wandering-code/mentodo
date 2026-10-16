import { Copy, CopyPlus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { create } from 'zustand'
import { useStore } from '../lib/store'
import { useCardNav } from '../lib/nav'
import { Divider, MenuItem, Popover } from './ui'

/* Menú de clic derecho de las tarjetas. Un único menú para toda la app: cada
   tarjeta solo avisa de dónde se ha pulsado (cardMenu) y el menú, montado en
   el Shell, se abre ahí. Solo con ratón: en pantallas táctiles la pulsación
   larga es para arrastrar. */
const useCardMenu = create(() => ({ id: null, x: 0, y: 0, seq: 0 }))

const hasMouse = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

export function cardMenu(card) {
  return (e) => {
    if (!card || card.is_template || !hasMouse()) return
    // En un campo de texto, el menú normal (copiar, pegar…)
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
    e.preventDefault()
    e.stopPropagation()
    useCardMenu.setState((s) => ({ id: card.id, x: e.clientX, y: e.clientY, seq: s.seq + 1 }))
  }
}

export function CardContextMenu() {
  const { id, x, y, seq } = useCardMenu()
  // Cada apertura monta un menú nuevo: así se coloca donde se ha pulsado
  // aunque el anterior aún se esté cerrando
  return <Menu key={seq} id={id} x={x} y={y} />
}

function Menu({ id, x, y }) {
  const card = useStore((s) => (id ? s.cards[id] : null))
  const duplicateCard = useStore((s) => s.duplicateCard)
  const deleteCard = useStore((s) => s.deleteCard)
  const { open } = useCardNav()
  const close = () => useCardMenu.setState({ id: null })
  // Ancla «virtual»: un punto en la posición del ratón
  const anchor = { getBoundingClientRect: () => new DOMRect(x, y, 0, 0), contains: () => false }
  const duplicate = async (withContent) => {
    close()
    const c = await duplicateCard(card.id, withContent)
    if (c) toast.success(withContent ? 'Tarjeta duplicada con su contenido' : 'Tarjeta duplicada (solo propiedades)', { action: { label: 'Abrir', onClick: () => open(c) } })
  }
  return (
    <Popover open={!!card} anchor={anchor} onClose={close} width={230}>
      <MenuItem icon={CopyPlus} onClick={() => duplicate(true)}>
        Duplicar con contenido
      </MenuItem>
      <MenuItem icon={Copy} onClick={() => duplicate(false)}>
        Duplicar solo propiedades
      </MenuItem>
      <Divider />
      <MenuItem
        icon={Trash2}
        danger
        onClick={() => {
          close()
          deleteCard(card.id)
        }}
      >
        Eliminar
      </MenuItem>
    </Popover>
  )
}
