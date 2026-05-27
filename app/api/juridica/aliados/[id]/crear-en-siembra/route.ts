import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/juridica/aliados/[id]/crear-en-siembra
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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

    const { data: aliado, error: aErr } = await supabase
      .schema('juridica').from('aliados')
      .select('*')
      .eq('id', id)
      .single()

    if (aErr || !aliado) return NextResponse.json({ error: 'Aliado no encontrado' }, { status: 404 })
    if (aliado.estado !== 'aprobado') {
      return NextResponse.json(
        { error: 'El aliado debe estar en estado "aprobado" para crear la familia en Siembra' },
        { status: 422 }
      )
    }

    const { data: existing } = await supabase
      .schema('siembra').from('familias')
      .select('id')
      .eq('aliado_id', id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una familia en Siembra vinculada a este aliado', familia_id: existing.id },
        { status: 409 }
      )
    }

    const { data: familia, error: fErr } = await supabase
      .schema('siembra').from('familias')
      .insert({
        aliado_id:          aliado.id,
        nombre_propietario: aliado.nombre_completo,
        tipo_documento:     aliado.tipo_documento,
        numero_documento:   aliado.numero_documento,
        departamento:       aliado.departamento,
        municipio:          aliado.municipio,
        vereda:             aliado.vereda,
        nombre_finca:       aliado.nombre_predio,
        nucleo:             aliado.zona_ae,
        created_by:         email,
      })
      .select('id')
      .single()

    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

    return NextResponse.json({ familia_id: familia?.id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/juridica/aliados/[id]/crear-en-siembra error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
