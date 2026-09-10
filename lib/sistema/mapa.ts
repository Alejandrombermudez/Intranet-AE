/**
 * EL MAPA DEL SISTEMA
 * ───────────────────
 * Este archivo es el contenido del diagrama: las etapas por las que pasa el
 * trabajo, las aplicaciones que las ejecutan y lo que va de una a otra.
 *
 * Reemplaza a `docs/flujo-trabajo.html`, que dibujaba lo mismo con coordenadas
 * SVG escritas a mano y por eso se quedaba viejo cada vez que algo cambiaba.
 *
 * REGLA: aquí NO se escriben cifras. Ninguna. Los conteos (cuántos predios,
 * cuántas zonas, cuántos árboles) los pide la página a `/api/sistema/pulso`,
 * que los lee de Supabase en el momento. Si ves un número escrito a mano en
 * este archivo, está mal y va a mentir dentro de tres semanas.
 *
 * Lo que sí se escribe a mano: qué hace cada etapa, quién la hace, con qué app
 * y sobre qué tablas. Eso cambia poco y cuando cambia hay que decirlo.
 */

// ─── Vocabulario ──────────────────────────────────────────────────────────────

/** En qué punto de su construcción está una etapa. */
export type Estado =
  | 'produccion'    // corriendo con datos reales en Supabase
  | 'en_curso'      // hay trabajo hecho y gente usándolo, pero no escribe en Supabase
  | 'por_construir' // diseñado y decidido, sin implementar

export const ESTADO_LABEL: Record<Estado, string> = {
  produccion:    'En producción',
  en_curso:      'En curso',
  por_construir: 'Por construir',
}

/** Cómo se dice cada estado sin jerga, para quien no construye el sistema. */
export const ESTADO_EXPLICACION: Record<Estado, string> = {
  produccion:    'Se está usando con información real y queda guardada.',
  en_curso:      'Se está usando, pero lo que se registra todavía no llega a la base de datos central.',
  por_construir: 'Está decidido cómo se va a hacer; falta hacerlo.',
}

export type DominioId = 'siembra' | 'conservacion' | 'nucleo' | 'soporte'

export interface Dominio {
  id: DominioId
  nombre: string
  /** Una frase. Qué es este dominio para alguien que llega hoy al equipo. */
  resumen: string
  /** Por qué está separado de los demás — el error que evita tenerlo aparte. */
  frontera?: string
  color: string
}

/**
 * Los cuatro bloques del sistema. Siembra y Conservación NO se tocan: se decidió
 * explícitamente no fusionarlas (decisión D3, descartada el 27 de junio de 2026).
 */
export const DOMINIOS: Dominio[] = [
  {
    id: 'siembra',
    nombre: 'Siembra · Restauración',
    resumen:
      'El recorrido completo de un predio que va a ser restaurado: desde que la abogada lo revisa ' +
      'hasta que el árbol queda sembrado y monitoreado.',
    frontera:
      'Es un proceso con principio y fin, y cada predio avanza por él una sola vez. Por eso se dibuja ' +
      'como una cadena y no como un conjunto de módulos sueltos.',
    color: '#2f3f32',
  },
  {
    id: 'conservacion',
    nombre: 'Conservación · Red de Árboles Semilleros',
    resumen:
      'Familias que conservan bosque en pie y alojan los árboles semilleros de los que sale la semilla. ' +
      'Aquí la entidad central es el árbol, no el predio.',
    frontera:
      'No comparte tablas ni flujo con Siembra. Un predio en conservación no "avanza" por etapas: se ' +
      'inventaría, se georreferencia y se monitorea en el tiempo. Confundir los dos dominios es el error ' +
      'más común del proyecto, en parte porque «RAS» significa dos cosas distintas: aquí es el dominio ' +
      'de conservación; en el proceso de restauración es el nombre del equipo.',
    color: '#7a7847',
  },
  {
    id: 'nucleo',
    nombre: 'Núcleo compartido',
    resumen:
      'Lo que los dos dominios usan sin duplicar: quién es la persona, cuál es el predio, dónde queda ' +
      'el polígono y cómo se llama cada especie.',
    frontera:
      'Una persona se escribe una vez aunque tenga tres predios; una especie se nombra una vez aunque ' +
      'la usen el vivero, el plan y la red de semilleros.',
    color: '#385161',
  },
  {
    id: 'soporte',
    nombre: 'Soporte · Administración',
    resumen:
      'Lo que hace funcionar la operación pero no es ni siembra ni conservación: usuarios y permisos, ' +
      'vehículos, sesiones del equipo ejecutivo, consentimientos de tratamiento de datos.',
    color: '#b8a28e',
  },
]

