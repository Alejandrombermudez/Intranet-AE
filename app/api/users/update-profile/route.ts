import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * PATCH /api/users/update-profile
 * Permite a un administrador cambiar role, department e is_admin de cualquier usuario.
 * Verifica que requesterEmail tenga is_admin = true antes de proceder.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)

  const requesterEmail: string | undefined = body?.requesterEmail
  const targetEmail: string | undefined = body?.targetEmail
  const role: string | undefined = body?.role
  const department: string | undefined = body?.department
  const is_admin: boolean | undefined = body?.is_admin

  if (!requesterEmail || !targetEmail) {
    return NextResponse.json({ error: 'requesterEmail and targetEmail required' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Verificar que el solicitante sea administrador
  const { data: requester, error: reqError } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('email', requesterEmail)
    .single()

  if (reqError || !requester?.is_admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Construir solo los campos que se quieren actualizar
  const updates: Record<string, unknown> = {}
  if (role       !== undefined) updates.role       = role
  if (department !== undefined) updates.department = department
  if (is_admin   !== undefined) updates.is_admin   = is_admin

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('email', targetEmail)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
