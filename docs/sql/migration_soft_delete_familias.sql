-- ============================================================
-- Migration: soft delete para siembra.familias
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar columna deleted_at (null = activa, not null = eliminada)
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Índice parcial para acelerar consultas de familias activas
CREATE INDEX IF NOT EXISTS idx_familias_activas
  ON siembra.familias(created_at DESC)
  WHERE deleted_at IS NULL;

-- 3. Índice para la vista de eliminadas
CREATE INDEX IF NOT EXISTS idx_familias_eliminadas
  ON siembra.familias(deleted_at DESC)
  WHERE deleted_at IS NOT NULL;
