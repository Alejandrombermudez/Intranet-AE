import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { listExpedientes } from '@/lib/expedientes'

// GET /api/expedientes?email=... — tablero de predios/expedientes
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  // Acceso: cualquier persona interna (admin, con acceso a intranet o con departamento)
  const { data: profile } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin, department, can_access_intranet')
    .eq('email', email)
    .single()
  if (!profile || (!profile.is_admin && !profile.can_access_intranet && !profile.department)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const rows = await listExpedientes(supabase)
    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/expedientes error:', err)
    return NextResponse.json({ error: 'Error al listar' }, { status: 500 })
  }
}
