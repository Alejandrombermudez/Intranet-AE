/**
 * LA BITÁCORA DEL SISTEMA
 * ───────────────────────
 * Qué se decidió, qué cambió y qué se rompió — en orden, con fecha y en español.
 *
 * No es un registro de código: es la memoria de por qué el sistema es como es.
 * Sirve para tres cosas que hoy no tienen dónde vivir:
 *
 *   1. Que alguien nuevo entienda una decisión sin preguntar.
 *   2. Que no se vuelva a discutir algo que ya se cerró (y se sepa por qué se cerró).
 *   3. Que los problemas que costaron trabajo real queden escritos, no en la memoria
 *      de quien estaba ese día.
 *
 * PARA AGREGAR UNA ENTRADA: se escribe arriba del todo, con la fecha del día en
 * que pasó. `porque` es qué estaba mal o qué faltaba; `quedo` es qué hay ahora.
 * Si te sale un párrafo técnico, va en `detalle`, que aparece plegado.
 */

export type TipoEntrada =
  | 'decision' // una discusión que se cerró; se anota también lo que se descartó
  | 'cambio'   // algo que ahora funciona distinto
  | 'problema' // algo que se rompió o que sigue roto
  | 'hito'     // el momento en que algo empezó a usarse de verdad

export const TIPO_LABEL: Record<TipoEntrada, string> = {
  decision: 'Decisión',
  cambio:   'Cambio',
  problema: 'Problema',
  hito:     'Hito',
}

export interface Entrada {
  id: string
  /** AAAA-MM-DD. La fecha en que ocurrió, no en que se escribió. */
  fecha: string
  tipo: TipoEntrada
  titulo: string
  /** Qué pasaba antes, o qué faltaba. Es la mitad que se olvida. */
  porque: string
  /** Qué hay ahora. */
  quedo: string
  /** Etapas del mapa a las que toca (ids de `mapa.ts`). */
  etapas?: string[]
  /** Aplicaciones a las que toca (ids de `mapa.ts`). */
  apps?: string[]
  /** Sigue abierto: no se ha resuelto. */
  abierto?: boolean
  /** Detalle técnico. Se muestra plegado, para quien vaya a tocarlo. */
  detalle?: string
  /** Documento donde está el desarrollo completo. */
  doc?: string
}

