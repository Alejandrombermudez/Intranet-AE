import { NextRequest, NextResponse } from 'next/server'
import { exigirConductor, fleet } from '@/lib/vehiculos/sesion'
import { aInstante, fechaBogota } from '@/lib/vehiculos/horas'
import { crearReserva, enManosDeOtro } from '@/lib/vehiculos/reservar'

const HORA = /^\d{2}:\d{2}$/
const FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * POST /api/vehiculos/tomar { vehiculoId, hasta?: {fecha, hora}, actividad? }
 * Lo que pasa al elegir el vehículo en «Recepción» o al leer su QR.
 *
 * - Si tengo ese vehículo tomado y sin devolver → toca la devolución.
 * - Si alguien más lo tiene sin devolver → no se puede.
 * - Si tengo una reserva de hoy sin tomar → queda registrada YA la hora (tomado_at) y sigue la recepción.
 * - Si no tengo reserva → «sin-reserva»; si además llegan `hasta` y `actividad`, se reserva desde
 *   ahora hasta esa hora y se toma de una vez.
 */
export async function POST(req: NextRequest) {
  const s = await exigirConductor()
  if (!s.ok) return s.respuesta
  const b = await req.json().catch(() => null)
  const vehiculoId = String(b?.vehiculoId ?? '')

  const db = fleet()
  const { data: vehiculo } = await db.from('vehiculos').select('id, nombre').eq('id', vehiculoId).eq('activo', true).maybeSingle()
  if (!vehiculo) return NextResponse.json({ error: 'Ese QR no corresponde a ningún vehículo.' }, { status: 404 })

  const campos = 'id, vehicle_id, start_at, end_at, purpose, tomado_at, devuelto_at'

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

  const otro = await enManosDeOtro(vehiculoId, s.yo.id)
  if (otro) return NextResponse.json({ error: `${vehiculo.nombre} lo tiene ${otro} y todavía no lo ha devuelto.` }, { status: 409 })

  const hoy = fechaBogota(new Date())
  const { data: mias } = await db
    .from('vehicle_reservations')
    .select(campos)
    .eq('conductor_id', s.yo.id)
    .eq('vehicle_id', vehiculoId)
    .is('tomado_at', null)
    .gt('end_at', new Date().toISOString())
    .order('start_at')
  let reserva = (mias ?? []).find((r) => fechaBogota(r.start_at) <= hoy)

  if (!reserva) {
    const hasta = b?.hasta
    if (!hasta || !FECHA.test(hasta.fecha ?? '') || !HORA.test(hasta.hora ?? '')) {
      return NextResponse.json({ accion: 'sin-reserva', vehiculo })
    }
    // Reservar desde ahora (redondeado al cuarto de hora anterior) hasta la hora que dijo.
    const ahora = new Date()
    const ini = new Date(Math.floor(ahora.getTime() / 900000) * 900000)
    const r = await crearReserva(s.yo, { vehicleId: vehiculoId, ini, fin: aInstante(hasta.fecha, hasta.hora), actividad: String(b?.actividad ?? '') })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    const { data: nueva } = await db.from('vehicle_reservations').select(campos).eq('id', r.id).single()
    reserva = nueva!
  }

  const tomado = new Date().toISOString()
  const { error } = await db.from('vehicle_reservations').update({ tomado_at: tomado }).eq('id', reserva.id).is('tomado_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accion: 'recepcion', vehiculo, reserva: { ...reserva, tomado_at: tomado } })
}