// ─── Aplicaciones ─────────────────────────────────────────────────────────────

/**
 * Donde se usa cada aplicacion. Sirve de encabezado al agrupar la lista, asi
 * que se nombra por el lugar de trabajo y no por la tecnologia: al equipo le
 * dice mas «en el celular, en campo» que «PWA».
 */
export type ClaseApp =
  | 'En la oficina'
  | 'En el celular, en campo'
  | 'Abierto al público'
  | 'Todavía fuera del sistema'

export interface Aplicacion {
  id: string
  nombre: string
  clase: ClaseApp
  estado: Estado
  /** Dónde se abre, dicho como lo diría alguien del equipo. */
  donde: string
  /** Qué resuelve. Una o dos frases, sin tecnicismos. */
  para: string
  /** Funciona sin señal. Importante en Caquetá: en el predio casi nunca hay. */
  offline?: boolean
  /** Carpeta del ecosistema, para quien vaya a tocar el código. */
  carpeta: string
  /** Nota técnica — se muestra plegada, no en primer plano. */
  tecnica?: string
}

export const APLICACIONES: Aplicacion[] = [
  {
    id: 'intranet',
    nombre: 'Intranet',
    clase: 'En la oficina',
    estado: 'produccion',
    donde: 'En el computador de la oficina, entrando con el correo de la organización.',
    para:
      'Es la mesa de trabajo de la oficina: jurídica, cartografía, expedientes, el catálogo de especies, ' +
      'conservación y los informes.',
    carpeta: 'Intranet-AE/',
    tecnica: 'Next.js 16 · Supabase con service role en las rutas de API · acceso por people.user_profiles.',
  },
  {
    id: 'app_campo',
    nombre: 'App de campo',
    clase: 'En el celular, en campo',
    estado: 'produccion',
    offline: true,
    donde: 'En el celular del evaluador, instalada como aplicación.',
    para:
      'Todo lo que se hace parado en el predio: la evaluación del terreno, la encuesta a la familia y ' +
      'la corrección de las zonas sobre el mapa satelital. Guarda en el celular y sube cuando hay señal.',
    carpeta: 'app_campo/',
    tecnica: 'PWA con Vite · Leaflet + leaflet-geoman para editar vértices · cola de sincronización local.',
  },
  {
    id: 'app_actividades',
    nombre: 'App de actividades y bodega',
    clase: 'En el celular, en campo',
    estado: 'en_curso',
    offline: true,
    donde: 'En el celular, desde el navegador. Se entra por título de trabajo: BODEGA, SIEMBRA o MONITOREO.',
    para:
      'Registrar lo que se hizo y con qué: actividades y rendimientos por lote y núcleo, insumos ' +
      'consumidos, movimientos entre bodegas y el monitoreo de lo ya sembrado.',
    carpeta: 'actividades_monitoreo_campo/',
    tecnica:
      'HTML estático desplegado en Vercel. Guarda en localStorage del teléfono: todavía NO escribe en ' +
      'Supabase, así que lo registrado vive solo en ese aparato.',
  },
  {
    id: 'app_semilleros',
    nombre: 'App de semilleros',
    clase: 'En el celular, en campo',
    estado: 'en_curso',
    offline: true,
    donde: 'En el celular, desde el navegador.',
    para: 'Monitoreo fenológico de los árboles semilleros: quién está floreciendo, quién está en fruto.',
    carpeta: 'insumos_aves/semilleros/',
    tecnica: 'HTML estático en Vercel, junto con la app de aves. Pendiente de conectar a ras.',
  },
  {
    id: 'app_aves',
    nombre: 'App de aves',
    clase: 'En el celular, en campo',
    estado: 'en_curso',
    offline: true,
    donde: 'En el celular, desde el navegador.',
    para: 'Avistamiento de aves con GPS y curva de acumulación de especies, como indicador de biodiversidad.',
    carpeta: 'insumos_aves/aves/',
    tecnica: 'HTML estático en Vercel. Pendiente de conectar a la base.',
  },
  {
    id: 'geoae',
    nombre: 'Geoportal',
    clase: 'Abierto al público',
    estado: 'produccion',
    donde: 'Abierto en internet, sin contraseña.',
    para: 'Mostrar hacia afuera dónde están las fincas, los árboles y las proyecciones de siembra.',
    carpeta: 'GeoAE/',
    tecnica: 'Next.js · lee core/geo/ras. Al ser público, define qué información es publicable.',
  },
  {
    id: 'app_vivero',
    nombre: 'App de vivero',
    clase: 'Todavía fuera del sistema',
    estado: 'por_construir',
    donde: 'Todavía no existe. Hoy el vivero se lleva en Excel.',
    para:
      'Producir plántulas contra el pedido del plan de siembra y saber cuánto cuesta realmente cada una.',
    carpeta: 'app_vivero/',
    tecnica: 'Decidido como app aparte que sincroniza (decisión D5). Falta el schema vivero y la app.',
  },
]