/** De lo más reciente a lo más antiguo. */
export const BITACORA: Entrada[] = [
  // ══ Septiembre 2026 ═══════════════════════════════════════════════════════
  {
    id: 'mapa-sistema',
    fecha: '2026-09-09',
    tipo: 'cambio',
    titulo: 'El mapa del sistema reemplaza al diagrama en PDF',
    porque:
      'El diagrama del proceso era un PDF con las cifras escritas a mano. Se desactualizó en tres ' +
      'semanas. Y el estado del sistema estaba escrito en cinco documentos distintos que llegaron a ' +
      'contradecirse: uno decía que la red de árboles semilleros estaba por construir cuando en la ' +
      'base ya había más de dos mil árboles cargados.',
    quedo:
      'Una página dentro de la intranet que dibuja el ecosistema completo —siembra y conservación— y ' +
      'lee las cifras de la base cada vez que se abre. Ya no hay números escritos a mano, así que no ' +
      'se puede quedar vieja por ese lado.',
    detalle:
      'lib/sistema/mapa.ts guarda el grafo (etapas, apps, enlaces) y /api/sistema/pulso hace los ' +
      'conteos con count=exact y head=true, uno por métrica, tolerando que alguna tabla no exista.',
  },
  {
    id: 'predios-proyecto-fuente',
    fecha: '2026-09-08',
    tipo: 'cambio',
    titulo: 'Cada predio dice a qué proyecto pertenece y cómo llegó',
    porque:
      'No se podía responder cuáles predios responden a Conexión Biodiversa y cuáles a Ley del Árbol, ' +
      'ni de dónde salió cada uno: si de una socialización en la vereda, de una convocatoria o de un ' +
      'aliado que lo trajo.',
    quedo:
      'El predio guarda su proyecto y su fuente, ambos ampliables desde el mismo formulario, y el ' +
      'listado de jurídica se puede filtrar por proyecto.',
    etapas: ['juridica'],
    apps: ['intranet'],
    abierto: true,
    detalle:
      'Los 111 predios cargados antes de esta fecha nacieron con el campo vacío. Hasta clasificarlos, ' +
      'el filtro por proyecto solo sirve a medias — hay un filtro «Sin proyecto asignado» para ir ' +
      'trabajándolos.',
    doc: 'PENDIENTES_INTEGRACION.md',
  },
  {
    id: 'app-actividades-repo',
    fecha: '2026-09-05',
    tipo: 'cambio',
    titulo: 'La app de actividades y bodega se muda a su propio repositorio',
    porque:
      'Vivía dentro del repositorio de las apps de aves y semilleros, con las que no comparte nada: ' +
      'ni el público, ni el dominio, ni el ritmo de cambios.',
    quedo:
      'Repositorio propio con su despliegue aparte. Se entra por título de trabajo —BODEGA, SIEMBRA, ' +
      'MONITOREO— y no por persona: en campo importa qué estás haciendo, no quién eres.',
    apps: ['app_actividades'],
    etapas: ['ejecucion'],
  },
  {
    id: 'app-semilleros',
    fecha: '2026-09-02',
    tipo: 'hito',
    titulo: 'Monitoreo fenológico de los semilleros de Solano',
    porque:
      'Saber cuándo un árbol florece y fructifica es lo que permite programar la recolecta de semilla. ' +
      'Se llevaba en papel.',
    quedo:
      'App de campo con las rondas de monitoreo, las veredas y el protocolo, cargada con el histórico ' +
      'de abril a agosto.',
    apps: ['app_semilleros'],
    etapas: ['ras_monitoreo'],
    abierto: true,
    detalle: 'Guarda en el teléfono. Todavía no escribe en las tablas de conservación.',
  },
  {
    id: 'expediente-imprimible',
    fecha: '2026-09-02',
    tipo: 'cambio',
    titulo: 'El expediente de un predio cabe en un solo documento',
    porque:
      'Para mirar un predio completo —o entregárselo a alguien de fuera— tocaba recorrer cuatro ' +
      'pantallas distintas y armar el documento a mano: jurídica en un lado, la cartografía en otro, ' +
      'la evaluación y la encuesta en la app de campo.',
    quedo:
      'Un informe por predio que reúne lo predial, lo jurídico, la cartografía, las correcciones de ' +
      'terreno, la evaluación y la encuesta. Diseñado para imprimir, no para mirar en pantalla.',
    etapas: ['juridica', 'sig_i', 'campo'],
    apps: ['intranet'],
    detalle:
      'Todo sale de una sola ruta de API que es la única que conoce la forma del expediente; las ' +
      'páginas no consultan schemas por su cuenta. De paso, el mapa dejó de caerse entero cuando una ' +
      'geometría venía corrupta: ahora omite esa capa y avisa.',
  },

  // ══ Agosto 2026 ═══════════════════════════════════════════════════════════
  {
    id: 'monitoreo-sembrado',
    fecha: '2026-08-24',
    tipo: 'cambio',
    titulo: 'Monitoreo de lo sembrado, por núcleos y con mapa sin señal',
    porque:
      'Se estaba registrando la siembra pero no lo que pasaba después: cuánto de lo sembrado seguía vivo.',
    quedo:
      'Módulo de monitoreo dentro de la app de campo de actividades, con los núcleos como botones ' +
      'grandes y un mapa de apoyo que funciona sin señal.',
    apps: ['app_actividades'],
    etapas: ['ejecucion'],
  },
  {
    id: 'aviso-version',
    fecha: '2026-08-20',
    tipo: 'cambio',
    titulo: 'Las apps de campo avisan cuando hay versión nueva',
    porque:
      'Un celular con la app ya instalada seguía abriendo la copia vieja desde su memoria. La única ' +
      'salida era desinstalar y volver a instalar, en campo, sin señal.',
    quedo:
      'Cuando hay versión nueva aparece una barra con un botón Actualizar. La persona decide cuándo ' +
      'recargar; la app no se reinicia sola en mitad de un formulario.',
    apps: ['app_aves', 'app_semilleros', 'app_actividades'],
    detalle:
      'Exige subir el número de VERSION en el sw.js de ese repositorio cada vez que se cambia algo. Si ' +
      'se olvida, los teléfonos ya instalados no se enteran de nada.',
  },
  {
    id: 'campo-productivo',
    fecha: '2026-08-13',
    tipo: 'hito',
    titulo: 'La app de campo entra en uso productivo',
    porque:
      'Hasta entonces era una prueba: predios de ensayo, datos que se podían botar. El ciclo completo ' +
      'oficina → terreno → oficina nunca se había cerrado con información real.',
    quedo:
      'Predios y evaluadores reales en Versalles y La Dalia. Desde aquí, cualquier error en la ' +
      'sincronización o en las geometrías le cuesta trabajo a alguien que ya caminó el predio.',
    etapas: ['campo'],
    apps: ['app_campo'],
  },
  {
    id: 'sig-ve-campo',
    fecha: '2026-08-12',
    tipo: 'cambio',
    titulo: 'La oficina puede ver qué pasó en el terreno',
    porque:
      'El SIG mandaba predios a campo y no tenía dónde ver qué había vuelto: ni las correcciones, ni ' +
      'los formularios. El ciclo estaba abierto por el lado de la oficina.',
    quedo:
      'Una pestaña de resultados de campo con el mapa de antes y después, la bitácora de qué se hizo ' +
      'con cada zona y los dos formularios. Además, el tablero dejó de ser una lista plana de 111 ' +
      'nombres y pasó a organizarse por fase cartográfica.',
    etapas: ['sig_i', 'campo'],
    apps: ['intranet'],
  },
  {
    id: 'exportar-shapefile',
    fecha: '2026-08-12',
    tipo: 'cambio',
    titulo: 'La geometría puede volver a salir del sistema',
    porque:
      'El SIG podía meter shapefiles pero no sacarlos. La corrección hecha en terreno se quedaba ' +
      'encerrada en la base, sin forma de llevarla al programa de escritorio donde se trabaja.',
    quedo: 'Descarga de las zonas y las correcciones como shapefile, con sus atributos.',
    etapas: ['sig_i'],
    apps: ['intranet'],
  },
  {
    id: 'confirmar-borraba',
    fecha: '2026-08-06',
    tipo: 'problema',
    titulo: 'Confirmar una zona borraba el límite que se había dibujado en campo',
    porque:
      'Si alguien corregía el límite de una zona y después le daba «confirmar», la acción posterior ' +
      'anulaba la geometría corregida. Se perdió trabajo real de terreno.',
    quedo:
      'Corregido. Y quedó como regla del proyecto: una acción posterior nunca anula una geometría ya ' +
      'levantada en campo. Es la razón de fondo por la que el SIG versiona en vez de sobrescribir.',
    etapas: ['campo', 'sig_i'],
    apps: ['app_campo'],
  },
  {
    id: 'versionado-sig',
    fecha: '2026-08-05',
    tipo: 'decision',
    titulo: 'El SIG versiona en vez de borrar',
    porque:
      'Al resubir cartografía, el sistema borraba lo anterior. Los identificadores de zona que el ' +
      'celular ya tenía descargados desaparecían, y la corrección hecha en campo no se podía aplicar ' +
      'nunca: llegaba a una zona que ya no existía.',
    quedo:
      'Cada subida entra como un lote con versión. Lo reemplazado deja de estar vigente pero queda ' +
      'consultable. Y la corrección de campo nunca falla porque la oficina haya cambiado algo: si la ' +
      'zona fue retirada, revive; si desapareció, se recrea con la copia que manda el celular.',
    etapas: ['sig_i', 'campo'],
    doc: 'ARQUITECTURA_DATOS.md',
    detalle:
      'Cuando el cierre de un lote encuentra zonas que campo ya trabajó, no las retira: las marca como ' +
      'conflicto para resolverlas mirando las dos versiones.',
  },
  {
    id: 'campo-actualiza-sin-perder',
    fecha: '2026-08-05',
    tipo: 'cambio',
    titulo: 'El celular puede recibir cartografía nueva sin perder lo levantado',
    porque:
      'Actualizar un predio desde el SIG significaba, en la práctica, arriesgar el trabajo que el ' +
      'evaluador ya tenía en el teléfono.',
    quedo: 'La actualización reconcilia lo nuevo con lo que ya estaba, sin tumbar el trabajo de terreno.',
    etapas: ['campo'],
    apps: ['app_campo'],
  },

  // ══ Julio 2026 ════════════════════════════════════════════════════════════
  {
    id: 'sig-ii-sincroniza',
    fecha: '2026-07-28',
    tipo: 'hito',
    titulo: 'Las correcciones de terreno llegan a la base',
    porque:
      'La verificación cartográfica se hacía en campo pero se quedaba en el teléfono: la oficina ' +
      'seguía trabajando sobre el dibujo original.',
    quedo:
      'Lo que el evaluador decide sobre cada zona —confirmarla, modificarla, agregar una nueva o ' +
      'descartarla— queda registrado con su geometría. Se cierra el ciclo oficina → terreno → oficina.',
    etapas: ['campo', 'sig_i'],
    apps: ['app_campo'],
  },
  {
    id: 'key-expuesta',
    fecha: '2026-07-09',
    tipo: 'problema',
    titulo: 'Una llave de acceso a la base quedó escrita dentro del código',
    porque:
      'Un script de carga tenía la clave de administrador de Supabase escrita literalmente, en un ' +
      'repositorio público. Estuvo expuesta dos meses.',
    quedo:
      'Se reescribió el historial del repositorio para sacarla. Desde entonces, ninguna clave se ' +
      'escribe en el código: siempre se lee de un archivo de configuración que no se sube.',
  },
  {
    id: 'sig-obligatorio',
    fecha: '2026-07-08',
    tipo: 'decision',
    titulo: 'No se manda un predio a campo sin cartografía',
    porque:
      'Se podían enviar predios a terreno sin zonas cargadas. El evaluador llegaba al predio sin nada ' +
      'que verificar y la visita se perdía.',
    quedo:
      'El sistema lo impide en dos puntos independientes: al intentar enviar el predio, y en la lista ' +
      'misma que el celular puede descargar. Uno solo habría sido fácil de saltarse.',
    etapas: ['sig_i', 'campo'],
    doc: 'ARQUITECTURA_DATOS.md',
  },
  {
    id: 'catalogo-especies',
    fecha: '2026-07-02',
    tipo: 'hito',
    titulo: 'Una sola lista de especies para todo el sistema',
    porque:
      'Cada módulo escribía los nombres de las especies por su cuenta. La misma planta terminaba con ' +
      'tres nombres distintos según quién la hubiera escrito, y sumar era imposible.',
    quedo:
      'Un maestro único de especies que comparten la red de semilleros, el plan de siembra y el ' +
      'vivero. Nadie más guarda taxonomía por su cuenta.',
    etapas: ['plan', 'ras_arboles'],
    doc: 'ARQUITECTURA_DATOS.md',
  },
  {
    id: 'red-arboles',
    fecha: '2026-07-02',
    tipo: 'hito',
    titulo: 'El árbol semillero pasa a ser una entidad con nombre propio',
    porque:
      'La conservación solo guardaba conteos —«este predio tiene tantos árboles»— y un archivo de ' +
      'puntos anónimos. No se podía consultar un árbol, ni corregir su especie, ni seguirlo en el tiempo.',
    quedo:
      'Cada árbol es una fila con su código, su punto GPS, su medición y su especie enlazada al ' +
      'maestro. El conteo del predio se calcula solo, en vez de escribirse a mano.',
    etapas: ['ras_arboles'],
    doc: 'ARQUITECTURA_DATOS.md',
  },

  // ══ Junio 2026 — las decisiones de fondo ══════════════════════════════════
  {
    id: 'd3-no-fusionar',
    fecha: '2026-06-27',
    tipo: 'decision',
    titulo: 'Siembra y Conservación no se fusionan',
    porque:
      'Se evaluó juntarlas en un solo modelo de «intervenciones» para no repetir estructuras parecidas. ' +
      'Sobre el papel evitaba duplicación.',
    quedo:
      'Descartado. Son dos negocios distintos: siembra es un proceso por el que un predio avanza una ' +
      'vez; conservación es un inventario de árboles que se monitorea en el tiempo. Juntarlas habría ' +
      'obligado a que cada consulta preguntara «¿de cuál de los dos estamos hablando?». Se prefirió ' +
      'claridad de dominios sobre ahorro de tablas. No volver a plantearlo.',
    doc: 'ARQUITECTURA_ECOSISTEMA.md',
    detalle: 'Decisión D3, descartada. La ambigüedad de la sigla «RAS» viene de aquí.',
  },
  {
    id: 'd5-vivero-aparte',
    fecha: '2026-06-19',
    tipo: 'decision',
    titulo: 'El vivero será una app aparte, no un módulo de la intranet',
    porque:
      'El vivero trabaja distinto al resto: su ritmo es diario, su gente no está en la oficina y ' +
      'necesita funcionar sin depender de la intranet.',
    quedo: 'App independiente que sincroniza con el sistema. Decisión cerrada, falta construirla.',
    etapas: ['vivero'],
    doc: 'ARQUITECTURA_ECOSISTEMA.md',
  },
  {
    id: 'd1-expediente',
    fecha: '2026-06-19',
    tipo: 'decision',
    titulo: 'El expediente es lo que dice en qué etapa va cada predio',
    porque:
      'No había forma de responder «¿dónde está este predio hoy?» sin abrir cuatro módulos y ' +
      'reconstruirlo de memoria.',
    quedo:
      'Cada predio tiene un expediente con su etapa, y avanzar de etapa es una acción explícita del ' +
      'sistema. De ahí sale el tablero de «en qué va cada predio».',
    etapas: ['juridica'],
    doc: 'ARQUITECTURA_ECOSISTEMA.md',
  },
  {
    id: 'cutover-core',
    fecha: '2026-06-18',
    tipo: 'decision',
    titulo: 'La persona y el predio se escriben una sola vez',
    porque:
      'Jurídica, siembra y conservación guardaban cada una su propia copia del nombre, el municipio y ' +
      'la vereda. El mismo señor con tres predios aparecía tres veces, y corregir un dato significaba ' +
      'corregirlo en tres lados —o dejarlo mal en dos.',
    quedo:
      'Un núcleo compartido: la persona, el predio y el expediente viven en un solo lugar y los demás ' +
      'módulos los referencian en vez de copiarlos. Jurídica, que es la puerta de entrada, escribe ahí.',
    doc: 'CORE_MIGRACION.md',
    detalle:
      'Se pudo hacer de golpe porque los datos existentes eran de prueba. Si un módulo todavía guarda ' +
      'nombre o municipio por su cuenta, es deuda del rediseño, no el patrón a seguir.',
  },
  {
    id: 'juridica-primero',
    fecha: '2026-05-26',
    tipo: 'hito',
    titulo: 'Jurídica se vuelve la puerta de entrada del proceso',
    porque:
      'Los predios entraban al sistema por donde fuera. Sin verificar antes la propiedad, se gastaba ' +
      'cartografía y visitas de campo en predios que después no se podían vincular.',
    quedo:
      'Ningún predio entra al proceso sin pasar por debida diligencia. Es la primera etapa de la ' +
      'cadena y la única puerta.',
    etapas: ['juridica'],
    apps: ['intranet'],
  },
]

