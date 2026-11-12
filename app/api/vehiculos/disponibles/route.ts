import { NextResponse } from 'next/server'
import { enlaceFirmado, exigirConductor, fleet } from '@/lib/vehiculos/sesion'
import { fechaBogota } from '@/lib/vehiculos/horas'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vehiculos/disponibles — para «Recepción»: cada vehículo con su estado ahora mismo.
 *   mio        → tengo reserva de hoy sin tomar (se toma con esa reserva)
 *   libre      → nadie lo tiene ni lo reservó para este momento (libreHasta: la próxima reserva)
 *   reservado  → otra persona lo reservó para este momento
 *   ocupado    → otra persona lo tomó y no lo ha devuelto
 *   enUso      → lo tengo yo (toca devolverlo)
 * Y `miEnUso`: el vehículo que tengo ahora, para que el botón principal diga «Devolución».
 */
export async function GET() {
  const s = await exigirConductor()
  if (!s.ok) return s.respuesta
  const db = fleet()
  const ahora = new Date().toISOString()
  const hoy = fechaBogota(new Date())

  const [{ data: vehiculos }, { data: tomados }, { data: futuras }] = await Promise.all([
    db.from('vehiculos').select('id, nombre, corto, placa, tipo, color, foto_path, tarjeta_path').eq('activo', true).order('orden'),
    db.from('vehicle_reservations').select('id, vehicle_id, conductor_id, user_name, tomado_at, end_at, start_at, purpose, devuelto_at')
      .not('tomado_at', 'is', null).is('devuelto_at', null),
    db.from('vehicle_reservations').select('id, vehicle_id, conductor_id, user_name, start_at, end_at, tomado_at')
      .gt('end_at', ahora).is('tomado_at', null).order('start_at'),
  ])
  if (!vehiculos) return NextResponse.json({ error: 'No se pudieron leer los vehículos.' }, { status: 500 })

  const lista = await Promise.all(vehiculos.map(async (v) => {
    const base = { id: v.id, nombre: v.nombre, corto: v.corto, placa: v.placa, tipo: v.tipo, color: v.color, foto: await enlaceFirmado(v.foto_path) }
    const enMano = (tomados ?? []).find((r) => r.vehicle_id === v.id)
    if (enMano) {
      return enMano.conductor_id === s.yo.id
        ? { ...base, estado: 'enUso', desde: enMano.tomado_at }
        : { ...base, estado: 'ocupado', quien: enMano.user_name, desde: enMano.tomado_at }
    }
    const delVehiculo = (futuras ?? []).filter((r) => r.vehicle_id === v.id)
    const mia = delVehiculo.find((r) => r.conductor_id === s.yo.id && fechaBogota(r.start_at) <= hoy)
    if (mia) return { ...base, estado: 'mio', hasta: mia.end_at }
    const ahoraMismo = delVehiculo.find((r) => r.start_at <= ahora)
    if (ahoraMismo) return { ...base, estado: 'reservado', quien: ahoraMismo.user_name, hasta: ahoraMismo.end_at }
    const proxima = delVehiculo.find((r) => r.start_at > ahora)
    return { ...base, estado: 'libre', libreHasta: proxima?.start_at ?? null, proximo: proxima?.user_name ?? null }
  }))

  const mio = (tomados ?? []).find((r) => r.conductor_id === s.yo.id)
  const v = mio && vehiculos.find((x) => x.id === mio.vehicle_id)
  return NextResponse.json({
    vehiculos: lista,
    miEnUso: mio && v ? {
      reserva: { id: mio.id, vehicle_id: mio.vehicle_id, start_at: mio.start_at, end_at: mio.end_at, purpose: mio.purpose, tomado_at: mio.tomado_at, devuelto_at: null },
      vehiculo: { id: v.id, nombre: v.nombre, placa: v.placa, tarjeta: await enlaceFirmado(v.tarjeta_path) },
    } : null,
  })
}
