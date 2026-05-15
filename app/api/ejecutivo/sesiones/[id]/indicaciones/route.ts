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

const BLOQUES_VALIDOS = ['ejecutivo', 'colaborador']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, supabase, profile } = await authCheck(req)
  if (error) return NextResponse.json({ error }, { status })
  if (!isEjecutivo(profile)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id: sesionId } = await params
  const body = await req.json()
  const { descripcion, plataforma, orden, bloque = 'ejecutivo' } = body

  if (!descripcion) return NextResponse.json({ error: 'descripcion es requerida' }, { status: 400 })
  if (!BLOQUES_VALIDOS.includes(bloque)) return NextResponse.json({ error: 'bloque inválido' }, { status: 400 })

  let resolvedOrden = orden ?? 0
  if (orden === undefined) {
    const { data: existing } = await supabase
      .schema('ejecutivo').from('indicaciones')
      .select('orden')
      .eq('sesion_id', sesionId)
      .eq('bloque', bloque)
      .order('orden', { ascending: false })
      .limit(1)
    resolvedOrden = existing && existing.length > 0 ? (existing[0].orden + 1) : 0
  }

  const { data, error: dbErr } = await supabase
    .schema('ejecutivo').from('indicaciones')
    .insert({
      sesion_id: sesionId,
      bloque,
      descripcion,
      plataforma: plataforma ?? null,
      orden: resolvedOrden,
    })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, supabase, profile } = await authCheck(req)
  if (error) return NextResponse.json({ error }, { status })
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id: sesionId } = await params
  const { data, error: dbErr } = await supabase
    .schema('ejecutivo').from('indicaciones')
    .select('*')
    .eq('sesion_id', sesionId)
    .order('bloque', { ascending: true })
    .order('orden', { ascending: true })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
