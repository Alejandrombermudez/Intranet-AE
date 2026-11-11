import { NextRequest, NextResponse } from 'next/server'
import { BUCKET_INSPECCION, exigirConductor, fleet, storage } from '@/lib/vehiculos/sesion'
import { CATEGORIAS, FOTOS, type ClaveCategoria } from '@/lib/vehiculos/inspeccion'
import { fechaBogota } from '@/lib/vehiculos/horas'

const MAX_POR_TIPO = 2 // inspecciones completas con fotos que se conservan por vehículo y tipo (como antes)

function rutaEnBucket(url: string | null | undefined): string | null {
  if (!url) return null
  const marca = `/${BUCKET_INSPECCION}/`
  const i = url.indexOf(marca)
  return i === -1 ? null : url.slice(i + marca.length)
}

/**
 * POST /api/vehiculos/inspeccion — cierra la recepción (al tomar) o la devolución.
 * Recepción: si no se leyó el QR, la hora de tomarlo es la de este envío.
 * Devolución: queda la hora en que se devolvió.
 */
export async function POST(req: NextRequest) {
  const s = await exigirConductor()
  if (!s.ok) return s.respuesta

  const b = await req.json().catch(() => null)
  const reservaId = String(b?.reservaId ?? '')
  const tipo = b?.tipo as 'recepcion' | 'devolucion'
  if (!reservaId || !['recepcion', 'devolucion'].includes(tipo)) return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  const km = Number(b?.kilometraje)
  if (!Number.isInteger(km) || km < 0) return NextResponse.json({ error: 'El kilometraje es obligatorio.' }, { status: 400 })

  const db = fleet()
  const { data: r } = await db
    .from('vehicle_reservations')
    .select('id, conductor_id, vehicle_id, start_at, tomado_at, devuelto_at')
    .eq('id', reservaId)
    .maybeSingle()
  if (!r) return NextResponse.json({ error: 'No encontré la reserva.' }, { status: 404 })
  if (r.conductor_id !== s.yo.id && !s.yo.es_admin) return NextResponse.json({ error: 'Esa reserva no es tuya.' }, { status: 403 })
  if (tipo === 'recepcion' && fechaBogota(new Date()) < fechaBogota(r.start_at)) {
    return NextResponse.json({ error: 'La recepción se hace desde el día de la reserva.' }, { status: 409 })
  }
  if (tipo === 'devolucion' && !r.tomado_at) return NextResponse.json({ error: 'Primero haz la recepción de esta reserva.' }, { status: 409 })

  const fila: Record<string, unknown> = {
    reservation_id: reservaId,
    inspection_type: tipo,
    step_completed: 7,
    kilometraje: km,
    submitted_at: new Date().toISOString(),
  }
  for (const c of CATEGORIAS) {
    const d = b?.categorias?.[c.clave as ClaveCategoria]
    const novedades = d?.status === 'issues'
    fila[`${c.clave}_status`] = novedades ? 'issues' : 'ok'
    fila[`${c.clave}_issues`] = novedades && Array.isArray(d.issues) ? d.issues.map(String) : []
    fila[`${c.clave}_other`] = novedades && d.other ? String(d.other).slice(0, 500) : null
  }
  for (const f of FOTOS) {
    const url = b?.fotos?.[f.clave]
    if (typeof url === 'string' && rutaEnBucket(url)) fila[`photo_${f.clave}`] = url
  }

  const { error } = await db.from('vehicle_inspections').upsert(fila, { onConflict: 'reservation_id,inspection_type' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ahora = new Date().toISOString()
  if (tipo === 'recepcion' && !r.tomado_at) await db.from('vehicle_reservations').update({ tomado_at: ahora }).eq('id', reservaId)
  if (tipo === 'devolucion') await db.from('vehicle_reservations').update({ devuelto_at: ahora }).eq('id', reservaId)

  // Se conservan las últimas MAX_POR_TIPO inspecciones con fotos por vehículo y tipo. No bloquea la respuesta.
  try {
    const { data: hechos } = await db
      .from('vehicle_inspections')
      .select('id, photo_frontal, photo_posterior, photo_lateral_izq, photo_lateral_der, photo_tablero, vehicle_reservations!inner(vehicle_id)')
      .eq('vehicle_reservations.vehicle_id', r.vehicle_id)
      .eq('inspection_type', tipo)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: true })
    if (hechos && hechos.length > MAX_POR_TIPO) {
      for (const viejo of hechos.slice(0, hechos.length - MAX_POR_TIPO)) {
        const rutas = [viejo.photo_frontal, viejo.photo_posterior, viejo.photo_lateral_izq, viejo.photo_lateral_der, viejo.photo_tablero]
          .map(rutaEnBucket).filter((p): p is string => p !== null)
        if (rutas.length) await storage().from(BUCKET_INSPECCION).remove(rutas)
        await db.from('vehicle_inspections').delete().eq('id', viejo.id)
      }
    }
  } catch (e) {
    console.error('[vehiculos/inspeccion] limpieza de fotos', e)
  }

  return NextResponse.json({ ok: true })
}
