-- ============================================================
--  MIGRACIÓN: nucleación v2 — un lote sale de lo que campo verificó
--  Archivo: docs/sql/migration_nucleacion_v2.sql
--  Fecha  : 2026-09-20
--  Requiere: migration_nucleacion.sql ejecutado.
--
--  DOS COSAS QUE SALIERON EN LA PRUEBA DE HUMO
--
--  1. `deshacer_lotes` devolvía la zona a 'validada' SIEMPRE, sin mirar de
--     dónde venía. Deshacer un lote que había sido 'potencial' lo dejaba en
--     'validada': le atribuía una verificación en terreno que nunca pasó. En un
--     sistema cuya regla es "el terreno tiene la última palabra", eso es
--     exactamente lo que no puede ocurrir.
--     Ahora `confirmar_lotes` guarda el estado anterior en `propiedades` y
--     `deshacer_lotes` lo restituye, además de limpiar su propio rastro.
--
--  2. `confirmar_lotes` aceptaba cualquier zona vigente no descartada,
--     incluida una 'potencial' que campo nunca vio. Pero un lote es, por
--     definición, **una zona que el técnico marcó en terreno y el SIG dio por
--     buena**. Ahora solo toma zonas en 'validada', que son las que volvieron
--     de campo (confirmadas o modificadas por el técnico, o dibujadas por él).
--
--  Las dos funciones conservan su firma y su tipo de retorno: basta
--  CREATE OR REPLACE, sin DROP. (Ver el 42P13 de migration_renombrar_carga.)
--
--  Cada sentencia va por su cuenta y se puede volver a correr: el editor SQL
--  de Supabase no respeta BEGIN/COMMIT.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- 1. confirmar_lotes — solo lo que campo verificó, y recordando de dónde venía
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

  -- En un UPDATE, las expresiones de la derecha ven la fila VIEJA: por eso
  -- `estado` dentro del jsonb_build_object guarda el valor anterior, no
  -- 'definitiva'. Así deshacer puede devolver la zona a donde estaba.
  UPDATE geo.zonas
     SET estado = 'definitiva',
         propiedades = COALESCE(propiedades, '{}'::jsonb) || jsonb_build_object(
           'lote_confirmado_por', p_por,
           'lote_confirmado_at',  NOW(),
           'lote_estado_previo',  estado
         ),
         updated_at = NOW()
   WHERE predio_id = p_predio_id
     AND tipo = 'restauracion'
     AND vigente
     -- Solo lo que volvió verificado de terreno. Una zona 'potencial' es una
     -- propuesta de la oficina que nadie ha ido a mirar: no puede ser un lote.
     AND estado = 'validada'
     AND (p_zona_ids IS NULL OR id = ANY(p_zona_ids));

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- 2. deshacer_lotes — devuelve la zona a donde estaba y borra su rastro
-- ════════════════════════════════════════════════════════════

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
     SET estado = COALESCE(propiedades->>'lote_estado_previo', 'validada'),
         propiedades = propiedades - 'lote_confirmado_por' - 'lote_confirmado_at' - 'lote_estado_previo',
         updated_at = NOW()
   WHERE predio_id = p_predio_id
     AND tipo = 'restauracion'
     AND estado = 'definitiva'
     AND (p_zona_ids IS NULL OR id = ANY(p_zona_ids));

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- 3. Permisos (el REVOKE a PUBLIC no sobrevive a CREATE OR REPLACE)
-- ════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION geo.confirmar_lotes(uuid, uuid[], text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION geo.deshacer_lotes(uuid, uuid[])        FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION geo.confirmar_lotes(uuid, uuid[], text) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION geo.deshacer_lotes(uuid, uuid[])        TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr
-- ============================================================
--  -- confirmar una zona 'potencial' ya no hace nada (devuelve 0):
--  select geo.confirmar_lotes('<predio_id>', array['<zona_potencial_id>']::uuid[], 'tu@correo');
--
--  -- y el ciclo completo sobre una zona 'validada' la devuelve a 'validada':
--  select geo.confirmar_lotes('<predio_id>', array['<zona_validada_id>']::uuid[], 'tu@correo');
--  select estado, propiedades ? 'lote_estado_previo' from geo.zonas where id = '<zona_validada_id>';
--  select geo.deshacer_lotes('<predio_id>', array['<zona_validada_id>']::uuid[]);
--  select estado, propiedades ? 'lote_estado_previo' from geo.zonas where id = '<zona_validada_id>';
--    → 'validada' y false: el rastro se limpia solo.
