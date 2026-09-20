/**
 * Quién llama a una API route — SIEMPRE a partir del token de sesión.
 *
 * Hasta el 2026-09-14, 18 rutas autorizaban con un correo que mandaba el propio
 * cliente (`?email=`, `created_by`, `requesterEmail`): cualquiera sin sesión
 * podía escribir `legal@…` y leer todo jurídica, o darse administrador desde el
 * panel de usuarios. Aquí el correo sale del token, verificado contra Supabase
 * Auth, y el perfil se lee con ese correo. Lo que llegue en query o cuerpo no
 * identifica a nadie.
 *
 * Uso en una ruta:
 *
 *   const sesion = await exigirSesion(req, supabase, PUEDE.juridica)
 *   if (!sesion.ok) return sesion.respuesta
 *   const email = sesion.perfil.email      // para created_by, rutas de storage…
 *
 * En el navegador, llamar con `fetchConSesion` (lib/fetch-sesion.ts), que pone
 * el header `Authorization: Bearer <token>`.
 */
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

type SB = ReturnType<typeof createServerSupabaseClient>

export interface PerfilSesion {
  email: string
  is_admin: boolean
  department: string | null
  can_access_intranet: boolean
}

export type Regla = (p: PerfilSesion) => boolean

/**
 * Las reglas que ya tenía cada ruta, con nombre. Cambiar CÓMO se identifica a la
 * persona no cambia QUIÉN puede: cada ruta conserva exactamente su regla.
 */
export const PUEDE = {
  /** Panel de usuarios: cambiar permisos. */
  admin:      (p: PerfilSesion) => p.is_admin,
  /** Módulo jurídico y sus catálogos. */
  juridica:   (p: PerfilSesion) => p.is_admin || p.department === 'Juridica',
  /** Módulo RAS: familias, conservación, fotos de árboles y del catálogo. */
  ras:        (p: PerfilSesion) => p.is_admin || p.department === 'RAS',
  /** Estadísticas del hub. */
  financiero: (p: PerfilSesion) => p.is_admin || p.department === 'Financiero',
  /** Enviar a campo / cancelar / subir zonas: los tres equipos que tocan el predio. */
  procesoPredio: (p: PerfilSesion) => p.is_admin || ['Juridica', 'RAS', 'SIG'].includes(p.department ?? ''),
  /** Lectura transversal (tablero, reporte, SIG): cualquiera con acceso a la intranet. */
  intranet:   (p: PerfilSesion) => p.is_admin || p.can_access_intranet || !!p.department,
  /** Cualquier persona con sesión y perfil (la ruta decide lo demás, p. ej. dueño de la reserva). */
  conSesion:  (() => true) as Regla,
}

export type ResultadoSesion =
  | { ok: true; perfil: PerfilSesion }
  | { ok: false; respuesta: NextResponse }

const rechazo = (status: number, error: string): ResultadoSesion =>
  ({ ok: false, respuesta: NextResponse.json({ error }, { status }) })

export async function exigirSesion(req: Request, supabase: SB, regla: Regla): Promise<ResultadoSesion> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null
  // El mensaje dice qué hacer: el caso típico es una pestaña abierta desde antes
  // de que las rutas empezaran a pedir token, con el código viejo cargado.
  if (!token) return rechazo(401, 'La sesión no llegó al servidor. Recarga la página e intenta de nuevo.')

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user?.email) {
    return rechazo(401, 'Tu sesión venció. Recarga la página; si sigue, cierra sesión y vuelve a entrar.')
  }

  const { data: perfil } = await supabase
    .schema('people').from('user_profiles')
    .select('email, is_admin, department, can_access_intranet')
    .eq('email', user.email)
    .maybeSingle()

  if (!perfil) return rechazo(403, 'Tu usuario no tiene perfil en la intranet.')

  const p: PerfilSesion = {
    email: user.email,
    is_admin: perfil.is_admin === true,
    department: perfil.department ?? null,
    can_access_intranet: perfil.can_access_intranet === true,
  }
  if (!regla(p)) return rechazo(403, 'No autorizado')

  return { ok: true, perfil: p }
}
