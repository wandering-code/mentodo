/* Frases de las horas de más en Ranking: en qué se podría haber ido ese
   tiempo. Cada cosa lleva su duración real en minutos (capítulos y películas
   según su duración habitual) y solo sale si cabe al menos una vez.

   - pos(n, c): la frase entera cuando hay horas de más.
   - tail(n): lo mismo en infinitivo, para cuando alguien salió antes.
   n = cuántas veces cabe (en «pasos» y «rubik», los minutos tal cual).
   c = { span: «3 h 15 min», when: «esta semana» } */

const num = (n) => n.toLocaleString('es-ES')
// «un capítulo» · «3 capítulos»
const q = (n, art, one, many) => (n === 1 ? `${art} ${one}` : `${num(n)} ${many}`)
const veces = (n) => (n === 1 ? 'una vez' : n === 2 ? 'dos veces' : `${num(n)} veces`)
const ep = (n) => q(n, 'un', 'capítulo', 'capítulos')
const rubik = (m) => num(Math.floor((m * 60) / 3.13)) // récord mundial: 3,13 s

export const FACTS = [
  // ── Pasos y paseos (~100 pasos/min, 5 km/h) ──
  { id: 'pasos', min: 1, raw: true,
    pos: (m, c) => `${c.span} de más ${c.when}: ${num(m * 100)} pasos que se ha comido la silla de la oficina.`,
    tail: (m) => `dar ${num(m * 100)} pasos` },
  { id: 'km', min: 12,
    pos: (n, c) => `Con ${c.span} extra ${c.when} se podían haber caminado ${q(n, 'un', 'kilómetro', 'kilómetros')}. Andando. Al aire libre. Eso que hay fuera.`,
    tail: (n) => `caminar ${q(n, 'un', 'kilómetro', 'kilómetros')}` },
  { id: 'camino', min: 12,
    pos: (n, c) => `${c.span} de más ${c.when} = ${q(n, 'un', 'kilómetro', 'kilómetros')} del Camino de Santiago. La Compostela no la dan por quedarse en la oficina.`,
    tail: (n) => `hacer ${q(n, 'un', 'kilómetro', 'kilómetros')} del Camino de Santiago` },
  { id: 'kipchoge', min: 121,
    pos: (n, c) => `En ${c.span} Kipchoge corre ${q(n, 'un', 'maratón', 'maratones')}. Y aquí, mirando el Teams.`,
    tail: (n) => `correr ${q(n, 'un', 'maratón', 'maratones')} al ritmo de Kipchoge` },

  // ── Delta Force y otros juegos ──
  { id: 'delta', min: 25,
    pos: (n, c) => `${c.span} de más ${c.when}: ${q(n, 'una', 'partida', 'partidas')} de Delta Force sin jugar. El escuadrón pregunta por ti.`,
    tail: (n) => `echar ${q(n, 'una', 'partida', 'partidas')} al Delta Force` },
  { id: 'delta-loot', min: 25,
    pos: (n, c) => `Con ${c.span} extra daba para ${q(n, 'una', 'extracción', 'extracciones')} en Delta Force. Seguramente con las manos vacías, pero oye.`,
    tail: (n) => `intentar ${q(n, 'una', 'extracción', 'extracciones')} en Delta Force` },
  { id: 'delta-squad', min: 25,
    pos: (n, c) => `${c.span} extra ${c.when}. Traducido a la única unidad que importa: ${q(n, 'una', 'partida', 'partidas')} de Delta Force.`,
    tail: (n) => `jugar ${q(n, 'una', 'partida', 'partidas')} al Delta Force` },
  { id: 'eafc', min: 15,
    pos: (n, c) => `${c.span} de más ${c.when}: ${q(n, 'un', 'partido', 'partidos')} de EA FC. Y ni un sobre abierto.`,
    tail: (n) => `jugar ${q(n, 'un', 'partido', 'partidos')} de EA FC` },
  { id: 'lol', min: 30,
    pos: (n, c) => `Con ${c.span} extra daba para ${q(n, 'una', 'partida', 'partidas')} de League of Legends. Con su cabreo correspondiente, eso sí.`,
    tail: (n) => `jugar ${q(n, 'una', 'partida', 'partidas')} de LoL` },
  { id: 'clash', min: 3,
    pos: (n, c) => `${c.span} de más ${c.when}: ${q(n, 'una', 'partida', 'partidas')} de Clash Royale en el baño que nunca existieron.`,
    tail: (n) => `jugar ${q(n, 'una', 'partida', 'partidas')} de Clash Royale` },
  { id: 'mario', min: 5,
    pos: (n, c) => `En ${c.span} un speedrunner se pasa Super Mario Bros. ${veces(n)}. Aquí lo que se pasó fue la hora de salir.`,
    tail: (n) => `pasarse Super Mario Bros. ${veces(n)} en modo speedrun` },
  { id: 'rubik', min: 1, raw: true,
    pos: (m, c) => `En ${c.span} el récord mundial resuelve el cubo de Rubik ${rubik(m)} veces. Aquí se resolvieron tickets.`,
    tail: (m) => `resolver el cubo de Rubik ${rubik(m)} veces a ritmo de récord` },
  { id: 'ajedrez', min: 10,
    pos: (n, c) => `${c.span} de más ${c.when}: ${q(n, 'una', 'partida', 'partidas')} de ajedrez a 5 minutos. Jaque mate al tiempo libre.`,
    tail: (n) => `echar ${q(n, 'una', 'partida', 'partidas')} de ajedrez a 5 minutos` },

  // ── Series pochas de DC (capítulo ~42–55 min) ──
  { id: 'flash', min: 42,
    pos: (n, c) => `${c.span} de más ${c.when}: ${ep(n)} de The Flash. Barry habría viajado en el tiempo para salir a su hora.`,
    tail: (n) => `ver ${ep(n)} de The Flash` },
  { id: 'flash-speed', min: 42,
    pos: (n, c) => `Ni Flash corre tanto como para recuperar ${c.span}. Daban para ${ep(n)} suyos.`,
    tail: (n) => `ver ${ep(n)} de The Flash` },
  { id: 'arrow', min: 42,
    pos: (n, c) => `«Has fallado a esta ciudad.» ${c.span} extra ${c.when}, o lo que es lo mismo, ${ep(n)} de Arrow.`,
    tail: (n) => `ver ${ep(n)} de Arrow` },
  { id: 'legends', min: 42,
    pos: (n, c) => `${c.span} de más ${c.when}: ${ep(n)} de Legends of Tomorrow. La Waverider no espera a nadie.`,
    tail: (n) => `ver ${ep(n)} de Legends of Tomorrow` },
  { id: 'batwoman', min: 42,
    pos: (n, c) => `Con ${c.span} extra daba para ${ep(n)} de Batwoman. Alguien tenía que verla.`,
    tail: (n) => `ver ${ep(n)} de Batwoman` },
  { id: 'supergirl', min: 42,
    pos: (n, c) => `${c.span} de más ${c.when} = ${ep(n)} de Supergirl. Ni la kryptonita deja tan tieso.`,
    tail: (n) => `ver ${ep(n)} de Supergirl` },
  { id: 'gotham', min: 44,
    pos: (n, c) => `${c.span} extra ${c.when}: ${ep(n)} de Gotham. Bruce tardó cinco temporadas en ponerse la capa; esto, una jornada en acabar.`,
    tail: (n) => `ver ${ep(n)} de Gotham` },
  { id: 'gotham-knights', min: 42,
    pos: (n, c) => `Con ${c.span} de más daba para ${ep(n)} de Gotham Knights. Casi más de lo que duró en antena.`,
    tail: (n) => `ver ${ep(n)} de Gotham Knights` },
  { id: 'naomi', min: 42,
    pos: (n, c) => `${c.span} de más ${c.when}: ${ep(n)} de Naomi. Una de las tres personas en España que la habrían visto.`,
    tail: (n) => `ver ${ep(n)} de Naomi` },
  { id: 'krypton', min: 42,
    pos: (n, c) => `${c.span} extra ${c.when}, o ${ep(n)} de Krypton. La del abuelo de Superman. Sí, existió.`,
    tail: (n) => `ver ${ep(n)} de Krypton` },
  { id: 'smallville', min: 42,
    pos: (n, c) => `${c.span} de más ${c.when}: ${ep(n)} de Smallville. Diez temporadas sin volar, y aquí sin salir a la hora.`,
    tail: (n) => `ver ${ep(n)} de Smallville` },
  { id: 'titans', min: 45,
    pos: (n, c) => `«F*ck Batman.» ${c.span} extra ${c.when}, o ${ep(n)} de Titans.`,
    tail: (n) => `ver ${ep(n)} de Titans` },
  { id: 'black-lightning', min: 42,
    pos: (n, c) => `Con ${c.span} de más daba para ${ep(n)} de Black Lightning. Electrizante, lo que se dice electrizante, la jornada no fue.`,
    tail: (n) => `ver ${ep(n)} de Black Lightning` },
  { id: 'pennyworth', min: 55,
    pos: (n, c) => `${c.span} de más ${c.when}: ${ep(n)} de Pennyworth. Hasta Alfred libraba antes.`,
    tail: (n) => `ver ${ep(n)} de Pennyworth` },

  // ── Películas de DC para olvidar ──
  { id: 'green-lantern', min: 114,
    pos: (n, c) => `${c.span} de más ${c.when}: daba para ver Green Lantern ${veces(n)}. Con el traje de CGI y todo. Igual mejor quedarse.`,
    tail: (n) => `ver Green Lantern ${veces(n)}` },
  { id: 'catwoman', min: 104,
    pos: (n, c) => `Con ${c.span} extra daba para la Catwoman de Halle Berry ${veces(n)}. No está claro que salga a cuenta.`,
    tail: (n) => `ver la Catwoman de Halle Berry ${veces(n)}` },
  { id: 'steel', min: 97,
    pos: (n, c) => `${c.span} de más ${c.when}: Steel, la de Shaquille O’Neal, ${veces(n)}. Una joya oculta. Muy oculta.`,
    tail: (n) => `ver Steel (la de Shaq) ${veces(n)}` },
  { id: 'batman-robin', min: 125,
    pos: (n, c) => `Con ${c.span} extra daba para Batman y Robin ${veces(n)}. Con sus pezones en el traje y sus chistes de hielo.`,
    tail: (n) => `ver Batman y Robin ${veces(n)}` },
  { id: 'suicide-squad', min: 123,
    pos: (n, c) => `${c.span} de más ${c.when}: Escuadrón Suicida (2016) ${veces(n)}. El Joker del tatuaje «Damaged» lo entendería.`,
    tail: (n) => `ver Escuadrón Suicida (2016) ${veces(n)}` },
  { id: 'justice-league', min: 120,
    pos: (n, c) => `Con ${c.span} extra daba para la Liga de la Justicia de 2017 ${veces(n)}. La del bigote de Superman borrado por ordenador.`,
    tail: (n) => `ver la Liga de la Justicia de 2017 ${veces(n)}` },
  { id: 'snyder-cut', min: 242,
    pos: (n, c) => `${c.span} de más ${c.when}: el Snyder Cut entero ${veces(n)}. Cuatro horas, cámara lenta incluida.`,
    tail: (n) => `ver el Snyder Cut ${veces(n)}` },
  { id: 'bvs', min: 182,
    pos: (n, c) => `«¡¿Por qué has dicho ese nombre?!» ${c.span} extra ${c.when}: Batman v Superman versión extendida ${veces(n)}.`,
    tail: (n) => `ver Batman v Superman extendida ${veces(n)}` },
  { id: 'black-adam', min: 125,
    pos: (n, c) => `${c.span} de más ${c.when}: Black Adam ${veces(n)}. Prometía cambiar la jerarquía de poder del universo DC; la del fichaje, desde luego, la ha cambiado.`,
    tail: (n) => `ver Black Adam ${veces(n)}` },
  { id: 'the-flash-2023', min: 144,
    pos: (n, c) => `Con ${c.span} extra daba para The Flash (2023) ${veces(n)}. Con su CGI de bebés, que no se olvida.`,
    tail: (n) => `ver The Flash (2023) ${veces(n)}` },
  { id: 'aquaman-2', min: 124,
    pos: (n, c) => `${c.span} de más ${c.when}: Aquaman y el reino perdido ${veces(n)}. Lo único perdido aquí es la tarde.`,
    tail: (n) => `ver Aquaman y el reino perdido ${veces(n)}` },
  { id: 'folie', min: 138,
    pos: (n, c) => `Con ${c.span} extra daba para Joker: Folie à Deux ${veces(n)}. Cantando. Mucho. Demasiado.`,
    tail: (n) => `ver Joker: Folie à Deux ${veces(n)}` },

  // ── Otras series y pelis ──
  { id: 'simpson', min: 22,
    pos: (n, c) => `${c.span} de más ${c.when}: ${ep(n)} de Los Simpson. Homer ya estaría en el sofá con una Duff.`,
    tail: (n) => `ver ${ep(n)} de Los Simpson` },
  { id: 'office', min: 22,
    pos: (n, c) => `Con ${c.span} extra daba para ${ep(n)} de The Office. Hasta Michael Scott se iba antes.`,
    tail: (n) => `ver ${ep(n)} de The Office` },
  { id: 'esdla', min: 683,
    pos: (n, c) => `${c.span} de más ${c.when}: la trilogía extendida de El Señor de los Anillos ${n === 1 ? 'entera' : veces(n)}. Un anillo para fichar a todos.`,
    tail: (n) => `ver El Señor de los Anillos extendida ${n === 1 ? 'entera' : veces(n)}` },
  { id: 'titanic', min: 195,
    pos: (n, c) => `Con ${c.span} extra daba para Titanic ${veces(n)}. En la puerta cabían dos; en el horario, por lo visto, no.`,
    tail: (n) => `ver Titanic ${veces(n)}` },

  // ── Cocina ──
  { id: 'tortilla', min: 30,
    pos: (n, c) => `${c.span} de más ${c.when}: ${q(n, 'una', 'tortilla de patatas', 'tortillas de patatas')}. Con cebolla, que aquí no se juzga.`,
    tail: (n) => `hacer ${q(n, 'una', 'tortilla de patatas', 'tortillas de patatas')}` },
  { id: 'paella', min: 60,
    pos: (n, c) => `Con ${c.span} extra salían ${q(n, 'una', 'paella', 'paellas')}. Sin chorizo, que hay gente mirando.`,
    tail: (n) => `hacer ${q(n, 'una', 'paella', 'paellas')}` },
  { id: 'palomitas', min: 3,
    pos: (n, c) => `${c.span} de más ${c.when}: ${q(n, 'una', 'bolsa', 'bolsas')} de palomitas al microondas. Para todas las pelis de DC de esta lista.`,
    tail: (n) => `hacer ${q(n, 'una', 'bolsa', 'bolsas')} de palomitas` },
  { id: 'cafe', min: 5,
    pos: (n, c) => `Con ${c.span} extra daba para ${q(n, 'un', 'café', 'cafés')} de máquina con charla incluida. Que también es trabajo, ¿no?`,
    tail: (n) => `tomarse ${q(n, 'un', 'café', 'cafés')} con charla` },

  // ── Música ──
  { id: 'bohemian', min: 6,
    pos: (n, c) => `${c.span} de más ${c.when}: Bohemian Rhapsody ${veces(n)}. «Is this the real life?» Sí, y sigue siendo la oficina.`,
    tail: (n) => `escuchar Bohemian Rhapsody ${veces(n)}` },
  { id: 'thriller', min: 42,
    pos: (n, c) => `Con ${c.span} extra daba para el Thriller de Michael Jackson entero ${veces(n)}. Lo de quedarse hasta tarde ya es de peli de zombis.`,
    tail: (n) => `escuchar Thriller entero ${veces(n)}` },
  { id: 'despacito', min: 4,
    pos: (n, c) => `${c.span} de más ${c.when}: Despacito ${veces(n)}. Despacito es como se ha ido la tarde.`,
    tail: (n) => `escuchar Despacito ${veces(n)}` },

  // ── Viajes y deporte ──
  { id: 'ave', min: 150,
    pos: (n, c) => `${c.span} de más ${c.when}: daba para ir de Madrid a Barcelona en AVE ${veces(n)}. Y llegar con el portátil cerrado.`,
    tail: (n) => `ir de Madrid a Barcelona en AVE ${veces(n)}` },
  { id: 'canarias', min: 160,
    pos: (n, c) => `Con ${c.span} extra daba para volar de Madrid a Canarias ${veces(n)}. Con el móvil en modo avión, que es lo bonito.`,
    tail: (n) => `volar de Madrid a Canarias ${veces(n)}` },
  { id: 'padel', min: 90,
    pos: (n, c) => `${c.span} de más ${c.when}: ${q(n, 'un', 'partido', 'partidos')} de pádel. La pala criando polvo.`,
    tail: (n) => `jugar ${q(n, 'un', 'partido', 'partidos')} de pádel` },
  { id: 'futbol', min: 105,
    pos: (n, c) => `Con ${c.span} extra daba para ${q(n, 'un', 'partido de fútbol entero', 'partidos de fútbol enteros')}, descanso incluido. El VAR está revisando ese fichaje.`,
    tail: (n) => `ver ${q(n, 'un', 'partido de fútbol entero', 'partidos de fútbol enteros')}` },

  // ── Descanso ──
  { id: 'siesta', min: 20,
    pos: (n, c) => `${c.span} de más ${c.when}: ${q(n, 'una', 'siesta', 'siestas')} de 20 minutos. Patrimonio nacional desperdiciado.`,
    tail: (n) => `echarse ${q(n, 'una', 'siesta', 'siestas')} de 20 minutos` },
  { id: 'pomodoro', min: 25,
    pos: (n, c) => `Con ${c.span} extra salían ${q(n, 'un', 'pomodoro', 'pomodoros')}. Pero de los de uno, no de los de la empresa.`,
    tail: (n) => `hacer ${q(n, 'un', 'pomodoro', 'pomodoros')} por gusto` },
  { id: 'libro', min: 2,
    pos: (n, c) => `${c.span} de más ${c.when}: ${q(n, 'una', 'página', 'páginas')} de ese libro que lleva en la mesilla desde 2023.`,
    tail: (n) => `leer ${q(n, 'una', 'página', 'páginas')} de ese libro pendiente` },
]

