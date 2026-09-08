import { supabase } from '@/lib/supabase'

/**
 * Catálogos parametrizables desde la UI: los dos que clasifican un predio.
 *
 *   proyectos            → bajo qué programa entra (Conexión Biodiversa, Ley del Árbol…)
 *   fuentes_informacion  → cómo llegó (socialización veredal, comunitaria, Lácteos del Hogar…)
 *
 * El valor que se guarda en core.predios es el `codigo` (slug), no el id: las
 * otras dependencias (SIG, campo, vivero, reportes) filtran por él directo por
 * REST sin tener que resolver un uuid. Ver docs/sql/migration_proyecto_fuente.sql.
 *
 * Las listas son de 2–10 filas: se traen enteras y se filtran en cliente.
 */

export type ListaParametro = 'proyectos' | 'fuentes_informacion'

export interface Parametro {
  id:          string
  codigo:      string
  nombre:      string
  descripcion: string | null
  activo:      boolean
  orden:       number
}

/** Etiqueta de cada lista, para mensajes y encabezados. */
export const ETIQUETA_LISTA: Record<ListaParametro, string> = {
  proyectos:           'Tipo de proyecto',
  fuentes_informacion: 'Fuente de información',
}

/**
 * Trae una lista completa, ordenada como se quiere ver en el desplegable.
 * Devuelve [] si falla (p. ej. la migración todavía no se ha corrido): el
 * formulario sigue usable, solo que sin opciones que escoger.
 */
export async function fetchParametros(lista: ListaParametro): Promise<Parametro[]> {
  const { data, error } = await supabase
    .schema('catalogo')
    .from(lista)
    .select('id, codigo, nombre, descripcion, activo, orden')
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true })
  if (error) {
    console.warn(`[parametros] fetch ${lista}:`, error.message)
    return []
  }
  return (data ?? []) as unknown as Parametro[]
}

/** Las dos listas de una sola vez (es lo que necesita HOJA 1). */
export async function fetchParametrosHoja1(): Promise<{
  proyectos: Parametro[]
  fuentes:   Parametro[]
}> {
  const [proyectos, fuentes] = await Promise.all([
    fetchParametros('proyectos'),
    fetchParametros('fuentes_informacion'),
  ])
  return { proyectos, fuentes }
}

/**
 * Agrega una opción nueva a un catálogo. Pasa por la API route porque el
 * permiso (jurídica o admin) y la generación del código se deciden en servidor:
 * si dos personas escriben «Lácteos del hogar» y «Lacteos del Hogar» debe salir
 * el MISMO código, no dos opciones que parten los filtros en dos.
 */
export async function crearParametro(
  lista: ListaParametro,
  nombre: string,
  email: string,
): Promise<{ ok: true; parametro: Parametro } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/catalogo/parametros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lista, nombre, created_by: email }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, error: body?.error ?? `No se pudo agregar la opción (${res.status})` }
    }
    return { ok: true, parametro: body as Parametro }
  } catch {
    return { ok: false, error: 'Sin conexión con el servidor. Intenta de nuevo.' }
  }
}

/**
 * Nombre legible de un código. Si el código ya no está en el catálogo (opción
 * borrada), devuelve el código crudo en vez de un vacío: es preferible ver
 * `lacteos_del_hogar` a ver un guion y no saber qué tenía el predio.
 */
export function nombreParametro(lista: Parametro[], codigo: string | null | undefined): string | null {
  if (!codigo) return null
  return lista.find((p) => p.codigo === codigo)?.nombre ?? codigo
}
