import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase } from '@/lib/administrativa-api'

/**
 * POST /api/administrativa/facturas/sugerencias
 *   { nit, cufe, numero, items: [{linea, codigo, descripcion}] }
 * → { proveedor_conocido, duplicada, items: [{linea, origen, clase, insumo_id, factor}] }
 *
 * Antes de clasificar: ¿esta factura ya se registró?, y para cada línea lo que se
 * decidió la última vez con ese proveedor (por código o descripción) o, si es la
 * primera vez, un insumo del catálogo cuyo nombre aparezca en la descripción.
 */
export async function POST(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const b = (await req.json().catch(() => null)) as { nit?: string; cufe?: string; numero?: string; items?: unknown[] } | null
  if (!b?.nit || !Array.isArray(b.items)) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })

  const { data, error } = await supabase.schema('financiero').rpc('sugerir_items', {
    p_nit: b.nit, p_cufe: b.cufe ?? '', p_numero: b.numero ?? '', p_items: b.items,
  })
  if (error) return errorBase(error)
  return NextResponse.json(data)
}
