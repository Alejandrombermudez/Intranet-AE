/**
 * Reporte jurídico de un predio: UN solo PDF con el dictamen de viabilidad y,
 * detrás, todos los documentos que jurídica adjuntó (identidad, tradición,
 * predial, manifestación y los soportes de cada lista de antecedentes).
 *
 * Se arma EN EL NAVEGADOR, no en una ruta: los documentos pueden sumar decenas
 * de megas y una función serverless de Vercel responde con 4,5 MB como máximo.
 * Las URLs firmadas del bucket `juridica-documentos` ya vienen en el `Aliado`
 * que carga la pantalla, así que no hace falta pedir nada más al servidor.
 *
 * Lo que un PDF no puede contener (Word, CSV, Excel) no se omite en silencio:
 * queda en el índice del reporte con la razón, para que nadie crea que el
 * expediente está completo cuando falta un soporte.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import JSZip from 'jszip'
import { ESTADO_CONFIG, type Aliado, type EstadoAliado } from '@/lib/juridica-schema'
import { MARCA, SEMAFORO, pares, fecha as formatoFecha } from '@/lib/expediente-formato'

// ─── Qué documentos tiene un predio ───────────────────────────────────────────

export interface DocumentoReporte {
  clave: string
  titulo: string
  grupo: 'Hoja 1 · Datos básicos' | 'Hoja 3 · Antecedentes'
  url: string
}

/** Listas restrictivas de la HOJA 3, en el orden en que se diligencian. */
const LISTAS = [
  { key: 'rama_judicial',    label: 'Rama Judicial' },
  { key: 'procuraduria',     label: 'Procuraduría General de la Nación' },
  { key: 'contraloria',      label: 'Contraloría General de la República' },
  { key: 'policia_nacional', label: 'Policía Nacional' },
  { key: 'rnmc',             label: 'RNMC (Registro Nacional de Medidas Correctivas)' },
  { key: 'onu',              label: 'ONU — Sanciones' },
  { key: 'ofac',             label: 'OFAC (EE. UU.)' },
  { key: 'bid',              label: 'BID — Banco Interamericano de Desarrollo' },
  { key: 'banco_mundial',    label: 'Banco Mundial' },
  { key: 'hm_treasury',      label: 'HM Treasury (Reino Unido)' },
  { key: 'fbi',              label: 'FBI' },
  { key: 'interpol',         label: 'INTERPOL' },
  { key: 'ue_terroristas',   label: 'UE — Organizaciones terroristas' },
  { key: 'dea',              label: 'DEA' },
] as const

/** Los documentos adjuntos del caso, en el orden del expediente. */
export function documentosDe(a: Aliado): DocumentoReporte[] {
  const h1 = 'Hoja 1 · Datos básicos' as const
  const h3 = 'Hoja 3 · Antecedentes' as const
  const docs: DocumentoReporte[] = []
  const mete = (clave: string, titulo: string, grupo: DocumentoReporte['grupo'], url: unknown) => {
    if (typeof url === 'string' && url) docs.push({ clave, titulo, grupo, url })
  }
  mete('cedula', 'Documento de identidad', h1, a.cedula_url)
  mete('certificado_tradicion', 'Certificado de tradición y libertad', h1, a.certificado_tradicion_url)
  mete('recibo_predial', 'Recibo del impuesto predial', h1, a.recibo_predial_url)
  mete('manifestacion', 'Manifestación de interés firmada', h1, a.manifestacion_url)
  for (const { key, label } of LISTAS) mete(key, label, h3, a.antecedentes?.[`${key}_url`])
  return docs
}

// ─── Descarga y conversión de cada documento ──────────────────────────────────

type Tipo = 'pdf' | 'jpg' | 'png' | 'imagen' | 'otro'

function tipoDe(b: Uint8Array): Tipo {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf'
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45
  const gif  = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46
  return webp || gif ? 'imagen' : 'otro'
}

function extensionDe(url: string): string {
  try { return new URL(url).pathname.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase() ?? '' } catch { return '' }
}

