/**
 * SALIDAS A CAMPO — tipos, textos y cálculos compartidos
 * ──────────────────────────────────────────────────────
 * Lo usan /intranet/administrativa (pestaña «Salidas a campo») y las rutas
 * /api/administrativa/salidas|trabajadores. Los datos viven en `inventario`
 * (salidas, actas, movimientos, v_conciliacion_salida) y en
 * `people.trabajadores_campo`. Ver docs/PLAN_SALIDAS_CAMPO.md y
 * docs/sql/migration_salidas_campo.sql.
 */

// ─── Clase de cada elemento ───────────────────────────────────────────────────

export type ClaseElemento = 'consumible' | 'herramienta' | 'epp' | 'dotacion'

export const CLASES: Record<ClaseElemento, { nombre: string; que: string }> = {
  consumible: { nombre: 'Consumible', que: 'Se gasta en campo: fertilizantes, cal, alambre, postes…' },
  herramienta: { nombre: 'Herramienta', que: 'Palas, azadones, equipos. Vuelve a bodega al terminar.' },
  epp: { nombre: 'EPP', que: 'Elemento de protección personal que debe devolverse (impermeable, gafas, guantes…).' },
  dotacion: { nombre: 'Dotación', que: 'Se la queda quien la recibe. La define SG-SST.' },
}

/** Lo que vuelve a bodega: se espera su devolución o una explicación. */
export const SE_DEVUELVE = (c: ClaseElemento) => c === 'herramienta' || c === 'epp'

// ─── Actas ────────────────────────────────────────────────────────────────────

export type TipoActa = 'entrega' | 'adicional' | 'devolucion' | 'epp'

export const TIPOS_ACTA: Record<TipoActa, { nombre: string; titulo: string; que: string }> = {
  entrega: { nombre: 'Entrega inicial', titulo: 'Acta de entrega de materiales', que: 'Lo que el equipo lleva al salir.' },
  adicional: { nombre: 'Entrega adicional', titulo: 'Acta de entrega adicional', que: 'Una compra o un envío posterior a la salida.' },
  devolucion: { nombre: 'Devolución', titulo: 'Acta de devolución de materiales', que: 'Lo que vuelve a una bodega; se recibe contando.' },
  epp: { nombre: 'EPP a un trabajador', titulo: 'Acta de entrega de EPP', que: 'Lo que un trabajador recibe a su nombre y firma.' },
}

export interface ElementoActa {
  insumo_id: string
  nombre: string
  unidad: string
  clase: ClaseElemento
  cantidad: number
}

/** La foto fija de lo que dice un acta (la guarda la base al registrarla). */
export interface DatosActa {
  salida: string
  responsable: string | null
  origen: string | null
  destino: string | null
  trabajador: string | null
  trabajador_documento: string | null
  items: ElementoActa[]
}

export interface Acta {
  id: string
  numero: string
  tipo: TipoActa
  salida_id: string
  trabajador_id: string | null
  fecha: string
  datos: DatosActa
  archivo: string | null
  firmada: boolean
  firmada_at: string | null
  notas: string | null
  creado_por: string | null
  created_at: string
}

// ─── Motivos para explicar una diferencia ─────────────────────────────────────

export type Motivo = 'consumido' | 'instalado' | 'danado' | 'perdido' | 'dotacion' | 'a_cargo' | 'sobrante'

export const MOTIVOS: Record<Motivo, { nombre: string; ayuda: string; pideTrabajador?: boolean }> = {
  consumido: { nombre: 'Se consumió', ayuda: 'Se gastó en el trabajo y no se registró en la app.' },
  instalado: { nombre: 'Quedó instalado', ayuda: 'Postes, alambre, grapas: quedó puesto en el cerramiento.' },
  danado: { nombre: 'Se dañó', ayuda: 'Se estropeó con el uso.' },
  perdido: { nombre: 'Se perdió', ayuda: 'Ya no se tiene y no hay quién lo responda.' },
  a_cargo: { nombre: 'Lo tiene un trabajador', ayuda: 'Está en poder de alguien y debe devolverlo.', pideTrabajador: true },
  dotacion: { nombre: 'Es dotación', ayuda: 'Se queda con el trabajador; no se devuelve.', pideTrabajador: true },
  sobrante: { nombre: 'Se devolvió de más', ayuda: 'Volvió más de lo que se entregó: explica de dónde venía.' },
}

// ─── Estados de la conciliación ───────────────────────────────────────────────

