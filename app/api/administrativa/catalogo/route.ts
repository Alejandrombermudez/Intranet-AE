import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, AVISO_MIGRACION, faltaMigracion } from '@/lib/administrativa-api'

/**
 * GET /api/administrativa/catalogo
 * Lo que necesitan todas las pantallas del módulo en una sola llamada: bodegas,
 * insumos (con su costo promedio), saldos por bodega, proyectos y los títulos de
 * la app de campo (sin la huella de la clave).
 */
export async function GET(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta

  const inv = supabase.schema('inventario')
  const [bodegas, insumos, costos, existencias, titulos, proyectos] = await Promise.all([
    inv.from('bodegas').select('id, nombre, tipo, proyecto, responsable, activo, notas').order('nombre'),
    inv.from('insumos').select('id, nombre, unidad, presentacion, categoria, activo, notas').order('nombre'),
    inv.from('v_costo_insumo').select('insumo_id, costo_promedio, ultima_compra'),
    inv.from('v_existencias').select('bodega_id, insumo_id, entradas, salidas, saldo, por_recibir'),
    inv.from('titulos_campo').select('id, nombre, rol, bodega_ids, activo, clave_hash, ultimo_ingreso, bloqueado_hasta').order('nombre'),
    supabase.schema('catalogo').from('proyectos').select('codigo, nombre, activo, orden').order('orden'),
  ])

  const primerError = [bodegas, insumos, costos, existencias, titulos].find((r) => r.error)?.error
  if (primerError) {
    if (faltaMigracion(primerError)) {
      return NextResponse.json({ faltaMigracion: true, aviso: AVISO_MIGRACION, bodegas: [], insumos: [], existencias: [], titulos: [], proyectos: proyectos.data ?? [] })
    }
    return errorBase(primerError)
  }

  const costo = new Map((costos.data ?? []).map((c) => [c.insumo_id, c]))
  return NextResponse.json({
    bodegas: bodegas.data ?? [],
    insumos: (insumos.data ?? []).map((i) => ({
      ...i,
      costo_promedio: costo.get(i.id)?.costo_promedio ?? null,
      ultima_compra: costo.get(i.id)?.ultima_compra ?? null,
    })),
    existencias: existencias.data ?? [],
    // La huella de la clave no sale del servidor: solo si la tiene.
    titulos: (titulos.data ?? []).map(({ clave_hash, ...t }) => ({ ...t, tiene_clave: !!clave_hash })),
    proyectos: (proyectos.data ?? []).filter((p) => p.activo !== false).map((p) => ({ codigo: p.codigo, nombre: p.nombre })),
  })
}
