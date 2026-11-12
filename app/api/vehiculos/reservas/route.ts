import { NextRequest, NextResponse } from 'next/server'
import { exigirConductor, fleet } from '@/lib/vehiculos/sesion'
import { aInstante, sumarDias } from '@/lib/vehiculos/horas'
import { crearReserva } from '@/lib/vehiculos/reservar'

export const dynamic = 'force-dynamic'

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const HORA = /^\d{2}:\d{2}$/

/** GET /api/vehiculos/reservas?desde=&hasta= — el calendario. Solo nombre, vehículo, horas y motivo. */
export async function GET(req: NextRequest) {
  const s = await exigirConductor()
  if (!s.ok) return s.respuesta
  const desde = req.nextUrl.searchParams.get('desde') ?? ''
  const hasta = req.nextUrl.searchParams.get('hasta') ?? ''
  if (!FECHA.test(desde) || !FECHA.test(hasta)) {
    return NextResponse.json({ error: 'desde y hasta (AAAA-MM-DD) son obligatorios' }, { status: 400 })
  }
  const { data, error } = await fleet()
    .from('vehicle_reservations')
    .select('id, vehicle_id, user_name, conductor_id, start_at, end_at, purpose')
    .lt('start_at', aInstante(sumarDias(hasta, 1), '00:00').toISOString())
    .gt('end_at', aInstante(desde, '00:00').toISOString())
    .order('start_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    reservas: (data ?? []).map((r) => ({
      id: r.id, vehicle_id: r.vehicle_id, nombre: r.user_name, conductor_id: r.conductor_id,
      start_at: r.start_at, end_at: r.end_at, motivo: r.purpose,
    })),
  })
}

/** POST /api/vehiculos/reservas — reservar un vehículo por horas (reglas en lib/vehiculos/reservar.ts). */
export async function POST(req: NextRequest) {
  const s = await exigirConductor()
  if (!s.ok) return s.respuesta
  const b = await req.json().catch(() => null)
  if (!FECHA.test(b?.fechaInicio ?? '') || !HORA.test(b?.horaInicio ?? '') || !FECHA.test(b?.fechaFin ?? '') || !HORA.test(b?.horaFin ?? '')) {
    return NextResponse.json({ error: 'Faltan las fechas y horas.' }, { status: 400 })
  }
  const r = await crearReserva(s.yo, {
    vehicleId: String(b?.vehicleId ?? ''),
    ini: aInstante(b.fechaInicio, b.horaInicio),
    fin: aInstante(b.fechaFin, b.horaFin),
    actividad: String(b?.actividad ?? ''),
    proyecto: String(b?.proyecto ?? '').trim().slice(0, 50),
  })
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ id: r.id })
}

/** DELETE /api/vehiculos/reservas?id= — cancelar: la propia (o cualquiera, administración) y solo si no se ha tomado. */
export async function DELETE(req: NextRequest) {
  const s = await exigirConductor()
  if (!s.ok) return s.respuesta
  const id = req.nextUrl.searchParams.get('id') ?? ''
  const db = fleet()
  const { data: r } = await db.from('vehicle_reservations').select('id, conductor_id, tomado_at').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'No encontré la reserva.' }, { status: 404 })
  if (r.conductor_id !== s.yo.id && !s.yo.es_admin) return NextResponse.json({ error: 'Esa reserva no es tuya.' }, { status: 403 })
  if (r.tomado_at && !s.yo.es_admin) return NextResponse.json({ error: 'El vehículo ya se tomó; no se puede cancelar. Haz la devolución.' }, { status: 409 })
  const { error } = await db.from('vehicle_reservations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
