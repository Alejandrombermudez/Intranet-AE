import { z } from 'zod'

export const monitoreoSchema = z.object({
  fecha: z.string().min(1, 'La fecha es requerida'),
  supervivencia_pct: z.coerce.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%'),
})

export const camaraSchema = z.object({
  nombre: z.string().min(1, 'El nombre/ID es requerido'),
  latitud: z.coerce.number(),
  longitud: z.coerce.number(),
})

export const familiaSchema = z.object({
  // ── Sección 1: Información Base y Socioeconomía ──
  municipio: z.string().min(1, 'El municipio es requerido'),
  vereda: z.string().optional(),
  nombre_finca: z.string().optional(),
  nombre_propietario: z.string().min(1, 'El nombre del propietario es requerido'),
  adultos: z.coerce.number().int().min(0, 'Mínimo 0'),
  ninos: z.coerce.number().int().min(0, 'Mínimo 0'),
  ha_potreros: z.coerce.number().min(0),
  ha_bosque: z.coerce.number().min(0),
  ha_otras: z.coerce.number().min(0),
  bajo_conservacion: z.boolean(),
  empleos_locales: z.coerce.number().int().min(0),

  // ── Sección 2: Datos de Restauración ──
  plan_restauracion: z.string().optional(),
  ha_restauracion: z.coerce.number().min(0, 'Mínimo 0'),
  parcelas_monitoreo: z.coerce.number().int().min(0),
  plantulas_sembradas: z.coerce.number().int().min(0),
  especies_sembradas: z.coerce.number().int().min(0),

  // ── Sección 4: Monitoreos (array dinámico) ──
  monitoreos: z.array(monitoreoSchema),

  // ── Sección 5: Cámaras trampa ──
  camaras: z.array(camaraSchema),
})

// Los archivos (sección 3) y fotos por cámara se manejan con useState
// porque Zod no puede serializar objetos File.

export type FamiliaForm = z.infer<typeof familiaSchema>
export type MonitoreoForm = z.infer<typeof monitoreoSchema>
export type CamaraForm = z.infer<typeof camaraSchema>
