-- ============================================================
-- SQL — Intranet AE
-- Última revisión: Abril 2026
-- ============================================================
-- REGLA: cada bloque ejecutado se mueve al historial (al final).
-- Los bloques activos son los únicos que deben correrse.
-- Todo lo activo usa IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS
-- para que sea seguro volver a ejecutar sin error.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- PENDIENTE — ejecutar en Supabase → SQL Editor
-- ════════════════════════════════════════════════════════════


-- ── [PENDIENTE] Nueva columna user_profiles.can_access_intranet ──────────────
-- Controla si el usuario ve el botón "Intranet" en el calendario.
-- Independiente de is_admin: permite acceder al módulo propio sin ver el panel admin.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS can_access_intranet BOOLEAN NOT NULL DEFAULT FALSE;


-- ── [PENDIENTE] Trigger auto-sync auth.users → public.user_profiles ──────────
-- Motivo: el perfil solo se guardaba desde JS del cliente en el auth callback.
-- Si el usuario cierra la ventana o hay error de red, el registro se pierde.
-- Este trigger corre dentro de Postgres — no depende del cliente.
--
-- Es seguro ejecutar múltiples veces (CREATE OR REPLACE + DROP IF EXISTS).

-- 1. Función que hace el upsert
CREATE OR REPLACE FUNCTION public.sync_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (email, full_name, last_login)
  VALUES (
    NEW.email,
    -- Azure AD puede enviar el nombre en 'full_name' o en 'name'
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name',      '')
    ),
    COALESCE(NEW.last_sign_in_at, NOW())
  )
  ON CONFLICT (email) DO UPDATE SET
    -- Solo sobreescribe full_name si el nuevo valor no es nulo
    full_name  = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
    last_login = EXCLUDED.last_login;
  RETURN NEW;
END;
$$;

-- 2. Trigger para usuarios NUEVOS (primer login — INSERT en auth.users)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_profile();

-- 3. Trigger para logins subsiguientes (last_sign_in_at cambia en cada login)
DROP TRIGGER IF EXISTS on_auth_user_signed_in ON auth.users;
CREATE TRIGGER on_auth_user_signed_in
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
  EXECUTE FUNCTION public.sync_user_profile();

-- 4. Backfill: crear perfiles para usuarios que ya existen en auth.users
--    pero no tienen fila en user_profiles todavía.
INSERT INTO public.user_profiles (email, full_name, last_login)
SELECT
  u.email,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'name',      '')
  ),
  COALESCE(u.last_sign_in_at, u.created_at)
FROM auth.users u
WHERE u.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles p WHERE p.email = u.email
  );


-- ── [OPCIONAL] Migración schemas legacy ──────────────────────────────────────
-- Mueve tablas de `public` a schemas propios.
-- ADVERTENCIA: Rompe cualquier código que referencie public.user_profiles,
--              public.vehicle_reservations, public.vehicle_inspections.
--              Actualizar todas las consultas ANTES de ejecutar.
-- Estado: En evaluación — no ejecutar sin revisar impacto en fleet module.

/*
CREATE SCHEMA IF NOT EXISTS people;
CREATE SCHEMA IF NOT EXISTS fleet;

ALTER TABLE public.user_profiles        SET SCHEMA people;
ALTER TABLE public.vehicle_reservations SET SCHEMA fleet;
ALTER TABLE public.vehicle_inspections  SET SCHEMA fleet;
*/


-- ════════════════════════════════════════════════════════════
-- HISTORIAL — bloques ya ejecutados en producción
-- (Solo documentación — NO volver a ejecutar)
-- ════════════════════════════════════════════════════════════

-- ── 2026-03-25  Creación schemas siembra + ras ───────────────────────────────
-- Ver SQL completo en SUPABASE_SCHEMAS.md

-- ── 2026-03-25  GRANTs schemas siembra y ras ────────────────────────────────
/*
GRANT USAGE ON SCHEMA ras TO anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON ALL TABLES IN SCHEMA ras TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA ras TO authenticated, service_role;

GRANT USAGE ON SCHEMA siembra TO anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON ALL TABLES IN SCHEMA siembra TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA siembra TO authenticated, service_role;
*/

-- ── 2026-04  Ampliación siembra.familias (datos del CSV) ────────────────────
/*
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS tipo_documento          TEXT;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS numero_documento        TEXT;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS telefono                TEXT;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS nucleo                  TEXT;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS departamento            TEXT;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS cant_mujeres            INT DEFAULT 0;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS cant_hombres            INT DEFAULT 0;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS actividad_economica     TEXT;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS tiene_espacio_vegetal   BOOLEAN DEFAULT FALSE;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS num_individuos          INT DEFAULT 0;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS num_especies_inventario INT DEFAULT 0;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS area_bosque_recorrida   NUMERIC;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS distancia_florencia_km  NUMERIC;
ALTER TABLE siembra.familias ADD COLUMN IF NOT EXISTS tiempo_florencia_min    INT;
*/

-- ── 2026-04  Columnas faltantes en ras.familias ──────────────────────────────
/*
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS shapefile_conservacion_url TEXT;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS acuerdo_conservacion       BOOLEAN DEFAULT FALSE;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS bajo_conservacion          BOOLEAN DEFAULT FALSE;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS arboles_semilleros         INT DEFAULT 0;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS especies_forestales        INT DEFAULT 0;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS otros_indices              TEXT;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS ha_potreros                NUMERIC;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS ha_bosque                  NUMERIC;
ALTER TABLE ras.familias ADD COLUMN IF NOT EXISTS ha_otras                   NUMERIC;
*/

-- ── 2026-04  Tabla de consentimientos — Módulo Financiero ────────────────────
/*
CREATE TABLE public.consentimientos (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre             TEXT NOT NULL,
  apellido           TEXT NOT NULL,
  cedula             TEXT NOT NULL,
  celular            TEXT NOT NULL,
  correo             TEXT NOT NULL,
  acepta_tratamiento BOOLEAN NOT NULL DEFAULT TRUE,
  acepta_politicas   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.consentimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_consentimientos"
  ON public.consentimientos FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "auth_read_consentimientos"
  ON public.consentimientos FOR SELECT TO authenticated USING (true);
*/
