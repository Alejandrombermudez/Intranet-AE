# Pendientes de integración — Amazonía Emprende

> **Backlog vivo.** Aquí se van anotando las cosas que faltan por módulo a medida que las detectamos, para no perderlas. Cuando algo se implemente, se marca ✅ (o se mueve al historial).
>
> **Fecha:** 2026-06-13 · **Última revisión:** 2026-09-23 · **Relacionado:** [`ARQUITECTURA_ECOSISTEMA.md`](ARQUITECTURA_ECOSISTEMA.md) (decisiones D1–D5)

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
| **Separar los predios por proyecto y por fuente de información** | Sin esto no se puede decir qué predios responden a Conexión Biodiversa y cuáles a Ley del Árbol, ni de dónde salió cada uno (socialización veredal/comunitaria, un aliado como Lácteos del Hogar) | `core.predios.tipo_proyecto` + `.fuente_informacion` (FK a `catalogo.proyectos` / `catalogo.fuentes_informacion`, ampliables desde HOJA 1 con «+ Agregar»); filtro por proyecto en el listado de jurídica | ✅ (2026-09-08) · SQL corrido y verificado por REST |
| Clasificar los 111 predios que ya existen | El campo nace vacío para todo lo cargado antes; hasta clasificarlos, filtrar por proyecto no sirve | Filtro «Sin proyecto asignado» en `/intranet/juridica` para trabajarlos; UPDATEs masivos comentados en el BLOQUE 9 de la migración | 🆕 (2026-09-08) |
| Llevar el proyecto a las demás dependencias | El dato ya vive en `core.predios` (lo ven todos), pero SIG, campo, vivero y reportes todavía no lo muestran ni filtran por él | `/intranet/sig`, `/intranet/expedientes`, `/api/reporte/predios`, GeoAE | 🆕 (2026-09-08) |
| ~~El módulo de Siembra estaba roto y escondido~~ | Vivía en `/intranet/ras/siembra` —bajo Conservación, aunque lee `siembra.*`—, protegido por `department === 'RAS'` y **sin un solo enlace que llevara hasta él**. Al sacarlo salió a la luz que llevaba dos meses roto: pedía `nombre_propietario`, `municipio`, `vereda` y `nombre_finca`, columnas que `migration_campo_core.sql` eliminó el 2026-07-07. Mostraba "0 familias" con 2 encuestas reales en la base | **Se borró entero el 2026-09-20**, con `/intranet/ras/nueva` (593 líneas huérfanas) y `/api/ras/familias/*` (4 rutas que se llamaban «ras» y escribían en `siembra.*`). No se arregló porque **sobraba**: la encuesta se ve en «Resultados de campo» del predio y completa en el Reporte. **La tabla `siembra.familias` no se tocó.** El departamento `Siembra` entra por el Reporte | ✅ (2026-09-20) |
| **El geovisor pinta «siembra» desde el esquema viejo** | La capa lee `shapefile_finca_url`, `shapefile_restauracion_url` y `shapefile_arboles_url` de `siembra.familias` — el `.zip` por finca de antes de PostGIS. **Las tres están vacías en las dos filas vivas, así que la capa no muestra nada.** La geometría real de siembra vive en `geo.zonas` (61 polígonos) desde junio. `ras.familias` sí tiene 17 de 19 con shapefile, y por eso esa capa sí se ve | `GeoAE/lib/queries.ts` → `fetchSiembraFamilias`. Hay que leer de `geo.zonas` en vez de los `.zip`. **Es el geoportal público y está desplegado**: merece su propia ventana | 🆕 (hallado 2026-09-20) |
| **Invertir el orden: análisis jurídico en HOJA 2, antecedentes en HOJA 3** | El folio es el filtro barato: con semáforo rojo no vale la pena consultar las 14 listas del dueño | Rutas y pantallas de jurídica; el estado de la DD pasa a derivarse de las dos hojas (`derivarEstadoDD`) con el estado nuevo `analisis_ok`; guardar antecedentes recalcula todos los predios de la persona | ✅ (2026-09-14) · SQL corrido y verificado por REST |

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
| **El SIG no podía decidir sobre lo que volvía de campo** | Veía los resultados pero no había dónde decir qué queda como lote: eso estaba escondido en el paso 1 de Nucleación y solo servía para confirmar | Pestaña «Resultados de campo» de `/intranet/sig/[predioId]`: confirmar, editar (vértices sobre el satelital o `.zip`) o eliminar; el rastro queda en `geo.zona_decision` vía `geo.decidir_zonas` (`migration_decision_sig.sql`, corrida el 2026-09-23) | ✅ (2026-09-23) |
| **El SIG no veía qué pasó en terreno** | Mandaba predios a campo y no tenía dónde ver correcciones ni formularios | Pestaña "Resultados de campo": mapa antes/después, bitácora y los dos formularios. `/api/sig/campo` | ✅ (2026-08-12) |
| **Tablero inutilizable con 111 predios** | Lista plana de nombres, sin forma de saber qué tiene cartografía | `/intranet/sig` por fase cartográfica + filtros; `/api/sig/worklist` | ✅ (2026-08-12) |
| **No se podía sacar la geometría del sistema** | El SIG leía shapefiles pero no los devolvía: la corrección de campo se quedaba en la base | `lib/shapefile-write.ts` + `lib/exportar-zonas.ts`; descarga `.zip` en EPSG:4326 con atributos | ✅ (2026-08-12) |
| ~~Estrenar el versionado con una subida real~~ | `geo.zonas_lote` estaba en cero | El SIG ya subió: **42 lotes y 61 zonas** leídos por REST el 2026-09-17 (eran 3 zonas en la migración) | ✅ (verificado 2026-09-17) |
| Revisar **Los Andes**: 315 ha medidas vs 65,5 registrales | Dos polígonos de finca cargados (El Olivo + Lagunilla); o es el shapefile equivocado o son varios predios en uno | `geo.zonas` del predio `4a25db35…`. **Los mismos 251,36 ha y 64,02 ha están también colgados de "Parcela" y "FINCA PROVIDENCIA"** (REST, 2026-09-17): es el caso de varios predios / un polígono → candidato a **unidad de siembra** | 🆕 |
| **Un polígono de siembra sobre varios predios** | La parte predial no va una a una con la cartográfica (englobes, herencias sin partir, fincas contiguas, vecinos juntos): `geo.zonas.predio_id` apunta a UN predio, así que el polígono total había que repetirlo o partirlo a mano | `core.predio_grupos` + `core.predio_grupo_miembros` + `core.v_predio_grupos` + RPC `fusionar_predios`/`disolver_grupo` + `geo.zonas.grupo_id`; botón **Fusionar predios** en `/intranet/sig` y `/api/sig/grupos`. **Agrupa, no funde:** cada predio conserva matrícula, dueño y expediente | ✅ (2026-09-17, verificado 2026-09-19) |
| **Después de campo no había paso siguiente** | El SIG veía lo que devolvió el técnico y ahí se acababa; no había cómo dar las zonas por buenas ni cargar la nucleación | `geo.confirmar_lotes`/`deshacer_lotes` (la zona buena pasa a `estado='definitiva'` = **lote de siembra**, estado que ya existía sin usar) + `geo.nucleos`/`nucleos_carga` + `geo.crear_nucleo` (asigna el lote por contención) + pestaña **Nucleación** en `/intranet/sig/[predioId]`, con `/api/sig/lotes` y `/api/sig/nucleacion` | 🔧 (2026-09-20) · correr `migration_nucleacion.sql` |
| Núcleos que caen fuera de todo lote | Se guardan con `zona_id` NULL a propósito (perderlos en silencio sería peor) y la pestaña los reporta; falta decidir qué hace el SIG con ellos — ¿se reasignan a mano?, ¿se ignoran en el conteo de plantas? | `geo.nucleos.zona_id` · componente `Nucleacion.tsx` | 🆕 decisión pendiente |
| **¿Una unidad de siembra sale a Campo completa?** | Hoy sale solo el **predio principal**, que es el que tiene las zonas: `core.v_predios_campo` exige que el propio predio tenga `geo.zonas` tipo `restauracion`. Si los miembros también deben aparecer en el celular con el polígono de la unidad, hay que ampliar esa vista | `core.v_predios_campo` — **la lee `app_campo`, en producción**. No se tocó sin decisión explícita | 🆕 decisión pendiente |
| **El mismo municipio contado dos veces en los filtros** | `core.predios.municipio` se guardaba como llegara: el filtro del tablero SIG mostraba "MORELIA" (9 predios) y "Morelia" (63) como municipios distintos, y lo mismo en vereda y zona AE | Forma canónica (Tipo Título) en `lib/veredas-caqueta.ts`, aplicada **en el servidor** al escribir (`/api/juridica/aliados` POST y PATCH) + `migration_normalizar_ubicaciones.sql` para los 111 predios ya cargados, generado por `scripts/generar-sql-ubicaciones.mjs` | ✅ (2026-09-17, verificado 2026-09-19) |

