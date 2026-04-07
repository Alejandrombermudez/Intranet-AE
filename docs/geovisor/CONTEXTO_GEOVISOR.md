# Contexto para integración del Geovisor — Intranet AE

> Este documento está escrito para que un nuevo chat de Claude pueda retomar
> la integración del geovisor sin necesidad de explorar el proyecto desde cero.
> Leer completo antes de escribir código.

---

## 1. Qué es este proyecto

**Intranet AE** es una aplicación Next.js 16 (App Router, React 19) con Supabase como backend.
El módulo RAS gestiona familias vinculadas a procesos ambientales en la Amazonia colombiana.
Tiene dos submódulos:

| Submódulo | Ruta intranet | Schema Supabase |
|-----------|---------------|-----------------|
| Siembra / Restauración | `/intranet/ras/siembra` | `siembra` |
| Conservación | `/intranet/ras/conservacion` | `ras` |

Cada familia tiene **polígonos espaciales** y **puntos GPS de cámaras trampa** que se quieren visualizar en un geovisor.

---

## 2. Archivos espaciales almacenados

### Formato de carga

Los usuarios suben los polígonos como **archivos `.zip`** que contienen un shapefile completo:

```
poligono_finca.zip
├── archivo.shp   ← geometría (polígonos)
├── archivo.dbf   ← atributos
├── archivo.shx   ← índice de geometría
└── archivo.prj   ← sistema de coordenadas (recomendado WGS84 / EPSG:4326)
```

> **Sistema de coordenadas recomendado:** WGS84 geográfico (EPSG:4326), que es el
> estándar de GPS y de servicios de mapas web. Si el usuario exporta en otro SRS
> (ej. MAGNA-SIRGAS / EPSG:9377 o 3116), el geovisor debe reproyectar.

### Dónde están los archivos

Los `.zip` se almacenan en **Supabase Storage** (acceso público):

| Bucket | Tipo de contenido |
|--------|------------------|
| `siembra-shapefiles` | Finca completa + área en restauración + **árboles puntos** (módulo Siembra) |
| `ras-shapefiles` | Finca completa + área en conservación + **árboles puntos** (módulo Conservación) |
| `ras-documentos` | PDFs de acuerdo / tratamiento de datos (compartido por ambos módulos) |
| `siembra-fotos-predio` | Fotos categorizadas del predio (módulo Siembra) |
| `ras-fotos-predio` | Fotos categorizadas del predio (módulo Conservación) |
| `siembra-fotos-camara` | Fotos de cámaras trampa (módulo Siembra) |
| `ras-fotos-camara` | Fotos de cámaras trampa (módulo Conservación) |

La URL pública de cada archivo se guarda en la base de datos (ver sección 3).

---

## 3. Modelo de datos relevante para el geovisor

### Módulo Siembra — schema `siembra`

```sql
siembra.familias
  id                         UUID
  nombre_propietario         TEXT
  municipio                  TEXT
  vereda                     TEXT
  nombre_finca               TEXT
  ha_restauracion            NUMERIC        -- hectáreas en restauración
  ha_potreros                NUMERIC
  ha_bosque                  NUMERIC
  ha_otras                   NUMERIC
  plantulas_sembradas        INT
  especies_sembradas         INT
  parcelas_monitoreo         INT
  empleos_locales            INT
  plan_restauracion          TEXT
  adultos                    INT
  ninos                      INT
  bajo_conservacion          BOOLEAN
  shapefile_finca_url        TEXT           -- URL pública del ZIP (polígono finca)
  shapefile_restauracion_url TEXT           -- URL pública del ZIP (polígono restauración)
  shapefile_arboles_url      TEXT           -- ★ NUEVO: URL del ZIP de puntos de árboles
  documento_acuerdo_url      TEXT           -- ★ NUEVO: URL del PDF de acuerdo/tratamiento de datos
  created_at                 TIMESTAMPTZ
  created_by                 TEXT

siembra.camaras_trampa
  id         UUID
  familia_id UUID → siembra.familias(id)
  nombre     TEXT                           -- ID/nombre de la cámara
  latitud    NUMERIC                        -- coordenada GPS decimal
  longitud   NUMERIC                        -- coordenada GPS decimal

siembra.fotos_camara
  id        UUID
  camara_id UUID → siembra.camaras_trampa(id)
  url       TEXT                            -- URL pública (bucket: siembra-fotos-camara)

-- ★ NUEVA TABLA
siembra.fotos_predio
  id         UUID
  familia_id UUID → siembra.familias(id)
  categoria  TEXT  CHECK IN ('predio','familia','copa_arboles','tronco','otras')
  url        TEXT                           -- URL pública (bucket: siembra-fotos-predio)
  created_at TIMESTAMPTZ

siembra.monitoreos
  id                UUID
  familia_id        UUID → siembra.familias(id)
  fecha             DATE
  supervivencia_pct NUMERIC (0–100)
```

