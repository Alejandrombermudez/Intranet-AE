-- ============================================================
--  MIGRACIÓN: unidades de siembra — varios predios, un solo polígono
--  Archivo: docs/sql/migration_predio_grupos.sql
--  Fecha  : 2026-09-17
--  Requiere: migration_core.sql y migration_geo.sql ejecutados.
--
--  EL PROBLEMA
--    La parte predial y la cartográfica no se corresponden una a una. Un mismo
--    polígono de siembra cae sobre VARIOS predios (englobes, herencias sin
--    partir, fincas contiguas del mismo dueño, o vecinos que entran juntos), y
--    hasta ahora el SIG no tenía cómo decirlo: geo.zonas.predio_id apunta a UN
--    predio, así que el polígono total había que subirlo repetido o partido a
--    mano. En producción ya se ve el síntoma: "Los Andes" carga dos polígonos
--    de finca que son de otros dos predios, y los mismos 251,36 ha y 64,02 ha
--    aparecen también colgados de "Parcela" y "FINCA PROVIDENCIA".
--
--  LA DECISIÓN — fusionar es AGRUPAR, no fundir registros
--    Cada predio conserva su matrícula, su dueño y su expediente jurídico: la
--    debida diligencia es por predio y no se toca. Lo que se comparte es la
--    cartografía. Un grupo ("unidad de siembra") tiene un predio PRINCIPAL, y
--    el polígono total se sube contra ese predio, marcado con el grupo.
--    Coherente con la regla de la casa: nada se destruye, y la fusión se
--    deshace sin perder el rastro (queda disuelto_at, no se borra la fila).
--
--  QUÉ NO CAMBIA (a propósito)
--    · geo.zonas.predio_id sigue siendo NOT NULL y apuntando al predio
--      principal → core.v_predios_campo, geo.zonas_de_predio, el versionado por
--      lotes y la sincronización de app_campo (EN PRODUCCIÓN) siguen viendo
--      exactamente lo mismo que hoy. grupo_id es información añadida.
--    · Enviar a Campo una unidad completa (que los predios miembros también
--      aparezcan en el celular con el polígono de la unidad) es una decisión
--      aparte y NO se toma aquí: hoy sale a campo el predio principal.
--
--  PASO MANUAL: ninguno (core ya está en Exposed schemas).
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — Tablas
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS core.predio_grupos (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  nombre              TEXT NOT NULL,
  -- El predio que lleva la cartografía de la unidad. El polígono se sube
  -- contra él; los demás miembros lo consultan a través del grupo.
  predio_principal_id UUID NOT NULL REFERENCES core.predios(id) ON DELETE CASCADE,
  nota                TEXT,

  -- Deshacer la fusión no borra: la unidad queda disuelta y consultable.
  disuelto_at         TIMESTAMPTZ,
  disuelto_por        TEXT,

  created_by          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE core.predio_grupos IS
  'Unidad de siembra: varios predios que comparten UN polígono del SIG. Agrupa, no funde: cada predio conserva matrícula, dueño y expediente. El polígono vive en geo.zonas colgado del predio principal.';

CREATE TABLE IF NOT EXISTS core.predio_grupo_miembros (
  grupo_id   UUID NOT NULL REFERENCES core.predio_grupos(id) ON DELETE CASCADE,
  predio_id  UUID NOT NULL REFERENCES core.predios(id)       ON DELETE CASCADE,
  -- Se apaga al disolver el grupo o al sacar un predio de la unidad; la fila
  -- se conserva para saber que alguna vez estuvo.
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (grupo_id, predio_id)
);

-- Un predio no puede estar en dos unidades a la vez (sí en una activa y en
-- varias ya disueltas — de ahí el índice parcial).
CREATE UNIQUE INDEX IF NOT EXISTS ux_predio_grupo_miembro_activo
  ON core.predio_grupo_miembros(predio_id) WHERE activo;

CREATE INDEX IF NOT EXISTS idx_predio_grupo_miembros_grupo ON core.predio_grupo_miembros(grupo_id);
CREATE INDEX IF NOT EXISTS idx_predio_grupos_principal     ON core.predio_grupos(predio_principal_id);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — geo.zonas: de qué unidad es este polígono
--   Nullable y sin tocar predio_id: todo lo que ya lee geo.zonas sigue igual.
-- ════════════════════════════════════════════════════════════

ALTER TABLE geo.zonas
  ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES core.predio_grupos(id) ON DELETE SET NULL;

COMMENT ON COLUMN geo.zonas.grupo_id IS
  'Si viene lleno, esta geometría es el polígono TOTAL de una unidad de siembra (core.predio_grupos) y no solo del predio de predio_id. predio_id sigue apuntando al predio principal.';

CREATE INDEX IF NOT EXISTS idx_zonas_grupo ON geo.zonas(grupo_id);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — Fusionar
--   Valida en la base lo que la UI también valida: al menos dos predios, el
--   principal entre ellos, y ninguno comprometido en otra unidad. Devuelve el
--   id del grupo.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.fusionar_predios(
  p_predio_ids  UUID[],
  p_principal   UUID,
  p_nombre      TEXT DEFAULT NULL,
  p_nota        TEXT DEFAULT NULL,
  p_created_by  TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public, core
AS $$
DECLARE
  v_grupo_id  UUID;
  v_ids       UUID[];
  v_n         INT;
  v_nombre    TEXT;
  v_ocupado   TEXT;
BEGIN
  -- Quitar repetidos y nulos que pueda mandar la UI
  SELECT ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_predio_ids, '{}'::uuid[])) AS x WHERE x IS NOT NULL)
    INTO v_ids;
  v_n := COALESCE(array_length(v_ids, 1), 0);

  IF v_n < 2 THEN
    RAISE EXCEPTION 'Una unidad de siembra necesita al menos dos predios (llegaron %)', v_n;
  END IF;

  IF p_principal IS NULL OR NOT (p_principal = ANY(v_ids)) THEN
    RAISE EXCEPTION 'El predio principal tiene que ser uno de los predios que se fusionan';
  END IF;

  -- Que existan todos
  IF (SELECT COUNT(*) FROM core.predios WHERE id = ANY(v_ids)) <> v_n THEN
    RAISE EXCEPTION 'Alguno de los predios no existe';
  END IF;

  -- Que ninguno esté ya en otra unidad activa (mensaje con nombres, no con uuid)
  SELECT string_agg(COALESCE(p.nombre_predio, '(predio sin nombre)') || ' → ' || g.nombre, ', ')
    INTO v_ocupado
  FROM core.predio_grupo_miembros m
  JOIN core.predio_grupos g ON g.id = m.grupo_id
  JOIN core.predios p       ON p.id = m.predio_id
  WHERE m.activo AND m.predio_id = ANY(v_ids);

  IF v_ocupado IS NOT NULL THEN
    RAISE EXCEPTION 'Estos predios ya están en una unidad de siembra: %', v_ocupado;
  END IF;

  -- Nombre por defecto: el del predio principal
  v_nombre := NULLIF(BTRIM(COALESCE(p_nombre, '')), '');
  IF v_nombre IS NULL THEN
    SELECT COALESCE(NULLIF(BTRIM(nombre_predio), ''), 'Unidad de siembra')
      INTO v_nombre FROM core.predios WHERE id = p_principal;
  END IF;

  INSERT INTO core.predio_grupos (nombre, predio_principal_id, nota, created_by)
  VALUES (v_nombre, p_principal, NULLIF(BTRIM(COALESCE(p_nota, '')), ''), p_created_by)
  RETURNING id INTO v_grupo_id;

  INSERT INTO core.predio_grupo_miembros (grupo_id, predio_id)
  SELECT v_grupo_id, x FROM unnest(v_ids) AS x;

  RETURN v_grupo_id;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — Deshacer: disolver la unidad (no borra)
