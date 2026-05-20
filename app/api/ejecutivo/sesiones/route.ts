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
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const personaId = req.nextUrl.searchParams.get('persona_id')
  if (!personaId) return NextResponse.json({ error: 'persona_id requerido' }, { status: 400 })

  if (!isEjecutivo(profile) && profile.id !== personaId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // 1) Sesiones + indicaciones (mismo schema, sin cross-schema join)
  const { data: sesiones, error: dbErr } = await supabase
    .schema('ejecutivo').from('sesiones')
    .select(`*, indicaciones(*)`)
    .eq('persona_id', personaId)
    .order('fecha', { ascending: false })

  if (dbErr) {
    console.error('[GET /api/ejecutivo/sesiones]', dbErr)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  // 2) Cargar perfiles de usuarios involucrados (persona + ejecutivos) por separado
  const userIds = new Set<string>()
  for (const s of sesiones ?? []) {
    userIds.add(s.persona_id)
    userIds.add(s.ejecutivo_id)
  }

  let usersById: Record<string, { id: string; full_name: string | null; email: string; department: string | null }> = {}
  if (userIds.size > 0) {
    const { data: users, error: usersErr } = await supabase
      .schema('people').from('user_profiles')
      .select('id, full_name, email, department')
      .in('id', Array.from(userIds))
    if (usersErr) {
      console.error('[GET /api/ejecutivo/sesiones] users', usersErr)
      return NextResponse.json({ error: usersErr.message }, { status: 500 })
    }
    usersById = Object.fromEntries((users ?? []).map(u => [u.id, u]))
  }

  // 3) Merge en JS + ordenar indicaciones
  const result = (sesiones ?? []).map(s => ({
    ...s,
    indicaciones: [...(s.indicaciones ?? [])].sort((a, b) => a.orden - b.orden),
    persona: usersById[s.persona_id] ?? { id: s.persona_id, full_name: null, email: '', department: null },
    ejecutivo: usersById[s.ejecutivo_id] ?? { id: s.ejecutivo_id, full_name: null, email: '', department: null },
  }))

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { error, status, supabase, profile } = await authCheck(req)
  if (error) return NextResponse.json({ error }, { status })
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const { as_ticket, persona_id, titulo, fecha, notas } = body

  if (!titulo || !fecha) {
    return NextResponse.json({ error: 'titulo y fecha son requeridos' }, { status: 400 })
  }

  let ejecutivoId: string
  let personaId: string

  if (as_ticket) {
    personaId = profile.id
    const { data: ejecutivo } = await supabase.schema('people').from('user_profiles')
      .select('id')
      .or('department.eq.Ejecutivo,is_admin.eq.true')
      .neq('id', profile.id)
      .limit(1)
      .single()
    if (!ejecutivo) return NextResponse.json({ error: 'No se encontró ejecutivo en la organización' }, { status: 404 })
    ejecutivoId = ejecutivo.id
  } else {
    if (!isEjecutivo(profile)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    if (!persona_id) return NextResponse.json({ error: 'persona_id requerido' }, { status: 400 })
    ejecutivoId = profile.id
    personaId = persona_id
  }

  const { data, error: dbErr } = await supabase
    .schema('ejecutivo').from('sesiones')
    .insert({
      iniciado_por: profile.id,
      ejecutivo_id: ejecutivoId,
      persona_id: personaId,
      titulo,
      fecha,
      notas: notas ?? null,
    })
    .select()
    .single()

  if (dbErr) {
    console.error('[POST /api/ejecutivo/sesiones]', dbErr)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
