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

  // El ejecutivo puede ver sesiones de cualquier persona.
  // Un colaborador solo puede ver sus propias sesiones.
  if (!isEjecutivo(profile) && profile.id !== personaId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data, error: dbErr } = await supabase
    .schema('ejecutivo').from('sesiones')
    .select(`
      *,
      indicaciones(*),
      persona:persona_id(id, full_name, email, department),
      ejecutivo:ejecutivo_id(id, full_name, email)
    `)
    .eq('persona_id', personaId)
    .order('fecha', { ascending: false })
    .order('orden', { referencedTable: 'indicaciones', ascending: true })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
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
    // Colaborador abre un ticket hacia el ejecutivo
    personaId = profile.id
    // Auto-detectar el ejecutivo de la organización
    const { data: ejecutivo } = await supabase.schema('people').from('user_profiles')
      .select('id')
      .or('department.eq.Ejecutivo,is_admin.eq.true')
      .neq('id', profile.id)
      .limit(1)
      .single()
    if (!ejecutivo) return NextResponse.json({ error: 'No se encontró ejecutivo en la organización' }, { status: 404 })
    ejecutivoId = ejecutivo.id
  } else {
    // Ejecutivo crea sesión para un colaborador
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

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
