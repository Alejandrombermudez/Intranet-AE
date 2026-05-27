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

// GET /api/juridica/aliados — lista todos los aliados con join a antecedentes y analisis
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const ok = await authorize(supabase, email)
  if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { data, error } = await supabase
    .schema('juridica')
    .from('aliados')
    .select('*, antecedentes(*), analisis_juridico(*)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/juridica/aliados — crea un nuevo aliado (HOJA 1)
// Acepta multipart/form-data con campo 'data' (JSON) y archivos PDF opcionales
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

    // Subir PDFs opcionales
    const pdfFields = ['certificado_tradicion', 'recibo_predial', 'manifestacion'] as const
    const urls: Record<string, string | null> = {}

    for (const campo of pdfFields) {
      const file = formData.get(campo) as File | null
      if (file) {
        // Nombre temporal hasta tener el ID; se sobreescribe después si hace falta
        const tmpName = `tmp_${Date.now()}_${campo}.pdf`
        const { error: upErr } = await supabase.storage
          .from('juridica-documentos')
          .upload(tmpName, file, { contentType: 'application/pdf' })
        if (!upErr) {
          const { data: signed } = await supabase.storage
            .from('juridica-documentos')
            .createSignedUrl(tmpName, 60 * 60 * 24 * 365 * 5) // 5 años
          urls[`${campo}_url`] = signed?.signedUrl ?? null
          // Mover al path definitivo tras insertar (ver PATCH)
          urls[`_tmp_path_${campo}`] = tmpName
        }
      }
    }

    const { data: aliado, error } = await supabase
      .schema('juridica')
      .from('aliados')
      .insert({
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
        certificado_tradicion_url:   urls['certificado_tradicion_url'] ?? null,
        recibo_predial_url:          urls['recibo_predial_url'] ?? null,
        manifestacion_url:           urls['manifestacion_url'] ?? null,
        estado:                      'borrador',
        created_by:                  email,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe un aliado con ese número de documento' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Mover archivos temporales al path definitivo {aliado_id}/...
    for (const campo of pdfFields) {
      const tmpPath = urls[`_tmp_path_${campo}`]
      if (tmpPath && aliado?.id) {
        const finalPath = `${aliado.id}/${campo}.pdf`
        await supabase.storage.from('juridica-documentos').move(tmpPath, finalPath)
        // Actualizar URL en la fila
        const { data: newSigned } = await supabase.storage
          .from('juridica-documentos')
          .createSignedUrl(finalPath, 60 * 60 * 24 * 365 * 5)
        if (newSigned?.signedUrl) {
          await supabase.schema('juridica').from('aliados')
            .update({ [`${campo}_url`]: newSigned.signedUrl })
            .eq('id', aliado.id)
        }
      }
    }

    return NextResponse.json({ id: aliado?.id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/juridica/aliados error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