**Mínimos de fotos por categoría (referencia de negocio):**

| Categoría | `categoria` key | Mínimo recomendado |
|-----------|----------------|--------------------|
| Predio | `predio` | 10 |
| Familia | `familia` | 1 |
| Copa de árboles | `copa_arboles` | 3 |
| Tronco | `tronco` | 2 |
| Otras | `otras` | 4 |

### Módulo Conservación — schema `ras`

```sql
ras.familias
  id                         UUID
  nombre_propietario         TEXT
  municipio                  TEXT
  vereda                     TEXT
  nombre_finca               TEXT
  ha_bosque                  NUMERIC        -- hectáreas de bosque
  ha_potreros                NUMERIC
  ha_otras                   NUMERIC
  bajo_conservacion          BOOLEAN
  acuerdo_conservacion       BOOLEAN
  arboles_semilleros         INT
  especies_forestales        INT
  otros_indices              TEXT
  adultos                    INT
  ninos                      INT
  shapefile_finca_url        TEXT           -- URL pública del ZIP (polígono finca)
  shapefile_conservacion_url TEXT           -- URL pública del ZIP (polígono conservación)
  shapefile_arboles_url      TEXT           -- ★ NUEVO: URL del ZIP de puntos de árboles
  documento_acuerdo_url      TEXT           -- ★ NUEVO: URL del PDF de acuerdo/tratamiento de datos
  created_at                 TIMESTAMPTZ
  created_by                 TEXT

ras.camaras_trampa
  id         UUID
  familia_id UUID → ras.familias(id)
  nombre     TEXT
  latitud    NUMERIC
  longitud   NUMERIC

ras.fotos_camara
  id        UUID
  camara_id UUID → ras.camaras_trampa(id)
  url       TEXT                            -- URL pública (bucket: ras-fotos-camara)

-- ★ NUEVA TABLA
ras.fotos_predio
  id         UUID
  familia_id UUID → ras.familias(id)
  categoria  TEXT  CHECK IN ('predio','familia','copa_arboles','tronco','otras')
  url        TEXT                           -- URL pública (bucket: ras-fotos-predio)
  created_at TIMESTAMPTZ
```

---

## 4. Capas del geovisor

El geovisor debe poder mostrar las siguientes capas (toggleables):

| # | Capa | Tipo geométrico | Fuente |
|---|------|----------------|--------|
| 1 | Polígonos de fincas — Siembra | Polígono | `siembra.familias.shapefile_finca_url` |
| 2 | Área en restauración | Polígono | `siembra.familias.shapefile_restauracion_url` |
| 3 | **★ Árboles — Siembra** | Puntos (SHP) | `siembra.familias.shapefile_arboles_url` |
| 4 | Polígonos de fincas — Conservación | Polígono | `ras.familias.shapefile_finca_url` |
| 5 | Área en conservación | Polígono | `ras.familias.shapefile_conservacion_url` |
| 6 | **★ Árboles — Conservación** | Puntos (SHP) | `ras.familias.shapefile_arboles_url` |
| 7 | Cámaras trampa — Siembra | Punto (lat/lon DB) | `siembra.camaras_trampa` |
| 8 | Cámaras trampa — Conservación | Punto (lat/lon DB) | `ras.camaras_trampa` |

> **Nota sobre la capa de árboles:** `shapefile_arboles_url` es un ZIP con un shapefile de **puntos** (no polígonos). Cada punto representa un árbol o semillero. Renderizar como marcadores pequeños (círculo ~4px) en color distinto al de las cámaras trampa.
> Este campo es **opcional** — puede ser `null` si el usuario no subió el shapefile.