// ─── Lo que está roto o pendiente hoy ─────────────────────────────────────────

/**
 * Los frentes abiertos, dichos sin adornos. Se muestran juntos porque leerlos en
 * fila es la forma más rápida de saber qué le falta al sistema.
 */
export interface Frente {
  id: string
  titulo: string
  cuerpo: string
  etapas?: string[]
  /** Qué se pierde mientras siga así. */
  costo: string
}

export const FRENTES_ABIERTOS: Frente[] = [
  {
    id: 'campo-sin-base',
    titulo: 'Tres apps de campo guardan solo en el teléfono',
    cuerpo:
      'Las apps de actividades y bodega, de aves y de semilleros funcionan y se usan, pero ninguna ' +
      'escribe en la base. Lo que se registra vive en la memoria del aparato de cada persona.',
    costo:
      'Si se pierde o se formatea un teléfono, se pierde ese trabajo. Y nada de eso se puede ' +
      'consolidar, cruzar con el resto del sistema ni reportar.',
    etapas: ['ejecucion', 'ras_monitoreo'],
  },
  {
    id: 'lote-vacio',
    titulo: 'El versionado del SIG no se ha estrenado',
    cuerpo:
      'La cartografía se versiona desde el 5 de agosto, pero no ha entrado ninguna subida nueva desde ' +
      'entonces: la tabla de lotes sigue vacía.',
    costo:
      'La protección más importante contra la pérdida de correcciones de terreno nunca se ha probado ' +
      'con una subida real.',
    etapas: ['sig_i'],
  },
  {
    id: 'arboles-sin-especie',
    titulo: 'Buena parte de la red de semilleros sigue sin especie confirmada',
    cuerpo:
      'Los árboles están cargados y georreferenciados, pero muchos conservan el nombre que se les puso ' +
      'en campo, a la espera de la determinación botánica.',
    costo:
      'Sin especie confirmada no se puede saber de cuáles especies hay semilla disponible, que es ' +
      'justamente para lo que existe la red.',
    etapas: ['ras_arboles'],
  },
  {
    id: 'conservacion-suelta',
    titulo: 'Conservación no está conectada al núcleo compartido',
    cuerpo:
      'Las familias en conservación se identifican aparte, sin enlazar a la persona y el predio del ' +
      'núcleo. Es la misma duplicación que se resolvió en siembra en junio.',
    costo:
      'Una familia que además tiene un predio en restauración aparece dos veces, y no hay forma de ' +
      'saber que es la misma.',
    etapas: ['ras_familias'],
  },
  {
    id: 'los-andes',
    titulo: 'Un predio mide 315 hectáreas y en el registro tiene 65',
    cuerpo:
      'El predio Los Andes tiene dos polígonos de finca cargados. O el archivo es el equivocado, o son ' +
      'varios predios metidos en uno.',
    costo: 'Cualquier cálculo de área o de plántulas sobre ese predio va a estar mal hasta resolverlo.',
    etapas: ['sig_i'],
  },
  {
    id: 'docs-contradictorios',
    titulo: 'Los documentos de arquitectura se contradicen entre sí',
    cuerpo:
      'Sobre la red de árboles semilleros, un documento dice que está por construir, otro dice 523 ' +
      'filas, y la base tiene más de dos mil. Los tres se escribieron en momentos distintos y ninguno ' +
      'se retiró.',
    costo:
      'Quien llegue nuevo va a creerle al documento equivocado. Es la razón por la que las cifras de ' +
      'esta página se leen de la base y no se escriben.',
  },
]

