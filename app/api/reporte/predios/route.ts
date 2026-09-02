import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Listado de predios para el módulo Reporte, con un semáforo de qué información
 * hay ya recogida de cada uno. Sirve para saber, antes de abrir el informe,
 * qué tan completo va a salir.
 */
export interface PredioReporte {
  predio_id: string
  nombre_predio: string | null
  propietario: string | null
  municipio: string | null
  vereda: string | null
  zona_ae: string | null
  etapa: string | null
  semaforo: string | null
  /** Qué bloques del expediente tienen datos. */
  tiene: {
    juridica: boolean
    zonas: boolean
    campo: boolean
    encuesta: boolean
  }
  num_zonas: number
  area_zonas_ha: number
  /** 0–4: cuántos de los cuatro bloques están. Ordena la lista. */
  completitud: number
}

// GET /api/reporte/predios?email=...
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Falta email' }, { status: 400 })

  const { data: profile } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin, department, can_access_intranet')
    .eq('email', email)
    .single()
  if (!profile || (!profile.is_admin && !profile.can_access_intranet && !profile.department)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const [
      { data: predios }, { data: aliados }, { data: expedientes },
      { data: analisis }, { data: zonas }, { data: evals }, { data: encuestas },
    ] = await Promise.all([
      supabase.schema('core').from('predios')
        .select('id, aliado_id, nombre_predio, municipio, vereda, zona_ae'),
      supabase.schema('core').from('aliados').select('id, nombre_completo'),
      supabase.schema('core').from('expedientes').select('predio_id, etapa'),
      supabase.schema('juridica').from('analisis_juridico').select('predio_id, semaforo'),
      supabase.schema('geo').from('zonas').select('predio_id, area_ha, vigente'),
      supabase.schema('siembra').from('evaluaciones_campo').select('predio_id'),
      supabase.schema('siembra').from('familias').select('predio_id').is('deleted_at', null),
    ])

    const nombreAliado = new Map((aliados ?? []).map(a => [a.id, a.nombre_completo]))
    const etapaDe      = new Map((expedientes ?? []).map(e => [e.predio_id, e.etapa]))
    const semaforoDe   = new Map((analisis ?? []).map(a => [a.predio_id, a.semaforo]))
    const conCampo     = new Set((evals ?? []).map(e => e.predio_id))
    const conEncuesta  = new Set((encuestas ?? []).map(f => f.predio_id))

    const zonasDe = new Map<string, { n: number; area: number }>()
    for (const z of zonas ?? []) {
      if (z.vigente === false) continue
      const acc = zonasDe.get(z.predio_id) ?? { n: 0, area: 0 }
      acc.n += 1
      acc.area += Number(z.area_ha ?? 0)
      zonasDe.set(z.predio_id, acc)
    }

    const filas: PredioReporte[] = (predios ?? []).map(p => {
      const z = zonasDe.get(p.id) ?? { n: 0, area: 0 }
      const tiene = {
        juridica: semaforoDe.has(p.id),
        zonas:    z.n > 0,
        campo:    conCampo.has(p.id),
        encuesta: conEncuesta.has(p.id),
      }
      return {
        predio_id: p.id,
        nombre_predio: p.nombre_predio,
        propietario: p.aliado_id ? nombreAliado.get(p.aliado_id) ?? null : null,
        municipio: p.municipio,
        vereda: p.vereda,
        zona_ae: p.zona_ae,
        etapa: etapaDe.get(p.id) ?? null,
        semaforo: semaforoDe.get(p.id) ?? null,
        tiene,
        num_zonas: z.n,
        area_zonas_ha: Math.round(z.area * 100) / 100,
        completitud: Object.values(tiene).filter(Boolean).length,
      }
    })

    // Los más completos arriba: son los que dan un informe que vale la pena.
    filas.sort((a, b) =>
      b.completitud - a.completitud ||
      (a.nombre_predio ?? '').localeCompare(b.nombre_predio ?? ''))

    return NextResponse.json(filas)
  } catch (err) {
    console.error('GET /api/reporte/predios error:', err)
    return NextResponse.json({ error: 'Error al listar predios' }, { status: 500 })
  }
}
