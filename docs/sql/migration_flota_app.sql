-- ════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: App de flota (vehículos + calendario por horas), fuera de la intranet
-- Fecha: 2026-11-03
--
-- La app nueva vive en D:\AMAZONIA EMPRENDE\flota_app. Entra por nombre + PIN de
-- 4 dígitos (sin Microsoft 365 ni Supabase Auth) y reserva por HORAS.
--
-- Qué hace:
--   1. fleet.conductores   — la lista de quienes usan la flota (con o sin correo),
--                            con el PIN guardado como huella (scrypt), nunca en claro.
--                            Solo service_role la toca: anon y authenticated, sin acceso.
--   2. fleet.vehicle_reservations — agrega inicio/fin con hora (start_at / end_at),
--                            quién reserva (conductor_id) y las marcas de la tarjeta
--                            de propiedad: la recibió quien hizo el check in y la
--                            entregó quien hizo el check out.
--   3. Siembra la lista inicial de conductores.
--
-- NO borra ni cambia nada de lo que ya existe: start_date / end_date siguen ahí y la
-- app nueva los escribe también, así el calendario viejo de la intranet sigue
-- funcionando hasta que se retire. Las 38 reservas existentes se pasan a horas
-- tomando el día completo (de 00:00 del primer día a 24:00 del último).
--
-- Todo es idempotente y sin BEGIN/COMMIT (el editor de Supabase no protege con ellos):
-- se puede correr dos veces.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Conductores ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fleet.conductores (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre         TEXT NOT NULL,
  email          TEXT,                         -- opcional: hay quien no tiene correo
  pin_hash       TEXT,                         -- NULL = todavía no ha creado su PIN
  es_admin       BOOLEAN NOT NULL DEFAULT FALSE,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  intentos       INT NOT NULL DEFAULT 0,       -- PIN errados seguidos
  bloqueado_hasta TIMESTAMPTZ,                 -- tras 5 errados, unos minutos de espera
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS conductores_nombre_uq ON fleet.conductores (lower(btrim(nombre)));
CREATE UNIQUE INDEX IF NOT EXISTS conductores_email_uq  ON fleet.conductores (lower(email)) WHERE email IS NOT NULL;

COMMENT ON TABLE fleet.conductores IS
  'Quienes usan la flota. PIN de 4 dígitos como huella scrypt. Solo service_role: la lee la API de flota_app.';

ALTER TABLE fleet.conductores ENABLE ROW LEVEL SECURITY;
-- Los privilegios por defecto del schema fleet le dan acceso a anon y authenticated; aquí hay huellas de PIN.
REVOKE ALL ON fleet.conductores FROM anon, authenticated;
GRANT  ALL ON fleet.conductores TO service_role;


-- ── 2. Reservas por horas + tarjeta de propiedad ────────────────────────────
ALTER TABLE fleet.vehicle_reservations ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE fleet.vehicle_reservations ADD COLUMN IF NOT EXISTS end_at   TIMESTAMPTZ;
ALTER TABLE fleet.vehicle_reservations ADD COLUMN IF NOT EXISTS conductor_id UUID
  REFERENCES fleet.conductores(id) ON DELETE SET NULL;
ALTER TABLE fleet.vehicle_reservations ADD COLUMN IF NOT EXISTS tarjeta_recibida_at   TIMESTAMPTZ;  -- check in: «Recibí la tarjeta de propiedad»
ALTER TABLE fleet.vehicle_reservations ADD COLUMN IF NOT EXISTS tarjeta_entregada_at  TIMESTAMPTZ;  -- check out: «Entregué la tarjeta de propiedad»

-- Reservas anteriores: el día completo, hora de Colombia (UTC-5, sin cambio de hora).
UPDATE fleet.vehicle_reservations
   SET start_at = (start_date::timestamp) AT TIME ZONE 'America/Bogota'
 WHERE start_at IS NULL;

UPDATE fleet.vehicle_reservations
   SET end_at = ((end_date + 1)::timestamp) AT TIME ZONE 'America/Bogota'
 WHERE end_at IS NULL;

-- Mientras el calendario viejo de la intranet siga vivo, sus reservas nuevas llegan solo con
-- fechas: este disparador les pone el día completo para que la app nueva también las vea.
CREATE OR REPLACE FUNCTION fleet.fn_reserva_horas() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.start_at IS NULL AND NEW.start_date IS NOT NULL THEN
    NEW.start_at := (NEW.start_date::timestamp) AT TIME ZONE 'America/Bogota';
  END IF;
  IF NEW.end_at IS NULL AND NEW.end_date IS NOT NULL THEN
    NEW.end_at := ((NEW.end_date + 1)::timestamp) AT TIME ZONE 'America/Bogota';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reserva_horas ON fleet.vehicle_reservations;
CREATE TRIGGER trg_reserva_horas BEFORE INSERT OR UPDATE ON fleet.vehicle_reservations
  FOR EACH ROW EXECUTE FUNCTION fleet.fn_reserva_horas();

CREATE INDEX IF NOT EXISTS vehicle_reservations_vehiculo_horas_idx
  ON fleet.vehicle_reservations (vehicle_id, start_at, end_at);


-- ── 3. Lista inicial ────────────────────────────────────────────────────────
-- Se toma de quienes ya tienen cuenta corporativa en la intranet (people.user_profiles), sin
-- escribir nombres ni correos aquí: este archivo también vive en un repo público.
-- Se excluye la cuenta genérica de comunicaciones. Quienes no tienen correo (y cualquiera
-- que falte) se agregan desde la propia app, pestaña «Personas».
INSERT INTO fleet.conductores (nombre, email)
SELECT btrim(regexp_replace(full_name, '\s+', ' ', 'g')), lower(btrim(email))
  FROM people.user_profiles
 WHERE lower(email) LIKE '%@amazoniaemprende.com'
   AND lower(email) <> 'comunicaciones@amazoniaemprende.com'
   AND btrim(coalesce(full_name, '')) <> ''
ON CONFLICT DO NOTHING;

-- Primer administrador de la app (quien después agrega gente y reinicia PIN). Cámbialo por tu nombre
-- tal como quedó en fleet.conductores y corre solo esta sentencia:
--   UPDATE fleet.conductores SET es_admin = TRUE WHERE nombre = 'Tu Nombre Completo';

-- Enlazar las reservas que ya existen con su conductor, por correo.
UPDATE fleet.vehicle_reservations r
   SET conductor_id = c.id
  FROM fleet.conductores c
 WHERE r.conductor_id IS NULL
   AND lower(r.user_email) = lower(c.email);


-- ── Verificación (solo lectura) ─────────────────────────────────────────────
--   SELECT nombre, email, es_admin, pin_hash IS NOT NULL AS tiene_pin FROM fleet.conductores ORDER BY nombre;
--   SELECT count(*) AS sin_horas  FROM fleet.vehicle_reservations WHERE start_at IS NULL OR end_at IS NULL;   -- 0
--   SELECT count(*) AS sin_conductor FROM fleet.vehicle_reservations WHERE conductor_id IS NULL;
