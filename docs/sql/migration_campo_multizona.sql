-- ============================================================
--  Migración: Soporte multi-zona + metadatos PWA
--  Tabla   : siembra.evaluaciones_campo
--  Archivo : docs/sql/migration_campo_multizona.sql
--  Ejecutar: Supabase SQL Editor (producción)
--  Creado  : Abril 2026
-- ============================================================
-- PREREQUISITO: Ejecutar migration_encuesta_predial.sql primero
-- para que la tabla siembra.evaluaciones_campo exista.
-- ============================================================

-- ─── Agregar columnas para PWA offline ───────────────────────────────────────
ALTER TABLE siembra.evaluaciones_campo
  ADD COLUMN IF NOT EXISTS local_id        TEXT UNIQUE,        -- UUID generado en cliente
  ADD COLUMN IF NOT EXISTS num_zonas_eval  INT  DEFAULT 1,     -- cantidad de zonas evaluadas
  ADD COLUMN IF NOT EXISTS zonas_data      JSONB DEFAULT '[]', -- array ZonaData[]
  ADD COLUMN IF NOT EXISTS seccion_1_data  JSONB,              -- §1 Identificación completo
  ADD COLUMN IF NOT EXISTS seccion_2_data  JSONB,              -- §2 Cartografía Social
  ADD COLUMN IF NOT EXISTS seccion_6_data  JSONB,              -- §6 Riesgos
  ADD COLUMN IF NOT EXISTS firma_eval1_url TEXT,               -- URL bucket campo-fotos
  ADD COLUMN IF NOT EXISTS firma_eval2_url TEXT,
  ADD COLUMN IF NOT EXISTS firma_prop_url  TEXT,
  ADD COLUMN IF NOT EXISTS nombre_predio   TEXT,
  ADD COLUMN IF NOT EXISTS step_completed  INT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sync_origin     TEXT DEFAULT 'pwa'; -- 'pwa' | 'intranet'

-- ─── RLS para acceso anónimo (la PWA no usa auth) ────────────────────────────
-- NOTA: Las políticas autenticadas ya existen de la migración anterior.

CREATE POLICY "anon_insert_evaluaciones" ON siembra.evaluaciones_campo
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_update_evaluaciones" ON siembra.evaluaciones_campo
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_evaluaciones" ON siembra.evaluaciones_campo
  FOR SELECT TO anon USING (true);

-- ─── Permisos ─────────────────────────────────────────────────────────────────
-- CRÍTICO: sin GRANT USAGE el anon recibe "permission denied for schema siembra"
-- aunque las políticas RLS existan.
GRANT USAGE ON SCHEMA siembra TO anon;
GRANT INSERT, UPDATE, SELECT ON siembra.evaluaciones_campo TO anon;

-- ─── Storage bucket campo-fotos ──────────────────────────────────────────────
-- Ejecutar manualmente en Supabase Dashboard → Storage → New bucket:
--   Nombre: campo-fotos
--   Público: true
-- Luego agregar las siguientes políticas en Storage → campo-fotos → Policies:
--
-- INSERT (anon):
--   CREATE POLICY "anon_upload_campo" ON storage.objects
--     FOR INSERT TO anon WITH CHECK (bucket_id = 'campo-fotos');
--
-- SELECT (anon):
--   CREATE POLICY "anon_read_campo" ON storage.objects
--     FOR SELECT TO anon USING (bucket_id = 'campo-fotos');
