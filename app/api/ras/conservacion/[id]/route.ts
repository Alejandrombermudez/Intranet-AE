import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * DELETE /api/ras/conservacion/[id]
 * Elimina una familia en conservación y todos sus registros relacionados (CASCADE en BD).
 * Solo accesible por admin o departamento RAS.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createServerSupabaseClient()

  try {
    const { id: familiaId } = await params

    if (!familiaId || familiaId === 'undefined') {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // ── Auth: token Bearer enviado por el cliente ──
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin, department')
      .eq('email', user.email)
      .single()

    if (profileError || (!profile?.is_admin && profile?.department !== 'RAS')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // ── Eliminar (CASCADE borra ras.camaras_trampa y ras.fotos_camara) ──
    const { error: deleteError } = await supabase
      .schema('ras')
      .from('familias')
      .delete()
      .eq('id', familiaId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Error DELETE /api/ras/conservacion/[id]:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
