/**
 * Traducción de los datos crudos del expediente a algo legible en el informe.
 *
 * Los formularios de campo guardan las respuestas con la llave técnica
 * (`disposicion_aguas_servidas`, `pct_cobertura_boscosa`…). Aquí viven los
 * nombres que ve la gente y el formato de cada valor, para que el informe no
 * tenga que saber nada de cómo está guardado.
 */

/** Nombre legible de cada campo. Lo que no esté aquí se deduce de la llave. */
export const ETIQUETAS: Record<string, string> = {
  // ── General / acceso ──
  encuestador: 'Encuestador', tipo_encuestado: 'Tipo de encuestado',
  fecha_encuesta: 'Fecha de la encuesta', estrato_paisaje: 'Estrato de paisaje',
  altitud_msnm: 'Altitud (m s. n. m.)', anio_adquisicion: 'Año de adquisición',
  distancia_cabecera_km: 'Distancia a la cabecera', distancia_florencia_km: 'Distancia a Florencia',
  tiempo_florencia_min: 'Tiempo hasta Florencia', tipo_via: 'Tipo de vía',
  tipo_acceso_predio: 'Cómo se llega al predio', servicios_domiciliarios: 'Servicios domiciliarios',
  fuente_agua: 'Fuente de agua', senal_telefonica: 'Señal telefónica',

  // ── Vivienda ──
  material_techo: 'Material del techo', material_paredes: 'Material de las paredes',
  material_piso: 'Material del piso', num_habitaciones: 'Habitaciones',
  personas_vivienda: 'Personas en la vivienda', tipo_cocina: 'Tipo de cocina',
  tipo_bano: 'Baño', disposicion_excretas: 'Disposición de excretas',
  disposicion_aguas_servidas: 'Aguas servidas', manejo_basuras: 'Manejo de basuras',

  // ── Hogar ──
  adultos: 'Adultos', ninos: 'Niños', cant_mujeres: 'Mujeres', cant_hombres: 'Hombres',
  miembros_familia: 'Miembros de la familia', poblacion_tendencia: 'Tendencia de la población',
  acceso_salud: 'Acceso a salud', regimen_salud: 'Régimen de salud',
  puesto_salud: 'Puesto de salud', acceso_educacion: 'Acceso a educación',
  distancia_educacion_km: 'Distancia a la escuela', tiempo_llegada_region: 'Tiempo en la región',
  razon_llegada: 'Razón de llegada',

  // ── Economía ──
  ha_total: 'Área total', ha_potreros: 'Área en potreros', ha_bosque: 'Área en bosque',
  ha_otras: 'Otras áreas', valor_comercial_ha: 'Valor comercial por hectárea',
  tendencia_area: 'Tendencia del área', cambio_area_ha: 'Cambio de área',
  intencion_vender: 'Intención de vender', causas_venta: 'Causas de venta',
  actividad_economica: 'Actividad económica', empleos_locales: 'Empleos locales',
  nivel_ingresos: 'Nivel de ingresos', medio_transporte_produccion: 'Transporte de la producción',
  transporte_propio: 'Transporte propio', valor_transporte: 'Costo del transporte',
  problemas_mercado: 'Problemas de mercado',

  // ── Cultivos ──
  cultivo: 'Cultivo', area_ha: 'Área (ha)', densidad: 'Densidad',
  anio_siembra: 'Año de siembra', rendimiento: 'Rendimiento', destino: 'Destino',

  // ── Ganadería ──
  tiene_ganaderia: 'Tiene ganadería', tipo_tenencia_ganado: 'Tenencia del ganado',
  orientacion_ganaderia: 'Orientación', num_cabezas_ganado: 'Cabezas de ganado',
  ha_ganaderia: 'Área en ganadería', tipos_pasto: 'Tipos de pasto',
  litros_leche_dia: 'Litros de leche/día', tanque_enfriamiento: 'Tanque de enfriamiento',
  destino_leche: 'Destino de la leche', precio_leche_litro: 'Precio del litro',
  sistema_alimentacion_ganado: 'Sistema de alimentación', especies_forrajeras: 'Especies forrajeras',
  uso_fertilizacion_ganado: 'Fertilización', manejo_praderas: 'Manejo de praderas',
  infraestructura_ganadera: 'Infraestructura', material_postes: 'Material de postes',
  ha_pasto_ultimo_anio: 'Pasto sembrado el último año', origen_nuevos_pastos: 'Origen de los pastos',
  pastoreo_rotacional: 'Pastoreo rotacional', diversificacion_forrajera: 'Diversificación forrajera',
  cercas_vivas: 'Cercas vivas', sistemas_silvopastoriles: 'Sistemas silvopastoriles',
  captacion_agua_lluvia: 'Captación de agua lluvia', manejo_residuos_organicos: 'Residuos orgánicos',
  reduccion_antibioticos: 'Reducción de antibióticos', espacios_sombra_agua: 'Sombra y agua',
  reduccion_estres: 'Reducción de estrés', interes_ganaderia_regenerativa: 'Interés en regenerativa',
  otras_especies_pecuarias: 'Otras especies pecuarias',

  // ── Tecnología y manejo ──
  instalaciones_maquinaria: 'Instalaciones y maquinaria', tiene_tractor: 'Tractor',
  tiene_camion: 'Camión', manejo_suelo_fertilizacion: 'Manejo del suelo',
  tipo_fertilizacion: 'Tipo de fertilización', cobertura_arborea: 'Cobertura arbórea',
  practica_podas: 'Hace podas', practica_raleo: 'Hace raleo', control_malezas: 'Control de malezas',
  manejo_agua_cultivo: 'Manejo del agua', problemas_manejo: 'Problemas de manejo',
  especies_variedades: 'Especies y variedades',
  lleva_registros_productividad: 'Lleva registros', interes_capacitacion: 'Interés en capacitación',
  temas_capacitacion: 'Temas de capacitación',

  // ── Bosque y ambiente ──
  aprovecha_bosque: 'Aprovecha el bosque', productos_forestales: 'Productos forestales',
  capacitacion_ambiente: 'Capacitación ambiental', entidad_capacitacion: 'Entidad que capacitó',
  especies_bosque_predio: 'Especies del bosque', especies_fauna_predio: 'Fauna del predio',
  estudio_academico: 'Estudio académico en el predio', disminucion_especies: 'Disminución de especies',
  especies_afectadas: 'Especies afectadas', cambios_caudal: 'Cambios en el caudal',
  cambio_cobertura_ha: 'Cambio de cobertura (ha)', causa_cambio_cobertura: 'Causa del cambio',
  problemas_agropecuarios: 'Problemas agropecuarios',
  programas_gubernamentales: 'Programas del Estado', beneficios_programas: 'Beneficios recibidos',
  impacto_programa: 'Impacto del programa', opinion_productores: 'Opinión de los productores',
  aliado_cooperativa: 'Pertenece a cooperativa', nombre_cooperativa: 'Cooperativa',
  beneficio_cooperativa: 'Beneficio de la cooperativa', calificacion_gremios: 'Calificación de gremios',
  bajo_conservacion: 'Bajo conservación', tiene_espacio_vegetal: 'Espacio para material vegetal',
  observaciones_generales: 'Observaciones generales',

  // ── Evaluación biofísica: suelo ──
  textura_suelo: 'Textura del suelo', drenaje_superficial: 'Drenaje superficial',
  pendiente: 'Pendiente', presencia_roca: 'Presencia de roca', erosion: 'Erosión',
  fuente_agua_eval: 'Fuente de agua', distancia_agua_m: 'Distancia al agua (m)',
  observaciones_suelo: 'Observaciones del suelo',
  foto_textura_url: 'Foto de textura', foto_drenaje_url: 'Foto de drenaje',
  foto_erosion_url: 'Foto de erosión', foto_pendiente_url: 'Foto de pendiente',

  // ── Evaluación biofísica: cobertura ──
  cobertura_dominante: 'Cobertura dominante', pct_cobertura_boscosa: 'Cobertura boscosa',
  densidad_rastrojo: 'Densidad del rastrojo', especies_arboreas_alturas: 'Especies arbóreas y alturas',
  regeneracion_natural: 'Regeneración natural', defaunacion: 'Defaunación',
  requiere_proteccion: 'Requiere protección',

  // ── Evaluación biofísica: logística ──
  medio_acceso_zonas: 'Medio de acceso', tiempo_predio_zona: 'Tiempo del predio a la zona',
  condicion_camino: 'Condición del camino', lugar_deposito_material: 'Depósito de material',
  complejidad_acceso: 'Complejidad del acceso', descripcion_ruta: 'Descripción de la ruta',
  foto_via_url: 'Foto de la vía',

  // ── Riesgos y disposición ──
  quemas_recientes: 'Quemas recientes', anio_quema: 'Año de la quema',
  ganado_activo_poligono: 'Ganado activo en el polígono', cabezas_poligono: 'Cabezas en el polígono',
  conflictos_tenencia: 'Conflictos de tenencia', descripcion_conflictos: 'Descripción de conflictos',
  restricciones_uso: 'Restricciones de uso', cuales_restricciones: 'Cuáles restricciones',
  otros_riesgos: 'Otros riesgos', observaciones_riesgos: 'Observaciones de riesgos',
  disposicion_propietario: 'Disposición del propietario', mano_obra_disponible: 'Mano de obra disponible',
  experiencia_restauracion: 'Experiencia en restauración', observaciones_sociales: 'Observaciones sociales',
  ajustes_poligono: 'Ajustes al polígono',
  evaluador_1: 'Evaluador 1', evaluador_2: 'Evaluador 2', fecha_visita: 'Fecha de la visita',
  senal_celular: 'Señal celular', operador_celular: 'Operador', codigo_formato: 'Código del formato',
  tiempo_desde_via: 'Tiempo desde la vía', version: 'Versión del formato',

  // ── Jurídica ──
  estado: 'Estado', semaforo: 'Semáforo', estado_folio: 'Estado del folio',
  vereda_registral: 'Vereda registral', fmi_matrices: 'FMI matrices', fmi_derivados: 'FMI derivados',
  acto_origen: 'Acto de origen', descripcion_acto_origen: 'Descripción del acto',
  naturaleza_juridica: 'Naturaleza jurídica', falsa_tradicion: 'Falsa tradición',
  procesos_judiciales: 'Procesos judiciales', procesos_judiciales_desc: 'Detalle de procesos',
  medidas_cautelares: 'Medidas cautelares', medidas_cautelares_desc: 'Detalle de medidas',
  liquidaciones: 'Liquidaciones', liquidaciones_desc: 'Detalle de liquidaciones',
  sucesiones: 'Sucesiones', sucesiones_desc: 'Detalle de sucesiones',
  concepto_ant: 'Concepto ANT', concepto_urt: 'Concepto URT', concepto_pnn: 'Concepto PNN',
  observaciones: 'Observaciones', anio_ultimo_pago_predial: 'Último pago predial',
  manifestacion_interes: 'Manifestación de interés',
  manifestacion_observaciones: 'Observaciones de la manifestación',
  pep: 'PEP (persona expuesta políticamente)', prensa_negativa: 'Prensa negativa',
  aprobado: 'Aprobado',
}

