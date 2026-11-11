import { NextResponse } from 'next/server'
import { conductorActual, fleet } from '@/lib/vehiculos/sesion'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vehiculos/estado — quién soy (si este dispositivo ya entró) y la lista para
 * «usuario y PIN»: solo quien ya tiene un PIN asignado por administración (los demás no
 * podrían entrar por ahí). Solo nombres: nada de correos.
 */
export async function GET() {
  const yo = await conductorActual()
  const { data, error } = await fleet()
    .from('conductores')
    .select('id, nombre')
    .eq('activo', true)
    .not('pin_hash', 'is', null)
    .order('nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    yo: yo ? { id: yo.id, nombre: yo.nombre, esAdmin: yo.es_admin } : null,
    personas: data ?? [],
  })
}
