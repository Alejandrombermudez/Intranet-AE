-- ============================================================
--  MIGRACIÓN SIG — TODO EN UN ARCHIVO (2026-09-23)
--  Archivo: docs/sql/migration_decision_sig.sql
--
--  CÓMO CORRERLA
--    Supabase → SQL Editor → pegar el archivo completo → Run. Una sola vez.
--    Todas las sentencias se pueden volver a correr sin romper nada: si algo
--    falla a mitad de camino, se arregla y se corre el archivo entero otra vez.
--    Va SIN BEGIN/COMMIT a propósito: el editor de Supabase ejecuta cada
--    sentencia por separado, así que no protegerían nada.
--
--  Requiere (ya corridas en producción): migration_geo_versionado.sql,
--  migration_renombrar_carga.sql + _fix.sql, migration_zona_revision.sql y
--  migration_nucleacion.sql + _v2.sql.
--
--  TRAE TRES COSAS
--
--  PARTE 1 — Geometrías que no fallan al guardarse
--    (antes migration_geo_force2d.sql, más dos protecciones nuevas)
--    · 2D: geo.zonas.geom es geometry(MultiPolygon, 4326), 2D estricto, y
--      geo.nucleos.geom tampoco admite Z. Algunos shapefiles (exportados desde
--      QGIS/Civil3D con "Z habilitada") son PolygonZ aunque su Z no tenga datos
--      reales, y Postgres rechaza el INSERT/UPDATE ("Geometry has Z dimension
--      but column does not"). Se agrega ST_Force2D.
--    · Solo la parte poligonal: reparar un polígono con una "espiga" o un lado
--      que vuelve sobre sí mismo (ST_MakeValid) puede devolver una colección
--      con líneas sueltas, que la columna MultiPolygon también rechaza. Se
--      agrega ST_CollectionExtract(…, 3), y si no queda área la función lo
--      dice con un mensaje claro en vez de un error de tipos.
--    Se recrean las definiciones VIGENTES de geo.crear_zona,
--    geo.crear_zona_union, geo.revisar_zona y geo.crear_nucleo; fuera de eso,
--    no cambian. La intranet ya quita la Z al leer el shapefile; esto cubre a
--    la app de campo y a cualquier llamada directa a los RPC.
--
--  PARTE 2 — El SIG decide sobre lo que devolvió campo
--    Hasta hoy el terreno tenía la última palabra. Desde aquí, después de
--    campo, el SIG revisa cada zona en «Resultados de campo» y decide:
--      · confirmar → la zona queda como lote de siembra (estado 'definitiva'),
--                    sea cual sea el resultado de campo — incluso una que el
--                    técnico descartó.
--      · editar    → el SIG corrige el límite y la zona queda como lote con
--                    esa geometría.
--      · eliminar  → la zona sale del juego (vigente = false, 'descartada').
--                    No se borra: sigue en la base y en el historial.
--    Es lo mismo que ya hacía el paso 1 de Nucleación (confirmar lotes), con
--    dos diferencias: aplica a cualquier resultado de campo y deja rastro.
--
--    El historial queda: geo.zona_revision sigue siendo SOLO lo que hizo el
--    terreno (la leen el informe, el tablero y el pulso del sistema). Las
--    decisiones del SIG van en su propia tabla, geo.zona_decision, con el
--    estado y la geometría de ANTES de cada decisión.
--
--    Lo que NO hace: no cambia lo que geo.revisar_zona hace para la app de
--    campo (la PARTE 1 solo le agrega las protecciones de geometría). Si campo
--    vuelve a trabajar una zona DESPUÉS de la decisión del SIG, esa revisión
--    se aplica como siempre y la zona vuelve a quedar pendiente en la
--    intranet. Tampoco deja editar ni eliminar un lote con núcleos cargados.
--
--  PARTE 3 — Cerrarle a la llave anónima lo que escribe
--    (incluye migration_predio_grupos_v2.sql, que explica el porqué)
--    Postgres le da EXECUTE a PUBLIC en cada función nueva. Las funciones que
--    escriben zonas, cargas y grupos de predios no son SECURITY DEFINER: con la
--    llave anónima corren como anon y la RLS las frena, así que hoy NO es un
--    hueco abierto. Se cierra porque es la barrera que no depende de que nadie
--    se equivoque después. Solo las llama la API de la intranet (service_role);
--    se revisó el código de app_campo, geovisor-ae y actividades_monitoreo_campo
--    el 2026-09-23 y ninguna las usa. NO se tocan geo.revisar_zona ni
--    geo.zonas_de_predio: esas sí las usa la app de campo con la llave anónima.
-- ============================================================


-- ████████████████████████████████████████████████████████████
-- PARTE 1 — Geometrías que no fallan al guardarse
-- ████████████████████████████████████████████████████████████

-- ── 1.1  geo.crear_zona ───────────────────────────────────────
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
  -- 2D (la columna no admite Z) y solo la parte poligonal: reparar un
  -- polígono con una "espiga" puede devolver una colección con líneas sueltas.
  v_geom := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326))), 3));
  IF v_geom IS NULL OR ST_IsEmpty(v_geom) THEN
    RAISE EXCEPTION 'La geometría no tiene área: no es un polígono válido';
  END IF;

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


