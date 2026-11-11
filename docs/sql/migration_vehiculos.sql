-- ════════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Vehículos dentro de la intranet (/vehiculos), 2026-11-11
--
-- Va DESPUÉS de migration_flota_app.sql (corrida el 2026-11-08: fleet.conductores,
-- start_at/end_at en las reservas). La app aparte (vehiculos_app) no se desplegó: todo
-- vive ahora en /vehiculos de la intranet, sin entrar a la intranet.
--
-- Qué hace:
--   1. fleet.vehiculos — cada vehículo con su foto, la foto de la tarjeta de propiedad
--      (la gente la muestra desde el celular; la tarjeta física ya no circula) y los
--      vencimientos del SOAT y la tecnomecánica. Ids iguales a los de las reservas.
--   2. fleet.conductores.pin_temporal — el PIN que pone administración es de una sola
--      vez: al entrar con él, la persona tiene que crear el suyo.
--   3. fleet.vehicle_reservations.tomado_at / devuelto_at — la hora real en que se tomó
--      (al leer el QR del vehículo) y en que se devolvió.
--   4. Bucket privado «flota» para esas fotos (se sirven con enlaces firmados de 1 hora).
--
-- No borra nada. fleet.vehicle_documents (con otros ids y sin fechas cargadas) se deja
-- como está; sus fechas, si las hubiera, se copian.
-- Idempotente y sin BEGIN/COMMIT: se puede correr dos veces.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. Vehículos ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fleet.vehiculos (
  id                   TEXT PRIMARY KEY,                -- el mismo vehicle_id de las reservas
  nombre               TEXT NOT NULL,
  corto                TEXT NOT NULL,                   -- para el calendario: «Foton», «Yamaha»
  placa                TEXT,
  tipo                 TEXT NOT NULL CHECK (tipo IN ('carro', 'camioneta', 'moto')),
  color                TEXT NOT NULL DEFAULT '#2f3f32',
  orden                INT  NOT NULL DEFAULT 0,
  activo               BOOLEAN NOT NULL DEFAULT TRUE,
  foto_path            TEXT,                            -- en el bucket «flota»
  tarjeta_path         TEXT,                            -- foto de la tarjeta de propiedad, bucket «flota»
  soat_vence           DATE,
  tecnomecanica_vence  DATE,
  updated_by           TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fleet.vehiculos IS
  'Vehículos de la flota (foto, tarjeta de propiedad, SOAT, tecnomecánica). Solo service_role: la leen las rutas /api/vehiculos.';

ALTER TABLE fleet.vehiculos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fleet.vehiculos FROM anon, authenticated;
GRANT  ALL ON fleet.vehiculos TO service_role;

INSERT INTO fleet.vehiculos (id, nombre, corto, tipo, color, orden) VALUES
  ('camioneta1', 'Chevrolet Samurai', 'Samurai', 'carro',     '#2f5d50', 1),
  ('camioneta2', 'Camioneta Foton',   'Foton',   'camioneta', '#6b8f3e', 2),
  ('moto',       'Suzuki DR 150',     'Suzuki',  'moto',      '#b97d12', 3),
  ('moto2',      'Yamaha XTZ-150',    'Yamaha',  'moto',      '#4a6d8c', 4)
ON CONFLICT (id) DO NOTHING;

-- Fechas que hubiera en la tabla vieja (usaba otros ids).
UPDATE fleet.vehiculos v
   SET soat_vence = d.soat_expiry, tecnomecanica_vence = d.tecnomecanica_expiry
  FROM fleet.vehicle_documents d
 WHERE (v.id, d.vehicle_id) IN (('camioneta1','samurai'), ('camioneta2','foton'), ('moto','dr150'), ('moto2','xtz150'))
   AND v.soat_vence IS NULL AND v.tecnomecanica_vence IS NULL
   AND (d.soat_expiry IS NOT NULL OR d.tecnomecanica_expiry IS NOT NULL);


-- ── 2. PIN de una sola vez ──────────────────────────────────────────────────
ALTER TABLE fleet.conductores ADD COLUMN IF NOT EXISTS pin_temporal BOOLEAN NOT NULL DEFAULT FALSE;


-- ── 3. Hora real de tomar y devolver ────────────────────────────────────────
ALTER TABLE fleet.vehicle_reservations ADD COLUMN IF NOT EXISTS tomado_at   TIMESTAMPTZ;
ALTER TABLE fleet.vehicle_reservations ADD COLUMN IF NOT EXISTS devuelto_at TIMESTAMPTZ;


-- ── 4. Bucket privado para fotos de vehículos y tarjetas de propiedad ───────
INSERT INTO storage.buckets (id, name, public)
VALUES ('flota', 'flota', FALSE)
ON CONFLICT (id) DO NOTHING;


-- ── Verificación (solo lectura) ─────────────────────────────────────────────
--   SELECT id, nombre, placa, soat_vence, tecnomecanica_vence FROM fleet.vehiculos ORDER BY orden;          -- 4 filas
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'fleet' AND table_name = 'vehicle_reservations' AND column_name IN ('tomado_at','devuelto_at');  -- 2
--   SELECT id, public FROM storage.buckets WHERE id = 'flota';                                               -- false
