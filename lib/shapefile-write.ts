/**
 * Escritura de shapefile (.zip con .shp/.shx/.dbf/.prj/.cpg) en el navegador.
 *
 * El sistema LEE shapefiles con shpjs, pero no había forma de sacarlos de
 * vuelta: cuando campo corrige un sitio de siembra, el SIG necesita ese
 * polígono corregido en su GIS de escritorio.
 *
 * Se escribe a mano en vez de usar una librería porque las que hay tratan mal
 * los MultiPolygon (que es justo como PostGIS guarda todas las zonas) y no
 * dejan controlar los atributos del .dbf, que es la metadata que hace útil el
 * archivo. El formato es el de la especificación ESRI de 1998.
 *
 * Coordenadas: EPSG:4326 (WGS84), que es como el sistema las almacena tras
 * reproyectar en la ingesta. El .prj sale con esa definición.
 */
import JSZip from 'jszip'
import type { Feature, Geometry, Position } from 'geojson'

const TIPO_POLIGONO = 5

/** WKT de EPSG:4326 en el dialecto ESRI (el que esperan ArcGIS y QGIS). */
export const PRJ_WGS84 =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],' +
  'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'

// ─── Campos del .dbf ─────────────────────────────────────────────────────────
export interface CampoDbf {
  /** Máx. 10 caracteres ASCII: es un límite del formato, no una decisión nuestra. */
  nombre: string
  tipo: 'C' | 'N'
  largo: number
  decimales?: number
}

export interface OpcionesShapefile {
  campos: CampoDbf[]
  /** Valores por feature, en el mismo orden que `features`. */
  atributos: Record<string, string | number | null | undefined>[]
  /** Nombre base de los archivos dentro del .zip (sin extensión). */
  nombreBase: string
}

// ─── Geometría → partes del shapefile ────────────────────────────────────────

