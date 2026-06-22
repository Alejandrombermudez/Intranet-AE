# Contexto del Módulo SIG / Geoespacial — Amazonía Emprende

> **Propósito doble:** (1) definir la arquitectura de datos geoespaciales del ecosistema y (2) **preparar la reunión con el equipo SIG** para decidir el futuro de esta capa.
> **Fecha:** 2026-06-14 · **Versión:** 0.1 (borrador para discutir)
> **Diagrama:** [`../../arquitectura-visual/geo.svg`](../../arquitectura-visual/geo.svg) · **Relacionado:** [`ARQUITECTURA_ECOSISTEMA.md`](ARQUITECTURA_ECOSISTEMA.md) (D4) · [`geovisor/CONTEXTO_GEOVISOR.md`](geovisor/CONTEXTO_GEOVISOR.md) · [`PENDIENTES_INTEGRACION.md`](PENDIENTES_INTEGRACION.md)

---

## 1. Resumen en una frase

Hoy toda la geometría se guarda como un `.zip` (shapefile) en Storage y el geovisor lo parsea en el navegador. **Proponemos separar tres roles**: la geometría vive en **PostGIS** (consultable, fuente de verdad), se publica a **PMTiles** para el geovisor (rápido, sin servidor), y el `.zip` del SIG pasa a ser **insumo de carga + respaldo**.

---

## Estado de implementación (2026-06-19)

Arrancó **SIG I**. **Hecho:** el flujo **Jurídica → SIG** (la abogada aprueba y "Envía a SIG"; el expediente avanza a `sig_i`); el módulo **`/intranet/sig`** (worklist de predios por zonificar, enlazado desde el tablero `/intranet/expedientes`); y el modelo de datos **`geo.zonas` + PostGIS** escrito en [`sql/migration_geo.sql`](sql/migration_geo.sql) (PostGIS + tabla + RPC `geo.crear_zona`, que recibe GeoJSON, repara la geometría con `ST_MakeValid`/`ST_Multi` y calcula el área). **Decisiones tomadas (defaults de este doc):** G1 = sí PostGIS; G3 = incremental (GeoJSON ya, PMTiles después); G4 = `geo.zonas` central; carga = el SIG **sube `.zip`** (no edita en el navegador — eso es "futuro" D10). **Falta correr `migration_geo.sql` + exponer `geo` en la API.** **Siguiente:** la **ingesta del shapefile** (subir `.zip` → parsear + reproyectar a 4326 leyendo el `.prj` → `geo.crear_zona`). Para probarla se necesita PostGIS activo y un **shapefile de muestra del SIG** (de paso resuelve la pregunta A1 del SRID: se lee del `.prj`).

---

## 2. El problema con el esquema actual

Hoy el `.zip` hace tres trabajos y no hace bien ninguno:

- **Almacenamiento opaco** — la base de datos no puede consultar la geometría: para saber el área hay que descargar y parsear el zip. No se puede preguntar "¿qué predios tocan esta cuenca?" ni "¿cuántas ha avaladas hay?".
- **Visualización que no escala** — `shpjs` parsea en el cliente; bien con 6 predios, inviable con miles (Fase II/III).
- **Sin versionado** — el flujo necesita `zona potencial → validada → avalada`, y eso no cabe en "un zip por finca".
- **Formato viejo** — shapefile limita nombres de columna a 10 caracteres, tiene líos de encoding y son 4 archivos.

---

## 3. Arquitectura propuesta

| Rol | Herramienta | Qué resuelve |
|-----|-------------|--------------|
| **Guardar y consultar** | **PostGIS** (extensión de Supabase) | Área real (`ST_Area`), intersecciones, filtros por atributo, versionado por filas, índice espacial |
| **Mostrar** | **PMTiles** | Un solo archivo servido por *range-requests*, sin servidor de tiles; render con MapLibre GL |
| **Insumo / respaldo** | el **`.zip`** del SIG | Lo que sube el SIG; se conserva para trazabilidad |

> **Idea clave:** PMTiles **no** es una base de datos. Es de solo lectura, optimizado para visualizar. Se edita y se consulta en **PostGIS**; PMTiles es la "foto publicada".

---

## 4. Cómo subiría el SIG (pipeline de ingesta)

El SIG **no cambia su forma de trabajar**: sigue en QGIS/ArcGIS y exporta shapefile. Lo que cambia es qué pasa al subirlo:

1. En el **módulo SIG de la Intranet** (`/intranet/sig`, por construir) el SIG **sube el `.zip`**.
2. Una **API de ingesta**:
   - parsea el shapefile,
   - **reproyecta a EPSG:4326** (los shp colombianos suelen venir en MAGNA-SIRGAS),
   - valida/repara la geometría (`ST_MakeValid`),
   - calcula el **área en hectáreas**.
3. Inserta en **`geo.zonas`** vinculando `predio_id`, `tipo` y `estado`.
4. Guarda el **`.zip` original en Storage** como respaldo.
5. Para publicar, un **build** compila las capas a `.pmtiles`.

---

