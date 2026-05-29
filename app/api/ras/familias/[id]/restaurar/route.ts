import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function authCheck(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { error: 'No autenticado', status: 401, supabase, user: null }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user?.email) return { error: 'No autenticado', status: 401, supabase, user: null }

  const { data: profile, error: profileError } = await supabase
    .schema('people').from('user_profiles').select('is_admin, department').eq('email', user.email).single()
  if (profileError || (!profile?.is_admin && profile?.department !== 'RAS')) {
    return { error: 'No autorizado', status: 403, supabase, user: null }
  }
  return { error: null, status: 200, supabase, user }
}

// POST /api/ras/familias/[id]/restaurar — restaura una familia eliminada (soft delete)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: familiaId } = await params
    if (!familiaId) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

    const auth = await authCheck(req)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { error } = await auth.supabase
      .schema('siembra').from('familias')
      .update({ deleted_at: null })
      .eq('id', familiaId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Error POST /api/ras/familias/[id]/restaurar:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
