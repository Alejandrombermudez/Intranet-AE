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

// POST /api/juridica/aliados/[id]/analisis-juridico — upsert HOJA 3
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = createServerSupabaseClient()
    const body = await req.json()
    const email: string | null = body.created_by ?? null
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    const ok = await authorize(supabase, email)
    if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { data: aliado, error: aErr } = await supabase
      .schema('juridica').from('aliados')
      .select('id, estado')
      .eq('id', id)
      .single()

    if (aErr || !aliado) return NextResponse.json({ error: 'Aliado no encontrado' }, { status: 404 })
    if (aliado.estado !== 'antecedentes_ok' && aliado.estado !== 'juridico_ok' && aliado.estado !== 'aprobado') {
      return NextResponse.json(
        { error: 'Debe completar la revisión de antecedentes primero' },
        { status: 422 }
      )
    }

    const payload = {
      aliado_id:                id,
      created_by:               email,
      estado_folio:             body.estado_folio || null,
      vereda_registral:         body.vereda_registral || null,
      fmi_matrices:             body.fmi_matrices || null,
      fmi_derivados:            body.fmi_derivados || null,
      acto_origen:              body.acto_origen || null,
      descripcion_acto_origen:  body.descripcion_acto_origen || null,
      acto_adquisicion_actual:  body.acto_adquisicion_actual || null,
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
      .schema('juridica')
      .from('analisis_juridico')
      .upsert(payload, { onConflict: 'aliado_id' })

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

    const semaforo: string | null = body.semaforo ?? null
    let nuevoEstado: string | null = null
    if (semaforo === 'verde' || semaforo === 'amarillo') nuevoEstado = 'aprobado'
    else if (semaforo === 'naranja')                     nuevoEstado = 'juridico_ok'
    else if (semaforo === 'rojo')                        nuevoEstado = 'rechazado'

    if (nuevoEstado) {
      await supabase.schema('juridica').from('aliados')
        .update({ estado: nuevoEstado })
        .eq('id', id)
    }

    return NextResponse.json({ ok: true, estado: nuevoEstado ?? aliado.estado })
  } catch (err) {
    console.error('POST /api/juridica/aliados/[id]/analisis-juridico error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
