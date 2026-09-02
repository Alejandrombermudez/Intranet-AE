# Empezar aquí — Amazonía Emprende

> Punto de entrada para retomar el proyecto en una sesión nueva. Todo el diseño está en archivos; esta conversación no hace falta.

## Qué es

Ecosistema tecnológico de Amazonía Emprende: intranet, geoportal, vivero, app de campo. Supabase compartido: `lbxysovesmbgesxooghw`.

## Dos dominios — no mezclar

El sistema tiene **dos dominios distintos** que no comparten tablas ni flujo:

1. **Siembra (Restauración) = un proceso completo de extremo a extremo**, no un módulo de "familias". Es la cadena de valor de la restauración:
   **Jurídica → SIG I → Campo → SIG II → Vivero → Ejecución.**
   > **Estado real (2026-08-12): el tramo Jurídica → SIG I → Campo → SIG II corre CON DATOS REALES.** La app de campo productiva es **`app_campo/`** (`familias-res/` fue la prueba de concepto): lee `core.v_predios_campo`, sus zonas vienen de `geo.zonas`, y su **módulo SIG** (mapa satelital + GPS + corrección de zonas) es el SIG II. Hoy hay 2 predios en campo (**Versalles** y **La Dalia**), 27 revisiones de zonas sincronizadas y evaluadores reales. La intranet ya muestra y descarga lo que devuelve campo. Contexto completo: `../../app_campo/CONTEXTO_APP_CAMPO.md` y [`CONTEXTO_MODULO_SIG.md`](CONTEXTO_MODULO_SIG.md).
   >
   > **Regla de negocio que atraviesa todo el tramo SIG ↔ Campo: el terreno tiene la última palabra.** La oficina propone zonas, la persona parada en el predio dispone, y ninguna versión se destruye (el SIG versiona en lotes, lo reemplazado queda consultable). Ver `ARQUITECTURA_DATOS.md` §2.2.

2. **Conservación (RAS = Red de Árboles Semilleros) = dominio aparte.** Familias en conservación que **alojan** la red de árboles semilleros. El **árbol semillero es el objeto principal** (uno por fila, colgado del predio), no un conteo. Vive en `ras.*` y está **en rediseño** (parámetros del formulario + carga de árboles + conexión al geovisor).

> Cuidado con la palabra "RAS": en los diagramas del proceso de restauración aparece como el **equipo** responsable de algunas etapas; como **schema/dominio** (`ras.*`) significa **Conservación / Red de Árboles Semilleros**. Son cosas distintas.

## Estado (2026-08-12)

Diseño conceptual **completo**. En producción y con datos reales:

| Etapa | Estado |
|---|---|
| **Jurídica** (`core` + `juridica`) | 🟢 productivo desde 2026-06-19 — 111 predios cargados. Ver [`CORE_MIGRACION.md`](CORE_MIGRACION.md) |
| **SIG I** (ingesta de shapefile → `geo.zonas`) | 🟢 productivo, con **versionado por lotes** (nada se borra al resubir) |
| **Campo** (`app_campo`, PWA offline) | 🟢 **en uso con gente real**: 2 predios, evaluación + encuesta diligenciadas |
| **SIG II** (corrección de zonas en terreno) | 🟢 27 revisiones sincronizadas vía `geo.revisar_zona` |
| **Devolución a la oficina** | 🟢 la intranet muestra el mapa antes/después, la bitácora y los formularios, y **exporta a shapefile** |
| **Plan de siembra / Vivero / Ejecución** | 🔴 por construir — es el siguiente tramo del proceso |

**Migraciones SQL: ninguna pendiente** (verificado por REST el 2026-08-12). Ver [`sql/pending.sql`](sql/pending.sql).

## Orden de lectura

