import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { recalcularEstadoDD } from '@/lib/juridica-core'

async function authorize(supabase: ReturnType<typeof createServerSupabaseClient>, email: string) {
  const { data: profile, error } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin, department')
    .eq('email', email)
    .single()
  if (error || (!profile?.is_admin && profile?.department !== 'Juridica')) return false
  return true
}

// POST /api/juridica/aliados/[id]/analisis-juridico — upsert HOJA 2  ([id] = predio_id)
// El análisis del folio pertenece al PREDIO. Es la primera hoja de la debida
// diligencia después de los datos básicos: no depende de ninguna otra, así que
// no hay precondición más allá de que el caso exista.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: predioId } = await params
    const supabase = createServerSupabaseClient()
    const body = await req.json()
    const email: string | null = body.created_by ?? null
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    const ok = await authorize(supabase, email)
    if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { data: dd, error: ddSelErr } = await supabase
      .schema('juridica').from('debida_diligencia')
      .select('predio_id').eq('predio_id', predioId).single()
    if (ddSelErr || !dd) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })

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

    // El estado sale del semáforo Y de los antecedentes de la persona: un verde
    // con la HOJA 3 pendiente es 'analisis_ok', no 'aprobado'.
    const errEstado = await recalcularEstadoDD(supabase, [predioId])
    if (errEstado) {
      return NextResponse.json(
        { error: `El análisis se guardó, pero no se pudo actualizar el estado del caso: ${errEstado}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/juridica/aliados/[id]/analisis-juridico error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