-- ── 1.2  geo.crear_zona_union ─────────────────────────────────
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
  -- 2D (la columna no admite Z) y solo la parte poligonal: reparar un
  -- polígono con una "espiga" puede devolver una colección con líneas sueltas.
  v_geom := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326))), 3));
  IF v_geom IS NULL OR ST_IsEmpty(v_geom) THEN
    RAISE EXCEPTION 'La geometría no tiene área: no es un polígono válido';
  END IF;

  SELECT ST_Union(geom) INTO v_exist FROM geo.zonas WHERE id = ANY(p_ids);
  IF v_exist IS NOT NULL THEN
    v_geom := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Union(v_geom, v_exist)), 3));
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


-- ── 1.3  geo.revisar_zona (la llama la app de campo; misma firma) ──
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

  -- 2D y solo la parte poligonal (ver geo.crear_zona). Lo que queda sin área
  -- pasa a NULL: así nunca se guarda una zona vacía ni se recrea una con un
  -- respaldo inservible.
  IF p_geojson IS NOT NULL THEN
    v_geom := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326))), 3));
    IF ST_IsEmpty(v_geom) THEN v_geom := NULL; END IF;
  END IF;
  IF p_geojson_respaldo IS NOT NULL THEN
    v_respaldo := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson_respaldo), 4326))), 3));
    IF ST_IsEmpty(v_respaldo) THEN v_respaldo := NULL; END IF;
  END IF;
  -- Para estas acciones una geometría sin área ya fallaba antes, pero más
  -- adelante y con un error de tipos que no decía nada. Ahora lo dice.
  IF p_accion IN ('modificada','nueva') AND v_geom IS NULL THEN
    RAISE EXCEPTION 'La geometría enviada para la acción % no tiene área: no es un polígono válido', p_accion;
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


-- ── 1.4  geo.crear_nucleo (la llama la subida de nucleación; misma firma) ──
CREATE OR REPLACE FUNCTION geo.crear_nucleo(
  p_predio_id   UUID,
  p_geojson     TEXT,
  p_carga_id    UUID   DEFAULT NULL,
  p_nombre      TEXT   DEFAULT NULL,
  p_n_plantas   INT    DEFAULT NULL,
  p_propiedades JSONB  DEFAULT NULL,
  p_created_by  TEXT   DEFAULT NULL
) RETURNS TABLE (nucleo_id UUID, zona_id UUID, area_ha NUMERIC)
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_geom  geometry;
  v_zona  UUID;
  v_area  NUMERIC;
  v_id    UUID;
