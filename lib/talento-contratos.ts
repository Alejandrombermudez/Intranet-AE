/**
 * Validación de un contrato que llega a /api/talento/contratos (servidor).
 * Aparte de la ruta porque la usan el POST y el PATCH.
 */
import { MODALIDADES_DE, type Vinculacion } from '@/lib/talento'

const VINCULACIONES: Vinculacion[] = ['planta', 'contratista', 'aprendiz', 'practicante']
const fecha = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 2000) : null)
const numero = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

/** `nuevo` exige lo mínimo; al editar solo se valida lo que viene. */
export function contratoDesdeCuerpo(b: Record<string, unknown>, nuevo: boolean):
  { datos: Record<string, unknown> } | { error: string } {
  const d: Record<string, unknown> = {}
  const tiene = (k: string) => nuevo || k in b

  if (tiene('vinculacion')) {
    if (!VINCULACIONES.includes(b.vinculacion as Vinculacion)) return { error: 'Elige si es de planta o contratista.' }
    d.vinculacion = b.vinculacion
  }
  if (tiene('modalidad')) {
    const vin = (d.vinculacion ?? b.vinculacion) as Vinculacion
    const mod = texto(b.modalidad) ?? MODALIDADES_DE[vin]?.[0] ?? null
    if (mod && vin && !MODALIDADES_DE[vin]?.includes(mod)) return { error: 'Esa modalidad no corresponde a la vinculación.' }
    d.modalidad = mod
  }
  if (tiene('cargo')) {
    const c = texto(b.cargo); if (!c) return { error: 'Escribe el cargo o el rol.' }
    d.cargo = c
  }
  if (tiene('fecha_inicio')) {
    const f = fecha(b.fecha_inicio); if (!f) return { error: 'Falta la fecha de inicio.' }
    d.fecha_inicio = f
  }
  if ('fecha_fin' in b) d.fecha_fin = fecha(b.fecha_fin)
  for (const k of ['numero', 'objeto', 'supervisor', 'notas', 'proyecto', 'motivo_terminacion'] as const) if (k in b) d[k] = texto(b[k])
  for (const k of ['valor_mensual', 'valor_total'] as const) {
    if (k in b) { const n = numero(b[k]); if (Number.isNaN(n)) return { error: 'Valor no válido.' }; d[k] = n }
  }
  if ('estado' in b) {
    if (!['vigente', 'terminado', 'anulado'].includes(String(b.estado))) return { error: 'Estado no válido.' }
    d.estado = b.estado
    if (b.estado === 'terminado') d.fecha_terminacion = fecha(b.fecha_terminacion) ?? new Date().toISOString().slice(0, 10)
    if (b.estado === 'vigente') { d.fecha_terminacion = null }
  }
  if (nuevo && d.vinculacion === 'contratista' && !d.objeto) return { error: 'Un contrato de prestación de servicios necesita su objeto.' }
  const ini = (d.fecha_inicio ?? b.fecha_inicio) as string | undefined, fin = d.fecha_fin as string | null | undefined
  if (ini && fin && fin < ini) return { error: 'La fecha de fin es anterior a la de inicio.' }
  return { datos: d }
}
