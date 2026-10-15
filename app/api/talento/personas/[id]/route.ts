import { NextRequest, NextResponse } from 'next/server'
import { errorTalento, expedientePersona, limpiarFicha, sesionTalento } from '@/lib/talento-api'
import { EDITABLES_RRHH } from '@/lib/talento'

/**
 * Una persona (solo talento humano).
 *   GET   → ficha completa (con notas de talento humano), contratos, documentos,
 *           cuentas de cobro y certificados
 *   PATCH { ...campos } → corrige la ficha. La autorización de datos no se toca
 *           desde aquí: solo la da la persona.
 */
type Contexto = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Contexto) {
  const r = await sesionTalento(req, { soloRRHH: true })
  if (!r.ok) return r.respuesta
  const { id } = await params
  const exp = await expedientePersona(r.s.supabase, id, { rrhh: true })
  if ('error' in exp && exp.error) {
    if (exp.error.code === '404') return NextResponse.json({ error: exp.error.message }, { status: 404 })
    return errorTalento(exp.error)
  }
  return NextResponse.json(exp)
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const r = await sesionTalento(req, { soloRRHH: true })
  if (!r.ok) return r.respuesta
  const { id } = await params
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  const cambios = limpiarFicha(b, EDITABLES_RRHH as readonly string[])
  if ('error' in cambios) return NextResponse.json({ error: cambios.error }, { status: 400 })
  if ('email' in cambios.datos && !cambios.datos.email) delete cambios.datos.email
  if ('foto' in cambios.datos) {
    // Igual que en Mi espacio: una foto puesta a mano no la reemplaza la de Microsoft.
    const { data: actual } = await r.s.supabase.schema('people').from('personas').select('m365').eq('id', id).maybeSingle()
    cambios.datos.m365 = { ...((actual?.m365 as object) ?? {}), foto_propia: !!cambios.datos.foto }
  }

  const { data, error } = await r.s.supabase.schema('people').from('personas')
    .update({ ...cambios.datos, updated_by: r.s.email }).eq('id', id).select('*').maybeSingle()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ese correo o número de documento ya es de otra persona.' }, { status: 409 })
    return errorTalento(error)
  }
  if (!data) return NextResponse.json({ error: 'Persona no encontrada.' }, { status: 404 })
  return NextResponse.json({ persona: data })
}
