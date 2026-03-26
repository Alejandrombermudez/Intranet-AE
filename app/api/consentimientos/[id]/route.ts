import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * DELETE /api/consentimientos/[id]
 * Elimina un registro de consentimiento por UUID.
 * Solo usuarios autenticados del depto Financiero o admin.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()

    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin, department')
      .eq('email', user.email)
      .single()

    if (!profile?.is_admin && profile?.department !== 'Financiero') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = params

    const { error } = await supabase
      .from('consentimientos')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error eliminando consentimiento:', error.message)
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Error DELETE /api/consentimientos/[id]:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
