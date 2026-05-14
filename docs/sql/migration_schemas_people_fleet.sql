-- ============================================================
-- MIGRACIÓN: Schemas people + fleet
-- Proyecto: Intranet Amazonia Emprende
-- Fecha: Mayo 2026
-- Estado: LISTO PARA EJECUTAR en Supabase → SQL Editor
--
-- INCLUYE TAMBIÉN: triggers auth.users (de pending.sql)
--
-- ORDEN DE EJECUCIÓN:
--   1. Paso previo en Supabase Dashboard (ver guía)
--   2. Este script completo en SQL Editor
--   3. Verificación al final
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — Triggers auth → people.user_profiles
-- (antes de mover la tabla se crea la función actualizada)
-- ════════════════════════════════════════════════════════════

-- Función sync apunta directamente al schema definitivo
CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, people AS $$
BEGIN
  INSERT INTO people.user_profiles (email, full_name, last_login)
  VALUES (
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name',''), NULLIF(NEW.raw_user_meta_data->>'name','')),
    COALESCE(NEW.last_sign_in_at, NOW())
  )
  ON CONFLICT (email) DO UPDATE SET
    full_name  = COALESCE(EXCLUDED.full_name, people.user_profiles.full_name),
    last_login = EXCLUDED.last_login;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created  ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_profile();

DROP TRIGGER IF EXISTS on_auth_user_signed_in ON auth.users;
CREATE TRIGGER on_auth_user_signed_in
  AFTER UPDATE OF last_sign_in_at ON auth.users FOR EACH ROW
  WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
  EXECUTE FUNCTION public.sync_user_profile();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — Crear schemas
-- ════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS people;
CREATE SCHEMA IF NOT EXISTS fleet;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — Mover tablas
-- Las RLS policies y sequences se transfieren automáticamente.
-- Los FK entre vehicle_reservations ↔ vehicle_inspections
-- se preservan porque ambas van al mismo schema (fleet).
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.user_profiles        SET SCHEMA people;
ALTER TABLE public.vehicle_reservations SET SCHEMA fleet;
ALTER TABLE public.vehicle_inspections  SET SCHEMA fleet;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — GRANTs en nuevos schemas
-- ════════════════════════════════════════════════════════════

-- Schema people
GRANT USAGE ON SCHEMA people TO anon, authenticated, service_role;
GRANT ALL   ON ALL TABLES    IN SCHEMA people TO anon, authenticated, service_role;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA people TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA people
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA people
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Schema fleet
GRANT USAGE ON SCHEMA fleet TO anon, authenticated, service_role;
GRANT ALL   ON ALL TABLES    IN SCHEMA fleet TO anon, authenticated, service_role;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA fleet TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA fleet
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA fleet
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — Backfill usuarios existentes sin perfil
-- (complemento al trigger; seguro correr múltiples veces)
-- ════════════════════════════════════════════════════════════

INSERT INTO people.user_profiles (email, full_name, last_login)
SELECT u.email,
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name',''), NULLIF(u.raw_user_meta_data->>'name','')),
  COALESCE(u.last_sign_in_at, u.created_at)
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM people.user_profiles p WHERE p.email = u.email);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 — Verificación
-- ════════════════════════════════════════════════════════════

-- Debe devolver 3 filas con los schemas correctos:
SELECT schemaname, tablename
FROM pg_tables
WHERE tablename IN ('user_profiles', 'vehicle_reservations', 'vehicle_inspections')
ORDER BY tablename;
-- Esperado:
--   fleet  | vehicle_inspections
--   fleet  | vehicle_reservations
--   people | user_profiles

-- Triggers activos:
SELECT trigger_name, event_object_schema, event_object_table
FROM information_schema.triggers
WHERE trigger_name IN ('on_auth_user_created', 'on_auth_user_signed_in');
-- Esperado: 2 filas sobre auth.users
