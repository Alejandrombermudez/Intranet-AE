-- ============================================================
--  MIGRACIÓN: geo v3 — unir zonas (merge) para el flujo del SIG
--  Archivo: docs/sql/migration_geo_v3.sql
--  Fecha  : 2026-06-20
--  Requiere: migration_geo.sql y migration_geo_v2.sql ejecutados.
-- ============================================================

-- Crea una zona uniendo (ST_Union) la nueva geometría con zonas existentes
-- (las indicadas en p_ids, que se borran). Sirve para "unir" cuando el SIG
-- sube un polígono que se sobrepone a uno ya guardado.
CREATE OR REPLACE FUNCTION geo.crear_zona_union(
  p_predio_id     uuid,
  p_geojson       text,
  p_ids           uuid[],
  p_tipo          text DEFAULT 'finca',
  p_origen        text DEFAULT 'sig',
  p_nombre        text DEFAULT NULL,
  p_expediente_id uuid DEFAULT NULL,
  p_created_by    text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE
  v_id    uuid;
  v_geom  geometry;
  v_exist geometry;
BEGIN
  v_geom := ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326)));

  SELECT ST_Union(geom) INTO v_exist FROM geo.zonas WHERE id = ANY(p_ids);
  IF v_exist IS NOT NULL THEN
    v_geom := ST_Multi(ST_MakeValid(ST_Union(v_geom, v_exist)));
  END IF;

  DELETE FROM geo.zonas WHERE id = ANY(p_ids);

  INSERT INTO geo.zonas (predio_id, expediente_id, nombre, tipo, estado, origen, geom, area_ha, perimetro_m, created_by)
  VALUES (
    p_predio_id, p_expediente_id, p_nombre,
    COALESCE(p_tipo,'finca'), 'potencial', COALESCE(p_origen,'sig'),
    v_geom, ST_Area(v_geom::geography) / 10000.0, ST_Perimeter(v_geom::geography), p_created_by
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION geo.crear_zona_union TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
