import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'
import type { Geometry, Position } from 'geojson'

/**
 * Lo que Campo devolvió sobre un predio: qué le cambió a las zonas del SIG
 * (con el antes y el después de cada geometría) y las respuestas de los dos
 * formularios de terreno. Es la contraparte de la ingesta: el SIG propone
 * zonas, campo las verifica y responde.
 *
 * Y lo que el SIG decidió después (POST): confirmar, editar o eliminar cada
 * zona. El SIG tiene la última palabra, pero el historial de campo no se toca:
 * las decisiones van aparte, en geo.zona_decision.
 */
export interface RevisionCampo {
  local_id:       string | null
  zona_id:        string | null
  accion:         'confirmada' | 'modificada' | 'nueva' | 'descartada'
  metodo:         string | null
  geom_original:  Geometry | null
  geom_corregida: Geometry | null
  area_ha_campo:  number | null
  observaciones:  string | null
  evaluador:      string | null
  fecha:          string | null
  created_at:     string
}

export interface DecisionSig {
  id:            string
  zona_id:       string | null
  decision:      'confirmada' | 'editada' | 'eliminada'
  estado_previo: string | null
  geom_previa:   Geometry | null
  geom_nueva:    Geometry | null
  area_ha:       number | null
  nota:          string | null
  decidido_por:  string | null
  created_at:    string
}

/** Cómo está HOY cada zona que campo tocó (geo.zonas), no cómo la dejó campo. */
export interface ZonaActual {
  id:        string
  estado:    string
  vigente:   boolean
  origen:    string
  area_ha:   number | null
  geom:      Geometry | null
  n_nucleos: number
}

export interface CampoResumen {
  revisiones: RevisionCampo[]
  decisiones: DecisionSig[]
  zonas:      ZonaActual[]
  evaluacion: Record<string, unknown> | null
  encuesta:   Record<string, unknown> | null
  /** Mensaje si falta correr migration_decision_sig.sql (las decisiones no están disponibles). */
  falta_migracion: string | null
}

const FALTA = 'Falta correr docs/sql/migration_decision_sig.sql en Supabase: hasta entonces se puede ver lo que devolvió campo, pero no decidir.'
const noExiste = (err: { code?: string; message?: string } | null) =>
  !!err && (['PGRST202', 'PGRST205', '42P01', '42883'].includes(err.code ?? '')
    || /zona_decision|decidir_zonas/i.test(err.message ?? ''))

// GET /api/sig/campo?predio_id=... — resultados de campo del predio   (Authorization: Bearer <token>)
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.intranet)
  if (!sesion.ok) return sesion.respuesta

  const predioId = req.nextUrl.searchParams.get('predio_id')
  if (!predioId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

  try {
    const [{ data: revisiones }, decis, { data: evals }, { data: encuestas }] = await Promise.all([
      supabase.schema('geo').from('zona_revision')
        .select('local_id, zona_id, accion, metodo, geom_original, geom_corregida, area_ha_campo, observaciones, evaluador, fecha, created_at')
        .eq('predio_id', predioId)
        .order('created_at', { ascending: true }),
      supabase.schema('geo').from('zona_decision')
        .select('id, zona_id, decision, estado_previo, geom_previa, geom_nueva, area_ha, nota, decidido_por, created_at')
        .eq('predio_id', predioId)
        .order('created_at', { ascending: true }),
      supabase.schema('siembra').from('evaluaciones_campo')
        .select('id, created_by, fecha_visita, num_zonas_eval, step_completed, seccion_1_data, seccion_2_data, zonas_data, seccion_6_data, firma_eval1_url, firma_eval2_url, firma_prop_url, updated_at')
        .eq('predio_id', predioId)
        .order('updated_at', { ascending: false })
        .limit(1),
      supabase.schema('siembra').from('familias')
        .select('id, created_by, fecha_encuesta, step_completed, sec_general, sec_vivienda, sec_familia, sec_economia, sec_cultivos, sec_ganaderia, sec_tecnologia, sec_bosque, updated_at')
        .eq('predio_id', predioId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(1),
    ])

    // Estado actual de las zonas que campo tocó, con sus núcleos: es lo que
    // decide qué se puede hacer con cada una (un lote con núcleos no se edita).
    const revs = (revisiones ?? []) as RevisionCampo[]
    const ids = [...new Set(revs.map(r => r.zona_id).filter((x): x is string => !!x))]
    let zonas: ZonaActual[] = []
    if (ids.length > 0) {
      const [{ data: zs }, { data: nucs }] = await Promise.all([
        supabase.schema('geo').from('zonas')
          .select('id, estado, vigente, origen, area_ha, geom')
          .in('id', ids),
        // Si la nucleación no está migrada, esto falla y se cuenta 0: no bloquea.
        supabase.schema('geo').from('nucleos')
          .select('zona_id')
          .in('zona_id', ids)
          .eq('vigente', true),
      ])
      const nPorZona = new Map<string, number>()
      for (const n of (nucs ?? []) as { zona_id: string }[]) nPorZona.set(n.zona_id, (nPorZona.get(n.zona_id) ?? 0) + 1)
      zonas = ((zs ?? []) as Omit<ZonaActual, 'n_nucleos'>[]).map(z => ({ ...z, n_nucleos: nPorZona.get(z.id) ?? 0 }))
    }

    const faltaMigracion = noExiste(decis.error) ? FALTA : null
    if (decis.error && !faltaMigracion) console.error('GET /api/sig/campo decisiones:', decis.error)

    const resumen: CampoResumen = {
      revisiones: revs,
      decisiones: (decis.data ?? []) as DecisionSig[],
      zonas,
      evaluacion: evals?.[0] ?? null,
      encuesta:   encuestas?.[0] ?? null,
      falta_migracion: faltaMigracion,
    }
    return NextResponse.json(resumen)
  } catch (err) {
    console.error('GET /api/sig/campo error:', err)
    return NextResponse.json({ error: 'Error al leer los resultados de campo' }, { status: 500 })
  }
}

// Una geometría editada tiene que ser un polígono en lon/lat. Si llegara en
// coordenadas proyectadas (metros), PostGIS la guardaría igual y la zona
// aparecería en el océano: mejor rechazarla aquí con un mensaje claro.
function poligonoValido(g: unknown): g is Geometry {
  if (!g || typeof g !== 'object') return false
  const geom = g as Geometry
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return false
  const puntos: Position[] = geom.type === 'Polygon' ? geom.coordinates.flat() : geom.coordinates.flat(2)
  return puntos.length >= 4 && puntos.every(p =>
    Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])
    && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)
}

