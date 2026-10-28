-- ============================================================
--  SITIOS CON TIPO DE PROYECTO Y CAPA DE APOYO QUE SE TRABAJA (2026-10-21)
--  Archivo: docs/sql/migration_sitios_proyecto.sql
--
--  CÓMO CORRERLA
--    Supabase → SQL Editor → pegar el archivo completo → Run.
--    Se puede volver a correr sin romper nada. Solo esquema, sin datos.
--    Requiere migration_campo_primero.sql (ya corrida el 2026-10-21).
--
--  QUÉ CAMBIA (decisión del usuario, 2026-10-21)
--    · Cada sitio de siembra que campo confirma, corrige o dibuja lleva su TIPO
--      DE PROYECTO: 'ley_arbol' (Ley del Árbol), 'mercado_carbono' (Mercado
--      voluntario de carbono) o 'ganaderia_sostenible' (Ganadería sostenible).
--      Nombres corregidos por el usuario el 2026-10-27, antes de correrla (la
--      primera versión decía 'conexion' y 'pastoreo'). Lo elige el técnico; si el
--      sitio sale de la capa de apoyo, la app se lo sugiere según la clase del
--      shapefile (a la izquierda el nombre en la capa):
--        Ley del Arbol                          → ley_arbol
--        Mercado voluntario de carbono          → mercado_carbono
--        No elegible: Cobertura o zonificación  → ganaderia_sostenible
--      Los celulares que guardaron 'conexion' o 'pastoreo' entre el 21 y el 27 de
--      octubre los mandan así: geo.anotar_revision_campo los traduce.
--    · Las áreas de la capa de apoyo dejan de ser solo guía: el técnico toca una
--      y la usa como sitio (tal cual o ajustada) o la rechaza con un motivo.
--      Usarla es una revisión 'nueva' de siempre, que además dice de qué área
--      salió; rechazarla queda en geo.capa_apoyo_revision.
--
--  LO QUE NO CAMBIA, A PROPÓSITO
--    Ninguna función existente cambia de firma: geo.revisar_zona y
--    geo.revisar_zona_campo los usan los celulares instalados, y cambiarles la
--    firma exige DROP (entre el DROP y el CREATE fallarían). Por eso el tipo de
--    proyecto y el área de origen viajan en una llamada APARTE,
--    geo.anotar_revision_campo, que la app hace después de subir la revisión.
--    Si esta migración no ha corrido, la geometría sube igual; el tipo de
--    proyecto queda en el celular (y en la evaluación) y se anota después.
--
--  TRAE
--    PARTE 1  geo.zona_revision + proyecto y capa_apoyo_id
--    PARTE 2  geo.anotar_revision_campo (anon): anota proyecto y origen de una
--             revisión ya subida, y deja el proyecto en geo.zonas.propiedades
--    PARTE 3  geo.capa_apoyo_revision + geo.revisar_capa_apoyo (anon): campo
--             rechaza un área de la capa de apoyo, con motivo
--    PARTE 4  geo.decisiones_capa_apoyo_campo() (anon): qué áreas ya se usaron
--             o rechazaron, para que otro celular lo vea
-- ============================================================


-- ████████████████████████████████████████████████████████████
-- PARTE 1 — El tipo de proyecto y el origen, en la revisión de campo
-- ████████████████████████████████████████████████████████████

ALTER TABLE geo.zona_revision ADD COLUMN IF NOT EXISTS proyecto TEXT;
ALTER TABLE geo.zona_revision ADD COLUMN IF NOT EXISTS capa_apoyo_id UUID;

