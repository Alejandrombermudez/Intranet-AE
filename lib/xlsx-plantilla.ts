/**
 * Llenar una plantilla .xlsx SIN reescribirla.
 *
 * Las plantillas de Corpoamazonia (F-LAR-071, F-LAR-072) traen validaciones,
 * formato condicional, comentarios, imágenes y un vínculo externo. SheetJS
 * (`xlsx`, la librería del proyecto) pierde casi todo eso al guardar. Aquí se
 * abre el .xlsx como lo que es —un zip de XML— y se cambian solo las celdas que
 * hace falta: el resto del archivo sale byte a byte como entró.
 *
 * Lo que se escribe va como texto en línea (`t="inlineStr"`), para no tener que
 * tocar la tabla de cadenas compartidas.
 */
import JSZip from 'jszip'

export type Valor = string | number | null | undefined | { f: string }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    // Caracteres de control que XML 1.0 no admite (un pegado raro en la base rompería el archivo).
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

/** Una celda `<c>` con su estilo. Vacía si el valor es nulo: conserva el borde y el formato. */
export function celda(ref: string, estilo: number | string | null, v: Valor): string {
  const s = estilo === null || estilo === '' ? '' : ` s="${estilo}"`
  if (v === null || v === undefined || v === '') return `<c r="${ref}"${s}/>`
  if (typeof v === 'number') return Number.isFinite(v) ? `<c r="${ref}"${s}><v>${v}</v></c>` : `<c r="${ref}"${s}/>`
  if (typeof v === 'object') return `<c r="${ref}"${s}><f>${esc(v.f)}</f></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`
}

/** Una fila completa. `columnas` = letra, estilo y valor de cada celda, en orden. */
export function fila(n: number, atributos: string, columnas: [string, number | null, Valor][]): string {
  return `<row r="${n}" ${atributos}>${columnas.map(([col, s, v]) => celda(`${col}${n}`, s, v)).join('')}</row>`
}

/**
 * Cambia todas las filas desde `desde` hasta el final de la hoja por `filas`.
 * Sirve para las tablas que crecen (vértices, árboles): la plantilla trae un
 * número fijo de renglones y un predio puede necesitar más, o menos.
 */
export function reemplazarFilasDesde(xml: string, desde: number, filas: string[], ultimaColumna: string): string {
  const fin = xml.indexOf('</sheetData>')
  if (fin < 0) throw new Error('La hoja no tiene datos')
  // Primera fila con número >= desde (las filas vienen en orden).
  let ini = fin
  const re = /<row r="(\d+)"/g
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    if (m.index >= fin) break
    if (Number(m[1]) >= desde) { ini = m.index; break }
  }
  const ultima = desde + filas.length - 1
  return (xml.slice(0, ini) + filas.join('') + xml.slice(fin))
    .replace(/<dimension ref="([A-Z]+\d+):[A-Z]+\d+"\/>/, (_, a) => `<dimension ref="${a}:${ultimaColumna}${Math.max(ultima, desde)}"/>`)
}

/**
 * Escribe UNA celda que ya existe en la hoja, conservando su estilo.
 * Devuelve el XML nuevo, o null si la celda no está (una plantilla distinta a la
 * esperada): quien llama decide si avisa.
 */
export function ponerCelda(xml: string, ref: string, v: Valor): string | null {
  const re = new RegExp(`<c r="${ref}"((?:\\s[^>]*?)?)\\s*(?:/>|>[\\s\\S]*?</c>)`)
  const m = re.exec(xml)
  if (!m) return null
  const estilo = /\ss="(\d+)"/.exec(m[1])?.[1] ?? null
  return xml.slice(0, m.index) + celda(ref, estilo, v) + xml.slice(m.index + m[0].length)
}

export class Plantilla {
  private constructor(private zip: JSZip, private rutas: Map<string, string>) {}

  static async abrir(buf: ArrayBuffer): Promise<Plantilla> {
    const zip = await JSZip.loadAsync(buf)
    const libro = await zip.file('xl/workbook.xml')!.async('string')
    const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string')
    const destino = new Map<string, string>()
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = /Id="([^"]+)"/.exec(m[0])?.[1], t = /Target="([^"]+)"/.exec(m[0])?.[1]
      if (id && t) destino.set(id, t.startsWith('/') ? t.slice(1) : `xl/${t}`)
    }
    const rutas = new Map<string, string>()
    for (const m of libro.matchAll(/<sheet\b[^>]*>/g)) {
      const nombre = /name="([^"]+)"/.exec(m[0])?.[1], rid = /r:id="([^"]+)"/.exec(m[0])?.[1]
      // El nombre se guarda sin espacios sobrantes: el F-LAR-072 trae «Datos_básicos » con uno al final.
      if (nombre && rid && destino.has(rid)) rutas.set(nombre.replace(/&amp;/g, '&').trim(), destino.get(rid)!)
    }
    return new Plantilla(zip, rutas)
  }

  async hoja(nombre: string): Promise<string> {
    const ruta = this.rutas.get(nombre.trim())
    if (!ruta) throw new Error(`La plantilla no tiene la hoja «${nombre}»`)
    return this.zip.file(ruta)!.async('string')
  }

  guardarHoja(nombre: string, xml: string) {
    this.zip.file(this.rutas.get(nombre.trim())!, xml)
  }

  /**
   * Excel guarda el resultado de cada fórmula y el orden de cálculo. Al cambiar
   * datos por fuera, eso queda viejo: se le pide que recalcule todo al abrir y se
   * quita la cadena de cálculo, que Excel reconstruye sola.
   */
  private async prepararRecalculo() {
    const libro = await this.zip.file('xl/workbook.xml')!.async('string')
    this.zip.file('xl/workbook.xml', /<calcPr\b/.test(libro)
      ? libro.replace(/<calcPr\b([^>]*?)\/>/, (_, a: string) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`)
      : libro.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>'))

    if (this.zip.file('xl/calcChain.xml')) {
      this.zip.remove('xl/calcChain.xml')
      const rels = await this.zip.file('xl/_rels/workbook.xml.rels')!.async('string')
      this.zip.file('xl/_rels/workbook.xml.rels', rels.replace(/<Relationship\b[^>]*calcChain[^>]*\/>/, ''))
      const tipos = await this.zip.file('[Content_Types].xml')!.async('string')
      this.zip.file('[Content_Types].xml', tipos.replace(/<Override\b[^>]*calcChain[^>]*\/>/, ''))
    }
  }

  async generar(): Promise<Uint8Array> {
    await this.prepararRecalculo()
    return this.zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
  }
}
