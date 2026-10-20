-- ============================================================
--  CAMPO PRIMERO — predios que se visitan antes de que el SIG proponga (2026-10-20)
--  Archivo: docs/sql/migration_campo_primero.sql
--
--  CÓMO CORRERLA
--    Supabase → SQL Editor → pegar el archivo completo → Run.
--    Va SIN BEGIN/COMMIT a propósito: el editor ejecuta cada sentencia por
--    separado. Todas se pueden volver a correr sin romper nada; el orden deja
--    el sistema coherente aunque se corte a mitad (primero la columna, después
--    la vista que la usa, después las funciones nuevas).
--
--  Requiere (ya corridas en producción): migration_geo_versionado.sql,
--  migration_renombrar_carga.sql + _fix.sql y migration_decision_sig.sql.
--  No lleva datos: ni nombres ni geometrías de predios.
--
--  QUÉ RESUELVE
--    Hasta hoy un predio salía a Campo solo si el SIG ya había subido al menos
--    una zona de siembra (doble candado: la API «Enviar a Campo» y esta vista).
--    Ahora hay predios donde la visita va primero: en terreno se delimita el
--    predio Y las zonas de siembra desde cero, el SIG confirma después desde la
--    intranet y sigue lo demás (nucleación, etc.). Los dos flujos conviven:
--
--      sig_primero   (el de siempre) el SIG propone, campo verifica y corrige.
--      campo_primero (nuevo)         campo dibuja, el SIG confirma.
--
--  LO QUE NO CAMBIA, A PROPÓSITO
--    · geo.revisar_zona queda igual (misma firma, mismo cuerpo): la usan los
--      celulares que ya están en campo con la versión instalada. Las zonas de
--      siembra que dibuja campo siguen entrando por ahí (acción 'nueva').
--    · geo.decidir_zonas queda igual: sigue siendo solo para sitios de siembra.
--    · Nada se borra: el límite dibujado en campo queda en geo.zona_revision
--      (lo que hizo el terreno) y lo que decida el SIG va en geo.zona_decision.
--
--  TRAE
--    PARTE 1  core.expedientes.flujo_campo
--    PARTE 2  core.v_predios_campo deja pasar los predios 'campo_primero' sin zonas
--    PARTE 3  geo.revisar_zona_campo: lo mismo que revisar_zona, con el TIPO
--             (para que campo pueda dibujar o corregir el límite del predio)
--    PARTE 4  geo.decidir_limite: el SIG confirma, edita o retira el límite que
--             llegó de campo (solo service_role, desde la API de la intranet)
-- ============================================================


-- ████████████████████████████████████████████████████████████
-- PARTE 1 — En qué flujo sale el predio a campo
-- ████████████████████████████████████████████████████████████

ALTER TABLE core.expedientes
  ADD COLUMN IF NOT EXISTS flujo_campo TEXT NOT NULL DEFAULT 'sig_primero';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expedientes_flujo_campo_check') THEN
    ALTER TABLE core.expedientes
      ADD CONSTRAINT expedientes_flujo_campo_check
      CHECK (flujo_campo IN ('sig_primero', 'campo_primero'));
  END IF;
END $$;

COMMENT ON COLUMN core.expedientes.flujo_campo IS
  'sig_primero: el SIG propone zonas y campo las verifica. campo_primero: campo delimita el predio y las zonas desde cero y el SIG confirma después. Lo fija «Enviar a Campo».';


-- ████████████████████████████████████████████████████████████
-- PARTE 2 — La vista que lee el celular
--   Mismas columnas y en el mismo orden que la vigente (migration_geo_versionado
--   §9, verificada por REST el 2026-10-20) + flujo_campo AL FINAL: así
--   CREATE OR REPLACE la acepta sin DROP y los celulares con la versión vieja,
--   que piden columnas por nombre, no notan nada.
-- ████████████████████████████████████████████████████████████

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
  e.updated_at,
  e.flujo_campo
