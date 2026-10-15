import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, esUuid, texto } from '@/lib/administrativa-api'

/**
 * Catálogo de insumos (inventario.insumos). Es la lista cerrada que usa la app
 * de campo. No se borran: se desactivan, porque el kardex los referencia.
 *
 *   POST  { nombre, unidad, presentacion?, categoria?, notas? }  → crear
 *   PATCH { id, ...campos, activo? }                              → editar
 */
export async function POST(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const nombre = texto(b?.nombre)
  const unidad = texto(b?.unidad)
  if (!nombre || !unidad) return NextResponse.json({ error: 'Escribe el nombre del insumo y la unidad en que se cuenta.' }, { status: 400 })

  const { data, error } = await supabase.schema('inventario').from('insumos')
    .insert({
      nombre, unidad,
      presentacion: texto(b?.presentacion),
      categoria: texto(b?.categoria),
      notas: texto(b?.notas),
      created_by: sesion.perfil.email,
    })
    .select('id, nombre, unidad, presentacion, categoria, activo, notas').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Ya existe un insumo llamado «${nombre}».` }, { status: 409 })
    return errorBase(error)
  }
  return NextResponse.json({ insumo: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!esUuid(b?.id)) return NextResponse.json({ error: 'Falta el insumo.' }, { status: 400 })

  const cambios: Record<string, unknown> = {}
  if ('nombre' in b!) { const v = texto(b!.nombre); if (!v) return NextResponse.json({ error: 'El nombre no puede quedar vacío.' }, { status: 400 }); cambios.nombre = v }
  if ('unidad' in b!) { const v = texto(b!.unidad); if (!v) return NextResponse.json({ error: 'La unidad no puede quedar vacía.' }, { status: 400 }); cambios.unidad = v }
  for (const k of ['presentacion', 'categoria', 'notas'] as const) if (k in b!) cambios[k] = texto(b![k])
  if (typeof b!.activo === 'boolean') cambios.activo = b!.activo

  const { data, error } = await supabase.schema('inventario').from('insumos')
    .update(cambios).eq('id', b!.id as string)
    .select('id, nombre, unidad, presentacion, categoria, activo, notas').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya existe otro insumo con ese nombre.' }, { status: 409 })
    return errorBase(error)
  }
  return NextResponse.json({ insumo: data })
}
