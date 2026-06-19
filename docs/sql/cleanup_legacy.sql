-- ============================================================
--  LIMPIEZA: eliminar la tabla archivada del cutover a core
--  Archivo: docs/sql/cleanup_legacy.sql
--  Fecha  : 2026-06-18
--
--  Correr en Supabase → SQL Editor DESPUÉS de verificar que el
--  cutover a core funciona (ya verificado por REST: 2026-06-18).
--
--  juridica.aliados_legacy era el modelo viejo (persona+predio
--  mezclados), con 2 filas de PRUEBA. Ya nada la referencia
--  (antecedentes→core.aliados, analisis_juridico→core.predios,
--   siembra.familias.aliado_id→core.aliados).
-- ============================================================

DROP TABLE IF EXISTS juridica.aliados_legacy;

NOTIFY pgrst, 'reload schema';

-- Verificación: no debe devolver filas
SELECT tablename FROM pg_tables
WHERE schemaname = 'juridica' AND tablename = 'aliados_legacy';
