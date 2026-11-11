import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Sesión de /vehiculos, aparte de la de la intranet.
 *
 * Quien entra con usuario + PIN no tiene cuenta de Supabase Auth (a propósito: con las
 * políticas `TO authenticated USING (true)` del proyecto, una cuenta así abriría la
 * intranet por REST). Quien entra con Microsoft sí la tiene, pero aquí también recibe
 * esta cookie: así las rutas de /api/vehiculos identifican a todos de la misma forma,
 * por la cookie firmada, nunca por un id o correo que mande el navegador.
 */

export const COOKIE = 'ae_vehiculos'
const DURACION_MS = 400 * 24 * 3600 * 1000 // ~1 año; el navegador no guarda más

export interface Conductor {
  id: string
  nombre: string
  email: string | null
  es_admin: boolean
}

export function fleet() {
  return createServerSupabaseClient().schema('fleet')
}

export function storage() {
  return createServerSupabaseClient().storage
}

export const BUCKET_FLOTA = 'flota'               // privado: foto del vehículo y tarjeta de propiedad
export const BUCKET_INSPECCION = 'inspection-photos' // el de siempre de las inspecciones

/** VEHICULOS_SECRET si existe; si no, una llave derivada de la service_role (nunca sale del servidor). */
function secreto(): string {
  const propio = process.env.VEHICULOS_SECRET
  if (propio && propio.length >= 16) return propio
  const base = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY')
  return crypto.createHash('sha256').update(`ae-vehiculos:${base}`).digest('hex')
}

function firma(texto: string): string {
  return crypto.createHmac('sha256', secreto()).update(texto).digest('hex')
}

function crearToken(conductorId: string): string {
  const cuerpo = `${conductorId}.${Date.now() + DURACION_MS}`
  return `${cuerpo}.${firma(cuerpo)}`
}

function leerToken(token: string | undefined): string | null {
  if (!token) return null
  const partes = token.split('.')
  if (partes.length !== 3) return null
  const [id, exp, sig] = partes
  const a = Buffer.from(sig)
  const b = Buffer.from(firma(`${id}.${exp}`))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  if (Number(exp) < Date.now()) return null
  return id
}

export function ponerSesion(res: NextResponse, conductorId: string) {
  res.cookies.set(COOKIE, crearToken(conductorId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACION_MS / 1000,
  })
}

export function quitarSesion(res: NextResponse) {
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 })
}

/** Quién llama. Se relee de la base en cada pedido: si lo desactivan, deja de entrar. */
export async function conductorActual(): Promise<Conductor | null> {
  const jar = await cookies()
  const id = leerToken(jar.get(COOKIE)?.value)
  if (!id) return null
  const { data } = await fleet()
    .from('conductores')
    .select('id, nombre, email, es_admin')
    .eq('id', id)
    .eq('activo', true)
    .maybeSingle()
  return (data as Conductor | null) ?? null
}

type Resultado = { ok: true; yo: Conductor } | { ok: false; respuesta: NextResponse }

export async function exigirConductor(soloAdmin = false): Promise<Resultado> {
  const yo = await conductorActual()
  if (!yo) return { ok: false, respuesta: NextResponse.json({ error: 'Inicia sesión.' }, { status: 401 }) }
  if (soloAdmin && !yo.es_admin) return { ok: false, respuesta: NextResponse.json({ error: 'Solo administración.' }, { status: 403 }) }
  return { ok: true, yo }
}

/** Enlace temporal (1 hora) a un archivo del bucket privado. */
export async function enlaceFirmado(ruta: string | null | undefined): Promise<string | null> {
  if (!ruta) return null
  const { data } = await storage().from(BUCKET_FLOTA).createSignedUrl(ruta, 3600)
  return data?.signedUrl ?? null
}
