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

// POST /api/juridica/aliados/[id]/analisis-juridico — upsert HOJA 3  ([id] = predio_id)
// El análisis del folio pertenece al PREDIO. El semáforo fija el estado de la DD.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: predioId } = await params
    const supabase = createServerSupabaseClient()
    const body = await req.json()
    const email: string | null = body.created_by ?? null
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    const ok = await authorize(supabase, email)
    if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    // Verificar que existe el predio y que la DD pasó antecedentes
    const { data: dd, error: ddSelErr } = await supabase
      .schema('juridica').from('debida_diligencia')
      .select('predio_id, estado').eq('predio_id', predioId).single()
    if (ddSelErr || !dd) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })

    // La precondición real es que HOJA 2 esté aprobada, no el estado de la DD:
    // el propio semáforo muta ese estado, así que usarlo dejaba un caso con
    // semáforo rojo ('rechazado') bloqueado para siempre, imposible de corregir.
    const { data: predioRef } = await supabase
      .schema('core').from('predios').select('aliado_id').eq('id', predioId).single()
    const { data: ant } = predioRef
      ? await supabase.schema('juridica').from('antecedentes')
          .select('aprobado').eq('aliado_id', predioRef.aliado_id).maybeSingle()
      : { data: null }
    if (ant?.aprobado !== true) {
      return NextResponse.json({ error: 'Debe aprobar la revisión de antecedentes (HOJA 2) primero' }, { status: 422 })
    }

    const payload = {
      predio_id:                predioId,
      created_by:               email,
      estado_folio:             body.estado_folio || null,
      vereda_registral:         body.vereda_registral || null,
      fmi_matrices:             body.fmi_matrices || null,
      fmi_derivados:            body.fmi_derivados || null,
      acto_origen:              body.acto_origen || null,
      descripcion_acto_origen:  body.descripcion_acto_origen || null,
      naturaleza_juridica:      body.naturaleza_juridica || null,
      falsa_tradicion:          body.falsa_tradicion ?? null,
      procesos_judiciales:      body.procesos_judiciales ?? null,
      procesos_judiciales_desc: body.procesos_judiciales_desc || null,
      medidas_cautelares:       body.medidas_cautelares ?? null,
      medidas_cautelares_desc:  body.medidas_cautelares_desc || null,
      liquidaciones:            body.liquidaciones ?? null,
      liquidaciones_desc:       body.liquidaciones_desc || null,
      sucesiones:               body.sucesiones ?? null,
      sucesiones_desc:          body.sucesiones_desc || null,
      concepto_ant:             body.concepto_ant || null,
      concepto_urt:             body.concepto_urt || null,
      concepto_pnn:             body.concepto_pnn || null,
      observaciones:            body.observaciones || null,
      semaforo:                 body.semaforo || null,
    }

    const { error: upsertErr } = await supabase
      .schema('juridica').from('analisis_juridico')
      .upsert(payload, { onConflict: 'predio_id' })
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

    // Semáforo → estado de la DD
    const semaforo: string | null = body.semaforo ?? null
    let nuevoEstado: string | null = null
    if (semaforo === 'verde' || semaforo === 'amarillo') nuevoEstado = 'aprobado'
    else if (semaforo === 'naranja')                     nuevoEstado = 'juridico_ok'
    else if (semaforo === 'rojo')                        nuevoEstado = 'rechazado'

    if (nuevoEstado) {
      await supabase.schema('juridica').from('debida_diligencia')
        .update({ estado: nuevoEstado })
        .eq('predio_id', predioId)
      if (nuevoEstado === 'rechazado') {
        await supabase.schema('core').from('expedientes')
          .update({ estado: 'rechazado' })
          .eq('predio_id', predioId)
      } else {
        // Corregir un semáforo rojo debe levantar también el rechazo del expediente.
        // El filtro por estado evita pisar un expediente 'archivado' o 'completado'.
        await supabase.schema('core').from('expedientes')
          .update({ estado: 'activo' })
          .eq('predio_id', predioId)
          .eq('estado', 'rechazado')
      }
    }

    return NextResponse.json({ ok: true, estado: nuevoEstado ?? dd.estado })
  } catch (err) {
    console.error('POST /api/juridica/aliados/[id]/analisis-juridico error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