export const APP_POR_ID = new Map(APLICACIONES.map((a) => [a.id, a]))

// ─── Etapas ───────────────────────────────────────────────────────────────────

/** Una tabla o vista de la base, dicha en una línea. Va en el detalle técnico. */
export interface Dato {
  nombre: string
  que: string
  estado?: Estado
}

/** Lo que hay que cumplir para pasar a la etapa siguiente. */
export interface Compuerta {
  titulo: string
  /** Por qué existe y qué pasa si no se cumple. En lenguaje de proceso. */
  explicacion: string
  /** Si el sistema lo impide de verdad, o si por ahora es solo un acuerdo del equipo. */
  bloquea: boolean
}

export interface Etapa {
  id: string
  dominio: DominioId
  nombre: string
  responsable: string
  estado: Estado
  /** Qué le llega a esta etapa y de dónde. */
  recibe: string
  /** Los pasos que ocurren dentro. Tres o cuatro, no la lista completa. */
  hace: string[]
  /** Qué sale de aquí. Es la promesa de la etapa a la siguiente. */
  entrega: string
  /** Aplicaciones que la ejecutan, con el papel que cumple cada una AQUÍ. */
  apps: { app: string; rol: string }[]
  /** Compuerta de SALIDA: lo que hay que cumplir para avanzar. */
  compuerta?: Compuerta
  /** Tablas donde queda el resultado. Detalle técnico, plegado por defecto. */
  datos: Dato[]
  /** Métricas vivas que describen esta etapa (ids de /api/sistema/pulso). */
  pulso: string[]
  /** Lo que todavía no funciona aquí, dicho sin rodeos. */
  pendiente?: string
}