/** Campos que se muestran a lo ancho porque suelen traer texto largo. */
export const CAMPOS_LARGOS = new Set([
  'observaciones', 'observaciones_suelo', 'observaciones_riesgos', 'observaciones_sociales',
  'observaciones_generales', 'especies_arboreas_alturas', 'cobertura_dominante',
  'descripcion_ruta', 'descripcion_conflictos', 'descripcion_acto_origen', 'especies_bosque_predio',
  'especies_fauna_predio', 'especies_variedades', 'especies_forrajeras', 'tiempo_predio_zona',
  'cuales_restricciones', 'manifestacion_observaciones', 'puesto_salud', 'razon_llegada',
  'ajustes_poligono', 'procesos_judiciales_desc', 'medidas_cautelares_desc',
  'otros_riesgos', 'tiempo_desde_via', 'lugar_deposito_material',
  'liquidaciones_desc', 'sucesiones_desc', 'especies_afectadas',
])

/** Llaves que no aportan nada en un informe (identificadores, auditoría, adjuntos). */
export const CAMPOS_OCULTOS = new Set([
  'id', 'predio_id', 'aliado_id', 'expediente_id', 'familia_id', 'local_id',
  'created_by', 'created_at', 'updated_at', 'deleted_at', 'sync_origin', 'step_completed',
])

