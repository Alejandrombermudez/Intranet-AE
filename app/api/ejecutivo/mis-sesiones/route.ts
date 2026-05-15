import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user?.email) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase.schema('people').from('user_profiles')
    .select('id').eq('email', user.email).single()
  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  const { data, error } = await supabase
    .schema('ejecutivo').from('sesiones')
    .select(`
      *,
      indicaciones(*),
      ejecutivo:ejecutivo_id(id, full_name, email)
    `)
    .eq('persona_id', profile.id)
    .order('fecha', { ascending: false })
    .order('orden', { referencedTable: 'indicaciones', ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