export type EstadoConciliacion =
  | 'cuadra' | 'consumido' | 'sin_uso' | 'a_cargo'
  | 'sin_devolucion' | 'falta_justificar' | 'pendiente_conteo' | 'devuelto_de_mas' | 'devuelto_sin_entrega'

export const ESTADOS: Record<EstadoConciliacion, { texto: string; tono: 'bien' | 'aviso' | 'mal' | 'neutro' }> = {
  cuadra: { texto: 'Cuadra', tono: 'bien' },
  consumido: { texto: 'Consumido en campo', tono: 'bien' },
  sin_uso: { texto: 'Sin uso (devuelto completo)', tono: 'neutro' },
  a_cargo: { texto: 'A cargo del personal', tono: 'aviso' },
  sin_devolucion: { texto: 'Sin reporte de devolución', tono: 'mal' },
  falta_justificar: { texto: 'Falta justificar', tono: 'mal' },
  pendiente_conteo: { texto: 'Pendiente de conteo', tono: 'aviso' },
  devuelto_de_mas: { texto: 'Devuelto de más', tono: 'mal' },
  devuelto_sin_entrega: { texto: 'Devuelto sin registro de entrega', tono: 'aviso' },
}

/** Estados que impiden cerrar la salida o piden mirar algo. */
export const ESTADOS_PENDIENTES: EstadoConciliacion[] = ['sin_devolucion', 'falta_justificar', 'pendiente_conteo', 'devuelto_de_mas']

export interface FilaConciliacion {
  salida_id: string
  insumo_id: string
  nombre: string
  unidad: string
  clase: ClaseElemento
  categoria: string | null
  inicial: number
  adicional: number
  total: number
  consumido_app: number
  devuelto: number
  por_recibir: number
  a_cargo: number
  dotacion: number
  justificado: number
  sobrante: number
  saldo: number
  estado: EstadoConciliacion
  /** Las notas de las justificaciones de este elemento, para la columna «Observación». */
  observacion?: string
}

/** La base devuelve numeric como texto o número según la ruta: se normaliza. */
export function normalizarFila(r: Record<string, unknown>): FilaConciliacion {
  const n = (k: string) => Number(r[k] ?? 0) || 0
  return {
    salida_id: String(r.salida_id), insumo_id: String(r.insumo_id), nombre: String(r.nombre), unidad: String(r.unidad),
    clase: (r.clase as ClaseElemento) ?? 'consumible', categoria: (r.categoria as string | null) ?? null,
    inicial: n('inicial'), adicional: n('adicional'), total: n('total'), consumido_app: n('consumido_app'),
    devuelto: n('devuelto'), por_recibir: n('por_recibir'), a_cargo: n('a_cargo'), dotacion: n('dotacion'),
    justificado: n('justificado'), sobrante: n('sobrante'), saldo: n('saldo'),
    estado: r.estado as EstadoConciliacion,
  }
}

/** Cuántas filas siguen sin explicar. */
export const pendientes = (filas: FilaConciliacion[]) => filas.filter((f) => ESTADOS_PENDIENTES.includes(f.estado)).length

// ─── Salidas y trabajadores ───────────────────────────────────────────────────

export interface Trabajador {
  id: string
  nombres: string
  apellidos: string | null
  tipo_documento: string | null
  numero_documento: string | null
  celular: string | null
  cargo: string | null
  activo: boolean
  notas: string | null
}

export const nombreTrabajador = (t: Pick<Trabajador, 'nombres' | 'apellidos'> | null | undefined) =>
  t ? `${t.nombres} ${t.apellidos ?? ''}`.trim() : '—'

export interface Salida {
  id: string
  nombre: string
  proyecto: string | null
  predio_ids: string[]
  responsable_id: string | null
  bodega_id: string
  bodega_retorno_id: string | null
  fecha_salida: string
  fecha_cierre: string | null
  estado: 'abierta' | 'cerrada'
  notas: string | null
  creado_por: string | null
  cerrado_por: string | null
  /** Solo en la lista: */
  pendientes?: number
  n_elementos?: number
  n_actas?: number
  n_sin_firma?: number
}

export const AVISO_MIGRACION_SALIDAS =
  'Falta correr docs/sql/migration_salidas_campo.sql en Supabase (después de migration_financiero_inventario.sql y migration_talento_humano.sql).'

/** Cantidades sin ceros sobrantes: 9, 2,5. */
export const num = (n: number | null | undefined) =>
  n == null ? '—' : Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 })

/** Cada acta de una salida con el nombre que lleva en pantalla. */
export const etiquetaActa = (a: Pick<Acta, 'numero' | 'tipo'>) => `${a.numero} · ${TIPOS_ACTA[a.tipo].nombre}`
