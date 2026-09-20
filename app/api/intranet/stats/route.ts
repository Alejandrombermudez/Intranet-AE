import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'

/**
 * GET /api/intranet/stats   (Authorization: Bearer <token>)
 * Devuelve todas las inspecciones completadas con datos del vehículo.
 * Admin o departamento Financiero, según el perfil de la sesión.
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.financiero)
  if (!sesion.ok) return sesion.respuesta

  // Inspecciones completadas con JOIN a vehicle_reservations (via FK reservation_id)
  const { data, error } = await supabase
    .schema('fleet').from('vehicle_inspections')
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
      vehicle_reservations ( vehicle_id, vehicle_name, user_name, user_email )
    `)
    .not('submitted_at', 'is', null)
    .order('submitted_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inspections: data ?? [] })
}
