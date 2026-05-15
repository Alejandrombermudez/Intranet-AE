-- ============================================================
-- LIMPIEZA: Eliminar tabla user_profiles duplicada en public
-- Proyecto: Intranet Amazonia Emprende
-- Fecha: Mayo 2026
--
-- Contexto: la tabla fue movida a people.user_profiles mediante
-- migration_schemas_people_fleet.sql (ALTER TABLE ... SET SCHEMA).
-- Si public.user_profiles aún existe, es un residuo que puede
-- causar confusión y queries en el schema equivocado.
--
-- EJECUTAR en Supabase → SQL Editor
-- ============================================================

-- Eliminar tabla residual (CASCADE por si hay FKs obsoletas apuntando a ella)
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Verificación: no debe devolver 'public | user_profiles'
SELECT schemaname, tablename
FROM pg_tables
WHERE tablename = 'user_profiles'
ORDER BY schemaname;
-- Resultado esperado: solo  people | user_profiles
