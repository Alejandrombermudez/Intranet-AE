import { NextRequest, NextResponse } from 'next/server'
import { exigirFinanciero, errorBase, faltaMigracion, AVISO_MIGRACION } from '@/lib/administrativa-api'

/**
 * GET /api/administrativa/actividades?desde=&hasta=
 * Lo que registró la app de campo (siembra.registros_actividad), con el nombre
 * del predio y del lote, los insumos que descontó y su costo al promedio de
 * compra. Es la otra punta del inventario: a dónde fue lo que se compró.
 */
export async function GET(req: NextRequest) {
  const { supabase, sesion } = await exigirFinanciero(req)
  if (!sesion.ok) return sesion.respuesta
  const p = req.nextUrl.searchParams

  let q = supabase.schema('siembra').from('registros_actividad')
    .select('id, predio_id, zona_id, fecha, actividades, nucleo_ids, nucleos_txt, personas, jornales, valor_jornal, bodega_id, titulo, notas, created_at')
    .eq('anulado', false)
    .order('fecha', { ascending: false })
    .limit(2000)
  const desde = p.get('desde'), hasta = p.get('hasta')
  if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) q = q.gte('fecha', desde)
  if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) q = q.lte('fecha', hasta)
  const { data: regs, error } = await q
  if (error) {
    if (faltaMigracion(error)) return NextResponse.json({ registros: [], faltaMigracion: true, aviso: AVISO_MIGRACION })
    return errorBase(error)
  }
  if (!regs?.length) return NextResponse.json({ registros: [] })

  const predioIds = [...new Set(regs.map((r) => r.predio_id))]
  const zonaIds = [...new Set(regs.map((r) => r.zona_id))]
  const regIds = regs.map((r) => r.id)
  const [predios, zonas, consumos, costos] = await Promise.all([
    supabase.schema('core').from('predios').select('id, nombre_predio, municipio, tipo_proyecto').in('id', predioIds),
    supabase.schema('geo').from('zonas').select('id, nombre').in('id', zonaIds),
    supabase.schema('inventario').from('movimientos').select('registro_id, insumo_id, cantidad')
      .in('registro_id', regIds).eq('tipo', 'consumo').neq('estado', 'anulado'),
    supabase.schema('inventario').from('v_costo_insumo').select('insumo_id, costo_promedio'),
  ])
  const err = [predios, zonas, consumos, costos].find((r) => r.error)?.error
  if (err) return errorBase(err)

  const predio = new Map((predios.data ?? []).map((x) => [x.id, x]))
  const zona = new Map((zonas.data ?? []).map((x) => [x.id, x.nombre as string | null]))
  const costo = new Map((costos.data ?? []).map((c) => [c.insumo_id, Number(c.costo_promedio) || 0]))
  const porRegistro = new Map<string, { insumo_id: string; cantidad: number }[]>()
  for (const c of consumos.data ?? []) {
    const l = porRegistro.get(c.registro_id) ?? []
    l.push({ insumo_id: c.insumo_id, cantidad: Number(c.cantidad) })
    porRegistro.set(c.registro_id, l)
  }

  return NextResponse.json({
    registros: regs.map((r) => {
      const insumos = porRegistro.get(r.id) ?? []
      return {
        ...r,
        predio: predio.get(r.predio_id)?.nombre_predio ?? '—',
        municipio: predio.get(r.predio_id)?.municipio ?? null,
        proyecto: predio.get(r.predio_id)?.tipo_proyecto ?? null,
        lote: zona.get(r.zona_id) ?? 'Lote',
        n_nucleos: (r.nucleo_ids ?? []).length,
        insumos,
        costo_insumos: insumos.reduce((s, i) => s + i.cantidad * (costo.get(i.insumo_id) ?? 0), 0),
        costo_mano_obra: (Number(r.jornales) || 0) * (Number(r.valor_jornal) || 0),
      }
    }),
  })
}
