import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function deriveNombre(props: Record<string, unknown> | null | undefined): string | null {
  if (!props) return null
  for (const k of Object.keys(props)) {
    if (/nombre|name|predio|zona|finca|lote/i.test(k)) {
      const v = props[k]
      if (v != null && String(v).trim()) return String(v).trim().slice(0, 200)
    }
  }
  return null
}

// POST /api/sig/ingesta — guarda las zonas (geometría 4326) de un predio en geo.zonas
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await req.json()
    const { predio_id, expediente_id, email, tipo, estado, features } = body
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    if (!predio_id || !Array.isArray(features) || features.length === 0) {
      return NextResponse.json({ error: 'Faltan predio_id o geometrías' }, { status: 400 })
    }

    const { data: profile, error: pErr } = await supabase
      .schema('people').from('user_profiles')
      .select('is_admin, department').eq('email', email).single()
    if (pErr || (!profile?.is_admin && !['SIG', 'RAS', 'Juridica'].includes(profile?.department ?? ''))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    let creadas = 0
    for (const f of features) {
      const geom = f?.geometry
      if (!geom) continue
      const { data: zonaId, error } = await supabase.schema('geo').rpc('crear_zona', {
        p_predio_id: predio_id,
        p_geojson: JSON.stringify(geom),
        p_tipo: tipo || 'restauracion',
        p_estado: estado || 'potencial',
        p_origen: 'sig',
        p_nombre: deriveNombre(f.properties),
        p_expediente_id: expediente_id || null,
        p_created_by: email,
      })
      if (error) {
        return NextResponse.json({ error: 'Error guardando geometría: ' + error.message, creadas }, { status: 500 })
      }
      creadas++
      // Persistir atributos + perímetro (requiere migration_geo_v2; si no existe, se ignora)
      if (zonaId) {
        const { error: upErr } = await supabase.schema('geo').from('zonas')
          .update({ propiedades: f.properties ?? null, perimetro_m: f.perimetro_m ?? null })
          .eq('id', zonaId)
        if (upErr) console.warn('No se guardaron propiedades/perímetro (¿falta migration_geo_v2?):', upErr.message)
      }
    }

    return NextResponse.json({ ok: true, creadas })
  } catch (err) {
    console.error('POST /api/sig/ingesta error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
