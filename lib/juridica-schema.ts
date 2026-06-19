import { z } from 'zod'

// ─── HOJA 1: Aliado ────────────────────────────────────────────────────────────

export const aliadoSchema = z.object({
  nombre_completo:             z.string().min(2, 'Nombre requerido'),
  tipo_documento:              z.enum(['CC', 'NUIP', 'CE', 'TI', 'PP', 'NIT']).default('CC'),
  numero_documento:            z.string().min(3, 'Documento requerido'),
  departamento:                z.string().optional(),
  municipio:                   z.string().min(2, 'Municipio requerido'),
  vereda:                      z.string().optional(),
  zona_ae:                     z.string().optional(),
  nombre_predio:               z.string().optional(),
  matricula_inmobiliaria:      z.string().optional(),
  area_registral:              z.coerce.number().positive().optional(),
  codigo_catastral:            z.string().optional(),
  anio_ultimo_pago_predial:    z.coerce.number().int().min(1900).max(2100).optional(),
  manifestacion_interes:       z.boolean().optional(),
  manifestacion_observaciones: z.string().optional(),
})

// ─── HOJA 2: Antecedentes ─────────────────────────────────────────────────────

// Listas restrictivas — boolean nullable (null = no consultada)
const listaBoolean = z.boolean().nullable().default(null)

export const antecedentesSchema = z.object({
  // Nacionales
  rama_judicial:     listaBoolean,
  procuraduria:      listaBoolean,
  contraloria:       listaBoolean,
  policia_nacional:  listaBoolean,
  rnmc:              listaBoolean,
  // Internacionales
  onu:               listaBoolean,
  ofac:              listaBoolean,
  bid:               listaBoolean,
  banco_mundial:     listaBoolean,
  hm_treasury:       listaBoolean,
  fbi:               listaBoolean,
  interpol:          listaBoolean,
  ue_terroristas:    listaBoolean,
  dea:               listaBoolean,
  // Reputacionales
  pep:               listaBoolean,
  prensa_negativa:   listaBoolean,
  // Resultado
  observaciones:     z.string().optional(),
  aprobado:          z.boolean().nullable().default(null),
})

// ─── HOJA 3: Análisis jurídico ────────────────────────────────────────────────

export const analisisSchema = z.object({
  estado_folio:             z.enum(['ACTIVO', 'CERRADO']).optional(),
  vereda_registral:         z.string().optional(),
  fmi_matrices:             z.string().optional(),
  fmi_derivados:            z.string().optional(),
  acto_origen:              z.string().optional(),
  descripcion_acto_origen:  z.string().optional(),
  acto_adquisicion_actual:  z.string().optional(),
  naturaleza_juridica:      z.string().optional(),
  falsa_tradicion:          z.boolean().optional(),
  procesos_judiciales:      z.boolean().optional(),
  procesos_judiciales_desc: z.string().optional(),
  medidas_cautelares:       z.boolean().optional(),
  medidas_cautelares_desc:  z.string().optional(),
  liquidaciones:            z.boolean().optional(),
  liquidaciones_desc:       z.string().optional(),
  sucesiones:               z.boolean().optional(),
  sucesiones_desc:          z.string().optional(),
  concepto_ant:             z.string().optional(),
  concepto_urt:             z.string().optional(),
  concepto_pnn:             z.string().optional(),
  observaciones:            z.string().optional(),
  semaforo:                 z.enum(['verde', 'amarillo', 'naranja', 'rojo']).optional(),
})

// ─── Tipos TypeScript ─────────────────────────────────────────────────────────

export type AliadoForm       = z.infer<typeof aliadoSchema>
export type AntecedentesForm = z.infer<typeof antecedentesSchema>
export type AnalisisForm     = z.infer<typeof analisisSchema>

export type EstadoAliado = 'borrador' | 'antecedentes_ok' | 'juridico_ok' | 'aprobado' | 'rechazado'
export type Semaforo     = 'verde' | 'amarillo' | 'naranja' | 'rojo'

