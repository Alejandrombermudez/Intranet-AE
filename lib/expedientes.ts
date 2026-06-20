/**
 * Datos para el tablero de predios/expedientes.
 * Reúne, por predio: persona (core.aliados), predio (core.predios),
 * estado del proceso (core.expedientes) y estado jurídico
 * (juridica.debida_diligencia.estado + juridica.analisis_juridico.semaforo).
 */
import { createServerSupabaseClient } from '@/lib/supabase-server'

type SB = ReturnType<typeof createServerSupabaseClient>

export interface ExpedienteRow {
  predio_id: string
  expediente_id: string | null
  // proceso
  etapa: string | null
  estado_exp: string | null
  linea: string | null
  proyecto_fase: string | null
  fecha_inicio: string | null
  // persona
  aliado_id: string
  nombre_completo: string
  tipo_documento: string
  numero_documento: string
  tipo_persona: string
  // predio
  nombre_predio: string | null
  departamento: string | null
  municipio: string
  vereda: string | null
  matricula_inmobiliaria: string | null
  area_registral: number | null
  zona_ae: string | null
  // jurídica
  dd_estado: string
  semaforo: string | null
}

export async function listExpedientes(supabase: SB): Promise<ExpedienteRow[]> {
  const { data: predios } = await supabase
    .schema('core').from('predios').select('*').order('created_at', { ascending: false })
  if (!predios || predios.length === 0) return []

  const aliadoIds = [...new Set(predios.map((p) => p.aliado_id))]
  const predioIds = predios.map((p) => p.id)

  const [{ data: aliados }, { data: exps }, { data: dds }, { data: anas }] = await Promise.all([
    supabase.schema('core').from('aliados').select('*').in('id', aliadoIds),
    supabase.schema('core').from('expedientes').select('*').in('predio_id', predioIds),
    supabase.schema('juridica').from('debida_diligencia').select('predio_id, estado').in('predio_id', predioIds),
    supabase.schema('juridica').from('analisis_juridico').select('predio_id, semaforo').in('predio_id', predioIds),
  ])

  const aliadoById = new Map((aliados ?? []).map((a) => [a.id, a]))
  const expByPredio = new Map((exps ?? []).map((e) => [e.predio_id, e]))
  const ddByPredio = new Map((dds ?? []).map((d) => [d.predio_id, d]))
  const anaByPredio = new Map((anas ?? []).map((a) => [a.predio_id, a]))

  return predios.map((p) => {
    const al = aliadoById.get(p.aliado_id)
    const ex = expByPredio.get(p.id)
    const dd = ddByPredio.get(p.id)
    const ana = anaByPredio.get(p.id)
    return {
      predio_id: p.id,
      expediente_id: ex?.id ?? null,
      etapa: ex?.etapa ?? null,
      estado_exp: ex?.estado ?? null,
      linea: ex?.linea ?? null,
      proyecto_fase: ex?.proyecto_fase ?? null,
      fecha_inicio: ex?.fecha_inicio ?? null,
      aliado_id: p.aliado_id,
      nombre_completo: al?.nombre_completo ?? '—',
      tipo_documento: al?.tipo_documento ?? '',
      numero_documento: al?.numero_documento ?? '',
      tipo_persona: al?.tipo_persona ?? 'natural',
      nombre_predio: p.nombre_predio ?? null,
      departamento: p.departamento ?? null,
      municipio: p.municipio,
      vereda: p.vereda ?? null,
      matricula_inmobiliaria: p.matricula_inmobiliaria ?? null,
      area_registral: p.area_registral ?? null,
      zona_ae: p.zona_ae ?? null,
      dd_estado: dd?.estado ?? 'borrador',
      semaforo: ana?.semaforo ?? null,
    }
  })
}
