/**
 * LOS DEPARTAMENTOS DE LA INTRANET
 * ────────────────────────────────
 * Las áreas de trabajo que se pueden asignar a una persona en
 * `people.user_profiles.department`, y a qué módulo entra cada una.
 *
 * Vive aparte de la página del hub porque ya son tres los sitios que necesitan
 * la lista: el selector de la tabla de usuarios, el redirect de quien no es
 * admin, y el resumen del mapa del sistema. Tenerla en un solo lugar evita que
 * agregar un departamento se olvide en alguno de ellos.
 *
 * El valor de `id` es el que está escrito en la base — «Juridica» sin tilde,
 * porque así se guardó. No se corrige aquí: cambiarlo dejaría sin módulo a la
 * gente que ya lo tiene asignado. Para mostrarlo se usa `nombre`.
 */

export interface Departamento {
  /** Tal como está escrito en `people.user_profiles.department`. */
  id: string
  /** Cómo se escribe bien, para mostrarlo. */
  nombre: string
  /** El módulo al que entra. Sin ruta, el área todavía no tiene pantalla propia. */
  ruta?: string
  /** Qué hace esta área, en una línea. */
  que: string
}

export const DEPARTAMENTOS: Departamento[] = [
  {
    id: 'Juridica',
    nombre: 'Jurídica',
    ruta: '/intranet/juridica',
    que: 'Debida diligencia del predio: dueño, matrícula, antecedentes y análisis jurídico.',
  },
  {
    id: 'SIG',
    nombre: 'SIG',
    ruta: '/intranet/sig',
    que: 'Cartografía: zonifica el predio, recibe lo que campo corrigió y cierra el lote de siembra.',
  },
  {
    // Siembra no tiene módulo propio, y es correcto: es el PROCESO completo
    // (jurídica → SIG → campo → SIG II), no una pantalla. Lo que antes vivía en
    // /intranet/ras/siembra era una lista de encuestas heredada del diseño
    // anterior, rota desde el rediseño de julio de 2026 y redundante — esa misma
    // encuesta se ve en la pestaña «Resultados de campo» del predio y completa en
    // el Reporte. Por eso este departamento entra por el Reporte: el expediente
    // del predio de punta a punta, que es su materia de trabajo.
    id: 'Siembra',
    nombre: 'Siembra',
    ruta: '/intranet/reporte',
    que: 'El proceso de restauración de punta a punta. Entra por el Reporte, que es el expediente completo.',
  },
  {
    id: 'RAS',
    nombre: 'RAS · Conservación',
    ruta: '/intranet/ras',
    que: 'Familias que conservan bosque y la red de árboles semilleros.',
  },
  {
    id: 'Reporte',
    nombre: 'Reporte',
    ruta: '/intranet/reporte',
    que: 'El expediente del predio en un solo documento, listo para imprimir.',
  },
  {
    id: 'Ejecutivo',
    nombre: 'Ejecutivo',
    ruta: '/intranet/ejecutivo',
    que: 'Sesiones e indicaciones del equipo directivo, con su seguimiento.',
  },
  {
    // Tecnología es el mapa del sistema: el proceso, las aplicaciones y la bitácora.
    id: 'Tecnología',
    nombre: 'Tecnología',
    ruta: '/intranet/sistema',
    que: 'El mapa del sistema: el proceso, las aplicaciones, los conteos y la bitácora.',
  },
  {
    id: 'Financiero',
    nombre: 'Financiero',
    que: 'Todavía sin módulo propio: entra al tablero general de la intranet.',
  },
]

/** Solo los nombres guardados, para el selector de la tabla de usuarios. */
export const NOMBRES_DEPARTAMENTO = DEPARTAMENTOS.map((d) => d.id)

/**
 * Departamento → módulo. Tanto el redirect de un no-admin como el tab de admin
 * navegan por aquí en vez de renderizar algo inline.
 */
export const RUTA_MODULO: Record<string, string> = Object.fromEntries(
  DEPARTAMENTOS.filter((d) => d.ruta).map((d) => [d.id, d.ruta as string]),
)
