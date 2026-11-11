import { NextRequest, NextResponse } from 'next/server'
import { BUCKET_INSPECCION, exigirConductor, fleet, storage } from '@/lib/vehiculos/sesion'
import { FOTOS } from '@/lib/vehiculos/inspeccion'

/** POST /api/vehiculos/foto — una foto de la inspección, ya comprimida en el celular. */
export async function POST(req: NextRequest) {
  const s = await exigirConductor()
  if (!s.ok) return s.respuesta

  const form = await req.formData().catch(() => null)
  const archivo = form?.get('archivo')
  const reservaId = String(form?.get('reservaId') ?? '')
  const tipo = String(form?.get('tipo') ?? '')
  const slot = String(form?.get('slot') ?? '')
  if (!(archivo instanceof File) || !reservaId || !['recepcion', 'devolucion'].includes(tipo) || !FOTOS.some((f) => f.clave === slot)) {
    return NextResponse.json({ error: 'Datos de la foto incompletos.' }, { status: 400 })
  }
  if (archivo.size > 3_000_000) return NextResponse.json({ error: 'La foto pesa demasiado.' }, { status: 413 })

  const { data: r } = await fleet().from('vehicle_reservations').select('conductor_id, vehicle_id').eq('id', reservaId).maybeSingle()
  if (!r) return NextResponse.json({ error: 'No encontré la reserva.' }, { status: 404 })
  if (r.conductor_id !== s.yo.id && !s.yo.es_admin) return NextResponse.json({ error: 'Esa reserva no es tuya.' }, { status: 403 })

  const ruta = `${reservaId}/${tipo}/${r.vehicle_id}_${slot}.jpg`
  const bucket = storage().from(BUCKET_INSPECCION)
  const { error } = await bucket.upload(ruta, await archivo.arrayBuffer(), { upsert: true, contentType: 'image/jpeg' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: bucket.getPublicUrl(ruta).data.publicUrl })
}
