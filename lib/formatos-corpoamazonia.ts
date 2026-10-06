/**
 * Formatos de Corpoamazonia para el manejo sostenible de productos forestales
 * no maderables (cosecha de semillas de los árboles semilleros):
 *
 *   F-LAR-071  Plantilla de coordenadas geográficas (predio, UMF y árboles).
 *   F-LAR-072  Informe de censo o inventario de especies con protocolo.
 *
 * Se llenan con lo que YA está en `ras.*`. Lo que no está se deja en blanco: no
 * se inventa ni se rellena con un valor «probable». En particular, el estado
 * físico y sanitario de cada árbol y si es apto para cosecha NO se escriben —
 * nadie los ha observado— aunque la plantilla de trabajo traiga «Bueno / Sano /
 * Si» de ejemplo en esas columnas.
 *
 * El «tejido» entre los dos formatos: cada árbol lleva el mismo ID y Orden en la
 * hoja Coordenadas_PUNTOS del 071 y en el registro de individuos del 072.
 *
 * Las funciones `llenar071` y `llenar072` son puras (plantilla + datos → bytes)
 * para poder probarlas sin navegador ni base de datos.
 */
import type { Feature, Position } from 'geojson'
import { Plantilla, fila, ponerCelda, reemplazarFilasDesde, type Valor } from '@/lib/xlsx-plantilla'

// ─── Datos de entrada ─────────────────────────────────────────────────────────

export interface PredioFormato {
  nombre_finca: string
  nombre_propietario: string | null
  tipo_documento: string | null
  numero_documento: string | null
  telefono: string | null
  municipio: string | null
  vereda: string | null
  departamento: string | null
  ha_potreros: number | null
  ha_bosque: number | null
  ha_otras: number | null
}

export interface ArbolFormato {
  codigo: string
  nombre_cientifico: string | null
  nombre_comun: string | null
  latitud: number | null
  longitud: number | null
  dap_cm: number | null
  altura_total_m: number | null
  fecha_registro: string | null
  nombre_registra: string | null
}

/** Catálogo extraído del propio F-LAR-072 (`public/plantillas/corpoamazonia-especies.json`). */
export interface CatalogoCorpo {
  /** «genero especie» → [ID-reg, categoría de amenaza, veda] */
  codigos: Record<string, [number, string | null, string | null]>
  /** «genero especie» → [nombre común, % máximo de cosecha (0–1), peso de una semilla en g] */
  protocolo: Record<string, [string, number | null, number | null]>
}

export interface DatosPredio {
  predio: PredioFormato
  arboles: ArbolFormato[]
  /** Polígonos del predio y de la unidad de manejo (área en conservación), en EPSG:4326. */
  finca: Feature[]
  umf: Feature[]
  areaFincaHa: number | null
  areaUmfHa: number | null
}

// ─── Texto ────────────────────────────────────────────────────────────────────

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Llave de especie: género + epíteto, sin autor, sin tildes («Cedrela odorata L.» → «cedrela odorata»). */
export function llaveEspecie(nombre: string | null | undefined): string {
  return sinTildes(String(nombre ?? '').toLowerCase()).replace(/sp\./g, 'sp').split(/\s+/).filter(Boolean).slice(0, 2).join(' ')
}

/**
 * Nombre de objeto como lo pide la plantilla: guion bajo para separar, primera
 * letra en mayúscula y el resto en minúscula, sin signos.
 */
