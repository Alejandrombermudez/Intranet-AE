# Pendientes de integración — Amazonía Emprende

> **Backlog vivo.** Aquí se van anotando las cosas que faltan por módulo a medida que las detectamos, para no perderlas. Cuando algo se implemente, se marca ✅ (o se mueve al historial).
>
> **Fecha:** 2026-06-13 · **Relacionado:** [`ARQUITECTURA_ECOSISTEMA.md`](ARQUITECTURA_ECOSISTEMA.md) (decisiones D1–D5)

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
| Cálculo de demanda (modelo florístico) | **Diseñado:** área(SIG) × densidad × %especie × (1+reposición) → solicitud. Ver `Plan.svg`, hoja «Plan» | `siembra.planes / modelos_floristicos / modelo_especies / plan_zonas` | 🔧 |
| Definir la app de verificación / corrección de zonas | Ahora la app de campo hace SIG II | PWA campo + `geo.zonas` | 🆕 |

## Geo / SIG

| Pendiente | Por qué | Dónde impacta | Estado |
|-----------|---------|---------------|--------|
| **Módulo SIG en la Intranet** | Gestionar las zonas potenciales (SIG I) | `/intranet/sig`: worklist de predios enviados por jurídica (etapa `sig_i`), enlazado desde el tablero | ✅ worklist (2026-06-19); ingesta pendiente |
| **Flujo Jurídica → SIG** | Jurídica ya NO entrega a Siembra; entrega a **SIG** | "Enviar a SIG" avanza `core.expedientes.etapa` a `sig_i` (ruta `enviar-sig`) | ✅ (2026-06-19) |
| **Habilitar PostGIS + `geo.zonas`** | Medir hectáreas reales y versionar zonas (hoy son .zip en Storage) | `migration_geo.sql` escrito (PostGIS + `geo.zonas` + RPC `geo.crear_zona`); falta correrlo y exponer `geo` | 🔧 (2026-06-19) |
| **Ingesta de shapefile (SIG I)** | El SIG sube su `.zip` → parsear, reproyectar a 4326, guardar en `geo.zonas` | HECHO en `/intranet/sig/[predioId]`: parsea (shpjs), reproyecta (proj4 + `.prj`), **previsualiza en mapa Leaflet/OSM + tabla de atributos + métricas** (área ha/km², perímetro, nº zonas) y guarda vía `geo.crear_zona`. **Falta probar con un shapefile real.** | ✅ (2026-06-19) |
| Persistir atributos/perímetro + ver zonas guardadas | Guardar `propiedades` (.dbf) y `perimetro_m`, y leer zonas en el mapa al recargar | correr `migration_geo_v2.sql` (ALTER + RPC `geo.zonas_de_predio`) | 🔧 (correr v2) |
| Respaldo del `.zip` en Storage | Trazabilidad (el geom queda en PostGIS, pero el .zip es respaldo) | bucket `sig-shapefiles` + subir en la ingesta | 🆕 opcional |
| Pipeline de publicación a PMTiles | Geoportal serverless con MapLibre | GeoAE | 🆕 |
| App de campo debe **devolver las zonas corregidas (SIG II)** | El flujo lo exige antes del plan; diseño en `arquitectura-visual/Campo_SIG.svg` + tabla `geo.zona_revision`. Decidir: método (vértices/GPS/ambos), mapa base offline, versionado | PWA campo ↔ `geo.zonas` | 🔧 |

## Núcleo / modelo de datos

| Pendiente | Por qué | Dónde impacta | Estado |
|-----------|---------|---------------|--------|
| Crear el schema `core` (aliados / predios / expedientes) | Deduplicar persona y predio | Hecho; jurídica escribe sobre `core`; ver `CORE_MIGRACION.md` | ✅ (2026-06-19) |
| **Tablero de predios/expedientes** | Ver "¿en qué etapa va cada predio?" (payoff de D1) | `/intranet/expedientes` + `lib/expedientes.ts` + `/api/expedientes`; resumen por etapa, búsqueda, filtros (etapa/estado jurídico/semáforo/municipio/línea) y agrupación | ✅ (2026-06-19) |
| Conectar campo al `core` (DESPUÉS de SIG) | El flujo cambió: Jurídica → **SIG** → Campo. Campo ya no es el paso inmediato | `siembra.familias.expediente_id` y la ruta `crear-en-siembra` quedan listos; se conectan cuando el proceso llegue a la etapa `campo` | ⏳ (tras SIG) |
| Fusionar `siembra` + `ras` en `intervenciones` | Hoy son schemas gemelos | refactor | ⏳ (D3) |
| Crear el `catalogo.especies` | Dato maestro que usan vivero, plan y Ley del árbol | nuevo schema | 🔧 |

---

## Historial (hecho)

_(vacío por ahora — aquí se moverá lo que se complete)_
