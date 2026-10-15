/**
 * PLANTILLAS EN PDF DE TALENTO HUMANO — cuenta de cobro y certificado laboral
 * ─────────────────────────────────────────────────────────────────────────
 * Se arman EN EL NAVEGADOR con jsPDF, desde la foto fija que guarda la base
 * (`cuentas_cobro.datos`, `certificados.datos`): el mismo registro produce
 * siempre el mismo documento, aunque la ficha de la persona cambie después.
 *
 * UNA SOLA PLANTILLA para todos los documentos (`plantilla()`): banda verde
 * bosque con filete ámbar, el isotipo y la organización a la izquierda, el
 * nombre del documento y su número a la derecha, la huella en marca de agua y
 * el pie en hueso con «Inspirar · Nutrir · Actuar» y los datos de contacto. Un
 * documento nuevo (paz y salvo, constancia…) usa la misma y solo escribe su
 * cuerpo. Tipografía estándar (Helvetica): el PDF no depende de fuentes externas.
 */
import { MARCA } from '@/lib/expediente-formato'
import { fechaEnLetras, pesosEnLetras } from '@/lib/numero-letras'
import { ISOTIPO_PATH, ISOTIPO_TRANSFORM, ISOTIPO_VIEWBOX } from '@/app/components/Isotipo'
import {
  MODALIDAD, SIGLA_DOC, TIPO_CUENTA, fechaLarga, pesos,
  type CuentaCobro, type DatosCertificado,
} from '@/lib/talento'

type Doc = import('jspdf').jsPDF

const ANCHO = 215.9, ALTO = 279.4, MARGEN = 25
const UTIL = ANCHO - 2 * MARGEN
const ALTO_PIE = 16
const rgb = (hex: string): [number, number, number] =>
  [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]

async function nuevoDoc(): Promise<Doc> {
  const { jsPDF } = await import('jspdf')
  return new jsPDF({ unit: 'mm', format: 'letter', compress: true })
}

// ─── El isotipo, como imagen ──────────────────────────────────────────────────
// jsPDF no dibuja SVG: se pinta el trazo en un canvas y entra como PNG. Solo en
// el navegador; fuera de él (pruebas en Node) el documento sale sin isotipo.

const isotipos = new Map<string, string | null>()
async function isotipoPNG(color: string): Promise<string | null> {
  if (isotipos.has(color)) return isotipos.get(color)!
  if (typeof document === 'undefined') return null
  try {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${ISOTIPO_VIEWBOX}"><path fill="${color}" transform="${ISOTIPO_TRANSFORM}" d="${ISOTIPO_PATH}"/></svg>`
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    await img.decode()
    const c = document.createElement('canvas'); c.width = 623; c.height = 772
    c.getContext('2d')!.drawImage(img, 0, 0, 623, 772)
    const png = c.toDataURL('image/png')
    isotipos.set(color, png)
    return png
  } catch {
    isotipos.set(color, null)
    return null
  }
}

// ─── La plantilla ─────────────────────────────────────────────────────────────

interface Organizacion {
  razon_social?: string | null; nit?: string | null; direccion?: string | null; ciudad?: string | null
  telefono?: string | null; correo?: string | null
}

/**
 * Encabezado, marca de agua y pie de cualquier documento. Devuelve la Y donde
 * empieza el cuerpo.
 *   tipo        «Cuenta de cobro», «Certificado laboral»…
 *   referencia  el número o el código del documento
 *   legal       la línea pequeña del pie (quién lo generó, cómo se verifica)
 */
