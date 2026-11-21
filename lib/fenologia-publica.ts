/**
 * FENOLOGÍA PÚBLICA — los datos de /entregables/fenologia.
 *
 * Solo resúmenes por especie y el clima promedio de la zona: ningún predio,
 * coordenada, monitor, foto ni observación sale de aquí, porque la página no
 * pide sesión. Se arma en el servidor con la service_role y se guarda en caché
 * 6 horas (la base cambia por rondas mensuales).
 */
import { unstable_cache } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { climaPorArbol, type ArbolUbicable } from '@/lib/clima-abierto'
import {
  COLUMNAS_FASE, climaPonderado, etiquetaRonda, mesDe, resumenEspecies,
  type MesClima, type Monitoreo, type ResumenEspecie,
} from '@/lib/fenologia'

export type EspeciePublica = Omit<ResumenEspecie, 'predios'> & { nPredios: number }

export type FenologiaPublica = {
  especies: EspeciePublica[]
  /** Meses (0–11) con al menos una ronda. */
  meses: number[]
  periodo: string
  rondas: number
  arboles: number
  monitoreos: number
  predios: number
  zonas: string[]
  clima: { meses: MesClima[]; periodo: string } | null
  actualizado: string
}

const COLS = ['nucleo', 'codigo', 'predio', 'ronda', 'nombre_comun', 'nombre_cientifico', 'familia', ...COLUMNAS_FASE].join(',')

async function armar(): Promise<FenologiaPublica> {
  const ras = createServerSupabaseClient().schema('ras')
  const ms: Monitoreo[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await ras.from('monitoreos_semilleros').select(COLS)
      .eq('eliminado', false).order('ronda').order('codigo').range(desde, desde + 999)
    if (error) throw new Error(error.message)
    ms.push(...((data ?? []) as unknown as Monitoreo[]))
    if (!data || data.length < 1000) break
  }

  const rondas = [...new Set(ms.map((m) => m.ronda))].sort()
  const especies: EspeciePublica[] = resumenEspecies(ms).map(({ predios, ...e }) => ({ ...e, nPredios: predios.length }))

  let clima: FenologiaPublica['clima'] = null
  try {
    const { data } = await ras.from('arboles_monitoreo').select('nucleo,codigo,predio,latitud,longitud').eq('activo', true).range(0, 4999)
    const arboles = (data ?? []) as ArbolUbicable[]
    const c = await climaPorArbol(arboles)
    const indice = new Map(c.celdas.flatMap((celda) => celda.arboles.map((k) => [k, celda] as const)))
    const g = climaPonderado(indice, new Set(ms.map((m) => `${m.nucleo}|${m.codigo}`)))
    if (g) clima = { meses: g.meses, periodo: c.periodo }
  } catch {
    // Sin clima la página sigue: los calendarios no dependen de él.
  }

  return {
    especies,
    meses: [...new Set(ms.map((m) => mesDe(m) - 1))].sort((a, b) => a - b),
    periodo: rondas.length ? `${etiquetaRonda(rondas[0])} a ${etiquetaRonda(rondas[rondas.length - 1])}` : '',
    rondas: rondas.length,
    arboles: new Set(ms.map((m) => `${m.nucleo}|${m.codigo}`)).size,
    monitoreos: ms.length,
    predios: new Set(ms.map((m) => `${m.nucleo}|${m.predio}`)).size,
    zonas: [...new Set(ms.map((m) => m.nucleo))].sort(),
    clima,
    actualizado: new Date().toISOString(),
  }
}

export const fenologiaPublica = unstable_cache(armar, ['fenologia-publica-v1'], { revalidate: 6 * 3600 })
