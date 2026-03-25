import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/ras/conservacion
 * Crea un registro completo de familia en conservación:
 * 1. Sube shapefiles a ras-shapefiles
 * 2. Inserta en ras.familias
 * 3. Por cada cámara: inserta en ras.camaras_trampa, sube fotos a ras-fotos-camara e inserta en ras.fotos_camara
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()

  try {
    const formData = await req.formData()
    const rawData = formData.get('data')

    if (!rawData || typeof rawData !== 'string') {
      return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })
    }

    const data = JSON.parse(rawData)
    const requesterEmail: string | null = data.created_by ?? null

    if (!requesterEmail) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    // ── Autorización: solo admin o departamento RAS ──
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('is_admin, department')
      .eq('email', requesterEmail)
      .single()

    if (profileError || (!profile?.is_admin && profile?.department !== 'RAS')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // ── Subir shapefiles ──
    let shapefile_finca_url: string | null = null
    let shapefile_conservacion_url: string | null = null

    const shpFinca = formData.get('shp_finca') as File | null
    const shpConservacion = formData.get('shp_conservacion') as File | null

    if (shpFinca) {
      const path = `${requesterEmail}/${Date.now()}_finca_${shpFinca.name}`
      const { error: upErr } = await supabase.storage
        .from('ras-shapefiles')
        .upload(path, shpFinca, { contentType: 'application/zip' })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('ras-shapefiles').getPublicUrl(path)
        shapefile_finca_url = urlData.publicUrl
      } else {
        console.error('Error subiendo shp_finca:', upErr.message)
      }
    }

    if (shpConservacion) {
      const path = `${requesterEmail}/${Date.now()}_conservacion_${shpConservacion.name}`
      const { error: upErr } = await supabase.storage
        .from('ras-shapefiles')
        .upload(path, shpConservacion, { contentType: 'application/zip' })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('ras-shapefiles').getPublicUrl(path)
        shapefile_conservacion_url = urlData.publicUrl
      } else {
        console.error('Error subiendo shp_conservacion:', upErr.message)
      }
    }

    // ── Insertar familia en conservación ──
    const { camaras, ...familiaData } = data

    const { data: familia, error: familiaErr } = await supabase
      .schema('ras')
      .from('familias')
      .insert({
        ...familiaData,
        shapefile_finca_url,
        shapefile_conservacion_url,
      })
      .select('id')
      .single()

    if (familiaErr || !familia) {
      return NextResponse.json(
        { error: familiaErr?.message ?? 'Error al crear el registro' },
        { status: 500 }
      )
    }

    const familiaId = familia.id

    // ── Insertar cámaras trampa y fotos ──
    if (Array.isArray(camaras) && camaras.length > 0) {
      for (let i = 0; i < camaras.length; i++) {
        const cam = camaras[i]

        const { data: camara, error: camErr } = await supabase
          .schema('ras')
          .from('camaras_trampa')
          .insert({
            familia_id: familiaId,
            nombre: cam.nombre,
            latitud: cam.latitud,
            longitud: cam.longitud,
          })
          .select('id')
          .single()

        if (camErr || !camara) {
          console.error('Error cámara conservación:', camErr?.message)
          continue
        }

        // Fotos de esta cámara (getAll soporta múltiples entradas con la misma clave)
        const fotos = formData.getAll(`camara_${i}_foto`).filter((f): f is File => f instanceof File)

        for (const foto of fotos) {
          const path = `${familiaId}/${camara.id}/${Date.now()}_${foto.name}`
          const { error: fotoUpErr } = await supabase.storage
            .from('ras-fotos-camara')
            .upload(path, foto, { contentType: foto.type })

          if (!fotoUpErr) {
            const { data: urlData } = supabase.storage.from('ras-fotos-camara').getPublicUrl(path)
            await supabase
              .schema('ras')
              .from('fotos_camara')
              .insert({ camara_id: camara.id, url: urlData.publicUrl })
          } else {
            console.error('Error subiendo foto conservación:', fotoUpErr.message)
          }
        }
      }
    }

    return NextResponse.json({ id: familiaId }, { status: 201 })
  } catch (err) {
    console.error('Error POST /api/ras/conservacion:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
