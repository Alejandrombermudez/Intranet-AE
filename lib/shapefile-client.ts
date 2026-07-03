/**
 * Parseo de shapefile (.zip) en el navegador para el módulo SIG.
 * Parsea geometría + atributos (shpjs), lee el .prj (jszip) y reproyecta a
 * EPSG:4326 si las coordenadas vienen proyectadas (proj4), y calcula métricas.
 */
import shp from 'shpjs'
import proj4 from 'proj4'
import JSZip from 'jszip'
import { area as turfArea } from '@turf/area'
import type { Feature, Geometry, Position } from 'geojson'

export interface ShapefileParseado {
  features: Feature[]
  columnas: string[]
  reproyectado: boolean
  srcPrj: string | null
  metrics: {
    numZonas: number
    areaM2: number
    areaHa: number
    areaKm2: number
    perimetroM: number
    perimetroKm: number
    bbox: [number, number, number, number] | null   // [minLon, minLat, maxLon, maxLat]
  }
}

// ─── helpers de geometría ──────────────────────────────────────────────────────

// transforma en profundidad cada coordenada [x,y] de cualquier geometría
function transformDeep(coords: unknown, fn: (p: Position) => Position): unknown {
  const arr = coords as unknown[]
  if (typeof arr[0] === 'number') return fn(coords as Position)
  return arr.map((c) => transformDeep(c, fn))
}
function mapCoords(geom: Geometry, fn: (p: Position) => Position): Geometry {
  if (geom.type === 'GeometryCollection') {
    return { ...geom, geometries: geom.geometries.map((g) => mapCoords(g, fn)) }
  }
  return { ...geom, coordinates: transformDeep((geom as { coordinates: unknown }).coordinates, fn) } as Geometry
}

function primeraCoord(geom: Geometry): Position | null {
  if (geom.type === 'GeometryCollection') return geom.geometries[0] ? primeraCoord(geom.geometries[0]) : null
  let c: unknown = (geom as { coordinates: unknown }).coordinates
  while (Array.isArray(c) && !(typeof (c as unknown[])[0] === 'number')) c = (c as unknown[])[0]
  return Array.isArray(c) ? (c as Position) : null
}

function haversineM(a: Position, b: Position): number {
  const R = 6371008.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1]); const dLon = toRad(b[0] - a[0])
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
function perimetroAnillo(ring: Position[]): number {
  let p = 0
  for (let i = 1; i < ring.length; i++) p += haversineM(ring[i - 1], ring[i])
  return p
}
export function perimetroGeom(geom: Geometry): number {
  if (geom.type === 'Polygon') return geom.coordinates.reduce((s, r) => s + perimetroAnillo(r as Position[]), 0)
  if (geom.type === 'MultiPolygon') return geom.coordinates.reduce((s, poly) => s + poly.reduce((ss, r) => ss + perimetroAnillo(r as Position[]), 0), 0)
  return 0
}

export function ampliarBbox(geom: Geometry, bbox: [number, number, number, number]): void {
  const visit = (c: unknown) => {
    const arr = c as unknown[]
    if (typeof arr[0] === 'number') {
      const [x, y] = c as Position
      if (x < bbox[0]) bbox[0] = x; if (y < bbox[1]) bbox[1] = y
      if (x > bbox[2]) bbox[2] = x; if (y > bbox[3]) bbox[3] = y
    } else arr.forEach(visit)
  }
  if (geom.type === 'GeometryCollection') geom.geometries.forEach((g) => ampliarBbox(g, bbox))
  else visit((geom as { coordinates: unknown }).coordinates)
}

// ─── parseo principal ──────────────────────────────────────────────────────────

/** Parsea un shapefile (.zip) ya en memoria — usado por parsearShapefile (File) y parsearShapefileDesdeUrl (URL). */
async function parsearBuffer(buf: ArrayBuffer): Promise<ShapefileParseado> {
  const parsed = await shp(buf)
  const fcs = Array.isArray(parsed) ? parsed : [parsed]
  let features: Feature[] = []
  for (const fc of fcs) features = features.concat((fc.features ?? []) as Feature[])
  features = features.filter((f) => f && f.geometry)
  if (features.length === 0) throw new Error('El shapefile no contiene geometrías válidas.')

  // .prj (para reproyectar si hace falta)
  let srcPrj: string | null = null
  try {
    const zip = await JSZip.loadAsync(buf)
    const prjName = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith('.prj'))
    if (prjName) srcPrj = (await zip.files[prjName].async('string')).trim()
  } catch { /* sin .prj */ }

  // ¿coordenadas proyectadas? (fuera del rango lon/lat) → reproyectar
  const first = primeraCoord(features[0].geometry)
  let reproyectado = false
  if (first && (Math.abs(first[0]) > 180 || Math.abs(first[1]) > 90)) {
    if (!srcPrj) throw new Error('Las coordenadas vienen proyectadas pero el .zip no incluye el .prj para reproyectar.')
    const conv = proj4(srcPrj, 'WGS84')
    features = features.map((f) => ({
      ...f,
      geometry: mapCoords(f.geometry, (p) => {
        const [lon, lat] = conv.forward([p[0], p[1]])
        return p.length > 2 ? [lon, lat, p[2]] : [lon, lat]
      }),
    }))
    reproyectado = true
  }

  // métricas
  let areaM2 = 0, perimetroM = 0
  const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const f of features) {
    try { areaM2 += turfArea(f) } catch { /* geometría no poligonal */ }
    perimetroM += perimetroGeom(f.geometry)
    ampliarBbox(f.geometry, bbox)
  }
  const columnas = [...new Set(features.flatMap((f) => Object.keys(f.properties ?? {})))]

  return {
    features,
    columnas,
    reproyectado,
    srcPrj,
    metrics: {
      numZonas: features.length,
      areaM2,
      areaHa: areaM2 / 1e4,
      areaKm2: areaM2 / 1e6,
      perimetroM,
      perimetroKm: perimetroM / 1000,
      bbox: Number.isFinite(bbox[0]) ? bbox : null,
    },
  }
}

/** Parsea un shapefile (.zip) desde un archivo elegido por el usuario (input file). */
export async function parsearShapefile(file: File): Promise<ShapefileParseado> {
  return parsearBuffer(await file.arrayBuffer())
}

/** Parsea un shapefile (.zip) descargándolo de una URL pública (ej. Supabase Storage). */
export async function parsearShapefileDesdeUrl(url: string): Promise<ShapefileParseado> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo descargar el shapefile (HTTP ${res.status}).`)
  return parsearBuffer(await res.arrayBuffer())
}