/** WEBP/GIF no los embebe pdf-lib: se pasan por un canvas a JPEG. */
async function aJpeg(bytes: Uint8Array): Promise<Uint8Array> {
  const bmp = await createImageBitmap(new Blob([bytes as BlobPart]))
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width; canvas.height = bmp.height
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, bmp.width, bmp.height)
  ctx.drawImage(bmp, 0, 0)
  const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88))
  if (!blob) throw new Error('canvas')
  return new Uint8Array(await blob.arrayBuffer())
}

const A4_W = 595.28
const A4_H = 841.89
const MARGEN_IMG = 30
const PIE_IMG = 40

interface FilaIndice {
  doc: DocumentoReporte
  /** Páginas (1-based) dentro del cuerpo de anexos, o null si no se pudo incluir. */
  paginas: [number, number] | null
  nota: string | null
}

/** Mete un documento al cuerpo de anexos. Devuelve cuántas páginas aportó o la razón de no incluirlo. */
async function agregarAnexo(cuerpo: PDFDocument, d: DocumentoReporte): Promise<{ n: number } | { motivo: string }> {
  let bytes: Uint8Array
  try {
    const r = await fetch(d.url)
    if (!r.ok) return { motivo: `No se pudo descargar (error ${r.status})` }
    bytes = new Uint8Array(await r.arrayBuffer())
  } catch {
    return { motivo: 'No se pudo descargar el archivo' }
  }

  let tipo = tipoDe(bytes)
  try {
    if (tipo === 'pdf') {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
      const pgs = await cuerpo.copyPages(src, src.getPageIndices())
      pgs.forEach((p) => cuerpo.addPage(p))
      return { n: pgs.length }
    }
    if (tipo === 'imagen') { bytes = await aJpeg(bytes); tipo = 'jpg' }
    if (tipo === 'jpg' || tipo === 'png') {
      const img = tipo === 'jpg' ? await cuerpo.embedJpg(bytes) : await cuerpo.embedPng(bytes)
      const apaisada = img.width > img.height
      const [w, h] = apaisada ? [A4_H, A4_W] : [A4_W, A4_H]
      const page = cuerpo.addPage([w, h])
      const k = Math.min((w - MARGEN_IMG * 2) / img.width, (h - MARGEN_IMG - PIE_IMG) / img.height, 2)
      const iw = img.width * k, ih = img.height * k
      page.drawImage(img, { x: (w - iw) / 2, y: PIE_IMG + (h - MARGEN_IMG - PIE_IMG - ih) / 2, width: iw, height: ih })
      return { n: 1 }
    }
  } catch {
    return { motivo: 'El archivo está dañado o protegido y no se pudo leer' }
  }
  const ext = extensionDe(d.url)
  return { motivo: `Formato${ext ? ` .${ext}` : ''} que no se puede unir a un PDF: descárgalo desde la ficha` }
}

// ─── Maquetación de las páginas del dictamen ──────────────────────────────────

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}
const C = {
  bosque: hex(MARCA.bosque), hueso: hex(MARCA.hueso), tinta: hex(MARCA.tinta),
  ambar: hex(MARCA.ambar), taupe: hex(MARCA.taupe), marron: hex(MARCA.marron),
  suave: rgb(0.36, 0.34, 0.31), linea: rgb(0.82, 0.8, 0.75),
}
const M = 48
const ANCHO = A4_W - M * 2

/** Helvetica solo codifica WinAnsi: lo que no entre se cambia en vez de romper el PDF. */
const limpio = (s: string) =>
  s.replace(/[\r\t]+/g, ' ').replace(/[^\n\x20-\x7E -ÿ–—‘’“”•…]/g, '?')

function envolver(texto: string, font: PDFFont, size: number, ancho: number): string[] {
  const out: string[] = []
  for (const parrafo of limpio(texto).split('\n')) {
    let linea = ''
    for (const palabra of parrafo.split(' ')) {
      const prueba = linea ? `${linea} ${palabra}` : palabra
      if (font.widthOfTextAtSize(prueba, size) <= ancho) { linea = prueba; continue }
      if (linea) out.push(linea)
      // Palabra más ancha que la columna (una URL, un código): se parte por letras.
      let resto = palabra
      while (font.widthOfTextAtSize(resto, size) > ancho) {
        let i = resto.length
        while (i > 1 && font.widthOfTextAtSize(resto.slice(0, i), size) > ancho) i--
        out.push(resto.slice(0, i)); resto = resto.slice(i)
      }
      linea = resto
    }
    out.push(linea)
  }
  return out
}

