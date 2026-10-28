-- ============================================================
-- migration_decision_apoyo.sql — lo que decide campo sobre las áreas recomendadas
-- 2026-10-27 · requiere migration_campo_primero.sql (geo.capas_apoyo), que ya corrió
-- ============================================================
--
-- Para qué:
--   La app de campo muestra las áreas recomendadas de cada predio (geo.capas_apoyo,
--   p. ej. las elegibles de Ley del Árbol y carbono de Lácteos del Hogar). Desde el
--   2026-10-27 la persona en el predio decide sobre cada una: la ACEPTA como sitio
--   de siembra, la acepta y le AJUSTA el borde, o la DESCARTA.
--
--   Aceptar o ajustar ya llega solo al servidor como un sitio dibujado en campo
--   (geo.revisar_zona, acción 'nueva', sin cambios). Lo que falta, y es esta
--   migración, es la DECISIÓN: que la oficina sepa qué se hizo con cada
--   recomendación —también con las que no sirvieron— y qué sitio salió de cuál.
--
--   · geo.capa_apoyo_decision — una fila por decisión. Historia completa: un
--     cambio de opinión es otra fila, no se pisa la anterior.
--   · geo.decidir_capa_apoyo_campo(...) — la escribe la app con la llave anónima.
--     Idempotente por local_id (reintentar es seguro). El predio lo saca del área,
--     no de lo que diga el celular.
--   · geo.v_capas_apoyo_estado — cada área con su última decisión y el sitio que
--     salió de ella. Solo service_role (para la intranet).
--
--   No se tocan geo.capas_apoyo, geo.capas_apoyo_campo(), geo.revisar_zona ni
--   geo.zona_revision.
--
-- Mientras no corra: la app sigue funcionando entera. Aceptar o ajustar un área
-- sube el sitio como siempre; la decisión (y los descartes) se quedan en el
-- celular con un aviso y se reintentan en cada sincronización: no se pierden.
--
-- Sin BEGIN/COMMIT a propósito: el editor de Supabase corre cada sentencia por
-- separado. Todo es repetible (IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================


-- ── 1. Tabla ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.capa_apoyo_decision (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id           TEXT NOT NULL UNIQUE,          -- UUID del celular (idempotencia)
  capa_apoyo_id      UUID NOT NULL REFERENCES geo.capas_apoyo(id) ON DELETE CASCADE,
  predio_id          UUID NOT NULL REFERENCES core.predios(id) ON DELETE CASCADE,
  decision           TEXT NOT NULL CHECK (decision IN ('aceptada','modificada','descartada','reconsiderada')),
  -- geo.zona_revision.local_id de la revisión 'nueva' con que el área pasó a ser sitio
  revision_local_id  TEXT,
  observaciones      TEXT,
  evaluador          TEXT,
  fecha              DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS capa_apoyo_decision_capa_idx   ON geo.capa_apoyo_decision (capa_apoyo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS capa_apoyo_decision_predio_idx ON geo.capa_apoyo_decision (predio_id);

COMMENT ON TABLE geo.capa_apoyo_decision IS
  'Lo que decidió campo sobre cada área recomendada (geo.capas_apoyo): aceptada, modificada (aceptada con el borde ajustado), descartada o reconsiderada (deshace una anterior). Una fila por decisión; la vigente es la más reciente. La escribe la app por geo.decidir_capa_apoyo_campo.';

ALTER TABLE geo.capa_apoyo_decision ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON geo.capa_apoyo_decision FROM anon, authenticated;
GRANT ALL ON geo.capa_apoyo_decision TO service_role;


-- ── 2. RPC para la app de campo ──────────────────────────────────────────────
-- No exige que el área siga vigente ni que el predio siga en la vista de campo:
-- una decisión tomada en el predio antes de que la oficina subiera otra versión
-- de la capa (o de que cambiara el expediente) tiene que poder llegar igual.
CREATE OR REPLACE FUNCTION geo.decidir_capa_apoyo_campo(
  p_local_id          TEXT,
  p_capa_apoyo_id     UUID,
  p_decision          TEXT,
  p_revision_local_id TEXT DEFAULT NULL,
  p_observaciones     TEXT DEFAULT NULL,
  p_evaluador         TEXT DEFAULT NULL,
  p_fecha             DATE DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, geo
AS $$
DECLARE
  v_id     UUID;
  v_predio UUID;
BEGIN
  IF p_local_id IS NULL OR length(trim(p_local_id)) = 0 THEN
    RAISE EXCEPTION 'local_id es requerido';
  END IF;

  -- Idempotencia: si esta decisión ya llegó, devolverla sin repetir
  SELECT id INTO v_id FROM geo.capa_apoyo_decision WHERE local_id = p_local_id;
  IF FOUND THEN RETURN v_id; END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('aceptada','modificada','descartada','reconsiderada') THEN
    RAISE EXCEPTION 'Decisión inválida: % (aceptada | modificada | descartada | reconsiderada)', p_decision;
  END IF;

  SELECT c.predio_id INTO v_predio FROM geo.capas_apoyo c WHERE c.id = p_capa_apoyo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El área recomendada % no existe', p_capa_apoyo_id;
  END IF;

  INSERT INTO geo.capa_apoyo_decision
    (local_id, capa_apoyo_id, predio_id, decision, revision_local_id, observaciones, evaluador, fecha)
  VALUES
    (p_local_id, p_capa_apoyo_id, v_predio, p_decision,
     NULLIF(trim(p_revision_local_id), ''), NULLIF(trim(p_observaciones), ''), NULLIF(trim(p_evaluador), ''),
     COALESCE(p_fecha, (now() AT TIME ZONE 'America/Bogota')::date))
  ON CONFLICT (local_id) DO NOTHING
  RETURNING id INTO v_id;

  -- Dos celulares mandando lo mismo a la vez: el segundo se queda con el del primero
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM geo.capa_apoyo_decision WHERE local_id = p_local_id;
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION geo.decidir_capa_apoyo_campo(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION geo.decidir_capa_apoyo_campo(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, DATE)
  TO anon, authenticated, service_role;


-- ── 3. Estado de cada área, para la intranet ─────────────────────────────────
-- estado: 'sin_decidir' (nadie decidió, o se reconsideró), 'descartada' o
-- 'usada' (aceptada o modificada: es un sitio de siembra, sitio_zona_id).
CREATE OR REPLACE VIEW geo.v_capas_apoyo_estado
WITH (security_invoker = true) AS
SELECT
  c.id          AS capa_apoyo_id,
  c.predio_id,
  c.capa,
  c.clase,
  c.nombre,
  c.area_ha,
  c.vigente,
  CASE
    WHEN d.decision IS NULL OR d.decision = 'reconsiderada' THEN 'sin_decidir'
    WHEN d.decision = 'descartada' THEN 'descartada'
    ELSE 'usada'
  END           AS estado,
  d.decision,
  d.observaciones,
  d.evaluador,
  d.fecha       AS fecha_decision,
  d.created_at  AS decidida_at,
  r.zona_id     AS sitio_zona_id
FROM geo.capas_apoyo c
LEFT JOIN LATERAL (
  SELECT x.* FROM geo.capa_apoyo_decision x
  WHERE x.capa_apoyo_id = c.id
  ORDER BY x.created_at DESC
  LIMIT 1
) d ON TRUE
LEFT JOIN geo.zona_revision r ON r.local_id = d.revision_local_id;

REVOKE ALL ON geo.v_capas_apoyo_estado FROM anon, authenticated;
GRANT SELECT ON geo.v_capas_apoyo_estado TO service_role;

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr (lectura)
-- ============================================================
--   select proname, pronargs from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where nspname = 'geo' and proname = 'decidir_capa_apoyo_campo';                          -- 7, una sola fila
--   select has_function_privilege('anon', 'geo.decidir_capa_apoyo_campo(text,uuid,text,text,text,text,date)', 'execute');  -- true
--   select has_table_privilege('anon', 'geo.capa_apoyo_decision', 'select');                  -- false
--   select has_table_privilege('anon', 'geo.v_capas_apoyo_estado', 'select');                 -- false
--   select estado, count(*) from geo.v_capas_apoyo_estado where vigente group by 1;           -- todo 'sin_decidir' al principio
-- Por REST, sin escribir nada: llamar el RPC con p_decision = 'x' debe responder
-- P0001 «Decisión inválida» (la función existe); PGRST202 = todavía no corrió.
-- ============================================================
