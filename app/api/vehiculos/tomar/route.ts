import { NextRequest, NextResponse } from 'next/server'
import { exigirConductor, fleet } from '@/lib/vehiculos/sesion'
import { fechaBogota } from '@/lib/vehiculos/horas'

/**
 * POST /api/vehiculos/tomar { vehiculoId } — lo que pasa al leer el QR pegado en el vehículo.
 *
 * - Si tengo ese vehículo tomado y sin devolver → toca la devolución.
 * - Si tengo una reserva de hoy de ese vehículo sin tomar → queda registrada YA la hora en
 *   que lo tomé (tomado_at) y sigue la recepción.
 * - Si no tengo reserva → se dice, y la pantalla ofrece reservarlo desde ahora.
 */
export async function POST(req: NextRequest) {
  const s = await exigirConductor()
  if (!s.ok) return s.respuesta
  const b = await req.json().catch(() => null)
  const vehiculoId = String(b?.vehiculoId ?? '')

  const db = fleet()
  const { data: vehiculo } = await db.from('vehiculos').select('id, nombre').eq('id', vehiculoId).maybeSingle()
  if (!vehiculo) return NextResponse.json({ error: 'Ese QR no corresponde a ningún vehículo.' }, { status: 404 })

  const campos = 'id, vehicle_id, start_at, end_at, purpose, tomado_at, devuelto_at'

  // ¿Lo tengo en la mano?
  const { data: enUso } = await db
    .from('vehicle_reservations')
    .select(campos)
    .eq('conductor_id', s.yo.id)
    .eq('vehicle_id', vehiculoId)
    .not('tomado_at', 'is', null)
    .is('devuelto_at', null)
    .order('tomado_at', { ascending: false })
    .limit(1)
  if (enUso?.length) return NextResponse.json({ accion: 'devolucion', vehiculo, reserva: enUso[0] })

  // ¿Tengo una reserva de hoy sin tomar?
  const hoy = fechaBogota(new Date())
  const { data: mias } = await db
    .from('vehicle_reservations')
    .select(campos)
    .eq('conductor_id', s.yo.id)
    .eq('vehicle_id', vehiculoId)
    .is('tomado_at', null)
    .gt('end_at', new Date().toISOString())
    .order('start_at')
  const deHoy = (mias ?? []).find((r) => fechaBogota(r.start_at) <= hoy)
  if (!deHoy) return NextResponse.json({ accion: 'sin-reserva', vehiculo })

  const tomado = new Date().toISOString()
  const { error } = await db.from('vehicle_reservations').update({ tomado_at: tomado }).eq('id', deHoy.id).is('tomado_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accion: 'recepcion', vehiculo, reserva: { ...deHoy, tomado_at: tomado } })
}
