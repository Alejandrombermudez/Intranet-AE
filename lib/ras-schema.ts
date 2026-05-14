import { z } from 'zod'

// ─── Sub-schemas compartidos ──────────────────────────────────────────────────

export const monitoreoSchema = z.object({
  fecha: z.string().optional(),
  supervivencia_pct: z.coerce.number().min(0).max(100).optional(),
})

export const camaraSchema = z.object({
  nombre: z.string().min(1, 'El nombre/ID es requerido'),
  latitud: z.coerce.number(),
  longitud: z.coerce.number(),
})

// ─── Módulo Siembra / Restauración ───────────────────────────────────────────
// Nota: ningún campo es obligatorio (todos son opcionales).
// Los campos TEXT[], JSONB (miembros_familia, cultivos, etc.) se gestionan
// con useState en el formulario y se inyectan al submit.

export const familiaSchema = z.object({

  // ── §1 Datos Generales ────────────────────────────────────────────────────
  encuesta_no:                  z.string().optional(),
  fecha_encuesta:               z.string().optional(),
  encuestador:                  z.string().optional(),
  tipo_encuestado:              z.string().optional(),

  // ── §1 Identificación del propietario ────────────────────────────────────
  nombre_propietario:           z.string().optional(),
  tipo_documento:               z.string().optional(),
  numero_documento:             z.string().optional(),
  telefono:                     z.string().optional(),

  // ── §2 Ubicación ─────────────────────────────────────────────────────────
  nucleo:                       z.string().optional(),
  departamento:                 z.string().optional(),
  municipio:                    z.string().optional(),
  vereda:                       z.string().optional(),
  nombre_finca:                 z.string().optional(),
  estrato_paisaje:              z.string().optional(),
  latitud:                      z.string().optional(),
  longitud:                     z.string().optional(),
  altitud_msnm:                 z.coerce.number().optional(),
  anio_adquisicion:             z.coerce.number().int().optional(),
  distancia_cabecera_km:        z.coerce.number().optional(),
  senal_telefonica:             z.boolean().optional(),

  // ── §3 Vivienda ───────────────────────────────────────────────────────────
  material_techo:               z.string().optional(),
  material_paredes:             z.string().optional(),
  material_piso:                z.string().optional(),
  num_habitaciones:             z.coerce.number().int().optional(),
  personas_vivienda:            z.coerce.number().int().optional(),
  disposicion_excretas:         z.string().optional(),
  disposicion_aguas_servidas:   z.string().optional(),

  // ── §4 Núcleo Familiar ────────────────────────────────────────────────────
  adultos:                      z.coerce.number().int().min(0).optional(),
  ninos:                        z.coerce.number().int().min(0).optional(),
  cant_mujeres:                 z.coerce.number().int().min(0).optional(),
  cant_hombres:                 z.coerce.number().int().min(0).optional(),
  poblacion_tendencia:          z.string().optional(),
  acceso_salud:                 z.boolean().optional(),
  regimen_salud:                z.string().optional(),
  puesto_salud:                 z.string().optional(),
  acceso_educacion:             z.boolean().optional(),
  distancia_educacion_km:       z.coerce.number().optional(),
  tiempo_llegada_region:        z.string().optional(),
  razon_llegada:                z.string().optional(),

  // ── §5 Economía & Valorización ────────────────────────────────────────────
  actividad_economica:          z.string().optional(),
  tiene_espacio_vegetal:        z.boolean().optional(),
  empleos_locales:              z.coerce.number().int().min(0).optional(),
  ha_total:                     z.coerce.number().min(0).optional(),
  valor_comercial_ha:           z.coerce.number().min(0).optional(),
  tendencia_area:               z.string().optional(),
  cambio_area_ha:               z.coerce.number().optional(),
  intencion_vender:             z.boolean().optional(),
  medio_transporte_produccion:  z.string().optional(),
  transporte_propio:            z.boolean().optional(),
  valor_transporte:             z.coerce.number().optional(),
  problemas_mercado:            z.string().optional(),
  nivel_ingresos:               z.string().optional(),

  // ── §5 Uso del suelo (existente) ──────────────────────────────────────────
  ha_potreros:                  z.coerce.number().min(0).optional(),
  ha_bosque:                    z.coerce.number().min(0).optional(),
  ha_otras:                     z.coerce.number().min(0).optional(),
  bajo_conservacion:            z.boolean().optional(),
  num_individuos:               z.coerce.number().int().min(0).optional(),
  num_especies_inventario:      z.coerce.number().int().min(0).optional(),
  area_bosque_recorrida:        z.coerce.number().min(0).optional(),
  distancia_florencia_km:       z.coerce.number().min(0).optional(),
  tiempo_florencia_min:         z.coerce.number().int().min(0).optional(),

  // ── §6 Ganadería ─────────────────────────────────────────────────────────
  tiene_ganaderia:              z.boolean().optional(),
  tipo_tenencia_ganado:         z.string().optional(),
  num_cabezas_ganado:           z.coerce.number().int().min(0).optional(),
  ha_ganaderia:                 z.coerce.number().min(0).optional(),
  litros_leche_dia:             z.coerce.number().min(0).optional(),
  tanque_enfriamiento:          z.string().optional(),
  precio_leche_litro:           z.coerce.number().min(0).optional(),
  sistema_alimentacion_ganado:  z.string().optional(),
  especies_forrajeras:          z.string().optional(),
  material_postes:              z.string().optional(),
  ha_pasto_ultimo_anio:         z.coerce.number().min(0).optional(),
  // Ganadería regenerativa
  pastoreo_rotacional:          z.boolean().optional(),
  diversificacion_forrajera:    z.boolean().optional(),
  cercas_vivas:                 z.boolean().optional(),
  sistemas_silvopastoriles:     z.boolean().optional(),
  captacion_agua_lluvia:        z.boolean().optional(),
  manejo_residuos_organicos:    z.boolean().optional(),
  reduccion_antibioticos:       z.boolean().optional(),
  espacios_sombra_agua:         z.boolean().optional(),
  reduccion_estres:             z.boolean().optional(),
  interes_ganaderia_regenerativa: z.boolean().optional(),

  // ── §7 Nivel Tecnológico ──────────────────────────────────────────────────
  instalaciones_maquinaria:     z.string().optional(),
  tiene_tractor:                z.boolean().optional(),
  tiene_camion:                 z.boolean().optional(),
  manejo_suelo_fertilizacion:   z.string().optional(),
  cobertura_arborea:            z.boolean().optional(),
  practica_podas:               z.boolean().optional(),
  practica_raleo:               z.boolean().optional(),
  manejo_agua_cultivo:          z.string().optional(),
  especies_variedades:          z.string().optional(),
  lleva_registros_productividad: z.boolean().optional(),
  interes_capacitacion:         z.boolean().optional(),
  temas_capacitacion:           z.string().optional(),

  // ── §8 Bosque & Clima ─────────────────────────────────────────────────────
  aprovecha_bosque:             z.boolean().optional(),
  productos_forestales:         z.string().optional(),
  capacitacion_ambiente:        z.boolean().optional(),
  entidad_capacitacion:         z.string().optional(),
  especies_bosque_predio:       z.string().optional(),
  especies_fauna_predio:        z.string().optional(),
  estudio_academico:            z.boolean().optional(),
  disminucion_especies:         z.boolean().optional(),
  especies_afectadas:           z.string().optional(),
  cambios_caudal:               z.boolean().optional(),
  cambio_cobertura_ha:          z.coerce.number().optional(),

  // ── §9 Relaciones ────────────────────────────────────────────────────────
  programas_gubernamentales:    z.string().optional(),
  beneficios_programas:         z.string().optional(),
  impacto_programa:             z.string().optional(),
  opinion_productores:          z.boolean().optional(),
  aliado_cooperativa:           z.boolean().optional(),
  nombre_cooperativa:           z.string().optional(),
  beneficio_cooperativa:        z.string().optional(),
  calificacion_gremios:         z.string().optional(),
  observaciones_generales:      z.string().optional(),

  // ── §11 Restauración ──────────────────────────────────────────────────────
  plan_restauracion:            z.string().optional(),
  ha_restauracion:              z.coerce.number().min(0).optional(),
  parcelas_monitoreo:           z.coerce.number().int().min(0).optional(),
  plantulas_sembradas:          z.coerce.number().int().min(0).optional(),
  especies_sembradas:           z.coerce.number().int().min(0).optional(),

  // ── Dinámicos (arrays RHF) ────────────────────────────────────────────────
  monitoreos: z.array(monitoreoSchema).optional(),
  camaras:    z.array(camaraSchema).optional(),
})

