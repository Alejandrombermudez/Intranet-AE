/**
 * Exportación de zonas y de las correcciones de campo a shapefile (.zip).
 *
 * Cierra el círculo de la ingesta: el SIG sube un .zip, campo lo corrige en
 * terreno, y desde aquí el SIG se lleva el resultado de vuelta a su GIS con
 * los mismos atributos y el mismo sistema de referencia (EPSG:4326, que es
 * como quedan las geometrías tras la reproyección de la ingesta).
 */
import type { Feature, Geometry } from 'geojson'
import { construirShapefileZip, descargarBlob, nombreSeguro, type CampoDbf } from './shapefile-write'

const hoy = () => new Date().toISOString().slice(0, 10)

// ─── Zonas del SIG (lo que hay vigente en geo.zonas) ─────────────────────────
export interface ZonaExportable {
  id: string
  nombre: string | null
  tipo: string
  estado: string
  area_ha: number | null
  perimetro_m: number | null
  geojson: string
}

const CAMPOS_ZONA: CampoDbf[] = [
  { nombre: 'zona_id',   tipo: 'C', largo: 36 },
  { nombre: 'nombre',    tipo: 'C', largo: 60 },
  { nombre: 'tipo',      tipo: 'C', largo: 14 },
  { nombre: 'estado',    tipo: 'C', largo: 14 },
  { nombre: 'area_ha',   tipo: 'N', largo: 14, decimales: 4 },
  { nombre: 'perim_m',   tipo: 'N', largo: 14, decimales: 2 },
  { nombre: 'predio',    tipo: 'C', largo: 60 },
  { nombre: 'municipio', tipo: 'C', largo: 40 },
  { nombre: 'exportado', tipo: 'C', largo: 10 },
]

export async function exportarZonas(
  zonas: ZonaExportable[],
  ctx: { predio: string; municipio?: string; sufijo: string },
): Promise<void> {
  const features: Feature[] = zonas.map(z => ({
    type: 'Feature',
    geometry: JSON.parse(z.geojson) as Geometry,
    properties: {},
  }))
  const atributos = zonas.map(z => ({
    zona_id: z.id,
    nombre: z.nombre ?? '',
    tipo: z.tipo,
    estado: z.estado,
    area_ha: z.area_ha ?? null,
    perim_m: z.perimetro_m ?? null,
    predio: ctx.predio,
    municipio: ctx.municipio ?? '',
    exportado: hoy(),
  }))

  const base = `${nombreSeguro(ctx.predio)}_${ctx.sufijo}`
  const blob = await construirShapefileZip(features, { campos: CAMPOS_ZONA, atributos, nombreBase: base })
  descargarBlob(blob, `${base}.zip`)
}

// ─── Correcciones hechas en campo ────────────────────────────────────────────
export interface RevisionExportable {
  local_id: string | null
  zona_id: string | null
  accion: string
  metodo: string | null
  geom_original: Geometry | null
  geom_corregida: Geometry | null
  area_ha_campo: number | null
  observaciones: string | null
  evaluador: string | null
  fecha: string | null
}

const CAMPOS_REVISION: CampoDbf[] = [
  { nombre: 'zona_id',   tipo: 'C', largo: 36 },
  { nombre: 'momento',   tipo: 'C', largo: 8 },     // antes | despues
  { nombre: 'accion',    tipo: 'C', largo: 12 },
  { nombre: 'metodo',    tipo: 'C', largo: 10 },
  { nombre: 'evaluador', tipo: 'C', largo: 40 },
  { nombre: 'fecha',     tipo: 'C', largo: 10 },
  { nombre: 'area_ha',   tipo: 'N', largo: 14, decimales: 4 },
  { nombre: 'observ',    tipo: 'C', largo: 200 },
  { nombre: 'predio',    tipo: 'C', largo: 60 },
  { nombre: 'exportado', tipo: 'C', largo: 10 },
]

/**
 * Cada revisión puede aportar dos polígonos: cómo estaba (`antes`, la versión
 * del SIG) y cómo quedó (`despues`, lo que dibujó campo). Van en el mismo
 * archivo diferenciados por el campo `momento`, para poder superponerlos en el
 * GIS y ver el cambio.
 */
export async function exportarRevisiones(
  revisiones: RevisionExportable[],
  ctx: { predio: string; sufijo: string },
): Promise<void> {
  const features: Feature[] = []
  const atributos: Record<string, string | number | null>[] = []

  for (const r of revisiones) {
    const comun = {
      zona_id: r.zona_id ?? '',
      accion: r.accion,
      metodo: r.metodo ?? '',
      evaluador: r.evaluador ?? '',
      fecha: r.fecha ?? '',
      observ: r.observaciones ?? '',
      predio: ctx.predio,
      exportado: hoy(),
    }
    if (r.geom_original) {
      features.push({ type: 'Feature', geometry: r.geom_original, properties: {} })
      atributos.push({ ...comun, momento: 'antes', area_ha: null })
    }
    if (r.geom_corregida) {
      features.push({ type: 'Feature', geometry: r.geom_corregida, properties: {} })
      atributos.push({ ...comun, momento: 'despues', area_ha: r.area_ha_campo ?? null })
    }
  }

  if (features.length === 0) throw new Error('Estas revisiones no cambiaron ninguna geometría, no hay nada que exportar.')

  const base = `${nombreSeguro(ctx.predio)}_${ctx.sufijo}`
  const blob = await construirShapefileZip(features, { campos: CAMPOS_REVISION, atributos, nombreBase: base })
  descargarBlob(blob, `${base}.zip`)
}
