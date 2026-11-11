import { NextResponse } from 'next/server'
import { quitarSesion } from '@/lib/vehiculos/sesion'

/** POST /api/vehiculos/salir — «Cambiar usuario»: borra la sesión de vehículos de este dispositivo. */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  quitarSesion(res)
  return res
}
