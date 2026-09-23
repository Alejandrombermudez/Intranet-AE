-- ============================================================
--  MIGRACIÓN: geo — forzar 2D al guardar zonas (shapefiles PolygonZ)
--  Archivo: docs/sql/migration_geo_force2d.sql
--  Fecha  : 2026-09-23
--  Requiere: migration_geo_versionado.sql, migration_renombrar_carga.sql y
--            migration_renombrar_carga_fix.sql ejecutados.
--
--  EL PROBLEMA
--    geo.zonas.geom es geometry(MultiPolygon, 4326): 2D estricto. Algunos
--    shapefiles (exportados desde QGIS/Civil3D con "Z habilitada") son PolygonZ
--    aunque su Z no tenga datos reales. ST_GeomFromGeoJSON conserva esa Z y
--    Postgres rechaza el INSERT/UPDATE ("Geometry has Z dimension but column
--    does not"). El geovisor los muestra bien porque solo usa X/Y, pero la
--    subida en /api/sig/ingesta y la revisión desde campo fallan.
--
--  LA CORRECCIÓN
--    Recrea las definiciones VIGENTES de geo.crear_zona (renombrar_carga),
--    geo.crear_zona_union (geo_versionado) y geo.revisar_zona
--    (renombrar_carga_fix) sin otro cambio que envolver la geometría de
--    entrada en ST_Force2D. Idempotente. La intranet además descarta la Z al
--    parsear (lib/shapefile-client.ts), así que esto cubre a app_campo y a
--    cualquier otro cliente que llame los RPC directo.
--
--  Portado del commit local 79e6f8c (migration_geo_v4.sql, 2026-07-08), que
--  nunca llegó a GitHub y quedó escrito contra funciones ya reemplazadas.
-- ============================================================

BEGIN;

-- ── 1. geo.crear_zona ───────────────────────────────────────
CREATE OR REPLACE FUNCTION geo.crear_zona(
  p_predio_id     UUID,
  p_geojson       TEXT,
  p_tipo          TEXT DEFAULT 'restauracion',
  p_estado        TEXT DEFAULT 'potencial',
  p_origen        TEXT DEFAULT 'sig',
  p_nombre        TEXT DEFAULT NULL,
  p_shapefile_url TEXT DEFAULT NULL,
  p_expediente_id UUID DEFAULT NULL,
  p_created_by    TEXT DEFAULT NULL,
  p_carga_id       UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_id   UUID;
  v_geom geometry;
BEGIN
  v_geom := ST_Multi(ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326))));

  INSERT INTO geo.zonas (predio_id, expediente_id, nombre, tipo, estado, origen,
                         geom, area_ha, perimetro_m, shapefile_url, created_by,
                         carga_id, vigente)
  VALUES (
    p_predio_id, p_expediente_id, p_nombre,
    COALESCE(p_tipo,'restauracion'), COALESCE(p_estado,'potencial'), COALESCE(p_origen,'sig'),
    v_geom, ST_Area(v_geom::geography) / 10000.0, ST_Perimeter(v_geom::geography),
    p_shapefile_url, p_created_by,
    p_carga_id, (p_carga_id IS NULL)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION geo.crear_zona TO authenticated, service_role;


-- ── 2. geo.crear_zona_union ─────────────────────────────────
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
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_id    uuid;
  v_geom  geometry;
  v_exist geometry;
BEGIN
  v_geom := ST_Multi(ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326))));

  SELECT ST_Union(geom) INTO v_exist FROM geo.zonas WHERE id = ANY(p_ids);
  IF v_exist IS NOT NULL THEN
    v_geom := ST_Multi(ST_MakeValid(ST_Union(v_geom, v_exist)));
  END IF;

  INSERT INTO geo.zonas (predio_id, expediente_id, nombre, tipo, estado, origen, geom, area_ha, perimetro_m, created_by)
  VALUES (
    p_predio_id, p_expediente_id, p_nombre,
    COALESCE(p_tipo,'finca'), 'potencial', COALESCE(p_origen,'sig'),
    v_geom, ST_Area(v_geom::geography) / 10000.0, ST_Perimeter(v_geom::geography), p_created_by
  )
  RETURNING id INTO v_id;

  -- Antes: DELETE. Ahora las originales quedan como respaldo consultable.
  UPDATE geo.zonas
  SET vigente = FALSE, reemplazada_at = NOW(), updated_at = NOW()
  WHERE id = ANY(p_ids);

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION geo.crear_zona_union TO authenticated, service_role;