export const ETAPAS: Etapa[] = [
  // ══ SIEMBRA ═══════════════════════════════════════════════════════════════
  {
    id: 'juridica',
    dominio: 'siembra',
    nombre: 'Jurídica',
    responsable: 'Abogada',
    estado: 'produccion',
    recibe:
      'Un predio que aparece por socialización en la vereda, porque lo trae un aliado o porque el ' +
      'propietario se acerca.',
    hace: [
      'Identifica al propietario y verifica que el predio sea suyo.',
      'Revisa las matrículas —un solo polígono puede estar bajo varias— y los antecedentes.',
      'Hace el análisis jurídico y le pone semáforo al predio.',
      'Clasifica el predio por proyecto (Conexión Biodiversa, Ley del Árbol) y por cómo llegó.',
    ],
    entrega: 'Un predio con dueño verificado y semáforo, listo para que la oficina lo cartografíe.',
    apps: [{ app: 'intranet', rol: 'Formularios de debida diligencia y el listado de predios' }],
    compuerta: {
      titulo: 'Semáforo jurídico',
      explicacion:
        'Un predio en rojo no pasa a cartografía. El semáforo resume si la propiedad está limpia; sin ' +
        'él no tiene sentido gastar trabajo de SIG ni una visita a campo.',
      bloquea: false,
    },
    datos: [
      { nombre: 'core.aliados', que: 'La persona. Se escribe una vez aunque tenga varios predios.' },
      { nombre: 'core.predios', que: 'El predio, con sus matrículas, su proyecto y de dónde salió.' },
      { nombre: 'core.expedientes', que: 'En qué etapa va cada predio. Es lo que mueve la cadena.' },
      { nombre: 'juridica.debida_diligencia', que: 'Los soportes: cédula, certificados, escrituras.' },
      { nombre: 'juridica.antecedentes', que: 'Consultas a listas y antecedentes del propietario.' },
      { nombre: 'juridica.analisis_juridico', que: 'El concepto de la abogada y el semáforo.' },
    ],
    pulso: ['predios_total', 'aliados_total', 'etapa_juridica'],
    pendiente:
      'Los predios cargados antes de septiembre nacieron sin proyecto asignado; hasta clasificarlos, ' +
      'filtrar por proyecto no sirve del todo.',
  },
  {
    id: 'sig_i',
    dominio: 'siembra',
    nombre: 'SIG · oficina',
    responsable: 'Equipo SIG',
    estado: 'produccion',
    recibe: 'Un predio con semáforo, que jurídica envió a cartografía.',
    hace: [
      'Recibe el archivo de polígonos del SIG y elige cuál es la finca.',
      'Marca dentro de ella los sitios donde se podría sembrar.',
      'Reproyecta todo a coordenadas geográficas y calcula el área real en hectáreas.',
      'Si ya había cartografía, la nueva subida entra como versión nueva y la anterior queda consultable.',
    ],
    entrega: 'Zonas potenciales dibujadas sobre el predio, con área medida, listas para ir a verificar.',
    apps: [{ app: 'intranet', rol: 'Cargue del archivo, vista previa en mapa y guardado de las zonas' }],
    compuerta: {
      titulo: 'Al menos una zona cargada',
      explicacion:
        'No se puede mandar un predio a campo sin cartografía: el evaluador llegaría sin nada que ' +
        'verificar. El sistema lo impide de verdad, en dos puntos distintos — al intentar enviarlo y ' +
        'al listar los predios que el celular puede descargar.',
      bloquea: true,
    },
    datos: [
      { nombre: 'geo.zonas', que: 'Los polígonos: la finca y los sitios de siembra, con su área.' },
      { nombre: 'geo.zonas_lote', que: 'Cada subida es un lote con versión. Lo reemplazado no se borra.' },
      { nombre: 'core.v_predios_campo', que: 'La lista que el celular puede descargar. Exige cartografía.' },
    ],
    pulso: ['zonas_vigentes', 'zonas_lote', 'etapa_sig'],
    pendiente:
      'El versionado por lotes está construido desde el 11 de agosto pero no se ha estrenado con una ' +
      'subida real: la tabla de lotes sigue vacía.',
  },
  {
    id: 'campo',
    dominio: 'siembra',
    nombre: 'Campo y verificación',
    responsable: 'Evaluador, en una sola visita',
    estado: 'produccion',
    recibe: 'Un predio con zonas propuestas por la oficina, descargado al celular antes de salir.',
    hace: [
      'Levanta la evaluación del terreno: suelos, cobertura, agua, conflictos de uso.',
      'Hace la encuesta socioeconómica con la familia.',
      'Camina las zonas y las corrige sobre el mapa satelital: confirma, modifica, agrega o descarta.',
      'Todo queda guardado en el teléfono y sube cuando aparece señal.',
    ],
    entrega:
      'La evaluación, la encuesta y —lo más importante— las zonas como realmente son, no como se ' +
      'veían desde la oficina.',
    apps: [
      {
        app: 'app_campo',
        rol: 'Hace las tres cosas en una sola visita y sin señal: evaluación, encuesta y corrección del mapa',
      },
    ],
    compuerta: {
      titulo: 'Área en firme',
      explicacion:
        'Hasta que el terreno no confirma las zonas no hay hectáreas reales, y sin hectáreas reales no ' +
        'se puede calcular cuántas plántulas pedir. Lo que decide el área es lo que se caminó, no lo ' +
        'que se dibujó en la oficina.',
      bloquea: false,
    },
    datos: [
      { nombre: 'siembra.familias', que: 'El vínculo del predio con el proceso de siembra.' },
      { nombre: 'siembra.evaluaciones_campo', que: 'La evaluación biofísica y la encuesta.' },
      { nombre: 'geo.zona_revision', que: 'Qué hizo el terreno con cada zona y con qué geometría.' },
    ],
    pulso: ['etapa_campo', 'evaluaciones', 'revisiones_zona'],
  },
  {
    id: 'plan',
    dominio: 'siembra',
    nombre: 'Plan de siembra',
    responsable: 'Equipo de restauración',
    estado: 'por_construir',
    recibe: 'El área en firme de cada zona, ya verificada en terreno.',
    hace: [
      'Aplica una receta florística a cada zona según lo que se encontró allí.',
      'Multiplica área por densidad y por el porcentaje de cada especie.',
      'Suma un margen de reposición para las que no peguen.',
      'Convierte todo eso en un pedido concreto al vivero.',
    ],
    entrega: 'Cuántas plántulas de cada especie hay que producir, para qué zona y para cuándo.',
    apps: [{ app: 'intranet', rol: 'Será el módulo donde se arma y se aprueba el plan' }],
    compuerta: {
      titulo: 'Plan aprobado',
      explicacion: 'El vivero no siembra nada que no venga de un plan aprobado: produce contra pedido.',
      bloquea: false,
    },
    datos: [
      { nombre: 'catalogo.especies', que: 'El maestro de especies. Ya existe y está en uso.', estado: 'produccion' },
      { nombre: 'siembra.planes', que: 'El plan por predio.', estado: 'por_construir' },
      { nombre: 'siembra.modelos_floristicos', que: 'Las recetas: qué especie y en qué proporción.', estado: 'por_construir' },
      { nombre: 'siembra.plan_zonas', que: 'El cálculo aterrizado a cada zona.', estado: 'por_construir' },
    ],
    pulso: ['especies'],
    pendiente:
      'El cálculo está diseñado y el catálogo de especies ya está en producción, pero las tablas del ' +
      'plan no existen todavía.',
  },
  {
    id: 'vivero',
    dominio: 'siembra',
    nombre: 'Vivero',
    responsable: 'Equipo de vivero',
    estado: 'por_construir',
    recibe: 'El pedido del plan: especies, cantidades y fecha en que se necesitan sembradas.',
    hace: [
      'Programa la producción hacia atrás desde la fecha de siembra.',
      'Lleva germinación, repique y crecimiento por lote.',
      'Reparte el costo del lote entre las plántulas que sobreviven, por días en vivero.',
    ],
    entrega: 'Plántulas listas para llevar al predio, con el costo real de cada una.',
    apps: [{ app: 'app_vivero', rol: 'Será una app aparte que sincroniza, no un módulo de la intranet' }],
    compuerta: {
      titulo: 'Aval y jurídica de cierre',
      explicacion:
        'Antes de mover plántulas al predio se confirma que el acuerdo con la familia está firmado y vigente.',
      bloquea: false,
    },
    datos: [
      { nombre: 'vivero.*', que: 'Ocho tablas ya diseñadas: lotes, siembras, movimientos, costos.', estado: 'por_construir' },
    ],
    pulso: [],
    pendiente:
      'Hoy el vivero se lleva en Excel. Las decisiones de diseño están cerradas; falta construir el ' +
      'schema y la app.',
  },
  {
    id: 'ejecucion',
    dominio: 'siembra',
    nombre: 'Ejecución y monitoreo',
    responsable: 'Cuadrillas de campo y bodega',
    estado: 'en_curso',
    recibe: 'Las plántulas, los insumos y la programación de siembra por lote.',
    hace: [
      'Registra actividades y rendimientos por lote y por núcleo.',
      'Descuenta insumos y mueve inventario entre bodegas.',
      'Monitorea lo sembrado: qué sobrevivió y en qué estado está.',
    ],
    entrega: 'Cuánto se sembró, con qué recursos, y qué quedó vivo con el tiempo.',
    apps: [
      { app: 'app_actividades', rol: 'La usan hoy las cuadrillas: actividades, insumos, bodega y monitoreo' },
    ],
    datos: [
      { nombre: 'Memoria del teléfono', que: 'Hoy todo vive en el aparato de cada quien.', estado: 'en_curso' },
      { nombre: 'Supervivencia y MRV', que: 'El indicador que exige un proyecto de carbono. No existe aún.', estado: 'por_construir' },
    ],
    pulso: [],
    pendiente:
      'La app está desplegada y en uso, pero no escribe en Supabase: lo registrado no sale del ' +
      'teléfono y no se puede consolidar ni respaldar.',
  },

  // ══ CONSERVACIÓN ══════════════════════════════════════════════════════════
  {
    id: 'ras_familias',
    dominio: 'conservacion',
    nombre: 'Familias en conservación',
    responsable: 'Equipo RAS',
    estado: 'produccion',
    recibe: 'Una familia que conserva bosque en pie y acepta alojar árboles semilleros.',
    hace: [
      'Registra a la familia, la finca y su composición del hogar.',
      'Anota cuánto hay de bosque, de potrero y de otros usos.',
      'Guarda el acuerdo de conservación firmado y los polígonos de la finca.',
    ],
    entrega: 'El predio anfitrión donde vive la red de árboles.',
    apps: [{ app: 'intranet', rol: 'Formulario de conservación, documentos y fotos' }],
    datos: [
      { nombre: 'ras.familias', que: 'La familia y su finca en conservación.' },
      { nombre: 'ras.fotos_predio', que: 'Registro fotográfico del predio.' },
    ],
    pulso: ['ras_familias'],
    pendiente:
      'El formulario arrastra un bloque socioeconómico pesado heredado de siembra que hay que aligerar, ' +
      'y la familia todavía no está conectada al núcleo compartido: se identifica aparte de core.aliados.',
  },
  {
    id: 'ras_arboles',
    dominio: 'conservacion',
    nombre: 'Red de árboles semilleros',
    responsable: 'Botánica y equipo de campo',
    estado: 'produccion',
    recibe: 'El levantamiento de campo por predio, tomado en formulario digital.',
    hace: [
      'Registra cada árbol con su código, su punto GPS y su medición: diámetro, alturas, copa.',
      'Determina la especie —primero en campo, luego la botánica la confirma en una segunda pasada.',
      'Enlaza cada árbol al maestro de especies para que se llame igual en todo el sistema.',
      'Marca cuáles se monitorean con dron y por qué ruta.',
    ],
    entrega: 'La red completa, árbol por árbol, ubicada en el mapa y con especie determinada.',
    apps: [
      { app: 'intranet', rol: 'Carga masiva por predio, corrección manual y métricas' },
      { app: 'geoae', rol: 'Muestra los árboles al público, con su especie y su medición' },
      { app: 'app_semilleros', rol: 'Monitoreo fenológico en campo: floración y fructificación' },
    ],
    datos: [
      { nombre: 'ras.arboles_semilleros', que: 'Un árbol por fila: taxonomía, medición, punto y monitoreo.' },
      { nombre: 'catalogo.especies', que: 'El maestro al que cada árbol se enlaza.' },
    ],
    pulso: ['ras_arboles', 'ras_arboles_con_especie', 'ras_arboles_verificados'],
    pendiente:
      'Buena parte de los árboles sigue sin enlazar al maestro de especies: quedan con el nombre que se ' +
      'les puso en campo, a la espera de la determinación botánica.',
  },
  {
    id: 'ras_monitoreo',
    dominio: 'conservacion',
    nombre: 'Monitoreo de biodiversidad',
    responsable: 'Equipo RAS',
    estado: 'en_curso',
    recibe: 'Predios en conservación con la red ya inventariada.',
    hace: [
      'Avistamiento de aves con GPS, para construir la curva de especies acumuladas.',
      'Cámaras trampa en los predios en conservación.',
      'Seguimiento fenológico de los semilleros a lo largo del año.',
    ],
    entrega: 'La evidencia de que el bosque conservado sostiene vida, no solo que sigue en pie.',
    apps: [
      { app: 'app_aves', rol: 'Avistamiento en campo con GPS y curva de acumulación' },
      { app: 'app_semilleros', rol: 'Registro fenológico por árbol' },
    ],
    datos: [
      { nombre: 'ras.camaras_trampa', que: 'Las cámaras instaladas por predio.', estado: 'en_curso' },
      { nombre: 'ras.fotos_camara', que: 'Lo que capturó cada cámara.', estado: 'en_curso' },
      { nombre: 'ras.monitoreos', que: 'Las jornadas de monitoreo.', estado: 'en_curso' },
    ],
    pulso: ['ras_camaras'],
    pendiente:
      'Las apps de aves y semilleros funcionan y se usan, pero guardan en el teléfono. Las tablas de ' +
      'monitoreo existen en la base y están vacías: nada de lo que se registra en campo está llegando.',
  },
]

