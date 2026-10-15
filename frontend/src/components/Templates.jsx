import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { LayoutTemplate, Plus, Settings2, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { useCardNav } from '../lib/nav'
import { Button, IconButton, MenuItem, MenuLabel, Popover, usePopover } from './ui'

/* Plantillas disponibles en un proyecto: las suyas y las generales */
export function useTemplates(projectId) {
  const templates = useStore((s) => s.templates)
  return useMemo(() => {
    const all = Object.values(templates).sort((a, b) => (a.template?.name || '').localeCompare(b.template?.name || '', 'es'))
    return {
      project: projectId ? all.filter((t) => t.project_id === projectId) : [],
      profile: all.filter((t) => t.project_id === null),
    }
  }, [templates, projectId])
}

/* Crear una tarjeta desde una plantilla y abrirla */
export function useFromTemplate() {
  const cardFromTemplate = useStore((s) => s.cardFromTemplate)
  const { open } = useCardNav()
  return async (tpl, { projectId = null, labelIds = [], position } = {}) => {
    const c = await cardFromTemplate(tpl.id, { project_id: projectId, label_ids: labelIds, position })
    if (c) open(c)
    return c
  }
}

function TemplateItems({ projectId, onPick }) {
  const { project, profile } = useTemplates(projectId)
  const nav = useNavigate()
  return (
    <>
      {project.length > 0 && <MenuLabel>De este proyecto</MenuLabel>}
      {project.map((t) => (
        <MenuItem key={t.id} icon={LayoutTemplate} onClick={() => onPick(t)}>
          {t.template?.name || 'Sin nombre'}
        </MenuItem>
      ))}
      {profile.length > 0 && <MenuLabel>Generales</MenuLabel>}
      {profile.map((t) => (
        <MenuItem key={t.id} icon={LayoutTemplate} onClick={() => onPick(t)}>
          {t.template?.name || 'Sin nombre'}
        </MenuItem>
      ))}
      {project.length + profile.length === 0 && (
        <p className="px-3 py-2 text-[13px] text-faint">
          Aún no hay plantillas. Créalas desde el menú ··· de una tarjeta («Guardar como plantilla») o en los ajustes.
        </p>
      )}
      <div className="my-1 h-px bg-line" />
      <MenuItem icon={Settings2} onClick={() => nav(projectId ? `/p/${projectId}/ajustes` : '/ajustes')}>
        Gestionar plantillas
      </MenuItem>
    </>
  )
}

/* Botón «Desde plantilla» con su lista */
export function TemplateButton({ projectId, labelIds = [], position, size = 'sm', className }) {
  const pop = usePopover()
  const fromTemplate = useFromTemplate()
  return (
    <>
      <IconButton size={size} label="Nueva desde plantilla" onClick={pop.toggle} className={className}>
        <LayoutTemplate size={15} />
      </IconButton>
      <Popover open={pop.open} anchor={pop.anchor} onClose={pop.close} width={260}>
        <TemplateItems
          projectId={projectId}
          onPick={(t) => {
            pop.close()
            fromTemplate(t, { projectId, labelIds, position })
          }}
        />
      </Popover>
    </>
  )
}

/* Lista para gestionar plantillas (ajustes de proyecto o generales) */
export function TemplatesManager({ projectId = null }) {
  const templates = useStore((s) => s.templates)
  const createTemplate = useStore((s) => s.createTemplate)
  const deleteTemplate = useStore((s) => s.deleteTemplate)
  const { open } = useCardNav()
  const list = Object.values(templates)
    .filter((t) => t.project_id === projectId)
    .sort((a, b) => (a.template?.name || '').localeCompare(b.template?.name || '', 'es'))
  return (
    <div>
      {list.length > 0 && (
        <div className="mb-3 rounded-2xl border border-line bg-surface p-2">
          {list.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1">
              <LayoutTemplate size={16} className="shrink-0 text-accent" />
              <button onClick={() => open(t)} className="h-9 min-w-0 flex-1 truncate rounded-md px-1.5 text-left text-[15px] hover:bg-hover sm:text-[14px]">
                {t.template?.name || 'Sin nombre'}
              </button>
              <IconButton size="sm" label="Borrar plantilla" onClick={() => confirm(`¿Borrar la plantilla «${t.template?.name}»?`) && deleteTemplate(t.id)}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
        </div>
      )}
      <Button
        variant="outline"
        onClick={async () => {
          const t = await createTemplate(projectId)
          if (t) open(t)
        }}
      >
        <Plus size={15} /> Nueva plantilla
      </Button>
    </div>
  )
}
