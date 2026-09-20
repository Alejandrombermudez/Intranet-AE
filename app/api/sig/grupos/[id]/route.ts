import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'

/**
 * Deshacer una fusión. No borra: la unidad queda con `disuelto_at` y sus
 * miembros en `activo = false`, así se sabe que existió. El polígono que se
 * subió como total de la unidad se queda donde está (colgado del predio
 * principal) y solo deja de anunciarse como polígono de unidad.
 */

// DELETE /api/sig/grupos/[id] — disolver la unidad de siembra
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()
    const sesion = await exigirSesion(req, supabase, PUEDE.procesoPredio)
    if (!sesion.ok) return sesion.respuesta

    const { data: disuelta, error } = await supabase.schema('core').rpc('disolver_grupo', {
      p_grupo_id: id,
      p_por:      sesion.perfil.email,
    })

    if (error) {
      const falta = ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error.code ?? '')
        || /disolver_grupo|predio_grupos/i.test(error.message ?? '')
      return NextResponse.json({
        error: falta
          ? 'Falta correr docs/sql/migration_predio_grupos.sql en Supabase (unidades de siembra).'
          : error.message,
      }, { status: falta ? 503 : 500 })
    }

    // El RPC devuelve false si no existía o ya estaba disuelta: no es un fallo,
    // pero la UI necesita saberlo para no decir que deshizo algo.
    if (disuelta === false) {
      return NextResponse.json({ error: 'Esa unidad de siembra ya no está vigente' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/sig/grupos/[id] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
