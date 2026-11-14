import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'
import { COLUMNAS_FASE } from '@/lib/fenologia'

/**
 * /api/ras/fenologia — datos del módulo de fenología (/intranet/ras/fenologia).
 *
 * GET: los monitoreos vigentes de ras.monitoreos_semilleros (los de la app y los
 *      de Kobo), la base de árboles (ras.arboles_monitoreo) y las fotos por
 *      monitoreo. Los cálculos (calendarios, índices) se hacen en el navegador:
 *      son unos miles de filas. El clima va aparte, en ./clima (Open-Meteo).
 *
 * Las tablas son solo service_role; la regla es la del módulo RAS.
 * Desde el 2026-11-13 el clima sale de Open-Meteo por coordenada de árbol:
 * ras.clima_referencia y ras.clima_mensual (de migration_fenologia_intranet.sql)
 * quedaron sin uso.
 */

const COLS_MONITOREO = [
  'id', 'nucleo', 'codigo', 'predio', 'fecha', 'ronda', 'nombre_comun', 'nombre_cientifico',
  'familia', 'en_base', ...COLUMNAS_FASE, 'estado_fitosanitario', 'observaciones',
  'vio_animal', 'animales', 'monitor', 'origen',
].join(',')

const tablaFalta = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|Could not find the table/i.test(e.message ?? ''))

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.ras)
  if (!sesion.ok) return sesion.respuesta
  const ras = supabase.schema('ras')

  // PostgREST corta en 1000 filas: se pide por páginas.
  const monitoreos: Record<string, unknown>[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await ras.from('monitoreos_semilleros').select(COLS_MONITOREO)
      .eq('eliminado', false).order('ronda').order('codigo').order('id').range(desde, desde + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    monitoreos.push(...((data ?? []) as unknown as Record<string, unknown>[]))
    if (!data || data.length < 1000) break
  }

  const pendiente: string[] = []

  const arb = await ras.from('arboles_monitoreo')
    .select('nucleo,codigo,predio,vereda,nombre_comun,nombre_cientifico,familia,latitud,longitud,dap_cm,altura_m,protocolo')
    .eq('activo', true).order('codigo').range(0, 4999)
  if (tablaFalta(arb.error)) pendiente.push('arboles')
  else if (arb.error) return NextResponse.json({ error: arb.error.message }, { status: 500 })

  const fotos = await ras.from('fotos_monitoreo_semilleros')
    .select('id,monitoreo_id,organo,aceptada,borrosa,tomada_en').range(0, 9999)

  return NextResponse.json({
    monitoreos,
    arboles: arb.data ?? [],
    fotos: fotos.error ? [] : fotos.data ?? [],
    pendiente,
  })
}