## Núcleo / modelo de datos

| Pendiente | Por qué | Dónde impacta | Estado |
|-----------|---------|---------------|--------|
| Crear el schema `core` (aliados / predios / expedientes) | Deduplicar persona y predio | Hecho; jurídica escribe sobre `core`; ver `CORE_MIGRACION.md` | ✅ (2026-06-19) |
| **Tablero de predios/expedientes** | Ver "¿en qué etapa va cada predio?" (payoff de D1) | `/intranet/expedientes` + `lib/expedientes.ts` + `/api/expedientes`; resumen por etapa, búsqueda, filtros (etapa/estado jurídico/semáforo/municipio/línea) y agrupación | ✅ (2026-06-19) |
| Conectar campo al `core` (DESPUÉS de SIG) | El flujo cambió: Jurídica → **SIG** → Campo. Campo ya no es el paso inmediato | `siembra.familias.expediente_id` y la ruta `crear-en-siembra` quedan listos; se conectan cuando el proceso llegue a la etapa `campo` | ⏳ (tras SIG) |
| ~~Fusionar `siembra` + `ras` en `intervenciones`~~ | **Descartada (2026-06-27)**: dominios separados (Siembra=restauración, RAS=conservación) | — | ❌ D3 descartada |
| Crear el `catalogo.especies` | Dato maestro que usan vivero, plan y Ley del árbol | nuevo schema | 🔧 |

## Seguridad de la API

| Pendiente | Por qué | Dónde impacta | Estado |
|-----------|---------|---------------|--------|
| **Las API routes identificaban a quien llama por el correo que mandaba el cliente** | Sin iniciar sesión, con `?email=legal@…` se leía todo jurídica (personas, documentos, URLs firmadas), reporte y SIG; con `requesterEmail` de un admin cualquiera se daba permisos de administrador. Otras 3 rutas (fotos del catálogo, fotos de árboles, inspecciones de vehículos) no verificaban nada | 21 rutas pasan a `exigirSesion` (`lib/auth-api.ts`) y sus pantallas a `fetchConSesion` (`lib/fetch-sesion.ts`); cada ruta conserva su regla de quién puede. Inspecciones además exige que la reserva sea de quien llama | ✅ (2026-09-14) |
| `/api/sistema/doc` y `/api/sistema/pulso` siguen abiertas | Solo lectura: los documentos ya están en el repo público y el pulso son conteos. Si el repo deja de ser público o el pulso empieza a devolver algo más que cifras, ponerles `exigirSesion` | `app/api/sistema/*` | ⏳ aceptado por ahora |

---

## Historial (hecho)

_(vacío por ahora — aquí se moverá lo que se complete)_
