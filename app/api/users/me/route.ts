import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/users/me
 * Devuelve el perfil del usuario autenticado leyendo desde el servidor
 * con service_role (evita restricciones de RLS y de schemas expuestos en el
 * cliente del navegador).
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()

  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user?.email) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  const { data: profile, error: dbErr } = await supabase
    .schema('people').from('user_profiles')
    .select('id, is_admin, department, can_access_intranet, full_name, role')
    .eq('email', user.email)
    .maybeSingle()

  if (dbErr) {
    console.error('[/api/users/me] DB error:', dbErr.message)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado', email: user.email }, { status: 404 })
  }

  return NextResponse.json({ ...profile, email: user.email })
}