FROM core.predios p
JOIN core.expedientes e ON e.predio_id = p.id
JOIN core.aliados a     ON a.id = p.aliado_id
WHERE e.etapa IN ('campo', 'sig_ii')
  AND (
    -- sig_primero: el candado de siempre, al menos una zona de siembra vigente
    EXISTS (
      SELECT 1 FROM geo.zonas z
      WHERE z.predio_id = p.id AND z.tipo = 'restauracion'
        AND z.estado <> 'descartada' AND z.vigente
    )
    -- campo_primero: lo dibuja el terreno; basta con que alguien lo haya enviado así
    OR e.flujo_campo = 'campo_primero'
  );

GRANT SELECT ON core.v_predios_campo TO anon, authenticated, service_role;


-- ████████████████████████████████████████████████████████████
-- PARTE 3 — geo.revisar_zona_campo (la llama la app de campo, llave anónima)
--   Copia de geo.revisar_zona (migration_decision_sig.sql §1.3) con un
--   parámetro más, p_tipo ('restauracion' | 'finca'). Diferencias, y solo estas:
--     · 'nueva' crea la zona con ese tipo (revisar_zona siempre crea
--       'restauracion': por eso campo no podía dibujar el límite del predio).
--     · si hay que recrear una zona borrada por el SIG, se recrea con su tipo.
--     · el aviso de solape con zonas del SIG mira zonas del mismo tipo.
--     · si se manda p_zona_id, la zona tiene que ser de ese tipo (un límite no
--       se puede «corregir» con la geometría de un sitio de siembra, ni al revés).
--   Es una función APARTE y no un cambio de firma de revisar_zona a propósito:
--   cambiarle la firma exige DROP, y entre el DROP y el CREATE los celulares
--   que están sincronizando fallarían.
-- ████████████████████████████████████████████████████████████

