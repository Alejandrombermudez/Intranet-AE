import { supabase } from '@/lib/supabase'

export interface Especie {
  id: string
  nombre_cientifico: string
  autor: string | null
  genero: string | null
  epiteto: string | null
  familia: string | null
  nombres_comunes: string[] | null
  especie_anterior: string | null
  descripcion: string | null
  habito: string | null
  foto_url: string | null
  usos: string[] | null
  aplica_ley_arbol: boolean | null
  iucn: string | null
  cites: string | null
  amenaza: string | null
  orden: string | null
  origen: string | null
  dispersion: string | null
  polinizacion: string | null
  rol_sucesional: string | null
  tipo_semilla: string | null
  tratamiento_pregerminativo: string | null
  pct_germinacion: number | null
  dias_germinacion: number | null
  dias_crecimiento_vivero: number | null
  semillas_por_kg: number | null
  en_catalogo: boolean
  en_ras: boolean
  en_vivero: boolean
  n_arboles_ras: number
  slug: string | null
}

export type OrigenFiltro = 'todas' | 'ras' | 'vivero'

/** Trae el catálogo completo (150 filas — pequeño, se filtra en cliente). */
export async function fetchEspecies(): Promise<Especie[]> {
  const { data, error } = await supabase
    .schema('catalogo')
    .from('especies')
    .select('*')
    .order('nombre_cientifico', { ascending: true })
  if (error) {
    console.warn('[catalogo] fetchEspecies:', error.message)
    return []
  }
  return (data ?? []) as unknown as Especie[]
}

/** Filtra por origen + familia + texto (común o científico). */
export function filtrarEspecies(
  lista: Especie[],
  origen: OrigenFiltro,
  familia: string,
  q: string,
): Especie[] {
  const t = q.trim().toLowerCase()
  return lista.filter((e) => {
    if (origen === 'ras' && !e.en_ras) return false
    if (origen === 'vivero' && !e.en_vivero) return false
    if (familia && e.familia !== familia) return false
    if (t) {
      const hay = [e.nombre_cientifico, ...(e.nombres_comunes ?? [])]
        .join(' ').toLowerCase()
      if (!hay.includes(t)) return false
    }
    return true
  })
}

/**
 * Foto de relleno cuando no hay foto real (de familia/predio/árbol): una foto del
 * catálogo, elegida de forma determinística por `seed` (mismo id → misma foto en
 * cada carga, no "parpadea" al recargar). Solo para que la interfaz no se vea vacía
 * mientras se completan las fotos reales — no reemplaza el dato, es puramente visual.
 */
export function fotoAleatoriaCatalogo(especies: Especie[], seed: string): string | null {
  const conFoto = especies.filter((e) => e.foto_url)
  if (conFoto.length === 0) return null
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return conFoto[hash % conFoto.length].foto_url
}

/** Sube/cambia la foto de una especie vía API (server, service role). Devuelve la nueva URL. */
export async function cambiarFoto(id: string, file: File): Promise<string | null> {
  const fd = new FormData()
  fd.append('foto', file)
  const r = await fetch(`/api/catalogo/${id}/foto`, { method: 'POST', body: fd })
  if (!r.ok) {
    console.warn('[catalogo] cambiarFoto:', await r.text())
    return null
  }
  const { foto_url } = await r.json()
  return foto_url ?? null
}
