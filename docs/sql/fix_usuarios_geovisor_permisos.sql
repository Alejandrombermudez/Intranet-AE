-- ============================================================
-- Permisos de people.usuarios_geovisor — corrección
-- Fecha: 2026-10-14
--
-- Verificado por REST el 2026-10-14: la tabla existe, pero con la key pública
-- (anon) se puede CONSULTAR sin error de permiso (devuelve 0 filas). Las demás
-- tablas cerradas del proyecto responden «permission denied» (42501). Lo más
-- probable es que el REVOKE del final de migration_usuarios_geovisor.sql no se
-- haya corrido. Mientras RLS esté encendido sin políticas, anon no ve ninguna
-- fila; esto cierra además el permiso, como estaba previsto.
--
-- Repetible. Lo corre el usuario en el SQL Editor.
-- ============================================================

ALTER TABLE people.usuarios_geovisor ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON people.usuarios_geovisor FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON people.usuarios_geovisor TO service_role;

-- Verificación: la primera debe decir true; la segunda no debe devolver filas.
select relrowsecurity from pg_class where oid = 'people.usuarios_geovisor'::regclass;
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'people' and table_name = 'usuarios_geovisor'
   and grantee in ('anon', 'authenticated', 'PUBLIC');
