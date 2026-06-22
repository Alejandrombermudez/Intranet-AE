-- ============================================================
--  MIGRACIÓN: geo v2 — atributos del shapefile + lectura para el mapa
--  Archivo: docs/sql/migration_geo_v2.sql
--  Fecha  : 2026-06-19
--  Requiere: migration_geo.sql ya ejecutado.
--
--  PASO MANUAL: ninguno extra (geo ya está expuesto).
-- ============================================================

-- Atributos leídos del .dbf + perímetro (la geometría y el área ya estaban)
ALTER TABLE geo.zonas ADD COLUMN IF NOT EXISTS propiedades jsonb;
ALTER TABLE geo.zonas ADD COLUMN IF NOT EXISTS perimetro_m numeric;

COMMENT ON COLUMN geo.zonas.propiedades IS 'Atributos del .dbf del shapefile (para verificar lectura).';

-- Lee las zonas de un predio con su geometría en GeoJSON (para pintarlas en el mapa)
CREATE OR REPLACE FUNCTION geo.zonas_de_predio(p_predio_id uuid)
RETURNS TABLE (
  id          uuid,
  nombre      text,
  tipo        text,
  estado      text,
  area_ha     numeric,
  perimetro_m numeric,
  propiedades jsonb,
  geojson     text
)
LANGUAGE sql STABLE AS $$
  SELECT id, nombre, tipo, estado, area_ha, perimetro_m, propiedades, ST_AsGeoJSON(geom)
  FROM geo.zonas
  WHERE predio_id = p_predio_id
  ORDER BY created_at;
$$;

GRANT EXECUTE ON FUNCTION geo.zonas_de_predio TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
