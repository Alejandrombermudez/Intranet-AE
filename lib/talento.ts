/**
 * TALENTO HUMANO — tipos, campos de la ficha y textos compartidos
 * ───────────────────────────────────────────────────────────────
 * Lo usan «Mi perfil» (/intranet/mi-perfil, cada persona), la pestaña Talento
 * humano de /intranet/administrativa y las rutas /api/talento/*.
 * Datos en people.personas, people.contratos, people.cuentas_cobro,
 * people.certificados y people.documentos_persona (solo service_role).
 * Ver docs/sql/migration_talento_humano.sql.
 *
 * La ficha se define UNA vez aquí (CAMPOS_FICHA): el formulario, la
 * completitud y la lista de columnas que la persona puede editar salen de esta
 * lista. Agregar un dato a la ficha es agregarlo aquí y en el SQL.
 */

export const DOMINIO = '@amazoniaemprende.com'
export const esCorreoInterno = (email: string | null | undefined) => !!email && email.toLowerCase().endsWith(DOMINIO)

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Vinculacion = 'planta' | 'contratista' | 'aprendiz' | 'practicante'
export type EstadoCuenta = 'radicada' | 'aprobada' | 'devuelta' | 'pagada' | 'anulada'

export interface Persona {
  id: string
  email: string
  m365_oid: string | null
  tipo_documento: string | null
  numero_documento: string | null
  fecha_expedicion: string | null
  lugar_expedicion: string | null
  nombres: string | null
  apellidos: string | null
  fecha_nacimiento: string | null
  lugar_nacimiento: string | null
  sexo: string | null
  estado_civil: string | null
  nacionalidad: string | null
  celular: string | null
  telefono_fijo: string | null
  correo_personal: string | null
  direccion: string | null
  barrio: string | null
  municipio: string | null
  departamento: string | null
  grupo_sanguineo: string | null
  eps: string | null
  fondo_pensiones: string | null
  fondo_cesantias: string | null
  arl: string | null
  caja_compensacion: string | null
  informacion_medica: string | null
  emergencia_nombre: string | null
  emergencia_parentesco: string | null
  emergencia_telefono: string | null
  nivel_educativo: string | null
  profesion: string | null
  tarjeta_profesional: string | null
  banco: string | null
  tipo_cuenta: string | null
  numero_cuenta: string | null
  responsable_iva: boolean
  talla_camisa: string | null
  talla_pantalon: string | null
  talla_calzado: string | null
  firma: string | null
  m365: M365 | null
  foto: string | null
  m365_sincronizado_at: string | null
  autoriza_datos: boolean
  autoriza_sensibles: boolean
  autoriza_at: string | null
  autoriza_version: string | null
  activo: boolean
  notas_rrhh?: string | null
  updated_at: string
}

/** Lo que trae Microsoft 365 (Graph /me). */
export interface M365 {
  nombre?: string | null
  cargo?: string | null
  departamento?: string | null
  celular?: string | null
  telefonos?: string[] | null
  oficina?: string | null
  ciudad?: string | null
  id_empleado?: string | null
  /** true = la persona subió su propia foto: la de Microsoft ya no la reemplaza. */
  foto_propia?: boolean
}

export interface Contrato {
  id: string
  persona_id: string
  vinculacion: Vinculacion
  modalidad: string | null
  numero: string | null
  cargo: string
  objeto: string | null
  proyecto: string | null
  fecha_inicio: string
  fecha_fin: string | null
  valor_mensual: number | null
  valor_total: number | null
  supervisor: string | null
  archivo: string | null
  estado: 'vigente' | 'terminado' | 'anulado'
  fecha_terminacion: string | null
  motivo_terminacion: string | null
  notas: string | null
}

export interface DocumentoPersona {
  id: string
  persona_id: string
  tipo: string
  nombre: string
  ruta: string
  tamano: number | null
  subido_por: string | null
  created_at: string
}

