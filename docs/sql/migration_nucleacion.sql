-- ============================================================
--  MIGRACIÓN: lotes de siembra + nucleación
--  Archivo: docs/sql/migration_nucleacion.sql
--  Fecha  : 2026-09-20
--  Requiere: migration_geo.sql, migration_geo_v2/v3, migration_zona_revision.sql
--            y migration_geo_versionado.sql ejecutados, Y migration_renombrar_carga.sql
--            corrida ANTES que esta.
--
--  EL PASO QUE FALTABA
--    El tramo SIG → Campo → SIG II ya cierra: la oficina propone zonas, el
--    técnico las confirma, modifica, descarta o agrega en terreno, y el SIG ve
--    el resultado. Pero ahí se acababa. Lo que sigue en el proceso real es:
--
--      1. El SIG revisa lo que volvió de campo y lo da por bueno.
--         Cada zona que queda buena es un LOTE de siembra. Un predio puede
--         quedar con 0, 1 o n lotes (campo puede haberlas descartado todas).
--      2. Sobre esos lotes se sube la NUCLEACIÓN: los núcleos de siembra
--         dibujados dentro de cada lote.
--
--  UN LOTE NO ES UNA TABLA NUEVA
--    Un lote es una zona de `geo.zonas` (tipo='restauracion') que el SIG dio
--    por definitiva: `estado = 'definitiva'`. Ese estado ya existía en el CHECK
--    desde migration_geo.sql y nadie lo usaba — era exactamente este paso.
--    No se inventa una entidad paralela que habría que mantener sincronizada.
--
--  "LOTE" AQUÍ SIGNIFICA UNA SOLA COSA
--    El pedazo de tierra donde se siembra: una zona `definitiva`.
--    La subida versionada del SIG, que antes también se llamaba lote, pasó a
--    llamarse CARGA (`geo.zonas_carga`) en migration_renombrar_carga.sql, que
--    hay que correr ANTES que esta. Si al abrir la base todavía existe
--    `geo.zonas_lote`, ese renombre está pendiente.
--
--  POR QUÉ ES SEGURO PARA LA APP DE CAMPO (en producción)
--    Verificado en app_campo antes de escribir esto:
--      · `src/lib/core.ts` descarta solo `estado = 'descartada'` → una zona
--        `definitiva` se sigue bajando al celular igual que una `validada`.
--      · `src/lib/actualizarSig.ts` compara GEOMETRÍA y ÁREA para avisar de
--        cambios del SIG; el estado no entra en la comparación → confirmar
--        lotes no le genera aviso ni ruido a quien está en terreno.
--    Y `core.v_predios_campo` exige `estado <> 'descartada'`: también pasa.
--
--  PASO MANUAL: ninguno (geo ya está en Exposed schemas).
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — La nucleación
--   Cada núcleo cuelga del LOTE que lo contiene. La geometría se deja
--   genérica a propósito: el SIG puede entregar los núcleos como polígonos
--   (el área que ocupa cada núcleo) o como puntos (dónde va cada uno), y las
--   dos cosas entran sin migrar nada.
--
--   Va primero porque geo.deshacer_lotes (BLOQUE 2) consulta esta tabla.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS geo.nucleos_carga (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  predio_id  UUID NOT NULL REFERENCES core.predios(id) ON DELETE CASCADE,
  version    INT  NOT NULL DEFAULT 1,
  nota       TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE geo.nucleos_carga IS
  'Cada subida de nucleación de un predio, con versión. Resubir no borra: la carga anterior queda vigente=false, como el versionado de zonas.';

CREATE TABLE IF NOT EXISTS geo.nucleos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  predio_id  UUID NOT NULL REFERENCES core.predios(id)      ON DELETE CASCADE,
  -- El lote (zona definitiva) que lo contiene. NULL = cayó fuera de todo lote:
  -- se guarda igual y la intranet lo muestra aparte para que el SIG decida.
  zona_id    UUID          REFERENCES geo.zonas(id)         ON DELETE SET NULL,
  carga_id   UUID          REFERENCES geo.nucleos_carga(id) ON DELETE SET NULL,

  nombre     TEXT,
  -- Punto o polígono, según entregue el SIG
  geom       geometry(Geometry, 4326) NOT NULL,
  area_ha    NUMERIC,      -- solo si es polígono; en puntos queda NULL
  n_plantas  INT,          -- si el .dbf lo trae
  propiedades JSONB,       -- la fila completa del .dbf, como en geo.zonas

  origen     TEXT NOT NULL DEFAULT 'sig' CHECK (origen IN ('sig','campo','ia')),
  vigente    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE geo.nucleos IS
  'Núcleos de siembra dentro de un lote (zona con estado=definitiva). Geometría genérica: puntos o polígonos. zona_id NULL = el núcleo no cayó dentro de ningún lote.';

CREATE INDEX IF NOT EXISTS idx_nucleos_geom   ON geo.nucleos USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_nucleos_predio ON geo.nucleos(predio_id);
CREATE INDEX IF NOT EXISTS idx_nucleos_zona   ON geo.nucleos(zona_id);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — Confirmar / deshacer lotes de siembra
--   Pasa a 'definitiva' las zonas que el SIG da por buenas después de campo.
--   Solo toca zonas de restauración, vigentes y no descartadas: no se puede
--   "confirmar" algo que el terreno rechazó.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION geo.confirmar_lotes(
  p_predio_id UUID,
  p_zona_ids  UUID[],
  p_por       TEXT DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_n INT;
BEGIN
  IF p_predio_id IS NULL THEN
    RAISE EXCEPTION 'Falta el predio';
  END IF;

  UPDATE geo.zonas
     SET estado = 'definitiva', updated_at = NOW()
   WHERE predio_id = p_predio_id
     AND tipo = 'restauracion'
     AND vigente
     AND estado <> 'descartada'
     AND (p_zona_ids IS NULL OR id = ANY(p_zona_ids));

  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- Deja rastro de quién lo dio por bueno, sin columna nueva: el lote de
  -- subida no aplica aquí, y `propiedades` ya es el saco de atributos.
  IF v_n > 0 AND p_por IS NOT NULL THEN
    UPDATE geo.zonas
       SET propiedades = COALESCE(propiedades, '{}'::jsonb)
             || jsonb_build_object('lote_confirmado_por', p_por,
                                   'lote_confirmado_at', NOW())
     WHERE predio_id = p_predio_id
       AND tipo = 'restauracion'
       AND estado = 'definitiva'
       AND vigente
       AND (p_zona_ids IS NULL OR id = ANY(p_zona_ids));
  END IF;

  RETURN v_n;
END;
$$;

-- Deshacer: vuelve el lote a 'validada'. No se permite si ya tiene núcleos
-- vigentes colgados — primero se quita la nucleación, para no dejarla huérfana.
CREATE OR REPLACE FUNCTION geo.deshacer_lotes(
  p_predio_id UUID,
  p_zona_ids  UUID[] DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_n INT;
  v_con_nucleos INT;
BEGIN
  SELECT COUNT(*) INTO v_con_nucleos
  FROM geo.nucleos n
  WHERE n.predio_id = p_predio_id AND n.vigente
    AND (p_zona_ids IS NULL OR n.zona_id = ANY(p_zona_ids));

  IF v_con_nucleos > 0 THEN
    RAISE EXCEPTION 'Esos lotes tienen % núcleo(s) de nucleación cargados. Reemplaza o retira la nucleación antes de deshacerlos.', v_con_nucleos;
  END IF;

  UPDATE geo.zonas
     SET estado = 'validada', updated_at = NOW()
   WHERE predio_id = p_predio_id
     AND tipo = 'restauracion'
     AND estado = 'definitiva'
     AND (p_zona_ids IS NULL OR id = ANY(p_zona_ids));

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — Guardar un núcleo, asignándole su lote solo
--   La intranet manda el GeoJSON; la base decide a qué lote pertenece por
--   geometría (el que lo contiene; si ninguno lo contiene del todo, el que más
--   lo intersecte). Así el SIG sube un solo archivo con todos los núcleos del
--   predio y no tiene que separarlos a mano por lote.
-- ════════════════════════════════════════════════════════════

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
  v_geom := ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson), 4326));
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


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — Abrir y cerrar una carga de nucleación
--   Mismo principio que el versionado de zonas: la subida nueva reemplaza a la
--   anterior, pero la anterior NO se borra (queda vigente=false).
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION geo.abrir_carga_nucleos(
  p_predio_id UUID,
  p_created_by TEXT DEFAULT NULL,
  p_nota TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_version INT;
  v_id UUID;
BEGIN
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM geo.nucleos_carga WHERE predio_id = p_predio_id;

  INSERT INTO geo.nucleos_carga (predio_id, version, nota, created_by)
  VALUES (p_predio_id, v_version, p_nota, p_created_by)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- p_reemplazar = true  → la nucleación anterior del predio queda vigente=false
-- p_reemplazar = false → los núcleos nuevos se suman a los que ya había
CREATE OR REPLACE FUNCTION geo.cerrar_carga_nucleos(
  p_carga_id   UUID,
  p_reemplazar BOOLEAN DEFAULT TRUE
) RETURNS TABLE (nucleos INT, retirados INT, sin_lote INT)
LANGUAGE plpgsql
SET search_path = public, geo
AS $$
DECLARE
  v_predio UUID;
  v_n INT; v_ret INT := 0; v_sin INT;
BEGIN
  SELECT predio_id INTO v_predio FROM geo.nucleos_carga WHERE id = p_carga_id;
  IF v_predio IS NULL THEN
    RAISE EXCEPTION 'La carga de nucleación no existe';
  END IF;

  IF p_reemplazar THEN
    UPDATE geo.nucleos
       SET vigente = FALSE, updated_at = NOW()
     WHERE predio_id = v_predio
       AND vigente
       AND (carga_id IS DISTINCT FROM p_carga_id);
    GET DIAGNOSTICS v_ret = ROW_COUNT;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE zona_id IS NULL)
    INTO v_n, v_sin
  FROM geo.nucleos WHERE carga_id = p_carga_id;

  RETURN QUERY SELECT v_n, v_ret, v_sin;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — Lectura: los lotes de un predio con su nucleación
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION geo.lotes_de_predio(p_predio_id uuid)
RETURNS TABLE (
  zona_id      uuid,
  nombre       text,
  estado       text,
  origen       text,
  area_ha      numeric,
  geojson      text,
  n_nucleos    bigint,
  ha_nucleos   numeric,
  plantas      bigint
)
LANGUAGE sql STABLE
SET search_path = public, geo
AS $$
  SELECT z.id, z.nombre, z.estado, z.origen, z.area_ha, ST_AsGeoJSON(z.geom),
         COUNT(n.id),
         ROUND(COALESCE(SUM(n.area_ha), 0)::numeric, 4),
         COALESCE(SUM(n.n_plantas), 0)
  FROM geo.zonas z
  LEFT JOIN geo.nucleos n ON n.zona_id = z.id AND n.vigente
  WHERE z.predio_id = p_predio_id
    AND z.tipo = 'restauracion'
    AND z.vigente
    AND z.estado <> 'descartada'
  GROUP BY z.id
  ORDER BY z.created_at;
