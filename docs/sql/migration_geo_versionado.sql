-- ============================================================
--  Migración: geo — versionado de zonas (backups del SIG) y
--             tolerancia de la app de Campo
--  Archivo : docs/sql/migration_geo_versionado.sql
--  Ejecutar: Supabase SQL Editor (después de migration_zona_revision.sql)
--  Creado  : 2026-08-05
--
--  ── El problema que resuelve ────────────────────────────────
--  Hoy el SIG destruye lo anterior:
--    · /api/sig/ingesta con modo='sobreescribir' hace DELETE de todas las
--      zonas de ese tipo del predio y vuelve a insertar → los zona_id nuevos
--      NO son los que el celular descargó.
--    · geo.crear_zona_union hace DELETE de las zonas unidas.
--  Consecuencias en cadena:
--    · geo.revisar_zona levantaba EXCEPTION ('La zona X no existe en el
--      predio Y') → la corrección hecha en terreno NO se podía aplicar nunca.
--    · geo.zona_revision.zona_id quedaba en NULL (ON DELETE SET NULL).
--    · siembra.evaluaciones_campo.zonas_data[].zona_id quedaba colgado.
--    · La versión anterior del SIG desaparecía: no había con qué comparar.
--
--  ── Lo que hace ─────────────────────────────────────────────
--  1. geo.zonas_lote: cada subida del SIG es un LOTE con versión
--     (backup 1, backup 2, ...). Nada se borra: lo anterior queda
--     vigente=false y se puede consultar y comparar.
--  2. geo.zonas gana lote_id, vigente y las marcas de reemplazo/conflicto.
--  3. geo.cerrar_lote: activa el lote nuevo y retira (soft) el anterior
--     EN UNA SOLA TRANSACCIÓN — nunca deja el predio sin zonas a medio subir.
--  4. geo.crear_zona_union deja de borrar: retira.
--  5. geo.revisar_zona NUNCA vuelve a fallar por una zona que el SIG cambió:
--       · zona retirada por un lote nuevo  → campo la REVIVE (campo manda).
--       · zona borrada de raíz (antes de esta migración) → se RECREA con la
--         geometría de respaldo que manda el propio celular.
--       · sin geometría con qué recrear   → la revisión queda registrada
--         igual (zona_id NULL), sin excepción.
--  6. El SIG no atropella a campo: cerrar_lote NO retira zonas que campo ya
--     tocó (tienen revisión) ni las de origen 'campo'; las marca en conflicto
--     para que el SIG lo resuelva en la oficina, con las dos versiones vivas.
--
--  ── Regla de negocio detrás ─────────────────────────────────
--  La app de campo y la persona que está parada en el predio son la última
--  palabra sobre dónde sí y dónde no se siembra. La oficina propone; el
--  terreno dispone. Ninguna de las dos versiones se destruye.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. geo.zonas_lote — una fila por subida del SIG (el "backup N")
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.zonas_lote (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  predio_id     UUID NOT NULL REFERENCES core.predios(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('finca','restauracion','conservacion')),
  version       INT  NOT NULL,                 -- 1, 2, 3... por predio+tipo
  origen        TEXT NOT NULL DEFAULT 'sig' CHECK (origen IN ('sig','campo','ia')),
  modo          TEXT CHECK (modo IN ('insertar','sobreescribir','unir')),
  nota          TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  cerrado_at    TIMESTAMPTZ,                   -- NULL = subida a medias (no se activó)
  UNIQUE (predio_id, tipo, version)
);

COMMENT ON TABLE geo.zonas_lote IS
  'Cada subida de geometrías del SIG para un predio (backup 1, 2, 3...). Las zonas apuntan a su lote; retirar un lote no borra nada.';

CREATE INDEX IF NOT EXISTS idx_zonas_lote_predio ON geo.zonas_lote(predio_id, tipo, version DESC);

ALTER TABLE geo.zonas_lote ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zonas_lote_select" ON geo.zonas_lote;
CREATE POLICY "zonas_lote_select" ON geo.zonas_lote FOR SELECT TO authenticated USING (true);
GRANT SELECT, INSERT, UPDATE ON geo.zonas_lote TO authenticated, service_role;


-- ────────────────────────────────────────────────────────────
-- 2. geo.zonas — versionado + marcas de conflicto
--    Las filas que ya existen quedan vigente=true (default): el estado
--    actual del sistema no cambia al correr esta migración.
-- ────────────────────────────────────────────────────────────
ALTER TABLE geo.zonas ADD COLUMN IF NOT EXISTS lote_id              UUID REFERENCES geo.zonas_lote(id) ON DELETE SET NULL;
ALTER TABLE geo.zonas ADD COLUMN IF NOT EXISTS vigente              BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE geo.zonas ADD COLUMN IF NOT EXISTS reemplazada_at       TIMESTAMPTZ;
ALTER TABLE geo.zonas ADD COLUMN IF NOT EXISTS reemplazada_por_lote UUID REFERENCES geo.zonas_lote(id) ON DELETE SET NULL;
ALTER TABLE geo.zonas ADD COLUMN IF NOT EXISTS revivida_por_campo   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE geo.zonas ADD COLUMN IF NOT EXISTS conflicto_con_lote   UUID REFERENCES geo.zonas_lote(id) ON DELETE SET NULL;
ALTER TABLE geo.zonas ADD COLUMN IF NOT EXISTS conflicto_con_zona   UUID REFERENCES geo.zonas(id) ON DELETE SET NULL;

COMMENT ON COLUMN geo.zonas.vigente IS
  'true = versión activa. false = reemplazada por un lote posterior (NO borrada: sigue consultable como backup).';
COMMENT ON COLUMN geo.zonas.revivida_por_campo IS
  'La app de campo trabajó esta zona después de que el SIG la reemplazó, y campo tiene la última palabra: se reactivó.';
COMMENT ON COLUMN geo.zonas.conflicto_con_lote IS
  'Esta zona (trabajada por campo) sobrevivió a una subida nueva del SIG. El SIG debe resolverlo en la oficina.';
COMMENT ON COLUMN geo.zonas.conflicto_con_zona IS
  'Esta zona del SIG se solapa con una que campo impuso en terreno. Ambas siguen vivas hasta que el SIG decida.';

CREATE INDEX IF NOT EXISTS idx_zonas_vigente ON geo.zonas(predio_id, tipo, vigente);


-- ────────────────────────────────────────────────────────────
-- 3. Abrir un lote (reserva la versión siguiente)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION geo.abrir_lote(
  p_predio_id  UUID,
  p_tipo       TEXT,
  p_modo       TEXT DEFAULT 'insertar',
  p_created_by TEXT DEFAULT NULL,
  p_nota       TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_id      UUID;
  v_version INT;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM geo.zonas_lote WHERE predio_id = p_predio_id AND tipo = p_tipo;

  INSERT INTO geo.zonas_lote (predio_id, tipo, version, origen, modo, nota, created_by)
  VALUES (p_predio_id, p_tipo, v_version, 'sig', p_modo, p_nota, p_created_by)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION geo.abrir_lote TO authenticated, service_role;


-- ────────────────────────────────────────────────────────────
-- 4. crear_zona con lote
--    Con lote, la zona nace vigente=false (borrador): solo se activa cuando
--    cerrar_lote confirma que la subida terminó completa. Si la carga se cae
--    a mitad, el predio se queda con lo anterior intacto y sin duplicados.
--    Se DROPea la firma vieja para no dejar dos sobrecargas (PostgREST no
--    sabría cuál llamar).
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS geo.crear_zona(uuid, text, text, text, text, text, text, uuid, text);

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
  p_lote_id       UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_id   UUID;
  v_geom geometry;
BEGIN
  v_geom := ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326)));

  INSERT INTO geo.zonas (predio_id, expediente_id, nombre, tipo, estado, origen,
                         geom, area_ha, perimetro_m, shapefile_url, created_by,
                         lote_id, vigente)
  VALUES (
    p_predio_id, p_expediente_id, p_nombre,
    COALESCE(p_tipo,'restauracion'), COALESCE(p_estado,'potencial'), COALESCE(p_origen,'sig'),
    v_geom, ST_Area(v_geom::geography) / 10000.0, ST_Perimeter(v_geom::geography),
    p_shapefile_url, p_created_by,
    p_lote_id, (p_lote_id IS NULL)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION geo.crear_zona TO authenticated, service_role;


-- ────────────────────────────────────────────────────────────
-- 5. Cerrar el lote: activar lo nuevo y retirar lo viejo, atómico
--
--    p_reemplazar = true  → la subida sustituye lo que había (antes: DELETE)
--    p_reemplazar = false → la subida se suma a lo que ya estaba
--
--    NUNCA retira una zona que campo ya trabajó (tiene revisión en
--    geo.zona_revision) ni una de origen 'campo': esas sobreviven marcadas
--    conflicto_con_lote, para que el SIG vea que el terreno dijo otra cosa.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION geo.cerrar_lote(
  p_lote_id    UUID,
  p_reemplazar BOOLEAN DEFAULT TRUE
) RETURNS TABLE (activadas INT, retiradas INT, en_conflicto INT)
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_lote       geo.zonas_lote%ROWTYPE;
  v_activadas  INT := 0;
  v_retiradas  INT := 0;
  v_conflicto  INT := 0;
BEGIN
  SELECT * INTO v_lote FROM geo.zonas_lote WHERE id = p_lote_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El lote % no existe', p_lote_id; END IF;

  IF p_reemplazar THEN
    -- Lo que campo ya tocó no se retira: se marca en conflicto y sigue vivo.
    UPDATE geo.zonas z
    SET conflicto_con_lote = p_lote_id, updated_at = NOW()
    WHERE z.predio_id = v_lote.predio_id
      AND z.tipo      = v_lote.tipo
      AND z.vigente
      AND z.lote_id IS DISTINCT FROM p_lote_id
      AND (z.origen = 'campo' OR EXISTS (SELECT 1 FROM geo.zona_revision r WHERE r.zona_id = z.id));
    GET DIAGNOSTICS v_conflicto = ROW_COUNT;

    -- El resto (propuesta de oficina que nadie verificó todavía) se retira.
    UPDATE geo.zonas z
    SET vigente = FALSE, reemplazada_at = NOW(), reemplazada_por_lote = p_lote_id, updated_at = NOW()
    WHERE z.predio_id = v_lote.predio_id
      AND z.tipo      = v_lote.tipo
      AND z.vigente
      AND z.lote_id IS DISTINCT FROM p_lote_id
      AND z.origen <> 'campo'
      AND NOT EXISTS (SELECT 1 FROM geo.zona_revision r WHERE r.zona_id = z.id);
    GET DIAGNOSTICS v_retiradas = ROW_COUNT;
  END IF;

  UPDATE geo.zonas SET vigente = TRUE, updated_at = NOW() WHERE lote_id = p_lote_id;
  GET DIAGNOSTICS v_activadas = ROW_COUNT;

  UPDATE geo.zonas_lote SET cerrado_at = NOW() WHERE id = p_lote_id;

  RETURN QUERY SELECT v_activadas, v_retiradas, v_conflicto;
END;
$$;

GRANT EXECUTE ON FUNCTION geo.cerrar_lote TO authenticated, service_role;


-- ────────────────────────────────────────────────────────────
-- 6. Unir zonas sin destruir la versión anterior
-- ────────────────────────────────────────────────────────────
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
  v_geom := ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326)));

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


