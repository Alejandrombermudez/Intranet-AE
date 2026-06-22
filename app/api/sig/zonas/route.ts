import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// GET /api/sig/zonas?predio_id=...&email=... — zonas guardadas del predio (con geometría GeoJSON)
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const email = req.nextUrl.searchParams.get('email')
  const predioId = req.nextUrl.searchParams.get('predio_id')
  if (!email || !predioId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

  const { data: profile } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin, department, can_access_intranet').eq('email', email).single()
  if (!profile || (!profile.is_admin && !profile.can_access_intranet && !profile.department)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data, error } = await supabase.schema('geo').rpc('zonas_de_predio', { p_predio_id: predioId })
  // Si el RPC no existe aún (migration_geo_v2 sin correr) devolvemos vacío para no romper la página
  if (error) return NextResponse.json([])
  return NextResponse.json(data ?? [])
}
