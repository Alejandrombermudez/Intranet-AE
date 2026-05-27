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

const LISTAS = [
  'rama_judicial', 'procuraduria', 'contraloria', 'policia_nacional', 'rnmc',
  'onu', 'ofac', 'bid', 'banco_mundial', 'hm_treasury', 'fbi', 'interpol', 'ue_terroristas', 'dea',
] as const

// POST /api/juridica/aliados/[id]/antecedentes — upsert HOJA 2
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    const { data: aliado, error: aErr } = await supabase
      .schema('juridica').from('aliados')
      .select('id, estado')
      .eq('id', id)
      .single()
    if (aErr || !aliado) return NextResponse.json({ error: 'Aliado no encontrado' }, { status: 404 })

    const urlUpdates: Record<string, string | null> = {}
    for (const lista of LISTAS) {
      const file = formData.get(lista) as File | null
      if (file) {
        const path = `${id}/antecedentes/${lista}.pdf`
        await supabase.storage.from('juridica-documentos').remove([path])
        const { error: upErr } = await supabase.storage
          .from('juridica-documentos')
          .upload(path, file, { contentType: 'application/pdf' })
        if (!upErr) {
          const { data: signed } = await supabase.storage
            .from('juridica-documentos')
            .createSignedUrl(path, 60 * 60 * 24 * 365 * 5)
          urlUpdates[`${lista}_url`] = signed?.signedUrl ?? null
        }
      }
    }

    const payload: Record<string, unknown> = {
      aliado_id:       id,
      created_by:      email,
      observaciones:   data.observaciones || null,
      aprobado:        data.aprobado ?? null,
      pep:             data.pep ?? null,
      prensa_negativa: data.prensa_negativa ?? null,
    }

    for (const lista of LISTAS) {
      payload[lista] = data[lista] ?? null
      if (urlUpdates[`${lista}_url`] !== undefined) {
        payload[`${lista}_url`] = urlUpdates[`${lista}_url`]
      }
    }

    const { error: upsertErr } = await supabase
      .schema('juridica')
      .from('antecedentes')
      .upsert(payload, { onConflict: 'aliado_id' })

    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

    let nuevoEstado: string | null = null
    if (data.aprobado === true)  nuevoEstado = 'antecedentes_ok'
    if (data.aprobado === false) nuevoEstado = 'rechazado'

    if (nuevoEstado) {
      await supabase.schema('juridica').from('aliados')
        .update({ estado: nuevoEstado })
        .eq('id', id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/juridica/aliados/[id]/antecedentes error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