-- ────────────────────────────────────────────────────────────
-- 7. Lecturas: vigentes (mapa) vs histórico (backups)
-- ────────────────────────────────────────────────────────────
-- Misma firma de siempre: ahora solo devuelve la versión vigente.
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
LANGUAGE sql STABLE
SET search_path = public, geo
AS $$
  SELECT id, nombre, tipo, estado, area_ha, perimetro_m, propiedades, ST_AsGeoJSON(geom)
  FROM geo.zonas
  WHERE predio_id = p_predio_id AND vigente
  ORDER BY created_at;
$$;

GRANT EXECUTE ON FUNCTION geo.zonas_de_predio TO anon, authenticated, service_role;

-- Los backups del predio: qué subió el SIG, cuándo y cuántas zonas.
-- Las zonas anteriores a esta migración salen agrupadas como versión 0.
CREATE OR REPLACE FUNCTION geo.zonas_historial(p_predio_id uuid)
RETURNS TABLE (
  lote_id    uuid,
  tipo       text,
  version    int,
  modo       text,
  nota       text,
  created_by text,
  created_at timestamptz,
  zonas      bigint,
  area_ha    numeric,
  vigentes   bigint
)
LANGUAGE sql STABLE
SET search_path = public, geo
AS $$
  SELECT l.id, l.tipo, l.version, l.modo, l.nota, l.created_by, l.created_at,
         COUNT(z.id),
         ROUND(COALESCE(SUM(z.area_ha), 0)::numeric, 4),
         COUNT(z.id) FILTER (WHERE z.vigente)
  FROM geo.zonas_lote l
  LEFT JOIN geo.zonas z ON z.lote_id = l.id
  WHERE l.predio_id = p_predio_id
  GROUP BY l.id
  UNION ALL
  SELECT NULL, z.tipo, 0, NULL, 'Zonas anteriores al versionado', NULL, MIN(z.created_at),
         COUNT(*), ROUND(COALESCE(SUM(z.area_ha), 0)::numeric, 4),
         COUNT(*) FILTER (WHERE z.vigente)
  FROM geo.zonas z
  WHERE z.predio_id = p_predio_id AND z.lote_id IS NULL
  GROUP BY z.tipo
  ORDER BY 3 DESC, 2;
