import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// POST /api/juridica/aliados/[id]/crear-en-siembra   ([id] = predio_id)
// "Enviar a Campo": crea la familia en siembra (enlazada a core, sin duplicar
// identidad) y avanza el expediente de 'juridica'/'sig_i' a 'campo'. Es la acción que
// habilita el predio en la app de Campo (core.v_predios_campo) — por eso
// exige que el SIG ya haya subido al menos una zona real (geo.zonas), no
// solo que Jurídica haya aprobado. Ver ARQUITECTURA_DATOS.md §3.3/§3.1.
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

    // Predio + persona + DD + expediente + zonas del SIG
    const { data: predio, error: prErr } = await supabase
      .schema('core').from('predios').select('*').eq('id', predioId).single()
    if (prErr || !predio) return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 })

    const [{ data: aliado }, { data: exp }, { count: zonasCount }] = await Promise.all([
      supabase.schema('core').from('aliados').select('*').eq('id', predio.aliado_id).single(),
      supabase.schema('core').from('expedientes').select('id, etapa').eq('predio_id', predioId).maybeSingle(),
      supabase.schema('geo').from('zonas').select('id', { count: 'exact', head: true })
        .eq('predio_id', predioId).eq('tipo', 'restauracion'),
    ])
    if (!aliado) return NextResponse.json({ error: 'Persona no encontrada' }, { status: 404 })

    // El análisis SIG y la activación a Campo se hacen pase o no pase la debida
    // diligencia (decisión de reunión): NO se exige DD 'aprobado'. El candado real
    // de Campo es SIG: expediente en 'juridica'/'sig_i' + al menos una zona de siembra.
    if (exp?.etapa !== 'sig_i' && exp?.etapa !== 'juridica') {
      return NextResponse.json(
        { error: `El expediente debe estar en etapa "jurídica" o "sig_i" para enviarse a Campo (etapa actual: ${exp?.etapa ?? 'sin expediente'})` },
        { status: 422 }
      )
    }

    if (!zonasCount || zonasCount === 0) {
      return NextResponse.json(
        { error: 'El SIG debe subir al menos un sitio de siembra (geo.zonas, tipo "restauracion") antes de habilitar el predio en Campo' },
        { status: 422 }
      )
    }

    const expedienteId = exp.id

    // ¿Ya existe una familia ACTIVA para este expediente? (Las soft-deleted por
    // un "cancelar-campo" previo no cuentan: permiten reenviar tras cancelar.)
    const { data: existing } = await supabase
      .schema('siembra').from('familias')
      .select('id').eq('expediente_id', expedienteId).is('deleted_at', null).maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe una familia en Siembra para este caso', familia_id: existing.id },
        { status: 409 }
      )
    }

    // Identidad/ubicación NO se duplican: predio_id/aliado_id/expediente_id
    // son las únicas llaves — se leen por JOIN (core.v_predios_campo).
    const { data: familia, error: fErr } = await supabase
      .schema('siembra').from('familias')
      .insert({
        predio_id:     predioId,
        aliado_id:     aliado.id,
        expediente_id: expedienteId,
        created_by:    email,
      })
      .select('id')
      .single()

    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

    // Avanzar el expediente a la etapa de campo
    await supabase.schema('core').from('expedientes')
      .update({ etapa: 'campo' })
      .eq('id', expedienteId)

    return NextResponse.json({ familia_id: familia?.id }, { status: 201 })
  } catch (err) {
    console.error('POST /api/juridica/aliados/[id]/crear-en-siembra error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