BEGIN
  -- 2D: geo.nucleos.geom es geometry(Geometry, 4326) y tampoco admite Z.
  -- No se extraen polígonos: un núcleo puede ser un punto.
  v_geom := ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326)));
  IF v_geom IS NULL OR ST_IsEmpty(v_geom) THEN
    RAISE EXCEPTION 'Geometría de núcleo vacía o inválida';
  END IF;

  -- ¿Dentro de qué lote cae? Primero el que lo contiene; si ninguno, el que
  -- más área comparta (un núcleo dibujado justo en el borde no se pierde).
  SELECT z.id INTO v_zona
  FROM geo.zonas z
  WHERE z.predio_id = p_predio_id
    AND z.tipo = 'restauracion'
    AND z.estado = 'definitiva'
    AND z.vigente
    AND ST_Contains(z.geom, v_geom)
  LIMIT 1;

  IF v_zona IS NULL THEN
    SELECT z.id INTO v_zona
    FROM geo.zonas z
    WHERE z.predio_id = p_predio_id
      AND z.tipo = 'restauracion'
      AND z.estado = 'definitiva'
      AND z.vigente
      AND ST_Intersects(z.geom, v_geom)
    ORDER BY ST_Area(ST_Intersection(z.geom, v_geom)) DESC
    LIMIT 1;
  END IF;

  -- Área solo si es superficie (dimensión 2); un punto no tiene área
  IF ST_Dimension(v_geom) = 2 THEN
    v_area := ST_Area(v_geom::geography) / 10000.0;
  END IF;

  INSERT INTO geo.nucleos (predio_id, zona_id, carga_id, nombre, geom, area_ha, n_plantas, propiedades, created_by)
  VALUES (p_predio_id, v_zona, p_carga_id, p_nombre, v_geom, v_area, p_n_plantas, p_propiedades, p_created_by)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_zona, v_area;
END;
$$;

