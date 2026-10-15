import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, faltaMigracion, AVISO_MIGRACION, BUCKET_FACTURAS, texto } from '@/lib/administrativa-api'

/**
 * Facturas de compra (financiero.facturas).
 *
 *   GET  ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD  → la lista con su proveedor y cuántas
 *        líneas entraron a inventario (las 1000 más recientes del rango)
 *   POST multipart: datos (JSON {proveedor, factura, items}), xml?, pdf?
 *        → guarda los archivos en el bucket privado y registra todo con
 *          financiero.registrar_factura (una transacción: proveedor, factura,
 *          líneas y entradas al kardex). Si la base rechaza, se borran los archivos.
 */
export async function GET(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta

  const p = req.nextUrl.searchParams
  let q = supabase.schema('financiero').from('facturas')
    .select(`id, numero, cufe, tipo_documento, fecha_emision, fecha_vencimiento, forma_pago, subtotal, impuestos,
             retenciones, total, proyecto, origen, estado, archivo_xml, archivo_pdf, notas, created_by, created_at,
             motivo_anulacion, proveedor:proveedores(id, nit, dv, razon_social), factura_items(clase)`)
    .order('fecha_emision', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)
  const desde = p.get('desde'), hasta = p.get('hasta')
  if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) q = q.gte('fecha_emision', desde)
  if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) q = q.lte('fecha_emision', hasta)

  const { data, error } = await q
  if (error) {
    if (faltaMigracion(error)) return NextResponse.json({ facturas: [], faltaMigracion: true, aviso: AVISO_MIGRACION })
    return errorBase(error)
  }
  const facturas = (data ?? []).map(({ factura_items, ...f }) => ({
    ...f,
    n_items: factura_items?.length ?? 0,
    n_inventario: (factura_items ?? []).filter((i: { clase: string }) => i.clase === 'inventario').length,
  }))
  return NextResponse.json({ facturas })
}

const limpio = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^0-9A-Za-z_-]+/g, '-').slice(0, 60)

export async function POST(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  let datos: { proveedor?: Record<string, unknown>; factura?: Record<string, unknown>; items?: unknown[] }
  try {
    datos = JSON.parse(String(form.get('datos') ?? ''))
  } catch {
    return NextResponse.json({ error: 'Los datos de la factura llegaron dañados.' }, { status: 400 })
  }
  if (!datos?.proveedor || !datos?.factura || !Array.isArray(datos.items) || !datos.items.length) {
    return NextResponse.json({ error: 'Faltan el proveedor, la factura o sus líneas.' }, { status: 400 })
  }
  const nit = String(datos.proveedor.nit ?? '').replace(/[^0-9A-Za-z-]/g, '')
  const numero = texto(datos.factura.numero)
  const fecha = texto(datos.factura.fecha_emision)
  if (!nit || !numero || !fecha) return NextResponse.json({ error: 'Faltan el NIT, el número o la fecha de la factura.' }, { status: 400 })

  // ── Archivos al bucket privado ──
  const carpeta = `${fecha.slice(0, 4)}/${fecha.slice(5, 7)}`
  const base = `${carpeta}/${limpio(nit)}_${limpio(numero)}_${Date.now().toString(36)}`
  const subidos: string[] = []
  const subir = async (campo: string, ext: string, tipo: string): Promise<string | null> => {
    const f = form.get(campo)
    if (!(f instanceof File) || f.size === 0) return null
    if (f.size > 4 * 1024 * 1024) throw new Error(`El archivo ${f.name} pesa más de 4 MB.`)
    const ruta = `${base}.${ext}`
    const { error } = await supabase.storage.from(BUCKET_FACTURAS)
      .upload(ruta, Buffer.from(await f.arrayBuffer()), { contentType: f.type || tipo, upsert: false })
    if (error) throw new Error(`No se pudo guardar el archivo ${f.name}: ${error.message}`)
    subidos.push(ruta)
    return ruta
  }

  let archivoXml: string | null = null, archivoPdf: string | null = null
  try {
    archivoXml = await subir('xml', 'xml', 'application/xml')
    const soporte = form.get('pdf')
    const extPdf = soporte instanceof File && /^image\//.test(soporte.type) ? (soporte.type.split('/')[1] || 'jpg') : 'pdf'
    archivoPdf = await subir('pdf', extPdf, 'application/pdf')
  } catch (e) {
    if (subidos.length) await supabase.storage.from(BUCKET_FACTURAS).remove(subidos)
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  const payload = {
    ...datos,
    factura: {
      ...datos.factura,
      origen: archivoXml ? 'xml_dian' : 'manual',
      archivo_xml: archivoXml,
      archivo_pdf: archivoPdf,
    },
  }

  const { data, error } = await supabase.schema('financiero').rpc('registrar_factura', {
    p_datos: payload,
    p_usuario: sesion.perfil.email,   // el de la sesión, no uno que mande el cliente
  })
  if (error) {
    if (subidos.length) await supabase.storage.from(BUCKET_FACTURAS).remove(subidos)
    return errorBase(error)
  }
  return NextResponse.json({ resultado: data }, { status: 201 })
}
