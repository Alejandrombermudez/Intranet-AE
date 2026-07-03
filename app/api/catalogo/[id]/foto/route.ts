import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const BUCKET = 'species-photos'

function slugify(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// POST /api/catalogo/[id]/foto — sube/cambia la foto de una especie
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServerSupabaseClient()

  const form = await req.formData()
  const file = form.get('foto')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'El archivo debe ser una imagen' }, { status: 400 })
  }

  // Nombre del objeto: slug de la especie (estable) o el id
  const { data: esp } = await supabase
    .schema('catalogo').from('especies')
    .select('slug, nombre_cientifico').eq('id', id).single()
  if (!esp) return NextResponse.json({ error: 'Especie no encontrada' }, { status: 404 })

  const base = esp.slug || slugify(esp.nombre_cientifico) || id
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${base}.${ext}`

  const buf = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage.from(BUCKET)
    .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  // cache-busting para que el navegador muestre la nueva imagen al instante
  const fotoUrl = `${pub.publicUrl}?v=${Date.now()}`

  const { error: updErr } = await supabase
    .schema('catalogo').from('especies')
    .update({ foto_url: fotoUrl }).eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ foto_url: fotoUrl })
}