REVOKE EXECUTE ON FUNCTION geo.crear_nucleo(uuid, text, uuid, text, int, jsonb, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION geo.crear_nucleo(uuid, text, uuid, text, int, jsonb, text) TO authenticated, service_role;


-- ████████████████████████████████████████████████████████████
-- PARTE 2 — El SIG decide sobre lo que devolvió campo
-- ████████████████████████████████████████████████████████████

-- ════════════════════════════════════════════════════════════
-- 2.1  geo.zona_decision — una fila por decisión del SIG sobre una zona
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS geo.zona_decision (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zona_id        UUID REFERENCES geo.zonas(id) ON DELETE SET NULL,
  predio_id      UUID NOT NULL REFERENCES core.predios(id) ON DELETE CASCADE,

  decision       TEXT NOT NULL CHECK (decision IN ('confirmada','editada','eliminada')),

  -- Cómo estaba la zona justo ANTES de la decisión (para deshacer o auditar)
  estado_previo  TEXT,
  vigente_previo BOOLEAN,
  geom_previa    geometry(MultiPolygon, 4326),
  -- Cómo quedó: solo en 'editada' (en las demás la geometría no cambia)
  geom_nueva     geometry(MultiPolygon, 4326),
  area_ha        NUMERIC,                 -- área con la que quedó la zona

  nota           TEXT,
  decidido_por   TEXT,                    -- correo de quien decidió (del token de sesión)
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE geo.zona_decision IS
  'Decisión del SIG sobre una zona después de campo: confirmada (lote), editada (lote con límite del SIG) o eliminada (vigente=false). Conserva estado y geometría previos. Lo que hizo el terreno sigue en geo.zona_revision.';

CREATE INDEX IF NOT EXISTS idx_zona_decision_predio ON geo.zona_decision(predio_id, created_at);
CREATE INDEX IF NOT EXISTS idx_zona_decision_zona   ON geo.zona_decision(zona_id);

ALTER TABLE geo.zona_decision ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zona_decision_select" ON geo.zona_decision;
CREATE POLICY "zona_decision_select" ON geo.zona_decision FOR SELECT TO authenticated USING (true);

-- Los privilegios por defecto del esquema geo le dan escritura a
-- authenticated; la RLS ya la bloquea, pero se quita explícitamente: la única
-- puerta de escritura es geo.decidir_zonas, desde la API de la intranet.
REVOKE INSERT, UPDATE, DELETE ON geo.zona_decision FROM anon, authenticated;
GRANT  SELECT ON geo.zona_decision TO authenticated;
GRANT  ALL    ON geo.zona_decision TO service_role;


-- ════════════════════════════════════════════════════════════
-- 2.2  geo.decidir_zonas — confirmar, editar o eliminar (una o varias zonas)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION geo.decidir_zonas(
  p_predio_id UUID,
  p_zona_ids  UUID[],
  p_decision  TEXT,                 -- confirmar | editar | eliminar
  p_geojson   TEXT DEFAULT NULL,    -- solo 'editar': geometría final, GeoJSON en EPSG:4326
  p_por       TEXT DEFAULT NULL,
  p_nota      TEXT DEFAULT NULL
) RETURNS INT                       -- cuántas zonas quedaron decididas
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_zona geo.zonas%ROWTYPE;
  v_geom geometry;
  v_nuc  INT;
  v_n    INT := 0;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('confirmar','editar','eliminar') THEN
    RAISE EXCEPTION 'Decisión inválida: %', p_decision;
  END IF;
  IF p_zona_ids IS NULL OR cardinality(p_zona_ids) = 0 THEN
    RAISE EXCEPTION 'Marca al menos una zona';
  END IF;

  IF p_decision = 'editar' THEN
    IF cardinality(p_zona_ids) <> 1 THEN
      RAISE EXCEPTION 'Las zonas se editan de a una';
    END IF;
    IF p_geojson IS NULL THEN
      RAISE EXCEPTION 'Falta la geometría editada';
    END IF;
    -- 2D (la columna no admite Z), válida y solo la parte poligonal: reparar
    -- un polígono puede devolver una colección con líneas sueltas.
    v_geom := ST_Multi(ST_CollectionExtract(
                ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326))), 3));
    IF v_geom IS NULL OR ST_IsEmpty(v_geom) THEN
      RAISE EXCEPTION 'La geometría editada quedó vacía o no es un polígono';
    END IF;
  END IF;

  -- Todas tienen que ser sitios de siembra de ESTE predio…
  IF EXISTS (
    SELECT 1 FROM unnest(p_zona_ids) AS u(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM geo.zonas z
      WHERE z.id = u.id AND z.predio_id = p_predio_id AND z.tipo = 'restauracion'
    )
  ) THEN
    RAISE EXCEPTION 'Alguna de las zonas no es un sitio de siembra de este predio';
  END IF;

  -- …y campo tiene que haberlas visto. Esta es la revisión de lo que volvió de
  -- terreno: una propuesta de oficina que nadie visitó no se decide aquí.
  IF EXISTS (
    SELECT 1 FROM unnest(p_zona_ids) AS u(id)
    WHERE NOT EXISTS (SELECT 1 FROM geo.zona_revision r WHERE r.zona_id = u.id)
  ) THEN
    RAISE EXCEPTION 'Alguna de las zonas no tiene resultados de campo';
  END IF;

  -- Editar o eliminar un lote con nucleación dejaría núcleos por fuera.
  IF p_decision IN ('editar','eliminar') THEN
    SELECT COUNT(*) INTO v_nuc
    FROM geo.nucleos n
    WHERE n.zona_id = ANY(p_zona_ids) AND n.vigente;
    IF v_nuc > 0 THEN
      RAISE EXCEPTION 'Esas zonas tienen % núcleo(s) de nucleación cargados. Retira o reemplaza la nucleación antes de editarlas o eliminarlas.', v_nuc;
    END IF;
  END IF;

  FOR v_zona IN
    SELECT * FROM geo.zonas WHERE id = ANY(p_zona_ids) ORDER BY created_at FOR UPDATE
  LOOP
    IF p_decision IN ('confirmar','editar') THEN
      -- Queda como lote. Si ya lo era, se respetan las marcas del lote (así
      -- «Deshacer» en Nucleación sigue devolviéndola a donde estaba antes);
      -- si no, se anotan como lo hace geo.confirmar_lotes.
      UPDATE geo.zonas
         SET estado                = 'definitiva',
             vigente               = TRUE,
             reemplazada_at        = NULL,
             reemplazada_por_carga = NULL,
             conflicto_con_carga   = NULL,
             conflicto_con_zona    = NULL,
             propiedades = CASE
               WHEN v_zona.estado = 'definitiva' AND v_zona.vigente THEN propiedades
               ELSE (COALESCE(propiedades, '{}'::jsonb) - 'eliminada_por_sig' - 'eliminada_at')
                    || jsonb_build_object(
                         'lote_confirmado_por', p_por,
                         'lote_confirmado_at',  NOW(),
                         'lote_estado_previo',  v_zona.estado)
             END,
             updated_at = NOW()
       WHERE id = v_zona.id;

      IF p_decision = 'editar' THEN
        UPDATE geo.zonas
           SET geom        = v_geom,
               area_ha     = ST_Area(v_geom::geography) / 10000.0,
               perimetro_m = ST_Perimeter(v_geom::geography),
               origen      = 'sig',          -- la geometría vigente la dibujó el SIG
               version     = version + 1
         WHERE id = v_zona.id;
      END IF;

    ELSE  -- eliminar
      UPDATE geo.zonas
         SET estado                = 'descartada',
             vigente               = FALSE,
             reemplazada_at        = NOW(),
             reemplazada_por_carga = NULL,
             conflicto_con_carga   = NULL,
             conflicto_con_zona    = NULL,
             version               = version + 1,
             propiedades = (COALESCE(propiedades, '{}'::jsonb)
                            - 'lote_confirmado_por' - 'lote_confirmado_at' - 'lote_estado_previo')
                           || jsonb_build_object('eliminada_por_sig', p_por, 'eliminada_at', NOW()),
             updated_at = NOW()
       WHERE id = v_zona.id;

      -- Las zonas del SIG que estaban en conflicto con esta ya no lo están.
      UPDATE geo.zonas
         SET conflicto_con_zona = NULL, updated_at = NOW()
       WHERE conflicto_con_zona = v_zona.id;
    END IF;

    INSERT INTO geo.zona_decision
      (zona_id, predio_id, decision, estado_previo, vigente_previo,
       geom_previa, geom_nueva, area_ha, nota, decidido_por)
    VALUES
      (v_zona.id, p_predio_id,
       CASE p_decision WHEN 'confirmar' THEN 'confirmada' WHEN 'editar' THEN 'editada' ELSE 'eliminada' END,
       v_zona.estado, v_zona.vigente, v_zona.geom,
       CASE WHEN p_decision = 'editar' THEN v_geom END,
       CASE WHEN p_decision = 'editar' THEN ST_Area(v_geom::geography) / 10000.0 ELSE v_zona.area_ha END,
       NULLIF(btrim(p_nota), ''), p_por);

    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION geo.decidir_zonas(uuid, uuid[], text, text, text, text) IS
  'El SIG decide sobre zonas que campo ya revisó: confirmar (lote), editar (lote con geometría nueva) o eliminar (vigente=false). Deja una fila por zona en geo.zona_decision.';

