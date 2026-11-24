import { comprimirImagen } from '@/lib/comprimir-imagen'

/**
 * Comprime una foto de la inspección gastando la menor memoria posible.
 *
 * Los celulares de hoy toman fotos de 50 a 108 megapíxeles: abrir una entera ocupa de 200 a
 * 430 MB. `comprimirImagen` la abre a tamaño completo y la mantiene mientras prueba varias
 * calidades y tamaños; con la cámara del celular abierta al lado, hacia la tercera foto Chrome
 * se quedaba «Sin memoria» (recepción del 2026-11-24).
 *
 * Aquí la foto se abre ya reducida (`resizeWidth` en createImageBitmap), se dibuja en UN solo
 * lienzo, se suelta enseguida y el lienzo se vacía al terminar. 1280 px de ancho bastan para
 * ver golpes y rayones. Si el navegador no sabe abrirla así (Safari viejo, HEIC), se usa la
 * compresión de siempre.
 */
const ANCHO = 1280
const OBJETIVO = 250_000
const CALIDADES = [0.72, 0.58, 0.45]

export async function fotoLiviana(archivo: File): Promise<Blob> {
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(archivo, { resizeWidth: ANCHO, resizeQuality: 'medium', imageOrientation: 'from-image' })
  } catch {
    return comprimirImagen(archivo, OBJETIVO)
  }

  const lienzo = document.createElement('canvas')
  try {
    lienzo.width = bitmap.width
    lienzo.height = bitmap.height
    const ctx = lienzo.getContext('2d')
    if (!ctx) return comprimirImagen(archivo, OBJETIVO)
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    bitmap = null

    let ultimo: Blob | null = null
    for (const calidad of CALIDADES) {
      ultimo = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', calidad))
      if (!ultimo) break
      if (ultimo.size <= OBJETIVO) return ultimo
    }
    return ultimo ?? comprimirImagen(archivo, OBJETIVO)
  } finally {
    bitmap?.close()
    // Vaciar el lienzo suelta su memoria ya, sin esperar al recolector.
    lienzo.width = 0
    lienzo.height = 0
  }
}
