import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function authCheck(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return { error: 'No autenticado', status: 401 as const, supabase, profile: null }
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user?.email) return { error: 'No autenticado', status: 401 as const, supabase, profile: null }
  const { data: profile } = await supabase.schema('people').from('user_profiles')
    .select('id, is_admin, department').eq('email', user.email).single()
  return { error: null, status: 200 as const, supabase, profile }
}

const isEjecutivo = (p: { is_admin: boolean; department: string | null } | null) =>
  !!p?.is_admin || p?.department === 'Ejecutivo'

export async function GET(req: NextRequest) {
  const { error, status, supabase, profile } = await authCheck(req)
  if (error) return NextResponse.json({ error }, { status })
  if (!isEjecutivo(profile)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { data, error: dbErr } = await supabase
    .schema('people').from('user_profiles')
    .select('id, email, full_name, department, role')
    .or('can_access_intranet.eq.true,is_admin.eq.true')
    .order('full_name', { ascending: true })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
