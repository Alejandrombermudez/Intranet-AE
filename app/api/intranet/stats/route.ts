import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/intranet/stats?email=admin@email.com
 * Devuelve todas las inspecciones completadas con datos del vehículo.
 * Solo accesible para administradores (verificado contra user_profiles).
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Verificar que el solicitante sea admin o pertenezca al departamento Financiero
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('is_admin, department')
    .eq('email', email)
    .single()

  if (profileError || (!profile?.is_admin && profile?.department !== 'Financiero')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Inspecciones completadas con JOIN a vehicle_reservations (via FK reservation_id)
  const { data, error } = await supabase
    .from('vehicle_inspections')
    .select(`
      id,
      inspection_type,
      submitted_at,
      cat1_status, cat1_issues,
      cat2_status, cat2_issues,
      cat3_status, cat3_issues,
      cat4_status, cat4_issues,
      cat5_status, cat5_issues,
      cat6_status, cat6_issues,
      photo_frontal,
      photo_posterior,
      photo_lateral_izq,
      photo_lateral_der,
      photo_tablero,
      kilometraje,
      vehicle_reservations ( vehicle_id, vehicle_name )
    `)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inspections: data ?? [] })
}
