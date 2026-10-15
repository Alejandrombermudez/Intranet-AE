/**
 * MÓDULO ADMINISTRATIVO Y FINANCIERO — tipos y formatos compartidos
 * ────────────────────────────────────────────────────────────────
 * Lo usan las pantallas de /intranet/administrativa y las rutas
 * /api/administrativa/*. Los datos viven en los esquemas `financiero` (facturas)
 * e `inventario` (insumos, bodegas, kardex), solo accesibles por service_role.
 * Ver docs/sql/migration_financiero_inventario.sql.
 */

export interface Bodega {
  id: string
  nombre: string
  tipo: 'central' | 'proyecto' | 'vivero' | 'campo'
  proyecto: string | null
  responsable: string | null
  activo: boolean
  notas: string | null
}

export interface Insumo {
  id: string
  nombre: string
  unidad: string
  presentacion: string | null
  categoria: string | null
  activo: boolean
  notas: string | null
  costo_promedio: number | null
  ultima_compra: string | null
}

export interface Existencia {
  bodega_id: string
  insumo_id: string
  entradas: number
  salidas: number
  saldo: number
  por_recibir: number
}

export interface Proyecto {
  codigo: string
  nombre: string
}

export interface TituloCampo {
  id: string
  nombre: string
  rol: 'bodega' | 'siembra' | 'monitoreo'
  bodega_ids: string[]
  activo: boolean
  tiene_clave: boolean
  ultimo_ingreso: string | null
  bloqueado_hasta: string | null
}

export type TipoMovimiento = 'entrada' | 'traslado' | 'consumo' | 'ajuste'
export type EstadoMovimiento = 'confirmado' | 'en_transito' | 'rechazado' | 'anulado'

export interface Movimiento {
  id: string
  tipo: TipoMovimiento
  insumo_id: string
  cantidad: number
  origen_id: string | null
  destino_id: string | null
  estado: EstadoMovimiento
  fecha: string
  costo_unitario: number | null
  documento: string | null
  notas: string | null
  creado_por: string | null
  recibido_por: string | null
  recibido_at: string | null
  motivo_anulacion: string | null
  factura_item_id: string | null
  registro_id: string | null
  created_at: string
  tiene_soporte?: boolean
}

export interface FacturaResumen {
  id: string
  numero: string
  cufe: string | null
  tipo_documento: string
  fecha_emision: string
  fecha_vencimiento: string | null
  forma_pago: string | null
  subtotal: number
  impuestos: number
  retenciones: number
  total: number
  proyecto: string | null
  origen: 'xml_dian' | 'manual'
  estado: 'registrada' | 'anulada'
  archivo_xml: string | null
  archivo_pdf: string | null
  notas: string | null
  created_by: string | null
  created_at: string
  motivo_anulacion: string | null
  proveedor: { id: string; nit: string; dv: string | null; razon_social: string } | null
  n_items: number
  n_inventario: number
}

export interface FacturaItem {
  id: string
  linea: number
  codigo: string | null
  descripcion: string
  cantidad: number
  unidad_medida: string | null
  precio_unitario: number | null
  subtotal: number
  impuesto_pct: number | null
  impuesto_valor: number
  total: number
  clase: 'inventario' | 'gasto'
  insumo_id: string | null
  factor: number
  bodega_id: string | null
}

/** Una línea de factura lista para guardar: lo leído del XML + la decisión de la persona. */
export interface LineaClasificada {
  linea: number
  codigo: string | null
  descripcion: string
  cantidad: number
  unidad_medida: string | null
  precio_unitario: number | null
  subtotal: number
  impuesto_pct: number | null
  impuesto_valor: number
  total: number
  clase: 'inventario' | 'gasto'
  insumo_id: string | null
  factor: number
  bodega_id: string | null
}

export const TIPOS_BODEGA: Record<Bodega['tipo'], string> = {
  central: 'Central',
  proyecto: 'Proyecto',
  vivero: 'Vivero',
  campo: 'En predio',
}

export const ROLES_CAMPO: Record<TituloCampo['rol'], { nombre: string; que: string }> = {
  bodega: { nombre: 'Bodega', que: 'Solo el inventario de su bodega: lo que recibe y lo que envía.' },
  siembra: { nombre: 'Siembra', que: 'Registra actividades sobre los núcleos, ve rendimientos y el inventario de sus bodegas.' },
  monitoreo: { nombre: 'Monitoreo', que: 'Lo de Siembra, más el monitoreo de lo sembrado.' },
}

export const TIPO_MOV: Record<TipoMovimiento, string> = {
  entrada: 'Entrada por compra',
  traslado: 'Traslado',
  consumo: 'Consumo en campo',
  ajuste: 'Ajuste',
}

export const ESTADO_MOV: Record<EstadoMovimiento, string> = {
  confirmado: 'Confirmado',
  en_transito: 'En camino',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
}

/** Unidades con las que se cuenta en bodega. Lista abierta: se puede escribir otra. */
export const UNIDADES_INVENTARIO = ['unidad', 'Bulto', 'Bolsa', 'Bidón', 'Presentación', 'Litros', 'Galón', 'kg', 'g', 'rollo', 'metro', 'caja']

export const CATEGORIAS_INSUMO = ['fertilizante', 'enmienda', 'herbicida', 'insecticida', 'fungicida', 'hormiguicida',
  'combustible', 'cerramiento', 'herramienta', 'vivero', 'otro']

const PESOS = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const CANT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

export const pesos = (n: number | null | undefined) => (n == null ? '—' : PESOS.format(Math.round(Number(n))))
export const cantidad = (n: number | null | undefined) => (n == null ? '—' : CANT.format(Number(n)))

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T00:00' : iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** El NIT como se escribe: 900.123.456-7 */
export function nitConDv(nit: string | null | undefined, dv?: string | null): string {
  if (!nit) return '—'
  const con = /^\d+$/.test(nit) ? Number(nit).toLocaleString('es-CO') : nit
  return dv ? `${con}-${dv}` : con
}

export const hoyISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/** La fecha de hoy en Colombia, también en el servidor (Vercel y Supabase corren en UTC). */
export const hoyColombia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
