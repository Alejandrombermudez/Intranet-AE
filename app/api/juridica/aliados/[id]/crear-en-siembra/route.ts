import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/juridica/aliados/[id]/crear-en-siembra   ([id] = predio_id)
// Crea la familia en siembra a partir del caso aprobado y avanza el expediente a 'campo'.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: predioId } = await params
    const supabase = createServerSupabaseClient()
    const body = await req.json()
    const email: string | null = body.created_by ?? null
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    const { data: profile, error: pErr } = await supabase
      .schema('people').from('user_profiles')
      .select('is_admin, department')
      .eq('email', email)
      .single()
    if (pErr || (!profile?.is_admin && !['Juridica', 'RAS'].includes(profile?.department ?? ''))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Predio + persona + DD + expediente
    const { data: predio, error: prErr } = await supabase
      .schema('core').from('predios').select('*').eq('id', predioId).single()
    if (prErr || !predio) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })

    const [{ data: aliado }, { data: dd }, { data: exp }] = await Promise.all([
      supabase.schema('core').from('aliados').select('*').eq('id', predio.aliado_id).single(),
      supabase.schema('juridica').from('debida_diligencia').select('estado').eq('predio_id', predioId).maybeSingle(),
      supabase.schema('core').from('expedientes').select('id').eq('predio_id', predioId).maybeSingle(),
    ])
    if (!aliado) return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })

    if (dd?.estado !== 'aprobado') {
      return NextResponse.json(
        { error: 'La debida diligencia debe estar en estado "aprobado" para crear la familia en Siembra' },
        { status: 422 }
      )
    }

    const expedienteId = exp?.id ?? null

    // ¿Ya existe una familia para este expediente?
    if (expedienteId) {
      const { data: existing } = await supabase
        .schema('siembra').from('familias')
        .select('id').eq('expediente_id', expedienteId).maybeSingle()
      if (existing) {
        return NextResponse.json(
          { error: 'Ya existe una familia en Siembra para este caso', familia_id: existing.id },
          { status: 409 }
        )
      }
    }

    const { data: familia, error: fErr } = await supabase
      .schema('siembra').from('familias')
      .insert({
        aliado_id:          aliado.id,
        expediente_id:      expedienteId,
        nombre_propietario: aliado.nombre_completo,
        tipo_documento:     aliado.tipo_documento,
        numero_documento:   aliado.numero_documento,
        departamento:       predio.departamento,
        municipio:          predio.municipio,
        vereda:             predio.vereda,
        nombre_finca:       predio.nombre_predio,
        nucleo:             predio.zona_ae,
        created_by:         email,
      })
      .select('id')
      .single()

    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

    // Avanzar el expediente a la etapa de campo
    if (expedienteId) {
      await supabase.schema('core').from('expedientes')
        .update({ etapa: 'campo' })
        .eq('id', expedienteId)
    }

    return NextResponse.json({ familia_id: familia?.id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/juridica/aliados/[id]/crear-en-siembra error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
