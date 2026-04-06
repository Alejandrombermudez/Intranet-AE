import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/vehicle-documents
 * Returns all vehicle document records (SOAT + Tecnomecánica expiry dates).
 * Public — no auth required.
 */
export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('vehicle_documents')
    .select('id, vehicle_id, vehicle_name, soat_expiry, tecnomecanica_expiry, updated_at, updated_by')
    .order('vehicle_id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data ?? [])
}

/**
 * PUT /api/vehicle-documents
 * Upsert SOAT/Tecnomecánica expiry dates for a vehicle.
 * Requires Bearer token from a Financiero user or admin.
 *
 * Body: { vehicle_id: string, vehicle_name: string, soat_expiry?: string, tecnomecanica_expiry?: string }
 */
export async function PUT(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()

  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const supabase = createServerSupabaseClient()

  // Verify auth
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin, department')
    .eq('email', user.email)
    .single()

  if (!profile?.is_admin && profile?.department !== 'Financiero') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const body = await req.json() as {
    vehicle_id: string
    vehicle_name: string
    soat_expiry?: string | null
    tecnomecanica_expiry?: string | null
  }

  if (!body.vehicle_id || !body.vehicle_name) {
    return NextResponse.json({ error: 'vehicle_id y vehicle_name son requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('vehicle_documents')
    .upsert({
      vehicle_id: body.vehicle_id,
      vehicle_name: body.vehicle_name,
      soat_expiry: body.soat_expiry ?? null,
      tecnomecanica_expiry: body.tecnomecanica_expiry ?? null,
      updated_at: new Date().toISOString(),
      updated_by: user.email,
    }, { onConflict: 'vehicle_id' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