// POST /api/sig/campo — el SIG decide sobre zonas que campo ya revisó
//   { predio_id, zona_ids: string[], decision: 'confirmar'|'editar'|'eliminar', geometry?, nota? }
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const sesion = await exigirSesion(req, supabase, PUEDE.procesoPredio)
    if (!sesion.ok) return sesion.respuesta

    const { predio_id, zona_ids, decision, geometry, nota } = await req.json()
    if (!predio_id) return NextResponse.json({ error: 'Falta el predio' }, { status: 400 })
    if (!['confirmar', 'editar', 'eliminar'].includes(decision)) {
      return NextResponse.json({ error: 'Decisión inválida' }, { status: 400 })
    }
    const ids: string[] = Array.isArray(zona_ids)
      ? [...new Set(zona_ids.filter((x: unknown): x is string => typeof x === 'string' && !!x))]
      : []
    if (ids.length === 0) return NextResponse.json({ error: 'Marca al menos una zona' }, { status: 400 })
    if (decision === 'editar') {
      if (ids.length !== 1) return NextResponse.json({ error: 'Las zonas se editan de a una' }, { status: 400 })
      if (!poligonoValido(geometry)) {
        return NextResponse.json({ error: 'La geometría editada no es un polígono válido en EPSG:4326 (lon/lat).' }, { status: 400 })
      }
    }

    const { data, error } = await supabase.schema('geo').rpc('decidir_zonas', {
      p_predio_id: predio_id,
      p_zona_ids:  ids,
      p_decision:  decision,
      p_geojson:   decision === 'editar' ? JSON.stringify(geometry) : null,
      p_por:       sesion.perfil.email,
      p_nota:      typeof nota === 'string' && nota.trim() ? nota.trim().slice(0, 1000) : null,
    })
    if (error) {
      if (noExiste(error)) return NextResponse.json({ error: FALTA }, { status: 503 })
      // Los RAISE de la función ya vienen redactados para mostrarse tal cual.
      if (error.code === 'P0001') return NextResponse.json({ error: error.message }, { status: 409 })
      console.error('POST /api/sig/campo error:', error)
      return NextResponse.json({ error: 'No se pudo guardar la decisión' }, { status: 500 })
    }
    return NextResponse.json({ decididas: data ?? 0 })
  } catch (err) {
    console.error('POST /api/sig/campo error:', err)
    return NextResponse.json({ error: 'No se pudo guardar la decisión' }, { status: 500 })
  }
}
