import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const BUCKET = 'ras-fotos-arboles'

// POST /api/ras/arboles/[id]/foto — sube/cambia la foto propia de un árbol semillero
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

  // El árbol debe existir; usamos su código como nombre estable del objeto
  const { data: arbol } = await supabase
    .schema('ras').from('arboles_semilleros')
    .select('codigo').eq('id', id).single()
  if (!arbol) return NextResponse.json({ error: 'Árbol no encontrado' }, { status: 404 })

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${id}.${ext}`

  const buf = new Uint8Array(await file.arrayBuffer())
  const { error: upErr } = await supabase.storage.from(BUCKET)
    .upload(path, buf, { contentType: file.type || 'image/jpeg', upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  // cache-busting para ver la nueva imagen al instante
  const fotoUrl = `${pub.publicUrl}?v=${Date.now()}`

  const { error: updErr } = await supabase
    .schema('ras').from('arboles_semilleros')
    .update({ foto_url: fotoUrl }).eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ foto_url: fotoUrl })
}
