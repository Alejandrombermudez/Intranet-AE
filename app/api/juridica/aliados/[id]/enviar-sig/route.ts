import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/juridica/aliados/[id]/enviar-sig   ([id] = predio_id)
// Avanza el expediente del predio aprobado a la etapa SIG I (zonas potenciales).
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
    if (pErr || (!profile?.is_admin && !['Juridica', 'RAS', 'SIG'].includes(profile?.department ?? ''))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Se puede enviar a SIG en cualquier estado de la debida diligencia (la persona
    // completa jurídica en paralelo mientras el predio ya está en zonificación). El
    // único bloqueo es un caso explícitamente RECHAZADO. El candado fuerte "DD aprobada"
    // se mantiene aguas abajo, en SIG → Campo (crear-en-siembra), antes del trabajo de campo.
    const { data: dd } = await supabase
      .schema('juridica').from('debida_diligencia')
      .select('estado').eq('predio_id', predioId).maybeSingle()
    if (dd?.estado === 'rechazado') {
      return NextResponse.json(
        { error: 'El caso fue rechazado en la debida diligencia; no puede enviarse a SIG.' },
        { status: 422 }
      )
    }

    const { data: exp } = await supabase
      .schema('core').from('expedientes')
      .select('id, etapa').eq('predio_id', predioId).maybeSingle()
    if (!exp) return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 })

    if (exp.etapa !== 'juridica') {
      return NextResponse.json(
        { error: `El predio ya fue enviado al proceso (etapa actual: ${exp.etapa})`, etapa: exp.etapa },
        { status: 409 }
      )
    }

    await supabase.schema('core').from('expedientes')
      .update({ etapa: 'sig_i' })
      .eq('id', exp.id)

    return NextResponse.json({ ok: true, expediente_id: exp.id }, { status: 200 })
  } catch (err) {
    console.error('POST /api/juridica/aliados/[id]/enviar-sig error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
