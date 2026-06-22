-- ============================================================
--  MIGRACIÓN: PostGIS + schema geo (Módulo SIG — zonas)
--  Archivo: docs/sql/migration_geo.sql
--  Fecha  : 2026-06-19
--
--  QUÉ HACE
--    Habilita PostGIS y crea geo.zonas: la geometría real de las zonas
--    (potencial → validada → definitiva → avalada) vinculada al predio.
--    Reemplaza el esquema viejo de "un .zip por finca" (que no se podía
--    consultar) por geometría consultable + área calculada por la base.
--
--  Contexto y pipeline: docs/CONTEXTO_MODULO_SIG.md
--
--  PASO MANUAL (Supabase Dashboard), DESPUÉS de correr el SQL:
--    Settings → API → Exposed schemas → agregar: geo
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — PostGIS + schema
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS geo;
GRANT USAGE ON SCHEMA geo TO anon, authenticated, service_role;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — geo.zonas (geometría real, fuente de verdad)
-- ════════════════════════════════════════════════════════════

CREATE TABLE geo.zonas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  predio_id     UUID NOT NULL REFERENCES core.predios(id)      ON DELETE CASCADE,
  expediente_id UUID          REFERENCES core.expedientes(id)  ON DELETE SET NULL,

  nombre        TEXT,
  tipo          TEXT NOT NULL DEFAULT 'restauracion'
                  CHECK (tipo IN ('finca','restauracion','conservacion')),
  estado        TEXT NOT NULL DEFAULT 'potencial'
                  CHECK (estado IN ('potencial','validada','definitiva','avalada')),
  origen        TEXT NOT NULL DEFAULT 'sig'
                  CHECK (origen IN ('sig','campo','ia')),

  geom          geometry(MultiPolygon, 4326) NOT NULL,   -- WGS84, indexada GIST
  area_ha       NUMERIC,                                 -- ST_Area(geom::geography)/10000, la pone el RPC

  shapefile_url TEXT,                                    -- .zip de respaldo en Storage
  version       INT NOT NULL DEFAULT 1,

  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE geo.zonas IS 'Zonas geográficas del predio (potencial→validada→definitiva→avalada). Geometría real en PostGIS; el .zip queda solo como respaldo.';

CREATE INDEX idx_zonas_geom   ON geo.zonas USING GIST (geom);
CREATE INDEX idx_zonas_predio ON geo.zonas(predio_id);
CREATE INDEX idx_zonas_estado ON geo.zonas(estado);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — RPC para insertar una zona desde GeoJSON
--   La app reproyecta a 4326 (lee el .prj del shapefile) y manda GeoJSON.
--   El RPC repara la geometría, la fuerza a MultiPolygon y calcula el área.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION geo.crear_zona(
  p_predio_id     UUID,
  p_geojson       TEXT,                 -- geometría GeoJSON (no Feature) en EPSG:4326
  p_tipo          TEXT DEFAULT 'restauracion',
  p_estado        TEXT DEFAULT 'potencial',
  p_origen        TEXT DEFAULT 'sig',
  p_nombre        TEXT DEFAULT NULL,
  p_shapefile_url TEXT DEFAULT NULL,
  p_expediente_id UUID DEFAULT NULL,
  p_created_by    TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id   UUID;
  v_geom geometry;
BEGIN
  v_geom := ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326)));

  INSERT INTO geo.zonas (predio_id, expediente_id, nombre, tipo, estado, origen, geom, area_ha, shapefile_url, created_by)
  VALUES (
    p_predio_id, p_expediente_id, p_nombre,
    COALESCE(p_tipo,'restauracion'), COALESCE(p_estado,'potencial'), COALESCE(p_origen,'sig'),
    v_geom, ST_Area(v_geom::geography) / 10000.0, p_shapefile_url, p_created_by
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — RLS + permisos (mismo patrón que core/juridica)
-- ════════════════════════════════════════════════════════════

ALTER TABLE geo.zonas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geo_zonas_select" ON geo.zonas FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA geo TO authenticated, service_role;
GRANT USAGE                          ON ALL SEQUENCES IN SCHEMA geo TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION geo.crear_zona TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA geo GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — Recargar PostgREST
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 — Verificación
-- ════════════════════════════════════════════════════════════

-- PostGIS activo:
SELECT postgis_full_version();
-- geo.zonas creada:
SELECT column_name, udt_name FROM information_schema.columns
WHERE table_schema='geo' AND table_name='zonas' ORDER BY ordinal_position;
