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

-- ── migration_modulo_juridico.sql ─────────────────────────────────────────────
-- Estado: LISTO PARA EJECUTAR — código aún no implementado en la app
-- Script: docs/sql/migration_modulo_juridico.sql
-- Contexto funcional: ../juridica/CONTEXTO_MODULO_JURIDICO.md
--
-- PASO PREVIO MANUAL (Supabase Dashboard):
--   Settings → API → Extra schemas → agregar: juridica
--
-- PASO POSTERIOR MANUAL (Supabase Dashboard):
--   Storage → New bucket: juridica-documentos (PRIVADO)
--   Aplicar las 4 policies que están al final del script
--
-- Crea:
--   - schema 'juridica'
--   - juridica.aliados (12 campos básicos + manifestación + workflow estado)
--   - juridica.antecedentes (14 listas restrictivas + PEP + prensa)
--   - juridica.analisis_juridico (folio matrícula + semáforo)
--   - siembra.familias.aliado_id (FK opcional para prellenado)


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
-- (Ver SQL completo en SUPABASE_SCHEMAS.md)
