import { NextRequest, NextResponse } from 'next/server'
import { exigirConductor, fleet } from '@/lib/vehiculos/sesion'
import { esPinValido, hacerHuella } from '@/lib/vehiculos/pin'

export const dynamic = 'force-dynamic'

/** GET /api/vehiculos/admin/personas — todos, con o sin correo, activos e inactivos. */
export async function GET() {
  const s = await exigirConductor(true)
  if (!s.ok) return s.respuesta
  const { data, error } = await fleet()
    .from('conductores')
    .select('id, nombre, email, es_admin, activo, pin_hash, pin_temporal, bloqueado_hasta')
    .order('activo', { ascending: false })
    .order('nombre')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    personas: (data ?? []).map((c) => ({
      id: c.id, nombre: c.nombre, email: c.email, esAdmin: c.es_admin, activo: c.activo,
      pin: !c.pin_hash ? 'sin' : c.pin_temporal ? 'inicial' : 'propio',
      bloqueado: !!c.bloqueado_hasta && new Date(c.bloqueado_hasta) > new Date(),
    })),
  })
}

/** POST /api/vehiculos/admin/personas { nombre, email?, pin? } — agregar a alguien; el PIN es el inicial, de una sola vez. */
export async function POST(req: NextRequest) {
  const s = await exigirConductor(true)
  if (!s.ok) return s.respuesta
  const b = await req.json().catch(() => null)
  const nombre = String(b?.nombre ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
  const email = String(b?.email ?? '').trim().toLowerCase() || null
  const pin = b?.pin ? String(b.pin) : ''
  if (nombre.length < 3) return NextResponse.json({ error: 'Escribe el nombre completo.' }, { status: 400 })
  if (email && !/^[^@\s]+@[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Ese correo no parece correcto.' }, { status: 400 })
  if (pin && !esPinValido(pin)) return NextResponse.json({ error: 'El PIN inicial son 4 números.' }, { status: 400 })

  const { error } = await fleet().from('conductores').insert({
    nombre, email,
    ...(pin ? { pin_hash: hacerHuella(pin), pin_temporal: true } : {}),
  })
  if (error) {
    const repetido = error.code === '23505'
    return NextResponse.json({ error: repetido ? 'Ya existe alguien con ese nombre o correo.' : error.message }, { status: repetido ? 409 : 500 })
  }
  return NextResponse.json({ ok: true })
}

/**
 * PATCH /api/vehiculos/admin/personas { id, accion, pin? }
 *   pin         → pone un PIN inicial (de una sola vez): para el primer ingreso o si lo olvidó.
 *   desactivar / activar
 */
export async function PATCH(req: NextRequest) {
  const s = await exigirConductor(true)
  if (!s.ok) return s.respuesta
  const b = await req.json().catch(() => null)
  const id = String(b?.id ?? '')
  const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() }
  switch (b?.accion) {
    case 'pin':
      if (!esPinValido(b?.pin)) return NextResponse.json({ error: 'El PIN inicial son 4 números.' }, { status: 400 })
      Object.assign(cambios, { pin_hash: hacerHuella(b.pin), pin_temporal: true, intentos: 0, bloqueado_hasta: null })
      break
    case 'desactivar':
      if (id === s.yo.id) return NextResponse.json({ error: 'No puedes desactivarte a ti mismo.' }, { status: 409 })
      cambios.activo = false
      break
    case 'activar':
      cambios.activo = true
      break
    default:
      return NextResponse.json({ error: 'Acción desconocida.' }, { status: 400 })
  }
  const { error } = await fleet().from('conductores').update(cambios).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
