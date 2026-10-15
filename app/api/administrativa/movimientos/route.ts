import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, esUuid, numeroValido, texto, faltaMigracion, AVISO_MIGRACION } from '@/lib/administrativa-api'
import { hoyColombia } from '@/lib/administrativa'

/**
 * Kardex (inventario.movimientos).
 *
 *   GET  ?bodega=<id>&insumo=<id>&tipo=<tipo>&estado=<estado>&desde=&hasta=
 *        → los 1500 movimientos más recientes que cumplen el filtro, con si
 *          tienen soporte de campo
 *   POST { accion: 'trasladar', origen_id, destino_id, items: [{insumo_id, cantidad}],
 *          fecha?, notas?, entregado? }
 *        → inventario.trasladar: un movimiento por insumo; en camino hasta que la
 *          bodega destino lo acepte, salvo `entregado: true` (lo que ya llegó)
 *        { accion: 'ajustar', bodega_id, insumo_id, cantidad, sentido: 'entra'|'sale',
 *          fecha?, notas }
 *        → un ajuste de conteo físico (sobrante entra, faltante sale)
 */
export async function GET(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const p = req.nextUrl.searchParams

  let q = supabase.schema('inventario').from('movimientos')
    .select(`id, tipo, insumo_id, cantidad, origen_id, destino_id, estado, fecha, costo_unitario, documento, notas,
             creado_por, recibido_por, recibido_at, motivo_anulacion, factura_item_id, registro_id, created_at,
             soportes(id)`)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1500)
  const bodega = p.get('bodega'), insumo = p.get('insumo'), tipo = p.get('tipo'), estado = p.get('estado')
  if (esUuid(bodega)) q = q.or(`origen_id.eq.${bodega},destino_id.eq.${bodega}`)
  if (esUuid(insumo)) q = q.eq('insumo_id', insumo)
  if (tipo && ['entrada', 'traslado', 'consumo', 'ajuste'].includes(tipo)) q = q.eq('tipo', tipo)
  if (estado && ['confirmado', 'en_transito', 'rechazado', 'anulado'].includes(estado)) q = q.eq('estado', estado)
  const desde = p.get('desde'), hasta = p.get('hasta')
  if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) q = q.gte('fecha', desde)
  if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) q = q.lte('fecha', hasta)

  const { data, error } = await q
  if (error) {
    if (faltaMigracion(error)) return NextResponse.json({ movimientos: [], faltaMigracion: true, aviso: AVISO_MIGRACION })
    return errorBase(error)
  }
  return NextResponse.json({
    movimientos: (data ?? []).map(({ soportes, ...m }) => ({ ...m, tiene_soporte: (soportes ?? []).length > 0 })),
  })
}

export async function POST(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  // Sin fecha, la de hoy en Colombia: CURRENT_DATE en la base es UTC y después de las 7 p. m. ya es mañana.
  const fecha = typeof b?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.fecha) ? b.fecha : hoyColombia()

  if (b?.accion === 'trasladar') {
    if (!esUuid(b.origen_id) || !esUuid(b.destino_id)) return NextResponse.json({ error: 'Elige la bodega de origen y la de destino.' }, { status: 400 })
    const items = Array.isArray(b.items)
      ? (b.items as Record<string, unknown>[])
          .map((i) => ({ insumo_id: i.insumo_id, cantidad: numeroValido(i.cantidad) }))
          .filter((i) => esUuid(i.insumo_id) && i.cantidad && i.cantidad > 0)
      : []
    if (!items.length) return NextResponse.json({ error: 'Agrega al menos un insumo con su cantidad.' }, { status: 400 })

    const { data, error } = await supabase.schema('inventario').rpc('trasladar', {
      p_origen: b.origen_id, p_destino: b.destino_id, p_items: items, p_fecha: fecha,
      p_notas: texto(b.notas), p_usuario: sesion.perfil.email, p_entregado: b.entregado === true,
    })
    if (error) return errorBase(error)
    return NextResponse.json({ ids: data }, { status: 201 })
  }

  if (b?.accion === 'ajustar') {
    const cantidad = numeroValido(b.cantidad)
    if (!esUuid(b.bodega_id) || !esUuid(b.insumo_id) || !cantidad || cantidad <= 0) {
      return NextResponse.json({ error: 'Elige la bodega, el insumo y una cantidad mayor que cero.' }, { status: 400 })
    }
    const notas = texto(b.notas)
    if (!notas) return NextResponse.json({ error: 'Escribe por qué se ajusta (conteo físico, daño, pérdida…).' }, { status: 400 })
    const entra = b.sentido === 'entra'
    const { data, error } = await supabase.schema('inventario').from('movimientos')
      .insert({
        tipo: 'ajuste', insumo_id: b.insumo_id, cantidad,
        origen_id: entra ? null : b.bodega_id, destino_id: entra ? b.bodega_id : null,
        estado: 'confirmado', fecha, notas, documento: 'Ajuste de inventario',
        creado_por: sesion.perfil.email,
      })
      .select('id').single()
    if (error) return errorBase(error)
    return NextResponse.json({ id: data.id }, { status: 201 })
  }

  return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
}