--   El polígono que se subió como total de la unidad NO se borra: queda en
--   geo.zonas colgado del predio principal, que es donde estaba. Se suelta el
--   grupo_id para que deje de anunciarse como polígono de una unidad.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION core.disolver_grupo(
  p_grupo_id UUID,
  p_por      TEXT DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, core, geo
AS $$
BEGIN
  UPDATE core.predio_grupos
     SET disuelto_at = NOW(), disuelto_por = p_por, updated_at = NOW()
   WHERE id = p_grupo_id AND disuelto_at IS NULL;

  IF NOT FOUND THEN
    RETURN FALSE;        -- no existe, o ya estaba disuelta
  END IF;

  UPDATE core.predio_grupo_miembros SET activo = FALSE WHERE grupo_id = p_grupo_id;
  UPDATE geo.zonas SET grupo_id = NULL WHERE grupo_id = p_grupo_id;

  RETURN TRUE;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — Lectura: las unidades vigentes, con sus miembros
--   Una fila por unidad. El tablero SIG la usa para mostrar la unidad como una
--   sola línea de trabajo en vez de N predios sueltos.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW core.v_predio_grupos AS
SELECT
  g.id                                   AS grupo_id,
  g.nombre,
  g.predio_principal_id,
  pp.nombre_predio                       AS predio_principal,
  g.nota,
  COUNT(m.predio_id)                     AS n_predios,
  ARRAY_AGG(m.predio_id ORDER BY m.created_at)                     AS predio_ids,
  -- Cuántos municipios y dueños distintos toca la unidad: si es más de uno, la
  -- oficina debería saberlo (se avisa en la UI antes de fusionar).
  COUNT(DISTINCT p.municipio)            AS n_municipios,
  COUNT(DISTINCT p.aliado_id)            AS n_propietarios,
  SUM(p.area_registral)                  AS area_registral_total,
  g.created_by,
  g.created_at
FROM core.predio_grupos g
JOIN core.predio_grupo_miembros m ON m.grupo_id = g.id AND m.activo
JOIN core.predios p               ON p.id = m.predio_id
LEFT JOIN core.predios pp         ON pp.id = g.predio_principal_id
WHERE g.disuelto_at IS NULL
GROUP BY g.id, pp.nombre_predio;

COMMENT ON VIEW core.v_predio_grupos IS
  'Unidades de siembra vigentes (varios predios, un polígono). Una fila por unidad, con sus miembros y cuántos municipios/propietarios toca.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 — RLS + permisos (mismo patrón que core/geo)
-- ════════════════════════════════════════════════════════════

ALTER TABLE core.predio_grupos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.predio_grupo_miembros  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "predio_grupos_select"   ON core.predio_grupos;
DROP POLICY IF EXISTS "predio_miembros_select" ON core.predio_grupo_miembros;
CREATE POLICY "predio_grupos_select"   ON core.predio_grupos         FOR SELECT TO authenticated USING (true);
CREATE POLICY "predio_miembros_select" ON core.predio_grupo_miembros FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON core.predio_grupos         TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON core.predio_grupo_miembros TO authenticated, service_role;
GRANT SELECT                         ON core.v_predio_grupos       TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION core.fusionar_predios TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.disolver_grupo   TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 7 — Recargar PostgREST
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr
-- ============================================================
--  select to_regclass('core.predio_grupos');                    -- no NULL
--  select to_regclass('core.predio_grupo_miembros');            -- no NULL
--  select column_name from information_schema.columns
--    where table_schema='geo' and table_name='zonas' and column_name='grupo_id';   -- 1 fila
--  select * from core.v_predio_grupos;                          -- vacío hasta la primera fusión
--
--  Prueba de humo (con dos predio_id reales; deja el grupo creado, se disuelve
--  con la segunda línea):
--    select core.fusionar_predios(array['<uuid1>','<uuid2>']::uuid[], '<uuid1>', 'Prueba', null, 'tu@correo');
--    select core.disolver_grupo('<grupo_id>', 'tu@correo');
