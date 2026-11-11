import { NextResponse } from 'next/server'
import { exigirConductor, fleet } from '@/lib/vehiculos/sesion'

export const dynamic = 'force-dynamic'

/** GET /api/vehiculos/mis-reservas — mis reservas vigentes, las sin devolver y las de la última semana. */
export async function GET() {
  const s = await exigirConductor()
  if (!s.ok) return s.respuesta
  const db = fleet()
  const desde = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data: reservas, error } = await db
    .from('vehicle_reservations')
    .select('id, vehicle_id, start_at, end_at, purpose, tomado_at, devuelto_at')
    .eq('conductor_id', s.yo.id)
    .or(`end_at.gt.${desde},and(tomado_at.not.is.null,devuelto_at.is.null)`)
    .order('start_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (reservas ?? []).map((r) => r.id)
  const hechas = new Set<string>()
  if (ids.length) {
    const { data: insp } = await db
      .from('vehicle_inspections')
      .select('reservation_id, inspection_type')
      .in('reservation_id', ids)
      .not('submitted_at', 'is', null)
    for (const i of insp ?? []) hechas.add(`${i.reservation_id}:${i.inspection_type}`)
  }

  return NextResponse.json({
    reservas: (reservas ?? []).map((r) => ({
      id: r.id, vehicle_id: r.vehicle_id, start_at: r.start_at, end_at: r.end_at, motivo: r.purpose,
      tomado_at: r.tomado_at, devuelto_at: r.devuelto_at,
      checkInHecho: hechas.has(`${r.id}:recepcion`),
      checkOutHecho: hechas.has(`${r.id}:devolucion`),
    })),
  })
}
