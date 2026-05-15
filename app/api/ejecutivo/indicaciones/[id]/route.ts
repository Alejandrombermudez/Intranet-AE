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
  if (!profile) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  // Cargar la indicación para validar permisos según bloque
  const { data: ind, error: fetchErr } = await supabase
    .schema('ejecutivo').from('indicaciones')
    .select('bloque, sesion_id')
    .eq('id', id)
    .single()

  if (fetchErr || !ind) return NextResponse.json({ error: 'Indicación no encontrada' }, { status: 404 })

  const ejecutivo = isEjecutivo(profile)

  if (ind.bloque === 'ejecutivo') {
    // Solo el ejecutivo puede modificar tareas del bloque ejecutivo
    if (!ejecutivo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  } else {
    // Bloque colaborador: transiciones permitidas según rol
    if (body.estado !== undefined) {
      if (!ejecutivo) {
        // Colaborador solo puede marcar pendiente → marcado
        // Verificar que es el persona_id de la sesión
        const { data: sesion } = await supabase
          .schema('ejecutivo').from('sesiones')
          .select('persona_id')
          .eq('id', ind.sesion_id)
          .single()
        if (sesion?.persona_id !== profile.id) {
          return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }
        if (body.estado !== 'marcado') {
          return NextResponse.json({ error: 'Solo puedes marcar la tarea como realizada' }, { status: 403 })
        }
      } else {
        // Ejecutivo puede confirmar o cancelar tareas del colaborador
        const estadosEjecutivo = ['confirmado', 'cancelado', 'pendiente']
        if (!estadosEjecutivo.includes(body.estado)) {
          return NextResponse.json({ error: 'Transición de estado no válida' }, { status: 400 })
        }
      }
    } else if (!ejecutivo) {
      // Colaborador no puede editar descripción/plataforma
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  const updates: Record<string, unknown> = {}
  if (body.descripcion !== undefined) updates.descripcion = body.descripcion
  if (body.plataforma !== undefined) updates.plataforma = body.plataforma
  if (body.orden !== undefined) updates.orden = body.orden
  if (body.estado !== undefined) updates.estado = body.estado

  const { data, error: dbErr } = await supabase
    .schema('ejecutivo').from('indicaciones')
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
    .schema('ejecutivo').from('indicaciones')
    .delete()
    .eq('id', id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
