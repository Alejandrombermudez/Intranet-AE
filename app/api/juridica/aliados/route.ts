import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { comprimirPdf } from '@/lib/pdf-compress'
import { listCasos, findOrCreateAliado } from '@/lib/juridica-core'

async function authorize(supabase: ReturnType<typeof createServerSupabaseClient>, email: string) {
  const { data: profile, error } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin, department')
    .eq('email', email)
    .single()
  if (error || (!profile?.is_admin && profile?.department !== 'Juridica')) return false
  return true
}

// GET /api/juridica/aliados — lista de casos (persona+predio+DD, plano para la UI)
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const ok = await authorize(supabase, email)
  if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  try {
    const casos = await listCasos(supabase)
    return NextResponse.json(casos)
  } catch (err) {
    console.error('GET /api/juridica/aliados error:', err)
    return NextResponse.json({ error: 'Error al listar' }, { status: 500 })
  }
}

// POST /api/juridica/aliados — crea persona + predio + expediente + DD (HOJA 1)
// Acepta multipart/form-data con campo 'data' (JSON) y PDFs opcionales.
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const formData = await req.formData()
    const raw = formData.get('data')
    if (!raw || typeof raw !== 'string') {
      return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })
    }
    const data = JSON.parse(raw)
    const email: string | null = data.created_by ?? null
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    const ok = await authorize(supabase, email)
    if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    // 1) Persona: reusar si ya existe ese documento, si no crearla.
    let aliadoId: string
    try {
      const r = await findOrCreateAliado(supabase, {
        numero_documento: data.numero_documento,
        nombre_completo:  data.nombre_completo,
        tipo_documento:   data.tipo_documento ?? 'CC',
        created_by:       email,
      })
      aliadoId = r.id
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: 'Error al registrar la persona: ' + msg }, { status: 500 })
    }

    // 2) Predio (dueño principal = la persona)
    const { data: predio, error: pErr } = await supabase
      .schema('core').from('predios')
      .insert({
        aliado_id:              aliadoId,
        nombre_predio:          data.nombre_predio || null,
        departamento:           data.departamento || null,
        municipio:              data.municipio,
        vereda:                 data.vereda || null,
        zona_ae:                data.zona_ae || null,
        matricula_inmobiliaria: data.matricula_inmobiliaria || null,
        codigo_catastral:       data.codigo_catastral || null,
        area_registral:         data.area_registral || null,
        created_by:             email,
      })
      .select('id')
      .single()

    if (pErr) {
      if (pErr.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un predio con esa matrícula inmobiliaria' }, { status: 409 })
      }
      return NextResponse.json({ error: pErr.message }, { status: 500 })
    }
    const predioId = predio!.id

    // 3) Copropiedad: registrar al dueño principal
    await supabase.schema('core').from('predio_propietarios')
      .insert({ predio_id: predioId, aliado_id: aliadoId, rol: 'principal' })

    // 4) Expediente del predio (arranca en etapa jurídica)
    await supabase.schema('core').from('expedientes')
      .insert({ predio_id: predioId, etapa: 'juridica', estado: 'activo', created_by: email })

    // 5) Debida diligencia (workflow + manifestación + predial)
    await supabase.schema('juridica').from('debida_diligencia')
      .insert({
        predio_id:                   predioId,
        estado:                      'borrador',
        anio_ultimo_pago_predial:    data.anio_ultimo_pago_predial || null,
        manifestacion_interes:       data.manifestacion_interes ?? null,
        manifestacion_observaciones: data.manifestacion_observaciones || null,
        created_by:                  email,
      })

    // 6) PDFs → bucket bajo {predio_id}/...  y actualizar URLs en la DD
    const pdfFields = ['cedula', 'certificado_tradicion', 'recibo_predial', 'manifestacion'] as const
    const urlUpdates: Record<string, string> = {}
    for (const campo of pdfFields) {
      const file = formData.get(campo) as File | null
      if (file) {
        const rawBuf = await file.arrayBuffer()
        const compressed = await comprimirPdf(rawBuf)
        const path = `${predioId}/${campo}.pdf`
        const { error: upErr } = await supabase.storage
          .from('juridica-documentos')
          .upload(path, compressed, { contentType: 'application/pdf', upsert: true })
        if (!upErr) {
          const { data: signed } = await supabase.storage
            .from('juridica-documentos')
            .createSignedUrl(path, 60 * 60 * 24 * 365 * 5) // 5 años
          if (signed?.signedUrl) urlUpdates[`${campo}_url`] = signed.signedUrl
        }
      }
    }
    if (Object.keys(urlUpdates).length > 0) {
      await supabase.schema('juridica').from('debida_diligencia')
        .update(urlUpdates)
        .eq('predio_id', predioId)
    }

    return NextResponse.json({ id: predioId }, { status: 201 })
  } catch (err) {
    console.error('POST /api/juridica/aliados error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
