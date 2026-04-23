import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const BUCKET = 'siembra-fotos-predio'

function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}

/**
 * DELETE /api/ras/familias/fotos/[photoId]
 * Elimina una foto de predio: borra la fila de siembra.fotos_predio
 * Y el archivo del bucket siembra-fotos-predio.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  try {
    const { photoId } = await params
    if (!photoId) return NextResponse.json({ error: 'photoId requerido' }, { status: 400 })

    const supabase = createServerSupabaseClient()

    // Verificar autenticación
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles').select('is_admin, department').eq('email', user.email).single()
    if (!profile?.is_admin && profile?.department !== 'RAS') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Obtener URL antes de borrar para poder limpiar el bucket
    const { data: foto, error: fetchErr } = await supabase
      .schema('siembra').from('fotos_predio')
      .select('id, url').eq('id', photoId).single()

    if (fetchErr || !foto) {
      return NextResponse.json({ error: 'Foto no encontrada' }, { status: 404 })
    }

    // Borrar archivo del bucket (no bloqueante)
    try {
      const storagePath = extractStoragePath(foto.url, BUCKET)
      if (storagePath) {
        await supabase.storage.from(BUCKET).remove([storagePath])
      }
    } catch (storageErr) {
      console.error('Error borrando archivo del bucket:', storageErr)
    }

    // Borrar registro de la tabla
    const { error: deleteErr } = await supabase
      .schema('siembra').from('fotos_predio').delete().eq('id', photoId)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Error DELETE /api/ras/familias/fotos/[photoId]:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
