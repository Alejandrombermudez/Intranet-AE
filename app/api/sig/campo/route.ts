import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Geometry } from 'geojson'

/**
 * Lo que Campo devolvió sobre un predio: qué le cambió a las zonas del SIG
 * (con el antes y el después de cada geometría) y las respuestas de los dos
 * formularios de terreno. Es la contraparte de la ingesta: el SIG propone
 * zonas, campo las verifica y responde.
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

export interface CampoResumen {
  revisiones: RevisionCampo[]
  evaluacion: Record<string, unknown> | null
  encuesta:   Record<string, unknown> | null
}

// GET /api/sig/campo?predio_id=...&email=... — resultados de campo del predio
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const email    = req.nextUrl.searchParams.get('email')
  const predioId = req.nextUrl.searchParams.get('predio_id')
  if (!email || !predioId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

  const { data: profile } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin, department, can_access_intranet')
    .eq('email', email)
    .single()
  if (!profile || (!profile.is_admin && !profile.can_access_intranet && !profile.department)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const [{ data: revisiones }, { data: evals }, { data: encuestas }] = await Promise.all([
      supabase.schema('geo').from('zona_revision')
        .select('local_id, zona_id, accion, metodo, geom_original, geom_corregida, area_ha_campo, observaciones, evaluador, fecha, created_at')
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

    const resumen: CampoResumen = {
      revisiones: (revisiones ?? []) as RevisionCampo[],
      evaluacion: evals?.[0] ?? null,
      encuesta:   encuestas?.[0] ?? null,
    }
    return NextResponse.json(resumen)
  } catch (err) {
    console.error('GET /api/sig/campo error:', err)
    return NextResponse.json({ error: 'Error al leer los resultados de campo' }, { status: 500 })
  }
}
