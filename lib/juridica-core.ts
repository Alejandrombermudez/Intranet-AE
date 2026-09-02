/**
 * Helpers del modelo canónico `core` para el módulo jurídico.
 *
 * El módulo jurídico es la puerta de entrada del sistema: crea la PERSONA
 * (core.aliados), el PREDIO (core.predios), abre el EXPEDIENTE (core.expedientes)
 * y guarda la debida diligencia (juridica.debida_diligencia).
 *
 * La UI sigue trabajando con un objeto plano tipo `Aliado` (persona+predio+DD,
 * con antecedentes/analisis anidados). Estas funciones reensamblan ese objeto
 * desde el modelo normalizado. El identificador del "caso" en la UI es el PREDIO.
 */
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { comprimirPdf } from '@/lib/pdf-compress'

type SB = ReturnType<typeof createServerSupabaseClient>

// ─── Marcadores para creación con datos mínimos ──────────────────────────────
// La BD exige NOT NULL en aliados.nombre_completo, aliados.numero_documento y
// predios.municipio. Para permitir abrir un caso con solo el nombre del predio,
// esos campos se rellenan con estos marcadores cuando llegan vacíos; el usuario
// los reemplaza después (editar HOJA 1). Son detectables por la UI para avisar
// "falta completar".
export const SIN_PROPIETARIO = 'Por completar'
export const SIN_MUNICIPIO   = 'Por definir'

/** Documento placeholder único (aliados.numero_documento es NOT NULL + UNIQUE).
 *  Prefijo S/D = "sin documento"; se reemplaza al completar la persona. */
export function placeholderDocumento(): string {
  return `S/D-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

/** true si el valor es uno de los marcadores de "falta completar" (o parece placeholder de documento). */
export function esMarcador(valor: string | null | undefined): boolean {
  if (!valor) return false
  return valor === SIN_PROPIETARIO || valor === SIN_MUNICIPIO || /^S\/D-/.test(valor)
}

const BUCKET_JURIDICA = 'juridica-documentos'
// Tipos permitidos (sirve para validar y para borrar versiones previas al reemplazar).
// `csv`/`xlsx`/`xls`: la Rama Judicial (y varias consultas de antecedentes) entregan
// el resultado como descarga de hoja de cálculo, no como PDF.
const EXTENSIONES_DOC = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'gif', 'doc', 'docx', 'csv', 'xls', 'xlsx'] as const
const MIME_POR_EXT: Record<string, string> = {
  pdf:  'application/pdf',
  jpg:  'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', gif: 'image/gif',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv:  'text/csv',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/**
 * Sube un documento (PDF, imagen, Word o planilla CSV/Excel) al bucket de jurídica
 * y devuelve su URL firmada.
 *  - PDF   → se comprime con pdf-lib.
 *  - Imagen (jpg/png/webp/heic…), Word (doc/docx) o planilla (csv/xls/xlsx) → se
 *    sube tal cual, con su content-type. Las imágenes ya llegan comprimidas desde
 *    el navegador (`lib/comprimir-imagen.ts`).
 * `basePath` es la ruta SIN extensión (ej. `${predioId}/cedula`). Antes de subir
 * borra cualquier versión previa (cualquier extensión) para no dejar archivos
 * huérfanos al cambiar de formato.
 * Devuelve null si el tipo de archivo no es soportado o si falla la subida.
 */
export async function subirDocumento(supabase: SB, basePath: string, file: File): Promise<string | null> {
  const nombre = (file.name || '').toLowerCase()
  const tipo = (file.type || '').toLowerCase()
  // Extensión: preferir la del nombre del archivo; si no, derivarla del MIME
  const mExt = nombre.match(/\.([a-z0-9]+)$/)
  const ext = mExt ? mExt[1]
    : tipo === 'application/pdf'        ? 'pdf'
    : tipo === 'application/msword'     ? 'doc'
    : tipo.includes('wordprocessingml') ? 'docx'
    : tipo.startsWith('image/')         ? (tipo.split('/')[1] || '').replace(/[^a-z0-9]/g, '')
    : ''
  if (!(EXTENSIONES_DOC as readonly string[]).includes(ext)) return null

  const buf = await file.arrayBuffer()
  let data: Uint8Array
  let contentType: string
  if (ext === 'pdf') {
    data = await comprimirPdf(buf)                          // solo los PDF se comprimen
    contentType = 'application/pdf'
  } else if (ext === 'csv' || ext === 'xls' || ext === 'xlsx') {
    // Windows reporta MIME inconsistente para las planillas (a un .csv le pone
    // application/vnd.ms-excel): manda la extensión, no lo que diga el navegador.
    data = new Uint8Array(buf)
    contentType = MIME_POR_EXT[ext]
  } else {
    data = new Uint8Array(buf)                              // imagen o Word: tal cual
    contentType = tipo || MIME_POR_EXT[ext] || 'application/octet-stream'
  }

  // Subir PRIMERO. Si se borraran las versiones previas antes y la subida
  // fallara, el documento anterior se perdería sin reemplazo. `upsert: true`
  // ya sobreescribe una versión previa con la misma extensión.
  const path = `${basePath}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_JURIDICA)
    .upload(path, data, { contentType, upsert: true })
  if (error) return null

  // Ya con el archivo nuevo en su sitio, limpiar versiones con OTRA extensión
  // (p. ej. se reemplazó un .jpg por un .pdf) para no dejar huérfanos.
  const otrasExtensiones = EXTENSIONES_DOC.filter((e) => e !== ext).map((e) => `${basePath}.${e}`)
  await supabase.storage.from(BUCKET_JURIDICA).remove(otrasExtensiones)

  const { data: signed } = await supabase.storage.from(BUCKET_JURIDICA)
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 5) // 5 años
  return signed?.signedUrl ?? null
}