export const ETAPA_POR_ID = new Map(ETAPAS.map((e) => [e.id, e]))

// ─── Lo que va de una etapa a otra ────────────────────────────────────────────

export type TipoEnlace =
  | 'avance'      // el trabajo pasa a la etapa siguiente
  | 'devolucion'  // algo vuelve hacia atrás y corrige lo que la etapa anterior creía
  | 'alimenta'    // el núcleo compartido le presta un dato a una etapa

export interface Enlace {
  de: string
  a: string
  tipo: TipoEnlace
  /** Qué viaja por aquí, dicho en pocas palabras. */
  que: string
}

export const ENLACES: Enlace[] = [
  { de: 'juridica', a: 'sig_i', tipo: 'avance', que: 'Predio aprobado' },
  { de: 'sig_i', a: 'campo', tipo: 'avance', que: 'Zonas propuestas' },
  {
    de: 'campo',
    a: 'sig_i',
    tipo: 'devolucion',
    que: 'Las zonas como son en el terreno: confirmadas, modificadas, nuevas o descartadas',
  },
  { de: 'campo', a: 'plan', tipo: 'avance', que: 'Área en firme' },
  { de: 'plan', a: 'vivero', tipo: 'avance', que: 'Pedido de plántulas' },
  { de: 'vivero', a: 'ejecucion', tipo: 'avance', que: 'Plántulas con costo' },
  { de: 'ras_familias', a: 'ras_arboles', tipo: 'avance', que: 'Predio anfitrión' },
  { de: 'ras_arboles', a: 'ras_monitoreo', tipo: 'avance', que: 'Red inventariada' },
]

