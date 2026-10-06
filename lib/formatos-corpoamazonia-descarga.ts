/**
 * Carga de datos y descarga de los formatos de Corpoamazonia (solo navegador).
 * El llenado en sí vive en `lib/formatos-corpoamazonia.ts`, que es puro.
 */
import { supabase } from '@/lib/supabase'
import {
  llenar071, llenar072, llaveEspecie,
  type ArbolFormato, type CatalogoCorpo, type DatosPredio, type PredioFormato,
} from '@/lib/formatos-corpoamazonia'

export type FormatoCorpo = '071' | '072' | 'ambos'
export interface AvisoPredio { predio: string; avisos: string[] }

const NOMBRE_FORMATO = { '071': 'F-LAR-071 Coordenadas', '072': 'F-LAR-072 Censo' } as const
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

async function bajar(url: string): Promise<ArrayBuffer> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`No se pudo descargar ${url} (HTTP ${r.status})`)
  return r.arrayBuffer()
}

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a')
  el.href = url; el.download = nombre
  document.body.appendChild(el); el.click(); el.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const nombreArchivo = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'predio'

/**
 * Arma los formatos de los predios elegidos y los descarga: un archivo por
 * predio y por formato (así lo pide el F-LAR-072). Si sale más de uno, van en
 * un .zip. Devuelve, por predio, lo que no se pudo llenar.
 */
export async function exportarFormatos(
  familiaIds: string[],
  formato: FormatoCorpo,
  soloProtocolo: boolean,
  onProgreso?: (texto: string) => void,
): Promise<AvisoPredio[]> {
  // shpjs usa `self`: se carga solo aquí, ya en el navegador.
  const { parsearShapefileDesdeUrl } = await import('@/lib/shapefile-client')
  const JSZip = (await import('jszip')).default

  onProgreso?.('Cargando las plantillas…')
  const [cat, p071, p072] = await Promise.all([
    fetch('/plantillas/corpoamazonia-especies.json').then((r) => r.json() as Promise<CatalogoCorpo>),
    formato !== '072' ? bajar('/plantillas/F-LAR-071.xlsx') : null,
    formato !== '071' ? bajar('/plantillas/F-LAR-072.xlsx') : null,
  ])

  const salida: { nombre: string; bytes: Uint8Array }[] = []
  const informe: AvisoPredio[] = []

  for (let i = 0; i < familiaIds.length; i++) {
    const { data: fam, error } = await supabase.schema('ras').from('familias').select('*').eq('id', familiaIds[i]).single()
    if (error || !fam) { informe.push({ predio: familiaIds[i], avisos: ['No se pudo leer el predio.'] }); continue }
    const nombre: string = fam.nombre_finca || fam.nombre_propietario || 'Predio'
    onProgreso?.(`${nombre} (${i + 1} de ${familiaIds.length})…`)
    const avisos: string[] = []

    // Árboles, de mil en mil: Yaguara pasa de 1.000 y PostgREST corta ahí.
    const arboles: (ArbolFormato & { estado_verificacion: string | null })[] = []
    for (let desde = 0; ; desde += 1000) {
      const { data, error: e } = await supabase.schema('ras').from('v_arboles_con_especie')
        .select('codigo, nombre_cientifico, nombre_comun, latitud, longitud, dap_cm, altura_total_m, fecha_registro, nombre_registra, estado_verificacion')
        .eq('familia_id', familiaIds[i]).range(desde, desde + 999)
      if (e) { avisos.push(`No se pudieron leer los árboles: ${e.message}`); break }
      arboles.push(...((data ?? []) as unknown as typeof arboles))
      if (!data || data.length < 1000) break
    }
    let lista = arboles.filter((a) => a.estado_verificacion !== 'Eliminar')
    if (lista.length < arboles.length) avisos.push(`${arboles.length - lista.length} árbol(es) marcados «Eliminar» no se incluyeron.`)
    if (soloProtocolo) {
      const antes = lista.length
      lista = lista.filter((a) => cat.protocolo[llaveEspecie(a.nombre_cientifico)])
      if (antes > lista.length) avisos.push(`${antes - lista.length} árbol(es) de especies sin protocolo no se incluyeron.`)
    }
    lista.sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true }))
    if (lista.length === 0) avisos.push('No quedó ningún árbol para incluir.')

    const poligono = async (url: string | null, cual: string) => {
      if (!url) return null
      try { return await parsearShapefileDesdeUrl(url) }
      catch (e) { avisos.push(`No se pudo leer el shapefile ${cual}: ${e instanceof Error ? e.message : 'error'}`); return null }
    }
    const [finca, umf] = await Promise.all([
      poligono(fam.shapefile_finca_url, 'de la finca'),
      poligono(fam.shapefile_conservacion_url, 'de conservación'),
    ])

    const datos: DatosPredio = {
      predio: fam as PredioFormato, arboles: lista,
      finca: finca?.features ?? [], umf: umf?.features ?? [],
      areaFincaHa: finca?.metrics.areaHa ?? null, areaUmfHa: umf?.metrics.areaHa ?? null,
    }
    if (p071) {
      const r = await llenar071(p071, datos)
      salida.push({ nombre: `${NOMBRE_FORMATO['071']} - ${nombreArchivo(nombre)}.xlsx`, bytes: r.bytes }); avisos.push(...r.avisos)
    }
    if (p072) {
      const r = await llenar072(p072, datos, cat)
      salida.push({ nombre: `${NOMBRE_FORMATO['072']} - ${nombreArchivo(nombre)}.xlsx`, bytes: r.bytes }); avisos.push(...r.avisos)
    }
    informe.push({ predio: nombre, avisos: [...new Set(avisos)] })
  }

  if (salida.length === 1) {
    descargar(new Blob([salida[0].bytes as BlobPart], { type: XLSX }), salida[0].nombre)
  } else if (salida.length > 1) {
    onProgreso?.('Comprimiendo…')
    const zip = new JSZip()
    const usados = new Set<string>()
    for (const s of salida) {
      // Dos fincas con el mismo nombre no deben pisarse dentro del zip.
      let n = s.nombre, k = 2
      while (usados.has(n)) n = s.nombre.replace(/\.xlsx$/, ` (${k++}).xlsx`)
      usados.add(n); zip.file(n, s.bytes)
    }
    descargar(await zip.generateAsync({ type: 'blob' }), `Formatos Corpoamazonia - ${familiaIds.length} predios.zip`)
  }
  return informe
}
