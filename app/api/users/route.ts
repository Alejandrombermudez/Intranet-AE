import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * GET /api/users
 * Devuelve todos los perfiles de usuario para el panel de administración.
 * Solo accesible por administradores (is_admin = true).
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()

  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user?.email) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  // Verificar que el solicitante sea administrador
  const { data: requester } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin')
    .eq('email', user.email)
    .single()

  if (!requester?.is_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data, error } = await supabase
    .schema('people').from('user_profiles')
    .select('*')
    .order('last_login', { ascending: false })

  if (error) {
    console.error('[GET /api/users] DB error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
