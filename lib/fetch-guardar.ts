/**
 * Parsea la respuesta de un fetch de guardado (POST/PATCH) sin asumir que
 * siempre es JSON.
 *
 * Los formularios de Jurídica suben varios PDFs en una sola petición
 * (multipart/form-data). Vercel aplica un límite de tamaño de payload a las
 * Serverless Functions (~4.5 MB) ANTES de que la petición llegue a nuestro
 * route handler — cuando se supera, la plataforma responde con un 413 cuyo
 * cuerpo no es JSON. `res.json()` sin protección lanza en ese caso, la
 * excepción no se captura en el `onSubmit`/`handleGuardar` de la página, y el
 * usuario ve el botón "Guardar" resetearse sin ningún mensaje — parece que
 * "a veces no guarda" sin explicación.
 *
 * Esta función centraliza el parseo seguro + un mensaje legible por caso.
 */
export interface CuerpoGuardado {
  id?: string
  documentos_fallidos?: string[]
  error?: string
  [clave: string]: unknown
}

export async function parsearRespuestaGuardado(
  res: Response,
): Promise<{ ok: true; body: CuerpoGuardado | null } | { ok: false; error: string }> {
  let body: CuerpoGuardado | null = null
  try {
    body = await res.json()
  } catch {
    // Respuesta no-JSON: típico de un 413 (payload muy pesado) o de un error
    // de la plataforma antes de llegar al código de la app.
  }
  if (res.ok) return { ok: true, body }

  if (body?.error) return { ok: false, error: body.error }
  if (res.status === 413) {
    return {
      ok: false,
      error: 'Los archivos adjuntos pesan demasiado en conjunto (límite ~4 MB por solicitud). Sube o reemplaza los documentos de a uno.',
    }
  }
  if (res.status >= 500) {
    return { ok: false, error: 'Error del servidor al guardar. Intenta de nuevo en unos segundos.' }
  }
  return { ok: false, error: `No se pudo guardar (código ${res.status}).` }
}

/**
 * Mensaje para los documentos que el servidor no logró subir. El resto de los
 * datos sí se guardó — antes esto era silencioso y el usuario creía que el
 * archivo había quedado adjunto.
 * Devuelve null si no hubo fallos.
 */
export function mensajeDocumentosFallidos(campos: unknown): string | null {
  if (!Array.isArray(campos) || campos.length === 0) return null
  const lista = campos.join(', ')
  return campos.length === 1
    ? `Los datos se guardaron, pero el documento «${lista}» no se pudo subir. Verifica que sea PDF, imagen o Word y que no esté dañado, y vuelve a adjuntarlo.`
    : `Los datos se guardaron, pero estos documentos no se pudieron subir: ${lista}. Verifica que sean PDF, imagen o Word y vuelve a adjuntarlos.`
}
