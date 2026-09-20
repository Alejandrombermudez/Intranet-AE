import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'

/**
 * Unidades de siembra: varios predios que comparten UN polígono del SIG.
 *
 * Fusionar aquí es AGRUPAR, no fundir registros — cada predio conserva su
 * matrícula, su dueño y su expediente jurídico. Lo que se comparte es la
 * cartografía: el polígono total se sube contra el predio principal de la
 * unidad. Modelo y razones en docs/sql/migration_predio_grupos.sql.
 */

export interface GrupoSig {
  grupo_id:             string
  nombre:               string
  predio_principal_id:  string
  predio_principal:     string | null
  nota:                 string | null
  n_predios:            number
  predio_ids:           string[]
  /** Más de uno = la unidad cruza municipios o dueños; la UI lo advierte. */
  n_municipios:         number
  n_propietarios:       number
  area_registral_total: number | null
  created_by:           string | null
  created_at:           string
}

const FALTA_MIGRACION =
  'Falta correr docs/sql/migration_predio_grupos.sql en Supabase (unidades de siembra). No se fusionó nada.'

/** ¿El error es "esto todavía no existe en la base" y no un fallo real? */
function esMigracionPendiente(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  return ['PGRST202', 'PGRST205', '42P01', '42883'].includes(err.code ?? '')
    || /predio_grupos|fusionar_predios|disolver_grupo/i.test(err.message ?? '')
}

/** Un predio de la unidad, con lo que hace falta para nombrarlo en pantalla. */
export interface MiembroUnidad {
  predio_id:              string
  nombre_predio:          string | null
  municipio:              string
  vereda:                 string | null
  matricula_inmobiliaria: string | null
  area_registral:         number | null
  propietario:            string
  es_principal:           boolean
}

/** Respuesta de `?predio_id=…`: la unidad de ese predio, o null si está suelto. */
export interface UnidadDePredio extends GrupoSig {
  miembros: MiembroUnidad[]
}

// GET /api/sig/grupos            — unidades vigentes
// GET /api/sig/grupos?predio_id= — la unidad de ese predio (con sus miembros) o null
//   (Authorization: Bearer <token>)
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.intranet)
  if (!sesion.ok) return sesion.respuesta

  const predioId = req.nextUrl.searchParams.get('predio_id')

  const { data, error } = await supabase
    .schema('core').from('v_predio_grupos').select('*')

  // Sin la migración corrida el tablero tiene que seguir funcionando igual que
  // antes: sin unidades, no con un error en pantalla.
  if (error) {
    if (esMigracionPendiente(error)) return NextResponse.json(predioId ? null : [])
    console.error('GET /api/sig/grupos error:', error)
    return NextResponse.json({ error: 'Error al leer las unidades de siembra' }, { status: 500 })
  }

  const grupos = (data ?? []) as GrupoSig[]
  if (!predioId) return NextResponse.json(grupos)

  const grupo = grupos.find(g => (g.predio_ids ?? []).includes(predioId))
  if (!grupo) return NextResponse.json(null)

  // Los miembros con nombre: el predio lleva al propietario por aliado_id, que
  // es la llave (core no duplica el nombre en el predio).
  const { data: predios } = await supabase
    .schema('core').from('predios')
    .select('id, nombre_predio, municipio, vereda, matricula_inmobiliaria, area_registral, aliado_id')
    .in('id', grupo.predio_ids)

  const aliadoIds = [...new Set((predios ?? []).map(p => p.aliado_id))]
  const { data: aliados } = aliadoIds.length
    ? await supabase.schema('core').from('aliados').select('id, nombre_completo').in('id', aliadoIds)
    : { data: [] }
  const nombreDe = new Map((aliados ?? []).map(a => [a.id, a.nombre_completo as string]))

  const miembros: MiembroUnidad[] = (predios ?? []).map(p => ({
    predio_id:              p.id,
    nombre_predio:          p.nombre_predio ?? null,
    municipio:              p.municipio,
    vereda:                 p.vereda ?? null,
    matricula_inmobiliaria: p.matricula_inmobiliaria ?? null,
    area_registral:         p.area_registral ?? null,
    propietario:            nombreDe.get(p.aliado_id) ?? '—',
    es_principal:           p.id === grupo.predio_principal_id,
  })).sort((a, b) => Number(b.es_principal) - Number(a.es_principal))

  return NextResponse.json({ ...grupo, miembros } as UnidadDePredio)
}

// POST /api/sig/grupos — fusionar predios en una unidad de siembra
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const sesion = await exigirSesion(req, supabase, PUEDE.procesoPredio)
    if (!sesion.ok) return sesion.respuesta

    const body = await req.json()
    const ids: string[] = Array.isArray(body?.predio_ids)
      ? [...new Set<string>(body.predio_ids.filter((x: unknown): x is string => typeof x === 'string' && !!x))]
      : []
    const principal: string | null = typeof body?.predio_principal_id === 'string' ? body.predio_principal_id : null

    if (ids.length < 2) {
      return NextResponse.json({ error: 'Selecciona al menos dos predios para fusionar' }, { status: 400 })
    }
    if (!principal || !ids.includes(principal)) {
      return NextResponse.json({ error: 'Elige cuál de los predios seleccionados lleva la cartografía' }, { status: 400 })
    }

    // La base vuelve a validar (predios existentes, ninguno en otra unidad):
    // es la única barrera que no se puede saltar desde el navegador.
    const { data: grupoId, error } = await supabase.schema('core').rpc('fusionar_predios', {
      p_predio_ids: ids,
      p_principal:  principal,
      p_nombre:     typeof body?.nombre === 'string' ? body.nombre : null,
      p_nota:       typeof body?.nota === 'string' ? body.nota : null,
      p_created_by: sesion.perfil.email,
    })

    if (error) {
      if (esMigracionPendiente(error)) return NextResponse.json({ error: FALTA_MIGRACION }, { status: 503 })
      // Los RAISE del RPC ya están escritos para leerse (qué predio, en qué unidad)
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    return NextResponse.json({ ok: true, grupo_id: grupoId, n_predios: ids.length }, { status: 201 })
  } catch (err) {
    console.error('POST /api/sig/grupos error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
