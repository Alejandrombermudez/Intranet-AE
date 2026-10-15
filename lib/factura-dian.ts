/**
 * LECTOR DE LA FACTURA ELECTRÓNICA DE LA DIAN
 * ───────────────────────────────────────────
 * Lo que manda el proveedor por correo es un .zip con dos archivos: el PDF (la
 * representación gráfica, para leer) y un .xml, que es lo que vale. Ese .xml casi
 * siempre es un «AttachedDocument» (el contenedor que valida la DIAN) y adentro,
 * como texto, lleva la factura en UBL 2.1 (`Invoice`). A veces el proveedor manda
 * la `Invoice` sola. Las dos formas se leen aquí.
 *
 * Del XML sale todo sin teclear: proveedor (NIT, DV, razón social), número, CUFE,
 * fechas, cada línea con su cantidad, unidad, precio, IVA y total, y los totales
 * de la factura. El PDF no se lee: no hay una forma estándar, cada software de
 * facturación lo dibuja distinto.
 *
 * No depende de librerías: recorre el árbol por nombre local (`localName`), así que
 * da igual qué prefijo de espacio de nombres use cada software (cbc:, cac:, o
 * ninguno). En el navegador se usa el DOMParser nativo; en pruebas se le pasa otro.
 *
 * Fuente: Anexo técnico de factura electrónica de venta, versión 1.9 (DIAN).
 */

export interface ProveedorFactura {
  nit: string
  dv: string | null
  razonSocial: string
  nombreComercial: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  ciudad: string | null
}

export interface LineaFactura {
  linea: number
  codigo: string | null
  descripcion: string
  cantidad: number
  /** Código de unidad que trae la DIAN (94, KGM, LTR…). */
  unidad: string | null
  /** La misma unidad, en palabras. */
  unidadNombre: string | null
  precioUnitario: number | null
  /** Valor de la línea antes de impuestos (ya con descuentos de la línea). */
  subtotal: number
  impuestoPct: number | null
  impuestoValor: number
  /** subtotal + impuestos: lo que de verdad costó la línea. */
  total: number
}

export interface FacturaLeida {
  tipoDocumento: 'factura' | 'documento_soporte'
  numero: string
  cufe: string | null
  fechaEmision: string
  fechaVencimiento: string | null
  moneda: string
  formaPago: 'contado' | 'credito' | null
  proveedor: ProveedorFactura
  adquiriente: { nit: string | null; nombre: string | null }
  subtotal: number
  descuentos: number
  impuestos: number
  retenciones: number
  /** Lo que se paga (PayableAmount). */
  total: number
  lineas: LineaFactura[]
  /** Cosas que no cuadran y conviene mirar antes de guardar. Nunca impiden leer. */
  avisos: string[]
}

/** Error con un mensaje que se le puede mostrar tal cual a quien sube el archivo. */
export class FacturaIlegible extends Error {}

// Unidades de la lista UN/ECE Rec. 20 que más usan los proveedores en Colombia.
const UNIDADES: Record<string, string> = {
  '94': 'unidad', NIU: 'unidad', EA: 'unidad', C62: 'unidad', H87: 'pieza', U: 'unidad',
  KGM: 'kg', GRM: 'g', TNE: 'tonelada', LBR: 'libra', '58': 'kg neto',
  LTR: 'litro', MLT: 'ml', GLL: 'galón', GLI: 'galón', CMQ: 'cm³',
  MTR: 'metro', CMT: 'cm', MTK: 'm²', MTQ: 'm³',
  BG: 'bolsa', SA: 'saco', BX: 'caja', PK: 'paquete', BO: 'botella', CA: 'lata', BJ: 'balde',
  CT: 'cartón', RO: 'rollo', DZN: 'docena', PR: 'par', SET: 'juego', KT: 'kit',
  HUR: 'hora', DAY: 'día', MON: 'mes', ZZ: 'unidad acordada',
}

export const nombreUnidad = (codigo: string | null | undefined): string | null =>
  codigo ? UNIDADES[codigo.toUpperCase()] ?? codigo : null

// ─── Recorrido del árbol por nombre local ─────────────────────────────────────

type Nodo = Element

function hijos(el: Nodo | null | undefined, nombre: string): Nodo[] {
  if (!el) return []
  const out: Nodo[] = []
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && ((n as Element).localName ?? (n as Element).nodeName.replace(/^.*:/, '')) === nombre) {
      out.push(n as Element)
    }
  }
  return out
}

