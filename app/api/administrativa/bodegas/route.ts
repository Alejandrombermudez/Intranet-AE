import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, esUuid, texto } from '@/lib/administrativa-api'

/**
 * Bodegas (inventario.bodegas): la central, una por proyecto, el vivero.
 * No se borran: se desactivan, porque el kardex las referencia.
 *
 *   POST  { nombre, tipo, proyecto?, responsable?, notas? }
 *   PATCH { id, ...campos, activo? }
 */
// 'campo' (una salida) y 'persona' (lo que tiene a cargo un trabajador) las crea inventario.crear_salida / bodega_trabajador.
const TIPOS = ['central', 'proyecto', 'vivero', 'sede']

export async function POST(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const nombre = texto(b?.nombre)
  const tipo = texto(b?.tipo) ?? 'proyecto'
  if (!nombre) return NextResponse.json({ error: 'Escribe el nombre de la bodega.' }, { status: 400 })
  if (!TIPOS.includes(tipo)) return NextResponse.json({ error: 'Tipo de bodega no válido.' }, { status: 400 })

  const { data, error } = await supabase.schema('inventario').from('bodegas')
    .insert({ nombre, tipo, proyecto: texto(b?.proyecto), responsable: texto(b?.responsable), notas: texto(b?.notas), created_by: sesion.perfil.email })
    .select('id, nombre, tipo, proyecto, responsable, activo, notas').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Ya existe una bodega llamada «${nombre}».` }, { status: 409 })
    return errorBase(error)
  }
  return NextResponse.json({ bodega: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!esUuid(b?.id)) return NextResponse.json({ error: 'Falta la bodega.' }, { status: 400 })

  const cambios: Record<string, unknown> = {}
  if ('nombre' in b!) { const v = texto(b!.nombre); if (!v) return NextResponse.json({ error: 'El nombre no puede quedar vacío.' }, { status: 400 }); cambios.nombre = v }
  if ('tipo' in b!) { if (!TIPOS.includes(String(b!.tipo))) return NextResponse.json({ error: 'Tipo de bodega no válido.' }, { status: 400 }); cambios.tipo = b!.tipo }
  for (const k of ['proyecto', 'responsable', 'notas'] as const) if (k in b!) cambios[k] = texto(b![k])
  if (typeof b!.activo === 'boolean') cambios.activo = b!.activo

  const { data, error } = await supabase.schema('inventario').from('bodegas')
    .update(cambios).eq('id', b!.id as string)
    .select('id, nombre, tipo, proyecto, responsable, activo, notas').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya existe otra bodega con ese nombre.' }, { status: 409 })
    return errorBase(error)
  }
  return NextResponse.json({ bodega: data })
}
