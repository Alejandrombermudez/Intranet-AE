import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'

/**
 * GET /api/ras/fenologia/foto/[id] — una foto de flor o fruto del monitoreo
 * (ras.fotos_monitoreo_semilleros.contenido, bytea). La pantalla la pide con
 * fetchConSesion y la muestra como blob: un <img src> no manda el token.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'id inválido' }, { status: 400 })
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.ras)
  if (!sesion.ok) return sesion.respuesta

  const { data, error } = await supabase.schema('ras').from('fotos_monitoreo_semilleros')
    .select('mime,contenido').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No existe' }, { status: 404 })

  // PostgREST entrega bytea como texto hexadecimal: «\x89504e47…».
  const hex = String(data.contenido ?? '').replace(/^\\x/, '')
  const bytes = Buffer.from(hex, 'hex')
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': data.mime || 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
    },
  })
}