-- ── 3. geo.revisar_zona ─────────────────────────────────────
CREATE OR REPLACE FUNCTION geo.revisar_zona(
  p_local_id          TEXT,
  p_predio_id         UUID,
  p_accion            TEXT,
  p_zona_id           UUID    DEFAULT NULL,
  p_geojson           TEXT    DEFAULT NULL,
  p_observaciones     TEXT    DEFAULT NULL,
  p_evaluador         TEXT    DEFAULT NULL,
  p_metodo            TEXT    DEFAULT NULL,
  p_fecha             DATE    DEFAULT NULL,
  p_geojson_respaldo  TEXT    DEFAULT NULL   -- la geometría que el celular tenía guardada
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, geo
AS $$
DECLARE
  v_zona_id   UUID := p_zona_id;
  v_geom      geometry;
  v_geom_orig geometry;
  v_respaldo  geometry;
  v_vigente   BOOLEAN;
  v_revivida  BOOLEAN := FALSE;
BEGIN
  -- Idempotencia: si esta revisión ya se aplicó, devolver la zona sin repetir
  SELECT zona_id INTO v_zona_id FROM geo.zona_revision WHERE local_id = p_local_id;
  IF FOUND THEN RETURN v_zona_id; END IF;
  v_zona_id := p_zona_id;

  IF p_accion NOT IN ('confirmada','modificada','nueva','descartada') THEN
    RAISE EXCEPTION 'Acción inválida: %', p_accion;
  END IF;
  IF p_accion <> 'nueva' AND v_zona_id IS NULL THEN
    RAISE EXCEPTION 'zona_id es requerido para la acción %', p_accion;
  END IF;
  IF p_accion IN ('modificada','nueva') AND p_geojson IS NULL THEN
    RAISE EXCEPTION 'geojson es requerido para la acción %', p_accion;
  END IF;

  IF p_geojson IS NOT NULL THEN
    v_geom := ST_Multi(ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326))));
  END IF;
  IF p_geojson_respaldo IS NOT NULL THEN
    v_respaldo := ST_Multi(ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson_respaldo), 4326))));
  END IF;

  -- ── ¿La zona sigue ahí? ──────────────────────────────────────────────────
  IF v_zona_id IS NOT NULL THEN
    -- Ojo: SELECT ... INTO deja las variables en NULL si no hay fila, así que
    -- la bandera de "existe" tiene que ser FOUND, no el valor leído.
    SELECT geom, vigente INTO v_geom_orig, v_vigente
    FROM geo.zonas WHERE id = v_zona_id AND predio_id = p_predio_id;

    IF NOT FOUND THEN
      -- No existe: el SIG la borró de raíz (subidas anteriores a esta
      -- migración). Campo es la última palabra y trae su propia copia:
      -- se recrea con lo que manda el celular. Si no manda nada, la revisión
      -- se guarda igual sin zona — pero NUNCA se levanta excepción, porque
      -- eso dejaba el trabajo de terreno atascado para siempre.
      IF COALESCE(v_geom, v_respaldo) IS NOT NULL THEN
        INSERT INTO geo.zonas (predio_id, tipo, estado, origen, geom, area_ha, perimetro_m,
                               created_by, vigente, revivida_por_campo)
        VALUES (p_predio_id, 'restauracion', 'validada', 'campo',
                COALESCE(v_geom, v_respaldo),
                ST_Area(COALESCE(v_geom, v_respaldo)::geography) / 10000.0,
                ST_Perimeter(COALESCE(v_geom, v_respaldo)::geography),
                p_evaluador, TRUE, TRUE)
        RETURNING id INTO v_zona_id;
        v_revivida := TRUE;
      ELSE
        v_zona_id := NULL;
      END IF;

    ELSIF NOT v_vigente THEN
      -- Existe pero el SIG la reemplazó con una carga nueva. El técnico estuvo
      -- parado ahí: su versión vuelve a estar vigente. `origen` NO se toca
      -- (sigue siendo cierto que la dibujó el SIG); lo que la protege de
      -- futuras cargas es tener revisión de campo + revivida_por_campo.
      UPDATE geo.zonas
      SET vigente = TRUE, revivida_por_campo = TRUE,
          reemplazada_at = NULL, reemplazada_por_carga = NULL, updated_at = NOW()
      WHERE id = v_zona_id;
      v_revivida := TRUE;
    END IF;
  END IF;

  -- ── Aplicar la acción (si no quedó huérfana) ─────────────────────────────
  IF v_zona_id IS NOT NULL THEN
    IF p_accion = 'confirmada' THEN
      UPDATE geo.zonas SET estado = 'validada', updated_at = NOW() WHERE id = v_zona_id;

    ELSIF p_accion = 'modificada' THEN
      UPDATE geo.zonas
      SET geom        = v_geom,
          area_ha     = ST_Area(v_geom::geography) / 10000.0,
          perimetro_m = ST_Perimeter(v_geom::geography),
          estado      = 'validada',
          origen      = 'campo',
          version     = version + 1,
          updated_at  = NOW()
      WHERE id = v_zona_id;

    ELSIF p_accion = 'descartada' THEN
      UPDATE geo.zonas
      SET estado = 'descartada', version = version + 1, updated_at = NOW()
      WHERE id = v_zona_id;
    END IF;

  ELSIF p_accion = 'nueva' THEN
    INSERT INTO geo.zonas (predio_id, tipo, estado, origen, geom, area_ha, perimetro_m, created_by)
    VALUES (p_predio_id, 'restauracion', 'validada', 'campo',
            v_geom, ST_Area(v_geom::geography) / 10000.0, ST_Perimeter(v_geom::geography), p_evaluador)
    RETURNING id INTO v_zona_id;
  END IF;

  -- ── Si campo revivió una zona, avisar sobre las del SIG que se solapan ───
  -- No se retiran (la oficina puede tener razón sobre el área nueva): quedan
  -- marcadas para que el SIG resuelva viendo las dos versiones.
  IF v_revivida AND v_zona_id IS NOT NULL THEN
    UPDATE geo.zonas s
    SET conflicto_con_zona = v_zona_id, updated_at = NOW()
    WHERE s.predio_id = p_predio_id
      AND s.tipo      = 'restauracion'
      AND s.vigente
      AND s.id <> v_zona_id
      AND s.origen = 'sig'
      AND ST_Intersects(s.geom, (SELECT geom FROM geo.zonas WHERE id = v_zona_id));
  END IF;

  INSERT INTO geo.zona_revision
    (local_id, zona_id, predio_id, accion, metodo, geom_original, geom_corregida, area_ha_campo,
     observaciones, evaluador, fecha, sync_origin)
  VALUES
    (p_local_id, v_zona_id, p_predio_id, p_accion, p_metodo,
     COALESCE(v_geom_orig, v_respaldo),
     CASE WHEN p_accion IN ('modificada','nueva') THEN v_geom END,
     CASE WHEN p_accion IN ('modificada','nueva') THEN ST_Area(v_geom::geography) / 10000.0 END,
     p_observaciones, p_evaluador, COALESCE(p_fecha, CURRENT_DATE), 'pwa');

  RETURN v_zona_id;
END;
$$;

GRANT EXECUTE ON FUNCTION geo.revisar_zona TO anon, authenticated, service_role;

COMMIT;

-- Verificar: volver a subir un shapefile PolygonZ en SIG I y confirmar que la
-- zona aparece en geo.zonas; o bien:
--   select prosrc like '%ST_Force2D%' from pg_proc where proname in ('crear_zona','crear_zona_union','revisar_zona');
