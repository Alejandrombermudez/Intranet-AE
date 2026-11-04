import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, esUuid, numeroValido, texto, faltaSalidas } from '@/lib/administrativa-api'
import { hoyColombia } from '@/lib/administrativa'
import { AVISO_MIGRACION_SALIDAS, MOTIVOS, TIPOS_ACTA, normalizarFila, nombreTrabajador, type Motivo, type TipoActa } from '@/lib/salidas'

/**
 * Una salida a campo.
 *
 *   GET   → la salida, su conciliación calculada (inventario.v_conciliacion_salida),
 *           sus actas, las devoluciones que faltan por contar, lo que tiene a cargo
 *           cada trabajador, el kardex de su bodega y los datos de la organización
 *           para el PDF de las actas
 *   PATCH { responsable_id?, bodega_retorno_id?, proyecto?, notas? }   → completa los datos de la salida
 *   POST  { accion: 'acta', tipo, fecha, bodega_otra_id?, trabajador_id?, items: [{insumo_id, cantidad}], notas?, recibido? }
 *         { accion: 'recibir', movimiento_id, cantidad }          → recibe una devolución CONTANDO
 *         { accion: 'justificar', insumo_id, cantidad, motivo, nota, trabajador_id?, fecha? }
 *         { accion: 'cerrar', fecha?, confirmar_sin_firma? }      → no cierra con diferencias sin explicar
 */