/**
 * La devolución de campo a la oficina es el corazón de cómo se decidió tratar el
 * desacuerdo entre lo que se dibuja y lo que existe. Se explica aparte porque es
 * una regla del proyecto, no un detalle de implementación.
 */
export const REGLA_DEL_TERRENO = {
  titulo: 'El terreno tiene la última palabra',
  cuerpo:
    'La oficina propone las zonas y la persona parada en el predio dispone. Pero ninguna de las dos ' +
    'versiones se destruye: cada subida del SIG entra como un lote con versión y lo que se reemplaza ' +
    'queda consultable. Esto no es una preferencia de diseño — se perdieron correcciones reales de ' +
    'campo una vez por no tenerlo así.',
}

// ─── Lo transversal ───────────────────────────────────────────────────────────

export interface Pieza {
  id: string
  dominio: 'nucleo' | 'soporte'
  nombre: string
  que: string
  datos: Dato[]
  pulso: string[]
}

export const PIEZAS: Pieza[] = [
  {
    id: 'core',
    dominio: 'nucleo',
    nombre: 'Persona, predio y expediente',
    que:
      'Quién es cada persona, cuál es cada predio y en qué etapa va. Es lo que permite decir «¿dónde ' +
      'está este predio hoy?» sin recorrer cuatro módulos.',
    datos: [
      { nombre: 'core.aliados', que: 'La persona, sin duplicar.' },
      { nombre: 'core.predios', que: 'El predio, con matrículas, proyecto y fuente.' },
      { nombre: 'core.expedientes', que: 'La etapa en la que va. Mueve toda la cadena de siembra.' },
    ],
    pulso: ['aliados_total', 'predios_total'],
  },
  {
    id: 'geo',
    dominio: 'nucleo',
    nombre: 'Geografía',
    que:
      'Los polígonos con área medida de verdad, y la memoria de cómo se corrigieron. Lo usan siembra ' +
      'y el geoportal.',
    datos: [
      { nombre: 'geo.zonas', que: 'Fincas y sitios de siembra.' },
      { nombre: 'geo.zonas_lote', que: 'Cada subida, versionada.' },
      { nombre: 'geo.zona_revision', que: 'Lo que el terreno decidió sobre cada zona.' },
    ],
    pulso: ['zonas_vigentes', 'revisiones_zona'],
  },
  {
    id: 'catalogo',
    dominio: 'nucleo',
    nombre: 'Maestro de especies',
    que:
      'Cada especie se nombra una sola vez en todo el sistema. Lo comparten la red de semilleros, el ' +
      'plan de siembra y el vivero, para que un mismo árbol no se llame de tres formas distintas.',
    datos: [
      { nombre: 'catalogo.especies', que: 'Nombre común, científico y familia botánica.' },
      { nombre: 'catalogo.proyectos', que: 'Conexión Biodiversa, Ley del Árbol.' },
      { nombre: 'catalogo.fuentes_informacion', que: 'Cómo llegó cada predio al sistema.' },
    ],
    pulso: ['especies', 'proyectos'],
  },
  {
    id: 'soporte',
    dominio: 'soporte',
    nombre: 'Usuarios, flota y ejecutivo',
    que:
      'Quién puede entrar y a qué; los vehículos con sus inspecciones y documentos; las sesiones del ' +
      'equipo ejecutivo; los consentimientos de tratamiento de datos.',
    datos: [
      { nombre: 'people.user_profiles', que: 'Usuarios, área y permisos de acceso.' },
      { nombre: 'fleet.*', que: 'Reservas, inspecciones y documentos de los vehículos.' },
      { nombre: 'ejecutivo.*', que: 'Sesiones e indicaciones del equipo directivo.' },
      { nombre: 'public.consentimientos', que: 'Autorización de tratamiento de datos.' },
    ],
    pulso: ['usuarios'],
  },
]

// ─── Utilidades ───────────────────────────────────────────────────────────────

export function etapasDe(dominio: DominioId): Etapa[] {
  return ETAPAS.filter((e) => e.dominio === dominio)
}

/**
 * En qué etapas participa una aplicación. Esta es la vista invertida del mapa:
 * el proceso es una cadena, pero las apps la cruzan — la app de campo, por
 * ejemplo, hace a la vez el trabajo de campo y el de verificación cartográfica.
 */
export function etapasDeApp(appId: string): Etapa[] {
  return ETAPAS.filter((e) => e.apps.some((a) => a.app === appId))
}

export function enlacesDe(etapaId: string): { entra: Enlace[]; sale: Enlace[] } {
  return {
    entra: ENLACES.filter((l) => l.a === etapaId),
    sale: ENLACES.filter((l) => l.de === etapaId),
  }
}
