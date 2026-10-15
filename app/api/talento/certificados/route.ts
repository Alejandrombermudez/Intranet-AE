import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { asegurarFicha, errorTalento, esDeLaSesion, sesionTalento } from '@/lib/talento-api'
import type { DatosCertificado } from '@/lib/talento'

/**
 * POST /api/talento/certificados   { incluye_salario, dirigido_a, persona_id? }
 *
 * Expide un certificado laboral: la persona el suyo; talento humano el de
 * cualquiera (persona_id). Arma la foto fija (persona, contratos no anulados,
 * datos de la organización y firmante), le pone un código de verificación y la
 * guarda en people.certificados. El PDF lo arma el navegador desde esa foto.
 */
const LETRAS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const codigo = () => 'AE-' + Array.from({ length: 8 }, (_, i) => (i === 4 ? '-' : '') + LETRAS[randomInt(LETRAS.length)]).join('')

export async function POST(req: NextRequest) {
  const r = await sesionTalento(req)
  if (!r.ok) return r.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const db = r.s.supabase.schema('people')

  let personaId = typeof b?.persona_id === 'string' ? b.persona_id : ''
  if (!personaId) {
    const { persona, error } = await asegurarFicha(r.s)
    if (error || !persona) return errorTalento(error ?? { message: 'No se pudo abrir tu ficha.' })
    personaId = persona.id
  } else if (!(await esDeLaSesion(r.s, personaId))) {
    return NextResponse.json({ error: 'No puedes expedir certificados de otra persona.' }, { status: 403 })
  }

  const [per, cons, org] = await Promise.all([
    db.from('personas').select('nombres, apellidos, tipo_documento, numero_documento, lugar_expedicion, sexo').eq('id', personaId).single(),
    db.from('contratos').select('vinculacion, modalidad, numero, cargo, objeto, fecha_inicio, fecha_fin, valor_mensual, estado, fecha_terminacion')
      .eq('persona_id', personaId).neq('estado', 'anulado').order('fecha_inicio', { ascending: false }),
    db.from('config_talento').select('*').eq('id', 1).maybeSingle(),
  ])
  const err = [per, cons, org].find((x) => x.error)?.error
  if (err) return errorTalento(err)
  if (!per.data?.nombres || !per.data.apellidos || !per.data.numero_documento) {
    return NextResponse.json({ error: 'Para certificar hacen falta en la ficha los nombres, apellidos y número de documento.' }, { status: 400 })
  }
  if (!cons.data?.length) return NextResponse.json({ error: 'No hay contratos registrados para certificar. Talento humano los carga.' }, { status: 400 })

  const { updated_by: _u, updated_at: _a, id: _i, ...organizacion } = (org.data ?? {}) as Record<string, unknown>
  void _u; void _a; void _i
  const datos: DatosCertificado = {
    persona: per.data as DatosCertificado['persona'],
    contratos: cons.data as DatosCertificado['contratos'],
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
