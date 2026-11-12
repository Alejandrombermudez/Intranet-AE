import { NextRequest, NextResponse } from 'next/server'
import { exigirConductor, fleet } from '@/lib/vehiculos/sesion'
import { CATEGORIAS } from '@/lib/vehiculos/inspeccion'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vehiculos/admin/registros?dias=30 — recepciones y devoluciones: quién tomó qué
 * vehículo, a qué hora lo tomó y lo devolvió, kilometraje, novedades y fotos de cada inspección.
 */
export async function GET(req: NextRequest) {
  const s = await exigirConductor(true)
  if (!s.ok) return s.respuesta
  const dias = Math.min(Math.max(Number(req.nextUrl.searchParams.get('dias')) || 30, 1), 365)
  const desde = new Date(Date.now() - dias * 86400000).toISOString()

  const db = fleet()
  const { data: reservas, error } = await db
    .from('vehicle_reservations')
    .select('id, vehicle_id, user_name, start_at, end_at, purpose, tomado_at, devuelto_at')
    .gt('end_at', desde)
    .lt('start_at', new Date(Date.now() + 86400000).toISOString())
    .order('start_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (reservas ?? []).map((r) => r.id)
  const porReserva: Record<string, unknown[]> = {}
  if (ids.length) {
    const { data: insp } = await db
      .from('vehicle_inspections')
      .select('*')
      .in('reservation_id', ids)
      .not('submitted_at', 'is', null)
    for (const i of insp ?? []) {
      const novedades = CATEGORIAS.flatMap((c) => i[`${c.clave}_status`] === 'issues'
        ? [...((i[`${c.clave}_issues`] as string[]) ?? []), ...(i[`${c.clave}_other`] ? [String(i[`${c.clave}_other`])] : [])].map((t) => `${c.grupo}: ${t}`)
        : [])
      const fotos = ['frontal', 'posterior', 'lateral_izq', 'lateral_der', 'tablero'].map((k) => i[`photo_${k}`]).filter(Boolean)
      ;(porReserva[i.reservation_id] ??= []).push({ tipo: i.inspection_type, cuando: i.submitted_at, km: i.kilometraje, novedades, fotos })
    }
  }

  return NextResponse.json({
    registros: (reservas ?? []).map((r) => ({ ...r, inspecciones: porReserva[r.id] ?? [] })),
  })
}
