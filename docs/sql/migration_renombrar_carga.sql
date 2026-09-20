-- ============================================================
--  MIGRACIÓN: "lote" deja de significar dos cosas — la subida pasa a ser CARGA
--  Archivo: docs/sql/migration_renombrar_carga.sql
--  Fecha  : 2026-09-20
--  Requiere: migration_geo_versionado.sql ejecutado (2026-08-11).
--  CORRER ANTES de migration_nucleacion.sql.
--
--  EL PROBLEMA
--    "Lote" venía significando dos cosas distintas en el mismo sistema:
--      · `geo.zonas_lote` = una SUBIDA del SIG con su versión ("backup 1, 2…").
--        Maquinaria del versionado.
--      · el lote de siembra = el PEDAZO DE TIERRA donde se siembra, que es como
--        le dice el equipo en campo y sobre el que va la nucleación.
--    Con la nucleación entrando, las dos acepciones iban a convivir en la misma
--    pantalla. Se arregla antes de que eso pase, no después.
--
--  LA DECISIÓN
--    La palabra del negocio gana y la maquinaria cede: la subida pasa a
--    llamarse CARGA (que ya es como la llama la migración de nucleación,
--    `geo.nucleos_carga`) y "lote" queda libre para el pedazo de tierra.
--
--  QUÉ SE RENOMBRA
--    tabla     geo.zonas_lote            → geo.zonas_carga
--    columnas  geo.zonas.lote_id              → carga_id
--              geo.zonas.reemplazada_por_lote → reemplazada_por_carga
--              geo.zonas.conflicto_con_lote   → conflicto_con_carga
--    funciones geo.abrir_lote            → geo.abrir_carga
--              geo.cerrar_lote           → geo.cerrar_carga
--              geo.crear_zona(…, p_lote_id) → (…, p_carga_id)
--    Y se recrean `geo.revisar_zona`, `geo.zonas_historial` y
--    `geo.v_zonas_conflicto`, que nombran esas columnas por dentro.
--
--  POR QUÉ HAY QUE RECREAR LAS FUNCIONES Y NO BASTA EL RENAME
--    PostgreSQL guarda el cuerpo de una función como TEXTO: renombrar la tabla
--    no actualiza lo que las funciones dicen por dentro. Si solo se hiciera el
--    ALTER, `abrir_lote` seguiría buscando `geo.zonas_lote` y fallaría en la
--    primera subida del SIG. Por eso todo va en UNA transacción.
--
--  RIESGO PARA PRODUCCIÓN: bajo, y verificado antes de escribir esto
--    · `app_campo` (en producción) NO menciona "lote" en ninguna parte, ni
--      llama `crear_zona`: su RPC es `revisar_zona`, cuya FIRMA no cambia.
--    · GeoAE tampoco lo menciona.
--    · `geo.v_zonas_conflicto` y `geo.zonas_historial` no los consume ningún
--      código todavía: solo existen en la base.
--    · El único que pasa `p_lote_id` es la intranet, en 2 líneas de
--      `app/api/sig/ingesta/route.ts`, que se despliegan con este cambio.
--
--  ⚠ CORRER LA MIGRACIÓN Y DESPLEGAR LA INTRANET JUNTOS. Entre una cosa y la
--    otra, subir un shapefile fallaría (la intranet mandaría `p_lote_id` a una
--    función que ya espera `p_carga_id`). Nada se corrompe: la subida se cae
--    entera y lo anterior queda intacto, que es justo como está diseñado.
--
--  ┌────────────────────────────────────────────────────────────────────────┐
--  │ HISTORIAL — 2026-09-20: ESTE ARCHIVO SE CORRIÓ Y FALLÓ A MITAD.        │
--  │                                                                        │
--  │ Murió en el BLOQUE 5 con «42P13 cannot change return type of existing  │
--  │ function» porque faltaba el DROP de geo.zonas_historial (su columna de │
--  │ SALIDA cambia de nombre). Ya está agregado abajo.                      │
--  │                                                                        │
--  │ Y EL BEGIN/COMMIT NO PROTEGIÓ NADA: el editor SQL de Supabase ejecuta  │
--  │ las sentencias por separado, así que lo anterior al error quedó        │
--  │ aplicado. Lo que faltaba se terminó con                                │
--  │ migration_renombrar_carga_fix.sql.                                     │
--  │                                                                        │
--  │ → En una base NUEVA este archivo ya corre completo y solo.             │
--  │ → En la base de producción NO se vuelve a correr: el BLOQUE 1 fallaría │
--  │   con «geo.zonas_lote does not exist», que es justo lo que se buscaba. │
--  └────────────────────────────────────────────────────────────────────────┘
-- ============================================================

