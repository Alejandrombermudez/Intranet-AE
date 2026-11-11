import { NextRequest, NextResponse } from 'next/server'
import { esPinValido, hacerHuella, pinCoincide } from '@/lib/vehiculos/pin'
import { fleet, ponerSesion } from '@/lib/vehiculos/sesion'

const MAX_INTENTOS = 5
const BLOQUEO_MIN = 5

/**
 * POST /api/vehiculos/entrar — usuario (de la lista) + PIN.
 *
 * El PIN que pone administración es de una sola vez (`pin_temporal`): con él la persona
 * entra, pero antes de recibir la sesión tiene que escribir uno nuevo (`nuevoPin`).
 * Como son solo 4 dígitos, lo que protege es el bloqueo: 5 errados → 5 minutos.
 */
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null)
  const conductorId = b?.conductorId
  const pin = b?.pin
  const nuevoPin = b?.nuevoPin
  if (typeof conductorId !== 'string' || !esPinValido(pin)) {
    return NextResponse.json({ error: 'El PIN son 4 números.' }, { status: 400 })
  }

  const db = fleet()
  const { data: c } = await db
    .from('conductores')
    .select('id, nombre, es_admin, pin_hash, pin_temporal, intentos, bloqueado_hasta')
    .eq('id', conductorId)
    .eq('activo', true)
    .maybeSingle()
  if (!c || !c.pin_hash) return NextResponse.json({ error: 'Esa persona no tiene PIN asignado. Pídelo a administración.' }, { status: 404 })

  if (c.bloqueado_hasta && new Date(c.bloqueado_hasta) > new Date()) {
    const min = Math.ceil((new Date(c.bloqueado_hasta).getTime() - Date.now()) / 60000)
    return NextResponse.json({ error: `Demasiados intentos. Espera ${min} min e intenta de nuevo.` }, { status: 429 })
  }

  if (!pinCoincide(pin, c.pin_hash)) {
    const intentos = (c.intentos ?? 0) + 1
    const bloquear = intentos >= MAX_INTENTOS
    await db.from('conductores').update({
      intentos: bloquear ? 0 : intentos,
      bloqueado_hasta: bloquear ? new Date(Date.now() + BLOQUEO_MIN * 60000).toISOString() : null,
    }).eq('id', c.id)
    return NextResponse.json(
      { error: bloquear ? `PIN incorrecto. Bloqueado ${BLOQUEO_MIN} min.` : `PIN incorrecto. Te quedan ${MAX_INTENTOS - intentos} intentos.` },
      { status: 401 },
    )
  }

  const cambios: Record<string, unknown> = { intentos: 0, bloqueado_hasta: null }
  if (c.pin_temporal) {
    // PIN de administración: primero hay que crear el propio.
    if (nuevoPin === undefined) {
      await db.from('conductores').update(cambios).eq('id', c.id)
      return NextResponse.json({ debeCambiar: true })
    }
    if (!esPinValido(nuevoPin)) return NextResponse.json({ error: 'El PIN nuevo son 4 números.' }, { status: 400 })
    if (nuevoPin === pin) return NextResponse.json({ error: 'El PIN nuevo tiene que ser distinto al que te dieron.' }, { status: 400 })
    cambios.pin_hash = hacerHuella(nuevoPin)
    cambios.pin_temporal = false
    cambios.updated_at = new Date().toISOString()
  }
  await db.from('conductores').update(cambios).eq('id', c.id)

  const res = NextResponse.json({ yo: { id: c.id, nombre: c.nombre, esAdmin: c.es_admin } })
  ponerSesion(res, c.id)
  return res
}
