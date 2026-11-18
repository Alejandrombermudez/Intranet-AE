import { NextRequest, NextResponse } from 'next/server'
import { BUCKET_FLOTA, exigirConductor, fleet, storage } from '@/lib/vehiculos/sesion'

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/** PATCH /api/vehiculos/admin/vehiculos { id, placa?, soat_vence?, tecnomecanica_vence? } */
export async function PATCH(req: NextRequest) {
  const s = await exigirConductor(true)
  if (!s.ok) return s.respuesta
  const b = await req.json().catch(() => null)
  const cambios: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: s.yo.email ?? s.yo.nombre }
  if (b?.placa !== undefined) cambios.placa = String(b.placa).trim().toUpperCase().slice(0, 10) || null
  for (const campo of ['soat_vence', 'tecnomecanica_vence'] as const) {
    if (b?.[campo] === undefined) continue
    const v = String(b[campo] ?? '')
    if (v && !FECHA.test(v)) return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 })
    cambios[campo] = v || null
  }
  const { error } = await fleet().from('vehiculos').update(cambios).eq('id', String(b?.id ?? ''))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/**
 * POST /api/vehiculos/admin/vehiculos (multipart: id, cual, archivo)
 *   cual = foto | tarjeta  → imagen; queda en la columna foto_path / tarjeta_path
 *   cual = soat | tecno    → imagen o PDF; sin columna, el más reciente `<id>/<cual>-<ms>.<ext>`
 * Todo en el bucket privado «flota». Cada subida lleva su propio nombre y la anterior se borra,
 * para que ningún celular siga mostrando una copia vieja.
 */
export async function POST(req: NextRequest) {
  const s = await exigirConductor(true)
  if (!s.ok) return s.respuesta
  const form = await req.formData().catch(() => null)
  const id = String(form?.get('id') ?? '')
  const cual = String(form?.get('cual') ?? '')
  const archivo = form?.get('archivo')
  if (!id || !['foto', 'tarjeta', 'soat', 'tecno'].includes(cual) || !(archivo instanceof File)) {
    return NextResponse.json({ error: 'Datos incompletos.' }, { status: 400 })
  }
  if (archivo.size > 3_500_000) return NextResponse.json({ error: 'El archivo pesa demasiado (máximo 3,5 MB).' }, { status: 413 })
  const esPdf = archivo.type === 'application/pdf'
  if (esPdf && !['soat', 'tecno'].includes(cual)) return NextResponse.json({ error: 'Para esto sube una foto.' }, { status: 400 })

  const db = fleet()
  const { data: v } = await db.from('vehiculos').select('id, foto_path, tarjeta_path').eq('id', id).maybeSingle()
  if (!v) return NextResponse.json({ error: 'No encontré el vehículo.' }, { status: 404 })

  const ruta = `${id}/${cual}-${Date.now()}.${esPdf ? 'pdf' : 'jpg'}`
  const bucket = storage().from(BUCKET_FLOTA)
  const { error } = await bucket.upload(ruta, await archivo.arrayBuffer(), { contentType: esPdf ? 'application/pdf' : 'image/jpeg' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let anteriores: string[] = []
  if (cual === 'foto' || cual === 'tarjeta') {
    const columna = cual === 'foto' ? 'foto_path' : 'tarjeta_path'
    const { error: e2 } = await db.from('vehiculos')
      .update({ [columna]: ruta, updated_at: new Date().toISOString(), updated_by: s.yo.email ?? s.yo.nombre })
      .eq('id', id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    const anterior = (v as Record<string, string | null>)[columna]
    if (anterior) anteriores = [anterior]
  } else {
    const { data: lista } = await bucket.list(id, { limit: 100 })
    anteriores = (lista ?? []).filter((f) => f.name.startsWith(`${cual}-`) && `${id}/${f.name}` !== ruta).map((f) => `${id}/${f.name}`)
    await db.from('vehiculos').update({ updated_at: new Date().toISOString(), updated_by: s.yo.email ?? s.yo.nombre }).eq('id', id)
  }
  if (anteriores.length) await bucket.remove(anteriores)
  return NextResponse.json({ ok: true })
}
