import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user?.email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.schema('people').from('user_profiles')
    .select('id').eq('email', user.email).single()
  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  // 1) Sesiones + indicaciones (mismo schema, sin cross-schema join)
  const { data: sesiones, error: dbErr } = await supabase
    .schema('ejecutivo').from('sesiones')
    .select('*, indicaciones(*)')
    .eq('persona_id', profile.id)
    .order('fecha', { ascending: false })

  if (dbErr) {
    console.error('[GET /api/ejecutivo/mis-sesiones]', dbErr)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  // 2) Cargar perfiles involucrados (ejecutivo + persona) por separado
  const userIds = new Set<string>()
  for (const s of sesiones ?? []) {
    userIds.add(s.ejecutivo_id)
    userIds.add(s.persona_id)
  }

  let usersById: Record<string, { id: string; full_name: string | null; email: string; department: string | null }> = {}
  if (userIds.size > 0) {
    const { data: users, error: usersErr } = await supabase
      .schema('people').from('user_profiles')
      .select('id, full_name, email, department')
      .in('id', Array.from(userIds))
    if (usersErr) {
      console.error('[GET /api/ejecutivo/mis-sesiones] users', usersErr)
      return NextResponse.json({ error: usersErr.message }, { status: 500 })
    }
    usersById = Object.fromEntries((users ?? []).map(u => [u.id, u]))
  }

  // 3) Merge + ordenar indicaciones
  const result = (sesiones ?? []).map(s => ({
    ...s,
    indicaciones: [...(s.indicaciones ?? [])].sort((a, b) => a.orden - b.orden),
    ejecutivo: usersById[s.ejecutivo_id] ?? { id: s.ejecutivo_id, full_name: null, email: '', department: null },
    persona:   usersById[s.persona_id]   ?? { id: s.persona_id,   full_name: null, email: '', department: null },
  }))

  return NextResponse.json(result)
}