type Contexto = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Contexto) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const { id } = await params
  if (!esUuid(id)) return NextResponse.json({ error: 'Salida no encontrada.' }, { status: 404 })
  const inv = supabase.schema('inventario')

  const { data: salida, error } = await inv.from('salidas').select('*').eq('id', id).maybeSingle()
  if (error) {
    if (faltaSalidas(error)) return NextResponse.json({ error: AVISO_MIGRACION_SALIDAS, faltaMigracion: true }, { status: 503 })
    return errorBase(error)
  }
  if (!salida) return NextResponse.json({ error: 'Salida no encontrada.' }, { status: 404 })

  const [filas, actas, movs, trabajadores, org] = await Promise.all([
    inv.from('v_conciliacion_salida').select('*').eq('salida_id', id),
    inv.from('actas').select('id, numero, tipo, salida_id, trabajador_id, fecha, datos, archivo, firmada, firmada_at, notas, creado_por, created_at')
      .eq('salida_id', id).order('fecha').order('numero'),
    inv.from('movimientos')
      .select('id, tipo, insumo_id, cantidad, origen_id, destino_id, estado, fecha, documento, notas, creado_por, recibido_por, motivo, trabajador_id, acta_id, motivo_anulacion, created_at')
      .or(`origen_id.eq.${salida.bodega_id},destino_id.eq.${salida.bodega_id}`)
      .order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(600),
    supabase.schema('people').from('trabajadores_campo').select('id, nombres, apellidos'),
    supabase.schema('people').from('config_talento').select('razon_social, nit, direccion, ciudad, telefono, correo').eq('id', 1).maybeSingle(),
  ])
  for (const r of [filas, actas, movs, trabajadores]) if (r.error) return errorBase(r.error)

  const nombres = new Map((trabajadores.data ?? []).map((t) => [t.id as string, nombreTrabajador(t)]))
  const movimientos = movs.data ?? []

  // Observación de cada fila: las explicaciones que se escribieron al justificar.
  const notas = new Map<string, string[]>()
  for (const m of movimientos) {
    if (!m.motivo || m.estado === 'anulado' || !m.notas) continue
    const quien = m.trabajador_id ? ` (${nombres.get(m.trabajador_id as string) ?? 'trabajador'})` : ''
    const lista = notas.get(m.insumo_id as string) ?? []
    lista.push(`${MOTIVOS[m.motivo as Motivo]?.nombre ?? m.motivo}${quien}: ${m.notas}`)
    notas.set(m.insumo_id as string, lista)
  }
  const conciliacion = (filas.data ?? [])
    .map((f) => ({ ...normalizarFila(f), observacion: (notas.get(f.insumo_id as string) ?? []).join(' · ') || undefined }))
    .sort((a, b) => (a.categoria ?? '').localeCompare(b.categoria ?? '') || a.nombre.localeCompare(b.nombre))

  const enCamino = movimientos.filter((m) => m.origen_id === salida.bodega_id && m.estado === 'en_transito' && m.tipo === 'traslado')

  // Lo que esta salida dejó a cargo de cada trabajador (EPP, herramientas, dotación).
  const aCargo = new Map<string, Map<string, number>>()
  for (const m of movimientos) {
    if (m.origen_id !== salida.bodega_id || m.estado !== 'confirmado' || !m.trabajador_id || !m.motivo) continue
    const t = aCargo.get(m.trabajador_id as string) ?? new Map<string, number>()
    t.set(`${m.insumo_id}|${m.motivo}`, (t.get(`${m.insumo_id}|${m.motivo}`) ?? 0) + Number(m.cantidad))
    aCargo.set(m.trabajador_id as string, t)
  }

  return NextResponse.json({
    salida,
    conciliacion,
    actas: actas.data ?? [],
    en_camino: enCamino,
    a_cargo: [...aCargo.entries()].map(([trabajador_id, t]) => ({
      trabajador_id, nombre: nombres.get(trabajador_id) ?? 'Trabajador',
      items: [...t.entries()].map(([k, cantidad]) => { const [insumo_id, motivo] = k.split('|'); return { insumo_id, motivo, cantidad } }),
    })),
    movimientos,
    organizacion: org.data ?? {},
  })
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const { id } = await params
  if (!esUuid(id)) return NextResponse.json({ error: 'Salida no encontrada.' }, { status: 404 })
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  const inv = supabase.schema('inventario')
  const usuario = sesion.perfil.email
  const fecha = typeof b.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.fecha) ? b.fecha : hoyColombia()

  if (b.accion === 'acta') {
    const tipo = b.tipo as TipoActa
    if (!(tipo in TIPOS_ACTA)) return NextResponse.json({ error: 'Elige el tipo de acta.' }, { status: 400 })
    const items = Array.isArray(b.items)
      ? (b.items as Record<string, unknown>[])
          .map((i) => ({ insumo_id: i.insumo_id, cantidad: numeroValido(i.cantidad) }))
          .filter((i) => esUuid(i.insumo_id) && i.cantidad && i.cantidad > 0)
      : []
    if (!items.length) return NextResponse.json({ error: 'Agrega al menos un elemento con su cantidad.' }, { status: 400 })
    const { data, error } = await inv.rpc('registrar_acta', {
      p_salida: id, p_tipo: tipo, p_fecha: fecha,
      p_bodega_otra: esUuid(b.bodega_otra_id) ? b.bodega_otra_id : null,
      p_trabajador: esUuid(b.trabajador_id) ? b.trabajador_id : null,
      p_items: items, p_notas: texto(b.notas), p_usuario: usuario, p_recibido: b.recibido === true,
    })
    if (error) return errorBase(error)
    return NextResponse.json(data, { status: 201 })
  }

  if (b.accion === 'recibir') {
    const cantidad = numeroValido(b.cantidad)
    if (!esUuid(b.movimiento_id) || cantidad == null || cantidad < 0) return NextResponse.json({ error: 'Escribe cuánto contaste.' }, { status: 400 })
    const { data, error } = await inv.rpc('recibir_contando', { p_id: b.movimiento_id, p_cantidad: cantidad, p_usuario: usuario })
    if (error) return errorBase(error)
    if (!data) return NextResponse.json({ error: 'Esa devolución ya no está por recibir: alguien la resolvió antes.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  }

  if (b.accion === 'justificar') {
    const cantidad = numeroValido(b.cantidad)
    const motivo = b.motivo as Motivo
    if (!esUuid(b.insumo_id) || !cantidad || cantidad <= 0) return NextResponse.json({ error: 'Elige el elemento y una cantidad mayor que cero.' }, { status: 400 })
    if (!(motivo in MOTIVOS)) return NextResponse.json({ error: 'Elige un motivo de la lista.' }, { status: 400 })
    const nota = texto(b.nota)
    if (!nota) return NextResponse.json({ error: 'Escribe la explicación: ningún faltante queda sin justificar.' }, { status: 400 })
    const { data, error } = await inv.rpc('justificar', {
      p_salida: id, p_insumo: b.insumo_id, p_cantidad: cantidad, p_motivo: motivo, p_nota: nota,
      p_trabajador: esUuid(b.trabajador_id) ? b.trabajador_id : null, p_fecha: fecha, p_usuario: usuario,
    })
    if (error) return errorBase(error)
    return NextResponse.json({ id: data }, { status: 201 })
  }

  if (b.accion === 'cerrar') {
    // Las actas sin escaneo firmado no impiden cerrar, pero hay que decirlo y confirmarlo.
    const { count } = await inv.from('actas').select('id', { count: 'exact', head: true }).eq('salida_id', id).eq('firmada', false)
    if ((count ?? 0) > 0 && b.confirmar_sin_firma !== true) {
      return NextResponse.json({ error: `Hay ${count} acta(s) sin el escaneo firmado.`, sinFirma: count }, { status: 409 })
    }
    const { data, error } = await inv.rpc('cerrar_salida', { p_id: id, p_usuario: usuario, p_fecha: fecha })
    if (error) return errorBase(error)
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const { id } = await params
  if (!esUuid(id)) return NextResponse.json({ error: 'Salida no encontrada.' }, { status: 404 })
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  const inv = supabase.schema('inventario')

  const cambios: Record<string, unknown> = {}
  if ('responsable_id' in b) cambios.responsable_id = esUuid(b.responsable_id) ? b.responsable_id : null
  if ('bodega_retorno_id' in b) cambios.bodega_retorno_id = esUuid(b.bodega_retorno_id) ? b.bodega_retorno_id : null
  if ('proyecto' in b) cambios.proyecto = texto(b.proyecto)
  if ('notas' in b) cambios.notas = texto(b.notas)
  if (!Object.keys(cambios).length) return NextResponse.json({ error: 'No hay nada que cambiar.' }, { status: 400 })

  const { data, error } = await inv.from('salidas').update(cambios).eq('id', id).select('id, bodega_id').maybeSingle()
  if (error) return errorBase(error)
  if (!data) return NextResponse.json({ error: 'Salida no encontrada.' }, { status: 404 })

  // El responsable también se muestra en su bodega.
  if ('responsable_id' in cambios) {
    let nombre: string | null = null
    if (cambios.responsable_id) {
      const { data: t } = await supabase.schema('people').from('trabajadores_campo').select('nombres, apellidos').eq('id', cambios.responsable_id as string).maybeSingle()
      nombre = t ? nombreTrabajador(t) : null
    }
    await inv.from('bodegas').update({ responsable: nombre }).eq('id', data.bodega_id)
  }
  return NextResponse.json({ ok: true })
}
