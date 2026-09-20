# Contexto del Módulo SIG / Geoespacial — Amazonía Emprende

> **Propósito doble:** (1) definir la arquitectura de datos geoespaciales del ecosistema y (2) **preparar la reunión con el equipo SIG** para decidir el futuro de esta capa.
> **Fecha:** 2026-06-14 · **Versión:** 0.1 (borrador para discutir)
> **Relacionado:** [`ARQUITECTURA_ECOSISTEMA.md`](ARQUITECTURA_ECOSISTEMA.md) (D4) · [`geovisor/CONTEXTO_GEOVISOR.md`](geovisor/CONTEXTO_GEOVISOR.md) · [`PENDIENTES_INTEGRACION.md`](PENDIENTES_INTEGRACION.md)

---

## 1. Resumen en una frase

Hoy toda la geometría se guarda como un `.zip` (shapefile) en Storage y el geovisor lo parsea en el navegador. **Proponemos separar tres roles**: la geometría vive en **PostGIS** (consultable, fuente de verdad), se publica a **PMTiles** para el geovisor (rápido, sin servidor), y el `.zip` del SIG pasa a ser **insumo de carga + respaldo**.

---

## Lotes de siembra y nucleación — lo que sigue después de campo (2026-09-20)

El ciclo SIG → Campo → SIG II cerraba en "ver lo que devolvió el técnico" y ahí se acababa. El proceso real
sigue: **el SIG revisa lo que volvió y lo da por bueno; cada zona que queda en firme es un LOTE de siembra**
(un predio puede quedar con 0, 1 o n — campo bien pudo descartarlas todas), y **sobre esos lotes se sube la
nucleación**, los núcleos de siembra dibujados dentro de cada uno.

**Un lote no es una tabla nueva.** Es una zona de `geo.zonas` con `estado = 'definitiva'` — estado que
existía en el CHECK desde `migration_geo.sql` y que nadie usaba: era exactamente este paso. No se inventó
una entidad paralela que habría que mantener sincronizada con las zonas.

> **"Lote" ya significa una sola cosa.** Hasta el 2026-09-20 la subida versionada del SIG también se
> llamaba lote (`geo.zonas_lote`); se renombró a **carga** — `geo.zonas_carga`, `abrir_carga`,
> `cerrar_carga`, `zonas.carga_id` — en [`sql/migration_renombrar_carga.sql`](sql/migration_renombrar_carga.sql),
> **antes** de que la nucleación pusiera las dos acepciones en la misma pantalla. La palabra del negocio
> gana y la maquinaria cede. Queda pendiente la misma cirugía con "RAS".

**La nucleación se sube en un solo archivo por predio** y la base le asigna a cada núcleo el lote que lo
contiene (`ST_Contains`; si cae en el borde, el que más lo intersecte). Así el SIG no tiene que partir el
shapefile por lote a mano. El núcleo que no caiga en ningún lote **se guarda igual**, con `zona_id` NULL, y
la intranet lo reporta — perderlo en silencio sería peor. La geometría es genérica
(`geometry(Geometry, 4326)`): sirve igual si los núcleos vienen como polígonos o como puntos, sin migrar.
Y la carga es versionada, como todo lo del SIG: resubir deja la anterior en `vigente = false`.

**Dónde está:** pestaña **Nucleación** en `/intranet/sig/[predioId]`, visible solo cuando el predio ya salió
a terreno. Paso 1 confirmar lotes, paso 2 subir la nucleación (bloqueado mientras no haya ningún lote).
APIs `/api/sig/lotes` y `/api/sig/nucleacion`. Modelo: [`sql/migration_nucleacion.sql`](sql/migration_nucleacion.sql).

**Por qué no rompe la app de campo** (verificado en su código, no supuesto): `app_campo/src/lib/core.ts`
descarta solo `estado = 'descartada'`, así que una zona `definitiva` se sigue bajando al celular; y
`src/lib/actualizarSig.ts` compara **geometría y área** para avisar de cambios del SIG — el estado no entra
en la comparación, así que confirmar lotes no le genera ruido a quien está en terreno.

**No confundir con la app de actividades y rendimientos** (`actividades_monitoreo_campo/`): la verificación
de zonas que habilita este paso es la de la **PWA de campo** (`app_campo/`), la de evaluación + SIG II.

---

## Unidades de siembra — varios predios, un solo polígono (2026-09-17)

