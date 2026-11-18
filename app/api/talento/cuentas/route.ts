import { NextRequest, NextResponse } from 'next/server'
import { asegurarFicha, errorTalento, faltaMigracionTalento, sello, sesionTalento, subirArchivo, AVISO_MIGRACION_TALENTO, BUCKET_TALENTO, type SB } from '@/lib/talento-api'
import { avisoValor } from '@/lib/cuenta-cobro-valor'
import { TIPO_CUENTA, type CuentaCobro } from '@/lib/talento'

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
  return NextResponse.json({ cuentas: await conAvisos(r.s.supabase, (data ?? []) as CuentaCobro[]) })
}

const CAMPO_DIF: Record<string, string> = { nombres: 'nombres', apellidos: 'apellidos', banco: 'banco', numero_cuenta: 'número de cuenta', tipo_cuenta: 'tipo de cuenta' }

/**
 * Lo que talento humano debe mirar antes de pagar cada cuenta:
 *   · el valor no cuadra con los honorarios del contrato (proporcional al
 *     periodo) o, sin contrato, con la cuenta anterior de la misma persona;
 *   · por el enlace escribió datos de pago distintos a los de su ficha;
 *   · por el enlace llegó una persona que no estaba registrada.
 */
async function conAvisos(supabase: SB, cuentas: CuentaCobro[]): Promise<CuentaCobro[]> {
  if (!cuentas.length) return cuentas
  const personas = [...new Set(cuentas.map((c) => c.persona_id))]
  const { data: historia } = await supabase.schema('people').from('cuentas_cobro')
    .select('persona_id, consecutivo, valor, estado').in('persona_id', personas).neq('estado', 'anulada')
  return cuentas.map((c) => {
    const avisos: string[] = []
    const anterior = (historia ?? [])
      .filter((h) => h.persona_id === c.persona_id && h.consecutivo < c.consecutivo)
      .sort((a, b) => b.consecutivo - a.consecutivo)[0]
    const v = avisoValor(Number(c.valor), { desde: c.periodo_desde, hasta: c.periodo_hasta },
      { mensual: c.datos.contrato?.valor_mensual ?? null, anterior: anterior ? Number(anterior.valor) : null })
    if (v) avisos.push(v.texto)
    for (const d of c.datos.diferencias ?? []) {
      const t = (x: string) => (d.campo === 'tipo_cuenta' ? TIPO_CUENTA[x] ?? x : x)
      avisos.push(`Escribió ${CAMPO_DIF[d.campo] ?? d.campo} «${t(d.escrito)}», distinto al de su ficha («${t(d.guardado)}»).`)
    }
    if (c.datos.persona_nueva) avisos.push('Persona nueva: se registró con esta cuenta. Revise sus datos.')
    return { ...c, avisos }
  })
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
