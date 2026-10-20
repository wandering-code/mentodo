import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import {
  ArrowRight, Bell, BookOpen, CalendarRange, CircleCheckBig, Clock, Columns3, FileText, FolderKanban, GitBranch, Inbox, KeyRound, LayoutTemplate, Palette,
  Paperclip, Search, ShieldCheck, Sparkles, Sun, Tags, Undo2, X, Zap, SlidersHorizontal, TreePalm,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { hoursOn } from '../lib/hours'
import { vacationsOn } from '../lib/vacations'
import { Button, Checkbox, cx, IS_MAC, Kbd, LabelChip } from '../components/ui'

/* Guía de uso: todo lo que hace Mentodo, consultable en cualquier momento.
   El contenido vive aquí como datos; cada sección puede llevar una pequeña
   demostración hecha con las mismas piezas de la interfaz. */

const K = IS_MAC ? '⌘' : 'Ctrl'

function Demo({ children, className }) {
  return <div className={cx('mt-4 rounded-xl border border-line bg-sunken p-3 sm:p-4', className)}>{children}</div>
}

function DemoCard({ title, children, done }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-2.5 shadow-soft">
      <div className="flex items-center gap-2">
        <Checkbox checked={!!done} onChange={() => {}} size={16} />
        <span className={cx('truncate text-[13.5px] font-medium', done && 'text-muted line-through')}>{title}</span>
      </div>
      {children && <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-6">{children}</div>}
    </div>
  )
}

const L = (name, color) => ({ id: name, name, color })

function BoardDemo() {
  const cols = [
    { l: L('Por hacer', 'gris'), cards: [['Preparar propuesta', [L('Alta', 'rojo')]], ['Revisar contrato', []]] },
    { l: L('En curso', 'azul'), cards: [['Maquetar la landing', [L('Media', 'ambar')]]] },
    { l: L('Hecho', 'verde'), cards: [['Reunión de arranque', []]], done: true },
  ]
  return (
    <Demo>
      <div className="grid grid-cols-3 gap-2">
        {cols.map((c) => (
          <div key={c.l.name} className="min-w-0">
            <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
              <LabelChip label={c.l} size="sm" />
              <span className="text-[11px] text-faint">{c.cards.length}</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {c.cards.map(([t, ls]) => (
                <DemoCard key={t} title={t} done={c.done}>
                  {ls.map((l) => (
                    <LabelChip key={l.name} label={l} size="sm" />
                  ))}
                </DemoCard>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Demo>
  )
}

function RingDemo() {
  const R = 40
  const C = 2 * Math.PI * R
  return (
    <Demo className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative grid size-[112px] shrink-0 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--line)" strokeWidth="9" />
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeLinecap="round" stroke="color-mix(in oklab, var(--accent) 28%, transparent)" strokeDasharray={C} strokeDashoffset={C * (1 - 0.62)} />
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="9" strokeLinecap="round" stroke="var(--accent)" strokeDasharray={C} strokeDashoffset={C * (1 - 0.4)} />
        </svg>
        <div className="relative text-center">
          <div className="text-[20px] font-semibold tabular-nums leading-none">1,75</div>
          <div className="mt-0.5 text-[10.5px] text-muted">sin imputar</div>
        </div>
      </div>
      <div className="grid flex-1 gap-1.5 text-[13px] text-muted">
        <p>
          <span className="mr-1.5 inline-block size-2.5 rounded-full" style={{ background: 'color-mix(in oklab, var(--accent) 35%, transparent)' }} />
          <b className="font-medium text-ink">Arco tenue</b>: lo que llevas trabajado (5 h de 8).
        </p>
        <p>
          <span className="mr-1.5 inline-block size-2.5 rounded-full bg-accent" />
          <b className="font-medium text-ink">Arco sólido</b>: lo que ya has imputado (3,25 h).
        </p>
        <p>El hueco entre los dos es la cifra grande: lo que has hecho y aún no has apuntado. Debajo, lo que falta en todo el día.</p>
      </div>
    </Demo>
  )
}

function ExitDemo() {
  const rows = [
    ['Entrada 08:15 · jornada 8 h · comida 0,75 desde 14:30', 'Salida 17:00'],
    ['Entrada 06:00 · jornada 6 h · comida desde 14:30', 'Salida 12:00 (no llegas a comer)'],
    ['Viernes · 8 h sin comida · entrada 08:00', 'Salida 16:00'],
  ]
  return (
    <Demo className="p-1.5 sm:p-2">
      {rows.map(([a, b]) => (
        <div key={a} className="flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-[13px] sm:flex-row sm:items-center sm:gap-3">
          <span className="flex-1 text-muted">{a}</span>
          <span className="font-medium tabular-nums text-ink">{b}</span>
        </div>
      ))}
    </Demo>
  )
}

function ShortcutsDemo() {
  const list = [
    [`${K} K`, 'Buscar o capturar desde cualquier sitio'],
    [`${K} \\`, 'Mostrar u ocultar la barra lateral'],
    ['/', 'Dentro de las notas: menú de bloques (títulos, listas, casillas, secreto…)'],
    ['Intro', 'En la captura: guardar en la bandeja · en Horas: añadir el parte'],
    ['Esc', 'Cerrar la tarjeta, el menú o la ventana de encima'],
    ['Clic derecho', 'En una tarjeta: duplicar, eliminar y más'],
  ]
  return (
    <Demo className="p-1.5 sm:p-2">
      {list.map(([k, d]) => (
        <div key={k} className="flex items-center gap-3 rounded-lg px-2.5 py-1.5 text-[13px]">
          <span className="w-24 shrink-0">
            <Kbd>{k}</Kbd>
          </span>
          <span className="text-muted">{d}</span>
        </div>
      ))}
    </Demo>
  )
}

const SECTIONS = [
  {
    id: 'empezar',
    icon: Sparkles,
    title: 'Cómo está organizado',
    intro: 'Mentodo junta en un sitio tus tareas, tus notas y, si lo activas, tus horas. Todo cambia al momento en todos tus dispositivos con la misma cuenta.',
    items: [
      ['Proyectos y tarjetas', 'Cada proyecto tiene tarjetas (tareas). Una tarjeta tiene título, propiedades (fecha, etiquetas…) y notas libres.'],
      ['Las páginas de arriba del menú', 'Hoy (qué toca hoy), To Do (lo marcado de todos los proyectos), Bandeja (lo capturado sin sitio), Apuntes y Semana (revisión semanal).'],
      ['Tiempo real', 'Si cambias algo en el móvil, se ve en el ordenador sin recargar. Sin conexión verás «Reconectando…» y al volver se pone al día solo.'],
      ['Como una app', 'En iPhone: Compartir → Añadir a pantalla de inicio. En el ordenador, el icono de instalar de la barra del navegador. Cuando hay una versión nueva, la app te avisa para recargar.'],
    ],
  },
  {
    id: 'captura',
    icon: Search,
    title: 'Buscar y capturar',
    intro: `${K} K abre la paleta desde cualquier sitio. En el móvil, el botón + de abajo a la derecha.`,
    items: [
      ['Buscar', 'Escribe y salen las tarjetas, proyectos, apuntes y plantillas que coinciden. Intro abre lo elegido.'],
      ['Capturar', 'Si lo escrito no es una búsqueda que quieras abrir, Intro lo guarda como tarjeta en la Bandeja para ordenarlo luego.'],
      ['Ir a…', 'Con la paleta vacía tienes atajos a Hoy, To Do, Bandeja, Apuntes, Horas, Ajustes y esta guía.'],
    ],
    to: null,
  },
  {
    id: 'proyectos',
    icon: FolderKanban,
    title: 'Proyectos',
    intro: 'Cada proyecto nace con un grupo «Estado» (Por hacer, En curso, Hecho), uno «Prioridad» y tres vistas: Tablero, Tabla y Calendario.',
    items: [
      ['Crear y ordenar', 'Con el + junto a «Proyectos» en el menú. Arrastra en el menú para cambiar el orden.'],
      ['Ajustes del proyecto', 'Desde el botón de ajustes de la cabecera del proyecto: icono, propiedades, etiquetas, plantillas, avisos propios y, si usas el parte de horas, imputar desde sus tarjetas.'],
      ['Aparcar', 'Lo quita del menú y del To Do sin borrar nada (queda en «Aparcados» al final del menú). Puedes recuperarlo cuando quieras.'],
    ],
  },
  {
    id: 'tarjetas',
    icon: FileText,
    title: 'Tarjetas y notas',
    intro: 'Toca una tarjeta para abrirla en un panel. En el móvil se cierra tirando hacia abajo desde la cabecera.',
    items: [
      ['Notas con formato', 'Selecciona texto para la barra de formato (negrita, colores, resaltado…). Escribe «/» para insertar títulos, listas, casillas, citas, código o un secreto.'],
      ['Casillas', 'Las casillas de las notas cuentan como lista de pasos: la tarjeta enseña 2/5 en el tablero.'],
      ['Terminar', 'El círculo de la izquierda. Si el proyecto tiene una etiqueta de terminado (p. ej. «Hecho»), se pone sola, y al revés.'],
      ['Menú ···  y clic derecho', 'Duplicar (con o sin notas), mover a otro proyecto, guardar como plantilla, eliminar (con Deshacer).'],
    ],
  },
  {
    id: 'propiedades',
    icon: SlidersHorizontal,
    title: 'Propiedades',
    intro: 'Lo que describe una tarjeta. Hay unas de serie y puedes crear las tuyas.',
    items: [
      ['De serie', 'Fecha, Recordatorio, Estimación, Repetición y «En To Do».'],
      ['Propias', 'Fecha, texto, número, casilla o enlace. Se crean en Ajustes del proyecto → Propiedades.'],
      ['Renombrar y ordenar', 'Toca un nombre para cambiarlo (también los de serie: «Fecha» puede ser «Inicio»). Arrastra desde ⋮⋮ para reordenar.'],
      ['Ocultar', 'En todo el proyecto o solo en una tarjeta (desde su nombre, dentro de la tarjeta). «Solo donde se añaden» la deja escondida salvo en las tarjetas donde la pongas.'],
      ['Fecha de entrega', 'Elige qué fecha cuenta como entrega en el proyecto: con ella se calculan lo atrasado, Hoy, los avisos, los aplazamientos y las repeticiones.'],
    ],
  },
  {
    id: 'etiquetas',
    icon: Tags,
    title: 'Etiquetas y estado',
    intro: 'Las etiquetas viven en grupos (Estado, Prioridad, Área, Contexto…). El tablero usa un grupo como columnas.',
    items: [
      ['Una o varias', 'Cada grupo decide si una tarjeta puede llevar una sola etiqueta suya o varias.'],
      ['Grupo de estado', 'Uno por proyecto. En él eliges qué etiqueta significa terminado.'],
      ['Estados que «no cuentan»', 'Un estado tipo archivo (p. ej. «Despliegues»): sus tarjetas no salen en Hoy ni en To Do ni avisan, aunque su fecha haya pasado.'],
    ],
    demo: (
      <Demo className="flex flex-wrap gap-1.5">
        {[L('Por hacer', 'gris'), L('En curso', 'azul'), L('Hecho', 'verde'), L('Alta', 'rojo'), L('Media', 'ambar'), L('Diseño', 'morado'), L('Casa', 'menta')].map((l) => (
          <LabelChip key={l.name} label={l} />
        ))}
      </Demo>
    ),
  },
  {
    id: 'vistas',
    icon: Columns3,
    title: 'Vistas',
    intro: 'Cada proyecto puede tener varias vistas guardadas, como pestañas. Arrástralas para ordenarlas.',
    items: [
      ['Tablero', 'Columnas por un grupo de etiquetas. Arrastra tarjetas entre columnas; pliega las que no necesites ver.'],
      ['Tabla y Lista', 'Todas las propiedades en columnas, o una lista por bloques para repasar rápido.'],
      ['Calendario', 'Las tarjetas en su día; eliges qué fecha se usa. Las repeticiones futuras también salen.'],
      ['Informe de jornadas', 'Días laborables por mes entre dos fechas de cada tarjeta, con festivos por comunidad y ajuste a mano. Se descarga en CSV.'],
      ['Ordenar, filtrar y agrupar', 'Desde la bandeja de herramientas de cada vista: por cualquier propiedad (fechas, casillas, texto, número, etiquetas) y ocultar lo terminado.'],
    ],
    demo: <BoardDemo />,
  },
  {
    id: 'todo',
    icon: CircleCheckBig,
    title: 'To Do general',
    intro: 'Una lista con lo marcado «En To Do» de todos tus proyectos.',
    items: [
      ['Marcar', 'Desde cada tarjeta, con la propiedad «En To Do».'],
      ['Qué proyectos', 'Arriba en To Do eliges si ver todos o solo algunos.'],
    ],
    to: '/',
  },
  {
    id: 'hoy',
    icon: Sun,
    title: 'Hoy',
    intro: 'Tu revisión diaria: lo atrasado, lo que vence hoy, los recordatorios de hoy y lo marcado en To Do sin fecha, por prioridad.',
    items: [
      ['Por bloques', 'Lo principal, Después, Si sobra tiempo, Esperando a otras (bloqueadas) y Hecho hoy.'],
      ['Hoy tengo X h', 'Con estimaciones en tus tareas, ves qué cabe en tu día; lo que no cabe sale atenuado.'],
      ['Solo un rato', 'Filtra lo que se puede hacer en 15, 30 o 60 minutos.'],
      ['Personalizar', 'Ajustes → Hoy apaga la planificación de tiempo. Con el parte de horas, arriba sale un recuadro con lo que te queda por imputar.'],
    ],
    to: '/hoy',
  },
  {
    id: 'semana',
    icon: CalendarRange,
    title: 'Revisión semanal',
    intro: 'Qué terminaste, qué creaste y qué aplazaste cada semana, para ver cómo va todo de un vistazo.',
    items: [
      ['Aplazamientos', 'Cada vez que mueves a más tarde la fecha de una tarjeta sin terminar, cuenta como aplazada. Las que llevas tiempo aplazando salen aparte, para que decidas qué hacer con ellas.'],
      ['Otras semanas', 'Con las flechas de arriba.'],
    ],
    to: '/semana',
  },
  {
    id: 'bandeja',
    icon: Inbox,
    title: 'Bandeja',
    intro: 'Lo capturado sin proyecto. Repásala de vez en cuando y mueve cada cosa a su sitio (o termínala).',
    items: [['Mover', 'Desde la tarjeta, toca la carpeta de arriba y elige el proyecto.']],
    to: '/inbox',
  },
  {
    id: 'relaciones',
    icon: GitBranch,
    title: 'Relaciones entre tarjetas',
    intro: 'Dentro de la tarjeta, en «Relaciones».',
    items: [
      ['Subtareas', 'Una tarjeta madre con sus hijas; el tablero muestra cuántas van hechas.'],
      ['Bloqueos', 'Una tarjeta bloquea a otra: la bloqueada sale en «Esperando a otras» en Hoy hasta que la primera se termine.'],
      ['Relacionadas', 'Enlaces sin dirección, para tener a mano lo que va junto.'],
    ],
  },
  {
    id: 'plantillas',
    icon: LayoutTemplate,
    title: 'Plantillas y repetición',
    intro: 'Para no escribir dos veces lo mismo.',
    items: [
      ['Plantillas', 'Tarjetas modelo con cuerpo, propiedades y fechas relativas («+7 días»). Del proyecto (Ajustes del proyecto) o generales (Ajustes). Se usan desde el botón de plantillas de cada columna o con la paleta.'],
      ['Guardar como plantilla', 'Desde el menú ··· de cualquier tarjeta.'],
      ['Repetición', 'Diaria, semanal (eligiendo días) o mensual. Al terminar, nace la siguiente con la fecha que se repite movida, y un aviso te deja abrirla.'],
    ],
  },
  {
    id: 'apuntes',
    icon: KeyRound,
    title: 'Apuntes y bóveda',
    intro: 'Páginas de texto libre que no son tareas: instrucciones, referencias, ideas. Generales o de un proyecto (pestaña «Apuntes»).',
    items: [
      ['Ordenar', 'Fija los importantes arriba y arrastra el resto.'],
      ['Bóveda de secretos', 'Escribe /secreto en un apunte para guardar usuario y contraseña cifrados en tu dispositivo con una frase maestra que solo tú sabes (Ajustes → Bóveda). El servidor nunca la ve.'],
    ],
    to: '/apuntes',
  },
  {
    id: 'adjuntos',
    icon: Paperclip,
    title: 'Adjuntos',
    intro: 'Archivos e imágenes en tarjetas y apuntes.',
    items: [['Subir', 'Arrástralos encima, pégalos desde el portapapeles o usa «Adjuntar archivo». Las imágenes se ven en grande al tocarlas.']],
  },
  {
    id: 'avisos',
    icon: Bell,
    title: 'Avisos',
    intro: 'Notificaciones en la campana y, si las activas, también push en el dispositivo aunque Mentodo esté cerrado.',
    items: [
      ['Recordatorio', 'Una hora concreta en una tarjeta (propiedad Recordatorio).'],
      ['Reglas', 'Antes del vencimiento, cuando se pasa la fecha, resumen diario a una hora, o tarjeta atascada N días con una etiqueta. Generales (Ajustes) o de un proyecto (Ajustes del proyecto).'],
      ['Push', 'Ajustes → Avisos → Activar en este dispositivo (uno a uno). Solo por HTTPS; en iPhone, primero añade la app a la pantalla de inicio.'],
    ],
  },
  {
    id: 'horas',
    icon: Clock,
    title: 'Parte de horas',
    module: 'hours',
    intro: 'Un módulo opcional para quien imputa horas a clientes: fichas la entrada, apuntas partes (cliente, tarea y horas) y Mentodo te dice cuándo sales, qué te queda por imputar y cómo va tu semana. Se activa en Ajustes → Módulos y, sin activarlo, no aparece en ninguna parte.',
    items: [
      ['Fichar', 'Pon la hora de entrada (o «Fichar ahora»). Se redondea a la precisión elegida: con cuartos, 08:17 se guarda 08:15.'],
      ['Salida prevista', 'Entrada + jornada + comida, pero la comida solo cuenta si la jornada llega a la hora de comer. Hoy ves la cuenta atrás «Para salir».'],
      ['Las dos pendientes', 'La cifra grande es lo trabajado que aún no has imputado («¿qué me falta meter ahora?»). Debajo, lo que falta en todo el día. Si imputas por adelantado verás «de adelanto».'],
      ['Añadir partes', 'Cliente, tarea y horas, e Intro. El cliente se queda puesto para la siguiente. Horas como 1,25 · 1:15 · 90m, o con las fichas rápidas; «Lo que queda» rellena justo lo pendiente.'],
      ['Clientes y tarjetas', 'Al escribir el cliente salen los usados y tus proyectos. Si el cliente es un proyecto, la tarea sugiere sus tarjetas y el parte queda unido a ella.'],
      ['Editar', 'Toca cualquier campo de un parte para cambiarlo; la papelera lo borra (con Deshacer).'],
      ['La semana', 'Cada día con su barra (verde: completa, ámbar: por encima). Balance = imputado − jornada, solo en los días con partes: un lunes vacío no resta. Flechas para semanas pasadas.'],
      ['Por proyecto', 'Toca el Balance para ver cuánto has imputado a cada proyecto (o cliente) esta semana o este mes, con su porcentaje; cada uno se despliega en sus tareas. Va plegado si no lo usas.'],
      ['Calendario', 'En el mismo panel, la pestaña Calendario enseña el mes: en cada día, su balance y lo que te quedaste de más; en rojo, los días que te pasaste. Abajo, el resumen del mes. Toca un día para ir a él.'],
      ['Horas de más', 'Si pones la salida real, junto a la salida prevista ves en horas y minutos cuánto te has quedado de más (p. ej. «+45 min») (o, en negativo, cuánto antes te fuiste); hoy cuenta en vivo en cuanto pasa la salida prevista. Arriba, junto al balance, el total de la semana. Va por el tiempo que has estado, no por lo imputado: no hace falta imputar esas horas para verlas. En Ajustes → Parte de horas puedes sacarlas también en el CSV (al final, sin mover las columnas de siempre) y en el recuadro de Hoy.'],
      ['Ajustes del día', 'Cambia la jornada o la comida de un día suelto, o pon la salida real. «Horario de la semana» lo devuelve a lo de Ajustes.'],
      ['Horario y festivos', 'En Ajustes → Parte de horas: jornada y comida de cada día de la semana (el viernes puede ir sin comida), precisión (5, 15, 30 min), formato 8,25 u 8:15 y festivos de tu comunidad, que nacen con jornada 0.'],
      ['Desde las tarjetas', 'En Ajustes del proyecto → Parte de horas, activa «Imputar horas desde las tarjetas»: cada tarjeta enseña lo imputado junto a su estimación y un botón Imputar.'],
      ['Exportar', 'CSV con «;» y coma decimal (Excel en español): esta semana, el mes, el anterior o unas fechas. Copiar o descargar.'],
      ['Avisos', 'Opcionales: un aviso antes de la hora de salida y otro de cierre del día si queda jornada sin imputar.'],
    ],
    demo: (
      <>
        <RingDemo />
        <ExitDemo />
      </>
    ),
    to: '/horas',
  },
  {
    id: 'vacaciones',
    icon: TreePalm,
    title: 'Vacaciones y equipo',
    module: 'vacations',
    intro: 'Un módulo opcional para apuntar tus vacaciones del año y ver las de tu equipo en el mismo calendario. Se activa en Ajustes → Módulos. Los equipos son aparte y generales: se crean en Ajustes → Equipo y la invitación llega aunque la otra persona no use el módulo.',
    items: [
      ['Equipo', 'Crea un equipo en Ajustes → Equipo e invita por nombre de usuario. A la otra persona le llega un aviso; cuando acepta, os veis las vacaciones el uno al otro. Puedes salir cuando quieras.'],
      ['Marcar unas vacaciones', 'Toca el primer día en el calendario y luego el último (o «Añadir»). Elige el estado y, si quieres, una nota.'],
      ['Tres estados', 'Posible (solo el contorno): te lo estás planteando. Pedida (a rayas): pedida a la empresa, sin respuesta. Confirmada (sólida): aprobada.'],
      ['Te quedan', 'Arriba, los días que te quedan del año: se descuentan las confirmadas y las pedidas; aparte, cuántos te quedarían si confirmaras las posibles. Solo cuentan los días laborables (sin fines de semana ni festivos). Los días de cada año y los festivos, en Ajustes → Vacaciones.'],
      ['Festivos propios', 'Para días libres que no salen en el calendario de la comunidad (p. ej. los que da la empresa a final de año): «Festivo» arriba, o «Añadir» y cambia a Festivo. Elige si es solo para ti o para uno de tus equipos (lo ven todos, con aviso, y cualquiera puede cambiarlo). No gastan vacaciones y en Horas tienen jornada 0. Tócalo en el calendario para cambiarlo o quitarlo.'],
      ['Arrastrar días', 'Si te sobran días de un año y los pasas al siguiente, apúntalo en «arrastrar días», bajo el contador: del año anterior a este y de este al siguiente. Se suman al año al que van y se restan del que salen; «Pasar los X» rellena justo los que te quedan sin gastar.'],
      ['Coincidencias', 'Los días en que estáis fuera más de uno salen recuadrados, y en la lista «Coincidencias». Al añadir unas vacaciones ves si coinciden con alguien.'],
      ['Cada persona, su color', 'Toca a alguien en la leyenda para ocultarlo o volver a verlo. Tu color se elige en Ajustes → Vacaciones.'],
      ['En Horas', 'Si usas el parte de horas, los días de vacaciones confirmadas cuentan con jornada 0: no restan en el balance ni piden horas.'],
      ['Avisos', 'Cuando alguien de tu equipo añade, cambia o quita unas vacaciones, te llega un aviso (si usas el módulo).'],
      ['Cambiar o quitar', 'Toca uno de tus días de vacaciones para abrirlo; «Quitar» lo borra, con Deshacer.'],
    ],
    to: '/vacaciones',
  },
  {
    id: 'datos',
    icon: ShieldCheck,
    title: 'Deshacer y tus datos',
    intro: 'Nada delicado es irreversible al momento.',
    items: [
      ['Deshacer', 'Borrar una tarjeta, una propiedad, un parte… muestra «Deshacer» durante 8 segundos.'],
      ['Copias', 'Cada noche se hace una copia de seguridad en el servidor. Además, Ajustes → Tus datos → «Exportar todo» descarga un archivo con todo lo tuyo (incluido el parte de horas).'],
      ['Cuentas', 'Las cuentas nuevas las aprueba el administrador antes de poder entrar.'],
    ],
  },
  {
    id: 'apariencia',
    icon: Palette,
    title: 'Apariencia y atajos',
    intro: 'Claro, oscuro o según el sistema, y el tono principal que prefieras. Se guarda en tu perfil: igual en todos tus dispositivos.',
    items: [],
    demo: <ShortcutsDemo />,
    to: '/ajustes',
  },
]

const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function Section({ sec, on, index }) {
  const Icon = sec.icon
  return (
    <section id={sec.id} className="entra scroll-mt-4 rounded-2xl border border-line bg-surface shadow-soft" style={{ '--entra-espera': `${Math.min(index, 6) * 30}ms` }}>
      <header className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-[17px] font-semibold tracking-[-0.015em]">
            {sec.title}
            {sec.module && (
              <span className={cx('rounded-md px-1.5 py-0.5 text-[11px] font-medium', on ? 'bg-accent-soft text-accent' : 'bg-sunken text-muted')}>{on ? 'Módulo activado' : 'Módulo opcional'}</span>
            )}
          </h2>
          <p className="mt-0.5 text-[13.5px] leading-relaxed text-muted">{sec.intro}</p>
        </div>
      </header>
      <div className="px-4 pb-4 pt-1 sm:px-5">
        {sec.items.length > 0 && (
          <dl className="divide-y divide-[var(--line)]">
            {sec.items.map(([t, d]) => (
              <div key={t} className="grid gap-0.5 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-[13.5px] font-medium text-ink">{t}</dt>
                <dd className="text-[13.5px] leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
        )}
        {sec.demo}
        {(sec.to || sec.module) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {sec.module && !on ? (
              <Link to="/ajustes#modulos">
                <Button variant="soft" size="sm">
                  <Zap size={14} /> Activar en Ajustes
                </Button>
              </Link>
            ) : (
              <Link to={sec.to}>
                <Button variant="ghost" size="sm" className="-ml-2.5">
                  Ir a {sec.title.toLowerCase().startsWith('apariencia') ? 'Ajustes' : sec.title} <ArrowRight size={14} />
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export function GuidePage() {
  const user = useStore((s) => s.user)
  const onOf = (sec) => (sec.module === 'vacations' ? vacationsOn(user) : hoursOn(user))
  const [q, setQ] = useState('')
  const { hash } = useLocation()
  const shown = useMemo(() => {
    const n = norm(q.trim())
    if (!n) return SECTIONS
    return SECTIONS.filter((s) => norm([s.title, s.intro, ...s.items.flat()].join(' ')).includes(n))
  }, [q])

  useEffect(() => {
    if (!hash) return
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    return () => clearTimeout(t)
  }, [hash])

  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-8 lg:pt-12">
      <p className="entra text-[13px] font-medium text-faint">Consúltala cuando quieras</p>
      <h1 className="entra mt-1 flex items-center gap-2.5 text-[30px] font-semibold tracking-[-0.03em]" style={{ '--entra-espera': '40ms' }}>
        <BookOpen size={26} className="text-accent" /> Guía
      </h1>
      <p className="entra mt-1.5 max-w-xl text-[15px] text-muted" style={{ '--entra-espera': '80ms' }}>
        Todo lo que hace Mentodo, por partes. Busca algo concreto o salta a una sección.
      </p>

      <div className="entra relative mt-5" style={{ '--entra-espera': '100ms' }}>
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en la guía (p. ej. «repetición», «festivos», «bóveda»)"
          className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-10 text-[16px] text-ink shadow-soft outline-none placeholder:text-faint focus:border-[color-mix(in_oklab,var(--accent)_55%,var(--line))] sm:h-10 sm:text-[15px]"
        />
        {q && (
          <button onClick={() => setQ('')} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-faint hover:bg-hover hover:text-ink">
            <X size={15} />
          </button>
        )}
      </div>

      {!q && (
        <nav className="entra mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3" style={{ '--entra-espera': '120ms' }}>
          {SECTIONS.map((s) => {
            const Icon = s.icon
            return (
              <button key={s.id} onClick={() => go(s.id)} className="flex items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-left text-[13.5px] text-muted transition-colors hover:border-line hover:bg-surface hover:text-ink">
                <Icon size={15} className="shrink-0 text-faint" />
                <span className="truncate">{s.title}</span>
                {s.module && <span className="ml-auto size-1.5 shrink-0 rounded-full" style={{ background: onOf(s) ? 'var(--accent)' : 'var(--faint)' }} />}
              </button>
            )
          })}
        </nav>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {shown.map((sec, i) => (
          <Section key={sec.id} sec={sec} on={onOf(sec)} index={i} />
        ))}
        {shown.length === 0 && <p className="py-12 text-center text-[14px] text-faint">Nada en la guía con «{q}».</p>}
      </div>

      <p className="mt-10 flex items-center justify-center gap-1.5 text-[12.5px] text-faint">
        <Undo2 size={13} /> ¿Algo no está claro o falta? Díselo al administrador.
      </p>
    </div>
  )
}