async function plantilla(doc: Doc, { org, tipo, referencia, legal }: {
  org: Organizacion; tipo: string; referencia: string; legal: string
}): Promise<number> {
  const razon = org.razon_social || 'Amazonía Emprende'
  const iso = await isotipoPNG(MARCA.bosque)

  // Marca de agua: la huella grande, casi transparente, abajo a la derecha.
  if (iso) {
    const GState = (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState
    doc.saveGraphicsState()
    doc.setGState(new GState({ opacity: 0.045 }) as never)
    doc.addImage(iso, 'PNG', ANCHO - 118, ALTO - ALTO_PIE - 150, 112, 139, 'isotipo', 'FAST')
    doc.restoreGraphicsState()
  }

  // Banda superior: verde bosque y un filete ámbar.
  doc.setFillColor(...rgb(MARCA.bosque)); doc.rect(0, 0, ANCHO, 5, 'F')
  doc.setFillColor(...rgb(MARCA.ambar)); doc.rect(0, 5, ANCHO, 0.9, 'F')

  // Isotipo y organización
  const xTexto = iso ? MARGEN + 12 : MARGEN
  if (iso) doc.addImage(iso, 'PNG', MARGEN, 13, 8.4, 10.4, 'isotipo', 'FAST')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...rgb(MARCA.bosque))
  doc.text(razon.toUpperCase(), xTexto, 18, { charSpace: 0.7 })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...rgb(MARCA.oliva))
  doc.text(org.nit ? `NIT ${org.nit}` : 'NIT por registrar', xTexto, 22.5)

  // Tipo de documento y referencia, a la derecha
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...rgb(MARCA.musgo))
  aLaDerecha(doc, tipo.toUpperCase(), 17.5, 1)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...rgb(MARCA.tinta))
  doc.text(referencia, ANCHO - MARGEN, 22.5, { align: 'right' })

  doc.setDrawColor(...rgb(MARCA.taupe)); doc.setLineWidth(0.2)
  doc.line(MARGEN, 28, ANCHO - MARGEN, 28)

  // Pie: banda hueso con el lema y el contacto; encima, la línea legal.
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...rgb(MARCA.oliva))
  doc.text(doc.splitTextToSize(legal, UTIL), MARGEN, ALTO - ALTO_PIE - 5)
  doc.setFillColor(...rgb(MARCA.hueso)); doc.rect(0, ALTO - ALTO_PIE, ANCHO, ALTO_PIE, 'F')
  doc.setFillColor(...rgb(MARCA.bosque)); doc.rect(0, ALTO - 1.2, ANCHO, 1.2, 'F')
  const LEMA = 'INSPIRAR · NUTRIR · ACTUAR'
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
  const anchoLema = anchoEspaciado(doc, LEMA, 0.9)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  const contacto = [org.direccion, org.ciudad, org.telefono, org.correo].filter(Boolean).join('  ·  ')
  // Lema y contacto en una línea si caben; si no, el contacto baja a una segunda.
  const enUna = !contacto || anchoLema + 8 + doc.getTextWidth(contacto) <= UTIL
  const yLema = enUna ? ALTO - ALTO_PIE / 2 + 0.5 : ALTO - ALTO_PIE + 6
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...rgb(MARCA.bosque))
  doc.text(LEMA, MARGEN, yLema, { charSpace: 0.9 })
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...rgb(MARCA.oliva))
  if (contacto && enUna) doc.text(contacto, ANCHO - MARGEN, yLema, { align: 'right' })
  else if (contacto) doc.text(contacto, MARGEN, yLema + 4.6)

  return 44
}

/** Párrafo justificado; devuelve la Y donde termina. */
function parrafo(doc: Doc, texto: string, y: number, { tam = 10.5, negrita = false, interlinea = 5.2 } = {}): number {
  doc.setFont('helvetica', negrita ? 'bold' : 'normal'); doc.setFontSize(tam); doc.setTextColor(...rgb(MARCA.tinta))
  const lineas: string[] = doc.splitTextToSize(texto, UTIL)
  lineas.forEach((l, i) => {
    const ultima = i === lineas.length - 1
    doc.text(l, MARGEN, y + i * interlinea, ultima ? undefined : { align: 'justify', maxWidth: UTIL })
  })
  return y + lineas.length * interlinea
}

/** Ancho real de un texto con espaciado entre letras (jsPDF no lo cuenta al alinear). */
function anchoEspaciado(doc: Doc, texto: string, espacio: number): number {
  return doc.getTextWidth(texto) + espacio * Math.max(texto.length - 1, 0)
}