$$;

GRANT EXECUTE ON FUNCTION geo.zonas_historial TO authenticated, service_role;

-- Zonas donde la oficina y el terreno se contradicen (para resolver en el SIG).
CREATE OR REPLACE VIEW geo.v_zonas_conflicto AS
SELECT
  z.id            AS zona_id,
  z.predio_id,
  p.nombre_predio,
  z.tipo,
  z.estado,
  z.origen,
  z.area_ha,
  z.vigente,
  z.revivida_por_campo,
  z.conflicto_con_lote,
  z.conflicto_con_zona,
  l.version       AS version_sig_en_conflicto,
  z.updated_at
FROM geo.zonas z
JOIN core.predios p ON p.id = z.predio_id
LEFT JOIN geo.zonas_lote l ON l.id = z.conflicto_con_lote
WHERE z.conflicto_con_lote IS NOT NULL
   OR z.conflicto_con_zona IS NOT NULL
   OR z.revivida_por_campo;

GRANT SELECT ON geo.v_zonas_conflicto TO authenticated, service_role;


-- ────────────────────────────────────────────────────────────
-- 8. geo.revisar_zona — nunca vuelve a fallar por un cambio del SIG
--    Se DROPea la firma de 9 argumentos (migration_zona_revision.sql) para
--    reemplazarla por la de 10 (agrega p_geojson_respaldo): dos sobrecargas
--    dejarían a PostgREST sin saber cuál llamar.
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS geo.revisar_zona(text, uuid, text, uuid, text, text, text, text, date);

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
    v_geom := ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326)));
  END IF;
  IF p_geojson_respaldo IS NOT NULL THEN
    v_respaldo := ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson_respaldo), 4326)));
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
      -- Existe pero el SIG la reemplazó con un lote nuevo. El técnico estuvo
      -- parado ahí: su versión vuelve a estar vigente. `origen` NO se toca
      -- (sigue siendo cierto que la dibujó el SIG); lo que la protege de
      -- futuros lotes es tener revisión de campo + revivida_por_campo.
      UPDATE geo.zonas
      SET vigente = TRUE, revivida_por_campo = TRUE,
          reemplazada_at = NULL, reemplazada_por_lote = NULL, updated_at = NOW()
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


