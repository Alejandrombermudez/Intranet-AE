import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'
import { COLUMNAS_FASE } from '@/lib/fenologia'

/**
 * /api/ras/fenologia — datos del módulo de fenología (/intranet/ras/fenologia).
 *
 * GET: los monitoreos vigentes de ras.monitoreos_semilleros (los de la app y los
 *      de Kobo), la base de árboles (ras.arboles_monitoreo), el conteo de fotos
 *      por monitoreo y el clima de referencia. Los cálculos (calendarios,
 *      índices) se hacen en el navegador: son unos miles de filas.
 * PUT: guarda el clima de referencia de un núcleo (12 meses + fuente).
 *
 * Las tablas son solo service_role; la regla es la del módulo RAS.
 * Las tablas de árboles y clima vienen de migration_fenologia_intranet.sql: si
 * todavía no corre, la respuesta lo dice (`pendiente`) y la pantalla sigue.
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

  const ref = await ras.from('clima_referencia').select('*')
  const men = await ras.from('clima_mensual').select('nucleo,mes,precip_mm,temp_c').order('mes')
  if (tablaFalta(ref.error) || tablaFalta(men.error)) pendiente.push('clima')
  else if (ref.error || men.error) return NextResponse.json({ error: (ref.error ?? men.error)!.message }, { status: 500 })

  const fotos = await ras.from('fotos_monitoreo_semilleros')
    .select('id,monitoreo_id,organo,aceptada,borrosa,tomada_en').range(0, 9999)

  return NextResponse.json({
    monitoreos,
    arboles: arb.data ?? [],
    fotos: fotos.error ? [] : fotos.data ?? [],
    clima: (ref.data ?? []).map((r) => ({
      ...r,
      meses: (men.data ?? []).filter((m) => m.nucleo === r.nucleo),
    })),
    pendiente,
  })
}

type MesClima = { mes: number; precip_mm: number | null; temp_c: number | null }

export async function PUT(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.ras)
  if (!sesion.ok) return sesion.respuesta

  const body = await req.json().catch(() => null) as {
    nucleo?: string; fuente?: string; estacion?: string; periodo?: string
    umbral_lluvia_mm?: number | null; notas?: string; meses?: MesClima[]
  } | null
  const nucleo = body?.nucleo?.trim()
  if (!nucleo) return NextResponse.json({ error: 'Falta el núcleo' }, { status: 400 })
  if (!body?.fuente?.trim()) return NextResponse.json({ error: 'La fuente es obligatoria: sin ella el gráfico no se puede citar.' }, { status: 400 })

  const num = (v: unknown) => (v === null || v === undefined || v === '' || !isFinite(Number(v)) ? null : Number(v))
  const meses = (body.meses ?? [])
    .filter((m) => Number.isInteger(m.mes) && m.mes >= 1 && m.mes <= 12)
    .map((m) => ({ nucleo, mes: m.mes, precip_mm: num(m.precip_mm), temp_c: num(m.temp_c) }))
  if (meses.some((m) => (m.precip_mm !== null && m.precip_mm < 0) || (m.temp_c !== null && (m.temp_c < -10 || m.temp_c > 50)))) {
    return NextResponse.json({ error: 'Hay valores fuera de rango (lluvia negativa o temperatura imposible).' }, { status: 400 })
  }

  const ras = supabase.schema('ras')
  const { error: e1 } = await ras.from('clima_referencia').upsert({
    nucleo,
    fuente: body.fuente.trim(),
    estacion: body.estacion?.trim() || null,
    periodo: body.periodo?.trim() || null,
    umbral_lluvia_mm: num(body.umbral_lluvia_mm),
    notas: body.notas?.trim() || null,
    updated_by: sesion.perfil.email,
    updated_at: new Date().toISOString(),
  })
  if (e1) return NextResponse.json({ error: e1.message }, { status: tablaFalta(e1) ? 409 : 500 })
  if (meses.length) {
    const { error: e2 } = await ras.from('clima_mensual').upsert(meses)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