interface Fuentes { reg: PDFFont; neg: PDFFont }
async function fuentes(doc: PDFDocument): Promise<Fuentes> {
  return { reg: await doc.embedFont(StandardFonts.Helvetica), neg: await doc.embedFont(StandardFonts.HelveticaBold) }
}

function renderDictamen(doc: PDFDocument, f: Fuentes, a: Aliado, filas: FilaIndice[], paginasDictamen: number, hoy: string) {
  let page: PDFPage = doc.addPage([A4_W, A4_H])
  let y = A4_H - M

  const asegurar = (alto: number) => {
    if (y - alto >= M + 14) return
    page = doc.addPage([A4_W, A4_H]); y = A4_H - M
  }

  const seccion = (titulo: string) => {
    asegurar(46)
    y -= 12
    page.drawText(limpio(titulo.toUpperCase()), { x: M, y, size: 9, font: f.neg, color: C.bosque })
    y -= 6
    page.drawLine({ start: { x: M, y }, end: { x: M + ANCHO, y }, thickness: 0.6, color: C.bosque })
    y -= 14
  }

  const fila = (k: string, v: string | null | undefined, colorValor = C.tinta) => {
    const lineas = envolver(v && v.trim() ? v : '—', f.reg, 9, ANCHO - 150)
    asegurar(lineas.length * 12 + 4)
    page.drawText(limpio(k), { x: M, y, size: 8.5, font: f.reg, color: C.suave })
    lineas.forEach((l, i) => page.drawText(l, { x: M + 150, y: y - i * 12, size: 9, font: f.reg, color: colorValor }))
    y -= lineas.length * 12 + 4
  }

  // Banda de cabecera
  page.drawRectangle({ x: 0, y: A4_H - 118, width: A4_W, height: 118, color: C.bosque })
  page.drawText('AMAZONIA EMPRENDE · REPORTE JURIDICO', { x: M, y: A4_H - 40, size: 8.5, font: f.neg, color: C.ambar })
  const titulo = envolver(a.nombre_predio || 'Predio sin nombre', f.neg, 20, ANCHO)
  titulo.slice(0, 2).forEach((l, i) => page.drawText(l, { x: M, y: A4_H - 68 - i * 24, size: 20, font: f.neg, color: C.hueso }))
  page.drawText('Viabilidad jurídica del predio', { x: M, y: A4_H - 68 - Math.min(titulo.length, 2) * 24 + 4, size: 10, font: f.reg, color: C.hueso })
  page.drawText(limpio(`Generado el ${hoy}`), {
    x: A4_W - M - f.reg.widthOfTextAtSize(limpio(`Generado el ${hoy}`), 8.5), y: A4_H - 40, size: 8.5, font: f.reg, color: C.hueso,
  })
  y = A4_H - 118 - 16

  // Dictamen
  const semaforo = a.analisis_juridico?.semaforo ?? null
  const sem = semaforo ? SEMAFORO[semaforo] : null
  seccion('Dictamen')
  asegurar(18)
  page.drawText('Estado de la debida diligencia', { x: M, y, size: 8.5, font: f.reg, color: C.suave })
  page.drawText(limpio(ESTADO_CONFIG[a.estado as EstadoAliado]?.label ?? a.estado), { x: M + 150, y, size: 11, font: f.neg, color: C.tinta })
  y -= 18
  asegurar(18)
  page.drawText('Semáforo del folio', { x: M, y, size: 8.5, font: f.reg, color: C.suave })
  if (sem) {
    page.drawRectangle({ x: M + 150, y: y - 1, width: 9, height: 9, color: hex(sem.hex) })
    page.drawText(limpio(sem.label), { x: M + 165, y, size: 11, font: f.neg, color: C.tinta })
  } else {
    page.drawText('Sin analizar', { x: M + 150, y, size: 9, font: f.reg, color: C.suave })
  }
  y -= 16
  const veredicto = a.antecedentes?.aprobado
  fila('Antecedentes de la persona',
    veredicto === true ? 'Aprobados' : veredicto === false ? 'No aprobados' : 'Sin veredicto')

  // Hoja 1
  seccion('Hoja 1 · Datos básicos')
  const matriculas = a.matriculas?.length ? a.matriculas.join(', ') : a.matricula_inmobiliaria
  fila('Propietario', a.nombre_completo)
  fila('Documento', a.numero_documento.startsWith('S/D-') ? 'Sin documento' : `${a.tipo_documento} ${a.numero_documento}`)
  fila('Ubicación', [a.vereda, a.municipio, a.departamento].filter(Boolean).join(', '))
  fila('Zona AE', a.zona_ae)
  fila(a.matriculas && a.matriculas.length > 1 ? 'Matrículas inmobiliarias' : 'Matrícula inmobiliaria', matriculas)
  fila('Código catastral', a.codigo_catastral)
  fila('Área registral', a.area_registral != null ? `${a.area_registral.toLocaleString('es-CO')} ha` : null)
  fila('Último pago predial', a.anio_ultimo_pago_predial != null ? String(a.anio_ultimo_pago_predial) : null)
  fila('Manifestó interés', a.manifestacion_interes == null ? null : a.manifestacion_interes ? 'Sí' : 'No')
  fila('Obs. de la manifestación', a.manifestacion_observaciones)

  // Hoja 2
  seccion('Hoja 2 · Análisis jurídico del folio')
  const analisis = pares(a.analisis_juridico as Record<string, unknown> | null).filter((p) => p.clave !== 'semaforo')
  if (analisis.length === 0) fila('Análisis', 'Pendiente de completar', C.suave)
  else analisis.forEach((p) => fila(p.etiqueta, p.valor))

  // Hoja 3
  seccion('Hoja 3 · Antecedentes y listas restrictivas')
  if (!a.antecedentes) {
    fila('Antecedentes', 'Pendiente de completar', C.suave)
  } else {
    const celda = (v: unknown): [string, typeof C.tinta] =>
      v === true ? ['Con hallazgo', C.marron] : v === false ? ['Sin hallazgos', C.tinta] : ['No consultada', C.suave]
    const urlDe = new Set(documentosDe(a).filter((d) => d.grupo === 'Hoja 3 · Antecedentes').map((d) => d.clave))
    asegurar(20)
    page.drawText('Lista', { x: M, y, size: 8, font: f.neg, color: C.suave })
    page.drawText('Resultado', { x: M + 300, y, size: 8, font: f.neg, color: C.suave })
    page.drawText('Soporte', { x: M + 410, y, size: 8, font: f.neg, color: C.suave })
    y -= 5
    page.drawLine({ start: { x: M, y }, end: { x: M + ANCHO, y }, thickness: 0.4, color: C.linea })
    y -= 11
    const filasLista: [string, unknown, boolean | null][] = [
      ...LISTAS.map((l) => [l.label, a.antecedentes![l.key], urlDe.has(l.key)] as [string, unknown, boolean]),
      ['PEP (persona expuesta políticamente)', a.antecedentes.pep, null],
      ['Prensa negativa', a.antecedentes.prensa_negativa, null],
    ]
    for (const [nombre, v, soporte] of filasLista) {
      asegurar(14)
      const [txt, col] = celda(v)
      page.drawText(limpio(nombre), { x: M, y, size: 8.5, font: f.reg, color: C.tinta })
      page.drawText(txt, { x: M + 300, y, size: 8.5, font: v === true ? f.neg : f.reg, color: col })
      page.drawText(soporte === null ? '—' : soporte ? 'Adjunto' : 'Sin adjunto', { x: M + 410, y, size: 8.5, font: f.reg, color: C.suave })
      y -= 13
    }
    y -= 4
    fila('Observaciones', a.antecedentes.observaciones)
  }

  // Índice de anexos, con la página de cada uno
  seccion('Documentos adjuntos')
  if (filas.length === 0) {
    fila('Anexos', 'Este predio no tiene documentos adjuntos', C.suave)
  } else {
    let pagina = paginasDictamen + 1
    filas.forEach((fi, i) => {
      const nota = fi.paginas ? null : fi.nota
      const lineasNota = nota ? envolver(nota, f.reg, 8, ANCHO - 28) : []
      asegurar(14 + lineasNota.length * 10)
      const ref = fi.paginas
        ? (fi.paginas[0] === fi.paginas[1] ? `pág. ${pagina}` : `págs. ${pagina}–${pagina + fi.paginas[1] - fi.paginas[0]}`)
        : 'No incluido'
      if (fi.paginas) pagina += fi.paginas[1] - fi.paginas[0] + 1
      page.drawText(String(i + 1).padStart(2, '0'), { x: M, y, size: 8.5, font: f.neg, color: C.bosque })
      page.drawText(limpio(fi.doc.titulo), { x: M + 24, y, size: 9, font: f.reg, color: C.tinta })
      page.drawText(ref, {
        x: A4_W - M - f.reg.widthOfTextAtSize(ref, 8.5), y, size: 8.5,
        font: f.reg, color: fi.paginas ? C.suave : C.marron,
      })
      y -= 12
      lineasNota.forEach((l) => { page.drawText(l, { x: M + 24, y, size: 8, font: f.reg, color: C.marron }); y -= 10 })
      y -= 2
    })
  }
}

