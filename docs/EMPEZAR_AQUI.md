# Empezar aquí — Amazonía Emprende

> Punto de entrada para retomar el proyecto en una sesión nueva. Todo el diseño está en archivos; esta conversación no hace falta.

## Qué es

Ecosistema tecnológico de Amazonía Emprende: intranet, geoportal, vivero, app de campo. Un predio recorre un proceso de extremo a extremo (jurídica → SIG → campo → plan de siembra → vivero → ejecución). Supabase compartido: `lbxysovesmbgesxooghw`.

## Estado

Diseño conceptual **completo**. **Semana 1 IMPLEMENTADA y en producción (2026-06-19):** el modelo central `core` (aliados/predios/expedientes) está creado y el módulo **Jurídico ya escribe sobre él** (cutover completo, verificado con un caso real; `juridica.aliados_legacy` ya borrada). Qué se hizo y cómo: [`CORE_MIGRACION.md`](CORE_MIGRACION.md). Lo que sigue es continuar conectando el proceso aguas abajo de jurídica.

## Orden de lectura

1. **`ARTICULACION_Y_PROYECCION.md`** — leer primero. Flujo end-to-end, las "costuras" (claves foráneas), qué falta desarrollar, el roadmap por dependencias, todas las decisiones, y el mapa de dónde está cada artefacto.
2. **`CRONOGRAMA.md`** — plan de 20 semanas, en el orden del proceso. Versión para presentar: `../../arquitectura-visual/cronograma_actividades.xlsx`.
3. **`../../arquitectura-visual/parametros_ER.xlsx`** — tablas, parámetros y llaves (PK/FK), una hoja por módulo: Jurídica, SIG, Campo, Campo_SIG, Plan, Vivero, Relaciones, Leyenda.
4. **Specs de módulo:** `../../app_vivero/CONTEXTO_MODULO_VIVERO.md`, `CONTEXTO_MODULO_SIG.md`, `../../juridica/CONTEXTO_MODULO_JURIDICO.md`.
5. **Diagramas:** `../../arquitectura-visual/*.html` (abrir en el navegador): proceso, geo, Campo, Campo_SIG, Plan, Vivero, juridica, ecosistema-datos, ecosistema-conexiones, cronograma.
6. **`PENDIENTES_INTEGRACION.md`** — backlog vivo (incluye la cédula en PDF de jurídica, etc.).
7. **`ARQUITECTURA_ECOSISTEMA.md`** — el documento maestro (4 vistas + decisiones D1–D5).
8. **`CORE_MIGRACION.md`** — qué se implementó en la Semana 1 (modelo `core` + cutover de jurídica) y cómo está hecho. **Leer para entender el estado actual del código.**

## Decisiones tomadas (resumen)

- Varios dominios conectados por interfaces; no una columna única.
- Modelo canónico `core` (aliados → predios → expedientes) para quitar duplicados.
- Geo: PostGIS como fuente de verdad; el `.zip` se desglosa a la base; geovisor lee de ahí.
- App de campo corrige las zonas (SIG II) antes del plan.
- Plan de siembra: `área × densidad × %especie × (1+reposición)` → demanda al vivero. Modelo por zona o por predio, composición en %, reposición editable.
- Vivero: app aparte, producción bajo demanda. Costeo: el costo del lote se mantiene y lo absorben las plántulas normales; el corte mensual se reparte por días-plántula (sembradas × días).
- Catálogo de especies como dato maestro.

## Siguiente paso

**Semana 1 (core + jurídica) — HECHA y en producción.** Lo que sigue en Fase 1 del cronograma: **conectar el campo/siembra y la conservación al `core`** — que la evaluación de campo cuelgue de `core.expedientes` (la pelota llega desde jurídica vía `crear-en-siembra`, que ya crea la familia enlazada al expediente) y que conservación referencie `core.predios` en lugar de recopiar. Estado vivo: [`PENDIENTES_INTEGRACION.md`](PENDIENTES_INTEGRACION.md).

## Prompt para el chat nuevo

> Retomo el proyecto Amazonía Emprende. Todo el diseño está documentado. Lee `Intranet-AE/docs/EMPEZAR_AQUI.md` y los archivos que indica. Vamos a empezar la implementación por la Semana 1 del cronograma: el modelo central `core` (aliados, predios, expedientes) y el mapeo de migración desde las tablas actuales.