-- Se deja el BEGIN/COMMIT por si se corre con psql, que sí lo respeta. En el
-- editor de Supabase no cuenta: ahí cada sentencia va por su cuenta.
BEGIN;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — Renombrar la tabla y las columnas
--   Las llaves foráneas, los índices y los permisos siguen al objeto solos.
-- ════════════════════════════════════════════════════════════

ALTER TABLE geo.zonas_lote RENAME TO zonas_carga;

ALTER TABLE geo.zonas RENAME COLUMN lote_id              TO carga_id;
ALTER TABLE geo.zonas RENAME COLUMN reemplazada_por_lote TO reemplazada_por_carga;
ALTER TABLE geo.zonas RENAME COLUMN conflicto_con_lote   TO conflicto_con_carga;

COMMENT ON TABLE geo.zonas_carga IS
  'Cada subida de zonas del SIG, con versión. Antes se llamaba zonas_lote; se renombró para que "lote" quedara libre y significara solo el lote de siembra (la zona definitiva sobre la que va la nucleación).';

COMMENT ON COLUMN geo.zonas.carga_id IS
  'La subida (geo.zonas_carga) que creó esta zona.';
COMMENT ON COLUMN geo.zonas.conflicto_con_carga IS
  'Subida del SIG que quiso reemplazar esta zona pero no pudo: campo ya la había trabajado. El terreno tiene la última palabra.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — abrir_carga / cerrar_carga (antes abrir_lote / cerrar_lote)
-- ════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION geo.abrir_carga(
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
  FROM geo.zonas_carga WHERE predio_id = p_predio_id AND tipo = p_tipo;

  INSERT INTO geo.zonas_carga (predio_id, tipo, version, origen, modo, nota, created_by)
  VALUES (p_predio_id, p_tipo, v_version, 'sig', p_modo, p_nota, p_created_by)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION geo.abrir_carga TO authenticated, service_role;



CREATE OR REPLACE FUNCTION geo.cerrar_carga(
  p_carga_id    UUID,
  p_reemplazar BOOLEAN DEFAULT TRUE
) RETURNS TABLE (activadas INT, retiradas INT, en_conflicto INT)
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_carga       geo.zonas_carga%ROWTYPE;
  v_activadas  INT := 0;
  v_retiradas  INT := 0;
  v_conflicto  INT := 0;
BEGIN
  SELECT * INTO v_carga FROM geo.zonas_carga WHERE id = p_carga_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'La carga % no existe', p_carga_id; END IF;

  IF p_reemplazar THEN
    -- Lo que campo ya tocó no se retira: se marca en conflicto y sigue vivo.
    UPDATE geo.zonas z
    SET conflicto_con_carga = p_carga_id, updated_at = NOW()
    WHERE z.predio_id = v_carga.predio_id
      AND z.tipo      = v_carga.tipo
      AND z.vigente
      AND z.carga_id IS DISTINCT FROM p_carga_id
      AND (z.origen = 'campo' OR EXISTS (SELECT 1 FROM geo.zona_revision r WHERE r.zona_id = z.id));
    GET DIAGNOSTICS v_conflicto = ROW_COUNT;

    -- El resto (propuesta de oficina que nadie verificó todavía) se retira.
    UPDATE geo.zonas z
    SET vigente = FALSE, reemplazada_at = NOW(), reemplazada_por_carga = p_carga_id, updated_at = NOW()
    WHERE z.predio_id = v_carga.predio_id
      AND z.tipo      = v_carga.tipo
      AND z.vigente
      AND z.carga_id IS DISTINCT FROM p_carga_id
      AND z.origen <> 'campo'
      AND NOT EXISTS (SELECT 1 FROM geo.zona_revision r WHERE r.zona_id = z.id);
    GET DIAGNOSTICS v_retiradas = ROW_COUNT;
  END IF;

  UPDATE geo.zonas SET vigente = TRUE, updated_at = NOW() WHERE carga_id = p_carga_id;
  GET DIAGNOSTICS v_activadas = ROW_COUNT;

  UPDATE geo.zonas_carga SET cerrado_at = NOW() WHERE id = p_carga_id;

  RETURN QUERY SELECT v_activadas, v_retiradas, v_conflicto;
END;
$$;

GRANT EXECUTE ON FUNCTION geo.cerrar_carga TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — crear_zona: el parámetro pasa a p_carga_id
--   Cambiar el NOMBRE de un parámetro exige DROP: CREATE OR REPLACE no lo
--   permite. Se dropea la firma de 10 argumentos, que es la que está viva hoy
--   (la de 9 se retiró en migration_geo_versionado.sql). Dejar las dos
--   convivir dejaría a PostgREST sin saber cuál llamar.
-- ════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS geo.crear_zona(uuid, text, text, text, text, text, text, uuid, text, uuid);



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
  v_geom := ST_Multi(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326)));

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


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — revisar_zona: misma firma, cuerpo actualizado
--   La LLAMA LA APP DE CAMPO. La firma no cambia (nunca tuvo parámetros de
--   lote), solo los nombres de columna que usa por dentro: el celular no se
--   entera de nada.
-- ════════════════════════════════════════════════════════════



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


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — Lecturas: historial y vista de conflictos
--   Las DOS se DROPean antes de recrearse, y por la misma razón: su columna de
--   SALIDA se renombra (`lote_id` → `carga_id`, `conflicto_con_lote` →
--   `conflicto_con_carga`), y eso cambia el tipo de retorno. Ni
--   CREATE OR REPLACE FUNCTION ni CREATE OR REPLACE VIEW pueden con eso:
--     ERROR 42P13: cannot change return type of existing function
--   Es el mismo motivo por el que crear_zona se DROPea en el BLOQUE 3, solo
--   que allá el cambio estaba en un parámetro de ENTRADA y aquí en la SALIDA.
--   (Esta línea faltaba: la corrida del 2026-09-20 murió justo aquí.)
--   Ninguna de las dos la consume código todavía.
-- ════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS geo.zonas_historial(uuid);