/** El primer descendiente siguiendo una ruta de nombres locales: ruta(el, 'Party', 'PartyName', 'Name'). */
function ruta(el: Nodo | null | undefined, ...nombres: string[]): Nodo | null {
  let actual: Nodo | null | undefined = el
  for (const n of nombres) {
    actual = hijos(actual, n)[0]
    if (!actual) return null
  }
  return actual ?? null
}

const texto = (el: Nodo | null | undefined): string | null => {
  const t = el?.textContent?.trim()
  return t ? t : null
}

const numero = (el: Nodo | null | undefined): number => {
  const t = texto(el)
  if (!t) return 0
  const n = Number(t.replace(/\s/g, ''))
  return Number.isFinite(n) ? n : 0
}

const numeroONulo = (el: Nodo | null | undefined): number | null => (texto(el) ? numero(el) : null)

const redondear = (n: number) => Math.round(n * 100) / 100

// ─── Lectura ──────────────────────────────────────────────────────────────────

/**
 * Lee el XML de una factura electrónica (AttachedDocument o Invoice).
 * Lanza `FacturaIlegible` con un mensaje para la persona si no es una factura.
 */
export function leerFacturaDian(xml: string, Parser: { new (): DOMParser } = DOMParser): FacturaLeida {
  const raiz = parsear(xml, Parser)
  let doc = raiz

  if (nombreLocal(raiz) === 'AttachedDocument') {
    // La factura viaja como texto dentro de Attachment/ExternalReference/Description.
    const interno = texto(ruta(raiz, 'Attachment', 'ExternalReference', 'Description'))
    if (!interno) throw new FacturaIlegible('El contenedor de la DIAN no trae la factura adentro.')
    doc = parsear(interno, Parser)
  }

  const tipoRaiz = nombreLocal(doc)
  if (tipoRaiz === 'CreditNote') {
    throw new FacturaIlegible('Es una NOTA CRÉDITO, no una factura. Las devoluciones se registran como ajuste en el inventario.')
  }
  if (tipoRaiz === 'DebitNote') {
    throw new FacturaIlegible('Es una NOTA DÉBITO, no una factura. Regístrala a mano si cambia lo que se debe.')
  }
  if (tipoRaiz === 'ApplicationResponse') {
    throw new FacturaIlegible('Este XML es la respuesta de validación de la DIAN, no la factura. Busca en el .zip el otro .xml.')
  }
  if (tipoRaiz !== 'Invoice') {
    throw new FacturaIlegible('El archivo no es una factura electrónica de la DIAN (no tiene la estructura UBL «Invoice»).')
  }

  const avisos: string[] = []
  const tipoCodigo = texto(ruta(doc, 'InvoiceTypeCode'))
  const tipoDocumento: FacturaLeida['tipoDocumento'] = tipoCodigo === '05' ? 'documento_soporte' : 'factura'

  // ── Proveedor ──
  const party = ruta(doc, 'AccountingSupplierParty', 'Party')
  const tax = ruta(party, 'PartyTaxScheme')
  const legal = ruta(party, 'PartyLegalEntity')
  const companyId = ruta(tax, 'CompanyID') ?? ruta(legal, 'CompanyID') ?? ruta(party, 'PartyIdentification', 'ID')
  const nit = (texto(companyId) ?? '').replace(/[^0-9A-Za-z]/g, '')
  if (!nit) throw new FacturaIlegible('La factura no trae el NIT del proveedor.')
  const razonSocial = texto(ruta(tax, 'RegistrationName')) ?? texto(ruta(legal, 'RegistrationName'))
    ?? texto(ruta(party, 'PartyName', 'Name'))
  if (!razonSocial) throw new FacturaIlegible('La factura no trae el nombre del proveedor.')
  const direccionEl = ruta(party, 'PhysicalLocation', 'Address') ?? ruta(tax, 'RegistrationAddress')

  const proveedor: ProveedorFactura = {
    nit,
    dv: companyId?.getAttribute('schemeID') || null,
    razonSocial,
    nombreComercial: texto(ruta(party, 'PartyName', 'Name')),
    email: texto(ruta(party, 'Contact', 'ElectronicMail')),
    telefono: texto(ruta(party, 'Contact', 'Telephone')),
    direccion: texto(ruta(direccionEl, 'AddressLine', 'Line')),
    ciudad: texto(ruta(direccionEl, 'CityName')),
  }

  // ── Adquiriente (a nombre de quién vino) ──
  const cliente = ruta(doc, 'AccountingCustomerParty', 'Party')
  const clienteId = ruta(cliente, 'PartyTaxScheme', 'CompanyID') ?? ruta(cliente, 'PartyLegalEntity', 'CompanyID')
  const adquiriente = {
    nit: texto(clienteId)?.replace(/[^0-9A-Za-z]/g, '') ?? null,
    nombre: texto(ruta(cliente, 'PartyTaxScheme', 'RegistrationName')) ?? texto(ruta(cliente, 'PartyName', 'Name')),
  }

  // ── Encabezado ──
  const numeroFactura = texto(ruta(doc, 'ID'))
  if (!numeroFactura) throw new FacturaIlegible('La factura no trae número.')
  const fechaEmision = texto(ruta(doc, 'IssueDate'))
  if (!fechaEmision || !/^\d{4}-\d{2}-\d{2}/.test(fechaEmision)) throw new FacturaIlegible('La factura no trae fecha de emisión.')
  const medioPago = ruta(doc, 'PaymentMeans')
  const formaPagoCodigo = texto(ruta(medioPago, 'ID'))
  const fechaVencimiento = texto(ruta(doc, 'DueDate')) ?? texto(ruta(medioPago, 'PaymentDueDate'))

  // ── Totales ──
  const totales = ruta(doc, 'LegalMonetaryTotal')
  const impuestos = hijos(doc, 'TaxTotal').reduce((s, t) => s + numero(ruta(t, 'TaxAmount')), 0)
  const retenciones = hijos(doc, 'WithholdingTaxTotal').reduce((s, t) => s + numero(ruta(t, 'TaxAmount')), 0)

  // ── Líneas ──
  const lineas: LineaFactura[] = hijos(doc, 'InvoiceLine').map((l, i) => {
    const cant = ruta(l, 'InvoicedQuantity')
    const item = ruta(l, 'Item')
    const tt = hijos(l, 'TaxTotal')
    const impuestoValor = tt.reduce((s, t) => s + numero(ruta(t, 'TaxAmount')), 0)
    // El porcentaje del IVA (TaxScheme 01); si no hay IVA, el del primer impuesto.
    const subtotales = tt.flatMap((t) => hijos(t, 'TaxSubtotal'))
    const iva = subtotales.find((s) => texto(ruta(s, 'TaxCategory', 'TaxScheme', 'ID')) === '01') ?? subtotales[0]
    const subtotal = numero(ruta(l, 'LineExtensionAmount'))
    const precio = numeroONulo(ruta(l, 'Price', 'PriceAmount'))
    const base = numero(ruta(l, 'Price', 'BaseQuantity')) || 1
    const descripcion = hijos(item, 'Description').map((d) => texto(d)).filter(Boolean).join(' ')
      || texto(ruta(item, 'Name')) || '(sin descripción)'
    const codigo = texto(ruta(item, 'SellersItemIdentification', 'ID'))
      ?? texto(ruta(item, 'StandardItemIdentification', 'ID'))
    const unidad = cant?.getAttribute('unitCode') || null
    return {
      linea: Number(texto(ruta(l, 'ID'))) || i + 1,
      codigo,
      descripcion: descripcion.replace(/\s+/g, ' ').trim(),
      cantidad: numero(cant),
      unidad,
      unidadNombre: nombreUnidad(unidad),
      precioUnitario: precio === null ? null : redondear(precio / base),
      subtotal: redondear(subtotal),
      impuestoPct: numeroONulo(ruta(iva, 'TaxCategory', 'Percent')) ?? numeroONulo(ruta(iva, 'Percent')),
      impuestoValor: redondear(impuestoValor),
      total: redondear(subtotal + impuestoValor),
    }
  })
  if (!lineas.length) throw new FacturaIlegible('La factura no trae líneas de productos o servicios.')

  const subtotal = numero(ruta(totales, 'LineExtensionAmount'))
  const total = numero(ruta(totales, 'PayableAmount')) || numero(ruta(totales, 'TaxInclusiveAmount'))

  // ── Lo que no cuadra ──
  const sumaLineas = lineas.reduce((s, l) => s + l.subtotal, 0)
  if (Math.abs(sumaLineas - subtotal) > 1) {
    avisos.push(`La suma de las líneas (${pesos(sumaLineas)}) no da el subtotal de la factura (${pesos(subtotal)}).`)
  }
  const sumaImp = lineas.reduce((s, l) => s + l.impuestoValor, 0)
  if (Math.abs(sumaImp - impuestos) > 1) {
    avisos.push(`Los impuestos de las líneas (${pesos(sumaImp)}) no dan los de la factura (${pesos(impuestos)}).`)
  }
  const moneda = texto(ruta(doc, 'DocumentCurrencyCode')) ?? 'COP'
  if (moneda !== 'COP') avisos.push(`La factura está en ${moneda}, no en pesos: revisa los valores.`)

  return {
    tipoDocumento,
    numero: numeroFactura,
    cufe: texto(ruta(doc, 'UUID')),
    fechaEmision: fechaEmision.slice(0, 10),
    fechaVencimiento: fechaVencimiento?.slice(0, 10) ?? null,
    moneda,
    formaPago: formaPagoCodigo === '1' ? 'contado' : formaPagoCodigo === '2' ? 'credito' : null,
    proveedor,
    adquiriente,
    subtotal: redondear(subtotal),
    descuentos: redondear(numero(ruta(totales, 'AllowanceTotalAmount'))),
    impuestos: redondear(impuestos),
    retenciones: redondear(retenciones),
    total: redondear(total),
    lineas,
    avisos,
  }
}

