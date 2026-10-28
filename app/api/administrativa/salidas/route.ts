import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, esUuid, texto, faltaSalidas } from '@/lib/administrativa-api'
import { hoyColombia } from '@/lib/administrativa'
import { AVISO_MIGRACION_SALIDAS, ESTADOS_PENDIENTES } from '@/lib/salidas'

/**
 * Salidas a campo (inventario.salidas).
 *
 *   GET  → todas, con cuántos elementos siguen sin explicar, cuántas actas tienen
 *          y cuántas faltan por firmar
 *   POST { nombre, proyecto?, predio_ids?, responsable_id?, bodega_retorno_id?,
 *          fecha_salida?, notas?, titulo_ids? }
 *        → inventario.crear_salida: crea la salida y su bodega, y la suma a los
 *          títulos de la app de campo que se elijan
 */
export async function GET(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const inv = supabase.schema('inventario')

  const { data: salidas, error } = await inv.from('salidas')
    .select('id, nombre, proyecto, predio_ids, responsable_id, bodega_id, bodega_retorno_id, fecha_salida, fecha_cierre, estado, notas, creado_por, cerrado_por')
    .order('fecha_salida', { ascending: false })
  if (error) {
    if (faltaSalidas(error)) return NextResponse.json({ salidas: [], faltaMigracion: true, aviso: AVISO_MIGRACION_SALIDAS })
    return errorBase(error)
  }

  const [filas, actas] = await Promise.all([
    inv.from('v_conciliacion_salida').select('salida_id, estado'),
    inv.from('actas').select('salida_id, firmada'),
  ])
  const porSalida = new Map<string, { elementos: number; pendientes: number; actas: number; sinFirma: number }>()
  const de = (id: string) => {
    let v = porSalida.get(id)
    if (!v) { v = { elementos: 0, pendientes: 0, actas: 0, sinFirma: 0 }; porSalida.set(id, v) }
    return v
  }
  for (const f of filas.data ?? []) {
    const v = de(f.salida_id as string)
    v.elementos++
    if ((ESTADOS_PENDIENTES as string[]).includes(f.estado as string)) v.pendientes++
  }
  for (const a of actas.data ?? []) {
    const v = de(a.salida_id as string)
    v.actas++
    if (!a.firmada) v.sinFirma++
  }

  return NextResponse.json({
    salidas: (salidas ?? []).map((s) => {
      const v = porSalida.get(s.id) ?? { elementos: 0, pendientes: 0, actas: 0, sinFirma: 0 }
      return { ...s, n_elementos: v.elementos, pendientes: v.pendientes, n_actas: v.actas, n_sin_firma: v.sinFirma }
    }),
  })
}

export async function POST(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const nombre = texto(b?.nombre)
  if (!b || !nombre) return NextResponse.json({ error: 'Ponle un nombre a la salida.' }, { status: 400 })

  const fecha = typeof b.fecha_salida === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.fecha_salida) ? b.fecha_salida : hoyColombia()
  const uuids = (v: unknown) => (Array.isArray(v) ? v.filter(esUuid) : [])

  const { data, error } = await supabase.schema('inventario').rpc('crear_salida', {
    p_nombre: nombre,
    p_proyecto: texto(b.proyecto),
    p_predio_ids: uuids(b.predio_ids),
    p_responsable: esUuid(b.responsable_id) ? b.responsable_id : null,
    p_bodega_retorno: esUuid(b.bodega_retorno_id) ? b.bodega_retorno_id : null,
    p_fecha: fecha,
    p_notas: texto(b.notas),
    p_titulo_ids: uuids(b.titulo_ids),
    p_usuario: sesion.perfil.email,
  })
  if (error) {
    if (faltaSalidas(error)) return NextResponse.json({ error: AVISO_MIGRACION_SALIDAS, faltaMigracion: true }, { status: 503 })
    return errorBase(error)
  }
  return NextResponse.json({ id: data }, { status: 201 })
}
