import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE } from '@/lib/auth-api'
import {
  reglasDePredio, yaNoAplica,
  type Alerta, type AlertaVista, type PredioResumen,
} from '@/lib/alertas-juridica'

/** La tabla no existe todavía (falta migration_alertas_juridica.sql). */
const faltaTabla = (err: { code?: string } | null) => !!err && ['PGRST205', '42P01'].includes(err.code ?? '')

/**
 * GET /api/juridica/alertas — la lista de trabajo de jurídica.
 *
 * Antes de responder la pone al día: crea las alertas que las reglas
 * (`reglasDePredio`) encuentran en los predios activos y cierra las que ya no
 * aplican (`yaNoAplica`: alguien corrigió la ficha). Por eso no hace falta una
 * tarea programada: la lista está al día cada vez que alguien la mira.
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.juridica)
  if (!sesion.ok) return sesion.respuesta

  const [alertasRes, prediosRes, expRes] = await Promise.all([
    supabase.schema('juridica').from('alertas').select('*').order('created_at', { ascending: true }),
    supabase.schema('core').from('predios').select('id, nombre_predio, municipio, vereda, aliado_id'),
    supabase.schema('core').from('expedientes').select('predio_id, estado'),
  ])
  if (faltaTabla(alertasRes.error)) return NextResponse.json({ alertas: [], falta_migracion: true })
  const err = alertasRes.error ?? prediosRes.error ?? expRes.error
  if (err) {
    console.error('GET /api/juridica/alertas error:', err)
    return NextResponse.json({ error: 'No se pudieron leer las alertas' }, { status: 500 })
  }

  let alertas = (alertasRes.data ?? []) as Alerta[]
  const predios = prediosRes.data ?? []
  const predioPorId = new Map(predios.map((p) => [p.id as string, p]))
  const activos = new Set((expRes.data ?? []).filter((e) => e.estado === 'activo').map((e) => e.predio_id as string))

  // 1) Lo que las reglas encuentran y todavía no tiene alerta (con cualquier
  //    estado: una que jurídica descartó no se vuelve a abrir).
  const claves = new Set(alertas.map((a) => a.clave))
  const nuevas = predios
    .filter((p) => activos.has(p.id))
    .flatMap((p) => reglasDePredio(p))
    .filter((r) => !claves.has(r.clave))
  if (nuevas.length) {
    const { data, error } = await supabase.schema('juridica').from('alertas')
      .upsert(nuevas.map((r) => ({ ...r, origen: 'regla', created_by: 'intranet' })), { onConflict: 'clave', ignoreDuplicates: true })
      .select('*')
    if (error) console.error('alertas: no se pudieron crear las de regla:', error)
    else alertas = [...alertas, ...((data ?? []) as Alerta[])]
  }

  // 2) Las que ya no aplican se cierran solas, con la nota de por qué.
  const cerrar = alertas.filter((a) => yaNoAplica(a, a.predio_id ? predioPorId.get(a.predio_id) : undefined, !!a.predio_id && activos.has(a.predio_id)))
  if (cerrar.length) {
    const ahora = new Date().toISOString()
    const cambio = { estado: 'resuelta' as const, nota: 'Se corrigió en la ficha', resuelta_por: 'intranet', resuelta_at: ahora }
    const { error } = await supabase.schema('juridica').from('alertas')
      .update(cambio).in('id', cerrar.map((a) => a.id)).eq('estado', 'abierta')
    if (error) console.error('alertas: no se pudieron cerrar las corregidas:', error)
    else {
      const ids = new Set(cerrar.map((a) => a.id))
      alertas = alertas.map((a) => (ids.has(a.id) ? { ...a, ...cambio } : a))
    }
  }

  // 3) Con el predio, su propietario y, en un duplicado, el otro predio.
  const aliadoIds = [...new Set(predios.map((p) => p.aliado_id as string | null).filter((x): x is string => !!x))]
  const { data: aliados } = aliadoIds.length
    ? await supabase.schema('core').from('aliados').select('id, nombre_completo').in('id', aliadoIds)
    : { data: [] as { id: string; nombre_completo: string }[] }
  const nombreAliado = new Map((aliados ?? []).map((a) => [a.id as string, a.nombre_completo as string]))
  const resumen = (id: unknown): PredioResumen | null => {
    const p = typeof id === 'string' ? predioPorId.get(id) : undefined
    return p ? {
      id: p.id, nombre_predio: p.nombre_predio, municipio: p.municipio, vereda: p.vereda,
      propietario: p.aliado_id ? nombreAliado.get(p.aliado_id) ?? null : null,
    } : null
  }

  const vista: AlertaVista[] = alertas.map((a) => ({
    ...a,
    predio: resumen(a.predio_id),
    otro_predio: a.tipo === 'duplicado' ? resumen(a.datos?.otro_predio_id) : null,
  }))
  return NextResponse.json({ alertas: vista })
}