function parsear(xml: string, Parser: { new (): DOMParser }): Element {
  const limpio = xml.replace(/^﻿/, '').trim()
  if (!limpio.startsWith('<')) throw new FacturaIlegible('El archivo no es un XML.')
  let doc: Document
  try {
    doc = new Parser().parseFromString(limpio, 'application/xml')
  } catch {
    throw new FacturaIlegible('El XML está dañado y no se puede leer.')
  }
  const raiz = doc?.documentElement
  if (!raiz || nombreLocal(raiz) === 'parsererror' || doc.getElementsByTagName('parsererror').length) {
    throw new FacturaIlegible('El XML está dañado y no se puede leer.')
  }
  return raiz
}

const nombreLocal = (el: Element) => el.localName ?? el.nodeName.replace(/^.*:/, '')

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

// ─── Archivo que sube la persona ──────────────────────────────────────────────

export interface ArchivoFactura {
  factura: FacturaLeida
  /** El XML que se leyó (para guardarlo tal cual). */
  xml: { nombre: string; contenido: string }
  /** El PDF que venía en el .zip, si venía. */
  pdf: File | null
}

/**
 * Recibe lo que la persona arrastró: el .zip del correo, o el .xml suelto (y
 * opcionalmente el PDF al lado). Devuelve la factura leída y los archivos para
 * guardar. Solo en el navegador.
 */