DO $$
BEGIN
  -- Se rehace siempre: si una corrida anterior la dejó con los nombres viejos
  -- ('conexion', 'pastoreo'), se reemplaza y lo que hubiera se traduce.
  ALTER TABLE geo.zona_revision DROP CONSTRAINT IF EXISTS zona_revision_proyecto_check;
  UPDATE geo.zona_revision
  SET proyecto = CASE proyecto WHEN 'conexion' THEN 'mercado_carbono' ELSE 'ganaderia_sostenible' END
  WHERE proyecto IN ('conexion', 'pastoreo');
  ALTER TABLE geo.zona_revision ADD CONSTRAINT zona_revision_proyecto_check
    CHECK (proyecto IS NULL OR proyecto IN ('ley_arbol', 'mercado_carbono', 'ganaderia_sostenible'));
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zona_revision_capa_apoyo_fk') THEN
    ALTER TABLE geo.zona_revision ADD CONSTRAINT zona_revision_capa_apoyo_fk
      FOREIGN KEY (capa_apoyo_id) REFERENCES geo.capas_apoyo(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN geo.zona_revision.proyecto IS
  'Tipo de proyecto que campo le dio al sitio: ley_arbol | mercado_carbono | ganaderia_sostenible. Lo anota geo.anotar_revision_campo después de subir la revisión.';
COMMENT ON COLUMN geo.zona_revision.capa_apoyo_id IS
  'Si el sitio se dibujó a partir de un área de la capa de apoyo (geo.capas_apoyo), cuál.';


-- ████████████████████████████████████████████████████████████
-- PARTE 2 — geo.anotar_revision_campo
--   Se llama DESPUÉS de geo.revisar_zona / geo.revisar_zona_campo, con el mismo
--   local_id. Devuelve FALSE si esa revisión todavía no está en el servidor (la
--   app reintenta). Repetible: anotar dos veces deja lo último.
--   El proyecto también queda en geo.zonas.propiedades->>'proyecto' (salvo en
--   un descarte), que es donde lo leen la intranet y la nucleación.
-- ████████████████████████████████████████████████████████████

CREATE OR REPLACE FUNCTION geo.anotar_revision_campo(
  p_local_id       TEXT,
  p_proyecto       TEXT DEFAULT NULL,
  p_capa_apoyo_id  UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, geo
AS $$
DECLARE
  v_rev geo.zona_revision%ROWTYPE;
BEGIN
  -- Nombres de la primera versión de la app (21 al 27 de octubre de 2026)
  p_proyecto := CASE p_proyecto WHEN 'conexion' THEN 'mercado_carbono'
                                WHEN 'pastoreo' THEN 'ganaderia_sostenible'
                                ELSE p_proyecto END;
  IF p_proyecto IS NOT NULL AND p_proyecto NOT IN ('ley_arbol', 'mercado_carbono', 'ganaderia_sostenible') THEN
    RAISE EXCEPTION 'Tipo de proyecto inválido: % (ley_arbol | mercado_carbono | ganaderia_sostenible)', p_proyecto;
  END IF;

  SELECT * INTO v_rev FROM geo.zona_revision WHERE local_id = p_local_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- El área de origen tiene que ser del mismo predio (o se ignora).
  IF p_capa_apoyo_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM geo.capas_apoyo c WHERE c.id = p_capa_apoyo_id AND c.predio_id = v_rev.predio_id) THEN
    p_capa_apoyo_id := NULL;
  END IF;

  UPDATE geo.zona_revision
  SET proyecto      = COALESCE(p_proyecto, proyecto),
      capa_apoyo_id = COALESCE(p_capa_apoyo_id, capa_apoyo_id)
  WHERE id = v_rev.id;

  IF p_proyecto IS NOT NULL AND v_rev.zona_id IS NOT NULL AND v_rev.accion <> 'descartada' THEN
    UPDATE geo.zonas
    SET propiedades = COALESCE(propiedades, '{}'::jsonb) || jsonb_build_object('proyecto', p_proyecto),
        updated_at  = NOW()
    WHERE id = v_rev.zona_id AND tipo = 'restauracion';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION geo.anotar_revision_campo(TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION geo.anotar_revision_campo(TEXT, TEXT, UUID) TO anon, authenticated, service_role;


-- ████████████████████████████████████████████████████████████
-- PARTE 3 — Campo rechaza un área de la capa de apoyo
--   Con motivo obligatorio. No borra ni toca el área: anota que en terreno no
--   sirve y por qué. Si después se usa igual como sitio, manda el uso.
-- ████████████████████████████████████████████████████████████

CREATE TABLE IF NOT EXISTS geo.capa_apoyo_revision (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id       TEXT NOT NULL UNIQUE,              -- idempotencia (la manda el celular)
  capa_apoyo_id  UUID NOT NULL REFERENCES geo.capas_apoyo(id) ON DELETE CASCADE,
  predio_id      UUID NOT NULL REFERENCES core.predios(id) ON DELETE CASCADE,
  accion         TEXT NOT NULL CHECK (accion IN ('descartada')),
  observaciones  TEXT NOT NULL CHECK (btrim(observaciones) <> ''),
  evaluador      TEXT,
  fecha          DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS capa_apoyo_revision_capa_idx ON geo.capa_apoyo_revision (capa_apoyo_id);

COMMENT ON TABLE geo.capa_apoyo_revision IS
  'Lo que dijo campo de un área de la capa de apoyo que NO usó como sitio (rechazada, con motivo). El uso no va aquí: es una revisión ''nueva'' con capa_apoyo_id en geo.zona_revision.';

ALTER TABLE geo.capa_apoyo_revision ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON geo.capa_apoyo_revision FROM anon, authenticated;
GRANT ALL ON geo.capa_apoyo_revision TO service_role;

CREATE OR REPLACE FUNCTION geo.revisar_capa_apoyo(
  p_local_id       TEXT,
  p_capa_apoyo_id  UUID,
  p_accion         TEXT,
  p_observaciones  TEXT,
  p_evaluador      TEXT DEFAULT NULL,
  p_fecha          DATE DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, geo
AS $$
DECLARE
  v_id      UUID;
  v_predio  UUID;
BEGIN
  SELECT id INTO v_id FROM geo.capa_apoyo_revision WHERE local_id = p_local_id;
  IF FOUND THEN RETURN v_id; END IF;

  IF p_accion IS DISTINCT FROM 'descartada' THEN
    RAISE EXCEPTION 'Acción inválida: % (descartada)', p_accion;
  END IF;
  IF COALESCE(btrim(p_observaciones), '') = '' THEN
    RAISE EXCEPTION 'Rechazar un área de la capa de apoyo pide el motivo';
  END IF;

  -- Solo áreas de predios que la app de campo ve.
  SELECT c.predio_id INTO v_predio
  FROM geo.capas_apoyo c
  WHERE c.id = p_capa_apoyo_id
    AND c.predio_id IN (SELECT v.predio_id FROM core.v_predios_campo v);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El área % no existe o su predio no está en campo', p_capa_apoyo_id;
  END IF;

  INSERT INTO geo.capa_apoyo_revision (local_id, capa_apoyo_id, predio_id, accion, observaciones, evaluador, fecha)
  VALUES (p_local_id, p_capa_apoyo_id, v_predio, p_accion, btrim(p_observaciones), p_evaluador,
          COALESCE(p_fecha, (NOW() AT TIME ZONE 'America/Bogota')::date))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION geo.revisar_capa_apoyo(TEXT, UUID, TEXT, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION geo.revisar_capa_apoyo(TEXT, UUID, TEXT, TEXT, TEXT, DATE) TO anon, authenticated, service_role;


-- ████████████████████████████████████████████████████████████
-- PARTE 4 — Qué áreas ya trabajó campo (para el celular que llega después)
--   'usada' si alguna revisión de sitio salió de ella; si no, 'descartada' con
--   el motivo más reciente. Función aparte de geo.capas_apoyo_campo() para no
--   cambiar la forma de esa (RETURNS TABLE exige DROP).
-- ████████████████████████████████████████████████████████████

CREATE OR REPLACE FUNCTION geo.decisiones_capa_apoyo_campo()
RETURNS TABLE (
  capa_apoyo_id  UUID,
  estado         TEXT,
  observaciones  TEXT,
  evaluador      TEXT,
  fecha          DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, geo
AS $$
  WITH visibles AS (
    SELECT c.id FROM geo.capas_apoyo c
    WHERE c.vigente AND c.predio_id IN (SELECT v.predio_id FROM core.v_predios_campo v)
  ),
  usadas AS (
    SELECT DISTINCT ON (r.capa_apoyo_id) r.capa_apoyo_id, r.observaciones, r.evaluador, r.fecha
    FROM geo.zona_revision r
    WHERE r.capa_apoyo_id IN (SELECT id FROM visibles) AND r.accion <> 'descartada'
    ORDER BY r.capa_apoyo_id, r.created_at DESC
  ),
  rechazadas AS (
    SELECT DISTINCT ON (d.capa_apoyo_id) d.capa_apoyo_id, d.observaciones, d.evaluador, d.fecha
    FROM geo.capa_apoyo_revision d
    WHERE d.capa_apoyo_id IN (SELECT id FROM visibles)
    ORDER BY d.capa_apoyo_id, d.created_at DESC
  )
  SELECT u.capa_apoyo_id, 'usada', u.observaciones, u.evaluador, u.fecha FROM usadas u
  UNION ALL
  SELECT d.capa_apoyo_id, 'descartada', d.observaciones, d.evaluador, d.fecha FROM rechazadas d
  WHERE d.capa_apoyo_id NOT IN (SELECT capa_apoyo_id FROM usadas);
$$;

REVOKE ALL ON FUNCTION geo.decisiones_capa_apoyo_campo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION geo.decisiones_capa_apoyo_campo() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr (lectura)
-- ============================================================
--   select column_name from information_schema.columns
--    where table_schema = 'geo' and table_name = 'zona_revision' and column_name in ('proyecto', 'capa_apoyo_id');  -- 2 filas
--   select proname, pronargs from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where nspname = 'geo' and proname in ('anotar_revision_campo', 'revisar_capa_apoyo', 'decisiones_capa_apoyo_campo',
--                                          'revisar_zona', 'revisar_zona_campo');
--     → anotar 3, revisar_capa_apoyo 6, decisiones 0; revisar_zona 10 y revisar_zona_campo 11 sin cambio
--   select has_function_privilege('anon', 'geo.anotar_revision_campo(text,text,uuid)', 'execute');   -- true
--   select has_table_privilege('anon', 'geo.capa_apoyo_revision', 'select');                          -- false
-- ============================================================
