import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'

/**
 * Lotes de siembra: el paso que cierra el ciclo SIG ↔ Campo.
 *
 * El técnico verifica las zonas en terreno (confirma, modifica, descarta o
 * agrega) y el SIG revisa lo que volvió. Cada zona que el SIG da por buena es
 * un LOTE — el pedazo de tierra donde se siembra — y sobre los lotes se sube
 * después la nucleación. Un predio puede quedar con 0, 1 o n lotes: campo bien
 * puede haberlas descartado todas.
 *
 * Un lote no es una tabla nueva: es `geo.zonas.estado = 'definitiva'`, un
 * estado que existía en el esquema desde el principio y que nadie usaba.
 *
 * La subida versionada del SIG, que antes también se llamaba "lote", pasó a
 * llamarse CARGA (`geo.zonas_carga`) justo para que esta palabra quedara libre
 * y significara una sola cosa. Ver docs/sql/migration_renombrar_carga.sql.
 */

export interface LoteSig {
  zona_id:    string
  nombre:     string | null
  /** 'definitiva' = ya es lote · 'validada'/'potencial' = candidata */
  estado:     string
  origen:     string
  area_ha:    number | null
  geojson:    string
  n_nucleos:  number
  ha_nucleos: number | null
  plantas:    number
}

const FALTA = 'Falta correr docs/sql/migration_nucleacion.sql en Supabase (lotes y nucleación).'
const noExiste = (err: { code?: string; message?: string } | null) =>
  !!err && (['PGRST202', 'PGRST205', '42P01', '42883'].includes(err.code ?? '')
    || /lotes_de_predio|confirmar_lotes|deshacer_lotes|nucleos/i.test(err.message ?? ''))

// GET /api/sig/lotes?predio_id=... — zonas del predio con su nucleación
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.intranet)
  if (!sesion.ok) return sesion.respuesta

  const predioId = req.nextUrl.searchParams.get('predio_id')
  if (!predioId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

  const { data, error } = await supabase.schema('geo').rpc('lotes_de_predio', { p_predio_id: predioId })
  if (error) {
    // Sin la migración corrida hay que DECIRLO. Devolver una lista vacía haría
    // que la pantalla afirmara "este predio no tiene zonas", que es falso y
    // manda al SIG a cargar de nuevo algo que ya está cargado.
    if (noExiste(error)) return NextResponse.json({ error: FALTA }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json((data ?? []) as LoteSig[])
}

// POST /api/sig/lotes — confirmar zonas como lotes de siembra
//   { predio_id, zona_ids: string[] }
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const sesion = await exigirSesion(req, supabase, PUEDE.procesoPredio)
    if (!sesion.ok) return sesion.respuesta

    const { predio_id, zona_ids } = await req.json()
    if (!predio_id) return NextResponse.json({ error: 'Falta el predio' }, { status: 400 })
    const ids: string[] = Array.isArray(zona_ids)
      ? zona_ids.filter((x: unknown): x is string => typeof x === 'string' && !!x)
      : []
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Marca al menos una zona para confirmarla como lote' }, { status: 400 })
    }

    const { data, error } = await supabase.schema('geo').rpc('confirmar_lotes', {
      p_predio_id: predio_id, p_zona_ids: ids, p_por: sesion.perfil.email,
    })
    if (error) {
      return NextResponse.json({ error: noExiste(error) ? FALTA : error.message }, { status: noExiste(error) ? 503 : 500 })
    }
    return NextResponse.json({ ok: true, confirmadas: data ?? 0 })
  } catch (err) {
    console.error('POST /api/sig/lotes error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// DELETE /api/sig/lotes?predio_id=...&zona_id=... — deshacer (vuelve a 'validada')
//   El RPC se niega si el lote ya tiene nucleación cargada, para no dejarla
//   colgando de una zona que dejó de ser lote.
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const sesion = await exigirSesion(req, supabase, PUEDE.procesoPredio)
    if (!sesion.ok) return sesion.respuesta

    const predioId = req.nextUrl.searchParams.get('predio_id')
    const zonaId   = req.nextUrl.searchParams.get('zona_id')
    if (!predioId) return NextResponse.json({ error: 'Falta el predio' }, { status: 400 })

    const { data, error } = await supabase.schema('geo').rpc('deshacer_lotes', {
      p_predio_id: predioId, p_zona_ids: zonaId ? [zonaId] : null,
    })
    if (error) {
      return NextResponse.json({ error: noExiste(error) ? FALTA : error.message }, { status: noExiste(error) ? 503 : 409 })
    }
    return NextResponse.json({ ok: true, deshechas: data ?? 0 })
  } catch (err) {
    console.error('DELETE /api/sig/lotes error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
