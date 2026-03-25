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

| Bucket | Tipo de polígono |
|--------|-----------------|
| `siembra-shapefiles` | Finca completa + área en restauración (módulo Siembra) |
| `ras-shapefiles` | Finca completa + área en conservación (módulo Conservación) |

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
  shapefile_finca_url        TEXT           -- URL pública del ZIP (polígono finca)
  shapefile_restauracion_url TEXT           -- URL pública del ZIP (polígono restauración)
  bajo_conservacion          BOOLEAN
  plantulas_sembradas        INT
  especies_sembradas         INT
  created_at                 TIMESTAMPTZ

siembra.camaras_trampa
  id         UUID
  familia_id UUID → siembra.familias(id)
  nombre     TEXT                           -- ID/nombre de la cámara
  latitud    NUMERIC                        -- coordenada GPS decimal
  longitud   NUMERIC                        -- coordenada GPS decimal

siembra.fotos_camara
  id        UUID
  camara_id UUID → siembra.camaras_trampa(id)
  url       TEXT                            -- URL pública de la foto (bucket siembra-fotos-camara)
```

### Módulo Conservación — schema `ras`

```sql
ras.familias
  id                         UUID
  nombre_propietario         TEXT
  municipio                  TEXT
  vereda                     TEXT
  nombre_finca               TEXT
  ha_bosque                  NUMERIC        -- hectáreas de bosque
  shapefile_finca_url        TEXT           -- URL pública del ZIP (polígono finca)
  shapefile_conservacion_url TEXT           -- URL pública del ZIP (polígono conservación)
  bajo_conservacion          BOOLEAN
  acuerdo_conservacion       BOOLEAN
  arboles_semilleros         INT
  especies_forestales        INT
  created_at                 TIMESTAMPTZ

ras.camaras_trampa
  id         UUID
  familia_id UUID → ras.familias(id)
  nombre     TEXT
  latitud    NUMERIC
  longitud   NUMERIC

ras.fotos_camara
  id        UUID
  camara_id UUID → ras.camaras_trampa(id)
  url       TEXT
```

---

## 4. Capas del geovisor

El geovisor debe poder mostrar las siguientes capas (toggleables):

| # | Capa | Tipo | Fuente |
|---|------|------|--------|
| 1 | Polígonos de fincas — Siembra | Polígono | `siembra.familias.shapefile_finca_url` |
| 2 | Polígonos en restauración | Polígono | `siembra.familias.shapefile_restauracion_url` |
| 3 | Polígonos de fincas — Conservación | Polígono | `ras.familias.shapefile_finca_url` |
| 4 | Polígonos en conservación | Polígono | `ras.familias.shapefile_conservacion_url` |
| 5 | Cámaras trampa — Siembra | Punto (lat/lon) | `siembra.camaras_trampa` |
| 6 | Cámaras trampa — Conservación | Punto (lat/lon) | `ras.camaras_trampa` |

Para los puntos de cámaras trampa, al hacer clic debería mostrar un popup con:
- Nombre/ID de la cámara
- Nombre del propietario y finca
- Miniaturas de fotos (de `fotos_camara.url`)

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

## 10. Checklist de implementación

- [ ] Instalar dependencias: `shpjs`, `jszip`, `leaflet` (o `mapbox-gl`)
- [ ] Crear `app/intranet/ras/geovisor/page.tsx` con guard de auth
- [ ] Consultar `siembra.familias` y `ras.familias` para obtener URLs de shapefiles
- [ ] Consultar `siembra.camaras_trampa` y `ras.camaras_trampa` para puntos GPS
- [ ] Implementar función `fetchAndParseShapefile(url)` usando `shpjs`
- [ ] Renderizar capas en el mapa con colores distintos por módulo
- [ ] Popups en polígonos: nombre propietario, finca, ha, municipio
- [ ] Popups en cámaras: nombre cámara, fotos en miniatura
- [ ] Toggle de capas (show/hide por tipo)
- [ ] Agregar card "Geovisor" en `/intranet/ras/page.tsx`
