import { NextRequest, NextResponse } from 'next/server'
import { exigirConductor, fleet } from '@/lib/vehiculos/sesion'
import { aInstante, diaSemanaBogota, diasDelRango, fechaBogota, sumarDias } from '@/lib/vehiculos/horas'
import { FOTON_ID, unirMotivo } from '@/lib/vehiculos/cliente'

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

/** POST /api/vehiculos/reservas — reservar un vehículo por horas. */
export async function POST(req: NextRequest) {
  const s = await exigirConductor()
  if (!s.ok) return s.respuesta
  const yo = s.yo

  const b = await req.json().catch(() => null)
  const db = fleet()
  const { data: vehiculo } = await db.from('vehiculos').select('id, nombre').eq('id', String(b?.vehicleId ?? '')).eq('activo', true).maybeSingle()
  if (!vehiculo) return NextResponse.json({ error: 'Elige un vehículo.' }, { status: 400 })
  if (!FECHA.test(b?.fechaInicio ?? '') || !HORA.test(b?.horaInicio ?? '') || !FECHA.test(b?.fechaFin ?? '') || !HORA.test(b?.horaFin ?? '')) {
    return NextResponse.json({ error: 'Faltan las fechas y horas.' }, { status: 400 })
  }
  const actividad = String(b?.actividad ?? '').trim().slice(0, 100)
  const proyecto = String(b?.proyecto ?? '').trim().slice(0, 50)
  if (!actividad) return NextResponse.json({ error: 'Cuéntanos la actividad.' }, { status: 400 })

  const ini = aInstante(b.fechaInicio, b.horaInicio)
  const fin = aInstante(b.fechaFin, b.horaFin)
  if (isNaN(ini.getTime()) || isNaN(fin.getTime())) return NextResponse.json({ error: 'Fecha u hora inválida.' }, { status: 400 })
  if (fin <= ini) return NextResponse.json({ error: 'La hora de regreso tiene que ser después de la de salida.' }, { status: 400 })
  if (fin <= new Date()) return NextResponse.json({ error: 'Ese horario ya pasó.' }, { status: 400 })

  // La Foton es de uso interno los lunes y martes (regla que ya tenía la intranet).
  if (vehiculo.id === FOTON_ID && diasDelRango(ini, fin).some((d) => [1, 2].includes(diaSemanaBogota(aInstante(d, '12:00'))))) {
    return NextResponse.json({ error: 'La Foton no se reserva los lunes ni los martes (uso interno).' }, { status: 409 })
  }

  const { data: choques, error: eChoque } = await db
    .from('vehicle_reservations')
    .select('user_name')
    .eq('vehicle_id', vehiculo.id)
    .lt('start_at', fin.toISOString())
    .gt('end_at', ini.toISOString())
    .limit(1)
  if (eChoque) return NextResponse.json({ error: eChoque.message }, { status: 500 })
  if (choques?.length) return NextResponse.json({ error: `Ese horario se cruza con una reserva de ${choques[0].user_name}.` }, { status: 409 })

  const { data, error } = await db
    .from('vehicle_reservations')
    .insert({
      vehicle_id: vehiculo.id,
      vehicle_name: vehiculo.nombre,
      user_name: yo.nombre,
      user_email: yo.email ?? '',
      conductor_id: yo.id,
      start_date: fechaBogota(ini),
      end_date: fechaBogota(new Date(fin.getTime() - 1)),
      start_at: ini.toISOString(),
      end_at: fin.toISOString(),
      purpose: unirMotivo(proyecto, actividad),
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
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
