import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/ras/familias
 * Crea un registro completo de familia en restauración:
 * 1. Sube shapefiles a ras-shapefiles
 * 2. Inserta en ras.familias
 * 3. Inserta monitoreos en ras.monitoreos
 * 4. Por cada cámara: inserta en ras.camaras_trampa, sube fotos a ras-fotos-camara e inserta en ras.fotos_camara
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()

  // ── Auth: solo admin o dept RAS ──
  let requesterEmail: string | null = null
  try {
    const formData = await req.formData()
    const rawData = formData.get('data')
    if (!rawData || typeof rawData !== 'string') {
      return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })
    }

    const data = JSON.parse(rawData)
    requesterEmail = data.created_by ?? null

    if (!requesterEmail) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

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
    let shapefile_restauracion_url: string | null = null

    const shpFinca = formData.get('shp_finca') as File | null
    const shpRestauracion = formData.get('shp_restauracion') as File | null

    if (shpFinca) {
      const path = `${requesterEmail}/${Date.now()}_finca_${shpFinca.name}`
      const { error: upErr } = await supabase.storage
        .from('ras-shapefiles')
        .upload(path, shpFinca, { contentType: 'application/zip' })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('ras-shapefiles').getPublicUrl(path)
        shapefile_finca_url = urlData.publicUrl
      }
    }

    if (shpRestauracion) {
      const path = `${requesterEmail}/${Date.now()}_restauracion_${shpRestauracion.name}`
      const { error: upErr } = await supabase.storage
        .from('ras-shapefiles')
        .upload(path, shpRestauracion, { contentType: 'application/zip' })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('ras-shapefiles').getPublicUrl(path)
        shapefile_restauracion_url = urlData.publicUrl
      }
    }

    // ── Insertar familia ──
    const { monitoreos, camaras, ...familiaData } = data

    const { data: familia, error: familiaErr } = await supabase
      .schema('ras')
      .from('familias')
      .insert({
        ...familiaData,
        shapefile_finca_url,
        shapefile_restauracion_url,
      })
      .select('id')
      .single()

    if (familiaErr || !familia) {
      return NextResponse.json({ error: familiaErr?.message ?? 'Error al crear familia' }, { status: 500 })
    }

    const familiaId = familia.id

    // ── Insertar monitoreos ──
    if (Array.isArray(monitoreos) && monitoreos.length > 0) {
      const { error: monErr } = await supabase
        .schema('ras')
        .from('monitoreos')
        .insert(monitoreos.map((m: { fecha: string; supervivencia_pct: number }) => ({
          familia_id: familiaId,
          fecha: m.fecha,
          supervivencia_pct: m.supervivencia_pct,
        })))
      if (monErr) console.error('Error monitoreos:', monErr.message)
    }

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
          console.error('Error cámara:', camErr?.message)
          continue
        }

        // Fotos de esta cámara
        const fotos: File[] = []
        let fotoIdx = 0
        while (true) {
          const foto = formData.get(`camara_${i}_foto`) as File | null
          // FormData puede tener múltiples entradas con la misma clave
          const allFotos = formData.getAll(`camara_${i}_foto`) as File[]
          if (allFotos.length === 0) break
          for (const foto of allFotos) {
            if (foto instanceof File) fotos.push(foto)
          }
          break
        }

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
          }
        }
      }
    }

    return NextResponse.json({ id: familiaId }, { status: 201 })
  } catch (err) {
    console.error('Error POST /api/ras/familias:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
