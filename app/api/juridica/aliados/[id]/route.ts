import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { comprimirPdf } from '@/lib/pdf-compress'
import { getCaso } from '@/lib/juridica-core'

async function authorize(supabase: ReturnType<typeof createServerSupabaseClient>, email: string) {
  const { data: profile, error } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin, department')
    .eq('email', email)
    .single()
  if (error || (!profile?.is_admin && profile?.department !== 'Juridica')) return false
  return true
}

// GET /api/juridica/aliados/[id]   ([id] = predio_id)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerSupabaseClient()
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const ok = await authorize(supabase, email)
  if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const caso = await getCaso(supabase, id)
  if (!caso) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  return NextResponse.json(caso)
}

// PATCH /api/juridica/aliados/[id] — edita HOJA 1 (persona + predio + DD)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: predioId } = await params
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

    // Localizar el predio y su persona
    const { data: predio, error: pSelErr } = await supabase
      .schema('core').from('predios').select('id, aliado_id').eq('id', predioId).single()
    if (pSelErr || !predio) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })

    // 1) Persona (core.aliados)
    const tipo_documento = data.tipo_documento ?? 'CC'
    const { error: aErr } = await supabase.schema('core').from('aliados')
      .update({
        nombre_completo:  data.nombre_completo,
        tipo_documento,
        tipo_persona:     tipo_documento === 'NIT' ? 'juridica' : 'natural',
        numero_documento: data.numero_documento,
      })
      .eq('id', predio.aliado_id)
    if (aErr) {
      if (aErr.code === '23505') {
        return NextResponse.json({ error: 'Ya existe una persona con ese número de documento' }, { status: 409 })
      }
      return NextResponse.json({ error: aErr.message }, { status: 500 })
    }

    // 2) Predio (core.predios)
    const { error: pErr } = await supabase.schema('core').from('predios')
      .update({
        nombre_predio:          data.nombre_predio || null,
        departamento:           data.departamento || null,
        municipio:              data.municipio,
        vereda:                 data.vereda || null,
        zona_ae:                data.zona_ae || null,
        matricula_inmobiliaria: data.matricula_inmobiliaria || null,
        codigo_catastral:       data.codigo_catastral || null,
        area_registral:         data.area_registral || null,
      })
      .eq('id', predioId)
    if (pErr) {
      if (pErr.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un predio con esa matrícula inmobiliaria' }, { status: 409 })
      }
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }

    // 3) Debida diligencia (manifestación + predial). Upsert por si no existiera.
    const ddUpdates: Record<string, unknown> = {
      predio_id:                   predioId,
      anio_ultimo_pago_predial:    data.anio_ultimo_pago_predial || null,
      manifestacion_interes:       data.manifestacion_interes ?? null,
      manifestacion_observaciones: data.manifestacion_observaciones || null,
    }

    // 4) PDFs → {predio_id}/...
    const pdfFields = ['cedula', 'certificado_tradicion', 'recibo_predial', 'manifestacion'] as const
    for (const campo of pdfFields) {
      const file = formData.get(campo) as File | null
      if (file) {
        const rawBuf = await file.arrayBuffer()
        const compressed = await comprimirPdf(rawBuf)
        const path = `${predioId}/${campo}.pdf`
        await supabase.storage.from('juridica-documentos').remove([path])
        const { error: upErr } = await supabase.storage
          .from('juridica-documentos')
          .upload(path, compressed, { contentType: 'application/pdf', upsert: true })
        if (!upErr) {
          const { data: signed } = await supabase.storage
            .from('juridica-documentos')
            .createSignedUrl(path, 60 * 60 * 24 * 365 * 5)
          if (signed?.signedUrl) ddUpdates[`${campo}_url`] = signed.signedUrl
        }
      }
    }

    const { error: ddErr } = await supabase.schema('juridica').from('debida_diligencia')
      .upsert(ddUpdates, { onConflict: 'predio_id' })
    if (ddErr) return NextResponse.json({ error: ddErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/juridica/aliados/[id] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
