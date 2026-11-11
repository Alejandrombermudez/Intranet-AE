import { NextResponse } from 'next/server'
import { enlaceFirmado, exigirConductor, fleet } from '@/lib/vehiculos/sesion'

export const dynamic = 'force-dynamic'

/**
 * GET /api/vehiculos/flota — los vehículos con su foto y la foto de la tarjeta de propiedad
 * (enlaces firmados de 1 hora: el bucket es privado) y los vencimientos del SOAT y la
 * tecnomecánica. La tarjeta se muestra desde el celular si la piden en la vía.
 */
export async function GET() {
  const s = await exigirConductor()
  if (!s.ok) return s.respuesta
  const { data, error } = await fleet()
    .from('vehiculos')
    .select('id, nombre, corto, placa, tipo, color, foto_path, tarjeta_path, soat_vence, tecnomecanica_vence')
    .eq('activo', true)
    .order('orden')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const vehiculos = await Promise.all((data ?? []).map(async (v) => ({
    id: v.id, nombre: v.nombre, corto: v.corto, placa: v.placa, tipo: v.tipo, color: v.color,
    soat_vence: v.soat_vence, tecnomecanica_vence: v.tecnomecanica_vence,
    foto: await enlaceFirmado(v.foto_path),
    tarjeta: await enlaceFirmado(v.tarjeta_path),
  })))
  return NextResponse.json({ vehiculos })
}
