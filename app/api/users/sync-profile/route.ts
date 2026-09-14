import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/users/sync-profile   (Authorization: Bearer <access_token>)
 *
 * Registra que la persona ENTRÓ a la intranet: pone `last_login` en ahora.
 * Lo llaman `lib/registro-acceso.ts` al abrir cualquier página con sesión
 * (como mucho cada 30 min por persona) y el callback de Microsoft al iniciar
 * sesión.
 *
 * Por qué no basta el trigger de `auth.users`: ese solo salta al INICIAR
 * sesión, y la sesión se renueva sola en el navegador sin volver a pasar por
 * Microsoft. Con solo el trigger, la abogada figuraba sin entrar desde junio
 * mientras guardaba antecedentes en septiembre.
 *
 * El correo sale del token, nunca del cuerpo: antes la ruta aceptaba cualquier
 * `email` y cualquiera podía reescribirle el nombre o la fecha a otra cuenta.
 *
 * `full_name` solo se completa si el perfil no tiene uno. El nombre que manda
 * Microsoft lo sincroniza el trigger en cada inicio de sesión; aquí no se pisa
 * en cada visita.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user?.email) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  // Azure AD manda el nombre en 'full_name' o en 'name'
  const meta = user.user_metadata ?? {}
  const nombre = (meta.full_name as string | undefined) || (meta.name as string | undefined) || null
  const ahora = new Date().toISOString()

  const { data: actualizados, error } = await supabase
    .schema('people').from('user_profiles')
    .update({ last_login: ahora })
    .eq('email', user.email)
    .select('full_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!actualizados || actualizados.length === 0) {
    // Sin perfil todavía (el trigger lo crea al registrarse; esto es el respaldo).
    // Solo se escriben estas tres columnas: permisos y departamento quedan en
    // sus valores por defecto, sin acceso.
    const { error: insErr } = await supabase
      .schema('people').from('user_profiles')
      .insert({ email: user.email, full_name: nombre, last_login: ahora })
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  } else if (!actualizados[0].full_name && nombre) {
    await supabase.schema('people').from('user_profiles')
      .update({ full_name: nombre })
      .eq('email', user.email)
  }

  return NextResponse.json({ ok: true })
}