const SIN_ETIQUETA = /_/g

/** Nombre legible de una llave; si no está en el diccionario, se deduce. */
export function etiqueta(clave: string): string {
  if (ETIQUETAS[clave]) return ETIQUETAS[clave]
  const limpio = clave.replace(/_url$/, '').replace(SIN_ETIQUETA, ' ')
  return limpio.charAt(0).toUpperCase() + limpio.slice(1)
}

/** Valor listo para pintar. Devuelve null cuando no hay nada que mostrar. */
export function valor(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) {
    const items = v.filter(x => x !== null && x !== undefined && x !== '')
    return items.length ? items.map(x => String(x)).join(' · ') : null
  }
  if (typeof v === 'object') {
    const s = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== null && x !== '' )
      .map(([k, x]) => `${etiqueta(k)}: ${String(x)}`)
      .join(' · ')
    return s || null
  }
  if (typeof v === 'number') return v.toLocaleString('es-CO', { maximumFractionDigits: 2 })
  // Las marcas de tiempo crudas (`2026-07-28T17:16:56.75+00:00`) no se leen:
  // en un informe van como fecha.
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(v)) return fecha(v)
  return String(v)
}

/** ¿Esta llave apunta a un archivo (foto, firma, PDF)? */
export const esArchivo = (clave: string) => clave.endsWith('_url')

