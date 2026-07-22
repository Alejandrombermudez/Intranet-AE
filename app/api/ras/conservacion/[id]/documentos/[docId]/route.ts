import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const BUCKET = 'ras-documentos-privados'

async function authCheck(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { error: 'No autenticado', status: 401, supabase }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user?.email) return { error: 'No autenticado', status: 401, supabase }

  const { data: profile, error: profileError } = await supabase
    .schema('people').from('user_profiles').select('is_admin, department').eq('email', user.email).single()
  if (profileError || (!profile?.is_admin && profile?.department !== 'RAS')) {
    return { error: 'No autorizado', status: 403, supabase }
  }
  return { error: null, status: 200, supabase }
}

// DELETE — elimina un documento (fila + objeto del bucket privado)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  try {
    const { docId } = await params
    const auth = await authCheck(req)
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const supabase = auth.supabase

    const { data: doc } = await supabase
      .schema('ras').from('documentos_familia').select('storage_path').eq('id', docId).single()

    if (doc?.storage_path) {
      try { await supabase.storage.from(BUCKET).remove([doc.storage_path]) } catch { /* no bloquear */ }
    }

    const { error } = await supabase.schema('ras').from('documentos_familia').delete().eq('id', docId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('DELETE /api/ras/conservacion/[id]/documentos/[docId] error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
