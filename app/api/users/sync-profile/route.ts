import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * POST /api/users/sync-profile
 * Llamado desde el auth callback tras SIGNED_IN.
 * Upserta el perfil del usuario: en conflicto de email solo actualiza
 * full_name y last_login — preserva role, department e is_admin.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const email: string | undefined = body?.email
  const full_name: string | null = body?.full_name ?? null

  if (!email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // Supabase JS v2 upsert: solo sobreescribe las columnas presentes en el objeto.
  // is_admin, role y department NO se incluyen → no se tocan en el UPDATE.
  const { error } = await supabase
    .schema('people').from('user_profiles')
    .upsert(
      { email, full_name, last_login: new Date().toISOString() },
      { onConflict: 'email', ignoreDuplicates: false }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
