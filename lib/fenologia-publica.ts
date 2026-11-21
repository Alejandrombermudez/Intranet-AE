/**
 * FENOLOGÍA PÚBLICA — los datos de /entregables/fenologia.
 *
 * La página no pide sesión, así que aquí se recorta lo sensible ANTES de que
 * salga del servidor:
 *  - el predio va con su nombre (el de la familia, con autorización) o con una
 *    etiqueta neutra «Vereda · predio N», según NOMBRE_PREDIO;
 *  - nada de coordenadas, monitores, fotos ni observaciones;
 *  - el clima va por celda de Open-Meteo con sus árboles, sin lat/lon.
 * Con eso el navegador hace los mismos cálculos que /intranet/ras/fenologia
 * (lib/fenologia.ts), incluido el filtro por predio. Caché de 6 horas.
 */
import { unstable_cache } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { climaPorArbol, type ArbolUbicable } from '@/lib/clima-abierto'
import { COLUMNAS_FASE, etiquetaRonda, type Arbol, type MesClima, type Monitoreo } from '@/lib/fenologia'

/**
 * Cómo se muestra el predio en la página pública. 'neutro' = «Alto Consaya · predio 3».
 * 'nombre' = el nombre real del predio (el de la familia). Desde el 2026-11-21 va
 * 'nombre': las familias dieron la autorización de datos (lo confirmó el usuario).
 */
const NOMBRE_PREDIO = 'nombre' as 'neutro' | 'nombre'

export type CeldaPublica = { id: string; normal: MesClima[]; arboles: string[] }

export type FenologiaPublica = {
  monitoreos: Monitoreo[]
  arboles: Arbol[]
  clima: { periodo: string; celdas: CeldaPublica[] } | null
  periodo: string
  actualizado: string
}

const COLS = ['nucleo', 'codigo', 'predio', 'ronda', 'nombre_comun', 'nombre_cientifico', 'familia', ...COLUMNAS_FASE].join(',')

async function armar(): Promise<Omit<FenologiaPublica, 'clima'>> {
  const ras = createServerSupabaseClient().schema('ras')
  const crudos: Record<string, unknown>[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await ras.from('monitoreos_semilleros').select(COLS)
      .eq('eliminado', false).order('ronda').order('codigo').range(desde, desde + 999)
    if (error) throw new Error(error.message)
    crudos.push(...((data ?? []) as unknown as Record<string, unknown>[]))
    if (!data || data.length < 1000) break
  }
  const base = await ras.from('arboles_monitoreo')
    .select('nucleo,codigo,predio,vereda,nombre_comun,nombre_cientifico,familia,dap_cm,altura_m')
    .eq('activo', true).order('codigo').range(0, 4999)
  const arbolesBase = (base.error ? [] : base.data ?? []) as Arbol[]

  // Etiqueta de cada predio: por vereda, numerados en orden alfabético del nombre.
  const vereda = new Map<string, string | null>()
  for (const a of arbolesBase) if (!vereda.get(`${a.nucleo}|${a.predio}`)) vereda.set(`${a.nucleo}|${a.predio}`, a.vereda)
  for (const m of crudos) { const k = `${m.nucleo}|${m.predio}`; if (!vereda.has(k)) vereda.set(k, null) }
  const porVereda = new Map<string, string[]>()
  for (const [k, v] of vereda) porVereda.set(v ?? '', [...(porVereda.get(v ?? '') ?? []), k])
  const etiqueta = new Map<string, string>()
  for (const [v, ks] of porVereda) {
    ks.sort((a, b) => a.localeCompare(b, 'es')).forEach((k, i) => {
      const nombre = k.split('|').slice(1).join('|')
      etiqueta.set(k, NOMBRE_PREDIO === 'nombre' ? nombre : v ? `${v} · predio ${i + 1}` : `Predio ${i + 1}`)
    })
  }
  const predioDe = (x: { nucleo: unknown; predio: unknown }) => etiqueta.get(`${x.nucleo}|${x.predio}`) ?? 'Predio'

  const monitoreos = crudos.map((m) => ({
    ...m, predio: predioDe(m as { nucleo: string; predio: string }),
    id: '', fecha: '', en_base: true, estado_fitosanitario: null, observaciones: null,
    vio_animal: null, animales: null, monitor: null, origen: 'app',
  })) as unknown as Monitoreo[]

  const arboles: Arbol[] = arbolesBase.map((a) => ({
    nucleo: a.nucleo, codigo: a.codigo, predio: predioDe(a), vereda: a.vereda,
    nombre_comun: a.nombre_comun, nombre_cientifico: a.nombre_cientifico, familia: a.familia,
    latitud: null, longitud: null, dap_cm: a.dap_cm, altura_m: a.altura_m, protocolo: null,
  }))

  const rondas = [...new Set(monitoreos.map((m) => m.ronda))].sort()
  return {
    monitoreos, arboles,
    periodo: rondas.length ? `${etiquetaRonda(rondas[0])} a ${etiquetaRonda(rondas[rondas.length - 1])}` : '',
    actualizado: new Date().toISOString(),
  }
}

/**
 * El clima va en su propia caché y, si Open-Meteo falla, lanza el error en vez
 * de devolver null: unstable_cache no guarda los errores, así que la próxima
 * visita lo vuelve a intentar. Si fuera dentro de `armar`, una falla pasajera
 * dejaría la página sin clima durante 6 horas (pasó en local el 2026-11-21).
 */
async function armarClima(): Promise<NonNullable<FenologiaPublica['clima']>> {
  const { data, error } = await createServerSupabaseClient().schema('ras').from('arboles_monitoreo')
    .select('nucleo,codigo,predio,latitud,longitud').eq('activo', true).range(0, 4999)
  if (error) throw new Error(error.message)
  const c = await climaPorArbol((data ?? []) as ArbolUbicable[])
  return { periodo: c.periodo, celdas: c.celdas.map((x, i) => ({ id: String(i), normal: x.normal, arboles: x.arboles })) }
}

const datosCache = unstable_cache(armar, ['fenologia-publica-v5'], { revalidate: 6 * 3600 })
const climaCache = unstable_cache(armarClima, ['fenologia-publica-clima-v1'], { revalidate: 24 * 3600 })

export async function fenologiaPublica(): Promise<FenologiaPublica> {
  const [datos, clima] = await Promise.all([
    datosCache(),
    climaCache().catch((e) => {
      // Sin clima la página sigue: los calendarios no dependen de él.
      console.error('[fenologia-publica] sin clima:', e instanceof Error ? e.message : e)
      return null
    }),
  ])
  return { ...datos, clima }
}
