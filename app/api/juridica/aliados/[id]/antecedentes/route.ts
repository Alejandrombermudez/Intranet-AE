import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { subirDocumento, recalcularEstadoDD } from '@/lib/juridica-core'
import { hoja3Habilitada } from '@/lib/juridica-schema'
import { exigirSesion, PUEDE } from '@/lib/auth-api'

const LISTAS = [
  'rama_judicial', 'procuraduria', 'contraloria', 'policia_nacional', 'rnmc',
  'onu', 'ofac', 'bid', 'banco_mundial', 'hm_treasury', 'fbi', 'interpol', 'ue_terroristas', 'dea',
] as const

// POST /api/juridica/aliados/[id]/antecedentes — upsert HOJA 3   ([id] = predio_id)
// Antecedentes pertenece a la PERSONA (core.aliados): se veta una vez y sirve
// para todos sus predios. El estado del workflow vive en juridica.debida_diligencia.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: predioId } = await params
    const supabase = createServerSupabaseClient()
    const sesion = await exigirSesion(req, supabase, PUEDE.juridica)
    if (!sesion.ok) return sesion.respuesta
    const email = sesion.perfil.email

    const formData = await req.formData()
    const raw = formData.get('data')
    if (!raw || typeof raw !== 'string') {
      return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })
    }
    const data = JSON.parse(raw)

    // Predio → persona
    const { data: predio, error: pErr } = await supabase
      .schema('core').from('predios').select('id, aliado_id').eq('id', predioId).single()
    if (pErr || !predio) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })
    const aliadoId = predio.aliado_id

    // Precondición: la HOJA 2 (análisis del folio) dejó un semáforo que no es rojo.
    // Se revisa ANTES de subir los soportes, para no dejar archivos huérfanos de
    // un guardado rechazado. Se mira el dato de la hoja y no el estado de la DD,
    // que es derivado. Si la persona ya tiene antecedentes (de otro predio o de
    // antes del cambio de orden) se deja editarlos igual.
    const [{ data: analisis }, { data: antPrevio }] = await Promise.all([
      supabase.schema('juridica').from('analisis_juridico')
        .select('semaforo').eq('predio_id', predioId).maybeSingle(),
      supabase.schema('juridica').from('antecedentes')
        .select('id').eq('aliado_id', aliadoId).maybeSingle(),
    ])
    if (!hoja3Habilitada(analisis?.semaforo, !!antPrevio)) {
      return NextResponse.json({
        error: analisis?.semaforo === 'rojo'
          ? 'El análisis jurídico (HOJA 2) quedó en rojo: el predio no procede y no hace falta revisar antecedentes.'
          : 'Primero el análisis jurídico (HOJA 2): los antecedentes se revisan cuando el folio tiene semáforo verde, amarillo o naranja.',
      }, { status: 422 })
    }

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

    // Los antecedentes son de la persona: el veredicto mueve el estado de TODOS
    // sus predios, no solo del que está abierto.
    const { data: prediosPersona } = await supabase
      .schema('core').from('predios').select('id').eq('aliado_id', aliadoId)
    const errEstado = await recalcularEstadoDD(supabase, (prediosPersona ?? []).map((p) => p.id))
    if (errEstado) {
      return NextResponse.json(
        { error: `Los antecedentes se guardaron, pero no se pudo actualizar el estado del caso: ${errEstado}` },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, documentos_fallidos: documentosFallidos })
  } catch (err) {
    console.error('POST /api/juridica/aliados/[id]/antecedentes error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
