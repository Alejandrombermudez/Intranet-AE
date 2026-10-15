import { NextRequest, NextResponse } from 'next/server'
import { asegurarFicha, errorTalento, esDeLaSesion, sello, sesionTalento, subirArchivo } from '@/lib/talento-api'
import { TIPOS_DOCUMENTO_ARCHIVO } from '@/lib/talento'

/**
 * POST /api/talento/documentos  (multipart: tipo, archivo, persona_id?)
 * Sube un documento a la ficha: la persona a la suya; talento humano a la de
 * cualquiera (con persona_id). PDF o imagen, hasta 4 MB.
 */
export async function POST(req: NextRequest) {
  const r = await sesionTalento(req)
  if (!r.ok) return r.respuesta
  const form = await req.formData().catch(() => null)
  const archivo = form?.get('archivo')
  const tipo = String(form?.get('tipo') ?? '')
  if (!(archivo instanceof File) || !archivo.size) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
  if (!(tipo in TIPOS_DOCUMENTO_ARCHIVO)) return NextResponse.json({ error: 'Elige qué documento es.' }, { status: 400 })

  let personaId = String(form?.get('persona_id') ?? '')
  if (!personaId) {
    const { persona, error } = await asegurarFicha(r.s)
    if (error || !persona) return errorTalento(error ?? { message: 'No se pudo abrir tu ficha.' })
    personaId = persona.id
  } else if (!(await esDeLaSesion(r.s, personaId))) {
    return NextResponse.json({ error: 'No puedes subir documentos a otra persona.' }, { status: 403 })
  }

  let ruta: string
  try { ruta = await subirArchivo(r.s.supabase, `personas/${personaId}/documentos/${sello()}_${tipo}`, archivo) }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }

  const { data, error } = await r.s.supabase.schema('people').from('documentos_persona')
    .insert({ persona_id: personaId, tipo, nombre: archivo.name.slice(0, 200), ruta, tamano: archivo.size, subido_por: r.s.email })
    .select('*').single()
  if (error) return errorTalento(error)
  return NextResponse.json({ documento: data }, { status: 201 })
}
