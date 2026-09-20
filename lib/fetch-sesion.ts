import { supabase } from '@/lib/supabase'

/**
 * `fetch` hacia las API routes de la intranet con la sesión de quien está
 * conectado: agrega `Authorization: Bearer <token>`. Las rutas identifican a la
 * persona SOLO por ese token (lib/auth-api.ts); un correo en la URL o en el
 * cuerpo ya no cuenta.
 *
 * `getSession()` renueva el token si venció, así que una pestaña abierta desde
 * hace horas sigue funcionando.
 */
export async function fetchConSesion(input: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
  return fetch(input, { ...init, headers })
}
