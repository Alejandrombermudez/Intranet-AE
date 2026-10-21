import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'
import { normalizarVereda } from '@/lib/veredas-caqueta'
import { valorAplicable, type AccionAlerta, type Alerta } from '@/lib/alertas-juridica'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/juridica/alertas/[id] — una alerta (la ficha nueva la usa para
// llegar con los datos de la finca del SIG, sin pasarlos por la URL).
export async function GET(req: NextRequest, { params }: Ctx) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.juridica)
  if (!sesion.ok) return sesion.respuesta
  const { id } = await params
  const { data, error } = await supabase.schema('juridica').from('alertas').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: 'No se pudo leer la alerta' }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'La alerta no existe' }, { status: 404 })
  return NextResponse.json(data)
}

/**
 * PATCH /api/juridica/alertas/[id] — { accion, nota?, predio_id? }
 *   aplicar   escribe la sugerencia en core.predios (normalizada) y la resuelve
 *   resolver  la marca resuelta («ya lo corregí»); predio_id liga la ficha que
 *             se acaba de crear para una finca que no estaba registrada
 *   descartar no es un problema; pide nota (por qué)
 *   reabrir   vuelve a abierta
 * Quién la cerró sale del token, no del cuerpo.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.juridica)
  if (!sesion.ok) return sesion.respuesta
  const { id } = await params

  const body = await req.json().catch(() => ({})) as { accion?: AccionAlerta; nota?: string; predio_id?: string }
  const nota = String(body.nota ?? '').trim() || null

  const { data: alerta, error: aErr } = await supabase.schema('juridica').from('alertas').select('*').eq('id', id).maybeSingle()
  if (aErr) return NextResponse.json({ error: 'No se pudo leer la alerta' }, { status: 500 })
  if (!alerta) return NextResponse.json({ error: 'La alerta no existe' }, { status: 404 })
  const a = alerta as Alerta

  const cerrar = (estado: 'resuelta' | 'descartada', notaFinal: string | null, extra: Record<string, unknown> = {}) => ({
    estado, nota: notaFinal, resuelta_por: sesion.perfil.email, resuelta_at: new Date().toISOString(), ...extra,
  })

  let cambio: Record<string, unknown>
  switch (body.accion) {
    case 'aplicar': {
      if (!a.predio_id || !a.campo || !a.valor_sugerido) {
        return NextResponse.json({ error: 'Esta alerta no trae una corrección para aplicar' }, { status: 422 })
      }
      const { data: predio, error: pErr } = await supabase.schema('core').from('predios')
        .select('id, municipio, vereda').eq('id', a.predio_id).maybeSingle()
      if (pErr) return NextResponse.json({ error: 'No se pudo leer el predio' }, { status: 500 })
      if (!predio) return NextResponse.json({ error: 'El predio ya no existe' }, { status: 404 })

      // Municipio y vereda en su escritura canónica, como en la ficha. Si cambia
      // el municipio, la vereda se vuelve a normalizar contra el nuevo.
      const valor = valorAplicable(a.campo, a.valor_sugerido, predio.municipio)
      if (!valor) return NextResponse.json({ error: `«${a.valor_sugerido}» no es un valor válido para ${a.campo}` }, { status: 422 })
      const update: Record<string, unknown> = { [a.campo]: valor }
      if (a.campo === 'municipio' && predio.vereda) update.vereda = normalizarVereda(valor, predio.vereda) || null

      const { error: uErr } = await supabase.schema('core').from('predios').update(update).eq('id', a.predio_id)
      if (uErr) {
        console.error('PATCH alertas aplicar:', uErr)
        return NextResponse.json({ error: 'No se pudo corregir el predio' }, { status: 500 })
      }
      cambio = cerrar('resuelta', nota ?? `Se aplicó: ${valor}`)
      break
    }
    case 'resolver':
      cambio = cerrar('resuelta', nota, body.predio_id && !a.predio_id ? { predio_id: body.predio_id } : {})
      break
    case 'descartar':
      if (!nota) return NextResponse.json({ error: 'Escribe por qué no es un problema' }, { status: 400 })
      cambio = cerrar('descartada', nota)
      break
    case 'reabrir':
      cambio = { estado: 'abierta', resuelta_por: null, resuelta_at: null }
      break
    default:
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  }

  const { data, error } = await supabase.schema('juridica').from('alertas').update(cambio).eq('id', id).select('*').single()
  if (error) {
    console.error('PATCH /api/juridica/alertas error:', error)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json(data)
}
