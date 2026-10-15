import { NextRequest, NextResponse } from 'next/server'
import { asegurarFicha, errorTalento, faltaMigracionTalento, sello, sesionTalento, subirArchivo, AVISO_MIGRACION_TALENTO, BUCKET_TALENTO } from '@/lib/talento-api'

/**
 * Cuentas de cobro.
 *
 *   GET  (solo talento humano) ?desde=&hasta=&estado=
 *        → la bandeja: todas las cuentas del rango, de todas las personas
 *   POST (la persona; multipart: datos JSON {contrato_id, concepto, valor,
 *        periodo_desde, periodo_hasta} + planilla?)
 *        → radica con people.radicar_cuenta_cobro: consecutivo, fecha y la foto
 *          fija de sus datos. La planilla de seguridad social es opcional.
 */
export async function GET(req: NextRequest) {
  const r = await sesionTalento(req, { soloRRHH: true })
  if (!r.ok) return r.respuesta
  const p = req.nextUrl.searchParams
  let q = r.s.supabase.schema('people').from('cuentas_cobro').select('*')
    .order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(1000)
  const desde = p.get('desde'), hasta = p.get('hasta'), estado = p.get('estado')
  if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) q = q.gte('fecha', desde)
  if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) q = q.lte('fecha', hasta)
  if (estado && ['radicada', 'aprobada', 'devuelta', 'pagada', 'anulada'].includes(estado)) q = q.eq('estado', estado)
  const { data, error } = await q
  if (error) {
    if (faltaMigracionTalento(error)) return NextResponse.json({ cuentas: [], faltaMigracion: true, aviso: AVISO_MIGRACION_TALENTO })
    return errorTalento(error)
  }
  return NextResponse.json({ cuentas: data ?? [] })
}

export async function POST(req: NextRequest) {
  const r = await sesionTalento(req)
  if (!r.ok) return r.respuesta
  const form = await req.formData().catch(() => null)
  let b: Record<string, unknown>
  try { b = JSON.parse(String(form?.get('datos') ?? '')) } catch { return NextResponse.json({ error: 'Datos dañados.' }, { status: 400 }) }

  const { persona, error } = await asegurarFicha(r.s)
  if (error || !persona) return errorTalento(error ?? { message: 'No se pudo abrir tu ficha.' })

  let planilla: string | null = null
  const f = form?.get('planilla')
  if (f instanceof File && f.size) {
    try { planilla = await subirArchivo(r.s.supabase, `personas/${persona.id}/cuentas/${String(b.periodo_desde ?? '').slice(0, 7) || 'sin-periodo'}_${sello()}_planilla`, f) }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
  }

  // Siempre con el correo de la sesión: nadie radica a nombre de otra persona.
  const { data, error: e2 } = await r.s.supabase.schema('people').rpc('radicar_cuenta_cobro', {
    p_email: r.s.email,
    p_cuenta: { ...b, soporte_planilla: planilla },
  })
  if (e2) {
    if (planilla) await r.s.supabase.storage.from(BUCKET_TALENTO).remove([planilla])
    return errorTalento(e2)
  }
  const { data: cuenta, error: e3 } = await r.s.supabase.schema('people').from('cuentas_cobro')
    .select('*').eq('id', (data as { id: string }).id).single()
  if (e3) return errorTalento(e3)
  return NextResponse.json({ cuenta }, { status: 201 })
}