// ─── Armado ───────────────────────────────────────────────────────────────────

export type Progreso = (texto: string) => void

/** `completo` = dictamen + anexos; `adjuntos` = solo los documentos que subieron, sin dictamen. */
export type ModoReporte = 'completo' | 'adjuntos'

export interface ResultadoReporte {
  /** Null si no hubo nada que unir (modo `adjuntos` sin ningún documento legible). */
  bytes: Uint8Array | null
  /** Documentos que no entraron al PDF, con la razón. */
  omitidos: { titulo: string; motivo: string }[]
  incluidos: number
}

export async function armarReporte(a: Aliado, onProgreso?: Progreso, modo: ModoReporte = 'completo'): Promise<ResultadoReporte> {
  const docs = documentosDe(a)
  const cuerpo = await PDFDocument.create()
  const filas: FilaIndice[] = []
  const rotulos: string[] = []   // un rótulo «Anexo n · título» por página del cuerpo

  for (let i = 0; i < docs.length; i++) {
    const d = docs[i]
    onProgreso?.(`${a.nombre_predio || 'Predio'} · documento ${i + 1} de ${docs.length}`)
    const desde = cuerpo.getPageCount()
    const r = await agregarAnexo(cuerpo, d)
    if ('motivo' in r) { filas.push({ doc: d, paginas: null, nota: r.motivo }); continue }
    filas.push({ doc: d, paginas: [desde + 1, desde + r.n], nota: null })
    for (let k = 0; k < r.n; k++) rotulos.push(`Anexo ${String(i + 1).padStart(2, '0')} · ${d.titulo}`)
  }

  const omitidos = filas.filter((fi) => !fi.paginas).map((fi) => ({ titulo: fi.doc.titulo, motivo: fi.nota ?? '' }))
  const incluidos = filas.filter((fi) => fi.paginas).length

  if (modo === 'adjuntos' && cuerpo.getPageCount() === 0) return { bytes: null, omitidos, incluidos }

  // El índice dice en qué página cae cada anexo, y eso depende de cuántas páginas
  // ocupa el dictamen: se mide primero en un PDF de prueba.
  const hoy = formatoFecha(new Date().toISOString())
  let nDictamen = 0
  if (modo === 'completo') {
    const prueba = await PDFDocument.create()
    renderDictamen(prueba, await fuentes(prueba), a, filas, 0, hoy)
    nDictamen = prueba.getPageCount()
  }

  const out = await PDFDocument.create()
  out.setTitle(`Reporte jurídico — ${a.nombre_predio || a.nombre_completo}`)
  out.setProducer('Amazonía Emprende · Intranet')
  const f = await fuentes(out)
  if (modo === 'completo') renderDictamen(out, f, a, filas, nDictamen, hoy)
  if (cuerpo.getPageCount() > 0) {
    const copiadas = await out.copyPages(cuerpo, cuerpo.getPageIndices())
    copiadas.forEach((p) => out.addPage(p))
  }

  // Pie en todas las páginas: de qué anexo es y «n / total».
  const total = out.getPageCount()
  out.getPages().forEach((p, i) => {
    if (p.getRotation().angle !== 0) return  // un escaneo girado: el pie saldría de lado
    const { x, y, width } = p.getMediaBox()
    const rotulo = i >= nDictamen ? rotulos[i - nDictamen] : 'Reporte jurídico'
    const num = `${i + 1} / ${total}`
    p.drawText(limpio(rotulo), { x: x + 28, y: y + 14, size: 7.5, font: f.reg, color: C.suave })
    p.drawText(num, { x: x + width - 28 - f.reg.widthOfTextAtSize(num, 7.5), y: y + 14, size: 7.5, font: f.reg, color: C.suave })
  })

  return { bytes: await out.save({ useObjectStreams: true }), omitidos, incluidos }
}

