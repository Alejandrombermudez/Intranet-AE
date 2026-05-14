-- ============================================================
-- SQL Pendiente — Intranet AE
-- Última revisión: Mayo 2026
--
-- REGLA: solo están aquí cosas que NO se han podido verificar
-- vía REST API. Una vez ejecutadas, mover al historial abajo.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- PENDIENTE — ejecutar en Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════

-- ── Migración schemas people + fleet ─────────────────────────────────────────
-- Estado: LISTO — código ya actualizado, falta ejecutar el SQL y el paso en Dashboard
-- Script completo: docs/sql/migration_schemas_people_fleet.sql
-- Guía paso a paso: docs/GUIA_MIGRACION_SCHEMAS.md
--
-- PASO PREVIO OBLIGATORIO (manual, en Supabase Dashboard):
--   Settings → API → Extra schemas → agregar: people, fleet
--
-- El script incluye: triggers auth.users, ALTER TABLE SET SCHEMA, GRANTs, backfill


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
-- ── 2026-05  ras.monitoreos ──────────────────────────────────────────────────
-- (Ver SQL completo en SUPABASE_SCHEMAS.md)