export interface Aliado {
  id:                          string   // = predio_id (identificador del caso en la UI)
  predio_id?:                  string
  aliado_id?:                  string   // id de la persona en core.aliados
  expediente_id?:              string | null
  tipo_persona?:               string   // 'natural' | 'juridica'
  cedula_url?:                 string | null
  nombre_completo:             string
  tipo_documento:              string
  numero_documento:            string
  departamento:                string | null
  municipio:                   string
  vereda:                      string | null
  zona_ae:                     string | null
  nombre_predio:               string | null
  matricula_inmobiliaria:      string | null
  certificado_tradicion_url:   string | null
  area_registral:              number | null
  codigo_catastral:            string | null
  anio_ultimo_pago_predial:    number | null
  recibo_predial_url:          string | null
  manifestacion_interes:       boolean | null
  manifestacion_observaciones: string | null
  manifestacion_url:           string | null
  estado:                      EstadoAliado
  created_by:                  string | null
  created_at:                  string
  updated_at:                  string
  antecedentes:                Antecedente | null
  analisis_juridico:           AnalisisJuridico | null
}

export interface Antecedente {
  id:                string
  aliado_id:         string
  rama_judicial:     boolean | null
  procuraduria:      boolean | null
  contraloria:       boolean | null
  policia_nacional:  boolean | null
  rnmc:              boolean | null
  onu:               boolean | null
  ofac:              boolean | null
  bid:               boolean | null
  banco_mundial:     boolean | null
  hm_treasury:       boolean | null
  fbi:               boolean | null
  interpol:          boolean | null
  ue_terroristas:    boolean | null
  dea:               boolean | null
  pep:               boolean | null
  prensa_negativa:   boolean | null
  observaciones:     string | null
  aprobado:          boolean | null
  [key: string]:     string | boolean | null
}

export interface AnalisisJuridico {
  id:                          string
  aliado_id:                   string
  estado_folio:                string | null
  vereda_registral:            string | null
  fmi_matrices:                string | null
  fmi_derivados:               string | null
  acto_origen:                 string | null
  descripcion_acto_origen:     string | null
  acto_adquisicion_actual:     string | null
  naturaleza_juridica:         string | null
  falsa_tradicion:             boolean | null
  procesos_judiciales:         boolean | null
  procesos_judiciales_desc:    string | null
  medidas_cautelares:          boolean | null
  medidas_cautelares_desc:     string | null
  liquidaciones:               boolean | null
  liquidaciones_desc:          string | null
  sucesiones:                  boolean | null
  sucesiones_desc:             string | null
  concepto_ant:                string | null
  concepto_urt:                string | null
  concepto_pnn:                string | null
  observaciones:               string | null
  semaforo:                    Semaforo | null
}

// ─── Helpers de UI ────────────────────────────────────────────────────────────

export const ESTADO_CONFIG: Record<EstadoAliado, { label: string; bg: string; text: string }> = {
  borrador:         { label: 'Borrador',        bg: 'bg-stone-100',   text: 'text-stone-500' },
  antecedentes_ok:  { label: 'Antecedentes OK', bg: 'bg-blue-50',     text: 'text-blue-600'  },
  juridico_ok:      { label: 'Jurídico OK',     bg: 'bg-amber-50',    text: 'text-amber-700' },
  aprobado:         { label: 'Aprobado',         bg: 'bg-teal-50',     text: 'text-teal-700'  },
  rechazado:        { label: 'Rechazado',        bg: 'bg-red-50',      text: 'text-red-600'   },
}

export const SEMAFORO_CONFIG: Record<Semaforo, { label: string; color: string; dot: string }> = {
  verde:    { label: 'Verde',    color: 'text-emerald-600', dot: 'bg-emerald-500' },
  amarillo: { label: 'Amarillo', color: 'text-yellow-600',  dot: 'bg-yellow-400'  },
  naranja:  { label: 'Naranja',  color: 'text-orange-600',  dot: 'bg-orange-500'  },
  rojo:     { label: 'Rojo',     color: 'text-red-600',     dot: 'bg-red-500'     },
}

// Campos de HOJA 1 que se consideran "completos" para calcular completitud
export const H1_CAMPOS_CLAVE = [
  'matricula_inmobiliaria',
  'area_registral',
  'codigo_catastral',
  'anio_ultimo_pago_predial',
  'manifestacion_interes',
] as const
