import { NextRequest, NextResponse } from 'next/server'
import { errorTalento, esDeLaSesion, sello, sesionTalento, subirArchivo, urlFirmada } from '@/lib/talento-api'
import { contratoDesdeCuerpo } from '@/lib/talento-contratos'

/**
 * Un contrato.
 *   GET   → URL firmada (10 min) del PDF firmado: la persona el suyo, talento humano cualquiera
 *   PATCH (solo talento humano; multipart: datos JSON + archivo?) → editar, terminar
 *         ({estado:'terminado', fecha_terminacion, motivo_terminacion}) o adjuntar el PDF
 */
type Contexto = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Contexto) {
  const r = await sesionTalento(req)
  if (!r.ok) return r.respuesta
  const { id } = await params
  const { data, error } = await r.s.supabase.schema('people').from('contratos').select('persona_id, archivo').eq('id', id).maybeSingle()
  if (error) return errorTalento(error)
  if (!data || !(await esDeLaSesion(r.s, data.persona_id))) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 })
  if (!data.archivo) return NextResponse.json({ error: 'Este contrato no tiene el PDF cargado.' }, { status: 404 })
  return NextResponse.json({ url: await urlFirmada(r.s.supabase, data.archivo) })
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const r = await sesionTalento(req, { soloRRHH: true })
  if (!r.ok) return r.respuesta
  const { id } = await params
  const form = await req.formData().catch(() => null)
  let b: Record<string, unknown> = {}
  try { b = JSON.parse(String(form?.get('datos') ?? '{}')) } catch { return NextResponse.json({ error: 'Datos dañados.' }, { status: 400 }) }

  const db = r.s.supabase.schema('people')
  const { data: actual, error } = await db.from('contratos').select('*').eq('id', id).maybeSingle()
  if (error) return errorTalento(error)
  if (!actual) return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 })

  const c = contratoDesdeCuerpo({ vinculacion: actual.vinculacion, ...b }, false)
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 })
  const cambios: Record<string, unknown> = { ...c.datos }

  const archivo = form?.get('archivo')
  if (archivo instanceof File && archivo.size) {
    try { cambios.archivo = await subirArchivo(r.s.supabase, `personas/${actual.persona_id}/contratos/${id}_${sello()}`, archivo) }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
  }
  if (!Object.keys(cambios).length) return NextResponse.json({ contrato: actual })
  const { data, error: e2 } = await db.from('contratos').update(cambios).eq('id', id).select('*').single()
  if (e2) return errorTalento(e2)
  return NextResponse.json({ contrato: data })
}
