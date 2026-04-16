import { z } from 'zod'

// ─── Sub-schemas compartidos ──────────────────────────────────────────────────

export const monitoreoSchema = z.object({
  fecha: z.string().min(1, 'La fecha es requerida'),
  supervivencia_pct: z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%'),
})

export const camaraSchema = z.object({
  nombre: z.string().min(1, 'El nombre/ID es requerido'),
  latitud: z.coerce.number(),
  longitud: z.coerce.number(),
})

// ─── Módulo Siembra / Restauración ───────────────────────────────────────────

export const familiaSchema = z.object({
  // ── Paso 0: Identificación ────────────────────────────────────────────────
  nombre_propietario: z.string().min(1, 'El nombre del propietario es requerido'),
  tipo_documento: z.string().optional(),
  numero_documento: z.string().optional(),
  telefono: z.string().optional(),
  nucleo: z.string().optional(),
  departamento: z.string().optional(),
  municipio: z.string().min(1, 'El municipio es requerido'),
  vereda: z.string().optional(),
  nombre_finca: z.string().optional(),

  // ── Paso 1: Hogar & Economía ──────────────────────────────────────────────
  adultos: z.coerce.number().int().min(0, 'Mínimo 0'),
  ninos: z.coerce.number().int().min(0, 'Mínimo 0'),
  cant_mujeres: z.coerce.number().int().min(0, 'Mínimo 0'),
  cant_hombres: z.coerce.number().int().min(0, 'Mínimo 0'),
  actividad_economica: z.string().optional(),
  empleos_locales: z.coerce.number().int().min(0),
  tiene_espacio_vegetal: z.boolean(),

  // ── Paso 2: Predio & Inventario ───────────────────────────────────────────
  ha_potreros: z.coerce.number().min(0),
  ha_bosque: z.coerce.number().min(0),
  ha_otras: z.coerce.number().min(0),
  bajo_conservacion: z.boolean(),
  num_individuos: z.coerce.number().int().min(0),
  num_especies_inventario: z.coerce.number().int().min(0),
  area_bosque_recorrida: z.coerce.number().min(0),
  distancia_florencia_km: z.coerce.number().min(0),
  tiempo_florencia_min: z.coerce.number().int().min(0),

  // ── Paso 3: Restauración ──────────────────────────────────────────────────
  plan_restauracion: z.string().optional(),
  ha_restauracion: z.coerce.number().min(0, 'Mínimo 0'),
  parcelas_monitoreo: z.coerce.number().int().min(0),
  plantulas_sembradas: z.coerce.number().int().min(0),
  especies_sembradas: z.coerce.number().int().min(0),

  // ── Paso 6: Monitoreos (array dinámico) ───────────────────────────────────
  monitoreos: z.array(monitoreoSchema),

  // ── Paso 7: Cámaras trampa ────────────────────────────────────────────────
  camaras: z.array(camaraSchema),
})

// ─── Módulo Conservación ──────────────────────────────────────────────────────

export const familiaConservacionSchema = z.object({
  // ── Paso 0: Identificación ────────────────────────────────────────────────
  nombre_propietario: z.string().min(1, 'El nombre del propietario es requerido'),
  tipo_documento: z.string().optional(),
  numero_documento: z.string().optional(),
  telefono: z.string().optional(),
  nucleo: z.string().optional(),
  departamento: z.string().optional(),
  municipio: z.string().min(1, 'El municipio es requerido'),
  vereda: z.string().optional(),
  nombre_finca: z.string().optional(),

  // ── Paso 1: Hogar & Economía ──────────────────────────────────────────────
  adultos: z.coerce.number().int().min(0, 'Mínimo 0'),
  ninos: z.coerce.number().int().min(0, 'Mínimo 0'),
  cant_mujeres: z.coerce.number().int().min(0, 'Mínimo 0'),
  cant_hombres: z.coerce.number().int().min(0, 'Mínimo 0'),
  actividad_economica: z.string().optional(),
  empleos_locales: z.coerce.number().int().min(0),
  tiene_espacio_vegetal: z.boolean(),

  // ── Paso 2: Predio & Inventario ───────────────────────────────────────────
  ha_potreros: z.coerce.number().min(0),
  ha_bosque: z.coerce.number().min(0),
  ha_otras: z.coerce.number().min(0),
  bajo_conservacion: z.boolean(),
  acuerdo_conservacion: z.boolean(),
  num_individuos: z.coerce.number().int().min(0),
  num_especies_inventario: z.coerce.number().int().min(0),
  area_bosque_recorrida: z.coerce.number().min(0),
  distancia_florencia_km: z.coerce.number().min(0),
  tiempo_florencia_min: z.coerce.number().int().min(0),

  // ── Paso 3: Conservación ──────────────────────────────────────────────────
  arboles_semilleros: z.coerce.number().int().min(0),
  especies_forestales: z.coerce.number().int().min(0),

  // ── Paso 5: Biodiversidad ─────────────────────────────────────────────────
  otros_indices: z.string().optional(),
  camaras: z.array(camaraSchema),
})

// Los archivos (shapefiles) y fotos por cámara se manejan con useState
// porque Zod no puede serializar objetos File.

export type FamiliaForm = z.infer<typeof familiaSchema>
export type FamiliaConservacionForm = z.infer<typeof familiaConservacionSchema>
export type MonitoreoForm = z.infer<typeof monitoreoSchema>
export type CamaraForm = z.infer<typeof camaraSchema>