// Forma plana que espera la UI (compatible con lib/juridica-schema.ts → Aliado)
export interface CasoPlano {
  id: string                 // = predio_id (identificador del caso en la UI)
  predio_id: string
  aliado_id: string
  expediente_id: string | null
  etapa: string | null
  // Persona
  tipo_persona: string
  nombre_completo: string
  tipo_documento: string
  numero_documento: string
  telefono: string | null
  email: string | null
  // Predio
  departamento: string | null
  municipio: string
  vereda: string | null
  zona_ae: string | null
  nombre_predio: string | null
  matricula_inmobiliaria: string | null   // la principal (= primera de matriculas)
  matriculas: string[] | null             // todas las matrículas del predio
  codigo_catastral: string | null
  area_registral: number | null
  // Debida diligencia
  estado: string
  cedula_url: string | null
  certificado_tradicion_url: string | null
  recibo_predial_url: string | null
  anio_ultimo_pago_predial: number | null
  manifestacion_interes: boolean | null
  manifestacion_observaciones: string | null
  manifestacion_url: string | null
  // Auditoría
  created_by: string | null
  created_at: string
  updated_at: string
  // Anidados
  antecedentes: Record<string, unknown> | null
  analisis_juridico: Record<string, unknown> | null
}

// Filas crudas de Supabase (tipado dinámico); la salida tipada es CasoPlano.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>

function ensamblar(
  predio: Row,
  aliado: Row,
  dd: Row | null,
  exp: Row | null,
  antecedentes: Row | null,
  analisis: Row | null,
): CasoPlano {
  return {
    id: predio.id,
    predio_id: predio.id,
    aliado_id: aliado.id,
    expediente_id: exp?.id ?? null,
    etapa: exp?.etapa ?? null,
    // Persona
    tipo_persona: aliado.tipo_persona,
    nombre_completo: aliado.nombre_completo,
    tipo_documento: aliado.tipo_documento,
    numero_documento: aliado.numero_documento,
    telefono: aliado.telefono ?? null,
    email: aliado.email ?? null,
    // Predio
    departamento: predio.departamento ?? null,
    municipio: predio.municipio,
    vereda: predio.vereda ?? null,
    zona_ae: predio.zona_ae ?? null,
    nombre_predio: predio.nombre_predio ?? null,
    matricula_inmobiliaria: predio.matricula_inmobiliaria ?? null,
    matriculas: (Array.isArray(predio.matriculas) && predio.matriculas.length > 0)
      ? predio.matriculas
      : (predio.matricula_inmobiliaria ? [predio.matricula_inmobiliaria] : null),
    codigo_catastral: predio.codigo_catastral ?? null,
    area_registral: predio.area_registral ?? null,
    // Debida diligencia
    estado: dd?.estado ?? 'borrador',
    cedula_url: dd?.cedula_url ?? null,
    certificado_tradicion_url: dd?.certificado_tradicion_url ?? null,
    recibo_predial_url: dd?.recibo_predial_url ?? null,
    anio_ultimo_pago_predial: dd?.anio_ultimo_pago_predial ?? null,
    manifestacion_interes: dd?.manifestacion_interes ?? null,
    manifestacion_observaciones: dd?.manifestacion_observaciones ?? null,
    manifestacion_url: dd?.manifestacion_url ?? null,
    // Auditoría (la fecha del caso = la del predio)
    created_by: predio.created_by ?? aliado.created_by ?? null,
    created_at: predio.created_at,
    updated_at: predio.updated_at ?? predio.created_at,
    // Anidados
    antecedentes: antecedentes ?? null,
    analisis_juridico: analisis ?? null,
  }
}

