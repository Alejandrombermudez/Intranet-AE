import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Documentos legales por familia (cesión de derechos de imagen, etc.).
// Bucket PRIVADO ras-documentos-privados → nunca URL pública; se firma al leer.
const BUCKET = 'ras-documentos-privados'
const TIPOS = ['cesion_imagen', 'acuerdo_conservacion', 'otro'] as const
const SIGN_TTL = 60 * 60          // 1 hora — la ficha regenera al recargar

async function authCheck(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { error: 'No autenticado', status: 401, supabase, user: null }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user?.email) return { error: 'No autenticado', status: 401, supabase, user: null }

  const { data: profile, error: profileError } = await supabase
    .schema('people').from('user_profiles').select('is_admin, department').eq('email', user.email).single()
  if (profileError || (!profile?.is_admin && profile?.department !== 'RAS')) {
    return { error: 'No autorizado', status: 403, supabase, user: null }
  }
  return { error: null, status: 200, supabase, user }
}

// GET — lista los documentos de la familia con URL firmada temporal
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: familiaId } = await params
    const auth = await authCheck(req)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const supabase = auth.supabase

    const { data: docs, error } = await supabase
      .schema('ras').from('documentos_familia')
      .select('id, tipo, titular_nombre, titular_documento, fecha, storage_path, nombre_archivo, observaciones, created_at')
      .eq('familia_id', familiaId)
      .order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Firmar cada archivo (bucket privado)
    const conUrl = await Promise.all((docs ?? []).map(async (d) => {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, SIGN_TTL)
      return { ...d, url: signed?.signedUrl ?? null }
    }))

    return NextResponse.json(conUrl)
  } catch (err) {
    console.error('GET /api/ras/conservacion/[id]/documentos error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// POST — sube un documento (multipart: file + meta JSON) y lo enlaza a la familia
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: familiaId } = await params
    const auth = await authCheck(req)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const supabase = auth.supabase
    const email = auth.user!.email!

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })
    }
    const meta = JSON.parse((formData.get('meta') as string) || '{}')
    const tipo = TIPOS.includes(meta.tipo) ? meta.tipo : 'cesion_imagen'

    // Confirmar que la familia existe (evita huérfanos)
    const { data: fam } = await supabase.schema('ras').from('familias').select('id').eq('id', familiaId).single()
    if (!fam) return NextResponse.json({ error: 'Familia no encontrada' }, { status: 404 })

    // Ruta en el bucket privado: {familia}/{tipo}/{timestamp}_{nombre saneado}
    const safeName = (file.name || 'documento').replace(/[^\w.\-]+/g, '_')
    const storagePath = `${familiaId}/${tipo}/${Date.now()}_${safeName}`
    const { error: upErr } = await supabase.storage.from(BUCKET)
      .upload(storagePath, file, { contentType: file.type || 'application/pdf', upsert: false })
    if (upErr) return NextResponse.json({ error: 'Error al subir el archivo: ' + upErr.message }, { status: 500 })

    const { data: row, error: insErr } = await supabase
      .schema('ras').from('documentos_familia')
      .insert({
        familia_id:        familiaId,
        tipo,
        titular_nombre:    meta.titular_nombre?.trim() || null,
        titular_documento: meta.titular_documento?.trim() || null,
        fecha:             meta.fecha || null,
        observaciones:     meta.observaciones?.trim() || null,
        storage_path:      storagePath,
        nombre_archivo:    file.name || safeName,
        created_by:        email,
      })
      .select('id')
      .single()
    if (insErr) {
      // Revertir el archivo subido si el insert falla
      await supabase.storage.from(BUCKET).remove([storagePath])
      return NextResponse.json({ error: insErr.message }, { status: 500 })
    }

    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGN_TTL)
    return NextResponse.json({ id: row!.id, url: signed?.signedUrl ?? null }, { status: 201 })
  } catch (err) {
    console.error('POST /api/ras/conservacion/[id]/documentos error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
