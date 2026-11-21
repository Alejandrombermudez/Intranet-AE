/**
 * FENOLOGÍA PÚBLICA — los datos de /entregables/fenologia.
 *
 * Solo resúmenes por especie y el clima promedio de la zona: ningún predio,
 * coordenada, monitor, foto ni observación sale de aquí, porque la página no
 * pide sesión. Se arma en el servidor con la service_role y se guarda en caché
 * 6 horas (la base cambia por rondas mensuales). El clima de cada especie se
 * calcula aquí y no en el navegador: así no viajan las coordenadas de los árboles.
 */
import { unstable_cache } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { climaPorArbol, type ArbolUbicable } from '@/lib/clima-abierto'
import {
  COLUMNAS_FASE, agrupar, climaPonderado, especieDe, etiquetaRonda, indiceCeldas, mesDe, resumenEspecies,
  type MesClima, type Monitoreo, type ResumenEspecie,
} from '@/lib/fenologia'

/** Clima donde están los árboles de un grupo, como lo calcula la intranet (climaPonderado). */
export type ClimaGrupoPublico = { meses: MesClima[]; celdas: number; arboles: number }

export type EspeciePublica = Omit<ResumenEspecie, 'predios'> & {
  nPredios: number
  /** Rondas en que se monitoreó la especie ('YYYY-MM'), para el pie de figura. */
  rondasLista: string[]
  clima: ClimaGrupoPublico | null
}

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
  clima: (ClimaGrupoPublico & { periodo: string }) | null
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
  const clave = (x: { nucleo: string; codigo: string }) => `${x.nucleo}|${x.codigo}`
  const porEspecie = agrupar(ms, especieDe)

  // Clima: el mismo cálculo de la ficha de la intranet — promedio de las celdas
  // de Open-Meteo donde están los árboles (los de la base y los monitoreados).
  let clima: FenologiaPublica['clima'] = null
  let climaDe: (claves: Iterable<string>) => ClimaGrupoPublico | null = () => null
  try {
    const { data } = await ras.from('arboles_monitoreo')
      .select('nucleo,codigo,predio,latitud,longitud,nombre_comun,nombre_cientifico').eq('activo', true).range(0, 4999)
    const arboles = (data ?? []) as (ArbolUbicable & { nombre_comun: string | null; nombre_cientifico: string | null })[]
    const c = await climaPorArbol(arboles)
    const indice = indiceCeldas(c)
    climaDe = (claves) => {
      const g = climaPonderado(indice, claves)
      return g ? { meses: g.meses, celdas: g.celdas.length, arboles: g.arboles } : null
    }
    for (const a of arboles) porEspecie.get(especieDe(a))?.push({ nucleo: a.nucleo, codigo: a.codigo } as Monitoreo)
    const g = climaDe(new Set(ms.map(clave)))
    if (g) clima = { ...g, periodo: c.periodo }
  } catch {
    // Sin clima la página sigue: los calendarios no dependen de él.
  }

  const especies: EspeciePublica[] = resumenEspecies(ms).map(({ predios, ...e }) => {
    const propios = ms.filter((m) => especieDe(m) === e.especie)
    return {
      ...e,
      nPredios: predios.length,
      rondasLista: [...new Set(propios.map((m) => m.ronda))].sort(),
      clima: climaDe(new Set((porEspecie.get(e.especie) ?? []).map(clave))),
    }
  })

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

export const fenologiaPublica = unstable_cache(armar, ['fenologia-publica-v2'], { revalidate: 6 * 3600 })
