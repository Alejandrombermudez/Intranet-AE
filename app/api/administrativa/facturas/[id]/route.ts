import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, esUuid, texto, BUCKET_FACTURAS } from '@/lib/administrativa-api'

/**
 * Una factura.
 *
 *   GET   → la factura con su proveedor, sus líneas y URLs firmadas (10 min) del
 *           XML y del PDF
 *   PATCH { accion: 'anular', motivo } → financiero.anular_factura: la factura
 *           queda 'anulada' y sus entradas al kardex 'anulado'. No se borra nada.
 */
type Contexto = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Contexto) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const { id } = await params
  if (!esUuid(id)) return NextResponse.json({ error: 'Factura no encontrada.' }, { status: 404 })

  const { data: f, error } = await supabase.schema('financiero').from('facturas')
    .select(`*, proveedor:proveedores(*), items:factura_items(*)`)
    .eq('id', id).maybeSingle()
  if (error) return errorBase(error)
  if (!f) return NextResponse.json({ error: 'Factura no encontrada.' }, { status: 404 })

  const firmar = async (ruta: string | null) => {
    if (!ruta) return null
    const { data } = await supabase.storage.from(BUCKET_FACTURAS).createSignedUrl(ruta, 600)
    return data?.signedUrl ?? null
  }
  const [urlXml, urlPdf] = await Promise.all([firmar(f.archivo_xml), firmar(f.archivo_pdf)])
  const items = [...(f.items ?? [])].sort((a: { linea: number }, b: { linea: number }) => a.linea - b.linea)
  return NextResponse.json({ factura: { ...f, items, url_xml: urlXml, url_pdf: urlPdf } })
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const { id } = await params
  if (!esUuid(id)) return NextResponse.json({ error: 'Factura no encontrada.' }, { status: 404 })
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null

  if (b?.accion !== 'anular') return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
  const motivo = texto(b.motivo)
  if (!motivo) return NextResponse.json({ error: 'Escribe por qué se anula la factura.' }, { status: 400 })

  const { data, error } = await supabase.schema('financiero').rpc('anular_factura', {
    p_id: id, p_usuario: sesion.perfil.email, p_motivo: motivo,
  })
  if (error) return errorBase(error)
  return NextResponse.json({ entradas_anuladas: data })
}