/** Convierte un objeto en pares [etiqueta, valor] listos para una ficha,
 *  saltando lo vacío, lo oculto y los adjuntos. */
export function pares(obj: Record<string, unknown> | null | undefined) {
  if (!obj) return []
  return Object.entries(obj)
    .filter(([k]) => !CAMPOS_OCULTOS.has(k) && !esArchivo(k))
    .map(([k, v]) => {
      const val = valor(v)
      // Un texto largo en una columna angosta estira la fila y deja huecos al
      // lado: cualquier respuesta extensa ocupa el ancho completo, esté o no
      // en la lista de campos largos.
      const largo = CAMPOS_LARGOS.has(k) || (val?.length ?? 0) > 80
      return { clave: k, etiqueta: etiqueta(k), valor: val, largo }
    })
    .filter(p => p.valor !== null)
}

/** Adjuntos (fotos, firmas, soportes) presentes en un objeto. */
export function adjuntos(obj: Record<string, unknown> | null | undefined) {
  if (!obj) return []
  return Object.entries(obj)
    .filter(([k, v]) => esArchivo(k) && typeof v === 'string' && v)
    .map(([k, v]) => ({ clave: k, etiqueta: etiqueta(k), url: v as string }))
}

export const ha = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ha`

export const fecha = (s: string | null | undefined) => {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime())
    ? s
    : d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * Paleta del Manual de Identidad de Marca 2024. Es sobria y terrosa a propósito:
 * el informe es un documento corporativo, no un tablero. Nada de verdes
 * clorofila ni naranjas saturados.
 */
export const MARCA = {
  hueso:   '#e4ded2',
  papel:   '#f4f1ea',
  tinta:   '#1e1a18',
  bosque:  '#2f3f32',
  pizarra: '#385161',
  taupe:   '#b8a28e',
  oliva:   '#3a382d',
  musgo:   '#7a7847',
  cielo:   '#7ca9cd',
  marron:  '#7e5f3b',
  ambar:   '#e1a644',
  salvia:  '#afbdb2',
  celeste: '#b7cdde',
} as const

/** Semáforo jurídico, dicho con color de marca en vez de con una etiqueta de colores. */
export const SEMAFORO: Record<string, { label: string; hex: string }> = {
  verde:    { label: 'Verde',    hex: MARCA.bosque },
  amarillo: { label: 'Amarillo', hex: MARCA.ambar },
  naranja:  { label: 'Naranja',  hex: MARCA.marron },
  rojo:     { label: 'Rojo',     hex: MARCA.tinta },
}

/**
 * Qué hizo el terreno con cada zona. `descartada` va en taupe, no en rojo:
 * apartar una zona es una decisión válida del evaluador, no un error.
 */
export const ACCION: Record<string, { label: string; hex: string }> = {
  confirmada: { label: 'Confirmada', hex: MARCA.bosque },
  modificada: { label: 'Modificada', hex: MARCA.pizarra },
  nueva:      { label: 'Nueva',      hex: MARCA.musgo },
  descartada: { label: 'Descartada', hex: MARCA.taupe },
}
