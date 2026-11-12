-- ============================================================
-- migration_fenologia_intranet.sql — 2026-11-12
-- Módulo «Fenología» de la intranet (/intranet/ras/fenologia).
--
-- Lo que la pantalla lee ya existe: ras.monitoreos_semilleros (lo escribe la
-- app de semilleros, migration_monitoreo_semilleros.sql). Esto agrega lo que
-- faltaba para los calendarios del criterio técnico de restauración:
--
--   1. ras.arboles_monitoreo  — la base de árboles de la app de semilleros
--      (código de placa → predio, vereda, especie, coordenada, DAP, altura,
--      protocolo Corpoamazonia). Los de Solano no están en
--      ras.arboles_semilleros; mientras no entren ahí, este es el puente para
--      saber la vereda, el mapa y cuántos árboles tiene cada predio aunque no
--      se hayan monitoreado. Se llena con el seed (fuera del repo: lleva
--      nombres de propietarios).
--   2. ras.clima_referencia + ras.clima_mensual — las normales climáticas del
--      núcleo (precipitación y temperatura media por mes) con su fuente,
--      estación y periodo. Se llenan desde la intranet (pestaña Clima).
--
-- Solo service_role: la intranet lee y escribe por /api/ras/fenologia.
-- Idempotente: se puede correr dos veces. Sin BEGIN/COMMIT (el editor de
-- Supabase no los respeta).
-- ============================================================

-- ── 1. Árboles de la app de monitoreo ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ras.arboles_monitoreo (
  nucleo            text    NOT NULL DEFAULT 'Solano',
  codigo            text    NOT NULL CHECK (btrim(codigo) <> ''),
  predio            text    NOT NULL,
  vereda            text,
  nombre_comun      text,
  nombre_cientifico text,
  familia           text,
  latitud           numeric CHECK (latitud  BETWEEN -90  AND 90),
  longitud          numeric CHECK (longitud BETWEEN -180 AND 180),
  dap_cm            numeric,
  altura_m          numeric,
  protocolo         text    CHECK (protocolo IN ('especie', 'genero')),  -- NULL = sin protocolo Corpoamazonia
  activo            boolean NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nucleo, codigo)
);
COMMENT ON TABLE ras.arboles_monitoreo IS
  'Base de árboles de la app de monitoreo fenológico (insumos_aves/semilleros/arboles.js). Puente mientras los árboles de Solano no estén en ras.arboles_semilleros. Se cruza con ras.monitoreos_semilleros por (nucleo, codigo).';

-- ── 2. Clima de referencia por núcleo ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS ras.clima_referencia (
  nucleo            text PRIMARY KEY,
  fuente            text,            -- IDEAM, CHIRPS, WorldClim, ERA5-Land…
  estacion          text,            -- nombre y código de la estación, o el pixel
  periodo           text,            -- p. ej. 1991–2020
  umbral_lluvia_mm  numeric CHECK (umbral_lluvia_mm IS NULL OR umbral_lluvia_mm >= 0),  -- NULL = mediana anual
  notas             text,
  updated_by        text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ras.clima_mensual (
  nucleo     text     NOT NULL REFERENCES ras.clima_referencia(nucleo) ON DELETE CASCADE,
  mes        smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  precip_mm  numeric  CHECK (precip_mm IS NULL OR precip_mm >= 0),
  temp_c     numeric  CHECK (temp_c IS NULL OR temp_c BETWEEN -10 AND 50),
  PRIMARY KEY (nucleo, mes)
);
COMMENT ON TABLE ras.clima_mensual IS
  'Promedio multianual por mes (precipitación en mm, temperatura en °C) para los calendarios fenológicos. La fuente y el periodo están en ras.clima_referencia.';

-- ── Permisos: solo service_role ─────────────────────────────────────────────
ALTER TABLE ras.arboles_monitoreo ENABLE ROW LEVEL SECURITY;
ALTER TABLE ras.clima_referencia  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ras.clima_mensual     ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ras.arboles_monitoreo, ras.clima_referencia, ras.clima_mensual FROM anon, authenticated;
GRANT  ALL ON ras.arboles_monitoreo, ras.clima_referencia, ras.clima_mensual TO service_role;

-- ── Verificación ────────────────────────────────────────────────────────────
-- SELECT count(*) FROM ras.arboles_monitoreo;                       -- 273 tras el seed
-- SELECT origen, count(*) FROM ras.monitoreos_semilleros GROUP BY 1; -- kobo 1329 tras el seed
