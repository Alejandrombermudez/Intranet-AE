import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function authorize(supabase: ReturnType<typeof createServerSupabaseClient>, email: string) {
  const { data: profile, error } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin, department')
    .eq('email', email)
    .single()
  if (error || (!profile?.is_admin && profile?.department !== 'Juridica')) return false
  return true
}

// GET /api/juridica/aliados/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerSupabaseClient()
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const ok = await authorize(supabase, email)
  if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { data, error } = await supabase
    .schema('juridica')
    .from('aliados')
    .select('*, antecedentes(*), analisis_juridico(*)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: 'Aliado no encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

// PATCH /api/juridica/aliados/[id] — edita campos de HOJA 1
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()
    const formData = await req.formData()
    const raw = formData.get('data')
    if (!raw || typeof raw !== 'string') {
      return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })
    }
    const data = JSON.parse(raw)
    const email: string | null = data.updated_by ?? null
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    const ok = await authorize(supabase, email)
    if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const updates: Record<string, unknown> = {
      nombre_completo:             data.nombre_completo,
      tipo_documento:              data.tipo_documento ?? 'CC',
      numero_documento:            data.numero_documento,
      departamento:                data.departamento || null,
      municipio:                   data.municipio,
      vereda:                      data.vereda || null,
      zona_ae:                     data.zona_ae || null,
      nombre_predio:               data.nombre_predio || null,
      matricula_inmobiliaria:      data.matricula_inmobiliaria || null,
      area_registral:              data.area_registral || null,
      codigo_catastral:            data.codigo_catastral || null,
      anio_ultimo_pago_predial:    data.anio_ultimo_pago_predial || null,
      manifestacion_interes:       data.manifestacion_interes ?? null,
      manifestacion_observaciones: data.manifestacion_observaciones || null,
    }

    const pdfFields = ['certificado_tradicion', 'recibo_predial', 'manifestacion'] as const
    for (const campo of pdfFields) {
      const file = formData.get(campo) as File | null
      if (file) {
        const path = `${id}/${campo}.pdf`
        await supabase.storage.from('juridica-documentos').remove([path])
        const { error: upErr } = await supabase.storage
          .from('juridica-documentos')
          .upload(path, file, { contentType: 'application/pdf' })
        if (!upErr) {
          const { data: signed } = await supabase.storage
            .from('juridica-documentos')
            .createSignedUrl(path, 60 * 60 * 24 * 365 * 5)
          updates[`${campo}_url`] = signed?.signedUrl ?? null
        }
      }
    }

    const { error } = await supabase
      .schema('juridica')
      .from('aliados')
      .update(updates)
      .eq('id', id)

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un aliado con ese número de documento' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/juridica/aliados/[id] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
