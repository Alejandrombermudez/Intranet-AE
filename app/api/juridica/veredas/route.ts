import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'
import { normalizarMunicipio } from '@/lib/veredas-caqueta'

/**
 * GET /api/juridica/veredas — las veredas que ya usan los predios, por municipio.
 *
 * Es lo que hace que una vereda agregada a mano en la ficha («+ Agregar») quede
 * en el selector para todos sin una tabla aparte: apenas un predio la guarda,
 * aparece aquí. El selector las suma a la lista oficial (`opcionesVereda`).
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.juridica)
  if (!sesion.ok) return sesion.respuesta

  const { data, error } = await supabase
    .schema('core').from('predios')
    .select('municipio, vereda')
    .not('vereda', 'is', null)
  if (error) {
    console.error('GET /api/juridica/veredas error:', error)
    return NextResponse.json({ error: 'No se pudieron leer las veredas' }, { status: 500 })
  }

  const porMunicipio: Record<string, string[]> = {}
  for (const { municipio, vereda } of data ?? []) {
    const mun = normalizarMunicipio(municipio)
    const v = String(vereda ?? '').trim()
    if (!mun || !v) continue
    const lista = (porMunicipio[mun] ??= [])
    if (!lista.includes(v)) lista.push(v)
  }
  return NextResponse.json(porMunicipio)
}
