import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ponerSesion } from '@/lib/vehiculos/sesion'

/**
 * POST /api/vehiculos/entrar-microsoft — quien tiene correo corporativo entra con Microsoft
 * (el mismo inicio de sesión de la intranet) y aquí recibe la sesión de vehículos.
 *
 * El correo sale del token verificado contra Supabase Auth, nunca del cuerpo. Si la persona
 * no está en fleet.conductores se crea con su nombre del perfil. Quién administra lo decide
 * un administrador en «Personas y PIN» (es_admin); solo si todavía no hay ningún
 * administrador activo, el administrador de la intranet que entre queda como tal, para
 * que la app nunca quede sin quien la maneje.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return NextResponse.json({ error: 'No llegó la sesión de Microsoft. Intenta de nuevo.' }, { status: 401 })

  const supabase = createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  const email = user?.email?.toLowerCase()
  if (error || !email) return NextResponse.json({ error: 'Tu sesión de Microsoft venció. Intenta de nuevo.' }, { status: 401 })
  if (!email.endsWith('@amazoniaemprende.com')) {
    return NextResponse.json({ error: 'Con Microsoft solo entran cuentas @amazoniaemprende.com. Usa usuario y PIN.' }, { status: 403 })
  }

  const { data: perfil } = await supabase
    .schema('people').from('user_profiles')
    .select('full_name, is_admin')
    .eq('email', email)
    .maybeSingle()
  const meta = user!.user_metadata ?? {}
  const nombre = String(perfil?.full_name || meta.full_name || meta.name || email.split('@')[0]).trim().replace(/\s+/g, ' ')

  const fleet = supabase.schema('fleet')
  const { count: admins } = await fleet.from('conductores').select('id', { count: 'exact', head: true }).eq('es_admin', true).eq('activo', true)
  const arrancar = perfil?.is_admin === true && !admins
  const { data: existente } = await fleet
    .from('conductores')
    .select('id, nombre, activo, es_admin')
    .ilike('email', email)
    .maybeSingle()

  let id: string
  let nombreFinal = nombre
  let esAdmin = arrancar
  if (existente) {
    if (!existente.activo) return NextResponse.json({ error: 'Tu usuario de vehículos está desactivado. Habla con administración.' }, { status: 403 })
    id = existente.id
    nombreFinal = existente.nombre
    esAdmin = existente.es_admin || arrancar
    if (arrancar && !existente.es_admin) await fleet.from('conductores').update({ es_admin: true, updated_at: new Date().toISOString() }).eq('id', id)
  } else {
    const { data: nuevo, error: e } = await fleet
      .from('conductores')
      .insert({ nombre, email, es_admin: esAdmin })
      .select('id')
      .single()
    if (e) {
      const repetido = e.code === '23505'
      return NextResponse.json(
        { error: repetido ? `Ya hay alguien llamado «${nombre}» en la lista de vehículos. Pide a administración que le ponga tu correo.` : e.message },
        { status: repetido ? 409 : 500 },
      )
    }
    id = nuevo.id
  }

  const res = NextResponse.json({ yo: { id, nombre: nombreFinal, esAdmin } })
  ponerSesion(res, id)
  return res
}
