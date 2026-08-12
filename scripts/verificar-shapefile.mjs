/**
 * Verifica el escritor de shapefiles releyendo lo que produce.
 *
 * El formato es binario y escrito a mano, así que la única prueba que vale es
 * de ida y vuelta: se generan los archivos con lib/shapefile-write.ts y se
 * vuelven a parsear con shpjs (la misma librería con la que el sistema lee los
 * shapefiles que sube el SIG). Si las coordenadas y los atributos sobreviven
 * el viaje, el archivo es válido.
 *
 *   node scripts/verificar-shapefile.mjs
 */
globalThis.self = globalThis   // shpjs está compilado para navegador

const { parseShp, parseDbf } = await import('shpjs')
const { construirShapefilePartes } = await import('../lib/shapefile-write.ts')

let fallos = 0
const ok = (cond, msg) => { console.log(`${cond ? '  OK  ' : ' FALLA'} ${msg}`); if (!cond) fallos++ }
const casi = (a, b, tol = 1e-9) => Math.abs(a - b) < tol

// ─── Casos: un polígono simple, uno con agujero y un MultiPolygon ───────────
const cuadrado = (x, y, l) => [[[x, y], [x + l, y], [x + l, y + l], [x, y + l], [x, y]]]

const features = [
  { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: cuadrado(-75.6, 1.37, 0.01) } },
  {
    type: 'Feature', properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        cuadrado(-75.5, 1.40, 0.02)[0],                       // exterior
        [[-75.495, 1.405], [-75.485, 1.405], [-75.485, 1.415], [-75.495, 1.415], [-75.495, 1.405]], // agujero
      ],
    },
  },
  {
    type: 'Feature', properties: {},
    geometry: {
      type: 'MultiPolygon',
      coordinates: [cuadrado(-75.7, 1.30, 0.005), cuadrado(-75.68, 1.32, 0.008)],
    },
  },
]

const campos = [
  { nombre: 'zona_id',  tipo: 'C', largo: 36 },
  { nombre: 'nombre',   tipo: 'C', largo: 60 },
  { nombre: 'accion',   tipo: 'C', largo: 12 },
  { nombre: 'area_ha',  tipo: 'N', largo: 12, decimales: 4 },
  { nombre: 'observ',   tipo: 'C', largo: 80 },
]
const atributos = [
  { zona_id: 'a1', nombre: 'Lote Opcional 3', accion: 'confirmada', area_ha: 0.5739, observ: 'sin novedad' },
  { zona_id: 'b2', nombre: 'Zona con agujero', accion: 'modificada', area_ha: 12.3456, observ: 'corregido en terreno con tildes: árbol, cañada' },
  { zona_id: 'c3', nombre: 'Multi', accion: 'nueva', area_ha: 1.0, observ: '' },
]

const partes = construirShapefilePartes(features, { campos, atributos, nombreBase: 'prueba' })

console.log('Tamaños generados:')
console.log('  .shp', partes.shp.length, 'bytes ·  .shx', partes.shx.length, '·  .dbf', partes.dbf.length)

// ─── Estructura del encabezado ──────────────────────────────────────────────
const v = new DataView(partes.shp.buffer, partes.shp.byteOffset, partes.shp.byteLength)
ok(v.getInt32(0, false) === 9994, 'file code 9994')
ok(v.getInt32(24, false) * 2 === partes.shp.length, 'largo declarado en .shp coincide con el real')
ok(v.getInt32(32, true) === 5, 'shape type = 5 (Polygon)')
const vx = new DataView(partes.shx.buffer, partes.shx.byteOffset, partes.shx.byteLength)
ok(vx.getInt32(24, false) * 2 === partes.shx.length, 'largo declarado en .shx coincide con el real')
ok(partes.shx.length === 100 + features.length * 8, '.shx tiene una entrada por registro')

// ─── Ida y vuelta con shpjs ─────────────────────────────────────────────────
const geoms = parseShp(partes.shp.buffer.slice(partes.shp.byteOffset, partes.shp.byteOffset + partes.shp.byteLength))
const tabla = parseDbf(partes.dbf.buffer.slice(partes.dbf.byteOffset, partes.dbf.byteOffset + partes.dbf.byteLength))

ok(geoms.length === 3, `shpjs releyó ${geoms.length} geometrías (esperadas 3)`)
ok(tabla.length === 3, `shpjs releyó ${tabla.length} filas de atributos (esperadas 3)`)

// Coordenadas del primer polígono (el orden de los vértices puede invertirse
// por la orientación de anillos que exige el formato: se comparan como conjunto)
const anilloOriginal = features[0].geometry.coordinates[0]
const anilloLeido = geoms[0].coordinates[0]
ok(anilloLeido.length === anilloOriginal.length, 'el anillo conserva el número de vértices')
const mismoConjunto = anilloOriginal.every(([x, y]) =>
  anilloLeido.some(([x2, y2]) => casi(x, x2) && casi(y, y2)))
ok(mismoConjunto, 'todos los vértices sobreviven con precisión de doble')

// El agujero tiene que seguir siendo un segundo anillo del mismo polígono
const conAgujero = geoms[1]
ok(conAgujero.coordinates.length === 2, 'el polígono con agujero conserva sus 2 anillos')

// El MultiPolygon debe volver con sus dos partes
const multi = geoms[2]
const partesMulti = multi.type === 'MultiPolygon' ? multi.coordinates.length : multi.coordinates.length
ok(partesMulti === 2, `el MultiPolygon conserva sus 2 partes (leyó ${partesMulti} como ${multi.type})`)

// ─── Atributos ──────────────────────────────────────────────────────────────
ok(tabla[0].zona_id === 'a1', `zona_id: "${tabla[0].zona_id}"`)
ok(tabla[0].nombre === 'Lote Opcional 3', `nombre: "${tabla[0].nombre}"`)
ok(tabla[1].accion === 'modificada', `accion: "${tabla[1].accion}"`)
ok(casi(Number(tabla[0].area_ha), 0.5739, 1e-6), `area_ha numérica: ${tabla[0].area_ha}`)
ok(casi(Number(tabla[1].area_ha), 12.3456, 1e-6), `area_ha con decimales: ${tabla[1].area_ha}`)
ok(String(tabla[1].observ).includes('árbol'), `tildes en el .dbf: "${tabla[1].observ}"`)

// ─── Orientación de anillos (regla del formato: exterior horario) ───────────
const areaFirmada = (r) => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s / 2 }
ok(areaFirmada(geoms[1].coordinates[0]) < 0, 'anillo exterior en sentido horario')
ok(areaFirmada(geoms[1].coordinates[1]) > 0, 'agujero en sentido antihorario')

// ─── .prj ───────────────────────────────────────────────────────────────────
ok(partes.prj.includes('WGS_1984') && partes.prj.startsWith('GEOGCS'), '.prj declara WGS84 geográfico')
ok(partes.cpg === 'UTF-8', '.cpg declara UTF-8')

console.log(fallos === 0 ? '\nTodo correcto: el shapefile se relee sin pérdida.' : `\n${fallos} verificación(es) fallaron.`)
process.exit(fallos === 0 ? 0 : 1)
