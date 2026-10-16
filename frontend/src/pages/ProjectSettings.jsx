import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { motion } from 'motion/react'
import { SortableList, SortableRow } from '../components/Sortable'
import { TemplatesManager } from '../components/Templates'
import { Archive, ArchiveRestore, ArrowLeft, CircleCheck, Eye, MinusCircle, EyeOff, GripVertical, Flag, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { groupLabels, projectGroups } from '../lib/cards'
import { defaultName, FIELD_KINDS, fieldIcon, hiddenInProject, projectProps } from '../lib/props'
import { LABEL_COLORS, PROJECT_ICONS } from '../lib/palette'
import { ColorPicker } from '../components/Pickers'
import { RulesEditor } from '../components/RulesEditor'
import { Button, cx, IconButton, Popover, spring, Toggle, usePopover } from '../components/ui'

export function SettingsSection({ title, description, children }) {
  return (
    <section className="border-t border-line py-8 first:border-t-0 first:pt-2">
      <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
      {description && <p className="mt-1 max-w-xl text-[13.5px] text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function LabelRow({ label, isStatus }) {
  const { updateLabel, deleteLabel } = useStore.getState()
  const color = usePopover()
  // Se reordena solo desde el asa: con el gesto en toda la fila, en el móvil
  // no se podía hacer scroll por la página pasando el dedo por encima
  return (
    <SortableRow id={label.id} className="group flex items-center gap-2 rounded-lg bg-surface py-1 pr-1 data-[dragging]:shadow-float">
      {({ handleProps }) => (
      <>
      <span
        {...handleProps}
        className="grid h-9 w-5 shrink-0 cursor-grab place-items-center text-faint opacity-0 group-hover:opacity-100 max-sm:opacity-100"
      >
        <GripVertical size={15} />
      </span>
      <button onClick={color.toggle} data-c={label.color} className="lbl-dot size-4 shrink-0 rounded-full" aria-label="Color" />
      <input
        defaultValue={label.name}
        onBlur={(e) => e.target.value.trim() && e.target.value !== label.name && updateLabel(label.id, { name: e.target.value.trim() })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[14px] outline-none hover:bg-hover focus:bg-sunken"
      />
      {isStatus && (
        <button
          onClick={() => updateLabel(label.id, { marks_done: !label.marks_done })}
          title={label.marks_done ? 'Las tarjetas con esta etiqueta cuentan como terminadas' : 'Usar esta etiqueta para lo terminado'}
          className={cx(
            'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition-[background-color,color,opacity] duration-150',
            label.marks_done
              ? 'bg-accent-soft text-accent'
              : 'text-faint opacity-0 hover:bg-hover hover:text-muted group-hover:opacity-100 max-sm:opacity-100',
          )}
        >
          <CircleCheck size={14} />
          {label.marks_done ? 'Terminado' : <span className="hidden sm:inline">Marcar como terminado</span>}
        </button>
      )}
      {isStatus && !label.marks_done && (
        <button
          onClick={() => updateLabel(label.id, { inactive: !label.inactive })}
          title={label.inactive ? 'Las tarjetas en este estado no salen en Hoy ni en To Do ni generan avisos' : 'Que las tarjetas en este estado no cuenten como pendientes'}
          className={cx(
            'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition-[background-color,color,opacity] duration-150',
            label.inactive
              ? 'bg-sunken text-muted'
              : 'text-faint opacity-0 hover:bg-hover hover:text-muted group-hover:opacity-100 max-sm:opacity-100',
          )}
        >
          <MinusCircle size={14} />
          {label.inactive ? 'No cuenta' : <span className="hidden sm:inline">No cuenta</span>}
        </button>
      )}
      <IconButton size="sm" label="Borrar etiqueta" onClick={() => confirm(`¿Borrar «${label.name}»?`) && deleteLabel(label.id)}>
        <Trash2 size={14} />
      </IconButton>
      <Popover open={color.open} anchor={color.anchor} onClose={color.close} width={200}>
        <ColorPicker value={label.color} onChange={(c) => (updateLabel(label.id, { color: c }), color.close())} />
      </Popover>
      </>
      )}
    </SortableRow>
  )
}

function GroupCard({ group }) {
  const s = useStore()
  const labels = useMemo(() => groupLabels(s, group.id), [s.labels, group.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [name, setName] = useState('')
  const ids = labels.map((l) => l.id)
  const reorder = (next) => next.forEach((id, i) => s.labels[id] && s.labels[id].position !== i && s.updateLabel(id, { position: i }))
  const add = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    await s.createLabel({ group_id: group.id, name: name.trim(), color: LABEL_COLORS[(labels.length + 2) % LABEL_COLORS.length].id })
    setName('')
  }
  return (
    <motion.div layout className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <input
          defaultValue={group.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== group.name && s.updateGroup(group.id, { name: e.target.value.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[15px] font-semibold outline-none hover:bg-hover focus:bg-sunken"
        />
        <IconButton size="sm" label="Borrar grupo" onClick={() => confirm(`¿Borrar el grupo «${group.name}» y todas sus etiquetas?`) && s.deleteGroup(group.id)}>
          <Trash2 size={15} />
        </IconButton>
      </div>
      <div className="mt-2 flex flex-col gap-1 border-b border-line pb-3 pl-1.5">
        <label className="flex items-center gap-3 py-1 text-[13.5px]">
          <span className="min-w-0 flex-1">
            <span className="block text-ink">Es el estado de la tarjeta</span>
            <span className="block text-[12.5px] text-faint">
              {group.is_status
                ? 'Al marcar una tarjeta como hecha se mueve a la etiqueta de terminado, y al revés.'
                : 'Solo un grupo por proyecto. Actívalo si estas etiquetas dicen en qué punto está cada tarjeta.'}
            </span>
          </span>
          <Toggle checked={group.is_status} onChange={(v) => s.updateGroup(group.id, { is_status: v })} label="Es el estado de la tarjeta" />
        </label>
        {!group.is_status && (
          <label className="flex items-center gap-3 py-1 text-[13.5px]">
            <span className="flex-1 text-ink">Varias etiquetas por tarjeta</span>
            <Toggle checked={group.multi} onChange={(v) => s.updateGroup(group.id, { multi: v })} label="Varias etiquetas por tarjeta" />
          </label>
        )}
      </div>
      <div className="mt-2 flex flex-col">
        <SortableList ids={ids} onReorder={reorder}>
          {() => ids.map((id) => s.labels[id] && <LabelRow key={id} label={s.labels[id]} isStatus={group.is_status} />)}
        </SortableList>
      </div>
      <form onSubmit={add} className="mt-1 flex items-center gap-2 pl-6">
        <Plus size={15} className="text-faint" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva etiqueta" className="h-8 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
      </form>
    </motion.div>
  )
}

function PropertyRow({ p, project }) {
  const s = useStore.getState()
  const visible = !hiddenInProject(project, p.key)
  const rename = (v) => {
    const name = v.trim()
    if (!name || name === p.name) return
    if (p.group) s.updateGroup(p.group.id, { name })
    else if (p.field) s.updateField(p.field.id, { name })
    else s.updateProject(project.id, { prop_names: { ...(project.prop_names || {}), [p.key]: name } })
  }
  const toggle = () =>
    s.updateProject(project.id, {
      hidden_props: visible ? [...(project.hidden_props || []), p.key] : (project.hidden_props || []).filter((k) => k !== p.key),
    })
  const custom = !p.group && !p.field && project.prop_names?.[p.key]
  // Fechas: una de ellas cuenta como entrega (como «Terminado» en el estado)
  const isDate = p.key === 'due' || p.field?.kind === 'date'
  const isDeadline = isDate && (project.deadline_key || 'due') === p.key
  return (
    <SortableRow id={p.key} className="group flex items-center gap-2 rounded-lg bg-surface py-1 pr-1 data-[dragging]:shadow-float">
      {({ handleProps }) => (
      <>
      <span
        {...handleProps}
        className="grid h-9 w-6 shrink-0 cursor-grab place-items-center text-faint opacity-60 group-hover:opacity-100 max-sm:opacity-100"
        aria-label="Arrastrar para reordenar"
      >
        <GripVertical size={15} />
      </span>
      <p.icon size={16} className={cx('shrink-0', visible ? 'text-muted' : 'text-faint')} />
      <input
        key={p.name}
        defaultValue={p.name}
        onBlur={(e) => rename(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={cx('h-9 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[15px] outline-none hover:bg-hover focus:bg-sunken sm:h-8 sm:text-[14px]', !visible && 'text-faint')}
      />
      {custom && (
        <button
          title={`Volver a «${defaultName(p.key)}»`}
          onClick={() => {
            const { [p.key]: _, ...rest } = project.prop_names
            s.updateProject(project.id, { prop_names: rest })
          }}
          className="hidden shrink-0 rounded-md px-1.5 text-[12px] text-faint hover:text-muted sm:inline"
        >
          ↺ {defaultName(p.key)}
        </button>
      )}
      {isDate && (
        <button
          onClick={() => !isDeadline && s.updateProject(project.id, { deadline_key: p.key })}
          title={isDeadline ? 'Con esta fecha se calcula lo atrasado, lo de hoy, los avisos y las repeticiones' : 'Usar esta fecha como entrega'}
          className={cx(
            'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium transition-[background-color,color,opacity] duration-150',
            isDeadline
              ? 'cursor-default bg-accent-soft text-accent'
              : 'text-faint opacity-0 hover:bg-hover hover:text-muted group-hover:opacity-100 max-sm:opacity-100',
          )}
        >
          <Flag size={13} />
          {isDeadline ? 'Entrega' : <span className="hidden sm:inline">Marcar como entrega</span>}
        </button>
      )}
      <span className="hidden w-16 shrink-0 text-right text-[12px] text-faint sm:inline">
        {p.group ? 'Etiquetas' : p.field ? FIELD_KINDS.find((k) => k.id === p.field.kind)?.name : 'De serie'}
      </span>
      <IconButton size="sm" label={visible ? 'Ocultar' : 'Mostrar'} onClick={toggle}>
        {visible ? <Eye size={15} /> : <EyeOff size={15} />}
      </IconButton>
      {p.field || p.group ? (
        <IconButton
          size="sm"
          label="Borrar propiedad"
          onClick={() => {
            if (!confirm(`¿Borrar «${p.name}»${p.group ? ' y todas sus etiquetas' : ' y sus valores'}?`)) return
            if (p.field) s.deleteField(p.field.id)
            else s.deleteGroup(p.group.id)
          }}
        >
          <Trash2 size={14} />
        </IconButton>
      ) : (
        <span className="size-8 shrink-0 sm:size-7" />
      )}
      </>
      )}
    </SortableRow>
  )
}

function PropertiesSettings({ project }) {
  const s = useStore()
  const props = useMemo(() => projectProps(s, project.id), [s.groups, s.fields, s.projects, project.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [kind, setKind] = useState(null)
  const [name, setName] = useState('')
  const keys = props.map((p) => p.key)
  const byKey = Object.fromEntries(props.map((p) => [p.key, p]))
  const create = async (e) => {
    e.preventDefault()
    if (!name.trim() || !kind) return
    await s.createField({ project_id: project.id, name: name.trim(), kind })
    setName('')
    setKind(null)
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-2">
      <div className="flex flex-col">
        <SortableList ids={keys} onReorder={(order) => s.updateProject(project.id, { prop_order: order })}>
          {() => keys.map((k) => <PropertyRow key={k} p={byKey[k]} project={project} />)}
        </SortableList>
      </div>
      <div className="mt-1 border-t border-line px-2.5 pb-1 pt-3">
        {kind ? (
          <form onSubmit={create} className="flex items-center gap-2">
            {(() => {
              const K = fieldIcon(kind)
              return <K size={16} className="text-accent" />
            })()}
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setKind(null)} placeholder="Nombre de la propiedad" className="h-8 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
            <Button size="sm" variant="primary" disabled={!name.trim()}>
              Crear
            </Button>
            <Button size="sm" type="button" onClick={() => setKind(null)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[13px] text-faint">Nueva:</span>
            {FIELD_KINDS.map((k) => (
              <Button key={k.id} size="sm" variant="outline" onClick={() => setKind(k.id)}>
                <k.icon size={14} /> {k.name}
              </Button>
            ))}
            <span className="text-[12.5px] text-faint">· las de etiquetas, abajo</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function ProjectSettings() {
  const { projectId } = useParams()
  const id = Number(projectId)
  const s = useStore()
  const nav = useNavigate()
  const project = s.projects[id]
  const groups = useMemo(() => projectGroups(s, id), [s.groups, id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [newGroup, setNewGroup] = useState('')
  if (!project) return s.status === 'ready' ? <Navigate to="/" replace /> : null

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-8 lg:pt-10">
      <button onClick={() => nav(`/p/${id}`)} className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] text-muted hover:text-ink">
        <ArrowLeft size={15} /> {project.icon} {project.name}
      </button>
      <h1 className="text-[28px] font-semibold tracking-[-0.025em]">Ajustes del proyecto</h1>

      <SettingsSection title="Icono">
        <div className="grid grid-cols-10 gap-1 sm:max-w-md">
          {PROJECT_ICONS.map((i) => (
            <button key={i} onClick={() => s.updateProject(id, { icon: i })} className={cx('grid aspect-square place-items-center rounded-lg text-lg transition-colors', project.icon === i ? 'bg-accent-soft' : 'hover:bg-hover')}>
              {i}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title="Propiedades"
        description="Lo que aparece en cada tarjeta, en este orden. Arrastra desde ⋮⋮ para reordenar y toca un nombre para cambiarlo (también los de serie: «Fecha» puede ser «Inicio»). Ocultar no borra nada; también puedes ocultar una propiedad solo en una tarjeta desde su nombre, dentro de la tarjeta."
      >
        <PropertiesSettings project={project} />
      </SettingsSection>

      <SettingsSection
        title="Etiquetas"
        description="Organizadas en grupos (Estado, Prioridad, Área…). El tablero usa un grupo como columnas; en cualquier vista puedes ordenar y filtrar por ellas. Uno de los grupos puede hacer de estado de la tarjeta: en él eliges qué etiqueta significa terminado."
      >
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <GroupCard key={g.id} group={g} />
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!newGroup.trim()) return
              await s.createGroup({ project_id: id, name: newGroup.trim() })
              setNewGroup('')
            }}
            className="flex items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-2.5"
          >
            <Plus size={15} className="text-faint" />
            <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="Nuevo grupo de etiquetas (p. ej. Área, Contexto, Energía)" className="h-8 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
          </form>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Plantillas"
        description="Tarjetas modelo de este proyecto: propiedades visibles, cuerpo y valores por defecto (etiquetas, fechas relativas, campos…). Se usan desde el botón de plantillas de cada columna o con ⌘K. También puedes guardar cualquier tarjeta como plantilla desde su menú ···."
      >
        <TemplatesManager projectId={id} />
      </SettingsSection>

      <SettingsSection title="Avisos de este proyecto" description="Además de los avisos generales (en Ajustes), estas reglas solo se aplican a las tarjetas de este proyecto.">
        <RulesEditor projectId={id} />
      </SettingsSection>

      <SettingsSection title="Zona de proyecto">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => s.updateProject(id, { archived: !project.archived })}>
            {project.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            {project.archived ? 'Recuperar proyecto' : 'Aparcar proyecto'}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(`¿Borrar «${project.name}» y todas sus tarjetas? No se puede deshacer.`)) {
                nav('/')
                s.deleteProject(id)
              }
            }}
          >
            <Trash2 size={15} /> Borrar proyecto
          </Button>
        </div>
        <p className="mt-2 text-[13px] text-faint">Aparcar lo quita de la barra lateral y del To Do sin borrar nada; puedes recuperarlo cuando quieras.</p>
      </SettingsSection>
    </div>
  )
}