/** La foto fija que guarda cada cuenta de cobro al radicarse. */
export interface DatosCuenta {
  persona: {
    nombres: string; apellidos: string; tipo_documento: string | null; numero_documento: string
    lugar_expedicion: string | null; direccion: string | null; municipio: string | null; celular: string | null
    email: string; banco: string; tipo_cuenta: string | null; numero_cuenta: string; responsable_iva: boolean
    firma: string | null
  }
  contrato: { numero: string | null; objeto: string | null; cargo: string; proyecto: string | null
    fecha_inicio: string; fecha_fin: string | null; valor_mensual: number | null }
  organizacion: { razon_social: string | null; nit: string | null; direccion: string | null; ciudad: string | null
    texto_cuenta_cobro: string | null }
  radicada: string
}

export interface CuentaCobro {
  id: string
  persona_id: string
  contrato_id: string
  consecutivo: number
  fecha: string
  periodo_desde: string | null
  periodo_hasta: string | null
  concepto: string
  valor: number
  datos: DatosCuenta
  soporte_planilla: string | null
  estado: EstadoCuenta
  observacion: string | null
  revisada_por: string | null
  revisada_at: string | null
  pagada_at: string | null
  radicada_por: string | null
  created_at: string
}

export interface ConfigTalento {
  razon_social: string | null
  nit: string | null
  direccion: string | null
  ciudad: string | null
  telefono: string | null
  correo: string | null
  firmante_nombre: string | null
  firmante_cargo: string | null
  firmante_firma: string | null
  texto_cuenta_cobro: string | null
}

export interface Certificado {
  id: string
  persona_id: string
  tipo: 'laboral'
  incluye_salario: boolean
  dirigido_a: string | null
  codigo: string
  datos: DatosCertificado
  generado_por: string | null
  created_at: string
}

export interface DatosCertificado {
  persona: { nombres: string; apellidos: string; tipo_documento: string | null; numero_documento: string; lugar_expedicion: string | null; sexo?: string | null }
  contratos: Pick<Contrato, 'vinculacion' | 'modalidad' | 'numero' | 'cargo' | 'objeto' | 'fecha_inicio' | 'fecha_fin' | 'valor_mensual' | 'estado' | 'fecha_terminacion'>[]
  organizacion: ConfigTalento
  expedido: string
}

// ─── Etiquetas ────────────────────────────────────────────────────────────────

export const VINCULACION: Record<Vinculacion, string> = {
  planta: 'Planta',
  contratista: 'Contratista',
  aprendiz: 'Aprendiz SENA',
  practicante: 'Practicante',
}

export const MODALIDAD: Record<string, string> = {
  termino_indefinido: 'Contrato laboral a término indefinido',
  termino_fijo: 'Contrato laboral a término fijo',
  obra_labor: 'Contrato laboral por obra o labor',
  prestacion_servicios: 'Contrato de prestación de servicios',
  aprendizaje: 'Contrato de aprendizaje',
  practica: 'Convenio de práctica',
}

/** Qué modalidades tienen sentido para cada vinculación. */
export const MODALIDADES_DE: Record<Vinculacion, string[]> = {
  planta: ['termino_indefinido', 'termino_fijo', 'obra_labor'],
  contratista: ['prestacion_servicios'],
  aprendiz: ['aprendizaje'],
  practicante: ['practica'],
}

export const ESTADO_CUENTA: Record<EstadoCuenta, { nombre: string; color: string; que: string }> = {
  radicada: { nombre: 'Radicada', color: 'var(--color-ambar)', que: 'Llegó a talento humano y espera revisión.' },
  aprobada: { nombre: 'Aprobada', color: 'var(--color-pizarra)', que: 'Revisada y lista para pago.' },
  devuelta: { nombre: 'Devuelta', color: 'var(--color-red-600)', que: 'Talento humano pidió corregirla.' },
  pagada: { nombre: 'Pagada', color: 'var(--color-bosque)', que: 'Pagada.' },
  anulada: { nombre: 'Anulada', color: 'var(--color-tenue)', que: 'No va.' },
}

