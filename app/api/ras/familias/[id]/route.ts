import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const BUCKET = 'siembra-shapefiles'

function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}

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

// ─── DELETE ───────────────────────────────────────────────────────────────────
// Por defecto: soft delete (deleted_at = now()).
// Con ?hard=true: eliminación permanente con limpieza de storage.

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: familiaId } = await params
    if (!familiaId || familiaId === 'undefined') {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const auth = await authCheck(req)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const supabase = auth.supabase

    const hard = req.nextUrl.searchParams.get('hard') === 'true'

    if (!hard) {
      // ── Soft delete ──
      const { error } = await supabase
        .schema('siembra').from('familias')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', familiaId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true }, { status: 200 })
    }

    // ── Hard delete (desde sección Eliminadas) ──
    const { data: familia } = await supabase
      .schema('siembra').from('familias')
      .select('shapefile_finca_url, shapefile_restauracion_url, shapefile_arboles_url, documento_acuerdo_url')
      .eq('id', familiaId).single()

    try {
      const shpPaths = [familia?.shapefile_finca_url, familia?.shapefile_restauracion_url, familia?.shapefile_arboles_url]
        .filter(Boolean)
        .map((url) => extractStoragePath(url!, BUCKET))
        .filter(Boolean) as string[]
      if (shpPaths.length > 0) await supabase.storage.from(BUCKET).remove(shpPaths)
      if (familia?.documento_acuerdo_url) {
        const docPath = extractStoragePath(familia.documento_acuerdo_url, 'ras-documentos')
        if (docPath) await supabase.storage.from('ras-documentos').remove([docPath])
      }
    } catch (storageErr) {
      console.error('Error limpiando archivos del bucket:', storageErr)
    }

    const { error: deleteError } = await supabase
      .schema('siembra').from('familias').delete().eq('id', familiaId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Error DELETE /api/ras/familias/[id]:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: familiaId } = await params
    if (!familiaId || familiaId === 'undefined') {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const auth = await authCheck(req)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const supabase = auth.supabase
    const userEmail = auth.user!.email!

    const formData = await req.formData()
    const rawFields = formData.get('fields')
    if (!rawFields) return NextResponse.json({ error: 'Campos requeridos' }, { status: 400 })

    const fields = JSON.parse(rawFields as string)
    const updateObj: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() }

    // Shapefile finca (opcional)
    const shpFinca = formData.get('shp_finca') as File | null
    if (shpFinca && shpFinca.size > 0) {
      const { data: existing } = await supabase
        .schema('siembra').from('familias')
        .select('shapefile_finca_url').eq('id', familiaId).single()
      if (existing?.shapefile_finca_url) {
        const oldPath = extractStoragePath(existing.shapefile_finca_url, BUCKET)
        if (oldPath) {
          try { await supabase.storage.from(BUCKET).remove([oldPath]) } catch { /* continuar */ }
        }
      }
      const path = `${userEmail}/${Date.now()}_finca_${shpFinca.name}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, shpFinca)
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
        updateObj.shapefile_finca_url = publicUrl
      }
    }

    // Shapefile restauración (opcional)
    const shpRestauracion = formData.get('shp_restauracion') as File | null
    if (shpRestauracion && shpRestauracion.size > 0) {
      const { data: existing } = await supabase
        .schema('siembra').from('familias')
        .select('shapefile_restauracion_url').eq('id', familiaId).single()
      if (existing?.shapefile_restauracion_url) {
        const oldPath = extractStoragePath(existing.shapefile_restauracion_url, BUCKET)
        if (oldPath) {
          try { await supabase.storage.from(BUCKET).remove([oldPath]) } catch { /* continuar */ }
        }
      }
      const path = `${userEmail}/${Date.now()}_restauracion_${shpRestauracion.name}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, shpRestauracion)
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
        updateObj.shapefile_restauracion_url = publicUrl
      }
    }

    // Shapefile árboles (opcional)
    const shpArboles = formData.get('shp_arboles') as File | null
    if (shpArboles && shpArboles.size > 0) {
      const { data: existing } = await supabase
        .schema('siembra').from('familias')
        .select('shapefile_arboles_url').eq('id', familiaId).single()
      if (existing?.shapefile_arboles_url) {
        const oldPath = extractStoragePath(existing.shapefile_arboles_url, BUCKET)
        if (oldPath) {
          try { await supabase.storage.from(BUCKET).remove([oldPath]) } catch { /* continuar */ }
        }
      }
      const path = `${userEmail}/${Date.now()}_arboles_${shpArboles.name}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, shpArboles)
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
        updateObj.shapefile_arboles_url = publicUrl
      }
    }

    // PDF acuerdo (opcional)
    const docAcuerdo = formData.get('doc_acuerdo') as File | null
    if (docAcuerdo && docAcuerdo.size > 0) {
      const { data: existing } = await supabase
        .schema('siembra').from('familias')
        .select('documento_acuerdo_url').eq('id', familiaId).single()
      if (existing?.documento_acuerdo_url) {
        const oldPath = extractStoragePath(existing.documento_acuerdo_url, 'ras-documentos')
        if (oldPath) {
          try { await supabase.storage.from('ras-documentos').remove([oldPath]) } catch { /* continuar */ }
        }
      }
      const path = `${userEmail}/${Date.now()}_acuerdo_${docAcuerdo.name}`
      const { error: upErr } = await supabase.storage.from('ras-documentos').upload(path, docAcuerdo, { contentType: 'application/pdf' })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('ras-documentos').getPublicUrl(path)
        updateObj.documento_acuerdo_url = publicUrl
      }
    }

    // Fotos del predio por categoría (PATCH — sólo agrega, no elimina existentes)
    const FOTO_CATS_PATCH = ['predio', 'familia', 'arboles', 'otras']
    for (const cat of FOTO_CATS_PATCH) {
      let i = 0
      while (true) {
        const foto = formData.get(`foto_${cat}_${i}`) as File | null
        if (!foto || !(foto instanceof File) || foto.size === 0) break
        const path = `${familiaId}/${cat}/${Date.now()}_${i}_${foto.name}`
        const { error: upErr } = await supabase.storage
          .from('siembra-fotos-predio')
          .upload(path, foto, { contentType: foto.type })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('siembra-fotos-predio').getPublicUrl(path)
          await supabase.schema('siembra').from('fotos_predio')
            .insert({ familia_id: familiaId, categoria: cat, url: publicUrl })
        } else {
          console.error(`Error subiendo foto siembra ${cat}_${i}:`, upErr.message)
        }
        i++
      }
    }

    const { error: updateError } = await supabase
      .schema('siembra').from('familias').update(updateObj).eq('id', familiaId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('Error PATCH /api/ras/familias/[id]:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
