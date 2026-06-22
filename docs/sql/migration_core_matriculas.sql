-- ============================================================
--  MIGRACIÓN: core.predios — varias matrículas por predio
--  Archivo: docs/sql/migration_core_matriculas.sql
--  Fecha  : 2026-06-20
--  Requiere: migration_core.sql ya ejecutado.
--
--  Un predio (polígono) puede estar registrado bajo VARIAS matrículas
--  (englobe). Se agrega `matriculas text[]`. Se conserva
--  `matricula_inmobiliaria` como la PRINCIPAL (= la primera de la lista),
--  para los listados/resúmenes que muestran una sola.
-- ============================================================

ALTER TABLE core.predios ADD COLUMN IF NOT EXISTS matriculas text[];

-- Migrar el valor único existente al arreglo
UPDATE core.predios
  SET matriculas = ARRAY[matricula_inmobiliaria]
  WHERE matricula_inmobiliaria IS NOT NULL
    AND (matriculas IS NULL OR cardinality(matriculas) = 0);

COMMENT ON COLUMN core.predios.matriculas IS 'Matrículas/folios del predio (un polígono puede tener varias). matricula_inmobiliaria = la principal (primera).';

NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT id, nombre_predio, matricula_inmobiliaria, matriculas FROM core.predios;
