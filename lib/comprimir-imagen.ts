/**
 * Compresión de imágenes en el NAVEGADOR, antes de subirlas.
 *
 * Los soportes de jurídica (cédulas, certificados, pantallazos de las consultas
 * de antecedentes) llegan casi siempre como fotos o capturas de pantalla de
 * varios MB — resolución muy por encima de lo que hace falta para leer un
 * número de cédula o un radicado. Como los formularios mandan todos los
 * adjuntos en UNA sola petición multipart, Vercel corta el cuerpo alrededor de
 * 4.5 MB ANTES de que llegue al route handler y el guardado falla con un 413.
 *
 * Aquí se reescala y recomprime cada imagen hasta que entra en el presupuesto,
 * bajando primero calidad y después resolución, con un piso (`LADO_MINIMO`)
 * para que el documento siga siendo legible. Lo que no es imagen (PDF, Word,
 * CSV) pasa intacto: el navegador no puede recomprimirlo sin degradarlo.
 */

/** Tope del cuerpo de la petición. Vercel corta ~4.5 MB; se deja margen para el JSON y el multipart. */
export const PRESUPUESTO_TOTAL = 3_500_000
/** Objetivo por archivo cuando hay espacio de sobra. Una cédula a 1600 px cabe en esto. */
const OBJETIVO_POR_ARCHIVO = 500_000
/** Lado mayor inicial: suficiente para leer texto pequeño de una cédula o un certificado. */
const LADO_MAXIMO = 1600
/** Piso de resolución: por debajo de esto el documento deja de ser legible. */
const LADO_MINIMO = 1000
/** Calidades JPEG a probar, de mejor a peor, antes de bajar la resolución. */
const CALIDADES = [0.72, 0.6, 0.5, 0.42, 0.35]

const EXT_IMAGEN = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif|tiff?)$/i

/** true si el archivo es una imagen (por MIME o por extensión: algunos móviles no mandan MIME). */
export function esImagen(file: File): boolean {
  return file.type.toLowerCase().startsWith('image/') || EXT_IMAGEN.test(file.name || '')
}

interface Decodificada {
  imagen: CanvasImageSource
  ancho: number
  alto: number
  liberar: () => void
}

/**
 * Decodifica la imagen. `createImageBitmap` es lo más rápido y respeta la
 * orientación EXIF (fotos de celular acostadas); si el formato no le sirve se
 * intenta con <img>, que cubre algún caso más. Devuelve null cuando el
 * navegador simplemente no sabe leer el formato (HEIC en Chrome, archivo
 * dañado): ahí el archivo se sube tal cual en vez de perderse.
 */
async function decodificar(file: File): Promise<Decodificada | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { imagen: bitmap, ancho: bitmap.width, alto: bitmap.height, liberar: () => bitmap.close() }
  } catch {
    // formato que createImageBitmap no acepta: se intenta con <img>
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('no decodifica'))
      img.src = url
    })
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('sin dimensiones')
    return {
      imagen: img,
      ancho: img.naturalWidth,
      alto: img.naturalHeight,
      liberar: () => URL.revokeObjectURL(url),
    }
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}

function dibujar(src: CanvasImageSource, ancho: number, alto: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')!
  // Fondo blanco: un PNG con transparencia pasado a JPEG saldría con fondo negro.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, ancho, alto)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, ancho, alto)
  return canvas
}

function aBlob(canvas: HTMLCanvasElement, calidad: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad))
}

function aArchivo(blob: Blob, original: File): File {
  const base = (original.name || 'imagen').replace(/\.[^.]+$/, '')
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: original.lastModified })
}

/**
 * Comprime una imagen hasta `objetivoBytes`. Baja primero la calidad JPEG y,
 * si no alcanza, la resolución (nunca por debajo de `LADO_MINIMO`).
 * Devuelve el archivo original si no es imagen, si ya pesa poco, si el
 * navegador no la puede decodificar, o si comprimirla no la haría más liviana.
 */
