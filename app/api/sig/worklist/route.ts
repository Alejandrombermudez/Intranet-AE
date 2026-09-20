import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { listExpedientes, type ExpedienteRow } from '@/lib/expedientes'
import { exigirSesion, PUEDE } from '@/lib/auth-api'

/**
 * Fila del tablero SIG: el expediente + qué cartografía tiene ya cargada.
 * Con 100+ predios, lo que el SIG necesita saber de un vistazo no es el nombre
 * sino QUÉ FALTA: ¿ya tiene el polígono del predio?, ¿ya tiene zonas de
 * siembra?, ¿ya está en campo?
 */
export interface SigWorklistRow extends ExpedienteRow {
  tiene_finca:      boolean
  n_zonas_siembra:  number     // vigentes y no descartadas
  n_descartadas:    number     // las que campo marcó como no aptas
  ha_finca:         number | null   // MEDIDA sobre el shapefile (PostGIS), no la de la escritura
  ha_siembra:       number | null
  /** Etapa cartográfica derivada — es el eje real de trabajo del SIG. */
  fase: 'sin_cartografia' | 'solo_predio' | 'listo_para_campo' | 'en_campo'
  // Qué ha devuelto campo
  n_revisiones:     number
  tiene_eval_campo: boolean
  tiene_encuesta:   boolean
  // ── Unidad de siembra (varios predios, un solo polígono) ──
  // El tablero pliega los miembros bajo el predio principal: la unidad es UNA
  // línea de trabajo, no N predios sin cartografía. Ver /api/sig/grupos.
  grupo_id:         string | null
  grupo_nombre:     string | null
  /** Este predio es el que lleva el polígono de la unidad. */
  es_principal:     boolean
  /** Cuántos predios tiene la unidad (0 si el predio no está fusionado). */
  grupo_n_predios:  number
}

interface ZonaMin {
  predio_id: string
  tipo: string
  estado: string
  area_ha: number | null
  vigente: boolean | null
}

// GET /api/sig/worklist — tablero SIG con resumen cartográfico   (Authorization: Bearer <token>)
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.intranet)
  if (!sesion.ok) return sesion.respuesta

  try {
    const [expedientes, { data: zonas }, { data: evals }, { data: encuestas }, { data: revisiones }, grupos] =
      await Promise.all([
        listExpedientes(supabase),
        supabase.schema('geo').from('zonas').select('predio_id, tipo, estado, area_ha, vigente'),
        supabase.schema('siembra').from('evaluaciones_campo').select('predio_id'),
        supabase.schema('siembra').from('familias').select('predio_id').is('deleted_at', null),
        supabase.schema('geo').from('zona_revision').select('predio_id'),
        // Unidades de siembra. Si migration_predio_grupos.sql no está corrida,
        // el tablero funciona igual que antes: sin unidades.
        supabase.schema('core').from('v_predio_grupos')
          .select('grupo_id, nombre, predio_principal_id, n_predios, predio_ids')
          .then(({ data, error }) => (error ? [] : (data ?? []))),
      ])

    // predio_id → la unidad a la que pertenece
    interface GrupoMin { grupo_id: string; nombre: string; predio_principal_id: string; n_predios: number; predio_ids: string[] }
    const grupoDePredio = new Map<string, GrupoMin>()
    for (const g of grupos as GrupoMin[]) {
      for (const pid of (g.predio_ids ?? [])) grupoDePredio.set(pid, g)
    }

    // Resumen cartográfico por predio (pocas filas: se agrega en memoria)
    const geo = new Map<string, { finca: number; haFinca: number; siembra: number; haSiembra: number; descartadas: number }>()
    for (const z of (zonas ?? []) as ZonaMin[]) {
      if (z.vigente === false) continue   // versión anterior del SIG: es respaldo, no cuenta
      const g = geo.get(z.predio_id) ?? { finca: 0, haFinca: 0, siembra: 0, haSiembra: 0, descartadas: 0 }
      const ha = Number(z.area_ha ?? 0)
      if (z.tipo === 'finca') { g.finca++; g.haFinca += ha }
      else if (z.tipo === 'restauracion') {
        if (z.estado === 'descartada') g.descartadas++
        else { g.siembra++; g.haSiembra += ha }
      }
      geo.set(z.predio_id, g)
    }

    const conEval  = new Set((evals ?? []).map(e => e.predio_id).filter(Boolean))
    const conEnc   = new Set((encuestas ?? []).map(e => e.predio_id).filter(Boolean))
    const revPorPredio = new Map<string, number>()
    for (const r of (revisiones ?? [])) {
      if (!r.predio_id) continue
      revPorPredio.set(r.predio_id, (revPorPredio.get(r.predio_id) ?? 0) + 1)
    }

    const rows: SigWorklistRow[] = expedientes.map(e => {
      const g = geo.get(e.predio_id)
      const grupo = grupoDePredio.get(e.predio_id)
      const tieneFinca = (g?.finca ?? 0) > 0
      const nSiembra   = g?.siembra ?? 0
      const enCampo    = e.etapa === 'campo' || e.etapa === 'sig_ii'

      const fase: SigWorklistRow['fase'] =
        enCampo                       ? 'en_campo'
        : nSiembra > 0                ? 'listo_para_campo'
        : tieneFinca                  ? 'solo_predio'
        :                               'sin_cartografia'

      return {
        ...e,
        tiene_finca:      tieneFinca,
        n_zonas_siembra:  nSiembra,
        n_descartadas:    g?.descartadas ?? 0,
        ha_finca:         g && g.haFinca  > 0 ? Number(g.haFinca.toFixed(2))  : null,
        ha_siembra:       g && g.haSiembra > 0 ? Number(g.haSiembra.toFixed(2)) : null,
        fase,
        n_revisiones:     revPorPredio.get(e.predio_id) ?? 0,
        tiene_eval_campo: conEval.has(e.predio_id),
        tiene_encuesta:   conEnc.has(e.predio_id),
        grupo_id:         grupo?.grupo_id ?? null,
        grupo_nombre:     grupo?.nombre ?? null,
        es_principal:     grupo ? grupo.predio_principal_id === e.predio_id : false,
        grupo_n_predios:  grupo?.n_predios ?? 0,
      }
    })

    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/sig/worklist error:', err)
    return NextResponse.json({ error: 'Error al armar el tablero SIG' }, { status: 500 })
  }
}