export const TIPOS_DOCUMENTO_ARCHIVO: Record<string, string> = {
  documento_identidad: 'Documento de identidad',
  rut: 'RUT',
  certificacion_bancaria: 'Certificación bancaria',
  hoja_vida: 'Hoja de vida',
  titulo: 'Diploma o acta de grado',
  afiliaciones: 'Certificados de afiliación (EPS, pensión, ARL)',
  examen_medico: 'Examen médico ocupacional',
  antecedentes: 'Antecedentes (Procuraduría, Contraloría, Policía)',
  otro: 'Otro',
}

export const TIPO_CUENTA: Record<string, string> = {
  ahorros: 'Ahorros',
  corriente: 'Corriente',
  deposito_electronico: 'Depósito electrónico (Nequi, Daviplata…)',
}

export const TIPO_DOC_ID: Record<string, string> = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  TI: 'Tarjeta de identidad',
  PEP: 'Permiso especial de permanencia',
  PPT: 'Permiso por protección temporal',
  PA: 'Pasaporte',
}
export const SIGLA_DOC: Record<string, string> = { CC: 'C.C.', CE: 'C.E.', TI: 'T.I.', PEP: 'PEP', PPT: 'PPT', PA: 'Pasaporte' }

// ─── Listas de sugerencias (se puede escribir otra cosa) ──────────────────────

export const LISTAS: Record<string, string[]> = {
  eps: ['Nueva EPS', 'Sanitas', 'Sura', 'Salud Total', 'Compensar', 'Famisanar', 'Coosalud', 'Mutual Ser',
    'Asmet Salud', 'Emssanar', 'SOS', 'Aliansalud', 'Savia Salud', 'Capresoca', 'Cajacopi', 'Pijaos Salud',
    'Mallamas', 'Dusakawi', 'Anas Wayuu', 'Comfenalco Valle'],
  fondo_pensiones: ['Colpensiones', 'Porvenir', 'Protección', 'Colfondos', 'Skandia'],
  fondo_cesantias: ['Porvenir', 'Protección', 'Colfondos', 'Skandia', 'Fondo Nacional del Ahorro'],
  arl: ['Sura', 'Positiva', 'Colmena', 'Seguros Bolívar', 'AXA Colpatria', 'La Equidad', 'Seguros Alfa', 'Mapfre'],
  caja_compensacion: ['Comfaca', 'Comfandi', 'Compensar', 'Cafam', 'Colsubsidio', 'Comfama', 'Comfenalco',
    'Comfamiliar Huila', 'Comfacauca', 'Comfamiliar Nariño', 'Comfatolima'],
  banco: ['Bancolombia', 'Banco de Bogotá', 'Davivienda', 'BBVA', 'Banco Agrario', 'Banco de Occidente',
    'Banco Popular', 'Banco AV Villas', 'Banco Caja Social', 'Scotiabank Colpatria', 'Itaú', 'Banco Pichincha',
    'Bancamía', 'Banco W', 'Banco Mundo Mujer', 'Banco Falabella', 'Nequi', 'Daviplata', 'Nu', 'Lulo Bank'],
  estado_civil: ['Soltero(a)', 'Casado(a)', 'Unión libre', 'Separado(a)', 'Divorciado(a)', 'Viudo(a)'],
  nivel_educativo: ['Primaria', 'Bachillerato', 'Técnico', 'Tecnólogo', 'Profesional', 'Especialización',
    'Maestría', 'Doctorado'],
  departamento: ['Caquetá', 'Putumayo', 'Huila', 'Amazonas', 'Guaviare', 'Meta', 'Cauca', 'Nariño', 'Tolima',
    'Bogotá D.C.', 'Cundinamarca', 'Antioquia', 'Valle del Cauca', 'Santander', 'Boyacá', 'Caldas', 'Risaralda',
    'Quindío', 'Atlántico', 'Bolívar', 'Córdoba', 'Sucre', 'Magdalena', 'Cesar', 'La Guajira',
    'Norte de Santander', 'Arauca', 'Casanare', 'Vichada', 'Guainía', 'Vaupés', 'Chocó', 'San Andrés'],
  emergencia_parentesco: ['Madre', 'Padre', 'Cónyuge o compañero(a)', 'Hijo(a)', 'Hermano(a)', 'Otro familiar', 'Amigo(a)'],
  tallas_ropa: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
}

