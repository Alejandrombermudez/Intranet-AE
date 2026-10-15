import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'
import { huellaDeClave, normalizarUsuario, problemaDeClave } from '@/lib/clave-geovisor'

/**
 * Cuentas del geovisor (people.usuarios_geovisor). Solo administradores.
 *
 *   GET  → la lista, sin la huella de la contraseña
 *   POST → crear una cuenta { usuario, nombre, organizacion?, nota?, clave }
 *
 * La contraseña llega una sola vez, se guarda su huella y no se devuelve ni se
 * puede volver a leer. Ver docs/sql/migration_usuarios_geovisor.sql.
 */

const COLUMNAS = 'id, usuario, nombre, organizacion, activo, nota, ultimo_ingreso, bloqueado_hasta, created_by, created_at'

/** La tabla todavía no existe: falta correr la migración. */
const sinTabla = (mensaje: string) => /usuarios_geovisor/.test(mensaje) && /(does not exist|schema cache|not find)/i.test(mensaje)
const FALTA_MIGRACION = 'Falta correr docs/sql/migration_usuarios_geovisor.sql en Supabase para poder crear cuentas.'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.admin)
  if (!sesion.ok) return sesion.respuesta

  const { data, error } = await supabase.schema('people').from('usuarios_geovisor')
    .select(COLUMNAS).order('created_at', { ascending: false })
  if (error) {
    if (sinTabla(error.message)) return NextResponse.json({ usuarios: [], faltaMigracion: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ usuarios: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.admin)
  if (!sesion.ok) return sesion.respuesta

  const cuerpo = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!cuerpo) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })

  const u = normalizarUsuario(cuerpo.usuario)
  if ('error' in u) return NextResponse.json({ error: u.error }, { status: 400 })
  const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : ''
  if (!nombre) return NextResponse.json({ error: 'Escribe el nombre de la persona.' }, { status: 400 })
  const problema = problemaDeClave(cuerpo.clave)
  if (problema) return NextResponse.json({ error: problema }, { status: 400 })

  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  const { data, error } = await supabase.schema('people').from('usuarios_geovisor')
    .insert({
      usuario: u.usuario,
      nombre,
      organizacion: texto(cuerpo.organizacion),
      nota: texto(cuerpo.nota),
      clave_hash: await huellaDeClave(cuerpo.clave as string),
      created_by: sesion.perfil.email,   // el de la sesión, no uno que mande el cliente
    })
    .select(COLUMNAS).single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Ya existe una cuenta con el usuario «${u.usuario}».` }, { status: 409 })
    if (sinTabla(error.message)) return NextResponse.json({ error: FALTA_MIGRACION }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ usuario: data }, { status: 201 })
}