export async function leerArchivosFactura(archivos: File[]): Promise<ArchivoFactura> {
  const zip = archivos.find((f) => /\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed')
  let xmls: { nombre: string; contenido: string }[] = []
  let pdf: File | null = archivos.find((f) => /\.pdf$/i.test(f.name)) ?? null

  if (zip) {
    const JSZip = (await import('jszip')).default
    const z = await JSZip.loadAsync(zip)
    for (const nombre of Object.keys(z.files)) {
      const e = z.files[nombre]
      if (e.dir) continue
      if (/\.xml$/i.test(nombre)) xmls.push({ nombre: nombre.replace(/^.*\//, ''), contenido: await e.async('string') })
      else if (/\.pdf$/i.test(nombre) && !pdf) {
        const blob = await e.async('blob')
        pdf = new File([blob], nombre.replace(/^.*\//, ''), { type: 'application/pdf' })
      }
    }
    if (!xmls.length) throw new FacturaIlegible('El .zip no trae ningún .xml. Sin el XML no se puede leer la factura: pídeselo al proveedor.')
  } else {
    const xmlFiles = archivos.filter((f) => /\.xml$/i.test(f.name) || /xml/.test(f.type))
    if (!xmlFiles.length) {
      throw new FacturaIlegible(pdf
        ? 'Subiste solo el PDF. La factura se lee del XML (viene en el .zip del correo del proveedor). Si no hay XML, usa «Registrar sin XML».'
        : 'Sube el .zip que llegó al correo, o el .xml de la factura.')
    }
    xmls = await Promise.all(xmlFiles.map(async (f) => ({ nombre: f.name, contenido: await f.text() })))
  }

  // Si vienen varios XML (factura + respuesta de la DIAN), el bueno es el que se deja leer.
  let ultimoError: unknown = null
  for (const x of xmls) {
    try {
      return { factura: leerFacturaDian(x.contenido), xml: x, pdf }
    } catch (e) {
      ultimoError = e
    }
  }
  throw ultimoError instanceof FacturaIlegible ? ultimoError : new FacturaIlegible('No se pudo leer la factura.')
}