// ─── Los documentos de fondo ──────────────────────────────────────────────────

/**
 * Los documentos maestros siguen siendo la fuente: viven en git, los edita
 * cualquiera y no se duplican aquí. Esta página los muestra, no los reemplaza.
 */
export interface Documento {
  archivo: string
  titulo: string
  de_que_trata: string
  para_quien: 'equipo' | 'construccion'
}

export const DOCUMENTOS: Documento[] = [
  {
    archivo: 'EMPEZAR_AQUI.md',
    titulo: 'Empezar aquí',
    de_que_trata: 'El punto de entrada: qué leer, en qué orden y qué asumir.',
    para_quien: 'construccion',
  },
  {
    archivo: 'ARQUITECTURA_DATOS.md',
    titulo: 'Arquitectura de datos',
    de_que_trata:
      'Todas las tablas del sistema, cómo se relacionan y en qué estado está cada una. Es la base ' +
      'para cualquier cambio de datos.',
    para_quien: 'construccion',
  },
  {
    archivo: 'ARQUITECTURA_ECOSISTEMA.md',
    titulo: 'Arquitectura del ecosistema',
    de_que_trata: 'Las cuatro vistas del sistema y el desarrollo completo de las decisiones D1 a D5.',
    para_quien: 'construccion',
  },
  {
    archivo: 'PENDIENTES_INTEGRACION.md',
    titulo: 'Pendientes por módulo',
    de_que_trata: 'El backlog vivo: qué falta en cada módulo y desde cuándo.',
    para_quien: 'construccion',
  },
  {
    archivo: 'CONTEXTO_MODULO_SIG.md',
    titulo: 'Cómo funciona el SIG',
    de_que_trata: 'El detalle del módulo de cartografía y de la relación entre la oficina y el terreno.',
    para_quien: 'construccion',
  },
  {
    archivo: 'CORE_MIGRACION.md',
    titulo: 'El núcleo compartido',
    de_que_trata: 'Por qué la persona y el predio se escriben una sola vez, y cómo se llegó ahí.',
    para_quien: 'construccion',
  },
  {
    archivo: 'INDICADORES_RAS.md',
    titulo: 'Indicadores de conservación',
    de_que_trata: 'Qué se mide en la Red de Árboles Semilleros y cómo.',
    para_quien: 'equipo',
  },
  {
    archivo: 'INTRANET_DESCRIPCION.md',
    titulo: 'Qué es la intranet',
    de_que_trata: 'Descripción general de la plataforma y sus módulos.',
    para_quien: 'equipo',
  },
  {
    archivo: 'CRONOGRAMA.md',
    titulo: 'Cronograma',
    de_que_trata: 'Las fases previstas y en qué orden se construyen.',
    para_quien: 'equipo',
  },
]