/** Un caso por predio_id, reensamblado en la forma plana de la UI. */
export async function getCaso(supabase: SB, predioId: string): Promise<CasoPlano | null> {
  const { data: predio } = await supabase.schema('core').from('predios').select('*').eq('id', predioId).single()
  if (!predio) return null

  const [{ data: aliado }, { data: dd }, { data: exp }] = await Promise.all([
    supabase.schema('core').from('aliados').select('*').eq('id', predio.aliado_id).single(),
    supabase.schema('juridica').from('debida_diligencia').select('*').eq('predio_id', predioId).maybeSingle(),
    supabase.schema('core').from('expedientes').select('id, etapa').eq('predio_id', predioId).maybeSingle(),
  ])
  if (!aliado) return null

  const [{ data: ant }, { data: ana }] = await Promise.all([
    supabase.schema('juridica').from('antecedentes').select('*').eq('aliado_id', predio.aliado_id).maybeSingle(),
    supabase.schema('juridica').from('analisis_juridico').select('*').eq('predio_id', predioId).maybeSingle(),
  ])

  return ensamblar(predio, aliado, dd, exp ?? null, ant, ana)
}

/** Lista de casos (un predio = un caso), con join en memoria para evitar N+1. */
export async function listCasos(supabase: SB): Promise<CasoPlano[]> {
  const { data: predios } = await supabase.schema('core').from('predios').select('*').order('created_at', { ascending: false })
  if (!predios || predios.length === 0) return []

  const aliadoIds = [...new Set(predios.map((p) => p.aliado_id))]
  const predioIds = predios.map((p) => p.id)

  const [{ data: aliados }, { data: dds }, { data: exps }, { data: ants }, { data: anas }] = await Promise.all([
    supabase.schema('core').from('aliados').select('*').in('id', aliadoIds),
    supabase.schema('juridica').from('debida_diligencia').select('*').in('predio_id', predioIds),
    supabase.schema('core').from('expedientes').select('id, predio_id, etapa').in('predio_id', predioIds),
    supabase.schema('juridica').from('antecedentes').select('*').in('aliado_id', aliadoIds),
    supabase.schema('juridica').from('analisis_juridico').select('*').in('predio_id', predioIds),
  ])

  const aliadoById = new Map((aliados ?? []).map((a) => [a.id, a]))
  const ddByPredio = new Map((dds ?? []).map((d) => [d.predio_id, d]))
  const expByPredio = new Map((exps ?? []).map((e) => [e.predio_id, e]))
  const antByAliado = new Map((ants ?? []).map((a) => [a.aliado_id, a]))
  const anaByPredio = new Map((anas ?? []).map((a) => [a.predio_id, a]))

  return predios
    .map((p) => {
      const aliado = aliadoById.get(p.aliado_id)
      if (!aliado) return null
      return ensamblar(
        p, aliado,
        ddByPredio.get(p.id) ?? null,
        expByPredio.get(p.id) ?? null,
        antByAliado.get(p.aliado_id) ?? null,
        anaByPredio.get(p.id) ?? null,
      )
    })
    .filter((x): x is CasoPlano => x !== null)
}

/**
 * Busca una persona por documento; si no existe la crea.
 * Permite que un mismo aliado tenga varios predios (modelo 1—N).
 * Devuelve el id de core.aliados o lanza con código '23505' si choca el documento.
 */
export async function findOrCreateAliado(
  supabase: SB,
  data: {
    numero_documento: string
    nombre_completo: string
    tipo_documento?: string
    telefono?: string | null
    email?: string | null
    created_by?: string | null
  },
): Promise<{ id: string; created: boolean }> {
  const tipo_documento = data.tipo_documento ?? 'CC'
  const tipo_persona = tipo_documento === 'NIT' ? 'juridica' : 'natural'

  const { data: existente } = await supabase
    .schema('core').from('aliados')
    .select('id')
    .eq('numero_documento', data.numero_documento)
    .maybeSingle()

  if (existente) return { id: existente.id, created: false }

  const { data: nuevo, error } = await supabase
    .schema('core').from('aliados')
    .insert({
      tipo_persona,
      tipo_documento,
      numero_documento: data.numero_documento,
      nombre_completo: data.nombre_completo,
      telefono: data.telefono ?? null,
      email: data.email ?? null,
      created_by: data.created_by ?? null,
    })
    .select('id')
    .single()

  if (error) throw error
  return { id: nuevo!.id, created: true }
}
