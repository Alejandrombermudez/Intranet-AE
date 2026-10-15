import { NextRequest, NextResponse } from 'next/server'
import { BUCKET_TALENTO, errorTalento, esDeLaSesion, sesionTalento, urlFirmada } from '@/lib/talento-api'

/**
 * Un documento de la ficha.
 *   GET    → URL firmada por 10 minutos para verlo
 *   DELETE → borrarlo (la persona los suyos; talento humano cualquiera)
 */
type Contexto = { params: Promise<{ id: string }> }

async function cargar(req: NextRequest, id: string) {
  const r = await sesionTalento(req)
  if (!r.ok) return { respuesta: r.respuesta }
  const { data, error } = await r.s.supabase.schema('people').from('documentos_persona').select('*').eq('id', id).maybeSingle()
  if (error) return { respuesta: errorTalento(error) }
  if (!data || !(await esDeLaSesion(r.s, data.persona_id))) return { respuesta: NextResponse.json({ error: 'Documento no encontrado.' }, { status: 404 }) }
  return { s: r.s, doc: data }
}

export async function GET(req: NextRequest, { params }: Contexto) {
  const { id } = await params
  const c = await cargar(req, id)
  if (c.respuesta) return c.respuesta
  return NextResponse.json({ url: await urlFirmada(c.s!.supabase, c.doc.ruta) })
}

export async function DELETE(req: NextRequest, { params }: Contexto) {
  const { id } = await params
  const c = await cargar(req, id)
  if (c.respuesta) return c.respuesta
  const { error } = await c.s!.supabase.schema('people').from('documentos_persona').delete().eq('id', id)
  if (error) return errorTalento(error)
  await c.s!.supabase.storage.from(BUCKET_TALENTO).remove([c.doc.ruta])
  return NextResponse.json({ ok: true })
}
