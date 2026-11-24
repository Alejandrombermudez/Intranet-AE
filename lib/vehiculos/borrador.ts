/**
 * Borrador de la recepción o devolución, guardado en el celular (IndexedDB) mientras se llena.
 *
 * En celulares con poca memoria Android cierra Chrome mientras la cámara está abierta («No se ha
 * podido completar la operación anterior por falta de memoria», 2026-11-24): al volver la página
 * se recarga y se perdía todo lo llenado y las fotos ya tomadas. Con esto, al abrir de nuevo la
 * misma reserva se sigue donde iba. Las fotos se guardan ya comprimidas (~250 KB cada una).
 * Se borra al enviar y caduca a los 3 días. Si IndexedDB no está, no pasa nada: sin borrador.
 */

export interface Borrador {
  paso: number
  aceptados: boolean[]
  cats: unknown
  km: string
  fotos: Record<string, Blob>
  /** true mientras la cámara está abierta: si al volver sigue en true, Android cerró la app. */
  camara?: boolean
  guardado: number
}

const BASE = 'vehiculos'
const ALMACEN = 'borradores'
const CADUCA_MS = 3 * 24 * 3600 * 1000

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const pedido = indexedDB.open(BASE, 1)
    pedido.onupgradeneeded = () => { pedido.result.createObjectStore(ALMACEN) }
    pedido.onsuccess = () => ok(pedido.result)
    pedido.onerror = () => mal(pedido.error)
  })
}

async function conAlmacen<T>(modo: IDBTransactionMode, hacer: (a: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  try {
    const db = await abrir()
    return await new Promise<T>((ok, mal) => {
      const tx = db.transaction(ALMACEN, modo)
      const pedido = hacer(tx.objectStore(ALMACEN))
      tx.oncomplete = () => { db.close(); ok(pedido.result) }
      tx.onerror = () => { db.close(); mal(tx.error) }
    })
  } catch {
    return undefined
  }
}

export const claveBorrador = (reservaId: string, tipo: string) => `${reservaId}:${tipo}`

export async function leerBorrador(clave: string): Promise<Borrador | null> {
  const b = await conAlmacen<Borrador | undefined>('readonly', (a) => a.get(clave))
  if (!b) return null
  if (Date.now() - b.guardado > CADUCA_MS) { await borrarBorrador(clave); return null }
  return b
}

export async function guardarBorrador(clave: string, b: Omit<Borrador, 'guardado'>): Promise<void> {
  await conAlmacen('readwrite', (a) => a.put({ ...b, guardado: Date.now() }, clave))
}

export async function borrarBorrador(clave: string): Promise<void> {
  await conAlmacen('readwrite', (a) => a.delete(clave))
}