CREATE OR REPLACE FUNCTION geo.revisar_zona_campo(
  p_local_id          TEXT,
  p_predio_id         UUID,
  p_accion            TEXT,
  p_tipo              TEXT    DEFAULT 'restauracion',
  p_zona_id           UUID    DEFAULT NULL,
  p_geojson           TEXT    DEFAULT NULL,
  p_observaciones     TEXT    DEFAULT NULL,
  p_evaluador         TEXT    DEFAULT NULL,
  p_metodo            TEXT    DEFAULT NULL,
  p_fecha             DATE    DEFAULT NULL,
  p_geojson_respaldo  TEXT    DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, geo
AS $$
DECLARE
  v_tipo      TEXT := COALESCE(p_tipo, 'restauracion');
  v_zona_id   UUID := p_zona_id;
  v_tipo_zona TEXT;
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

  IF v_tipo NOT IN ('restauracion','finca') THEN
    RAISE EXCEPTION 'Tipo inválido: % (restauracion | finca)', v_tipo;
  END IF;
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
    v_geom := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326))), 3));
    IF ST_IsEmpty(v_geom) THEN v_geom := NULL; END IF;
  END IF;
  IF p_geojson_respaldo IS NOT NULL THEN
    v_respaldo := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson_respaldo), 4326))), 3));
    IF ST_IsEmpty(v_respaldo) THEN v_respaldo := NULL; END IF;
  END IF;
  IF p_accion IN ('modificada','nueva') AND v_geom IS NULL THEN
    RAISE EXCEPTION 'La geometría enviada para la acción % no tiene área: no es un polígono válido', p_accion;
  END IF;

  -- ── ¿La zona sigue ahí? ──────────────────────────────────────────────────
  IF v_zona_id IS NOT NULL THEN
    SELECT geom, vigente, tipo INTO v_geom_orig, v_vigente, v_tipo_zona
    FROM geo.zonas WHERE id = v_zona_id AND predio_id = p_predio_id;

    IF NOT FOUND THEN
      -- El SIG la borró de raíz: se recrea con lo que manda el celular (o la
      -- revisión queda sin zona). Nunca se levanta excepción por esto.
      IF COALESCE(v_geom, v_respaldo) IS NOT NULL THEN
        INSERT INTO geo.zonas (predio_id, tipo, estado, origen, geom, area_ha, perimetro_m,
                               created_by, vigente, revivida_por_campo)
        VALUES (p_predio_id, v_tipo, 'validada', 'campo',
                COALESCE(v_geom, v_respaldo),
                ST_Area(COALESCE(v_geom, v_respaldo)::geography) / 10000.0,
                ST_Perimeter(COALESCE(v_geom, v_respaldo)::geography),
                p_evaluador, TRUE, TRUE)
        RETURNING id INTO v_zona_id;
        v_revivida := TRUE;
      ELSE
        v_zona_id := NULL;
      END IF;

    ELSE
      IF v_tipo_zona IS DISTINCT FROM v_tipo THEN
        RAISE EXCEPTION 'La zona % es de tipo % y la revisión llegó como %', v_zona_id, v_tipo_zona, v_tipo;
      END IF;
      IF NOT v_vigente THEN
        -- El SIG la reemplazó con una carga nueva: el técnico estuvo ahí, vuelve.
        UPDATE geo.zonas
        SET vigente = TRUE, revivida_por_campo = TRUE,
            reemplazada_at = NULL, reemplazada_por_carga = NULL, updated_at = NOW()
        WHERE id = v_zona_id;
        v_revivida := TRUE;
      END IF;
    END IF;
  END IF;

  -- ── Aplicar la acción ────────────────────────────────────────────────────
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
    VALUES (p_predio_id, v_tipo, 'validada', 'campo',
            v_geom, ST_Area(v_geom::geography) / 10000.0, ST_Perimeter(v_geom::geography), p_evaluador)
    RETURNING id INTO v_zona_id;
  END IF;

  -- Campo revivió o recreó una zona: las del SIG del mismo tipo que se solapan
  -- quedan marcadas (no se retiran) para que el SIG resuelva viendo las dos.
  IF v_revivida AND v_zona_id IS NOT NULL THEN
    UPDATE geo.zonas s
    SET conflicto_con_zona = v_zona_id, updated_at = NOW()
    WHERE s.predio_id = p_predio_id
      AND s.tipo      = v_tipo
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
     p_observaciones, p_evaluador,
     COALESCE(p_fecha, (NOW() AT TIME ZONE 'America/Bogota')::date), 'pwa');

  RETURN v_zona_id;
END;
$$;

