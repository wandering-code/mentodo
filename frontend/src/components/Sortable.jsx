import { useState } from 'react'
import { closestCenter, DndContext, KeyboardSensor, MouseSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { haptic } from '../lib/layers'

/* Lista que se reordena arrastrando (propiedades, etiquetas, proyectos).

   Antes era el Reorder de Motion, y con dragControls colgaba la página entera
   al pulsar el asa. Con dnd-kit, lo mismo que mueve el tablero:
   - handle: solo se arrastra desde el asa (handleProps); el resto de la fila
     sigue siendo táctil normal (scroll, campos, botones).
   - sin handle (barra lateral en escritorio): toda la fila, con ratón y a
     partir de unos píxeles, para que un clic siga siendo un clic. */
// Al soltar, el navegador manda un clic sobre la fila: se ignora justo después
// de un arrastre (si no, soltar un proyecto en la barra lateral lo abría)
let lastDrop = 0

export function SortableList({ ids, onReorder, children, handle = true }) {
  const [active, setActive] = useState(null)
  const sensors = useSensors(
    ...(handle
      ? [useSensor(PointerSensor, { activationConstraint: { distance: 3 } })]
      : [useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 6 } })]),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[({ transform }) => ({ ...transform, x: 0 })]}
      onDragStart={(e) => (haptic(8), setActive(e.active.id))}
      onDragCancel={() => setActive(null)}
      onDragEnd={({ active: a, over }) => {
        lastDrop = performance.now()
        setActive(null)
        if (!over || a.id === over.id) return
        onReorder(arrayMove(ids, ids.indexOf(a.id), ids.indexOf(over.id)))
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children({ active })}
      </SortableContext>
    </DndContext>
  )
}

/* Una fila: recibe por render-prop las props del asa y si se está arrastrando */
export function SortableRow({ id, children, className, as: Tag = 'div', handle = true }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined,
  }
  const handleProps = { ...attributes, ...listeners, style: { touchAction: 'none' } }
  return (
    <Tag
      ref={setNodeRef}
      style={style}
      className={className}
      {...(handle ? {} : { ...attributes, ...listeners })}
      onClickCapture={(e) => {
        if (performance.now() - lastDrop < 300) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      data-dragging={isDragging || undefined}
    >
      {children({ handleProps, isDragging })}
    </Tag>
  )
}