$$;

CREATE OR REPLACE FUNCTION geo.nucleos_de_predio(p_predio_id uuid)
RETURNS TABLE (
  id          uuid,
  zona_id     uuid,
  nombre      text,
  area_ha     numeric,
  n_plantas   int,
  propiedades jsonb,
  geojson     text
)
LANGUAGE sql STABLE
SET search_path = public, geo
AS $$
  SELECT id, zona_id, nombre, area_ha, n_plantas, propiedades, ST_AsGeoJSON(geom)
  FROM geo.nucleos
  WHERE predio_id = p_predio_id AND vigente
  ORDER BY created_at;
$$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 — RLS + permisos (mismo patrón que el resto de geo)
-- ════════════════════════════════════════════════════════════

ALTER TABLE geo.nucleos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo.nucleos_carga ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geo_nucleos_select"       ON geo.nucleos;
DROP POLICY IF EXISTS "geo_nucleos_carga_select" ON geo.nucleos_carga;
CREATE POLICY "geo_nucleos_select"       ON geo.nucleos       FOR SELECT TO authenticated USING (true);
CREATE POLICY "geo_nucleos_carga_select" ON geo.nucleos_carga FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON geo.nucleos       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON geo.nucleos_carga TO authenticated, service_role;

-- Estas funciones ESCRIBEN y solo las llama la intranet por service_role: se
-- les quita el EXECUTE que Postgres regala a PUBLIC (ver migration_predio_grupos_v2).
REVOKE EXECUTE ON FUNCTION geo.confirmar_lotes(uuid, uuid[], text)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION geo.deshacer_lotes(uuid, uuid[])                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION geo.crear_nucleo(uuid, text, uuid, text, int, jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION geo.abrir_carga_nucleos(uuid, text, text)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION geo.cerrar_carga_nucleos(uuid, boolean)          FROM PUBLIC;

GRANT EXECUTE ON FUNCTION geo.confirmar_lotes(uuid, uuid[], text)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION geo.deshacer_lotes(uuid, uuid[])                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION geo.crear_nucleo(uuid, text, uuid, text, int, jsonb, text)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION geo.abrir_carga_nucleos(uuid, text, text)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION geo.cerrar_carga_nucleos(uuid, boolean)           TO authenticated, service_role;
-- Lecturas: las usa la intranet; el celular no las necesita todavía
GRANT EXECUTE ON FUNCTION geo.lotes_de_predio(uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION geo.nucleos_de_predio(uuid)  TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 7 — Recargar PostgREST
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr
-- ============================================================
--  select to_regclass('geo.nucleos');                    -- no NULL
--  select to_regclass('geo.nucleos_carga');              -- no NULL
--  select * from geo.lotes_de_predio('<predio_id>');     -- las zonas no descartadas
--
--  Los dos predios que ya volvieron de campo (Versalles y La Dalia) tienen
--  zonas 'validada': son las candidatas a lote. Antes de confirmar nada:
--    select predio_id, estado, count(*) from geo.zonas
--     where tipo='restauracion' and vigente group by 1,2 order by 1;
--
--  Confirmar lotes NO esconde zonas del celular: app_campo filtra solo
--  'descartada' y compara geometría/área, no estado.
