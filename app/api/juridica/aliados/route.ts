import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { listCasos, findOrCreateAliado, subirDocumento, placeholderDocumento, SIN_PROPIETARIO, SIN_MUNICIPIO } from '@/lib/juridica-core'
import { exigirSesion, PUEDE } from '@/lib/auth-api'
import { normalizarMunicipio, normalizarVereda, normalizarZonaAe } from '@/lib/veredas-caqueta'

// GET /api/juridica/aliados — lista de casos (persona+predio+DD, plano para la UI)
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.juridica)
  if (!sesion.ok) return sesion.respuesta

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
    const sesion = await exigirSesion(req, supabase, PUEDE.juridica)
    if (!sesion.ok) return sesion.respuesta
    // Autor de lo que se crea = quien tiene la sesión (no lo que diga el cuerpo).
    const email = sesion.perfil.email

    const formData = await req.formData()
    const raw = formData.get('data')
    if (!raw || typeof raw !== 'string') {
      return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })
    }
    const data = JSON.parse(raw)

    // Datos mínimos: solo el nombre del predio es obligatorio. Los campos que la BD
    // exige NOT NULL se rellenan con marcadores si llegan vacíos (se completan luego).
    const nombreCompleto  = String(data.nombre_completo ?? '').trim() || SIN_PROPIETARIO
    const numeroDocumento = String(data.numero_documento ?? '').trim() || placeholderDocumento()
    // Ubicación siempre en la escritura canónica: si se guarda como llegue, los
    // filtros del tablero SIG acaban con "MORELIA" y "Morelia" separados.
    // Lo que no es municipio del Caquetá (el marcador "Por definir") se respeta.
    const municipioCrudo  = String(data.municipio ?? '').trim()
    const municipio       = normalizarMunicipio(municipioCrudo) || municipioCrudo || SIN_MUNICIPIO
    const vereda          = normalizarVereda(municipio, data.vereda) || null
    const zonaAe          = normalizarZonaAe(data.zona_ae) || null

    // 1) Persona: reusar si ya existe ese documento, si no crearla.
    //    (Con documento vacío se generó un placeholder único → siempre crea una nueva.)
    let aliadoId: string
    try {
      const r = await findOrCreateAliado(supabase, {
        numero_documento: numeroDocumento,
        nombre_completo:  nombreCompleto,
        tipo_documento:   data.tipo_documento ?? 'CC',
        created_by:       email,
      })
      aliadoId = r.id
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: 'Error al registrar la persona: ' + msg }, { status: 500 })
    }

    // Matrículas: lista (un predio puede tener varias); la principal = la primera
    const matriculas: string[] = Array.isArray(data.matriculas)
      ? data.matriculas.map((m: string) => String(m).trim()).filter(Boolean)
      : (data.matricula_inmobiliaria ? [String(data.matricula_inmobiliaria).trim()] : [])

    // 2) Predio (dueño principal = la persona)
    const { data: predio, error: pErr } = await supabase
      .schema('core').from('predios')
      .insert({
        aliado_id:              aliadoId,
        nombre_predio:          data.nombre_predio || null,
        departamento:           data.departamento || null,
        municipio:              municipio,
        vereda:                 vereda,
        zona_ae:                zonaAe,
        // Clasificación del predio (códigos de catalogo.proyectos /
        // catalogo.fuentes_informacion). Vacío = todavía sin clasificar.
        tipo_proyecto:          data.tipo_proyecto || null,
        fuente_informacion:     data.fuente_informacion || null,
        matricula_inmobiliaria: matriculas[0] || null,
        matriculas:             matriculas.length ? matriculas : null,
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

    // 6) Documentos (PDF o imagen) → bucket bajo {predio_id}/...  y URLs en la DD
    const docFields = ['cedula', 'certificado_tradicion', 'recibo_predial', 'manifestacion'] as const
    const urlUpdates: Record<string, string> = {}
    const documentosFallidos: string[] = []
    for (const campo of docFields) {
      const file = formData.get(campo) as File | null
      if (file) {
        const url = await subirDocumento(supabase, `${predioId}/${campo}`, file)
        if (url) urlUpdates[`${campo}_url`] = url
        else documentosFallidos.push(campo)
      }
    }
    if (Object.keys(urlUpdates).length > 0) {
      await supabase.schema('juridica').from('debida_diligencia')
        .update(urlUpdates)
        .eq('predio_id', predioId)
    }

    return NextResponse.json({ id: predioId, documentos_fallidos: documentosFallidos }, { status: 201 })
  } catch (err) {
    console.error('POST /api/juridica/aliados error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