// ─── La ficha ─────────────────────────────────────────────────────────────────

export type TipoCampo = 'texto' | 'fecha' | 'tel' | 'email' | 'opciones' | 'lista' | 'area' | 'si_no'

export interface CampoFicha {
  clave: keyof Persona & string
  etiqueta: string
  grupo: string
  tipo: TipoCampo
  /** Para `opciones` (cerradas): valor → texto. Para `lista`: clave de LISTAS (sugerencias abiertas). */
  opciones?: Record<string, string>
  lista?: string
  requerido?: boolean
  /** Dato sensible (Ley 1581): exige la autorización de datos sensibles. */
  sensible?: boolean
  ayuda?: string
  /** Solo para contratistas (no cuenta en la completitud de la gente de planta). */
  soloContratista?: boolean
  ancho?: 'completo'
}

const opcionesDe = (arr: string[]) => Object.fromEntries(arr.map((v) => [v, v]))

export const GRUPOS_FICHA = [
  { id: 'identificacion', titulo: 'Identificación' },
  { id: 'personal', titulo: 'Datos personales' },
  { id: 'contacto', titulo: 'Contacto y residencia' },
  { id: 'salud', titulo: 'Seguridad social y salud' },
  { id: 'emergencia', titulo: 'En caso de emergencia' },
  { id: 'formacion', titulo: 'Formación' },
  { id: 'pago', titulo: 'Para los pagos' },
  { id: 'dotacion', titulo: 'Dotación' },
] as const