**El problema.** La parte predial y la cartográfica no van una a una. Un mismo polígono de siembra cae sobre
**varios predios** (englobes, herencias sin partir, fincas contiguas del mismo dueño, vecinos que entran
juntos), y `geo.zonas.predio_id` apunta a UN predio: el polígono total había que subirlo repetido o partirlo
a mano. El síntoma ya está en producción — "Los Andes" carga dos polígonos de finca que son de otros dos
predios, y esos mismos 251,36 ha y 64,02 ha aparecen también colgados de "Parcela" y "FINCA PROVIDENCIA".

**La decisión: fusionar es AGRUPAR, no fundir registros.** Cada predio conserva su matrícula, su dueño y su
expediente jurídico — la debida diligencia es por predio y no se toca. Lo que se comparte es la cartografía.
Una **unidad de siembra** (`core.predio_grupos`) tiene un **predio principal**, y el polígono total se sube
contra él marcado con `geo.zonas.grupo_id`. Coherente con la regla de la casa: nada se destruye y la fusión
se deshace sin perder el rastro (`disuelto_at`, no `DELETE`).

**En el tablero.** El botón **Fusionar predios** entra en modo selección; se marcan los predios, se elige
cuál lleva la cartografía (por defecto el que ya tenga lindero) y se le pone nombre a la unidad. La UI avisa
si la unidad cruza municipios o propietarios distintos. Desde entonces la unidad es **una sola línea de
trabajo**: los miembros van plegados bajo el principal y las cuatro tarjetas de fase cuentan unidades, no
predios sueltos contándose cada uno como "sin cartografía". La fusión se deshace desde la ficha del predio.

**Lo que NO cambia, a propósito.** `geo.zonas.predio_id` sigue NOT NULL apuntando al predio principal, así
que `core.v_predios_campo`, `geo.zonas_de_predio`, el versionado por lotes y la sincronización de
`app_campo` (en producción) ven exactamente lo mismo que antes; `grupo_id` es información añadida.
**Pendiente de decidir:** si una unidad sale a Campo completa (que los miembros también aparezcan en el
celular con el polígono de la unidad) o solo el predio principal, que es lo que pasa hoy. Eso toca
`core.v_predios_campo`, que lee el celular — no se cambió sin decisión explícita.

Modelo y razones: [`sql/migration_predio_grupos.sql`](sql/migration_predio_grupos.sql) ·
`ARQUITECTURA_DATOS.md` §2.1 · API `/api/sig/grupos`.

---

## Estado de implementación (2026-08-12) — el vigente

El módulo SIG ya es productivo de punta a punta: **el SIG sube, campo corrige, y el SIG ve y descarga el resultado.**

**Tablero `/intranet/sig`** — se reorganizó por *fase cartográfica* en vez de ser una lista plana de nombres (con 111 predios era inutilizable). Cuatro tarjetas, que además son los filtros: **sin cartografía** (ni polígono de predio) · **falta zonificar** (predio sí, zonas no) · **listo para campo** · **en campo**. Hoy: 107 / 0 / 2 / 2. Filtros por municipio y zona AE, búsqueda por vereda, y cada fila muestra en chips si tiene predio, cuántas zonas, cuántas descartó campo y si ya devolvió formularios. Lo alimenta `/api/sig/worklist` (expediente + resumen de geo en una sola llamada).

**Dos áreas que no son lo mismo, y confundían:** `core.predios.area_registral` la captura **Jurídica a mano** desde la escritura o el certificado de tradición — *no* sale del shapefile (por eso hay predios con área y sin cartografía; solo 11 de 111 la tienen). El área que manda es la **medida** por PostGIS sobre el `.zip`. El tablero muestra la medida grande y la registral debajo. La comparación ya destapó casos: **Los Andes** tiene 315 ha medidas (dos polígonos de finca: El Olivo 251 + Lagunilla 64) contra 65,5 ha escrituradas — o es el shapefile equivocado o son varios predios en uno.

**Versionado de subidas (`migration_geo_versionado.sql`, corrida 2026-08-11)** — responde la pregunta 11 de este documento. Cada subida es una **carga con versión** (backup 1, 2, 3…); lo reemplazado queda `vigente=false`, consultable, **no borrado**. Antes se hacía `DELETE`, lo que rompía las correcciones que campo tenía pendientes. Se agregó la casilla **"Reemplazar los sitios ya guardados"** en la pestaña de siembra: hasta entonces la única forma de cambiar las zonas era volver a subirlas y que se acumularan duplicadas (por eso La Dalia tiene dos zonas llamadas "Lote 2").

