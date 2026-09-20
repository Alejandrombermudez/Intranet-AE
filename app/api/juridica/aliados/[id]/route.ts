import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCaso, subirDocumento } from '@/lib/juridica-core'
import { exigirSesion, PUEDE } from '@/lib/auth-api'
import { normalizarMunicipio, normalizarVereda, normalizarZonaAe } from '@/lib/veredas-caqueta'

// GET /api/juridica/aliados/[id]   ([id] = predio_id)
//
// LECTURA para los tres equipos que tocan el predio (`procesoPredio`), no solo
// jurídica: la ficha de SIG (`/intranet/sig/[predioId]`) llama aquí para saber
// de qué predio se trata y en qué etapa va. Con la regla `juridica`, un usuario
// con departamento SIG que no fuera admin recibía 403 y la página se quedaba sin
// nombre de predio y sin el botón de enviar a Campo — aunque las rutas de
// enviar/cancelar campo SÍ lo autorizan (`procesoPredio`). Hoy no se notaba
// porque la única persona con departamento SIG es además admin.
// Escribir (PATCH) sigue siendo exclusivo de jurídica.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.procesoPredio)
  if (!sesion.ok) return sesion.respuesta

  const caso = await getCaso(supabase, id)
  if (!caso) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
  return NextResponse.json(caso)
}

// PATCH /api/juridica/aliados/[id] — edita HOJA 1 (persona + predio + DD)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: predioId } = await params
    const supabase = createServerSupabaseClient()
    const sesion = await exigirSesion(req, supabase, PUEDE.juridica)
    if (!sesion.ok) return sesion.respuesta

    const formData = await req.formData()
    const raw = formData.get('data')
    if (!raw || typeof raw !== 'string') {
      return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })
    }
    const data = JSON.parse(raw)

    // Localizar el predio y su persona
    const { data: predio, error: pSelErr } = await supabase
      .schema('core').from('predios').select('id, aliado_id, municipio').eq('id', predioId).single()
    if (pSelErr || !predio) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })

    // 1) Persona (core.aliados). nombre_completo y numero_documento son NOT NULL:
    //    si el formulario los deja vacíos NO se sobreescriben (se conserva lo que hubiera,
    //    incluido el marcador puesto al crear). Así la edición nunca rompe por vacíos.
    const tipo_documento = data.tipo_documento ?? 'CC'
    const aliadoUpdate: Record<string, unknown> = {
      tipo_documento,
      tipo_persona: tipo_documento === 'NIT' ? 'juridica' : 'natural',
    }
    const nombreEdit = String(data.nombre_completo ?? '').trim()
    const docEdit    = String(data.numero_documento ?? '').trim()
    if (nombreEdit) aliadoUpdate.nombre_completo = nombreEdit
    if (docEdit)    aliadoUpdate.numero_documento = docEdit
    const { error: aErr } = await supabase.schema('core').from('aliados')
      .update(aliadoUpdate)
      .eq('id', predio.aliado_id)
    if (aErr) {
      if (aErr.code === '23505') {
        return NextResponse.json({ error: 'Ya existe una persona con ese número de documento' }, { status: 409 })
      }
      return NextResponse.json({ error: aErr.message }, { status: 500 })
    }

    // Matrículas: lista; la principal = la primera
    const matriculas: string[] = Array.isArray(data.matriculas)
      ? data.matriculas.map((m: string) => String(m).trim()).filter(Boolean)
      : (data.matricula_inmobiliaria ? [String(data.matricula_inmobiliaria).trim()] : [])

    // 2) Predio (core.predios). municipio es NOT NULL: si viene vacío se conserva el actual.
    //    Municipio, vereda y zona AE se guardan en la escritura canónica
    //    (lib/veredas-caqueta.ts) para que los filtros no vuelvan a partirse en
    //    "MORELIA" y "Morelia". La vereda se normaliza contra el municipio que
    //    queda, no contra el que había.
    const municipioEdit  = String(data.municipio ?? '').trim()
    const municipioFinal = municipioEdit
      ? (normalizarMunicipio(municipioEdit) || municipioEdit)
      : (predio.municipio as string | null)
    const predioUpdate: Record<string, unknown> = {
      nombre_predio:          data.nombre_predio || null,
      departamento:           data.departamento || null,
      vereda:                 normalizarVereda(municipioFinal, data.vereda) || null,
      zona_ae:                normalizarZonaAe(data.zona_ae) || null,
      // Se envían siempre (null si el desplegable quedó en «Sin definir»), para
      // que también se pueda QUITAR la clasificación de un predio, no solo ponerla.
      tipo_proyecto:          data.tipo_proyecto || null,
      fuente_informacion:     data.fuente_informacion || null,
      matricula_inmobiliaria: matriculas[0] || null,
      matriculas:             matriculas.length ? matriculas : null,
      codigo_catastral:       data.codigo_catastral || null,
      area_registral:         data.area_registral || null,
    }
    if (municipioEdit) predioUpdate.municipio = municipioFinal
    const { error: pErr } = await supabase.schema('core').from('predios')
      .update(predioUpdate)
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

    // 4) Documentos (PDF o imagen) → {predio_id}/...
    const docFields = ['cedula', 'certificado_tradicion', 'recibo_predial', 'manifestacion'] as const
    const documentosFallidos: string[] = []
    for (const campo of docFields) {
      const file = formData.get(campo) as File | null
      if (file) {
        const url = await subirDocumento(supabase, `${predioId}/${campo}`, file)
        if (url) ddUpdates[`${campo}_url`] = url
        else documentosFallidos.push(campo)
      }
    }

    const { error: ddErr } = await supabase.schema('juridica').from('debida_diligencia')
      .upsert(ddUpdates, { onConflict: 'predio_id' })
    if (ddErr) return NextResponse.json({ error: ddErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, documentos_fallidos: documentosFallidos })
  } catch (err) {
    console.error('PATCH /api/juridica/aliados/[id] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
