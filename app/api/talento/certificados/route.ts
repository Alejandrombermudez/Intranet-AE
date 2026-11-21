import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { asegurarFicha, errorTalento, esDeLaSesion, sesionTalento } from '@/lib/talento-api'
import { faltasCertificado, type DatosCertificado } from '@/lib/talento'

/**
 * GET  /api/talento/certificados?persona_id=   → { faltan: string[] }
 *      Qué impide expedirlo (`faltasCertificado`); vacío = listo.
 * POST /api/talento/certificados   { incluye_salario, dirigido_a, persona_id? }
 *      Se niega con la misma lista si falta algo (firmas, ficha o contratos).
 *
 * Expide un certificado laboral: la persona el suyo; talento humano el de
 * cualquiera (persona_id). Arma la foto fija (persona, contratos no anulados,
 * datos de la organización y firmante), le pone un código de verificación y la
 * guarda en people.certificados. El PDF lo arma el navegador desde esa foto.
 */
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const codigo = () => 'AE-' + Array.from({ length: 8 }, (_, i) => (i === 4 ? '-' : '') + LETRAS[randomInt(LETRAS.length)]).join('')

type Sesion = Extract<Awaited<ReturnType<typeof sesionTalento>>, { ok: true }>['s']

/** La persona (la propia, o la que pide talento humano) y lo que hace falta para certificarla. */
async function leer(s: Sesion, pedida: unknown) {
  const db = s.supabase.schema('people')
  let personaId = typeof pedida === 'string' ? pedida : ''
  if (!personaId) {
    const { persona, error } = await asegurarFicha(s)
    if (error || !persona) return { respuesta: errorTalento(error ?? { message: 'No se pudo abrir tu ficha.' }) }
    personaId = persona.id
  } else if (!(await esDeLaSesion(s, personaId))) {
    return { respuesta: NextResponse.json({ error: 'No puedes expedir certificados de otra persona.' }, { status: 403 }) }
  }
  const [per, cons, org] = await Promise.all([
    db.from('personas').select('nombres, apellidos, tipo_documento, numero_documento, lugar_expedicion, sexo').eq('id', personaId).single(),
    db.from('contratos').select('vinculacion, modalidad, numero, cargo, objeto, fecha_inicio, fecha_fin, valor_mensual, estado, fecha_terminacion, archivo')
      .eq('persona_id', personaId).neq('estado', 'anulado').order('fecha_inicio', { ascending: false }),
    db.from('config_talento').select('*').eq('id', 1).maybeSingle(),
  ])
  const err = [per, cons, org].find((x) => x.error)?.error
  if (err) return { respuesta: errorTalento(err) }
  return { personaId, per: per.data, cons: cons.data ?? [], org: org.data, faltan: faltasCertificado(per.data, cons.data ?? [], org.data) }
}

export async function GET(req: NextRequest) {
  const r = await sesionTalento(req)
  if (!r.ok) return r.respuesta
  const x = await leer(r.s, req.nextUrl.searchParams.get('persona_id') || null)
  if ('respuesta' in x) return x.respuesta
  return NextResponse.json({ faltan: x.faltan })
}

export async function POST(req: NextRequest) {
  const r = await sesionTalento(req)
  if (!r.ok) return r.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const db = r.s.supabase.schema('people')

  const x = await leer(r.s, b?.persona_id)
  if ('respuesta' in x) return x.respuesta
  const { personaId, per, cons, org, faltan } = x
  if (faltan.length) {
    return NextResponse.json({ error: `Todavía no se puede expedir el certificado. Falta: ${faltan.join(' ')}`, faltan }, { status: 400 })
  }

  const { updated_by: _u, updated_at: _a, id: _i, clave_enlace: _c, ...organizacion } = (org ?? {}) as Record<string, unknown>
  void _u; void _a; void _i; void _c
  // El archivo del contrato no va en la foto fija del certificado.
  const contratos = cons.map(({ archivo: _f, ...k }) => { void _f; return k })
  const datos: DatosCertificado = {
    persona: per as DatosCertificado['persona'],
    contratos: contratos as DatosCertificado['contratos'],
    organizacion: organizacion as unknown as DatosCertificado['organizacion'],
    expedido: new Date().toISOString(),
  }
  const dirigido = typeof b?.dirigido_a === 'string' && b.dirigido_a.trim() ? b.dirigido_a.trim().slice(0, 200) : null

  for (let intento = 0; intento < 3; intento++) {
    const { data, error } = await db.from('certificados').insert({
      persona_id: personaId, incluye_salario: b?.incluye_salario === true, dirigido_a: dirigido,
      codigo: codigo(), datos, generado_por: r.s.email,
    }).select('*').single()
    if (!error) return NextResponse.json({ certificado: data }, { status: 201 })
    if (error.code !== '23505') return errorTalento(error)
  }
  return NextResponse.json({ error: 'No se pudo generar el código. Intenta de nuevo.' }, { status: 500 })
}
