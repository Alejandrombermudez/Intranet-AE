import { NextRequest, NextResponse } from 'next/server'
import { errorTalento, sello, sesionTalento, subirArchivo } from '@/lib/talento-api'
import { contratoDesdeCuerpo } from '@/lib/talento-contratos'

/**
 * POST /api/talento/contratos   (solo talento humano; multipart: datos JSON + archivo?)
 * Registra un contrato de una persona y, si viene, sube el PDF firmado.
 */
export async function POST(req: NextRequest) {
  const r = await sesionTalento(req, { soloRRHH: true })
  if (!r.ok) return r.respuesta
  const form = await req.formData().catch(() => null)
  let b: Record<string, unknown>
  try { b = JSON.parse(String(form?.get('datos') ?? '')) } catch { return NextResponse.json({ error: 'Datos del contrato dañados.' }, { status: 400 }) }
  if (typeof b.persona_id !== 'string') return NextResponse.json({ error: 'Falta la persona.' }, { status: 400 })

  const c = contratoDesdeCuerpo(b, true)
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: 400 })

  const db = r.s.supabase.schema('people')
  const { data, error } = await db.from('contratos')
    .insert({ ...c.datos, persona_id: b.persona_id, created_by: r.s.email }).select('*').single()
  if (error) return errorTalento(error)

  const archivo = form?.get('archivo')
  if (archivo instanceof File && archivo.size) {
    try {
      const ruta = await subirArchivo(r.s.supabase, `personas/${b.persona_id}/contratos/${data.id}_${sello()}`, archivo)
      const { data: con, error: e2 } = await db.from('contratos').update({ archivo: ruta }).eq('id', data.id).select('*').single()
      if (e2) return errorTalento(e2)
      return NextResponse.json({ contrato: con }, { status: 201 })
    } catch (e) {
      return NextResponse.json({ contrato: data, aviso: `El contrato quedó registrado, pero el PDF no: ${(e as Error).message}` }, { status: 201 })
    }
  }
  return NextResponse.json({ contrato: data }, { status: 201 })
}