## 5. Cómo se integra en la base de datos

```sql
geo.zonas
  id            uuid PK
  predio_id     uuid FK → core.predios
  tipo          text   -- finca | restauracion | conservacion
  estado        text   -- potencial | validada | definitiva | avalada
  geom          geometry(MultiPolygon, 4326)        -- la geometría (indexada GIST)
  area_ha       numeric  -- = ST_Area(geom::geography)/10000   (calculada, no a mano)
  origen        text   -- sig | campo | ia
  shapefile_url text   -- el .zip de respaldo
  version       int
  created_at    timestamptz
```

Esto **reemplaza** los campos actuales `shapefile_finca_url`, `shapefile_restauracion_url`, `shapefile_conservacion_url`… (hoy solo URLs a zip) por **geometría real + el zip como respaldo**.

---

## 6. Camino incremental (recomendado)

Como en Fase I son ~6 predios, no hace falta construirlo todo de golpe:

- **Paso 1 (ya):** habilitar PostGIS y servir **GeoJSON directo** desde PostGIS al geovisor. Solo esto ya da consultas, área real y versionado.
- **Paso 2 (al publicar en serio / crecer el volumen):** añadir el **build de PMTiles**. El pipeline ya queda diseñado para enchufarlo.

---

## 7. ⭐ Preguntas para la reunión con el SIG

> Estas son las que definen el futuro. Agrupadas para llevarlas como agenda.

### A. Datos y proyección
1. **¿En qué sistema de coordenadas (SRID) trabajan y exportan?** (¿MAGNA-SIRGAS origen nacional `EPSG:9377`? ¿Bogotá `3116`? ¿UTM 18N/19N?) — define la reproyección a 4326.
2. **¿Qué atributos traen hoy los shapefiles?** ¿Hay un identificador del predio en el `.dbf` que podamos mapear a `predio_id`?
3. **¿Qué tipos de capa manejan?** (finca, restauración, conservación, cámaras trampa, zonas potenciales…) y su geometría (polígono / punto / línea).

### B. Formato y herramientas
4. **¿Pueden entregar GeoJSON o GeoPackage**, o shapefile es lo único viable?
5. **¿Tienen problemas frecuentes de geometría** (inválidas, solapamientos, huecos)? — afecta la validación automática.
6. **¿Tienen acceso/experiencia** para correr herramientas de tiles (tippecanoe / GDAL), o eso lo automatizamos del lado de la Intranet?

### C. Proceso y volumen
7. **¿Cómo generan hoy las zonas** y hacen control de calidad? (flujo en QGIS/ArcGIS)
8. **¿Cuántos polígonos/predios esperan por fase** (I, II, III)? — define si PMTiles entra ya o en el paso 2.
9. **¿Quién subiría y mantendría los datos** — el SIG directo, o el equipo RAS?

### D. Futuro (lo más estratégico)
10. **¿Quieren editar polígonos DENTRO de la Intranet** (dibujar/ajustar zonas en el navegador), o seguir editando en QGIS y solo subir?
11. **¿Cómo quieren manejar el versionado** `potencial → validada → avalada` que pide el flujo? ¿Sobrescribir o guardar versiones?
12. **¿Las capas de cobertura del modelo de IA** (`modelo-web`) deben entrar como insumo de las zonas potenciales (SIG I)?

---

## 8. Decisiones a confirmar (nuestras)

| # | Decisión | Recomendación |
|---|----------|---------------|
| G1 | ¿Habilitar PostGIS en Supabase? | **Sí** — `CREATE EXTENSION postgis;`, desbloquea todo |
| G2 | ¿La ingesta parsea en cliente (shpjs) o en servidor (GDAL)? | Servidor si hay reproyección compleja; cliente si el SIG ya entrega en 4326 |
| G3 | ¿PMTiles desde ya o camino incremental? | **Incremental** — GeoJSON directo ahora, PMTiles en el paso 2 |
| G4 | ¿`geo.zonas` único, o geometría en cada tabla de intervención? | Tabla `geo.zonas` central, referenciada por predio/intervención |

---

## 9. Agenda sugerida para la reunión (30–45 min)

1. Mostrar el diagrama [`geo.svg`](../../arquitectura-visual/geo.svg) — la idea de separar guardar / mostrar / insumo. *(5 min)*
2. Resolver el bloque **A (datos y proyección)** — es lo más urgente para arrancar. *(10 min)*
3. Bloque **D (futuro)** — editar en la Intranet vs. QGIS, y versionado. *(15 min)*
4. Cerrar G1–G3 y definir quién hace el primer cargue de prueba. *(10 min)*

---

## 10. Referencias

- Diagrama de flujo: `arquitectura-visual/geo.svg` (+ `.html` para proyectar)
- Geovisor actual: `Intranet-AE/docs/geovisor/CONTEXTO_GEOVISOR.md`
- Buckets actuales: `siembra-shapefiles`, `ras-shapefiles` (ver `SUPABASE_SCHEMAS.md`)
- Decisión marco D4: `ARQUITECTURA_ECOSISTEMA.md` §5
