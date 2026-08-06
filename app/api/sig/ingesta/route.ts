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

// Combina varios polígonos (Polygon/MultiPolygon) en un solo MultiPolygon GeoJSON
function combinarMultiPolygon(features: { geometry?: { type?: string; coordinates?: unknown } }[]) {
  const coords: unknown[] = []
  for (const f of features) {
    const g = f?.geometry
    if (!g) continue
    if (g.type === 'Polygon') coords.push(g.coordinates)
    else if (g.type === 'MultiPolygon') for (const poly of (g.coordinates as unknown[])) coords.push(poly)
  }
  return { type: 'MultiPolygon', coordinates: coords }
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

    // UNIR: combinar los seleccionados en un MultiPolygon y fusionarlo (ST_Union)
    // con las zonas indicadas. El RPC calcula área y perímetro de la unión.
    if (modo === 'unir') {
      const geom = combinarMultiPolygon(features)
      const { data: zonaId, error } = await supabase.schema('geo').rpc('crear_zona_union', {
        p_predio_id: predio_id,
        p_geojson: JSON.stringify(geom),
        p_ids: Array.isArray(unir_ids) ? unir_ids : [],
        p_tipo: t, p_origen: 'sig', p_nombre: deriveNombre(features[0]?.properties),
        p_expediente_id: expediente_id || null, p_created_by: email,
      })
      if (error) return NextResponse.json({ error: 'Error al unir: ' + error.message }, { status: 500 })
      if (zonaId) {
        await supabase.schema('geo').from('zonas')
          .update({ propiedades: features[0]?.properties ?? null })
          .eq('id', zonaId as string)
      }
      return NextResponse.json({ ok: true, creadas: 1 })
    }

    // Cada subida es un LOTE con versión (backup 1, backup 2...): nada se
    // borra. Las zonas entran al lote como borrador (vigente=false) y solo se
    // activan al cerrarlo, así una carga que se cae a mitad deja el predio
    // con lo anterior intacto. Ver docs/sql/migration_geo_versionado.sql.
    const { data: loteId, error: loteErr } = await supabase.schema('geo').rpc('abrir_lote', {
      p_predio_id: predio_id,
      p_tipo: t,
      p_modo: modo === 'sobreescribir' ? 'sobreescribir' : 'insertar',
      p_created_by: email,
      p_nota: null,
    })
    if (loteErr || !loteId) {
      const falta = loteErr?.code === 'PGRST202' || /abrir_lote/i.test(loteErr?.message ?? '')
      return NextResponse.json({
        error: falta
          ? 'Falta correr docs/sql/migration_geo_versionado.sql en Supabase (versionado de zonas). No se guardó nada.'
          : 'No se pudo abrir el lote de subida: ' + (loteErr?.message ?? 'sin id'),
      }, { status: falta ? 503 : 500 })
    }

    let creadas = 0
    for (const f of features) {
      if (!f?.geometry) continue
      const { data: zonaId, error } = await supabase.schema('geo').rpc('crear_zona', {
        p_predio_id: predio_id,
        p_geojson: JSON.stringify(f.geometry),
        p_tipo: t, p_estado: 'potencial', p_origen: 'sig',
        p_nombre: deriveNombre(f.properties),
        p_expediente_id: expediente_id || null, p_created_by: email,
        p_lote_id: loteId as string,
      })
      if (error) {
        // El lote queda abierto (zonas en borrador, invisibles) y lo anterior
        // sigue vigente: se puede reintentar la subida sin haber roto nada.
        return NextResponse.json({ error: 'Error guardando geometría: ' + error.message, creadas }, { status: 500 })
      }
      creadas++
      if (zonaId) await persistirProps(supabase, zonaId as string, f)
    }

    // Activar el lote. Con 'sobreescribir' retira el anterior (soft), salvo
    // las zonas que campo ya trabajó: esas sobreviven marcadas en conflicto,
    // porque quien está parado en el predio tiene la última palabra.
    const { data: cierre, error: cerrarErr } = await supabase.schema('geo').rpc('cerrar_lote', {
      p_lote_id: loteId as string,
      p_reemplazar: modo === 'sobreescribir',
    })
    if (cerrarErr) {
      return NextResponse.json({ error: 'Zonas guardadas pero no se activó el lote: ' + cerrarErr.message, creadas }, { status: 500 })
    }

    const resumen = Array.isArray(cierre) ? cierre[0] : cierre
    return NextResponse.json({
      ok: true,
      creadas,
      lote_id: loteId,
      retiradas:    resumen?.retiradas ?? 0,
      en_conflicto: resumen?.en_conflicto ?? 0,
    })
  } catch (err) {
    console.error('POST /api/sig/ingesta error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
