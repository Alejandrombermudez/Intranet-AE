import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { subirDocumento } from '@/lib/juridica-core'

async function authorize(supabase: ReturnType<typeof createServerSupabaseClient>, email: string) {
  const { data: profile, error } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin, department')
    .eq('email', email)
    .single()
  if (error || (!profile?.is_admin && profile?.department !== 'Juridica')) return false
  return true
}

const LISTAS = [
  'rama_judicial', 'procuraduria', 'contraloria', 'policia_nacional', 'rnmc',
  'onu', 'ofac', 'bid', 'banco_mundial', 'hm_treasury', 'fbi', 'interpol', 'ue_terroristas', 'dea',
] as const

// POST /api/juridica/aliados/[id]/antecedentes — upsert HOJA 2   ([id] = predio_id)
// Antecedentes pertenece a la PERSONA (core.aliados): se veta una vez y sirve
// para todos sus predios. El estado del workflow vive en juridica.debida_diligencia.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: predioId } = await params
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

    // Predio → persona
    const { data: predio, error: pErr } = await supabase
      .schema('core').from('predios').select('id, aliado_id').eq('id', predioId).single()
    if (pErr || !predio) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
    const aliadoId = predio.aliado_id

    // Documentos de cada consulta (PDF o imagen) → {aliado_id}/antecedentes/{lista}
    // Solo se registra la URL cuando la subida tuvo éxito: escribir null
    // borraría el documento que ya estuviera guardado.
    const urlUpdates: Record<string, string> = {}
    const documentosFallidos: string[] = []
    for (const lista of LISTAS) {
      const file = formData.get(lista) as File | null
      if (file) {
        const url = await subirDocumento(supabase, `${aliadoId}/antecedentes/${lista}`, file)
        if (url) urlUpdates[`${lista}_url`] = url
        else documentosFallidos.push(lista)
      }
    }

    const payload: Record<string, unknown> = {
      aliado_id:       aliadoId,
      created_by:      email,
      observaciones:   data.observaciones || null,
      aprobado:        data.aprobado ?? null,
      pep:             data.pep ?? null,
      prensa_negativa: data.prensa_negativa ?? null,
    }
    for (const lista of LISTAS) {
      payload[lista] = data[lista] ?? null
      if (urlUpdates[`${lista}_url`]) payload[`${lista}_url`] = urlUpdates[`${lista}_url`]
    }

    const { error: upsertErr } = await supabase
      .schema('juridica').from('antecedentes')
      .upsert(payload, { onConflict: 'aliado_id' })
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

    // Avanzar el estado de la debida diligencia del predio
    let nuevoEstado: string | null = null
    if (data.aprobado === true)  nuevoEstado = 'antecedentes_ok'
    if (data.aprobado === false) nuevoEstado = 'rechazado'

    if (nuevoEstado) {
      await supabase.schema('juridica').from('debida_diligencia')
        .update({ estado: nuevoEstado })
        .eq('predio_id', predioId)
      if (nuevoEstado === 'rechazado') {
        await supabase.schema('core').from('expedientes')
          .update({ estado: 'rechazado' })
          .eq('predio_id', predioId)
      } else {
        // Revertir un rechazo de antecedentes debe levantar también el del expediente.
        // El filtro por estado evita pisar un expediente 'archivado' o 'completado'.
        await supabase.schema('core').from('expedientes')
          .update({ estado: 'activo' })
          .eq('predio_id', predioId)
          .eq('estado', 'rechazado')
      }
    }

    return NextResponse.json({ ok: true, documentos_fallidos: documentosFallidos })
  } catch (err) {
    console.error('POST /api/juridica/aliados/[id]/antecedentes error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
