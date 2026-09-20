import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'

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

// Lo que el RPC no recibe, en un UPDATE aparte: atributos + perímetro
// (migration_geo_v2) y la unidad de siembra (migration_predio_grupos). Se
// actualiza después de crear la zona para no tener que cambiar la firma de
// geo.crear_zona — dos sobrecargas dejarían a PostgREST sin saber cuál llamar.
// Si la columna no existe todavía, se avisa en log y la zona queda guardada.
async function persistirExtras(
  supabase: SB, zonaId: string,
  f: { properties?: unknown; perimetro_m?: number },
  grupoId: string | null,
) {
  const extra: Record<string, unknown> = { propiedades: f.properties ?? null }
  // Solo si viene calculado del cliente: al unir lo calcula el propio RPC
  // (ST_Perimeter sobre la unión) y mandarlo en null lo borraría.
  if (typeof f.perimetro_m === 'number') extra.perimetro_m = f.perimetro_m

  const { error } = await supabase.schema('geo').from('zonas')
    .update(grupoId ? { ...extra, grupo_id: grupoId } : extra)
    .eq('id', zonaId)
  if (!error) return

  // Si falló por la columna de la unidad (42703: no existe todavía), se
  // reintenta sin ella: perder los atributos y el perímetro por eso sería peor
  // que perder la marca de unidad.
  if (grupoId) {
    const { error: e2 } = await supabase.schema('geo').from('zonas').update(extra).eq('id', zonaId)
    if (!e2) {
      console.warn('Zona guardada sin marcar la unidad de siembra (¿falta migration_predio_grupos.sql?):', error.message)
      return
    }
  }
  console.warn('No se guardaron propiedades/perímetro (¿falta migration_geo_v2?):', error.message)
}

// POST /api/sig/ingesta — guarda zonas en geo.zonas
//   tipo:  'finca' (polígono del predio) | 'restauracion' (sitios de siembra) | 'conservacion'
//   modo:  'insertar' (agrega) | 'sobreescribir' (reemplaza las de ese tipo) | 'unir' (fusiona con unir_ids)
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const sesion = await exigirSesion(req, supabase, PUEDE.procesoPredio)
    if (!sesion.ok) return sesion.respuesta
    // Autor de la carga = quien tiene la sesión; un `email` en el cuerpo se ignora.
    const email = sesion.perfil.email

    const body = await req.json()
    const { predio_id, expediente_id, tipo, modo, unir_ids, features, grupo_id } = body
    if (!predio_id || !Array.isArray(features) || features.length === 0) {
      return NextResponse.json({ error: 'Faltan predio_id o geometrías' }, { status: 400 })
    }

    const t: string = tipo || 'restauracion'
    // Unidad de siembra: el polígono cubre varios predios y se sube contra el
    // principal. Se marca para que se sepa que no es solo de ese predio.
    // `predio_id` sigue apuntando al principal, así que todo lo que ya lee
    // geo.zonas (campo incluido) no cambia. Ver migration_predio_grupos.sql.
    const grupoId: string | null = typeof grupo_id === 'string' && grupo_id ? grupo_id : null

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
        await persistirExtras(supabase, zonaId as string, { properties: features[0]?.properties }, grupoId)
      }
      return NextResponse.json({ ok: true, creadas: 1 })
    }

    // Cada subida es una CARGA con versión (backup 1, backup 2...): nada se
    // borra. Las zonas entran a la carga como borrador (vigente=false) y solo
    // se activan al cerrarla, así una subida que se cae a mitad deja el predio
    // con lo anterior intacto. Ver docs/sql/migration_geo_versionado.sql y el
    // renombre de docs/sql/migration_renombrar_carga.sql — antes esto se
    // llamaba "lote", palabra que ahora significa el lote de SIEMBRA.
    const { data: cargaId, error: cargaErr } = await supabase.schema('geo').rpc('abrir_carga', {
      p_predio_id: predio_id,
      p_tipo: t,
      p_modo: modo === 'sobreescribir' ? 'sobreescribir' : 'insertar',
      p_created_by: email,
      p_nota: null,
    })
    if (cargaErr || !cargaId) {
      const falta = cargaErr?.code === 'PGRST202' || /abrir_carga|abrir_lote/i.test(cargaErr?.message ?? '')
      return NextResponse.json({
        error: falta
          ? 'Falta correr docs/sql/migration_renombrar_carga.sql en Supabase (la subida del SIG pasó a llamarse carga). No se guardó nada.'
          : 'No se pudo abrir la carga: ' + (cargaErr?.message ?? 'sin id'),
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
        p_carga_id: cargaId as string,
      })
      if (error) {
        // La carga queda abierta (zonas en borrador, invisibles) y lo anterior
        // sigue vigente: se puede reintentar la subida sin haber roto nada.
        return NextResponse.json({ error: 'Error guardando geometría: ' + error.message, creadas }, { status: 500 })
      }
      creadas++
      if (zonaId) await persistirExtras(supabase, zonaId as string, f, grupoId)
    }

    // Activar la carga. Con 'sobreescribir' retira lo anterior (soft), salvo
    // las zonas que campo ya trabajó: esas sobreviven marcadas en conflicto,
    // porque quien está parado en el predio tiene la última palabra.
    const { data: cierre, error: cerrarErr } = await supabase.schema('geo').rpc('cerrar_carga', {
      p_carga_id: cargaId as string,
      p_reemplazar: modo === 'sobreescribir',
    })
    if (cerrarErr) {
      return NextResponse.json({ error: 'Zonas guardadas pero no se activó la carga: ' + cerrarErr.message, creadas }, { status: 500 })
    }

    const resumen = Array.isArray(cierre) ? cierre[0] : cierre
    return NextResponse.json({
      ok: true,
      creadas,
      carga_id: cargaId,
      retiradas:    resumen?.retiradas ?? 0,
      en_conflicto: resumen?.en_conflicto ?? 0,
    })
  } catch (err) {
    console.error('POST /api/sig/ingesta error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
