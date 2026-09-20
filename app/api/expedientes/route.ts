import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { listExpedientes } from '@/lib/expedientes'
import { exigirSesion, PUEDE } from '@/lib/auth-api'

// GET /api/expedientes — tablero de predios/expedientes   (Authorization: Bearer <token>)
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  // Acceso: cualquier persona interna (admin, con acceso a intranet o con departamento)
  const sesion = await exigirSesion(req, supabase, PUEDE.intranet)
  if (!sesion.ok) return sesion.respuesta

  try {
    const rows = await listExpedientes(supabase)
    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/expedientes error:', err)
    return NextResponse.json({ error: 'Error al listar' }, { status: 500 })
  }
}
