-- ============================================================
--  MIGRACIÓN: terminar el renombre a CARGA (lo que quedó a medias)
--  Archivo: docs/sql/migration_renombrar_carga_fix.sql
--  Fecha  : 2026-09-20
--
--  QUÉ PASÓ
--    migration_renombrar_carga.sql se corrió y **falló a mitad de camino**:
--
--      ERROR: 42P13 cannot change return type of existing function
--      HINT:  Use DROP FUNCTION geo.zonas_historial(uuid) first.
--
--    `geo.zonas_historial` devuelve una TABLE cuya columna pasó de `lote_id` a
--    `carga_id`. Cambiar el nombre de una columna de salida cambia el tipo de
--    retorno, y eso CREATE OR REPLACE no lo permite: hay que DROPear antes.
--    Estaba previsto para `crear_zona` (donde cambiaba un parámetro de ENTRADA)
--    pero no para esta, donde el cambio está en la SALIDA.
--
--  ⚠ Y LO IMPORTANTE: el BEGIN/COMMIT del archivo NO protegió nada.
--    El editor SQL de Supabase ejecuta las sentencias por separado, así que lo
--    que iba antes del error quedó aplicado y lo de después no. Verificado por
--    REST el 2026-09-20 — este archivo arregla exactamente esa mitad.
--
--  LO QUE YA QUEDÓ BIEN (no se vuelve a tocar):
--    · geo.zonas_carga (la tabla renombrada) · geo.zonas_lote ya no existe
--    · geo.zonas.carga_id / reemplazada_por_carga / conflicto_con_carga
--    · geo.abrir_carga y geo.cerrar_carga, funcionando
--    · geo.crear_zona, que ya solo acepta p_carga_id
--
--  LO QUE ARREGLA ESTE ARCHIVO:
--    1. geo.zonas_historial — hoy EXISTE pero está ROTA: su cuerpo todavía
--       busca `geo.zonas_lote`, que ya no existe.
--    2. geo.v_zonas_conflicto — su columna de salida sigue llamándose
--       conflicto_con_lote.
--    3. geo.revisar_zona — se vuelve a aplicar por seguridad: LA LLAMA LA APP
--       DE CAMPO y nombra columnas renombradas por dentro. Su firma no cambia,
--       así que el celular no se entera.
--    4. Retira geo.abrir_lote y geo.cerrar_lote, que siguen expuestas y ROTAS
--       (su DROP iba al final del archivo y nunca se alcanzó).
--
--  ⚠ DESPLIEGUE: `geo.crear_zona` YA solo acepta `p_carga_id`. Cualquier
--    instancia de la intranet con el código anterior NO puede subir shapefiles
--    hasta que se despliegue. No se corrompe nada —la subida falla entera y lo
--    anterior queda intacto— pero conviene desplegar ya.
--
--  SIN BEGIN/COMMIT a propósito: cada sentencia es independiente y se puede
--  correr de nuevo sin romper nada.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. zonas_historial — DROP primero, que es lo que faltaba
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


-- ════════════════════════════════════════════════════════════
-- 2. v_zonas_conflicto — la columna de salida pasa a conflicto_con_carga
--    Se DROPea porque CREATE OR REPLACE VIEW tampoco puede renombrar una
--    columna de salida. No la consume ningún código todavía.
-- ════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════
-- 3. revisar_zona — misma firma, cuerpo con los nombres nuevos
--    La llama la app de campo (en producción). Se reaplica por si el error
--    cortó antes de llegar aquí; si ya estaba bien, esto no cambia nada.
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
-- 4. Retirar las funciones viejas
--    Siguen expuestas por PostgREST y ya están rotas: su cuerpo busca
--    geo.zonas_lote, que no existe. Quien las llame recibe un 42P01.
-- ════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS geo.abrir_lote(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS geo.cerrar_lote(uuid, boolean);


-- ════════════════════════════════════════════════════════════
-- 5. Recargar PostgREST
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr
-- ============================================================
--  -- ninguna función debe seguir nombrando lo viejo:
--  select p.proname
--    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'geo'
--     and (p.prosrc ilike '%zonas_lote%' or p.proname ilike '%\_lote');   -- 0 filas
--
--  -- y que el historial vuelva a responder (con un predio real):
--  select * from geo.zonas_historial('<predio_id>');
--
--  -- la vista, con su columna nueva:
--  select conflicto_con_carga from geo.v_zonas_conflicto limit 1;
--
--  Después: desplegar la intranet (crear_zona ya pide p_carga_id) y subir un
--  .zip de prueba desde /intranet/sig/[predioId] para cerrar el círculo.