REVOKE ALL ON FUNCTION geo.revisar_zona_campo(TEXT, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION geo.revisar_zona_campo(TEXT, UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, DATE, TEXT)
  TO anon, authenticated, service_role;


-- ████████████████████████████████████████████████████████████
-- PARTE 4 — geo.decidir_limite: el SIG revisa el límite que trajo campo
--   Contraparte de geo.decidir_zonas para el tipo 'finca'. Mismos frenos:
--   solo un límite que campo trabajó (tiene fila en geo.zona_revision), y la
--   decisión deja el estado y la geometría de ANTES en geo.zona_decision.
--     confirmar → el límite queda como está (estado 'validada'); se anota
--                 quién y cuándo en propiedades. NO pasa a 'definitiva': ese
--                 estado es el de los lotes de siembra y lo leen la nucleación
--                 y la app de actividades.
--     editar    → el SIG corrige el límite (origen 'sig', version+1).
--     eliminar  → sale del juego (vigente=false, 'descartada'). No se borra.
--   Solo service_role: pasa por /api/sig/campo, que exige sesión.
-- ████████████████████████████████████████████████████████████

CREATE OR REPLACE FUNCTION geo.decidir_limite(
  p_predio_id UUID,
  p_zona_id   UUID,
  p_decision  TEXT,                 -- confirmar | editar | eliminar
  p_geojson   TEXT DEFAULT NULL,    -- solo 'editar'
  p_por       TEXT DEFAULT NULL,
  p_nota      TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_zona geo.zonas%ROWTYPE;
  v_geom geometry;
BEGIN
  IF p_decision IS NULL OR p_decision NOT IN ('confirmar','editar','eliminar') THEN
    RAISE EXCEPTION 'Decisión inválida: %', p_decision;
  END IF;

  SELECT * INTO v_zona FROM geo.zonas
  WHERE id = p_zona_id AND predio_id = p_predio_id AND tipo = 'finca'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa zona no es el límite de este predio';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM geo.zona_revision r WHERE r.zona_id = p_zona_id) THEN
    RAISE EXCEPTION 'Ese límite no tiene resultados de campo';
  END IF;

  IF p_decision = 'editar' THEN
    IF p_geojson IS NULL THEN RAISE EXCEPTION 'Falta la geometría editada'; END IF;
    v_geom := ST_Multi(ST_CollectionExtract(
                ST_MakeValid(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326))), 3));
    IF v_geom IS NULL OR ST_IsEmpty(v_geom) THEN
      RAISE EXCEPTION 'La geometría editada quedó vacía o no es un polígono';
    END IF;
  END IF;

  INSERT INTO geo.zona_decision
    (zona_id, predio_id, decision, estado_previo, vigente_previo, geom_previa, geom_nueva, area_ha, nota, decidido_por)
  VALUES
    (p_zona_id, p_predio_id,
     CASE p_decision WHEN 'confirmar' THEN 'confirmada' WHEN 'editar' THEN 'editada' ELSE 'eliminada' END,
     v_zona.estado, v_zona.vigente, v_zona.geom,
     CASE WHEN p_decision = 'editar' THEN v_geom END,
     CASE WHEN p_decision = 'editar' THEN ST_Area(v_geom::geography) / 10000.0 ELSE v_zona.area_ha END,
     p_nota, p_por);

  IF p_decision = 'confirmar' THEN
    UPDATE geo.zonas
       SET vigente = TRUE,
           propiedades = COALESCE(propiedades, '{}'::jsonb)
                         || jsonb_build_object('limite_confirmado_por', p_por, 'limite_confirmado_at', NOW()),
           updated_at = NOW()
     WHERE id = p_zona_id;
  ELSIF p_decision = 'editar' THEN
    UPDATE geo.zonas
       SET geom        = v_geom,
           area_ha     = ST_Area(v_geom::geography) / 10000.0,
           perimetro_m = ST_Perimeter(v_geom::geography),
           origen      = 'sig',
           vigente     = TRUE,
           version     = version + 1,
           propiedades = COALESCE(propiedades, '{}'::jsonb)
                         || jsonb_build_object('limite_confirmado_por', p_por, 'limite_confirmado_at', NOW()),
           updated_at  = NOW()
     WHERE id = p_zona_id;
  ELSE
    UPDATE geo.zonas
       SET estado = 'descartada', vigente = FALSE, reemplazada_at = NOW(),
           version = version + 1, updated_at = NOW()
     WHERE id = p_zona_id;
  END IF;

  RETURN p_zona_id;
END;
$$;

REVOKE ALL ON FUNCTION geo.decidir_limite(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION geo.decidir_limite(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr (lectura)
-- ============================================================
--   select flujo_campo, count(*) from core.expedientes group by 1;     -- todo 'sig_primero'
--   select count(*) from core.v_predios_campo;                          -- igual que antes de correrla
--   select proname, pronargs from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where nspname = 'geo' and proname in ('revisar_zona','revisar_zona_campo','decidir_limite');
--     → revisar_zona 10, revisar_zona_campo 11, decidir_limite 6 (una fila cada una)
--   select has_function_privilege('anon', 'geo.revisar_zona_campo(text,uuid,text,text,uuid,text,text,text,text,date,text)', 'execute');  -- true
--   select has_function_privilege('anon', 'geo.decidir_limite(uuid,uuid,text,text,text,text)', 'execute');                              -- false
-- ============================================================