export const CAMPOS_FICHA: CampoFicha[] = [
  { clave: 'nombres', etiqueta: 'Nombres', grupo: 'identificacion', tipo: 'texto', requerido: true },
  { clave: 'apellidos', etiqueta: 'Apellidos', grupo: 'identificacion', tipo: 'texto', requerido: true },
  { clave: 'tipo_documento', etiqueta: 'Tipo de documento', grupo: 'identificacion', tipo: 'opciones', opciones: TIPO_DOC_ID, requerido: true },
  { clave: 'numero_documento', etiqueta: 'Número de documento', grupo: 'identificacion', tipo: 'texto', requerido: true, ayuda: 'Sin puntos.' },
  { clave: 'fecha_expedicion', etiqueta: 'Fecha de expedición', grupo: 'identificacion', tipo: 'fecha', requerido: true },
  { clave: 'lugar_expedicion', etiqueta: 'Lugar de expedición', grupo: 'identificacion', tipo: 'texto', requerido: true },

  { clave: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', grupo: 'personal', tipo: 'fecha', requerido: true },
  { clave: 'lugar_nacimiento', etiqueta: 'Lugar de nacimiento', grupo: 'personal', tipo: 'texto' },
  { clave: 'sexo', etiqueta: 'Sexo', grupo: 'personal', tipo: 'opciones', opciones: { F: 'Femenino', M: 'Masculino', X: 'Otro / prefiero no decir' }, requerido: true },
  { clave: 'estado_civil', etiqueta: 'Estado civil', grupo: 'personal', tipo: 'opciones', opciones: opcionesDe(LISTAS.estado_civil) },
  { clave: 'nacionalidad', etiqueta: 'Nacionalidad', grupo: 'personal', tipo: 'texto' },

  { clave: 'celular', etiqueta: 'Celular', grupo: 'contacto', tipo: 'tel', requerido: true },
  { clave: 'telefono_fijo', etiqueta: 'Otro teléfono', grupo: 'contacto', tipo: 'tel' },
  { clave: 'correo_personal', etiqueta: 'Correo personal', grupo: 'contacto', tipo: 'email' },
  { clave: 'direccion', etiqueta: 'Dirección de residencia', grupo: 'contacto', tipo: 'texto', requerido: true, ancho: 'completo' },
  { clave: 'barrio', etiqueta: 'Barrio o vereda', grupo: 'contacto', tipo: 'texto' },
  { clave: 'municipio', etiqueta: 'Municipio', grupo: 'contacto', tipo: 'texto', requerido: true },
  { clave: 'departamento', etiqueta: 'Departamento', grupo: 'contacto', tipo: 'lista', lista: 'departamento', requerido: true },

  { clave: 'grupo_sanguineo', etiqueta: 'Tipo de sangre y RH', grupo: 'salud', tipo: 'opciones', opciones: opcionesDe(['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']), requerido: true, sensible: true },
  { clave: 'eps', etiqueta: 'EPS', grupo: 'salud', tipo: 'lista', lista: 'eps', requerido: true },
  { clave: 'fondo_pensiones', etiqueta: 'Fondo de pensiones', grupo: 'salud', tipo: 'lista', lista: 'fondo_pensiones', requerido: true },
  { clave: 'fondo_cesantias', etiqueta: 'Fondo de cesantías', grupo: 'salud', tipo: 'lista', lista: 'fondo_cesantias', ayuda: 'Solo personal de planta.' },
  { clave: 'arl', etiqueta: 'ARL', grupo: 'salud', tipo: 'lista', lista: 'arl', requerido: true },
  { clave: 'caja_compensacion', etiqueta: 'Caja de compensación', grupo: 'salud', tipo: 'lista', lista: 'caja_compensacion' },
  { clave: 'informacion_medica', etiqueta: 'Alergias o condiciones médicas a tener en cuenta en campo', grupo: 'salud', tipo: 'area', sensible: true, ancho: 'completo', ayuda: 'Opcional. Picaduras, medicamentos, enfermedades: lo que alguien debería saber si te pasa algo en el predio.' },

  { clave: 'emergencia_nombre', etiqueta: 'Nombre', grupo: 'emergencia', tipo: 'texto', requerido: true },
  { clave: 'emergencia_parentesco', etiqueta: 'Parentesco', grupo: 'emergencia', tipo: 'lista', lista: 'emergencia_parentesco', requerido: true },
  { clave: 'emergencia_telefono', etiqueta: 'Teléfono', grupo: 'emergencia', tipo: 'tel', requerido: true },

  { clave: 'nivel_educativo', etiqueta: 'Nivel educativo', grupo: 'formacion', tipo: 'opciones', opciones: opcionesDe(LISTAS.nivel_educativo), requerido: true },
  { clave: 'profesion', etiqueta: 'Profesión u oficio', grupo: 'formacion', tipo: 'texto' },
  { clave: 'tarjeta_profesional', etiqueta: 'Tarjeta profesional', grupo: 'formacion', tipo: 'texto', ayuda: 'Si tu profesión la exige.' },

  { clave: 'banco', etiqueta: 'Banco', grupo: 'pago', tipo: 'lista', lista: 'banco', requerido: true },
  { clave: 'tipo_cuenta', etiqueta: 'Tipo de cuenta', grupo: 'pago', tipo: 'opciones', opciones: TIPO_CUENTA, requerido: true },
  { clave: 'numero_cuenta', etiqueta: 'Número de cuenta', grupo: 'pago', tipo: 'texto', requerido: true },
  { clave: 'responsable_iva', etiqueta: 'Soy responsable de IVA', grupo: 'pago', tipo: 'si_no', soloContratista: true, ayuda: 'Casi ningún contratista persona natural lo es. Si no sabes, déjalo en No.' },

  { clave: 'talla_camisa', etiqueta: 'Talla de camisa', grupo: 'dotacion', tipo: 'opciones', opciones: opcionesDe(LISTAS.tallas_ropa) },
  { clave: 'talla_pantalon', etiqueta: 'Talla de pantalón', grupo: 'dotacion', tipo: 'texto' },
  { clave: 'talla_calzado', etiqueta: 'Talla de calzado', grupo: 'dotacion', tipo: 'texto' },
]

/** Columnas que la persona puede cambiar de su propia ficha. */
export const EDITABLES_PERSONA = [...CAMPOS_FICHA.map((c) => c.clave), 'firma', 'foto'] as const
/** Además de lo anterior, lo que solo talento humano cambia. */
export const EDITABLES_RRHH = [...EDITABLES_PERSONA, 'notas_rrhh', 'activo', 'email'] as const

/** Qué tanto está completa la ficha: requeridos llenos / requeridos. */
export function completitud(p: Partial<Persona>, esContratista = false): { llenos: number; total: number; faltan: CampoFicha[] } {
  const req = CAMPOS_FICHA.filter((c) => c.requerido && (!c.soloContratista || esContratista))
  const faltan = req.filter((c) => {
    const v = p[c.clave]
    return v === null || v === undefined || (typeof v === 'string' && !v.trim())
  })
  return { llenos: req.length - faltan.length, total: req.length, faltan }
}

export const nombreCompleto = (p: { nombres?: string | null; apellidos?: string | null; email?: string }) =>
  [p.nombres, p.apellidos].filter(Boolean).join(' ').trim() || p.email || '—'

/** El contrato vigente más reciente, si hay. */
export function contratoVigente(contratos: Contrato[]): Contrato | null {
  return [...contratos].filter((c) => c.estado === 'vigente').sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))[0] ?? null
}

