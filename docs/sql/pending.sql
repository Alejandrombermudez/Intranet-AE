-- ============================================================
-- SQL PENDIENTE DE EJECUCIÓN — Intranet AE
-- Última revisión: Marzo 2026
-- ============================================================
-- Estos bloques NO han sido ejecutados aún.
-- Ejecutarlos en Supabase → SQL Editor en el orden indicado.
-- Revisar cada bloque antes de ejecutar — algunos son destructivos.
-- ============================================================


-- ── [OPCIONAL] Migración schemas legacy ─────────────────────
-- Mueve tablas de `public` a schemas propios.
-- ADVERTENCIA: Rompe cualquier código que referencie public.user_profiles,
--              public.vehicle_reservations, public.vehicle_inspections.
--              Actualizar todas las consultas en la app ANTES de ejecutar.
-- Estado: En evaluación — no ejecutar sin revisar impacto en fleet module.

/*
CREATE SCHEMA IF NOT EXISTS people;
CREATE SCHEMA IF NOT EXISTS fleet;

ALTER TABLE public.user_profiles        SET SCHEMA people;
ALTER TABLE public.vehicle_reservations SET SCHEMA fleet;
ALTER TABLE public.vehicle_inspections  SET SCHEMA fleet;
*/


-- ── [FUTURO] Nuevas columnas / tablas según evolución del proyecto ──
-- Agregar aquí cada nuevo ALTER TABLE o CREATE TABLE con su fecha.

-- ── Historial de migraciones ejecutadas ──────────────────────────────────────
-- 2026-03-25  Creación schemas siembra + ras  ✅ ejecutado (ver SUPABASE_SCHEMAS.md)

-- ── [PENDIENTE] Columnas faltantes en ras.familias ──────────────────────────
-- La tabla fue creada antes de que se definieran todas las columnas del módulo
-- conservación. Ejecutar TODO el bloque junto:

ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS shapefile_conservacion_url TEXT;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS acuerdo_conservacion       BOOLEAN DEFAULT FALSE;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS bajo_conservacion          BOOLEAN DEFAULT FALSE;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS arboles_semilleros         INT DEFAULT 0;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS especies_forestales        INT DEFAULT 0;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS otros_indices              TEXT;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS ha_potreros                NUMERIC;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS ha_bosque                  NUMERIC;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS ha_otras                   NUMERIC;


-- ── [PENDIENTE] Permisos en schemas personalizados ────────────────────────────
-- Error: permission denied for table familias
-- Causa: Supabase NO otorga permisos automáticamente en schemas distintos a public.
-- Se necesita GRANT USAGE en el schema + permisos en tablas ADEMÁS de las políticas RLS.
-- Ejecutar para AMBOS schemas:

GRANT USAGE ON SCHEMA ras TO anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON ALL TABLES IN SCHEMA ras TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA ras TO authenticated, service_role;

GRANT USAGE ON SCHEMA siembra TO anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON ALL TABLES IN SCHEMA siembra TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA siembra TO authenticated, service_role;