export async function comprimirImagen(file: File, objetivoBytes = OBJETIVO_POR_ARCHIVO): Promise<File> {
  if (!esImagen(file)) return file
  if (file.size <= objetivoBytes) return file

  const decodificada = await decodificar(file)
  if (!decodificada) return file

  const { imagen, ancho, alto, liberar } = decodificada
  try {
    let mejor: Blob | null = null
    let lado = LADO_MAXIMO

    for (;;) {
      const escala = Math.min(1, lado / Math.max(ancho, alto))
      const canvas = dibujar(
        imagen,
        Math.max(1, Math.round(ancho * escala)),
        Math.max(1, Math.round(alto * escala)),
      )
      for (const calidad of CALIDADES) {
        const blob = await aBlob(canvas, calidad)
        if (!blob) return file
        if (!mejor || blob.size < mejor.size) mejor = blob
        if (blob.size <= objetivoBytes) return aArchivo(blob, file)
      }
      if (lado <= LADO_MINIMO) break
      lado = Math.max(LADO_MINIMO, Math.round(lado * 0.75))
    }

    // No se llegó al objetivo (imagen enorme o con mucho detalle): se manda lo
    // más liviano que se logró, siempre que mejore el original.
    return mejor && mejor.size < file.size ? aArchivo(mejor, file) : file
  } catch {
    return file
  } finally {
    liberar()
  }
}

export interface ResultadoCompresion {
  /** Los mismos campos que entraron, con las imágenes ya comprimidas. */
  archivos: Record<string, File>
  bytesAntes: number
  bytesDespues: number
  /** Campos que siguen pesando demasiado y no son imágenes (PDF/Word: no se pueden recomprimir aquí). */
  pesados: string[]
  /** true si el total sigue por encima del presupuesto pese a la compresión. */
  excedePresupuesto: boolean
}

/**
 * Comprime el conjunto de adjuntos de un formulario repartiendo el presupuesto
 * total entre ellos. Si tras la primera pasada el conjunto sigue sin caber, se
 * repite desde los originales con un objetivo más apretado (recomprimir el
 * resultado de la pasada anterior degradaría dos veces la misma imagen).
 */
export async function comprimirAdjuntos(
  entrada: Record<string, File | null | undefined>,
  presupuesto = PRESUPUESTO_TOTAL,
): Promise<ResultadoCompresion> {
  const entradas = Object.entries(entrada).filter((e): e is [string, File] => !!e[1])
  const bytesAntes = entradas.reduce((s, [, f]) => s + f.size, 0)
  if (entradas.length === 0) {
    return { archivos: {}, bytesAntes: 0, bytesDespues: 0, pesados: [], excedePresupuesto: false }
  }

  async function pasada(objetivo: number): Promise<Record<string, File>> {
    const salida: Record<string, File> = {}
    for (const [campo, file] of entradas) {
      salida[campo] = await comprimirImagen(file, objetivo)
    }
    return salida
  }

  const objetivo = Math.min(OBJETIVO_POR_ARCHIVO, Math.floor(presupuesto / entradas.length))
  let archivos = await pasada(objetivo)
  let bytesDespues = Object.values(archivos).reduce((s, f) => s + f.size, 0)

  if (bytesDespues > presupuesto) {
    const apretado = Math.max(120_000, Math.floor((presupuesto * 0.9) / entradas.length))
    if (apretado < objetivo) {
      archivos = await pasada(apretado)
      bytesDespues = Object.values(archivos).reduce((s, f) => s + f.size, 0)
    }
  }

  // Lo que sigue pesando y no es imagen: el navegador no puede hacer nada más.
  const pesados = Object.entries(archivos)
    .filter(([, f]) => !esImagen(f) && f.size > presupuesto / 2)
    .map(([campo]) => campo)

  return { archivos, bytesAntes, bytesDespues, pesados, excedePresupuesto: bytesDespues > presupuesto }
}

export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Aviso legible cuando, aun comprimiendo, el conjunto no cabe en una sola petición. */
export function avisoPeso(r: ResultadoCompresion, etiquetas: Record<string, string> = {}): string | null {
  if (!r.excedePresupuesto) return null
  const nombres = (r.pesados.length ? r.pesados : Object.keys(r.archivos))
    .map((c) => etiquetas[c] ?? c)
    .join(', ')
  return `Los adjuntos suman ${formatearBytes(r.bytesDespues)} y el límite por guardado es ${formatearBytes(PRESUPUESTO_TOTAL)}. `
    + `Las imágenes ya se comprimieron; lo que sigue pesando (${nombres}) es PDF o Word y no se puede reducir desde el navegador. `
    + `Guarda esos documentos de a uno, o vuelve a exportarlos más livianos.`
}
