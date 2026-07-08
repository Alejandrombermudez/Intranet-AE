-- ============================================================
--  Migración: SIG II — corrección de zonas desde la app de Campo
--  Archivo : docs/sql/migration_zona_revision.sql
--  Ejecutar: Supabase SQL Editor (después de migration_campo_core_v2.sql)
--  Creado  : Julio 2026
--
--  Qué hace (diseño en ARQUITECTURA_DATOS.md §2.2, tabla geo.zona_revision):
--    1. Amplía geo.zonas.estado con 'descartada' (zona que campo rechazó).
--    2. Crea geo.zona_revision: auditoría de cada acción de campo sobre una
--       zona — conserva SIEMPRE la geometría original, quién, cuándo y cómo.
--    3. RPC geo.revisar_zona (SECURITY DEFINER): única puerta de escritura
--       para la PWA (anon, sin login). Idempotente por local_id (el sync
--       offline puede reintentar sin duplicar). Acciones:
--         confirmada  → la zona está bien tal cual (estado='validada')
--         modificada  → geometría corregida en campo (geom nueva, version+1)
--         nueva       → zona dibujada en campo (INSERT origen='campo')
--         descartada  → la zona no aplica (estado='descartada')
--    4. Excluye descartadas del candado de core.v_predios_campo.
--
--  La PWA NO recibe UPDATE/INSERT directo sobre geo.zonas — solo el RPC.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. estado 'descartada' en geo.zonas
-- ────────────────────────────────────────────────────────────
ALTER TABLE geo.zonas DROP CONSTRAINT IF EXISTS zonas_estado_check;
ALTER TABLE geo.zonas ADD CONSTRAINT zonas_estado_check
  CHECK (estado IN ('potencial','validada','definitiva','avalada','descartada'));


-- ────────────────────────────────────────────────────────────
-- 2. geo.zona_revision — auditoría de SIG II
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.zona_revision (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  local_id       TEXT UNIQUE,             -- UUID generado en la PWA (idempotencia del sync)
  zona_id        UUID REFERENCES geo.zonas(id) ON DELETE SET NULL,
  predio_id      UUID NOT NULL REFERENCES core.predios(id) ON DELETE CASCADE,

  accion         TEXT NOT NULL CHECK (accion IN ('confirmada','modificada','nueva','descartada')),
  metodo         TEXT CHECK (metodo IN ('vertices','gps','nueva')),

  geom_original  geometry(MultiPolygon, 4326),   -- cómo estaba ANTES (null en 'nueva')
  geom_corregida geometry(MultiPolygon, 4326),   -- cómo quedó (null en 'confirmada'/'descartada')
  area_ha_campo  NUMERIC,                        -- área de la geometría corregida/nueva

  observaciones  TEXT,
  evaluador      TEXT,
  fecha          DATE DEFAULT CURRENT_DATE,
  sync_origin    TEXT DEFAULT 'pwa',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE geo.zona_revision IS
  'SIG II: cada acción de la app de Campo sobre una zona (confirmar/modificar/crear/descartar). Conserva la geometría original — geo.zonas guarda solo la versión vigente.';

CREATE INDEX IF NOT EXISTS idx_zona_revision_zona   ON geo.zona_revision(zona_id);
CREATE INDEX IF NOT EXISTS idx_zona_revision_predio ON geo.zona_revision(predio_id);

ALTER TABLE geo.zona_revision ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "zona_revision_select" ON geo.zona_revision;
CREATE POLICY "zona_revision_select" ON geo.zona_revision FOR SELECT TO authenticated USING (true);
-- Sin política de INSERT: la única escritura es vía el RPC (SECURITY DEFINER).

GRANT SELECT ON geo.zona_revision TO authenticated, service_role;


-- ────────────────────────────────────────────────────────────
-- 3. RPC geo.revisar_zona — puerta única de escritura para la PWA
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION geo.revisar_zona(
  p_local_id      TEXT,                -- UUID de la PWA; si ya existe, no repite (idempotente)
  p_predio_id     UUID,
  p_accion        TEXT,                -- confirmada | modificada | nueva | descartada
  p_zona_id       UUID    DEFAULT NULL, -- requerido salvo en 'nueva'
  p_geojson       TEXT    DEFAULT NULL, -- geometría GeoJSON 4326 (en 'modificada'/'nueva')
  p_observaciones TEXT    DEFAULT NULL,
  p_evaluador     TEXT    DEFAULT NULL,
  p_metodo        TEXT    DEFAULT NULL, -- vertices | gps | nueva
  p_fecha         DATE    DEFAULT NULL
) RETURNS UUID                          -- id de la zona afectada (la nueva, si accion='nueva')
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, geo
AS $$
DECLARE
  v_zona_id   UUID := p_zona_id;
  v_geom      geometry;
  v_geom_orig geometry;
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
  IF v_zona_id IS NOT NULL THEN
    SELECT geom INTO v_geom_orig FROM geo.zonas WHERE id = v_zona_id AND predio_id = p_predio_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'La zona % no existe en el predio %', v_zona_id, p_predio_id; END IF;
  END IF;

  IF p_accion = 'confirmada' THEN
    UPDATE geo.zonas
    SET estado = 'validada', updated_at = NOW()
    WHERE id = v_zona_id;

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

  ELSIF p_accion = 'nueva' THEN
    INSERT INTO geo.zonas (predio_id, tipo, estado, origen, geom, area_ha, perimetro_m, created_by)
    VALUES (p_predio_id, 'restauracion', 'validada', 'campo',
            v_geom, ST_Area(v_geom::geography) / 10000.0, ST_Perimeter(v_geom::geography), p_evaluador)
    RETURNING id INTO v_zona_id;

  ELSIF p_accion = 'descartada' THEN
    UPDATE geo.zonas
    SET estado = 'descartada', version = version + 1, updated_at = NOW()
    WHERE id = v_zona_id;
  END IF;

  INSERT INTO geo.zona_revision
    (local_id, zona_id, predio_id, accion, metodo, geom_original, geom_corregida, area_ha_campo,
     observaciones, evaluador, fecha, sync_origin)
  VALUES
    (p_local_id, v_zona_id, p_predio_id, p_accion, p_metodo, v_geom_orig,
     CASE WHEN p_accion IN ('modificada','nueva') THEN v_geom END,
     CASE WHEN p_accion IN ('modificada','nueva') THEN ST_Area(v_geom::geography) / 10000.0 END,
     p_observaciones, p_evaluador, COALESCE(p_fecha, CURRENT_DATE), 'pwa');

  RETURN v_zona_id;
END;
$$;

GRANT EXECUTE ON FUNCTION geo.revisar_zona TO anon, authenticated, service_role;


-- ────────────────────────────────────────────────────────────
-- 4. Candado de Campo: no contar zonas descartadas
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
    WHERE z.predio_id = p.id AND z.tipo = 'restauracion' AND z.estado <> 'descartada'
  );

GRANT SELECT ON core.v_predios_campo TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ────────────────────────────────────────────────────────────
-- Verificación sugerida tras correr esta migración:
--   select to_regclass('geo.zona_revision');            -- no debe ser NULL
--   select proname from pg_proc join pg_namespace n on n.oid = pronamespace
--     where nspname='geo' and proname='revisar_zona';   -- debe existir
--   -- prueba idempotente (misma local_id dos veces → una sola revisión):
--   --   select geo.revisar_zona('test-1', '<predio>', 'confirmada', '<zona>');
--   --   select geo.revisar_zona('test-1', '<predio>', 'confirmada', '<zona>');
--   --   select count(*) from geo.zona_revision where local_id='test-1';  -- = 1
-- ============================================================