**Pestaña "Resultados de campo"** (aparece apenas el predio sale a terreno) — mapa satelital con lo que corrigió el técnico, con los mismos colores que ve él en el celular y la sombra gris del límite anterior; bitácora de revisiones (quién, cuándo, acción, área, observaciones); y las respuestas completas de la **evaluación de campo AE-CAMPO-001** y la **encuesta predial**. Lo alimenta `/api/sig/campo`.

**Descarga a shapefile** — `lib/shapefile-write.ts` (escrito a mano siguiendo la especificación ESRI: las librerías de JS tratan mal los MultiPolygon, que es como PostGIS guarda todo, y no dejan controlar el `.dbf`). Sale `.zip` con `.shp/.shx/.dbf/.prj/.cpg` en **EPSG:4326** — el sistema en que quedan las geometrías tras la ingesta — con los atributos del sistema. Cada corrección exporta dos polígonos (`momento` = `antes`/`despues`). Verificado de ida y vuelta con shpjs (`scripts/verificar-shapefile.mjs`) y con la corrección real de La Dalia.

**Lo que falta:** respaldo del `.zip` en Storage y el pipeline a PMTiles. (El versionado ya se estrenó: `geo.zonas_carga` tiene historial real — verificado por REST el 2026-09-17.)

---

## Estado de implementación (2026-06-19) — histórico

Arrancó **SIG I**. **Hecho:** el flujo **Jurídica → SIG** (la abogada aprueba y "Envía a SIG"; el expediente avanza a `sig_i`); el módulo **`/intranet/sig`** (worklist de predios por zonificar, enlazado desde el tablero `/intranet/expedientes`); y el modelo de datos **`geo.zonas` + PostGIS** escrito en [`sql/migration_geo.sql`](sql/migration_geo.sql) (PostGIS + tabla + RPC `geo.crear_zona`, que recibe GeoJSON, repara la geometría con `ST_MakeValid`/`ST_Multi` y calcula el área). **Decisiones tomadas (defaults de este doc):** G1 = sí PostGIS; G3 = incremental (GeoJSON ya, PMTiles después); G4 = `geo.zonas` central; carga = el SIG **sube `.zip`** (no edita en el navegador — eso es "futuro" D10). PostGIS ya corrido y expuesto. **Ingesta HECHA (2026-06-19):** `/intranet/sig/[predioId]` sube el `.zip` → parsea (shpjs) → reproyecta a 4326 leyendo el `.prj` (proj4) → **previsualiza en mapa Leaflet/OpenStreetMap + tabla de atributos + métricas** (área ha/km², perímetro, nº de zonas) → guarda en `geo.zonas` vía `geo.crear_zona`. La pregunta A1 del SRID queda resuelta: se lee del `.prj` (si las coords ya están en lon/lat, no reproyecta). **Falta:** correr `migration_geo_v2.sql` (persistir `propiedades`/`perimetro_m` + RPC `geo.zonas_de_predio` para ver las zonas guardadas en el mapa al recargar) y **probar con un shapefile real del SIG**. Opcional: respaldo del `.zip` en Storage (`sig-shapefiles`).

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
11. ~~**¿Cómo quieren manejar el versionado**? ¿Sobrescribir o guardar versiones?~~ → **RESUELTA (2026-08-11): guardar versiones.** Cada subida es una carga (`geo.zonas_carga`, llamada "lote" hasta el 2026-09-20) y lo anterior queda `vigente=false`, consultable. Nada se borra. Ver el estado vigente arriba.
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

1. Explicar la idea de separar guardar / mostrar / insumo (PostGIS = verdad, PMTiles = entrega, `.zip` = insumo). *(5 min)*
2. Resolver el bloque **A (datos y proyección)** — es lo más urgente para arrancar. *(10 min)*
3. Bloque **D (futuro)** — editar en la Intranet vs. QGIS, y versionado. *(15 min)*
4. Cerrar G1–G3 y definir quién hace el primer cargue de prueba. *(10 min)*

---

## 10. Referencias

- Geovisor actual: `Intranet-AE/docs/geovisor/CONTEXTO_GEOVISOR.md`
- Buckets actuales: `siembra-shapefiles`, `ras-shapefiles` (ver `SUPABASE_SCHEMAS.md`)
- Decisión marco D4: `ARQUITECTURA_ECOSISTEMA.md` §5