-- ────────────────────────────────────────────────────────────
-- 9. El candado de Campo solo cuenta zonas vigentes
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW core.v_predios_campo AS
SELECT
  p.id                    AS predio_id,
  e.id                    AS expediente_id,
  a.id                    AS aliado_id,
  p.nombre_predio,
  p.departamento,
  p.municipio,
  p.vereda,
  p.zona_ae,
  p.matricula_inmobiliaria,
  p.codigo_catastral,
  a.nombre_completo       AS nombre_propietario,
  a.tipo_documento,
  a.numero_documento,
  a.telefono,
  e.etapa,
  e.updated_at
FROM core.predios p
JOIN core.expedientes e ON e.predio_id = p.id
JOIN core.aliados a     ON a.id = p.aliado_id
WHERE e.etapa IN ('campo', 'sig_ii')
  AND EXISTS (
    SELECT 1 FROM geo.zonas z
    WHERE z.predio_id = p.id AND z.tipo = 'restauracion'
      AND z.estado <> 'descartada' AND z.vigente
  );

GRANT SELECT ON core.v_predios_campo TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr
-- ============================================================
--   select to_regclass('geo.zonas_lote');                     -- no NULL
--   select column_name from information_schema.columns
--     where table_schema='geo' and table_name='zonas'
--       and column_name in ('lote_id','vigente','revivida_por_campo');   -- 3 filas
--
--   -- Nada cambió de estado al migrar (todo lo existente sigue vigente):
--   select count(*) filter (where vigente) as vigentes, count(*) as total from geo.zonas;
--
--   -- La firma nueva del RPC quedó única (10 argumentos, sin sobrecargas):
--   select proname, pronargs from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where nspname='geo' and proname in ('revisar_zona','crear_zona');
--
--   -- Prueba del caso que motivó todo (backup 1 → backup 2 → campo revive):
--   --   select geo.abrir_lote('<predio>','restauracion','sobreescribir','sig@ae.com');
--   --   select geo.crear_zona('<predio>','{"type":"Polygon",...}','restauracion',
--   --                         'potencial','sig',null,null,null,'sig@ae.com','<lote>');
--   --   select * from geo.cerrar_lote('<lote>');           -- activadas/retiradas/en_conflicto
--   --   select geo.revisar_zona('rev-1','<predio>','confirmada','<zona_del_backup_1>');
--   --     → devuelve la zona (revivida), NO levanta excepción
--   --   select vigente, revivida_por_campo from geo.zonas where id='<zona_del_backup_1>';
-- ============================================================
