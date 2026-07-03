import { supabase } from '@/lib/supabase'

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Un árbol semillero de la red RAS (tabla ras.arboles_semilleros). */
export interface ArbolSemillero {
  id: string
  codigo: string
  nucleo: string | null
  predio: string | null
  familia_id: string | null
  especie_id: string | null
  especie_pendiente: string | null
  nombre_comun: string | null
  nombre_cientifico: string | null
  genero: string | null
  familia_botanica: string | null
  especie_anterior: string | null
  colecta: string | null
  dap_cm: number | null
  ab_m2: number | null
  altura_total_m: number | null
  clase_copa: string | null
  especies_asociadas: string | null
  codigo_dron: string | null
  ruta_dron: string | null
  latitud: number | null
  longitud: number | null
  foto_url: string | null
  fecha_registro: string | null
  estado_verificacion: string | null
}

/** Indicadores por predio (vista ras.v_indicadores_predio). */
export interface IndicadoresPredio {
  nucleo: string | null
  predio: string | null
  familia_id: string | null
  arboles_semilleros: number | null
  especies_forestales: number | null
  familias: number | null
  generos: number | null
  shannon_h: number | null
  simpson_1d: number | null
  pielou_j: number | null
  margalef: number | null
  area_basal_m2: number | null
  dap_medio_cm: number | null
  dap_max_cm: number | null
  arboles_grandes_dap50: number | null
  altura_media_m: number | null
  con_coordenada: number | null
  esp_amenazadas: number | null
  arb_amenazados: number | null
  pioneras: number | null
  intermedias: number | null
  tardias: number | null
  zoocoria: number | null
  anemocoria: number | null
  autocoria: number | null
  barocoria: number | null
  area_bosque_recorrida: number | null
  densidad_arb_ha: number | null
}

// ─── Consultas (cliente browser, sesión autenticada) ────────────────────────

const ARBOL_COLS =
  'id, codigo, nucleo, predio, familia_id, especie_id, especie_pendiente, nombre_comun, ' +
  'nombre_cientifico, genero, familia_botanica, especie_anterior, colecta, dap_cm, ab_m2, ' +
  'altura_total_m, clase_copa, especies_asociadas, codigo_dron, ruta_dron, latitud, longitud, ' +
  'foto_url, fecha_registro, estado_verificacion'

/** Árboles semilleros de un predio/familia, ordenados por código.
 *  Lee de v_arboles_con_especie (JOIN a catalogo.especies) — la tabla base
 *  no guarda nombre_cientifico/familia/género por árbol, solo especie_id. */
export async function fetchArbolesPorFamilia(familiaId: string): Promise<ArbolSemillero[]> {
  const { data, error } = await supabase
    .schema('ras')
    .from('v_arboles_con_especie')
    .select(ARBOL_COLS)
    .eq('familia_id', familiaId)
    .order('codigo', { ascending: true })
  if (error) {
    console.warn('[ras-arboles] fetchArbolesPorFamilia:', error.message)
    return []
  }
  return (data ?? []) as unknown as ArbolSemillero[]
}

/** Indicadores agregados de un predio/familia (1 fila). */
export async function fetchIndicadoresPorFamilia(familiaId: string): Promise<IndicadoresPredio | null> {
  const { data, error } = await supabase
    .schema('ras')
    .from('v_indicadores_predio')
    .select('*')
    .eq('familia_id', familiaId)
    .maybeSingle()
  if (error) {
    console.warn('[ras-arboles] fetchIndicadoresPorFamilia:', error.message)
    return null
  }
  return (data as unknown as IndicadoresPredio) ?? null
}

/** Indicadores agregados de varios predios/familias a la vez (para listados). */
export async function fetchIndicadoresDeFamilias(familiaIds: string[]): Promise<Record<string, IndicadoresPredio>> {
  if (familiaIds.length === 0) return {}
  const { data, error } = await supabase
    .schema('ras')
    .from('v_indicadores_predio')
    .select('*')
    .in('familia_id', familiaIds)
  if (error) {
    console.warn('[ras-arboles] fetchIndicadoresDeFamilias:', error.message)
    return {}
  }
  const porFamilia: Record<string, IndicadoresPredio> = {}
  for (const row of (data ?? []) as unknown as IndicadoresPredio[]) {
    if (row.familia_id) porFamilia[row.familia_id] = row
  }
  return porFamilia
}

/** Sube/cambia la foto propia de un árbol semillero. Devuelve la URL pública nueva o null. */
export async function cambiarFotoArbol(id: string, file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append('foto', file)
  const r = await fetch(`/api/ras/arboles/${id}/foto`, { method: 'POST', body: fd })
  if (!r.ok) {
    console.warn('[ras-arboles] cambiarFotoArbol:', await r.text())
    return null
  }
  const { foto_url } = await r.json()
  return foto_url ?? null
}