// ─── Autorización de tratamiento de datos (Ley 1581 de 2012) ──────────────────

export const AUTORIZACION_VERSION = '2026-10-14'
export const AUTORIZACION_TEXTO =
  'Autorizo a Amazonía Emprende para recolectar, almacenar, usar y actualizar mis datos personales con el fin ' +
  'de gestionar mi vinculación (contratación, pagos, afiliaciones a seguridad social, certificaciones, dotación ' +
  'y atención de emergencias), conforme a la Ley 1581 de 2012 y su política de tratamiento de datos. Sé que ' +
  'puedo conocer, actualizar, rectificar y pedir la supresión de mis datos escribiendo a talento humano.'
export const AUTORIZACION_SENSIBLES =
  'Autorizo además el tratamiento de mis datos sensibles (tipo de sangre e información médica) solo para ' +
  'atender emergencias y cumplir obligaciones de seguridad y salud en el trabajo. Sé que no estoy obligado(a) ' +
  'a entregarlos.'

// ─── Formatos ─────────────────────────────────────────────────────────────────

const PESOS = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
export const pesos = (n: number | null | undefined) => (n == null ? '—' : PESOS.format(Math.round(Number(n))))

export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? iso + 'T12:00' : iso)
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Días que faltan hasta una fecha (negativo si ya pasó). */
export function diasHasta(fecha: string): number {
  return Math.round((new Date(fecha + 'T12:00').getTime() - Date.now()) / 86400000)
}

/** Primer y último día del mes de una fecha (para el periodo de una cuenta de cobro). */
export function mesDe(iso: string): { desde: string; hasta: string } {
  const [a, m] = iso.split('-').map(Number)
  const ult = new Date(a, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return { desde: `${a}-${mm}-01`, hasta: `${a}-${mm}-${String(ult).padStart(2, '0')}` }
}
