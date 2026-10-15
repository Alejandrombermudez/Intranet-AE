import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, esUuid, texto } from '@/lib/administrativa-api'

/**
 * Un movimiento del kardex.
 *
 *   GET   → el soporte que se tomó en campo (foto o PDF en base64), si tiene
 *   PATCH { accion: 'recibir' | 'rechazar' }        → un traslado en camino
 *         { accion: 'anular', motivo }               → un traslado o un ajuste hecho por error
 *
 * Las entradas se anulan anulando su factura; los consumos, editando o borrando
 * el registro de campo. Aquí no.
 */
type Contexto = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Contexto) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const { id } = await params
  if (!esUuid(id)) return NextResponse.json({ error: 'Movimiento no encontrado.' }, { status: 404 })
  const { data, error } = await supabase.schema('inventario').from('soportes')
    .select('nombre, tipo, contenido').eq('movimiento_id', id).order('created_at').limit(1).maybeSingle()
  if (error) return errorBase(error)
  if (!data) return NextResponse.json({ error: 'Este movimiento no tiene soporte.' }, { status: 404 })
  return NextResponse.json({ soporte: data })
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const { id } = await params
  if (!esUuid(id)) return NextResponse.json({ error: 'Movimiento no encontrado.' }, { status: 404 })
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const inv = supabase.schema('inventario')

  if (b?.accion === 'recibir' || b?.accion === 'rechazar') {
    const { data, error } = await inv.rpc('recibir_traslado', {
      p_id: id, p_aceptar: b.accion === 'recibir', p_usuario: sesion.perfil.email,
    })
    if (error) return errorBase(error)
    if (!data) return NextResponse.json({ error: 'Ese traslado ya no está en camino: alguien lo resolvió antes.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  }

  if (b?.accion === 'anular') {
    const motivo = texto(b.motivo)
    if (!motivo) return NextResponse.json({ error: 'Escribe por qué se anula.' }, { status: 400 })
    const { data, error } = await inv.rpc('anular_movimiento', { p_id: id, p_usuario: sesion.perfil.email, p_motivo: motivo })
    if (error) return errorBase(error)
    if (!data) return NextResponse.json({ error: 'Solo se anulan traslados y ajustes que no estén anulados.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
}
