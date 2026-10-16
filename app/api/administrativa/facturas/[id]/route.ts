import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, esUuid, texto, BUCKET_FACTURAS } from '@/lib/administrativa-api'

/**
 * Una factura.
 *
 *   GET   → la factura con su proveedor, sus líneas y URLs firmadas (10 min) del
 *           XML y del PDF
 *   PATCH { accion: 'anular', motivo } → financiero.anular_factura: la factura
 *           queda 'anulada' y sus entradas al kardex 'anulado'. No se borra nada.
 *   POST  multipart `soporte` (PDF o foto) → adjunta el documento soporte a una
 *           factura que se registró sin él, o lo reemplaza. El anterior se borra
 *           del bucket solo después de guardar el nuevo.
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

const limpio = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^0-9A-Za-z_-]+/g, '-').slice(0, 60)

export async function POST(req: NextRequest, { params }: Contexto) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const { id } = await params
  if (!esUuid(id)) return NextResponse.json({ error: 'Factura no encontrada.' }, { status: 404 })

  const soporte = (await req.formData().catch(() => null))?.get('soporte')
  if (!(soporte instanceof File) || soporte.size === 0) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
  const esImagen = /^image\//.test(soporte.type)
  if (!esImagen && soporte.type !== 'application/pdf' && !/\.pdf$/i.test(soporte.name)) {
    return NextResponse.json({ error: 'El soporte debe ser PDF o foto.' }, { status: 400 })
  }
  if (soporte.size > 4 * 1024 * 1024) return NextResponse.json({ error: `El archivo ${soporte.name} pesa más de 4 MB.` }, { status: 400 })

  const { data: f, error } = await supabase.schema('financiero').from('facturas')
    .select('id, numero, fecha_emision, archivo_pdf, proveedor:proveedores(nit)')
    .eq('id', id).maybeSingle()
  if (error) return errorBase(error)
  if (!f) return NextResponse.json({ error: 'Factura no encontrada.' }, { status: 404 })

  // Misma forma de ruta que al registrar la factura: {año}/{mes}/{nit}_{número}_{marca}.{ext}
  const nit = (f.proveedor as unknown as { nit: string } | null)?.nit ?? 'sin-nit'
  const ext = esImagen ? (soporte.type.split('/')[1] || 'jpg') : 'pdf'
  const ruta = `${f.fecha_emision.slice(0, 4)}/${f.fecha_emision.slice(5, 7)}/${limpio(nit)}_${limpio(f.numero)}_${Date.now().toString(36)}.${ext}`
  const { error: upErr } = await supabase.storage.from(BUCKET_FACTURAS)
    .upload(ruta, Buffer.from(await soporte.arrayBuffer()), { contentType: soporte.type || 'application/pdf', upsert: false })
  if (upErr) return NextResponse.json({ error: `No se pudo guardar el archivo: ${upErr.message}` }, { status: 500 })

  const { error: uErr } = await supabase.schema('financiero').from('facturas').update({ archivo_pdf: ruta }).eq('id', id)
  if (uErr) {
    await supabase.storage.from(BUCKET_FACTURAS).remove([ruta])
    return errorBase(uErr)
  }
  if (f.archivo_pdf) await supabase.storage.from(BUCKET_FACTURAS).remove([f.archivo_pdf])
  return NextResponse.json({ ok: true })
}
