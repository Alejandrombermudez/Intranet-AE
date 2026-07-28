import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/juridica/aliados/[id]/cancelar-campo   ([id] = predio_id)
// Deshace "Enviar a Campo": devuelve el expediente de 'campo' a 'juridica' y hace
// soft-delete de la familia creada en siembra. Es reversible por diseño — al
// volver a etapa 'juridica' el predio sale de core.v_predios_campo (que filtra
// etapa IN ('campo','sig_ii')) y por tanto de la app de Campo, pero SIG lo sigue
// viendo en su tablero (muestra 'juridica'), así puede corregir zonas y reenviarlo.
// Se bloquea si ya hay trabajo de campo (siembra.evaluaciones_campo) para no
// borrar datos capturados en terreno.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: predioId } = await params
    const supabase = createServerSupabaseClient()
    const body = await req.json()
    const email: string | null = body.created_by ?? null
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    // Mismo permiso que crear-en-siembra: quien puede enviar puede cancelar
    // (Jurídica, RAS o SIG — el envío/cancelación vive en la página de SIG).
    const { data: profile, error: pErr } = await supabase
      .schema('people').from('user_profiles')
      .select('is_admin, department')
      .eq('email', email)
      .single()
    if (pErr || (!profile?.is_admin && !['Juridica', 'RAS', 'SIG'].includes(profile?.department ?? ''))) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Expediente del predio: solo se cancela un envío que sigue en 'campo'.
    const { data: exp } = await supabase
      .schema('core').from('expedientes')
      .select('id, etapa').eq('predio_id', predioId).maybeSingle()
    if (!exp) return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 })

    if (exp.etapa !== 'campo') {
      return NextResponse.json(
        { error: `Solo se puede cancelar un predio en etapa "campo" (etapa actual: ${exp.etapa ?? 'sin expediente'})`, etapa: exp.etapa },
        { status: 422 }
      )
    }

    // Candado: si ya hay evaluaciones de campo, el trabajo en terreno empezó → no cancelar.
    const { count: evalCount } = await supabase
      .schema('siembra').from('evaluaciones_campo')
      .select('id', { count: 'exact', head: true })
      .eq('expediente_id', exp.id)
    if (evalCount && evalCount > 0) {
      return NextResponse.json(
        { error: 'Ya hay evaluaciones de campo registradas para este predio; no se puede cancelar el envío.' },
        { status: 422 }
      )
    }

    // Soft-delete de la familia activa de este expediente (si existe).
    const { data: familia } = await supabase
      .schema('siembra').from('familias')
      .select('id').eq('expediente_id', exp.id).is('deleted_at', null).maybeSingle()
    if (familia) {
      const { error: fErr } = await supabase
        .schema('siembra').from('familias')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', familia.id)
      if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })
    }

    // Devolver el expediente a Jurídica (estado pre-campo; SIG lo sigue viendo).
    const { error: eErr } = await supabase
      .schema('core').from('expedientes')
      .update({ etapa: 'juridica' })
      .eq('id', exp.id)
    if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

    return NextResponse.json({ ok: true, etapa: 'juridica' }, { status: 200 })
  } catch (err) {
    console.error('POST /api/juridica/aliados/[id]/cancelar-campo error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
