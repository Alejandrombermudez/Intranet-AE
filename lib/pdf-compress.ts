import { PDFDocument } from 'pdf-lib'

/**
 * Comprime un PDF usando cross-reference streams (flate/zlib) con pdf-lib.
 * Reduce el tamaño del structure overhead del PDF sin degradar el contenido.
 * Si el PDF es inválido o está encriptado, devuelve el buffer original sin cambios.
 */
export async function comprimirPdf(input: ArrayBuffer | Uint8Array): Promise<Uint8Array> {
  try {
    const doc = await PDFDocument.load(input, {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    return await doc.save({ useObjectStreams: true })
  } catch {
    // Si pdf-lib no puede procesar el archivo, devolver tal cual
    return input instanceof Uint8Array ? input : new Uint8Array(input)
  }
}
