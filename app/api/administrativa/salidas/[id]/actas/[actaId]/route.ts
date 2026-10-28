import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, esUuid, BUCKET_ACTAS } from '@/lib/administrativa-api'

/**
 * El escaneo firmado de un acta (bucket privado inventario-actas).
 *
 *   GET  → { url } firmada por 10 minutos, o 404 si todavía no se subió
 *   POST multipart `archivo` (PDF o foto, hasta 4 MB) → lo guarda y marca el acta como firmada.
 *        Si ya había uno, se reemplaza y el anterior se borra del bucket solo
 *        después de guardar el nuevo.
 */
type Contexto = { params: Promise<{ id: string; actaId: string }> }

const limpio = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^0-9A-Za-z_-]+/g, '-').slice(0, 60)

export async function GET(req: NextRequest, { params }: Contexto) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const { id, actaId } = await params
  if (!esUuid(id) || !esUuid(actaId)) return NextResponse.json({ error: 'Acta no encontrada.' }, { status: 404 })

  const { data: a, error } = await supabase.schema('inventario').from('actas').select('archivo').eq('id', actaId).eq('salida_id', id).maybeSingle()
  if (error) return errorBase(error)
  if (!a?.archivo) return NextResponse.json({ error: 'Esta acta todavía no tiene el escaneo firmado.' }, { status: 404 })
  const { data } = await supabase.storage.from(BUCKET_ACTAS).createSignedUrl(a.archivo, 600)
  if (!data?.signedUrl) return NextResponse.json({ error: 'No se pudo abrir el archivo.' }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}

export async function POST(req: NextRequest, { params }: Contexto) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const { id, actaId } = await params
  if (!esUuid(id) || !esUuid(actaId)) return NextResponse.json({ error: 'Acta no encontrada.' }, { status: 404 })

  const archivo = (await req.formData().catch(() => null))?.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
  const esImagen = /^image\//.test(archivo.type)
  if (!esImagen && archivo.type !== 'application/pdf' && !/\.pdf$/i.test(archivo.name)) {
    return NextResponse.json({ error: 'El escaneo debe ser PDF o foto.' }, { status: 400 })
  }
  if (archivo.size > 4 * 1024 * 1024) return NextResponse.json({ error: `El archivo ${archivo.name} pesa más de 4 MB.` }, { status: 400 })

  const inv = supabase.schema('inventario')
  const { data: a, error } = await inv.from('actas').select('id, numero, archivo').eq('id', actaId).eq('salida_id', id).maybeSingle()
  if (error) return errorBase(error)
  if (!a) return NextResponse.json({ error: 'Acta no encontrada.' }, { status: 404 })

  const ext = esImagen ? (archivo.type.split('/')[1] || 'jpg') : 'pdf'
  const ruta = `${id}/${limpio(a.numero)}_${Date.now().toString(36)}.${ext}`
  const { error: upErr } = await supabase.storage.from(BUCKET_ACTAS)
    .upload(ruta, Buffer.from(await archivo.arrayBuffer()), { contentType: archivo.type || 'application/pdf', upsert: false })
  if (upErr) return NextResponse.json({ error: `No se pudo guardar el archivo: ${upErr.message}` }, { status: 500 })

  const { error: uErr } = await inv.from('actas').update({ archivo: ruta, firmada: true, firmada_at: new Date().toISOString() }).eq('id', actaId)
  if (uErr) {
    await supabase.storage.from(BUCKET_ACTAS).remove([ruta])
    return errorBase(uErr)
  }
  if (a.archivo) await supabase.storage.from(BUCKET_ACTAS).remove([a.archivo])
  return NextResponse.json({ ok: true })
}
