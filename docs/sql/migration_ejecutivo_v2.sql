-- ============================================================
-- MIGRACIÓN v2: Schema ejecutivo — nota + estado rechazado
-- Proyecto: Intranet Amazonia Emprende
-- Mayo 2026
-- ============================================================
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de migration_ejecutivo.sql

-- 1. Columna nota para registrar razón de rechazo o cancelación
ALTER TABLE ejecutivo.indicaciones
  ADD COLUMN IF NOT EXISTS nota TEXT;

-- 2. Ampliar CHECK de estado para incluir 'rechazado'
ALTER TABLE ejecutivo.indicaciones
  DROP CONSTRAINT IF EXISTS indicaciones_estado_check;

ALTER TABLE ejecutivo.indicaciones
  ADD CONSTRAINT indicaciones_estado_check
  CHECK (estado IN ('pendiente', 'hecho', 'marcado', 'confirmado', 'cancelado', 'rechazado'));

-- 3. Recargar cache de PostgREST
NOTIFY pgrst, 'reload schema';