CREATE OR REPLACE FUNCTION geo.zonas_historial(p_predio_id uuid)
RETURNS TABLE (
  carga_id    uuid,
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
  FROM geo.zonas_carga l
  LEFT JOIN geo.zonas z ON z.carga_id = l.id
  WHERE l.predio_id = p_predio_id
  GROUP BY l.id
  UNION ALL
  SELECT NULL, z.tipo, 0, NULL, 'Zonas anteriores al versionado', NULL, MIN(z.created_at),
         COUNT(*), ROUND(COALESCE(SUM(z.area_ha), 0)::numeric, 4),
         COUNT(*) FILTER (WHERE z.vigente)
  FROM geo.zonas z
  WHERE z.predio_id = p_predio_id AND z.carga_id IS NULL
  GROUP BY z.tipo
  ORDER BY 3 DESC, 2;
$$;

GRANT EXECUTE ON FUNCTION geo.zonas_historial TO authenticated, service_role;


DROP VIEW IF EXISTS geo.v_zonas_conflicto;


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
  z.conflicto_con_carga,
  z.conflicto_con_zona,
  l.version       AS version_sig_en_conflicto,
  z.updated_at
FROM geo.zonas z
JOIN core.predios p ON p.id = z.predio_id
LEFT JOIN geo.zonas_carga l ON l.id = z.conflicto_con_carga
WHERE z.conflicto_con_carga IS NOT NULL
   OR z.conflicto_con_zona IS NOT NULL
   OR z.revivida_por_campo;

GRANT SELECT ON geo.v_zonas_conflicto TO authenticated, service_role;


-- Las viejas se retiran: si quedaran, PostgREST seguiría exponiéndolas y la
-- primera que alguien llamara reventaría buscando geo.zonas_lote.
DROP FUNCTION IF EXISTS geo.abrir_lote(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS geo.cerrar_lote(uuid, boolean);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 — Recargar PostgREST
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';

COMMIT;


-- ============================================================
--  Verificación tras correr
-- ============================================================
--  select to_regclass('geo.zonas_carga');   -- no NULL
--  select to_regclass('geo.zonas_lote');    -- NULL (ya no existe)
--
--  -- que no quede ninguna función nombrando lo viejo:
--  select p.proname
--    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'geo'
--     and (p.prosrc ilike '%zonas_lote%' or p.proname ilike '%_lote');   -- 0 filas
--
--  -- las columnas nuevas:
--  select column_name from information_schema.columns
--   where table_schema='geo' and table_name='zonas'
--     and column_name in ('carga_id','reemplazada_por_carga','conflicto_con_carga');  -- 3 filas
--
--  -- y que el versionado siga funcionando de punta a punta: subir un .zip de
--  -- prueba desde /intranet/sig/[predioId] y ver que crea una carga nueva.
--  select id, version, modo, created_at from geo.zonas_carga order by created_at desc limit 5;
