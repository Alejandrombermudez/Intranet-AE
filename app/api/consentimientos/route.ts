import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { z } from 'zod'

const schema = z.object({
  nombre:    z.string().min(1, 'El nombre es requerido'),
  apellido:  z.string().min(1, 'El apellido es requerido'),
  cedula:    z.string().min(4, 'La cédula es requerida'),
  celular:   z.string().min(7, 'El celular es requerido'),
  correo:    z.string().email('Correo inválido'),
  acepta_tratamiento: z.boolean().refine((v) => v === true, 'Debe aceptar el tratamiento de datos'),
  acepta_politicas:   z.boolean().refine((v) => v === true, 'Debe aceptar las políticas'),
})

/**
 * POST /api/consentimientos
 * Registro público de consentimiento de datos.
 * No requiere autenticación — cualquier persona puede enviar el formulario.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = schema.safeParse(body)

    if (!result.success) {
      const firstError = result.error.errors[0]?.message ?? 'Datos inválidos'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    const { error } = await supabase
      .from('consentimientos')
      .insert({
        nombre:             result.data.nombre.trim(),
        apellido:           result.data.apellido.trim(),
        cedula:             result.data.cedula.trim(),
        celular:            result.data.celular.trim(),
        correo:             result.data.correo.trim().toLowerCase(),
        acepta_tratamiento: result.data.acepta_tratamiento,
        acepta_politicas:   result.data.acepta_politicas,
      })

    if (error) {
      console.error('Error insertando consentimiento:', error.message)
      return NextResponse.json({ error: 'Error al guardar. Intenta de nuevo.' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Error POST /api/consentimientos:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

/**
 * GET /api/consentimientos
 * Devuelve todos los consentimientos con filtro opcional por fecha.
 * Solo usuarios autenticados (Financiero o admin).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Auth: Bearer token
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin, department')
      .eq('email', user.email)
      .single()

    if (!profile?.is_admin && profile?.department !== 'Financiero') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Filtros opcionales por fecha
    const { searchParams } = new URL(req.url)
    const desde = searchParams.get('desde')
    const hasta = searchParams.get('hasta')

    let query = supabase
      .from('consentimientos')
      .select('id, nombre, apellido, cedula, celular, correo, acepta_tratamiento, acepta_politicas, created_at')
      .order('created_at', { ascending: false })

    if (desde) query = query.gte('created_at', desde)
    if (hasta) query = query.lte('created_at', hasta + 'T23:59:59.999Z')

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] }, { status: 200 })
  } catch (err) {
    console.error('Error GET /api/consentimientos:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