/** Texto espaciado alineado al margen derecho, con la fuente ya puesta. */
function aLaDerecha(doc: Doc, texto: string, y: number, espacio: number) {
  doc.text(texto, ANCHO - MARGEN - anchoEspaciado(doc, texto, espacio), y, { charSpace: espacio })
}

function rotulo(doc: Doc, texto: string, y: number) {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...rgb(MARCA.musgo))
  doc.text(texto.toUpperCase(), MARGEN, y, { charSpace: 0.9 })
}

function firma(doc: Doc, y: number, imagen: string | null, lineas: string[]): number {
  if (imagen && /^data:image\/(png|jpe?g)/.test(imagen)) {
    try { doc.addImage(imagen, imagen.includes('png') ? 'PNG' : 'JPEG', MARGEN, y - 2, 50, 18, undefined, 'FAST') } catch { /* imagen dañada: va sin firma */ }
  }
  doc.setDrawColor(...rgb(MARCA.tinta)); doc.setLineWidth(0.3)
  doc.line(MARGEN, y + 17, MARGEN + 70, y + 17)
  doc.setTextColor(...rgb(MARCA.tinta))
  lineas.forEach((l, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal'); doc.setFontSize(i === 0 ? 10 : 9)
    doc.text(l, MARGEN, y + 22 + i * 4.5)
  })
  return y + 22 + lineas.length * 4.5
}

const documentoDe = (p: { tipo_documento: string | null; numero_documento: string; lugar_expedicion: string | null }) =>
  `${SIGLA_DOC[p.tipo_documento ?? 'CC'] ?? 'C.C.'} ${Number(p.numero_documento) ? Number(p.numero_documento).toLocaleString('es-CO') : p.numero_documento}${p.lugar_expedicion ? ` de ${p.lugar_expedicion}` : ''}`

const DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g')
const sinTildes = (s: string) => s.normalize('NFD').replace(DIACRITICOS, '').replace(/[^A-Za-z0-9-]+/g, '-')

// ─── Cuenta de cobro ──────────────────────────────────────────────────────────

export async function pdfCuentaCobro(c: Pick<CuentaCobro, 'consecutivo' | 'fecha' | 'periodo_desde' | 'periodo_hasta' | 'concepto' | 'valor' | 'datos' | 'id'>): Promise<Blob> {
  const { persona: p, contrato: k, organizacion: o } = c.datos
  const doc = await nuevoDoc()
  const numero = `N.º ${String(c.consecutivo).padStart(3, '0')}`
  let y = await plantilla(doc, {
    org: o, tipo: 'Cuenta de cobro', referencia: numero,
    legal: `Radicada en la intranet de ${o.razon_social || 'Amazonía Emprende'} el ${new Date(c.datos.radicada).toLocaleString('es-CO')} por ${p.email}. Referencia ${c.id.slice(0, 8).toUpperCase()}.`,
  })
  const nombre = `${p.nombres} ${p.apellidos}`.toUpperCase()

  doc.setFont('helvetica', 'bold'); doc.setFontSize(21); doc.setTextColor(...rgb(MARCA.bosque))
  doc.text('Cuenta de cobro', MARGEN, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...rgb(MARCA.tinta))
  doc.text(`${o.ciudad || 'Florencia'}, ${fechaLarga(c.fecha)}`, MARGEN, y + 7)

  y += 21; rotulo(doc, o.razon_social || 'Amazonía Emprende', y)
  y = parrafo(doc, o.nit ? `NIT ${o.nit}` : 'NIT por registrar', y + 5, { tam: 10 })

  y += 7; rotulo(doc, 'Debe a', y)
  y = parrafo(doc, nombre, y + 5.5, { negrita: true, tam: 11 })
  y = parrafo(doc, documentoDe(p), y, { tam: 10 })

  // El valor, destacado en una franja papel con filete ámbar
  y += 6
  doc.setFillColor(...rgb(MARCA.papel)); doc.rect(MARGEN - 4, y - 1, UTIL + 8, 20, 'F')
  doc.setFillColor(...rgb(MARCA.ambar)); doc.rect(MARGEN - 4, y - 1, 1.2, 20, 'F')
  rotulo(doc, 'La suma de', y + 4.5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...rgb(MARCA.tinta))
  doc.text(pesos(c.valor), ANCHO - MARGEN, y + 7, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...rgb(MARCA.oliva))
  doc.text(doc.splitTextToSize(pesosEnLetras(c.valor), UTIL - 4), MARGEN, y + 13)
  y += 26

  rotulo(doc, 'Por concepto de', y)
  const contrato = k.numero ? `según el contrato de prestación de servicios N.º ${k.numero}` : 'según el contrato de prestación de servicios'
  const periodo = c.periodo_desde && c.periodo_hasta ? `, correspondiente al periodo del ${fechaLarga(c.periodo_desde)} al ${fechaLarga(c.periodo_hasta)}` : ''
  y = parrafo(doc, `${c.concepto.trim().replace(/\.$/, '')}, ${contrato}${periodo}.`, y + 5.5)

  y += 7; rotulo(doc, 'Favor consignar en', y)
  y = parrafo(doc, `Cuenta ${TIPO_CUENTA[p.tipo_cuenta ?? '']?.toLowerCase() ?? ''} N.º ${p.numero_cuenta} de ${p.banco}, a nombre de ${nombre}.`, y + 5.5)

  const declaraciones = [
    p.responsable_iva ? 'Soy responsable del impuesto sobre las ventas (IVA).' : null,
    o.texto_cuenta_cobro && p.responsable_iva ? o.texto_cuenta_cobro.replace(/^Declaro que no soy responsable del impuesto sobre las ventas \(IVA\) y que /, 'Declaro que ') : o.texto_cuenta_cobro,
  ].filter(Boolean).join(' ')
  if (declaraciones) { y += 7; y = parrafo(doc, declaraciones, y, { tam: 8.5, interlinea: 4.3 }) }

  y = Math.max(y + 14, 200)
  firma(doc, y, p.firma, [nombre, documentoDe(p), [p.celular, p.email].filter(Boolean).join(' · ')])
  return doc.output('blob')
}