### Popups de cada capa

**Polígonos de finca / área:**
- Nombre propietario (`nombre_propietario`)
- Nombre finca (`nombre_finca`)
- Municipio + vereda
- Hectáreas del polígono (campo según tipo: `ha_restauracion` o `ha_bosque`)
- Link a la página de detalle: `/intranet/ras/siembra/{id}` o `/intranet/ras/conservacion/{id}`

**Puntos de árboles (SHP):**
- Los atributos disponibles dependen del shapefile subido por el usuario (campos DBF)
- Mostrar los campos que traiga el SHP + el nombre de la familia propietaria

**Cámaras trampa (lat/lon):**
- Nombre/ID de la cámara (`nombre`)
- Nombre del propietario y finca (join con familia)
- Miniaturas de las primeras 3–4 fotos (de `fotos_camara.url`)

### Fotos del predio (no en el mapa, pero sí en el panel lateral)

Al seleccionar una familia en el mapa se puede mostrar un panel lateral con:

```ts
// Query de fotos_predio para la familia seleccionada
const { data } = await supabase
  .schema('siembra') // o 'ras'
  .from('fotos_predio')
  .select('categoria, url')
  .eq('familia_id', familiaId)
  .order('created_at')

// Agrupar por categoría:
// 'predio' | 'familia' | 'copa_arboles' | 'tronco' | 'otras'
```

Las fotos se pueden mostrar como galería por pestañas/categorías en el panel. No tienen coordenadas — son simplemente fotos del lugar.

---

## 5. Flujo técnico para renderizar los shapefiles

Los `.zip` en Supabase Storage no se pueden leer directamente en el mapa.
El flujo recomendado es:

### Opción A — Parseo en el cliente (más simple, sin infraestructura extra)

```
URL del .zip en Supabase Storage
  → fetch() del archivo ZIP
  → descomprimir con JSZip (npm: jszip)
  → parsear el .shp/.dbf con shpjs (npm: shpjs) o shapefile (npm: shapefile)
  → GeoJSON en memoria
  → renderizar en Leaflet / Mapbox GL JS / deck.gl
```

Librerías clave:
- `jszip` — descomprimir el .zip en el browser
- `shpjs` — parsear shapefile completo desde ArrayBuffer → GeoJSON (soporta zip directo)
- `leaflet` o `mapbox-gl` — renderizar GeoJSON

> `shpjs` puede recibir un ArrayBuffer del .zip directamente y devuelve GeoJSON.
> Es la opción más directa:
> ```ts
> import shp from 'shpjs'
> const geojson = await shp(arrayBuffer) // zip ArrayBuffer → GeoJSON
> ```

### Opción B — Conversión en servidor al momento de subida (mejor rendimiento)

Al recibir el `.zip` en el API route (`/api/ras/familias` o `/api/ras/conservacion`),
convertirlo a GeoJSON con `gdal` o `shapefile` (Node) y guardarlo también en Storage.
El geovisor consumiría el GeoJSON directamente sin descomprimir nada.

Requiere: `shapefile` (npm) en el server-side, o `gdal-js` (más pesado).

### Opción C — GeoServer / PostGIS (para producción a escala)

Si el volumen de datos crece: importar los shapefiles a una tabla PostGIS y
servir WMS/WFS desde GeoServer. Fuera del alcance inicial.

**Recomendación para esta intranet: Opción A con `shpjs`** — funciona bien
para decenas de polígonos sin infraestructura adicional.

---

## 6. Mapa base sugerido

Colombia, Amazonia. Opciones:

| Proveedor | Notas |
|-----------|-------|
| OpenStreetMap (Leaflet) | Gratis, sin API key, buena cobertura |
| Mapbox GL JS | Requiere API key, mejor calidad visual, soporta 3D |
| Google Maps JS API | Requiere facturación, excelente imagen satelital |
| ESRI Satellite (Leaflet) | Tiles gratuitos de ESRI, buena imagen para Amazonia |

Para ver polígonos sobre terreno forestal se recomienda **capa satelital** como base.

---

## 7. Autenticación Supabase

La app usa Supabase Auth. El cliente está configurado en:

```
lib/supabase.ts       ← cliente browser (anon key)
lib/supabase-server.ts ← cliente servidor (service role key)
```

