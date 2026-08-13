# Pendientes de integración — Amazonía Emprende

> **Backlog vivo.** Aquí se van anotando las cosas que faltan por módulo a medida que las detectamos, para no perderlas. Cuando algo se implemente, se marca ✅ (o se mueve al historial).
>
> **Fecha:** 2026-06-13 · **Última revisión:** 2026-08-12 · **Relacionado:** [`ARQUITECTURA_ECOSISTEMA.md`](ARQUITECTURA_ECOSISTEMA.md) (decisiones D1–D5)

**Cómo leer el estado:** 🆕 detectado · 🔧 en diseño · ⏳ esperando decisión · ✅ hecho

---

## Jurídica

| Pendiente | Por qué | Dónde impacta | Estado |
|-----------|---------|---------------|--------|
| **Subir la cédula en PDF** | Soporte escaneado del documento de identidad | `cedula_url` en `juridica.debida_diligencia` + campo en los formularios crear/editar | ✅ (2026-06-18) |
| Confirmar si la migración SQL ya corrió | — | Confirmado: schema `juridica` vivo en BD; los datos eran de prueba | ✅ |
| Crear usuario con `department = 'Juridica'` | El control de acceso lo exige | Existe `legal@amazoniaemprende.com` | ✅ |
| **Cutover a `core`** | Jurídica es la puerta de entrada; separa persona/predio/expediente | Hecho y verificado con caso real; `core` expuesto; `juridica.aliados_legacy` borrada | ✅ (2026-06-19) |
| Subir documentos como imagen o Word | La abogada no siempre tiene el soporte en PDF | `subirDocumento` acepta PDF (se comprime), imagen y Word; inputs con `accept` ampliado | ✅ (2026-06-18) |
| Quitar campo "acto de adquisición actual" | Innecesario en HOJA 3 | Removido de UI/API/tipo; `DROP COLUMN` corrido en BD | ✅ (2026-06-19) |
| **Varias matrículas por predio + varios predios por propietario** | Un polígono puede estar bajo varias matrículas (englobe); y el dueño puede tener predios en otros lados | `core.predios.matriculas text[]` (`migration_core_matriculas.sql`); formularios con lista de matrículas; botón "Otro predio del propietario" (reutiliza la persona vía `?aliado=`) | ✅ (2026-06-20) · falta correr el SQL |

## Vivero

| Pendiente | Por qué | Dónde impacta | Estado |
|-----------|---------|---------------|--------|
| **Construir el módulo (app aparte)** | Diseñado y decisiones cerradas; falta implementar | schema `vivero` + `catalogo` + app que sincroniza | 🔧 |
| Añadir `dias_crecimiento_vivero` al catálogo | Necesario para la alerta de siembra (planeación hacia atrás) | `catalogo.especies` | 🆕 |
| Decisiones V1–V6 | ✅ Cerradas: solo normales · sembradas/normales · mensual · manual · COP sin IVA · **app aparte** | `CONTEXTO_MODULO_VIVERO.md` §8 | ✅ |

## Plan de siembra

| Pendiente | Por qué | Dónde impacta | Estado |
|-----------|---------|---------------|--------|
| Cálculo de demanda (modelo florístico) | **Diseñado:** área(SIG) × densidad × %especie × (1+reposición) → solicitud. Ver §3.4 de `ARQUITECTURA_DATOS.md` | `siembra.planes / modelos_floristicos / modelo_especies / plan_zonas` | 🔧 |
| Definir la app de verificación / corrección de zonas | Ahora la app de campo hace SIG II | PWA campo + `geo.zonas` | 🆕 |

## Geo / SIG

