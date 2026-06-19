-- ============================================================
-- SQL Pendiente — Intranet AE
-- Última revisión: Mayo 2026 (verificado contra BD real)
--
-- REGLA: solo están aquí cosas que NO se han podido verificar
-- vía REST API. Una vez ejecutadas, mover al historial abajo.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- PENDIENTE — ejecutar en Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════

-- ── migration_core.sql ─────────────────────────────────────────────────────────
-- Estado: LISTO PARA EJECUTAR — código de la app YA reescrito y compilando
-- Script: docs/sql/migration_core.sql
-- Contexto + mapeo: docs/CORE_MIGRACION.md
--
-- PASO MANUAL (Supabase Dashboard), DESPUÉS de correr el SQL:
--   Settings → API → Exposed schemas → agregar: core
--
-- Crea el núcleo canónico y hace el cutover de jurídica:
--   - schema 'core': aliados (persona) · predios · predio_propietarios · expedientes
--   - juridica.debida_diligencia (workflow DD + manifestación + predial + cedula_url)
--   - repunta juridica.antecedentes → core.aliados ; analisis_juridico → core.predios
--   - archiva juridica.aliados como juridica.aliados_legacy (reversible, no borra)
--   - engancha siembra.familias (aliado_id→core, +expediente_id) y ras.familias
-- OJO: los datos de prueba en antecedentes/analisis se TRUNCAN (no eran producción).


-- ════════════════════════════════════════════════════════════
-- HISTORIAL — ya ejecutado en producción
-- ════════════════════════════════════════════════════════════

-- ── 2026-03  Schemas siembra + ras + tablas base ─────────────────────────────
-- ── 2026-03  GRANTs siembra + ras ────────────────────────────────────────────
-- ── 2026-04  siembra.familias ampliada (datos CSV) ───────────────────────────
-- ── 2026-04  ras.familias ampliada (socioeconómicos) ─────────────────────────
-- ── 2026-04  ras.familias columnas conservación ──────────────────────────────
-- ── 2026-04  siembra.fotos_predio + ras.fotos_predio creadas ─────────────────
-- ── 2026-04  public.consentimientos + RLS ────────────────────────────────────
-- ── 2026-04  public.user_profiles.can_access_intranet ────────────────────────
-- ── 2026-04  public.vehicle_inspections.kilometraje ──────────────────────────
-- ── 2026-05  siembra.predios + siembra.evaluaciones_campo ────────────────────
-- ── 2026-05  migration_campo_multizona.sql (PWA offline + anon RLS) ──────────
-- ── 2026-05  ras.monitoreos ──────────────────────────────────────────────────
-- ── 2026-05  migration_schemas_people_fleet.sql ───────────────────────────────
--             (schemas people + fleet creados, tablas movidas, triggers auth.users)
-- ── 2026-05  migration_ejecutivo.sql (schema ejecutivo, sesiones, indicaciones)
-- ── 2026-05  migration_ejecutivo_v2.sql (columna nota + estado rechazado)
-- ── 2026-05  fleet.vehicle_documents creada (4 filas — una por vehículo)
-- ── 2026-05  migration_modulo_juridico.sql (schema juridica + 3 tablas + bucket)
--             Confirmado en BD: schema juridica vivo, bucket juridica-documentos (privado),
--             usuario legal@amazoniaemprende.com (department=Juridica). Los datos eran de prueba.
-- (Ver SQL completo en SUPABASE_SCHEMAS.md)
