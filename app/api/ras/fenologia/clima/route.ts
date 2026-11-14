import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'
import { climaPorArbol, type ArbolUbicable } from '@/lib/clima-abierto'

/**
 * /api/ras/fenologia/clima — clima de Open-Meteo en la celda de cada árbol de
 * ras.arboles_monitoreo (ver lib/clima-abierto.ts). Va aparte de
 * /api/ras/fenologia para que la fenología cargue aunque Open-Meteo tarde o
 * falle: la pantalla muestra los calendarios y el clima llega después.
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.ras)
  if (!sesion.ok) return sesion.respuesta

  const { data, error } = await supabase.schema('ras').from('arboles_monitoreo')
    .select('nucleo,codigo,predio,latitud,longitud').eq('activo', true).range(0, 4999)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    return NextResponse.json(await climaPorArbol((data ?? []) as ArbolUbicable[]))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo traer el clima' }, { status: 502 })
  }
}