/** Área con signo (fórmula del cordón). >0 = antihorario. */
function areaFirmada(ring: Position[]): number {
  let s = 0
  for (let i = 0; i < ring.length - 1; i++) {
    s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return s / 2
}

/**
 * El shapefile exige anillos exteriores en sentido HORARIO y agujeros en
 * antihorario — exactamente al revés que GeoJSON (RFC 7946). Sin esta
 * corrección los agujeros se rellenan y las áreas salen mal en el GIS.
 */
function orientar(ring: Position[], exterior: boolean): Position[] {
  const a = areaFirmada(ring)
  const horario = a < 0
  return (exterior ? horario : !horario) ? ring : [...ring].reverse()
}

function cerrar(ring: Position[]): Position[] {
  if (ring.length === 0) return ring
  const [x0, y0] = ring[0]
  const [xn, yn] = ring[ring.length - 1]
  return x0 === xn && y0 === yn ? ring : [...ring, ring[0]]
}

/** Anillos de una geometría, ya orientados como los quiere el shapefile. */
function anillosDe(geom: Geometry): Position[][] {
  const poligonos: Position[][][] =
    geom.type === 'Polygon'      ? [geom.coordinates as Position[][]]
    : geom.type === 'MultiPolygon' ? (geom.coordinates as Position[][][])
    : []
  const partes: Position[][] = []
  for (const poly of poligonos) {
    poly.forEach((ring, i) => {
      const r = cerrar(ring as Position[])
      if (r.length >= 4) partes.push(orientar(r, i === 0))
    })
  }
  return partes
}

interface Caja { xmin: number; ymin: number; xmax: number; ymax: number }
const cajaVacia = (): Caja => ({ xmin: Infinity, ymin: Infinity, xmax: -Infinity, ymax: -Infinity })
function extender(c: Caja, p: Position) {
  if (p[0] < c.xmin) c.xmin = p[0]
  if (p[1] < c.ymin) c.ymin = p[1]
  if (p[0] > c.xmax) c.xmax = p[0]
  if (p[1] > c.ymax) c.ymax = p[1]
}
const cajaFinal = (c: Caja): Caja =>
  Number.isFinite(c.xmin) ? c : { xmin: 0, ymin: 0, xmax: 0, ymax: 0 }

// ─── .shp y .shx ─────────────────────────────────────────────────────────────

function cabecera(buf: DataView, largoPalabras: number, caja: Caja) {
  buf.setInt32(0, 9994, false)          // file code
  for (let i = 4; i < 24; i += 4) buf.setInt32(i, 0, false)
  buf.setInt32(24, largoPalabras, false) // largo total en palabras de 16 bits
  buf.setInt32(28, 1000, true)           // versión
  buf.setInt32(32, TIPO_POLIGONO, true)
  buf.setFloat64(36, caja.xmin, true)
  buf.setFloat64(44, caja.ymin, true)
  buf.setFloat64(52, caja.xmax, true)
  buf.setFloat64(60, caja.ymax, true)
  for (let i = 68; i < 100; i += 8) buf.setFloat64(i, 0, true)  // Z y M sin usar
}

function construirShpShx(geometrias: Geometry[]): { shp: Uint8Array; shx: Uint8Array } {
  const registros = geometrias.map(g => {
    const partes = anillosDe(g)
    const puntos = partes.flat()
    const caja = cajaVacia()
    puntos.forEach(p => extender(caja, p))
    // contenido = tipo(4) + caja(32) + numPartes(4) + numPuntos(4) + partes + puntos
    const bytes = 44 + partes.length * 4 + puntos.length * 16
    return { partes, puntos, caja: cajaFinal(caja), bytes }
  })

  const cajaTotal = cajaVacia()
  registros.forEach(r => {
    extender(cajaTotal, [r.caja.xmin, r.caja.ymin])
    extender(cajaTotal, [r.caja.xmax, r.caja.ymax])
  })
  const caja = cajaFinal(cajaTotal)

  const totalShp = 100 + registros.reduce((s, r) => s + 8 + r.bytes, 0)
  const shp = new ArrayBuffer(totalShp)
  const vShp = new DataView(shp)
  cabecera(vShp, totalShp / 2, caja)

  const totalShx = 100 + registros.length * 8
  const shx = new ArrayBuffer(totalShx)
  const vShx = new DataView(shx)
  cabecera(vShx, totalShx / 2, caja)

  let off = 100
  registros.forEach((r, i) => {
    // índice (.shx): desplazamiento y largo, ambos en palabras de 16 bits
    vShx.setInt32(100 + i * 8, off / 2, false)
    vShx.setInt32(104 + i * 8, r.bytes / 2, false)

    vShp.setInt32(off, i + 1, false)          // número de registro (base 1)
    vShp.setInt32(off + 4, r.bytes / 2, false)
    let p = off + 8
    vShp.setInt32(p, TIPO_POLIGONO, true); p += 4
    vShp.setFloat64(p, r.caja.xmin, true); p += 8
    vShp.setFloat64(p, r.caja.ymin, true); p += 8
    vShp.setFloat64(p, r.caja.xmax, true); p += 8
    vShp.setFloat64(p, r.caja.ymax, true); p += 8
    vShp.setInt32(p, r.partes.length, true); p += 4
    vShp.setInt32(p, r.puntos.length, true); p += 4
    let acumulado = 0
    for (const parte of r.partes) { vShp.setInt32(p, acumulado, true); p += 4; acumulado += parte.length }
    for (const [x, y] of r.puntos) { vShp.setFloat64(p, x, true); p += 8; vShp.setFloat64(p, y, true); p += 8 }

    off += 8 + r.bytes
  })

  return { shp: new Uint8Array(shp), shx: new Uint8Array(shx) }
}

// ─── .dbf ────────────────────────────────────────────────────────────────────

function textoDbf(v: unknown, largo: number): Uint8Array {
  const bytes = new TextEncoder().encode(String(v ?? ''))
  const out = new Uint8Array(largo).fill(0x20)   // relleno con espacios
  out.set(bytes.slice(0, largo))
  return out
}

function numeroDbf(v: unknown, largo: number, dec: number): Uint8Array {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : null
  const txt = n === null ? '' : n.toFixed(dec)
  const out = new Uint8Array(largo).fill(0x20)
  const bytes = new TextEncoder().encode(txt.slice(0, largo))
  out.set(bytes, largo - bytes.length)          // los números van alineados a la derecha
  return out
}

function construirDbf(campos: CampoDbf[], filas: OpcionesShapefile['atributos']): Uint8Array {
  const largoCabecera = 32 + campos.length * 32 + 1
  const largoRegistro = 1 + campos.reduce((s, c) => s + c.largo, 0)
  const total = largoCabecera + filas.length * largoRegistro + 1

  const buf = new Uint8Array(total)
  const v = new DataView(buf.buffer)
  const hoy = new Date()

  buf[0] = 0x03
  buf[1] = hoy.getFullYear() - 1900
  buf[2] = hoy.getMonth() + 1
  buf[3] = hoy.getDate()
  v.setInt32(4, filas.length, true)
  v.setInt16(8, largoCabecera, true)
  v.setInt16(10, largoRegistro, true)

  campos.forEach((c, i) => {
    const base = 32 + i * 32
    const nombre = new TextEncoder().encode(c.nombre.slice(0, 10))
    buf.set(nombre, base)                        // resto queda en 0 (null-padded)
    buf[base + 11] = c.tipo.charCodeAt(0)
    buf[base + 16] = c.largo
    buf[base + 17] = c.decimales ?? 0
  })
  buf[largoCabecera - 1] = 0x0d                  // fin de descriptores

  let off = largoCabecera
  for (const fila of filas) {
    buf[off++] = 0x20                            // registro vivo (0x2A = borrado)
    for (const c of campos) {
      const val = fila[c.nombre]
      buf.set(c.tipo === 'N' ? numeroDbf(val, c.largo, c.decimales ?? 0) : textoDbf(val, c.largo), off)
      off += c.largo
    }
  }
  buf[total - 1] = 0x1a                          // fin de archivo

  return buf
}

// ─── Ensamblado ──────────────────────────────────────────────────────────────

/**
 * Genera los archivos crudos del shapefile. Separado del empaquetado para
 * poder verificarlo releyéndolo con shpjs (ver scripts/verificar-shapefile.mjs).
 * Ignora las features cuya geometría no sea de polígonos.
 */
export function construirShapefilePartes(
  features: Feature[],
  opciones: OpcionesShapefile,
): { shp: Uint8Array; shx: Uint8Array; dbf: Uint8Array; prj: string; cpg: string } {
  const validas = features
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))

  if (validas.length === 0) throw new Error('No hay polígonos para exportar.')

  const geoms = validas.map(({ f }) => f.geometry as Geometry)
  const filas = validas.map(({ i }) => opciones.atributos[i] ?? {})

  const { shp, shx } = construirShpShx(geoms)
  return { shp, shx, dbf: construirDbf(opciones.campos, filas), prj: PRJ_WGS84, cpg: 'UTF-8' }
}

/** Arma el .zip del shapefile. Devuelve un Blob listo para descargar. */
export async function construirShapefileZip(
  features: Feature[],
  opciones: OpcionesShapefile,
): Promise<Blob> {
  const { shp, shx, dbf, prj, cpg } = construirShapefilePartes(features, opciones)
  const zip = new JSZip()
  const base = opciones.nombreBase
  zip.file(`${base}.shp`, shp)
  zip.file(`${base}.shx`, shx)
  zip.file(`${base}.dbf`, dbf)
  zip.file(`${base}.prj`, prj)
  zip.file(`${base}.cpg`, cpg)                   // para que el GIS lea bien las tildes
  return zip.generateAsync({ type: 'blob' })
}

/** Dispara la descarga de un blob con el nombre dado. */
export function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Nombre de archivo sin acentos ni espacios, seguro para cualquier sistema. */
export function nombreSeguro(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'zonas'
}