1. **`ARTICULACION_Y_PROYECCION.md`** — leer primero. Flujo end-to-end, las "costuras" (claves foráneas), qué falta desarrollar, el roadmap por dependencias, todas las decisiones, y el mapa de dónde está cada artefacto.
2. **`CRONOGRAMA.md`** — plan de 20 semanas, en el orden del proceso.
3. **`ARQUITECTURA_DATOS.md`** — documento maestro de **entidad-relación y parámetros** de todo el ecosistema (todas las tablas, llaves PK/FK, estado y orden para desarrollar). **Base para desarrollar masivamente.**
4. **Specs de módulo:** `../../app_vivero/CONTEXTO_MODULO_VIVERO.md`, `CONTEXTO_MODULO_SIG.md`, `../../juridica/CONTEXTO_MODULO_JURIDICO.md`, **`../../app_campo/CONTEXTO_APP_CAMPO.md` (app de campo: qué se hizo, qué falta, cómo retomar)**.
5. **`PENDIENTES_INTEGRACION.md`** — backlog vivo (incluye la cédula en PDF de jurídica, etc.).
6. **`ARQUITECTURA_ECOSISTEMA.md`** — el documento maestro (4 vistas + decisiones D1–D5).
7. **`CORE_MIGRACION.md`** — qué se implementó en la Semana 1 (modelo `core` + cutover de jurídica) y cómo está hecho. **Leer para entender el estado actual del código.**

> **Mapa visual del proceso:** [`flujo-trabajo.html`](flujo-trabajo.html) (2026-08-13) — la cadena
> completa Jurídica → SIG I → Campo → SIG II → Plan → Vivero → Ejecución dibujada con el estado real
> de cada etapa, el mecanismo del versionado SIG ↔ Campo y las cifras leídas de la base. Autocontenido,
> se abre en cualquier navegador. Es la vista de conjunto; el detalle sigue en los `.md`.
>
> La carpeta `arquitectura-visual/` (diagramas `.svg/.html` + Excel `parametros_ER.xlsx`/`cronograma_actividades.xlsx`) se eliminó (2026-06-27). Todo su contenido se consolidó en [`ARQUITECTURA_DATOS.md`](ARQUITECTURA_DATOS.md); los demás diagramas vivos son los **Mermaid embebidos** en los `.md`.

## Decisiones tomadas (resumen)

- Varios dominios conectados por interfaces; no una columna única.
- Modelo canónico `core` (aliados → predios → expedientes) para quitar duplicados.
- Geo: PostGIS como fuente de verdad; el `.zip` se desglosa a la base; geovisor lee de ahí.
- App de campo corrige las zonas (SIG II) antes del plan.
- Plan de siembra: `área × densidad × %especie × (1+reposición)` → demanda al vivero. Modelo por zona o por predio, composición en %, reposición editable.
- Vivero: app aparte, producción bajo demanda. Costeo: el costo del lote se mantiene y lo absorben las plántulas normales; el corte mensual se reparte por días-plántula (sembradas × días).
- Catálogo de especies como dato maestro.

## Siguiente paso

El tramo Jurídica → SIG → Campo → SIG II está cerrado y operando. **Lo siguiente es el Plan de siembra**
(`área del SIG × densidad × %especie × (1+reposición)` → demanda al vivero; diseñado en
[`ARQUITECTURA_DATOS.md`](ARQUITECTURA_DATOS.md) §3.4), que es lo que desbloquea Vivero y Ejecución.

Pendientes menores del tramo ya hecho, en [`PENDIENTES_INTEGRACION.md`](PENDIENTES_INTEGRACION.md):
estrenar el versionado con una subida real del SIG, revisar **Los Andes** (315 ha medidas vs 65,5 registrales),
mapa base offline (PMTiles) para la app de campo, y respaldo del `.zip` en Storage.

## Cómo trabaja este proyecto (importante para una sesión nueva)

- **Hay gente usando esto ahora.** Antes de tocar `geo.*`, la sincronización de `app_campo` o la ingesta del SIG,
  asume que hay trabajo de terreno real en juego. Ya se perdieron correcciones de campo una vez por un bug de
  ese tipo (ver `app_campo/CONTEXTO_APP_CAMPO.md` §6).
- **Nunca ejecutar DDL contra Supabase.** Las migraciones son `.sql` en `docs/sql/` que **corre el usuario** en
  el SQL Editor. Verificar por **lectura** REST sí; alterar el esquema no.
- **Verificar antes de afirmar.** Estos documentos se desactualizan; la BD es la fuente de verdad. Patrón de
  consulta REST en `SUPABASE_SCHEMAS.md`.

## Prompt para el chat nuevo

> Retomo el proyecto Amazonía Emprende. Todo el diseño está documentado. Lee `Intranet-AE/docs/EMPEZAR_AQUI.md`
> y los archivos que indica. El tramo Jurídica → SIG → Campo → SIG II ya está en producción con datos reales;
> no lo rompas. Cuéntame en qué estado está y qué sigue.
