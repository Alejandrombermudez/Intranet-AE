-- ============================================================
--  MIGRACIÓN: nuevo orden de la debida diligencia jurídica
--  Proyecto: Intranet Amazonia Emprende
--  Archivo : docs/sql/migration_orden_hojas_juridica.sql
--  Fecha   : 2026-09-14
--
--  QUÉ CAMBIA EN EL FLUJO
--   Antes:  HOJA 1 Datos → HOJA 2 Antecedentes → HOJA 3 Análisis jurídico
--   Ahora:  HOJA 1 Datos → HOJA 2 Análisis jurídico → HOJA 3 Antecedentes
--
--   El folio va primero porque es el filtro barato: si el predio no tiene
--   títulos sanos (semáforo rojo) no tiene sentido consultar las 14 listas
--   restrictivas de su dueño. Los antecedentes se abren cuando el análisis deja
--   semáforo verde, amarillo o naranja.
--
--  QUÉ CAMBIA EN LA BASE
--   1. Un estado nuevo en juridica.debida_diligencia.estado:
--        analisis_ok = folio en verde/amarillo, faltan los antecedentes (HOJA 3).
--      Con el orden viejo no existía: el análisis era la última hoja y su
--      semáforo verde pasaba directo a 'aprobado'.
--   2. El estado deja de fijarlo cada hoja al guardar: se DERIVA de las dos
--      hojas juntas (lib/juridica-schema.ts → derivarEstadoDD). Este archivo
--      trae la misma regla en SQL para dejar alineados los casos que ya existen.
--
--  REGLA (la primera que aplica)
--   1. semáforo rojo  o  antecedentes no aprobados   → rechazado
--   2. semáforo naranja                              → juridico_ok  (comité)
--   3. semáforo verde/amarillo + antecedentes OK     → aprobado
--   4. semáforo verde/amarillo                       → analisis_ok
--   5. antecedentes OK sin análisis                  → antecedentes_ok
--   6. nada decidido                                 → borrador
--
--  ORDEN IMPORTA: correr este SQL ANTES de desplegar la intranet. Sin el
--  BLOQUE 1, guardar un análisis en verde con los antecedentes pendientes
--  devuelve error (el análisis sí queda guardado, el estado no).
--
--  CORRER EN: Supabase → SQL Editor. Idempotente.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — Admitir el estado 'analisis_ok'
--   El CHECK se creó en línea en migration_core.sql, sin nombre explícito, así
--   que se busca por catálogo en vez de adivinar cómo lo bautizó Postgres.
--   Los valores que ya existen se conservan todos: ninguna fila queda inválida.
-- ════════════════════════════════════════════════════════════

