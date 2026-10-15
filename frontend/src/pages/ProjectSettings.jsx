import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { Reorder, motion } from 'motion/react'
import { Archive, ArchiveRestore, ArrowLeft, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { groupLabels, projectGroups } from '../lib/cards'
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

function LabelRow({ label }) {
  const { updateLabel, deleteLabel } = useStore.getState()
  const color = usePopover()
  return (
    <Reorder.Item value={label.id} transition={spring} className="group flex items-center gap-2 rounded-lg bg-surface py-1 pr-1">
      <GripVertical size={15} className="cursor-grab text-faint opacity-0 group-hover:opacity-100 max-sm:opacity-100" />
      <button onClick={color.toggle} data-c={label.color} className="lbl-dot size-4 shrink-0 rounded-full" aria-label="Color" />
      <input
        defaultValue={label.name}
        onBlur={(e) => e.target.value.trim() && e.target.value !== label.name && updateLabel(label.id, { name: e.target.value.trim() })}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[14px] outline-none hover:bg-hover focus:bg-sunken"
      />
      <label className="flex items-center gap-2 text-[12.5px] text-muted" title="Las tarjetas con esta etiqueta cuentan como terminadas">
        <span className="hidden sm:inline">Hecho</span>
        <Toggle checked={label.marks_done} onChange={(v) => updateLabel(label.id, { marks_done: v })} />
      </label>
      <IconButton size="sm" label="Borrar etiqueta" onClick={() => confirm(`¿Borrar «${label.name}»?`) && deleteLabel(label.id)}>
        <Trash2 size={14} />
      </IconButton>
      <Popover open={color.open} anchor={color.anchor} onClose={color.close} width={200}>
        <ColorPicker value={label.color} onChange={(c) => (updateLabel(label.id, { color: c }), color.close())} />
      </Popover>
    </Reorder.Item>
  )
}

function GroupCard({ group }) {
  const s = useStore()
  const labels = useMemo(() => groupLabels(s, group.id), [s.labels, group.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [order, setOrder] = useState(null)
  const [name, setName] = useState('')
  const ids = order || labels.map((l) => l.id)
  const commit = () => {
    order?.forEach((id, i) => s.labels[id] && s.labels[id].position !== i && s.updateLabel(id, { position: i }))
    setOrder(null)
  }
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
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          Varias por tarjeta
          <Toggle checked={group.multi} onChange={(v) => s.updateGroup(group.id, { multi: v })} />
        </label>
        <IconButton size="sm" label="Borrar grupo" onClick={() => confirm(`¿Borrar el grupo «${group.name}» y todas sus etiquetas?`) && s.deleteGroup(group.id)}>
          <Trash2 size={15} />
        </IconButton>
      </div>
      <Reorder.Group axis="y" values={ids} onReorder={setOrder} className="mt-2 flex flex-col" onPointerUp={commit}>
        {ids.map((id) => s.labels[id] && <LabelRow key={id} label={s.labels[id]} />)}
      </Reorder.Group>
      <form onSubmit={add} className="mt-1 flex items-center gap-2 pl-6">
        <Plus size={15} className="text-faint" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva etiqueta" className="h-8 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" />
      </form>
    </motion.div>
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
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-14 sm:px-8 lg:pt-10">
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
        title="Etiquetas"
        description="Organizadas en grupos (Estado, Prioridad, Área…). El tablero usa un grupo como columnas; en cualquier vista puedes ordenar y filtrar por ellas. Activa «Hecho» en la etiqueta que signifique terminado: marcar el check moverá la tarjeta ahí."
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