// ─── Módulo Conservación ──────────────────────────────────────────────────────

export const familiaConservacionSchema = z.object({
  nombre_propietario:      z.string().optional(),
  tipo_documento:          z.string().optional(),
  numero_documento:        z.string().optional(),
  telefono:                z.string().optional(),
  nucleo:                  z.string().optional(),
  departamento:            z.string().optional(),
  municipio:               z.string().optional(),
  vereda:                  z.string().optional(),
  nombre_finca:            z.string().optional(),
  adultos:                 z.coerce.number().int().min(0).optional(),
  ninos:                   z.coerce.number().int().min(0).optional(),
  cant_mujeres:            z.coerce.number().int().min(0).optional(),
  cant_hombres:            z.coerce.number().int().min(0).optional(),
  actividad_economica:     z.string().optional(),
  empleos_locales:         z.coerce.number().int().min(0).optional(),
  tiene_espacio_vegetal:   z.boolean().optional(),
  ha_potreros:             z.coerce.number().min(0).optional(),
  ha_bosque:               z.coerce.number().min(0).optional(),
  ha_otras:                z.coerce.number().min(0).optional(),
  bajo_conservacion:       z.boolean().optional(),
  acuerdo_conservacion:    z.boolean().optional(),
  num_individuos:          z.coerce.number().int().min(0).optional(),
  num_especies_inventario: z.coerce.number().int().min(0).optional(),
  area_bosque_recorrida:   z.coerce.number().min(0).optional(),
  distancia_florencia_km:  z.coerce.number().min(0).optional(),
  tiempo_florencia_min:    z.coerce.number().int().min(0).optional(),
  arboles_semilleros:      z.coerce.number().int().min(0).optional(),
  especies_forestales:     z.coerce.number().int().min(0).optional(),
  otros_indices:           z.string().optional(),
  camaras:                 z.array(camaraSchema).optional(),
})

// Los archivos (shapefiles), fotos y campos TEXT[]/JSONB se manejan con
// useState en el formulario; Zod no serializa objetos File ni arrays complejos.

export type FamiliaForm             = z.infer<typeof familiaSchema>
export type FamiliaConservacionForm = z.infer<typeof familiaConservacionSchema>
export type MonitoreoForm           = z.infer<typeof monitoreoSchema>
export type CamaraForm              = z.infer<typeof camaraSchema>
