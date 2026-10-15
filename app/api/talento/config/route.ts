import { NextRequest, NextResponse } from 'next/server'
import { errorTalento, faltaMigracionTalento, sesionTalento, AVISO_MIGRACION_TALENTO } from '@/lib/talento-api'

/**
 * Datos de la organización para las plantillas (solo talento humano):
 * razón social, NIT, dirección, quién firma los certificados y el texto que
 * va al pie de cada cuenta de cobro.
 *   GET   → la fila
 *   PATCH { ...campos }
 */
const CAMPOS = ['razon_social', 'nit', 'direccion', 'ciudad', 'telefono', 'correo',
  'firmante_nombre', 'firmante_cargo', 'firmante_firma', 'texto_cuenta_cobro'] as const

export async function GET(req: NextRequest) {
  const r = await sesionTalento(req, { soloRRHH: true })
  if (!r.ok) return r.respuesta
  const { data, error } = await r.s.supabase.schema('people').from('config_talento').select('*').eq('id', 1).maybeSingle()
  if (error) {
    if (faltaMigracionTalento(error)) return NextResponse.json({ config: null, faltaMigracion: true, aviso: AVISO_MIGRACION_TALENTO })
    return errorTalento(error)
  }
  return NextResponse.json({ config: data })
}

export async function PATCH(req: NextRequest) {
  const r = await sesionTalento(req, { soloRRHH: true })
  if (!r.ok) return r.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  const cambios: Record<string, unknown> = { updated_by: r.s.email }
  for (const k of CAMPOS) {
    if (!(k in b)) continue
    const v = typeof b[k] === 'string' ? (b[k] as string).trim() : null
    if (k === 'firmante_firma' && v && !/^data:image\/(png|jpe?g);base64,/.test(v)) return NextResponse.json({ error: 'La firma debe ser una imagen PNG o JPG.' }, { status: 400 })
    cambios[k] = v || null
  }
  const { data, error } = await r.s.supabase.schema('people').from('config_talento')
    .upsert({ id: 1, ...cambios }).select('*').single()
  if (error) return errorTalento(error)
  return NextResponse.json({ config: data })
}