// ─── Utilidades ───────────────────────────────────────────────────────────────

export function entradasDeEtapa(etapaId: string): Entrada[] {
  return BITACORA.filter((e) => e.etapas?.includes(etapaId))
}

export function entradasDeApp(appId: string): Entrada[] {
  return BITACORA.filter((e) => e.apps?.includes(appId))
}

export function frentesDeEtapa(etapaId: string): Frente[] {
  return FRENTES_ABIERTOS.filter((f) => f.etapas?.includes(etapaId))
}

/** Agrupa la bitácora por mes, para pintarla como línea de tiempo. */
export function porMes(entradas: Entrada[]): { mes: string; etiqueta: string; entradas: Entrada[] }[] {
  const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  const mapa = new Map<string, Entrada[]>()
  for (const e of entradas) {
    const mes = e.fecha.slice(0, 7)
    const lista = mapa.get(mes)
    if (lista) lista.push(e)
    else mapa.set(mes, [e])
  }
  return [...mapa.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([mes, entradas]) => {
      const [anio, m] = mes.split('-')
      return { mes, etiqueta: `${MESES[Number(m) - 1]} de ${anio}`, entradas }
    })
}

/** «8 de septiembre de 2026». Sin `new Date`, que se corre un día por zona horaria. */
export function fechaLarga(iso: string): string {
  const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  const [anio, mes, dia] = iso.split('-')
  return `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${anio}`
}
