/**
 * Compresión de PDF ESCANEADOS en el navegador, antes de subirlos.
 *
 * Medido el 2026-10-16 sobre las facturas de Misión 3: re-guardar un PDF sin
 * pérdida (object streams, lo que hace lib/pdf-compress.ts) ahorra 0,6 %. El
 * peso está en las fotos de los escaneos: una cuenta de cobro de dos páginas
 * por CamScanner ocupaba 2,3 MB, más que las otras once facturas juntas.
 *
 * Aquí se recomprime SOLO cada foto JPEG grande que lleva dentro el PDF (lado
 * mayor a 1600 px, calidad 0,72: la misma vara de lib/comprimir-imagen.ts, que
 * deja legible una cédula). El texto, lo vectorial y la diagramación no se
 * tocan: la página escala la imagen sola, cambie o no su resolución.
 *
 * Se devuelve el ORIGINAL, sin tocar, cuando:
 *   - pesa menos de 600 KB (una factura electrónica nativa: no hay qué ganar);
 *   - está firmado digitalmente (reescribirlo invalidaría la firma);
 *   - está cifrado, o pdf-lib no lo puede abrir;
 *   - el resultado no baja al menos un 15 %.
 *
 * Usa canvas: solo navegador. pdf-lib se carga bajo demanda.
 *
 * Para subir un soporte cualquiera (PDF o foto) se usa `aligerarDocumento`.
 */
import { comprimirImagen } from '@/lib/comprimir-imagen'

const UMBRAL_ARCHIVO = 600_000
/** Las imágenes más chicas (logos, sellos) no valen la pena. */
const UMBRAL_IMAGEN = 150_000
const LADO_MAXIMO = 1600
const CALIDAD = 0.72
const GANANCIA_MINIMA = 0.85

export interface ResultadoPdf {
  archivo: File
  antes: number
  despues: number
}

export function esPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
}

async function recomprimirJpeg(bytes: Uint8Array): Promise<{ bytes: Uint8Array; ancho: number; alto: number } | null> {
  try {
    const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }))
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bmp.width, bmp.height))
    const ancho = Math.max(1, Math.round(bmp.width * escala))
    const alto = Math.max(1, Math.round(bmp.height * escala))
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(bmp, 0, 0, ancho, alto)
    bmp.close()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', CALIDAD))
    return blob ? { bytes: new Uint8Array(await blob.arrayBuffer()), ancho, alto } : null
  } catch {
    return null
  }
}

export async function comprimirPdfEscaneado(file: File): Promise<ResultadoPdf> {
  const antes = file.size
  const original: ResultadoPdf = { archivo: file, antes, despues: antes }
  if (!esPdf(file) || antes < UMBRAL_ARCHIVO) return original

  try {
    const { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFArray, PDFSignature } = await import('pdf-lib')
    const doc = await PDFDocument.load(await file.arrayBuffer(), { updateMetadata: false })
    try {
      if (doc.getForm().getFields().some((f) => f instanceof PDFSignature)) return original
    } catch { /* sin formulario: no hay firma */ }

    const N = (s: string) => PDFName.of(s)
    const esJpegSimple = (f: unknown) =>
      f === N('DCTDecode') || (f instanceof PDFArray && f.size() === 1 && f.get(0) === N('DCTDecode'))
    const colorAdmitido = (cs: unknown) => {
      if (cs === N('DeviceRGB') || cs === N('DeviceGray')) return true
      // ICCBased de 1 o 3 canales; el de 4 (CMYK) no se toca.
      if (cs instanceof PDFArray && cs.get(0) === N('ICCBased')) {
        const perfil = doc.context.lookup(cs.get(1))
        const canales = perfil instanceof PDFRawStream ? perfil.dict.get(N('N')) : undefined
        return canales instanceof PDFNumber && canales.asNumber() !== 4
      }
      return false
    }

    let cambiadas = 0
    for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue
      const d = obj.dict
      if (d.get(N('Subtype')) !== N('Image') || !esJpegSimple(d.get(N('Filter')))) continue
      if (d.get(N('Decode')) || d.get(N('ImageMask')) || !colorAdmitido(d.get(N('ColorSpace')))) continue
      if (obj.contents.length < UMBRAL_IMAGEN) continue

      const nuevo = await recomprimirJpeg(obj.contents)
      if (!nuevo || nuevo.bytes.length > obj.contents.length * 0.9) continue

      // Se conserva el resto del diccionario (SMask incluido: su tamaño no tiene
      // que coincidir con el de la imagen). Length lo recalcula pdf-lib al guardar.
      const dict = d.clone(doc.context)
      dict.set(N('Width'), PDFNumber.of(nuevo.ancho))
      dict.set(N('Height'), PDFNumber.of(nuevo.alto))
      dict.set(N('ColorSpace'), N('DeviceRGB'))
      dict.set(N('BitsPerComponent'), PDFNumber.of(8))
      dict.delete(N('DecodeParms'))
      doc.context.assign(ref, PDFRawStream.of(dict, nuevo.bytes))
      cambiadas++
    }
    if (cambiadas === 0) return original

    const bytes = await doc.save({ useObjectStreams: true })
    if (bytes.length > antes * GANANCIA_MINIMA) return original
    return {
      archivo: new File([new Uint8Array(bytes)], file.name, { type: 'application/pdf', lastModified: file.lastModified }),
      antes,
      despues: bytes.length,
    }
  } catch {
    return original
  }
}

/**
 * El soporte de una compra, listo para subir: una foto se recomprime
 * (lib/comprimir-imagen.ts) y un PDF escaneado, solo en sus fotos internas.
 * Una factura electrónica nativa o un PDF firmado pasan intactos.
 */
export async function aligerarDocumento(file: File): Promise<ResultadoPdf> {
  if (esPdf(file)) return comprimirPdfEscaneado(file)
  const archivo = await comprimirImagen(file)
  return { archivo, antes: file.size, despues: archivo.size }
}
