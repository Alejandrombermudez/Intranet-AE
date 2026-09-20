import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'

// GET /api/sig/zonas?predio_id=... — zonas guardadas del predio (con geometría GeoJSON)
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.intranet)
  if (!sesion.ok) return sesion.respuesta

  const predioId = req.nextUrl.searchParams.get('predio_id')
  if (!predioId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

  const { data, error } = await supabase.schema('geo').rpc('zonas_de_predio', { p_predio_id: predioId })
  // Si el RPC no existe aún (migration_geo_v2 sin correr) devolvemos vacío para no romper la página
  if (error) return NextResponse.json([])
  return NextResponse.json(data ?? [])
}
