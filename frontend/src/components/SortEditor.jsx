import { ArrowDown, ArrowUp, Check, Layers, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { fieldIcon } from '../lib/props'
import { SORT_FIELDS, projectGroups } from '../lib/cards'
import { Button, Divider, IconButton, MenuItem, MenuLabel } from './ui'

/* Nombre legible de un criterio de orden */
export function sortName(s, project, f) {
  return (
    (f.startsWith('group:')
      ? s.groups[Number(f.slice(6))]?.name
      : f.startsWith('f:')
        ? s.fields[Number(f.slice(2))]?.name
        : (f === 'due_at' && project.prop_names?.due) || SORT_FIELDS.find((x) => x.id === f)?.name) || f
  )
}

/* Resumen corto de un orden: «Fecha ↓, Título ↑» */
export function sortSummary(s, project, sorts) {
  return sorts.map((x) => `${sortName(s, project, x.field)} ${x.dir === 'desc' ? '↓' : '↑'}`).join(', ')
}

/* Editor de criterios de orden (el de la barra y el de cada columna).
   Con `inherit`, `sorts` puede ser undefined (= sigue el orden del tablero)
   o [] (= manual en esta columna). */
export function SortEditor({ project, sorts, onChange, inherit = false, skipGroup }) {
  const s = useStore()
  const list = sorts || []
  // En una columna no se ofrece el grupo que forma las columnas: ahí todas comparten etiqueta
  const groups = projectGroups(s, project.id).filter((g) => g.id !== skipGroup)
  const name = (f) => sortName(s, project, f)

  return (
    <>
      {inherit && (
        <>
          <MenuLabel>Orden de esta columna</MenuLabel>
          <MenuItem onClick={() => onChange(undefined)} right={sorts === undefined && <Check size={14} className="text-accent" />}>
            Como el tablero
          </MenuItem>
          <MenuItem onClick={() => onChange([])} right={sorts?.length === 0 && <Check size={14} className="text-accent" />}>
            Manual
          </MenuItem>
          <Divider />
        </>
      )}
      {(!inherit || list.length > 0) && <MenuLabel>Ordenar por (en orden de prioridad)</MenuLabel>}
      {list.map((x, i) => (
        <div key={i} className="flex items-center gap-1 px-1 py-0.5">
          <span className="w-4 text-center text-[12px] text-faint">{i + 1}</span>
          <span className="flex-1 truncate px-1 text-[14px]">{name(x.field)}</span>
          <Button size="sm" onClick={() => onChange(list.map((y, j) => (j === i ? { ...y, dir: y.dir === 'asc' ? 'desc' : 'asc' } : y)))}>
            {x.dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            {x.field.startsWith('group:') ? (x.dir === 'asc' ? 'Orden etiquetas' : 'Inverso') : x.dir === 'asc' ? 'Asc' : 'Desc'}
          </Button>
          <IconButton size="sm" label="Quitar" onClick={() => onChange(list.filter((_, j) => j !== i))}>
            <X size={14} />
          </IconButton>
        </div>
      ))}
      {list.length > 0 && <Divider />}
      <MenuLabel>Añadir criterio</MenuLabel>
      {groups
        .filter((g) => !list.some((x) => x.field === `group:${g.id}`))
        .map((g) => (
          <MenuItem key={g.id} icon={Layers} onClick={() => onChange([...list, { field: `group:${g.id}`, dir: 'asc' }])}>
            {g.name}
          </MenuItem>
        ))}
      {Object.values(s.fields)
        .filter((f) => f.project_id === project.id && !list.some((x) => x.field === `f:${f.id}`))
        .map((f) => (
          <MenuItem key={`f${f.id}`} icon={fieldIcon(f.kind)} onClick={() => onChange([...list, { field: `f:${f.id}`, dir: 'asc' }])}>
            {f.name}
          </MenuItem>
        ))}
      {SORT_FIELDS.filter((f) => f.id !== 'position' && !list.some((x) => x.field === f.id)).map((f) => (
        <MenuItem key={f.id} onClick={() => onChange([...list, { field: f.id, dir: 'asc' }])}>
          {name(f.id)}
        </MenuItem>
      ))}
      {!inherit && list.length > 0 && (
        <>
          <Divider />
          <MenuItem onClick={() => onChange([])}>Volver a orden manual</MenuItem>
        </>
      )}
    </>
  )
}