export const nombreArchivoCuenta = (c: Pick<CuentaCobro, 'consecutivo' | 'fecha' | 'datos'>) =>
  `CuentaCobro-${String(c.consecutivo).padStart(3, '0')}_${sinTildes(c.datos.persona.nombres + '-' + c.datos.persona.apellidos)}_${c.fecha.slice(0, 7)}.pdf`

// ─── Certificado laboral ──────────────────────────────────────────────────────

const VERBO: Record<string, { vigente: string; terminado: string }> = {
  planta: { vigente: 'labora en nuestra organización', terminado: 'laboró en nuestra organización' },
  contratista: { vigente: 'presta sus servicios a nuestra organización', terminado: 'prestó sus servicios a nuestra organización' },
  aprendiz: { vigente: 'se encuentra vinculado(a) a nuestra organización', terminado: 'estuvo vinculado(a) a nuestra organización' },
  practicante: { vigente: 'realiza su práctica en nuestra organización', terminado: 'realizó su práctica en nuestra organización' },
}

export async function pdfCertificadoLaboral(c: { codigo: string; incluye_salario: boolean; dirigido_a: string | null; datos: DatosCertificado }): Promise<Blob> {
  const { persona: p, contratos, organizacion: o } = c.datos
  const doc = await nuevoDoc()
  let y = await plantilla(doc, {
    org: o, tipo: 'Certificado laboral', referencia: c.codigo,
    legal: `Código de verificación ${c.codigo}. Para confirmar este certificado, comuníquese con talento humano${o.correo ? ` (${o.correo})` : ''} indicando el código.`,
  })
  const nombre = `${p.nombres} ${p.apellidos}`.toUpperCase()
  // Concordancia con el sexo de la ficha; los certificados viejos no lo traen y quedan con «(a)».
  const gen = (f: string, m: string, x: string) => (p.sexo === 'F' ? f : p.sexo === 'M' ? m : x)

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...rgb(MARCA.tinta))
  doc.text(`${(o.firmante_cargo || 'La dirección administrativa').toUpperCase()} DE ${(o.razon_social || 'Amazonía Emprende').toUpperCase()}`, ANCHO / 2, y + 2, { align: 'center', maxWidth: UTIL })
  doc.setFontSize(17); doc.setTextColor(...rgb(MARCA.bosque))
  doc.text('CERTIFICA QUE', ANCHO / 2 - anchoEspaciado(doc, 'CERTIFICA QUE', 1.2) / 2, y + 16, { charSpace: 1.2 })
  doc.setFillColor(...rgb(MARCA.ambar)); doc.rect(ANCHO / 2 - 12, y + 20, 24, 0.7, 'F')

  // El contrato más reciente va en la frase principal; los anteriores, después.
  const orden = [...contratos].sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
  const frases = orden.map((k, i) => {
    const vigente = k.estado === 'vigente' && i === 0
    const verbo = (VERBO[k.vinculacion] ?? VERBO.planta)[vigente ? 'vigente' : 'terminado']
      .replace('vinculado(a)', gen('vinculada', 'vinculado', 'vinculado(a)'))
    const hasta = k.fecha_terminacion ?? k.fecha_fin
    const tiempo = vigente
      ? `desde el ${fechaLarga(k.fecha_inicio)}`
      : `del ${fechaLarga(k.fecha_inicio)} al ${hasta ? fechaLarga(hasta) : 'término del contrato'}`
    const modalidad = k.modalidad ? `, mediante ${MODALIDAD[k.modalidad]?.toLowerCase() ?? 'contrato'}${k.numero ? ` N.º ${k.numero}` : ''}` : ''
    const rol = k.vinculacion === 'contratista' ? `en el rol de ${k.cargo}` : `en el cargo de ${k.cargo}`
    const objeto = k.vinculacion === 'contratista' && k.objeto ? `, cuyo objeto es «${k.objeto.trim().replace(/\.$/, '')}»` : ''
    const valor = c.incluye_salario && k.valor_mensual
      ? `, con ${k.vinculacion === 'contratista' ? 'honorarios mensuales' : 'un salario mensual'} de ${pesosEnLetras(Number(k.valor_mensual)).replace(' M/CTE', '').toLowerCase()} (${pesos(k.valor_mensual)})`
      : ''
    return i === 0
      ? `${verbo} ${tiempo}${modalidad}, ${rol}${objeto}${valor}.`
      : `Anteriormente, ${tiempo}, ${verbo}${modalidad}, ${rol}${objeto}${valor}.`
  })

  y += 34
  y = parrafo(doc, `${nombre}, ${gen('identificada', 'identificado', 'identificado(a)')} con ${documentoDe(p)}, ${frases[0] ?? 'no registra vinculación con nuestra organización.'}`, y, { tam: 11, interlinea: 5.8 })
  for (const f of frases.slice(1)) { y += 4; y = parrafo(doc, f, y, { tam: 10.5, interlinea: 5.5 }) }

  y += 8
  const destino = c.dirigido_a?.trim() ? `con destino a ${c.dirigido_a.trim()}` : 'a quien interese'
  y = parrafo(doc, `La presente certificación se expide a solicitud ${gen('de la interesada', 'del interesado', 'del interesado(a)')}, ${destino}, en ${o.ciudad || 'Florencia'} a los ${fechaEnLetras(c.datos.expedido)}.`, y, { tam: 10.5, interlinea: 5.5 })

  y = Math.max(y + 22, 185)
  firma(doc, y, o.firmante_firma, [
    (o.firmante_nombre || 'Firma autorizada').toUpperCase(),
    o.firmante_cargo || '',
  ].filter(Boolean))
  return doc.output('blob')
}

export const nombreArchivoCertificado = (d: DatosCertificado, codigo: string) =>
  `Certificado-laboral_${sinTildes(d.persona.nombres + '-' + d.persona.apellidos)}_${codigo}.pdf`

/** Descargar un Blob con nombre. */
export function descargarBlob(blob: Blob, nombre: string) {
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = u; a.download = nombre; a.click()
  setTimeout(() => URL.revokeObjectURL(u), 2000)
}
