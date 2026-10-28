import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, esUuid, texto, faltaSalidas } from '@/lib/administrativa-api'
import { AVISO_MIGRACION_SALIDAS } from '@/lib/salidas'

/**
 * Trabajadores de campo (people.trabajadores_campo): quien recibe materiales,
 * herramientas o EPP a su nombre y firma las actas. No tienen correo de la
 * organización, por eso no están en talento humano.
 *
 *   GET                          → la lista, con cuántos elementos tiene a cargo cada uno
 *   POST  { nombres, apellidos?, tipo_documento?, numero_documento?, celular?, cargo?, notas? }
 *   PATCH { id, ...campos, activo? }
 *
 * Son datos personales y el repo es público: se cargan desde la pantalla, nunca
 * desde un .sql del repositorio.
 */
const TIPOS_DOC = ['CC', 'CE', 'TI', 'PEP', 'PPT', 'PA']
const SELECT = 'id, nombres, apellidos, tipo_documento, numero_documento, celular, cargo, activo, notas'

export async function GET(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta

  const { data, error } = await supabase.schema('people').from('trabajadores_campo').select(SELECT).order('nombres')
  if (error) {
    if (faltaSalidas(error)) return NextResponse.json({ trabajadores: [], faltaMigracion: true, aviso: AVISO_MIGRACION_SALIDAS })
    return errorBase(error)
  }

  // Lo que tiene a cargo cada uno: saldo de su bodega «a cargo de».
  const inv = supabase.schema('inventario')
  const [bodegas, existencias, insumos] = await Promise.all([
    inv.from('bodegas').select('id, trabajador_id').eq('tipo', 'persona'),
    inv.from('v_existencias').select('bodega_id, insumo_id, saldo'),
    inv.from('insumos').select('id, nombre, unidad, clase'),
  ])
  const bodegaDe = new Map((bodegas.data ?? []).map((b) => [b.id as string, b.trabajador_id as string]))
  const ins = new Map((insumos.data ?? []).map((i) => [i.id as string, i]))
  const aCargo = new Map<string, { insumo_id: string; nombre: string; unidad: string; clase: string; cantidad: number }[]>()
  for (const e of existencias.data ?? []) {
    const t = bodegaDe.get(e.bodega_id as string)
    const i = ins.get(e.insumo_id as string)
    if (!t || !i || Number(e.saldo) <= 0.0001) continue
    const lista = aCargo.get(t) ?? []
    lista.push({ insumo_id: i.id, nombre: i.nombre, unidad: i.unidad, clase: i.clase, cantidad: Number(e.saldo) })
    aCargo.set(t, lista)
  }

  return NextResponse.json({
    trabajadores: (data ?? []).map((t) => ({ ...t, a_cargo: (aCargo.get(t.id) ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre)) })),
  })
}

function leer(b: Record<string, unknown>, parcial: boolean) {
  const c: Record<string, unknown> = {}
  if (!parcial || 'nombres' in b) c.nombres = texto(b.nombres)
  for (const k of ['apellidos', 'numero_documento', 'celular', 'cargo', 'notas'] as const) if (!parcial || k in b) c[k] = texto(b[k])
  if (!parcial || 'tipo_documento' in b) {
    const t = texto(b.tipo_documento)
    c.tipo_documento = t && TIPOS_DOC.includes(t.toUpperCase()) ? t.toUpperCase() : null
  }
  if (typeof b.activo === 'boolean') c.activo = b.activo
  if (typeof c.numero_documento === 'string') c.numero_documento = c.numero_documento.replace(/[^0-9A-Za-z-]/g, '') || null
  return c
}

export async function POST(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  const c = leer(b, false)
  if (!c.nombres) return NextResponse.json({ error: 'Escribe los nombres del trabajador.' }, { status: 400 })

  const { data, error } = await supabase.schema('people').from('trabajadores_campo')
    .insert({ ...c, created_by: sesion.perfil.email }).select(SELECT).single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya hay un trabajador con ese documento.' }, { status: 409 })
    if (faltaSalidas(error)) return NextResponse.json({ error: AVISO_MIGRACION_SALIDAS, faltaMigracion: true }, { status: 503 })
    return errorBase(error)
  }
  return NextResponse.json({ trabajador: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b || !esUuid(b.id)) return NextResponse.json({ error: 'Falta el trabajador.' }, { status: 400 })
  const c = leer(b, true)
  if ('nombres' in c && !c.nombres) return NextResponse.json({ error: 'Los nombres no pueden quedar vacíos.' }, { status: 400 })

  const { data, error } = await supabase.schema('people').from('trabajadores_campo')
    .update(c).eq('id', b.id).select(SELECT).single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Ya hay otro trabajador con ese documento.' }, { status: 409 })
    return errorBase(error)
  }
  return NextResponse.json({ trabajador: data })
}
