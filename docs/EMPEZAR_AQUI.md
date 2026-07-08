# Empezar aquí — Amazonía Emprende

> Punto de entrada para retomar el proyecto en una sesión nueva. Todo el diseño está en archivos; esta conversación no hace falta.

## Qué es

Ecosistema tecnológico de Amazonía Emprende: intranet, geoportal, vivero, app de campo. Supabase compartido: `lbxysovesmbgesxooghw`.

## Dos dominios — no mezclar

El sistema tiene **dos dominios distintos** que no comparten tablas ni flujo:

1. **Siembra (Restauración) = un proceso completo de extremo a extremo**, no un módulo de "familias". Es la cadena de valor de la restauración:
   **Jurídica → SIG I → Campo → SIG II → Vivero → Ejecución.**
   > **Estado real (2026-07-08):** la app de campo productiva es **`app_campo/`** (`familias-res/` fue la prueba de concepto). Ya está **conectada al proceso real**: lee `core.v_predios_campo` (solo predios que pasaron Jurídica + SIG I), sus zonas vienen de `geo.zonas`, y tiene **módulo SIG** (mapa satelital + GPS + corrección de zonas = SIG II). Contexto completo: `../../app_campo/CONTEXTO_APP_CAMPO.md`.

2. **Conservación (RAS = Red de Árboles Semilleros) = dominio aparte.** Familias en conservación que **alojan** la red de árboles semilleros. El **árbol semillero es el objeto principal** (uno por fila, colgado del predio), no un conteo. Vive en `ras.*` y está **en rediseño** (parámetros del formulario + carga de árboles + conexión al geovisor).

> Cuidado con la palabra "RAS": en los diagramas del proceso de restauración aparece como el **equipo** responsable de algunas etapas; como **schema/dominio** (`ras.*`) significa **Conservación / Red de Árboles Semilleros**. Son cosas distintas.

## Estado

Diseño conceptual **completo**. **Semana 1 IMPLEMENTADA y en producción (2026-06-19):** el modelo central `core` (aliados/predios/expedientes) está creado y el módulo **Jurídico ya escribe sobre él** (cutover completo, verificado con un caso real; `juridica.aliados_legacy` ya borrada). Qué se hizo y cómo: [`CORE_MIGRACION.md`](CORE_MIGRACION.md). Lo que sigue es continuar conectando el proceso aguas abajo de jurídica.

## Orden de lectura

1. **`ARTICULACION_Y_PROYECCION.md`** — leer primero. Flujo end-to-end, las "costuras" (claves foráneas), qué falta desarrollar, el roadmap por dependencias, todas las decisiones, y el mapa de dónde está cada artefacto.
2. **`CRONOGRAMA.md`** — plan de 20 semanas, en el orden del proceso.
3. **`ARQUITECTURA_DATOS.md`** — documento maestro de **entidad-relación y parámetros** de todo el ecosistema (todas las tablas, llaves PK/FK, estado y orden para desarrollar). **Base para desarrollar masivamente.**
4. **Specs de módulo:** `../../app_vivero/CONTEXTO_MODULO_VIVERO.md`, `CONTEXTO_MODULO_SIG.md`, `../../juridica/CONTEXTO_MODULO_JURIDICO.md`, **`../../app_campo/CONTEXTO_APP_CAMPO.md` (app de campo: qué se hizo, qué falta, cómo retomar)**.
5. **`PENDIENTES_INTEGRACION.md`** — backlog vivo (incluye la cédula en PDF de jurídica, etc.).
6. **`ARQUITECTURA_ECOSISTEMA.md`** — el documento maestro (4 vistas + decisiones D1–D5).
7. **`CORE_MIGRACION.md`** — qué se implementó en la Semana 1 (modelo `core` + cutover de jurídica) y cómo está hecho. **Leer para entender el estado actual del código.**

> La carpeta `arquitectura-visual/` (diagramas `.svg/.html` + Excel `parametros_ER.xlsx`/`cronograma_actividades.xlsx`) se eliminó (2026-06-27). Todo su contenido se consolidó en [`ARQUITECTURA_DATOS.md`](ARQUITECTURA_DATOS.md); los diagramas vivos son los **Mermaid embebidos** en los `.md`.

## Decisiones tomadas (resumen)

- Varios dominios conectados por interfaces; no una columna única.
- Modelo canónico `core` (aliados → predios → expedientes) para quitar duplicados.
- Geo: PostGIS como fuente de verdad; el `.zip` se desglosa a la base; geovisor lee de ahí.
- App de campo corrige las zonas (SIG II) antes del plan.
- Plan de siembra: `área × densidad × %especie × (1+reposición)` → demanda al vivero. Modelo por zona o por predio, composición en %, reposición editable.
- Vivero: app aparte, producción bajo demanda. Costeo: el costo del lote se mantiene y lo absorben las plántulas normales; el corte mensual se reparte por días-plántula (sembradas × días).
- Catálogo de especies como dato maestro.

## Siguiente paso

**Semana 1 (core + jurídica) — HECHA.** El flujo se ajustó: Jurídica → **SIG** (ya no a Siembra). Hecho (2026-06-19): el módulo **SIG** (`/intranet/sig`, worklist de SIG I), el cambio de flujo ("Enviar a SIG" avanza el expediente a `sig_i`), el **tablero de predios** (`/intranet/expedientes`), y el modelo `geo.zonas` + PostGIS (`docs/sql/migration_geo.sql`, falta correrlo). **Siguiente:** la **ingesta del shapefile** en SIG I (subir `.zip` → reproyectar a 4326 → `geo.zonas`); necesita PostGIS activo + un shapefile de muestra. Estado vivo: [`PENDIENTES_INTEGRACION.md`](PENDIENTES_INTEGRACION.md).

## Prompt para el chat nuevo

> Retomo el proyecto Amazonía Emprende. Todo el diseño está documentado. Lee `Intranet-AE/docs/EMPEZAR_AQUI.md` y los archivos que indica. Vamos a empezar la implementación por la Semana 1 del cronograma: el modelo central `core` (aliados, predios, expedientes) y el mapeo de migración desde las tablas actuales.