// ─── Descarga ─────────────────────────────────────────────────────────────────

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a')
  el.href = url; el.download = nombre
  document.body.appendChild(el); el.click(); el.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const nombreArchivo = (a: Aliado, modo: ModoReporte) =>
  `${modo === 'completo' ? 'Reporte juridico' : 'Documentos'} - ${(a.nombre_predio || a.nombre_completo).normalize('NFD').replace(/[̀-ͯ]/g, '')}`
    .replace(/[^\w\- ]+/g, '').trim().slice(0, 80)

/**
 * Un predio → un PDF. Varios → un .zip con un PDF por predio (juntarlos en un
 * solo PDF mezclaría expedientes de personas distintas en un mismo archivo).
 * Devuelve los documentos que no se pudieron incluir, por predio.
 */
export async function descargarReportes(
  casos: Aliado[],
  modo: ModoReporte,
  onProgreso?: Progreso,
): Promise<{ predio: string; titulo: string; motivo: string }[]> {
  const avisos: { predio: string; titulo: string; motivo: string }[] = []
  const nombrePredio = (a: Aliado) => a.nombre_predio || a.nombre_completo

  const sinNada = (a: Aliado) =>
    avisos.push({ predio: nombrePredio(a), titulo: 'Sin documentos', motivo: 'no hay ningún adjunto que se pueda unir a un PDF' })

  if (casos.length === 1) {
    const r = await armarReporte(casos[0], onProgreso, modo)
    r.omitidos.forEach((o) => avisos.push({ predio: nombrePredio(casos[0]), ...o }))
    if (!r.bytes) { sinNada(casos[0]); return avisos }
    descargar(new Blob([r.bytes as BlobPart], { type: 'application/pdf' }), `${nombreArchivo(casos[0], modo)}.pdf`)
    return avisos
  }

  const zip = new JSZip()
  const usados = new Set<string>()
  for (let i = 0; i < casos.length; i++) {
    const a = casos[i]
    const r = await armarReporte(a, (t) => onProgreso?.(`Reporte ${i + 1} de ${casos.length} — ${t}`), modo)
    r.omitidos.forEach((o) => avisos.push({ predio: nombrePredio(a), ...o }))
    if (!r.bytes) { sinNada(a); continue }
    let nombre = nombreArchivo(a, modo), n = 2
    while (usados.has(nombre)) nombre = `${nombreArchivo(a, modo)} (${n++})`
    usados.add(nombre)
    zip.file(`${nombre}.pdf`, r.bytes)
  }
  if (usados.size === 0) return avisos
  onProgreso?.('Comprimiendo el paquete…')
  const blob = await zip.generateAsync({ type: 'blob' })
  descargar(blob, `${modo === 'completo' ? 'Reportes juridicos' : 'Documentos'} - ${usados.size} predios.zip`)
  return avisos
}