/* Número aleatorio fijo para la misma entrada (así la frase no cambia cada
   vez que se recarga el ranking por el socket). */
function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const WHEN = { week: ['esta semana', 'esa semana'], month: ['este mes', 'ese mes'], year: ['este año', 'ese año'] }

const fmtSpan = (m) => {
  const h = Math.floor(m / 60)
  const r = m % 60
  return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`
}

const cap = (s) => s[0].toUpperCase() + s.slice(1)

/* Una frase para cada persona, sin repetir cosa entre las de la lista.
   `seed` cambia al abrir la página: cada visita, frases distintas. */
export function funFacts(people, { seed, period, offset }) {
  const used = new Set()
  const out = {}
  const when = WHEN[period][offset === 0 ? 0 : 1]
  for (const person of people) {
    const m = Math.round(Math.abs(person.extra))
    if (!person.extra_days || m < 1) continue
    const fits = FACTS.filter((f) => m >= f.min)
    const fresh = fits.filter((f) => !used.has(f.id))
    const pool = fresh.length ? fresh : fits
    const h = hash(`${seed}:${person.user_id}:${period}:${offset}`)
    const fact = pool[h % pool.length]
    used.add(fact.id)
    const n = fact.raw ? m : Math.floor(m / fact.min)
    const c = { span: fmtSpan(m), when }
    if (person.extra > 0) {
      out[person.user_id] = cap(fact.pos(n, c))
    } else {
      const what = fact.tail(n)
      const k = (h >>> 8) % 3
      out[person.user_id] = person.me
        ? [`Saliste ${c.span} antes ${when}. Daba para ${what}.`, `${cap(c.span)} que le has arañado al curro ${when}: suficiente para ${what}.`, `Te escapaste ${c.span} antes ${when}. Nadie lo sabrá (salvo este ranking). Daba para ${what}.`][k]
        : [`Salió ${c.span} antes ${when}. Tiempo de sobra para ${what}.`, `${cap(c.span)} arañados al curro ${when}: le daba para ${what}.`, `Se escapó ${c.span} antes ${when}. Bien jugado: daba para ${what}.`][k]
    }
  }
  return out
}
