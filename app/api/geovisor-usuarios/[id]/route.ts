import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'
import { huellaDeClave, problemaDeClave } from '@/lib/clave-geovisor'

/**
 * Una cuenta del geovisor. Solo administradores.
 *
 *   PATCH  → cambiar { nombre?, organizacion?, nota?, activo?, clave? }
 *            · `activo: false` saca a la persona en su siguiente consulta: el
 *              geovisor confirma contra esta tabla en cada lectura con sesión.
 *            · `clave` pone una contraseña nueva y levanta el bloqueo por intentos.
 *   DELETE → borrar la cuenta
 */

const COLUMNAS = 'id, usuario, nombre, organizacion, activo, nota, ultimo_ingreso, bloqueado_hasta, created_by, created_at'
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Contexto = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.admin)
  if (!sesion.ok) return sesion.respuesta

  const { id } = await params
  if (!ES_UUID.test(id)) return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 })
  const cuerpo = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!cuerpo) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })

  const cambios: Record<string, unknown> = {}
  if (typeof cuerpo.nombre === 'string') {
    if (!cuerpo.nombre.trim()) return NextResponse.json({ error: 'El nombre no puede quedar vacío.' }, { status: 400 })
    cambios.nombre = cuerpo.nombre.trim()
  }
  if (typeof cuerpo.organizacion === 'string') cambios.organizacion = cuerpo.organizacion.trim() || null
  if (typeof cuerpo.nota === 'string') cambios.nota = cuerpo.nota.trim() || null
  if (typeof cuerpo.activo === 'boolean') cambios.activo = cuerpo.activo
  if (cuerpo.clave !== undefined) {
    const problema = problemaDeClave(cuerpo.clave)
    if (problema) return NextResponse.json({ error: problema }, { status: 400 })
    cambios.clave_hash = await huellaDeClave(cuerpo.clave as string)
    cambios.intentos_fallidos = 0
    cambios.bloqueado_hasta = null
  }
  if (Object.keys(cambios).length === 0) return NextResponse.json({ error: 'No hay nada que cambiar.' }, { status: 400 })
  cambios.updated_at = new Date().toISOString()

  const { data, error } = await supabase.schema('people').from('usuarios_geovisor')
    .update(cambios).eq('id', id).select(COLUMNAS).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 })
  return NextResponse.json({ usuario: data })
}

export async function DELETE(req: NextRequest, { params }: Contexto) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.admin)
  if (!sesion.ok) return sesion.respuesta

  const { id } = await params
  if (!ES_UUID.test(id)) return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 })

  const { data, error } = await supabase.schema('people').from('usuarios_geovisor')
    .delete().eq('id', id).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
