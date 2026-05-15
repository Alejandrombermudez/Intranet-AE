-- ============================================================
-- FIX: RLS policies en people.user_profiles
-- Proyecto: Intranet Amazonia Emprende
-- Fecha: Mayo 2026
--
-- Problema: al mover la tabla de public→people con ALTER TABLE SET SCHEMA,
-- las políticas RLS no siempre se transfieren correctamente, dejando la
-- tabla con RLS habilitado pero sin política SELECT para autenticados.
-- Resultado: el query de la landing page devuelve null → botón Intranet
-- no aparece aunque el registro existe con is_admin=TRUE.
--
-- EJECUTAR en Supabase → SQL Editor
-- ============================================================

-- 1. Habilitar RLS (idempotente si ya está habilitado)
ALTER TABLE people.user_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Política SELECT: cualquier usuario autenticado puede leer perfiles
--    (herramienta interna — todos los que acceden ya están autenticados con MS365)
DROP POLICY IF EXISTS "read_all_authenticated" ON people.user_profiles;
CREATE POLICY "read_all_authenticated"
  ON people.user_profiles FOR SELECT
  TO authenticated, anon
  USING (true);

-- 3. Política completa para service_role (API routes del servidor)
DROP POLICY IF EXISTS "service_role_all" ON people.user_profiles;
CREATE POLICY "service_role_all"
  ON people.user_profiles FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 4. Verificación: deben aparecer estas 2 políticas
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'people' AND tablename = 'user_profiles'
ORDER BY policyname;
