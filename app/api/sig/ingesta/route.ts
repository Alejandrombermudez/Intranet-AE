import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type SB = ReturnType<typeof createServerSupabaseClient>

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

// Guarda atributos + perímetro (requiere migration_geo_v2; si no existe se ignora)
async function persistirProps(supabase: SB, zonaId: string, f: { properties?: unknown; perimetro_m?: number }) {
  const { error } = await supabase.schema('geo').from('zonas')
    .update({ propiedades: f.properties ?? null, perimetro_m: f.perimetro_m ?? null })
    .eq('id', zonaId)
  if (error) console.warn('No se guardaron propiedades/perímetro (¿falta migration_geo_v2?):', error.message)
}

// POST /api/sig/ingesta — guarda zonas en geo.zonas
//   tipo:  'finca' (polígono del predio) | 'restauracion' (sitios de siembra) | 'conservacion'
//   modo:  'insertar' (agrega) | 'sobreescribir' (reemplaza las de ese tipo) | 'unir' (fusiona con unir_ids)
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await req.json()
    const { predio_id, expediente_id, email, tipo, modo, unir_ids, features } = body
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

    const t: string = tipo || 'restauracion'

    // UNIR: una sola geometría fusionada (ST_Union) con las zonas indicadas
    if (modo === 'unir') {
      const f = features[0]
      const { data: zonaId, error } = await supabase.schema('geo').rpc('crear_zona_union', {
        p_predio_id: predio_id,
        p_geojson: JSON.stringify(f.geometry),
        p_ids: Array.isArray(unir_ids) ? unir_ids : [],
        p_tipo: t, p_origen: 'sig', p_nombre: deriveNombre(f.properties),
        p_expediente_id: expediente_id || null, p_created_by: email,
      })
      if (error) return NextResponse.json({ error: 'Error al unir: ' + error.message }, { status: 500 })
      if (zonaId) await persistirProps(supabase, zonaId as string, f)
      return NextResponse.json({ ok: true, creadas: 1 })
    }

    // SOBREESCRIBIR: borrar primero las zonas de ese tipo para el predio
    if (modo === 'sobreescribir') {
      await supabase.schema('geo').from('zonas').delete().eq('predio_id', predio_id).eq('tipo', t)
    }

    // INSERTAR (también el resto del flujo sobreescribir): una zona por feature
    let creadas = 0
    for (const f of features) {
      if (!f?.geometry) continue
      const { data: zonaId, error } = await supabase.schema('geo').rpc('crear_zona', {
        p_predio_id: predio_id,
        p_geojson: JSON.stringify(f.geometry),
        p_tipo: t, p_estado: 'potencial', p_origen: 'sig',
        p_nombre: deriveNombre(f.properties),
        p_expediente_id: expediente_id || null, p_created_by: email,
      })
      if (error) {
        return NextResponse.json({ error: 'Error guardando geometría: ' + error.message, creadas }, { status: 500 })
      }
      creadas++
      if (zonaId) await persistirProps(supabase, zonaId as string, f)
    }

    return NextResponse.json({ ok: true, creadas })
  } catch (err) {
    console.error('POST /api/sig/ingesta error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