DO $bloque1$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'juridica.debida_diligencia'::regclass
      AND contype  = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%estado%'
  LOOP
    EXECUTE format('ALTER TABLE juridica.debida_diligencia DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$bloque1$;

ALTER TABLE juridica.debida_diligencia
  ADD CONSTRAINT debida_diligencia_estado_check
  CHECK (estado IN ('borrador', 'analisis_ok', 'antecedentes_ok', 'juridico_ok', 'aprobado', 'rechazado'));

COMMENT ON COLUMN juridica.debida_diligencia.estado IS
  'Derivado de las dos hojas (no se escribe a mano). HOJA 2 análisis → HOJA 3 antecedentes. '
  'borrador · analisis_ok (folio verde/amarillo, faltan antecedentes) · antecedentes_ok (antecedentes '
  'sin análisis, casos anteriores al cambio de orden) · juridico_ok (semáforo naranja, comité) · '
  'aprobado (folio verde/amarillo + antecedentes aprobados) · rechazado (folio rojo o antecedentes no aprobados).';

NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — Vista previa: qué casos quedan con otro estado
--   Solo lectura. Correr antes del BLOQUE 3 para ver a quién toca.
--
--   Verificado por REST el 2026-09-14: 108 de 111 predios ya coinciden con la
--   regla. Difieren 3, y los tres son desfases del código anterior, no casos
--   que el cambio de orden mueva:
--     · La Bocana         borrador        → antecedentes_ok
--     · Finca La Florida  borrador        → antecedentes_ok
--         (la persona tiene antecedentes aprobados, pero se aprobaron desde otro
--          predio suyo y el código viejo solo actualizaba ese)
--     · La Esperanza      antecedentes_ok → juridico_ok
--         (tiene semáforo naranja; volver a guardar antecedentes le había pisado
--          el estado)
--   Si al correrlo aparecen más filas, alguien guardó una hoja entre esa fecha
--   y hoy: mirarlas antes de seguir.
-- ════════════════════════════════════════════════════════════

WITH derivado AS (
  SELECT
    p.id            AS predio_id,
    p.nombre_predio,
    dd.estado       AS guardado,
    aj.semaforo,
    an.aprobado     AS antecedentes_aprobado,
    CASE
      WHEN aj.semaforo = 'rojo' OR an.aprobado IS FALSE                 THEN 'rechazado'
      WHEN aj.semaforo = 'naranja'                                      THEN 'juridico_ok'
      WHEN aj.semaforo IN ('verde', 'amarillo') AND an.aprobado IS TRUE THEN 'aprobado'
      WHEN aj.semaforo IN ('verde', 'amarillo')                         THEN 'analisis_ok'
      WHEN an.aprobado IS TRUE                                          THEN 'antecedentes_ok'
      ELSE                                                                   'borrador'
    END AS nuevo
  FROM core.predios p
  JOIN      juridica.debida_diligencia dd ON dd.predio_id = p.id
  LEFT JOIN juridica.analisis_juridico aj ON aj.predio_id = p.id
  LEFT JOIN juridica.antecedentes      an ON an.aliado_id = p.aliado_id
)
SELECT nombre_predio, guardado, nuevo, semaforo, antecedentes_aprobado
FROM derivado
WHERE guardado IS DISTINCT FROM nuevo
ORDER BY nombre_predio;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — Alinear los estados guardados con la regla
--   Toca solo las filas que difieren (las del BLOQUE 2). Ninguna de las tres
--   verificadas pasa a 'rechazado' ni sale de él, así que core.expedientes no
--   cambia. Si el BLOQUE 2 mostró algún rechazo nuevo, la intranet ajusta el
--   expediente la próxima vez que se guarde una hoja de ese predio.
-- ════════════════════════════════════════════════════════════

WITH derivado AS (
  SELECT
    p.id AS predio_id,
    CASE
      WHEN aj.semaforo = 'rojo' OR an.aprobado IS FALSE                 THEN 'rechazado'
      WHEN aj.semaforo = 'naranja'                                      THEN 'juridico_ok'
      WHEN aj.semaforo IN ('verde', 'amarillo') AND an.aprobado IS TRUE THEN 'aprobado'
      WHEN aj.semaforo IN ('verde', 'amarillo')                         THEN 'analisis_ok'
      WHEN an.aprobado IS TRUE                                          THEN 'antecedentes_ok'
      ELSE                                                                   'borrador'
    END AS nuevo
  FROM core.predios p
  LEFT JOIN juridica.analisis_juridico aj ON aj.predio_id = p.id
  LEFT JOIN juridica.antecedentes      an ON an.aliado_id = p.aliado_id
)
UPDATE juridica.debida_diligencia dd
SET    estado = d.nuevo
FROM   derivado d
WHERE  dd.predio_id = d.predio_id
  AND  dd.estado IS DISTINCT FROM d.nuevo;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — Verificación
-- ════════════════════════════════════════════════════════════

-- 4.1 El CHECK nuevo (1 fila, debe incluir analisis_ok):
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'juridica.debida_diligencia'::regclass AND contype = 'c';

-- 4.2 Reparto de estados. Con los datos del 2026-09-14 debería quedar:
--     borrador 81 · antecedentes_ok 5 · juridico_ok 3 · aprobado 19 · rechazado 3
--     (antes: borrador 83 · antecedentes_ok 4 · juridico_ok 2 · aprobado 19 · rechazado 3)
SELECT estado, COUNT(*) FROM juridica.debida_diligencia GROUP BY estado ORDER BY estado;

-- 4.3 El BLOQUE 2 vuelto a correr debe devolver 0 filas.