function nombreObjeto(...partes: (string | null | undefined)[]): string {
  const t = partes.filter(Boolean).map((p) => sinTildes(String(p)).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase())
    .filter(Boolean).join('_').slice(0, 250)
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// La base guarda «Caqueta» y «Valparaiso»; la plantilla pide la ortografía correcta.
const ORTOGRAFIA: Record<string, string> = { caqueta: 'Caquetá', valparaiso: 'Valparaíso', 'belen de los andaquies': 'Belén de los Andaquíes' }
const lugar = (s: string | null | undefined) => {
  const t = String(s ?? '').trim()
  // «Por definir» es el relleno de los núcleos sin ubicar: no es un municipio.
  if (sinTildes(t.toLowerCase()) === 'por definir') return ''
  return ORTOGRAFIA[sinTildes(t.toLowerCase())] ?? t
}

// ─── Coordenadas ──────────────────────────────────────────────────────────────

/** Grados decimales → grados, minutos y segundos (2 decimales), sin que 59,999″ se vuelva 60″. */
export function aGms(decimal: number): { g: number; m: number; s: number } {
  const abs = Math.abs(decimal)
  let g = Math.floor(abs)
  let m = Math.floor((abs - g) * 60)
  let s = Math.round(((abs - g) * 60 - m) * 60 * 100) / 100
  if (s >= 60) { s = 0; m += 1 }
  if (m >= 60) { m = 0; g += 1 }
  return { g, m, s }
}

/** Anillos exteriores de un conjunto de polígonos, sin el vértice de cierre repetido. */
function anillos(features: Feature[]): Position[][] {
  const out: Position[][] = []
  for (const f of features) {
    const g = f.geometry
    const polis = g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []
    for (const poli of polis) {
      const ext = poli[0]
      if (!ext || ext.length < 4) continue
      const ult = ext[ext.length - 1]
      out.push(ext[0][0] === ult[0] && ext[0][1] === ult[1] ? ext.slice(0, -1) : ext)
    }
  }
  return out
}

// Estilos de cada columna (A…P) en la primera fila de datos de cada hoja del 071.
const EST_POLIGONOS = [12, 13, 14, 15, 15, 15, 12, 16, 15, 15, 15, 17, 18, 18, 18, 18]
const EST_PUNTOS    = [12, 12, 12, 23, 23, 24, 12, 22, 23, 23, 24, 22, 18, 18, 18, 18]
const COLS_071 = 'ABCDEFGHIJKLMNOP'.split('')
const ATR_071 = 'spans="1:16" ht="12.75" customHeight="1"'

function fila071(n: number, estilos: number[], id: number, orden: number, nombre: string, lat: number, lon: number, p: PredioFormato): string {
  const a = aGms(lat), o = aGms(lon)
  const valores: Valor[] = [
    id, orden, nombre,
    a.g, a.m, a.s, lat < 0 ? 'S' : 'N',
    // La plantilla dice que Latitud y Longitud llevan fórmula; la copia de trabajo
    // las trae vacías, así que la hoja RESULTADOS quedaría en cero. Se reponen.
    { f: `IF(D${n}="","",(D${n}+E${n}/60+F${n}/3600)*IF(G${n}="S",-1,1))` },
    o.g, o.m, o.s,
    { f: `IF(I${n}="","",-(I${n}+J${n}/60+K${n}/3600))` },
    p.vereda?.trim() || null, lugar(p.municipio) || null, lugar(p.departamento) || null, null,
  ]
  return fila(n, ATR_071, COLS_071.map((c, i) => [c, estilos[i], valores[i]]))
}

export interface ResultadoFormato { bytes: Uint8Array; avisos: string[] }

/** La hoja RESULTADOS del 071 solo lee las filas 4 a 2809 de los polígonos. */
const MAX_VERTICES = 2806

export async function llenar071(plantilla: ArrayBuffer, d: DatosPredio): Promise<ResultadoFormato> {
  const avisos: string[] = []
  const libro = await Plantilla.abrir(plantilla)
  const p = d.predio

  // Polígonos: primero el predio, después la unidad de manejo. Un ID por anillo.
  const filasPoli: string[] = []
  let id = 0, n = 4
  const grupos: [string, Feature[]][] = [['Predio', d.finca], ['Umf', d.umf]]
  for (const [etiqueta, feats] of grupos) {
    const rs = anillos(feats)
    rs.forEach((anillo, k) => {
      id += 1
      const nombre = nombreObjeto(etiqueta, p.nombre_finca, rs.length > 1 ? String(k + 1) : null)
      anillo.forEach((v, i) => { filasPoli.push(fila071(n, EST_POLIGONOS, id, i + 1, nombre, v[1], v[0], p)); n += 1 })
    })
  }
  if (d.finca.length === 0) avisos.push('Sin polígono del predio: la hoja de polígonos sale sin el lindero.')
  if (d.umf.length === 0) avisos.push('Sin polígono de conservación: la hoja de polígonos sale sin la unidad de manejo.')
  if (filasPoli.length > MAX_VERTICES) avisos.push(`Los polígonos suman ${filasPoli.length} vértices y la hoja RESULTADOS de la plantilla solo lee ${MAX_VERTICES}: conviene simplificar el lindero.`)
  if ([...d.finca, ...d.umf].some((f) => (f.geometry?.type === 'Polygon' ? f.geometry.coordinates : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates.flat() : []).some((r) => r.some((v) => v[0] > 0)))) {
    avisos.push('Hay vértices con longitud Este: la plantilla asume siempre Oeste. Revisar el shapefile.')
  }
  libro.guardarHoja('Coordenadas_POLÍGONOS_LINEAS', reemplazarFilasDesde(await libro.hoja('Coordenadas_POLÍGONOS_LINEAS'), 4, filasPoli, 'P'))

  // Puntos: un árbol por fila, ID consecutivo y Orden 1 (instrucción de la plantilla).
  const conPunto = d.arboles.filter((a) => a.latitud !== null && a.longitud !== null)
  const filasPuntos = conPunto.map((a, i) =>
    fila071(4 + i, EST_PUNTOS, i + 1, 1, nombreObjeto('Arbol', a.codigo, a.nombre_cientifico), a.latitud!, a.longitud!, p))
  if (conPunto.length < d.arboles.length) avisos.push(`${d.arboles.length - conPunto.length} árbol(es) sin coordenada: no van en la hoja de puntos.`)
  libro.guardarHoja('Coordenadas_PUNTOS', reemplazarFilasDesde(await libro.hoja('Coordenadas_PUNTOS'), 4, filasPuntos, 'P'))

  const decimales = (x: number) => (String(x).split('.')[1] ?? '').length
  const pocos = conPunto.filter((a) => Math.min(decimales(a.latitud!), decimales(a.longitud!)) <= 4).length
  if (pocos) avisos.push(`${pocos} árbol(es) con coordenada de 4 decimales o menos (error de 11 m o más).`)

  return { bytes: await libro.generar(), avisos }
}

// ─── F-LAR-072 ────────────────────────────────────────────────────────────────

const fechaCorta = (iso: string) => { const [a, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${a}` }

/** Lo más repetido de una lista (para «responsable del inventario»). */
function masFrecuente(xs: (string | null)[]): string | null {
  const c = new Map<string, number>()
  for (const x of xs) if (x?.trim()) c.set(x.trim(), (c.get(x.trim()) ?? 0) + 1)
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// Estilos de la fila 13 del registro de individuos (B…X) y de la fila 11 del resumen por especie (B…P).
const EST_REGISTRO: [string, number][] = [['B', 64], ['C', 64], ['D', 55], ['E', 110], ['F', 131], ['G', 57], ['H', 78], ['I', 91], ['J', 78], ['K', 240], ['L', 93], ['M', 240], ['N', 240], ['O', 89], ['P', 223], ['Q', 241], ['R', 224], ['S', 232], ['T', 89], ['U', 79], ['V', 79], ['W', 55], ['X', 57]]
const EST_VOLUMEN: [string, number][] = [['B', 55], ['C', 113], ['D', 134], ['E', 55], ['F', 67], ['G', 65], ['H', 65], ['I', 65], ['J', 65], ['K', 65], ['L', 65], ['M', 66], ['N', 112], ['O', 95], ['P', 56]]

export async function llenar072(plantilla: ArrayBuffer, d: DatosPredio, cat: CatalogoCorpo): Promise<ResultadoFormato> {
  const avisos: string[] = []
  const libro = await Plantilla.abrir(plantilla)
  const p = d.predio
  const areas = [p.ha_potreros, p.ha_bosque, p.ha_otras].filter((x): x is number => typeof x === 'number')
  const areaTotal = areas.length ? Math.round(areas.reduce((s, x) => s + x, 0) * 100) / 100 : null

  // ── Datos básicos ──
  let basicos = await libro.hoja('Datos_básicos')
  // Se escribe SIEMPRE, también cuando no hay dato: la plantilla de trabajo trae
  // valores de ejemplo («Morelia», «Caquetá», «Si») y dejarlos sería afirmar algo
  // que la base no dice. Sin dato, la celda queda en blanco.
  const pon = (ref: string, v: Valor) => {
    const nuevo = ponerCelda(basicos, ref, v || null)
    if (nuevo) basicos = nuevo; else avisos.push(`La plantilla no tiene la celda ${ref} de «Datos_básicos»: ese dato no se escribió.`)
  }
  // Los núcleos históricos traen de propietario un texto de relleno
  // («Núcleo Yaguara (RAS histórico · sin verificar)»): eso no es un interesado.
  pon('N12', /sin verificar/i.test(p.nombre_propietario ?? '') ? null : p.nombre_propietario?.trim())
  pon('N13', p.tipo_documento?.trim().toUpperCase() === 'CC' ? 'Cédula de ciudadanía' : null)
  // La base guarda «17634957, Florencia»: el lugar de expedición no va en el número.
  pon('AG13', p.numero_documento?.split(',')[0].trim())
  pon('I16', p.telefono?.trim())
  pon('I31', p.nombre_finca)
  pon('L32', p.vereda?.trim())
  pon('F33', lugar(p.municipio))
  pon('AF33', lugar(p.departamento))
  pon('N34', areaTotal)
  pon('AC40', typeof p.ha_potreros === 'number' ? (p.ha_potreros > 0 ? 'Si' : 'No') : null)
  pon('AM40', p.ha_potreros ? Math.round(p.ha_potreros * 10000) : null)
  pon('K52', d.umf.length ? `UMF ${p.nombre_finca}` : null)
  pon('AJ52', d.umf.length && d.areaUmfHa !== null ? Math.round(d.areaUmfHa * 100) / 100 : null)
  libro.guardarHoja('Datos_básicos', basicos)
  if (areaTotal && d.areaFincaHa && Math.abs(d.areaFincaHa - areaTotal) / areaTotal > 0.1) {
    avisos.push(`El área declarada del predio (${areaTotal} ha) no coincide con la del polígono (${d.areaFincaHa.toFixed(1)} ha). Se escribió la declarada: revisar cuál es la correcta.`)
  }

  // ── Registro de individuos (especies leñosas) ──
  let registro = await libro.hoja('Regis_Datos_Frutos_Semill_Leños')
  const cab = (ref: string, v: Valor) => { if (v !== null && v !== undefined && v !== '') registro = ponerCelda(registro, ref, v) ?? registro }
  cab('E8', areaTotal)
  cab('G8', d.areaUmfHa !== null ? Math.round(d.areaUmfHa * 100) / 100 : null)
  cab('O9', masFrecuente(d.arboles.map((a) => a.nombre_registra)))
  const fechas = d.arboles.map((a) => a.fecha_registro).filter((f): f is string => !!f).sort()
  if (fechas.length) cab('U9', fechas[0] === fechas[fechas.length - 1] ? fechaCorta(fechas[0]) : `${fechaCorta(fechas[0])} a ${fechaCorta(fechas[fechas.length - 1])}`)

  // El MISMO orden e ID que la hoja de puntos del 071: solo árboles con coordenada.
  const individuos = d.arboles.filter((a) => a.latitud !== null && a.longitud !== null)
  const filasReg: string[] = []
  const total = Math.max(individuos.length, 30)   // la plantilla trae 30 renglones (13 a 42)
  for (let i = 0; i < total; i++) {
    const n = 13 + i, a = individuos[i]
    const codigo = a ? cat.codigos[llaveEspecie(a.nombre_cientifico)] : undefined
    const v: Record<string, Valor> = {
      // Fórmulas de la plantilla, tal como están en los renglones que las conservan.
      // Las dos últimas dividen por una celda que nadie ha llenado todavía y
      // dejaban #DIV/0! en toda la tabla: quedan en blanco hasta que haya dato.
      // Con dato, el resultado es el mismo de la plantilla.
      I: { f: `(H${n}/(100*3.1416))` }, L: { f: `(J${n}-K${n})` },
      O: { f: `4/3*3.1416*((M${n}+N${n})/2)^3*(1/8*L${n})` },
      R: { f: `IF(OR(P${n}="",P${n}=0),"",Q${n}/P${n})` }, T: { f: `IF(OR(R${n}="",S${n}=""),"",R${n}*S${n}/1000)` },
    }
    if (a) Object.assign(v, {
      B: i + 1, C: 1, D: codigo?.[0] ?? null, E: a.nombre_comun, F: a.nombre_cientifico, G: 'Semilla',
      // La base tiene el DAP en cm; el formato pide la circunferencia (CAP) y calcula el DAP.
      H: a.dap_cm ? Math.round(a.dap_cm * Math.PI * 10) / 10 : null,
      J: a.altura_total_m || null,
      S: cat.protocolo[llaveEspecie(a.nombre_cientifico)]?.[2] ?? null,
    })
    filasReg.push(fila(n, 'spans="2:24" ht="14.7" customHeight="1"', EST_REGISTRO.map(([c, s]) => [c, s, v[c] ?? null])))
  }
  libro.guardarHoja('Regis_Datos_Frutos_Semill_Leños', reemplazarFilasDesde(registro, 13, filasReg, 'Z'))

  const sinCodigo = individuos.filter((a) => !cat.codigos[llaveEspecie(a.nombre_cientifico)]).length
  if (sinCodigo) avisos.push(`${sinCodigo} árbol(es) sin código de especie de Corpoamazonia (el nombre científico no está en su catálogo): la columna ID-reg queda vacía.`)
  const sinMedida = individuos.filter((a) => !a.dap_cm || !a.altura_total_m).length
  if (sinMedida) avisos.push(`${sinMedida} árbol(es) sin DAP o sin altura total.`)
  avisos.push('La plantilla trae valores de ejemplo en lo que la intranet no llena (municipio del interesado, tipo de persona, usos del suelo, recursos hídricos, vías, ecosistemas, rutas y costos): revisarlos antes de radicar.')
  if (individuos.length) avisos.push('Quedan en blanco, porque no están en la base: altura del fuste, diámetros de copa, conteo de semillas, estado físico y sanitario, y si el árbol es apto.')

  // ── Resumen por especie ──
  const porEspecie = new Map<string, { cientifico: string; comun: string | null; n: number }>()
  for (const a of individuos) {
    const k = llaveEspecie(a.nombre_cientifico) || '(sin nombre)'
    const e = porEspecie.get(k) ?? { cientifico: a.nombre_cientifico ?? '', comun: a.nombre_comun, n: 0 }
    e.n += 1; porEspecie.set(k, e)
  }
  const especies = [...porEspecie.entries()].sort((a, b) => b[1].n - a[1].n)
  const filasVol: string[] = []
  for (let i = 0; i < Math.max(especies.length, 30); i++) {
    const n = 11 + i, e = especies[i]
    const v: Record<string, Valor> = { O: { f: `K${n}*N${n}` } }
    if (e) {
      const [k, x] = e, codigo = cat.codigos[k], prot = cat.protocolo[k]
      Object.assign(v, {
        B: codigo?.[0] ?? null, C: prot?.[0] ?? x.comun, D: x.cientifico,
        E: codigo ? (codigo[2] ?? 'No') : null, F: codigo?.[1] ?? null,
        G: 'Árbol', H: x.n, I: 'Semillas', L: 'Kilogramos (Kg)',
        // Tope del protocolo: es el máximo que se puede pedir, no una decisión tomada.
        M: typeof prot?.[1] === 'number' ? Math.round(prot[1] * 100) : null,
        P: 'Producción de material vegetal',
      })
    }
    filasVol.push(fila(n, 'spans="2:17"', EST_VOLUMEN.map(([c, s]) => [c, s, v[c] ?? null])))
  }
  libro.guardarHoja('Determinación_Vol_MS', reemplazarFilasDesde(await libro.hoja('Determinación_Vol_MS'), 11, filasVol, 'Q'))

  const sinProtocolo = especies.filter(([k]) => !cat.protocolo[k]).reduce((s, [, x]) => s + x.n, 0)
  if (sinProtocolo) avisos.push(`${sinProtocolo} árbol(es) de especies sin protocolo: este formato es solo para las que lo tienen.`)

  return { bytes: await libro.generar(), avisos }
}
