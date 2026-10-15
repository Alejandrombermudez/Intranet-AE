import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, esUuid, texto } from '@/lib/administrativa-api'

/**
 * Títulos de acceso a la app de campo de actividades (inventario.titulos_campo).
 * No son personas: el cargo con que alguien entra ese día (BODEGA, SIEMBRA…).
 *
 *   POST  { nombre, rol, bodega_ids[], clave }
 *   PATCH { id, rol?, bodega_ids?, activo?, clave? }
 *
 * La clave se guarda como huella bcrypt con inventario.fijar_clave_titulo, que
 * además cierra las sesiones abiertas con la clave anterior. No se devuelve nunca.
 */
const ROLES = ['bodega', 'siembra', 'monitoreo']
const CLAVE_MINIMA = 6

function bodegasValidas(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  return v.every(esUuid) ? (v as string[]) : null
}

export async function POST(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const nombre = texto(b?.nombre)?.toUpperCase()
  const rol = texto(b?.rol)
  const bodegas = bodegasValidas(b?.bodega_ids ?? [])
  const clave = typeof b?.clave === 'string' ? b.clave : ''
  if (!nombre) return NextResponse.json({ error: 'Escribe el título (por ejemplo VIVERO).' }, { status: 400 })
  if (!rol || !ROLES.includes(rol)) return NextResponse.json({ error: 'Elige qué puede hacer el título.' }, { status: 400 })
  if (!bodegas) return NextResponse.json({ error: 'Bodegas no válidas.' }, { status: 400 })
  if (clave.length < CLAVE_MINIMA) return NextResponse.json({ error: `La clave debe tener al menos ${CLAVE_MINIMA} caracteres.` }, { status: 400 })

  const inv = supabase.schema('inventario')
  const { data, error } = await inv.from('titulos_campo')
    .insert({ nombre, rol, bodega_ids: bodegas, created_by: sesion.perfil.email })
    .select('id').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Ya existe el título «${nombre}».` }, { status: 409 })
    return errorBase(error)
  }
  const { error: e2 } = await inv.rpc('fijar_clave_titulo', { p_id: data.id, p_clave: clave })
  if (e2) return errorBase(e2)
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!esUuid(b?.id)) return NextResponse.json({ error: 'Falta el título.' }, { status: 400 })
  const inv = supabase.schema('inventario')

  const cambios: Record<string, unknown> = {}
  if ('rol' in b!) { if (!ROLES.includes(String(b!.rol))) return NextResponse.json({ error: 'Rol no válido.' }, { status: 400 }); cambios.rol = b!.rol }
  if ('bodega_ids' in b!) { const v = bodegasValidas(b!.bodega_ids); if (!v) return NextResponse.json({ error: 'Bodegas no válidas.' }, { status: 400 }); cambios.bodega_ids = v }
  if (typeof b!.activo === 'boolean') cambios.activo = b!.activo
  if (Object.keys(cambios).length) {
    const { error } = await inv.from('titulos_campo').update(cambios).eq('id', b!.id as string)
    if (error) return errorBase(error)
  }
  // Desactivar cierra las sesiones: la función de sesión ya exige activo, pero
  // así tampoco quedan tokens vivos si se vuelve a activar.
  if (b!.activo === false) await inv.from('sesiones_campo').delete().eq('titulo_id', b!.id as string)

  if (typeof b!.clave === 'string') {
    if (b!.clave.length < CLAVE_MINIMA) return NextResponse.json({ error: `La clave debe tener al menos ${CLAVE_MINIMA} caracteres.` }, { status: 400 })
    const { error } = await inv.rpc('fijar_clave_titulo', { p_id: b!.id, p_clave: b!.clave })
    if (error) return errorBase(error)
  }
  return NextResponse.json({ ok: true })
}