Los buckets de Storage son **públicos** — las URLs de shapefiles y fotos son
accesibles sin autenticación. No es necesario token para `fetch()` de los archivos.

Las tablas tienen RLS con política `authenticated` — el geovisor dentro de la
intranet puede usar el cliente Supabase del browser (que ya tiene la sesión activa).

---

## 8. Dónde crear el geovisor en la app

Ruta sugerida: `/intranet/ras/geovisor`

Archivos a crear:
```
app/intranet/ras/geovisor/
└── page.tsx          ← página principal del geovisor
```

El geovisor debe protegerse con el mismo guard de auth que el resto del módulo RAS:
```ts
// Solo admin o departamento RAS
if (!profile?.is_admin && profile?.department !== 'RAS') router.push('/')
```

Agregar link desde el hub RAS (`app/intranet/ras/page.tsx`) junto a las cards de
Siembra y Conservación.

---

## 9. Variables de entorno disponibles

```env
NEXT_PUBLIC_SUPABASE_URL=        # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Clave anon (browser)
SUPABASE_SERVICE_ROLE_KEY=       # Clave service role (server-side únicamente)
```

No se necesitan variables adicionales para la Opción A del geovisor.

---

## 10. Consultas de datos recomendadas

```ts
// Siembra — familias con todos los campos espaciales
const { data: siembraFamilias } = await supabase
  .schema('siembra')
  .from('familias')
  .select(`
    id, nombre_propietario, municipio, vereda, nombre_finca,
    ha_restauracion, ha_bosque, ha_potreros,
    shapefile_finca_url, shapefile_restauracion_url,
    shapefile_arboles_url, documento_acuerdo_url
  `)

// RAS — familias con todos los campos espaciales
const { data: rasFamilias } = await supabase
  .schema('ras')
  .from('familias')
  .select(`
    id, nombre_propietario, municipio, vereda, nombre_finca,
    ha_bosque, ha_potreros,
    shapefile_finca_url, shapefile_conservacion_url,
    shapefile_arboles_url, documento_acuerdo_url
  `)

// Cámaras con fotos
const { data: siembraCamaras } = await supabase
  .schema('siembra')
  .from('camaras_trampa')
  .select('id, familia_id, nombre, latitud, longitud, fotos_camara(url)')

const { data: rasCamaras } = await supabase
  .schema('ras')
  .from('camaras_trampa')
  .select('id, familia_id, nombre, latitud, longitud, fotos_camara(url)')

// Fotos de predio (para panel lateral)
const { data: fotosPredioCat } = await supabase
  .schema('siembra') // o 'ras'
  .from('fotos_predio')
  .select('id, familia_id, categoria, url')
  .eq('familia_id', selectedFamiliaId)
```

---

## 11. Checklist de implementación

- [ ] Instalar dependencias: `shpjs`, `leaflet` (o `mapbox-gl`)
- [ ] Crear `app/intranet/ras/geovisor/page.tsx` con guard de auth (solo RAS o admin)
- [ ] Consultar `siembra.familias` y `ras.familias` (SELECT de campos espaciales)
- [ ] Consultar `siembra.camaras_trampa` y `ras.camaras_trampa` con fotos anidadas
- [ ] Implementar `fetchAndParseShapefile(url)` con `shpjs` — soporta ZIP directo
- [ ] Renderizar **8 capas** toggleables con colores distintos:
  - Siembra finca → verde oscuro
  - Siembra restauración → verde claro
  - Siembra árboles → verde lima (puntos pequeños)
  - RAS finca → azul oscuro
  - RAS conservación → azul claro
  - RAS árboles → azul cyan (puntos pequeños)
  - Cámaras Siembra → naranja
  - Cámaras RAS → rojo
- [ ] Popups en polígonos: propietario, finca, municipio, ha, link a detalle
- [ ] Popups en puntos árboles: atributos del SHP + nombre familia
- [ ] Popups en cámaras: nombre, familia, miniaturas fotos
- [ ] Panel lateral al seleccionar familia: fotos del predio por categoría (fotos_predio)
- [ ] Manejar `shapefile_arboles_url === null` (campo opcional — muchas familias no lo tienen)
- [ ] Agregar card "Geovisor" en `/intranet/ras/page.tsx`