| Pendiente | Por qué | Dónde impacta | Estado |
|-----------|---------|---------------|--------|
| ~~GeoAE lee columnas de `siembra.familias` eliminadas por `migration_campo_core.sql`~~ | `fetchSiembraFamilias`/`fetchSiembraCamaras` no se habían actualizado tras el rediseño a `core` (2026-07-07); confirmado el fallo en runtime contra la BD real (`42703`) | `GeoAE/lib/queries.ts` — ahora resuelve identidad con JOIN a `core.predios`/`core.aliados` | ✅ (2026-07-16) |
| **Módulo SIG en la Intranet** | Gestionar las zonas potenciales (SIG I) | `/intranet/sig`: worklist de predios enviados por jurídica (etapa `sig_i`), enlazado desde el tablero | ✅ worklist (2026-06-19); ingesta pendiente |
| **Flujo Jurídica → SIG** | Jurídica ya NO entrega a Siembra; entrega a **SIG** | "Enviar a SIG" avanza `core.expedientes.etapa` a `sig_i` (ruta `enviar-sig`) | ✅ (2026-06-19) |
| **Habilitar PostGIS + `geo.zonas`** | Medir hectáreas reales y versionar zonas (hoy son .zip en Storage) | `migration_geo.sql` escrito (PostGIS + `geo.zonas` + RPC `geo.crear_zona`); falta correrlo y exponer `geo` | 🔧 (2026-06-19) |
| **Ingesta de shapefile (SIG I)** | El SIG sube su `.zip` → parsear, reproyectar a 4326, guardar en `geo.zonas` | HECHO en `/intranet/sig/[predioId]`: parsea (shpjs), reproyecta (proj4 + `.prj`), **previsualiza en mapa Leaflet/OSM + tabla de atributos + métricas** (área ha/km², perímetro, nº zonas) y guarda vía `geo.crear_zona`. **Falta probar con un shapefile real.** | ✅ (2026-06-19) |
| Persistir atributos/perímetro + ver zonas guardadas | Guardar `propiedades` (.dbf) y `perimetro_m`, y leer zonas en el mapa al recargar | correr `migration_geo_v2.sql` (ALTER + RPC `geo.zonas_de_predio`) | 🔧 (correr v2) |
| **SIG I en dos pasos: polígono del predio + sitios de siembra** | El SIG sube un `.zip` con varios polígonos → elige UNO (el predio, `tipo=finca`); y aparte los sitios de siembra (`tipo=restauracion`) dentro del polígono | `/intranet/sig/[predioId]` con 2 pestañas. Polígono: selección en mapa/lista + aviso de **sobreposición** → **sobreescribir** (borra y reemplaza) o **unir** (`ST_Union` vía `geo.crear_zona_union`). Sitios: previsualización **superpuesta** al polígono guardado. Mapa con capa base + clic para elegir. | ✅ (2026-06-20) · correr `migration_geo_v3.sql` |
| Respaldo del `.zip` en Storage | Trazabilidad (el geom queda en PostGIS, pero el .zip es respaldo) | bucket `sig-shapefiles` + subir en la ingesta | 🆕 opcional |
| Pipeline de publicación a PMTiles | Geoportal serverless con MapLibre | GeoAE | 🆕 |
| App de campo debe **devolver las zonas corregidas (SIG II)** | El flujo lo exige antes del plan | `geo.zona_revision` + RPC `geo.revisar_zona` en producción; 27 revisiones reales de 2 predios. Método: vértices con leaflet-geoman | ✅ (2026-07-28) |
| **El SIG destruía lo anterior al resubir** | `modo='sobreescribir'` hacía `DELETE`, así que los `zona_id` que el celular tenía descargados desaparecían y la corrección de campo no se podía aplicar nunca | `migration_geo_versionado.sql`: cada subida es un lote con versión, lo reemplazado queda `vigente=false`. `revisar_zona` revive o recrea en vez de fallar | ✅ (2026-08-11) |
| **Reemplazar sitios de siembra sin duplicar** | Solo existía `modo='insertar'`, que suma: por eso La Dalia tiene dos zonas "Lote 2" | Casilla "Reemplazar los sitios ya guardados" en `/intranet/sig/[predioId]` | ✅ (2026-08-11) |
| **El SIG no veía qué pasó en terreno** | Mandaba predios a campo y no tenía dónde ver correcciones ni formularios | Pestaña "Resultados de campo": mapa antes/después, bitácora y los dos formularios. `/api/sig/campo` | ✅ (2026-08-12) |
| **Tablero inutilizable con 111 predios** | Lista plana de nombres, sin forma de saber qué tiene cartografía | `/intranet/sig` por fase cartográfica + filtros; `/api/sig/worklist` | ✅ (2026-08-12) |
| **No se podía sacar la geometría del sistema** | El SIG leía shapefiles pero no los devolvía: la corrección de campo se quedaba en la base | `lib/shapefile-write.ts` + `lib/exportar-zonas.ts`; descarga `.zip` en EPSG:4326 con atributos | ✅ (2026-08-12) |
| Estrenar el versionado con una subida real | `geo.zonas_lote` está en cero: el SIG no ha subido nada desde la migración | `/intranet/sig/[predioId]` | 🆕 |
| Revisar **Los Andes**: 315 ha medidas vs 65,5 registrales | Dos polígonos de finca cargados (El Olivo + Lagunilla); o es el shapefile equivocado o son varios predios en uno | `geo.zonas` del predio `4a25db35…` | 🆕 |

## Núcleo / modelo de datos

| Pendiente | Por qué | Dónde impacta | Estado |
|-----------|---------|---------------|--------|
| Crear el schema `core` (aliados / predios / expedientes) | Deduplicar persona y predio | Hecho; jurídica escribe sobre `core`; ver `CORE_MIGRACION.md` | ✅ (2026-06-19) |
| **Tablero de predios/expedientes** | Ver "¿en qué etapa va cada predio?" (payoff de D1) | `/intranet/expedientes` + `lib/expedientes.ts` + `/api/expedientes`; resumen por etapa, búsqueda, filtros (etapa/estado jurídico/semáforo/municipio/línea) y agrupación | ✅ (2026-06-19) |
| Conectar campo al `core` (DESPUÉS de SIG) | El flujo cambió: Jurídica → **SIG** → Campo. Campo ya no es el paso inmediato | `siembra.familias.expediente_id` y la ruta `crear-en-siembra` quedan listos; se conectan cuando el proceso llegue a la etapa `campo` | ⏳ (tras SIG) |
| ~~Fusionar `siembra` + `ras` en `intervenciones`~~ | **Descartada (2026-06-27)**: dominios separados (Siembra=restauración, RAS=conservación) | — | ❌ D3 descartada |
| Crear el `catalogo.especies` | Dato maestro que usan vivero, plan y Ley del árbol | nuevo schema | 🔧 |

---

## Historial (hecho)

_(vacío por ahora — aquí se moverá lo que se complete)_
