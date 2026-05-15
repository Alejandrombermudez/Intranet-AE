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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, supabase, profile } = await authCheck(req)
  if (error) return NextResponse.json({ error }, { status })
  if (!isEjecutivo(profile)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.titulo !== undefined) updates.titulo = body.titulo
  if (body.fecha !== undefined) updates.fecha = body.fecha
  if (body.notas !== undefined) updates.notas = body.notas
  if (body.cerrada !== undefined) updates.cerrada = Boolean(body.cerrada)

  const { data, error: dbErr } = await supabase
    .schema('ejecutivo').from('sesiones')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, supabase, profile } = await authCheck(req)
  if (error) return NextResponse.json({ error }, { status })
  if (!isEjecutivo(profile)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { error: dbErr } = await supabase
    .schema('ejecutivo').from('sesiones')
    .delete()
    .eq('id', id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