-- Solo la API de la intranet (service_role), que ya exige sesión y permiso.
REVOKE EXECUTE ON FUNCTION geo.decidir_zonas(uuid, uuid[], text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION geo.decidir_zonas(uuid, uuid[], text, text, text, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION geo.decidir_zonas(uuid, uuid[], text, text, text, text) TO service_role;


-- ████████████████████████████████████████████████████████████
-- PARTE 3 — Cerrarle a la llave anónima lo que escribe
-- ████████████████████████████████████████████████████████████
-- authenticated y service_role conservan el permiso que ya tenían; solo sale
-- PUBLIC (y anon, por si alguna vez se le dio directo).

-- ── 3.1  Fusión de predios (migration_predio_grupos_v2.sql) ──
REVOKE EXECUTE ON FUNCTION core.fusionar_predios(uuid[], uuid, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION core.disolver_grupo(uuid, text)                       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION core.fusionar_predios(uuid[], uuid, text, text, text) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION core.disolver_grupo(uuid, text)                       TO authenticated, service_role;

-- ── 3.2  Subida de zonas del SIG (solo /api/sig/ingesta) ──
REVOKE EXECUTE ON FUNCTION geo.crear_zona(uuid, text, text, text, text, text, text, uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION geo.crear_zona_union(uuid, text, uuid[], text, text, text, uuid, text)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION geo.abrir_carga(uuid, text, text, text, text)                             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION geo.cerrar_carga(uuid, boolean)                                           FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION geo.crear_zona(uuid, text, text, text, text, text, text, uuid, text, uuid) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION geo.crear_zona_union(uuid, text, uuid[], text, text, text, uuid, text)     TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION geo.abrir_carga(uuid, text, text, text, text)                             TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION geo.cerrar_carga(uuid, boolean)                                           TO authenticated, service_role;


-- ████████████████████████████████████████████████████████████
-- Recargar PostgREST (para que la API vea la tabla y la función nuevas)
-- ████████████████████████████████████████████████████████████

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr (cada consulta por separado)
-- ============================================================
--  PARTE 1 — geometrías (4 filas):
--    select proname,
--           prosrc like '%ST_Force2D%'           as dos_d,
--           prosrc like '%ST_CollectionExtract%' as solo_poligonos
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'geo'
--       and proname in ('crear_zona','crear_zona_union','revisar_zona','crear_nucleo');
--    Esperado: dos_d = true en las 4; solo_poligonos = true en todas menos
--    crear_nucleo (un núcleo puede ser un punto).
--
--  PARTE 2 — la tabla existe:
--    select to_regclass('geo.zona_decision');          -- no NULL
--
--  PARTES 2 y 3 — quién puede ejecutar qué:
--    select f,
--           has_function_privilege('anon', f, 'execute')          as anon,
--           has_function_privilege('authenticated', f, 'execute') as authenticated
--      from (values
--        ('geo.decidir_zonas(uuid, uuid[], text, text, text, text)'),
--        ('core.fusionar_predios(uuid[], uuid, text, text, text)'),
--        ('core.disolver_grupo(uuid, text)'),
--        ('geo.crear_zona(uuid, text, text, text, text, text, text, uuid, text, uuid)'),
--        ('geo.crear_zona_union(uuid, text, uuid[], text, text, text, uuid, text)'),
--        ('geo.abrir_carga(uuid, text, text, text, text)'),
--        ('geo.cerrar_carga(uuid, boolean)'),
--        ('geo.crear_nucleo(uuid, text, uuid, text, int, jsonb, text)'),
--        ('geo.revisar_zona(text, uuid, text, uuid, text, text, text, text, date, text)'),
--        ('geo.zonas_de_predio(uuid)')
--      ) as t(f);
--    Esperado: anon = false en todas MENOS revisar_zona y zonas_de_predio
--    (true: las usa la app de campo). authenticated = true en todas menos
--    decidir_zonas (false: solo la API).
--
--  Después, en la intranet: /intranet/sig/<predio> → «Resultados de campo»,
--  marcar una zona y confirmarla. Debe aparecer en la bitácora como decisión
--  del SIG y, en la pestaña Nucleación, como lote. Y subir un shapefile
--  PolygonZ en SIG I para confirmar que la PARTE 1 funciona.
-- ============================================================
