import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'

/**
 * Nucleación: los núcleos de siembra dentro de cada lote.
 *
 * El SIG sube UN archivo con todos los núcleos del predio y la base decide a
 * qué lote pertenece cada uno, por geometría (el lote que lo contiene; si cae
 * en el borde, el que más lo intersecte). Así nadie tiene que separar el
 * shapefile por lote a mano. El núcleo que no caiga en ningún lote se guarda
 * igual, con `zona_id` en NULL, y la intranet lo reporta para que el SIG
 * decida — perderlo en silencio sería peor.
 *
 * Como toda subida del SIG, es versionada: reemplazar no borra, la nucleación
 * anterior queda `vigente = false` y consultable.
 */

export interface NucleoGuardado {
  id:          string
  zona_id:     string | null
  nombre:      string | null
  area_ha:     number | null
  n_plantas:   number | null
  propiedades: Record<string, unknown> | null
  geojson:     string
}

const FALTA = 'Falta correr docs/sql/migration_nucleacion.sql en Supabase (lotes y nucleación). No se guardó nada.'
const noExiste = (err: { code?: string; message?: string } | null) =>
  !!err && (['PGRST202', 'PGRST205', '42P01', '42883'].includes(err.code ?? '')
    || /nucleos|crear_nucleo|carga_nucleos/i.test(err.message ?? ''))

/** Nombre del núcleo: lo que traiga el .dbf en una columna parecida. */
function deriveNombre(props: Record<string, unknown> | null | undefined): string | null {
  if (!props) return null
  for (const k of Object.keys(props)) {
    if (/nombre|name|nucleo|núcleo|id|codigo|código/i.test(k)) {
      const v = props[k]
      if (v != null && String(v).trim()) return String(v).trim().slice(0, 200)
    }
  }
  return null
}

/** Número de plantas: solo si el .dbf trae una columna que claramente lo sea. */
function derivePlantas(props: Record<string, unknown> | null | undefined): number | null {
  if (!props) return null
  for (const k of Object.keys(props)) {
    if (/plantas|arboles|árboles|individuos|n_plant|cant/i.test(k)) {
      const n = Number(props[k])
      if (Number.isFinite(n) && n >= 0) return Math.round(n)
    }
  }
  return null
}

// GET /api/sig/nucleacion?predio_id=... — núcleos vigentes del predio
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.intranet)
  if (!sesion.ok) return sesion.respuesta

  const predioId = req.nextUrl.searchParams.get('predio_id')
  if (!predioId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

  const { data, error } = await supabase.schema('geo').rpc('nucleos_de_predio', { p_predio_id: predioId })
  if (error) {
    if (noExiste(error)) return NextResponse.json({ error: FALTA }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json((data ?? []) as NucleoGuardado[])
}

// POST /api/sig/nucleacion — guardar una carga de nucleación
//   { predio_id, reemplazar?: boolean, features: [{ geometry, properties }] }
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const sesion = await exigirSesion(req, supabase, PUEDE.procesoPredio)
    if (!sesion.ok) return sesion.respuesta
    const email = sesion.perfil.email

    const { predio_id, features, reemplazar } = await req.json()
    if (!predio_id || !Array.isArray(features) || features.length === 0) {
      return NextResponse.json({ error: 'Faltan el predio o las geometrías' }, { status: 400 })
    }

    // Sin lotes confirmados no hay dónde poner los núcleos: se frena aquí en
    // vez de guardar una nucleación entera colgando de nada.
    const { data: lotes, error: lotesErr } = await supabase.schema('geo').from('zonas')
      .select('id')
      .eq('predio_id', predio_id).eq('tipo', 'restauracion').eq('estado', 'definitiva').eq('vigente', true)
    if (lotesErr && noExiste(lotesErr)) return NextResponse.json({ error: FALTA }, { status: 503 })
    if (!lotes || lotes.length === 0) {
      return NextResponse.json({
        error: 'Este predio todavía no tiene lotes confirmados. Confirma primero las zonas que volvieron de campo.',
      }, { status: 409 })
    }

    // La carga abre en versión nueva; si algo falla a mitad, lo anterior sigue
    // vigente porque el reemplazo solo ocurre al cerrarla.
    const { data: cargaId, error: cargaErr } = await supabase.schema('geo').rpc('abrir_carga_nucleos', {
      p_predio_id: predio_id, p_created_by: email, p_nota: null,
    })
    if (cargaErr || !cargaId) {
      return NextResponse.json({
        error: noExiste(cargaErr) ? FALTA : 'No se pudo abrir la carga: ' + (cargaErr?.message ?? 'sin id'),
      }, { status: noExiste(cargaErr) ? 503 : 500 })
    }

    let creados = 0
    for (const f of features) {
      if (!f?.geometry) continue
      const props = (f.properties ?? null) as Record<string, unknown> | null
      const { error } = await supabase.schema('geo').rpc('crear_nucleo', {
        p_predio_id:   predio_id,
        p_geojson:     JSON.stringify(f.geometry),
        p_carga_id:    cargaId as string,
        p_nombre:      deriveNombre(props),
        p_n_plantas:   derivePlantas(props),
        p_propiedades: props,
        p_created_by:  email,
      })
      if (error) {
        return NextResponse.json({ error: 'Error guardando un núcleo: ' + error.message, creados }, { status: 500 })
      }
      creados++
    }

    const { data: cierre, error: cerrarErr } = await supabase.schema('geo').rpc('cerrar_carga_nucleos', {
      p_carga_id: cargaId as string,
      p_reemplazar: reemplazar !== false,
    })
    if (cerrarErr) {
      return NextResponse.json({ error: 'Núcleos guardados pero no se activó la carga: ' + cerrarErr.message, creados }, { status: 500 })
    }

    const r = Array.isArray(cierre) ? cierre[0] : cierre
    return NextResponse.json({
      ok: true,
      creados,
      retirados: r?.retirados ?? 0,
      sin_lote:  r?.sin_lote ?? 0,
    })
  } catch (err) {
    console.error('POST /api/sig/nucleacion error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
