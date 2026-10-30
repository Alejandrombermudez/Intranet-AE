-- ============================================================
--  CONSENTIMIENTOS — persona adulta que autoriza por un menor (2026-10-30)
--  Archivo: docs/sql/migration_consentimientos_menor.sql
--
--  CÓMO CORRERLA
--    Supabase → SQL Editor → pegar el archivo completo → Run.
--    Se puede volver a correr sin romper nada.
--    CORRERLA ANTES de publicar el cambio: el formulario público
--    /consentimiento ya envía estos campos y, sin las columnas, el
--    guardado falla.
--
--  QUÉ ES
--    En /consentimiento hay una casilla «Soy una persona adulta y autorizo
--    en nombre de un menor de edad a mi cargo». Si se marca, se piden el
--    nombre y el documento del menor y el parentesco de quien firma.
--    La persona que firma (nombre, cédula, correo, firma) sigue siendo la
--    adulta; los datos del menor van en estas columnas.
--
--  REGISTROS ANTERIORES
--    Quedan con autoriza_menor = false y los tres campos en NULL.
--
--  REGLA
--    Si autoriza_menor es true, los tres campos tienen que venir con
--    contenido; si es false, no se guarda nada del menor. La API ya lo
--    exige; el CHECK lo deja garantizado también en la base.
-- ============================================================

ALTER TABLE public.consentimientos
  ADD COLUMN IF NOT EXISTS autoriza_menor  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS menor_nombre    text,
  ADD COLUMN IF NOT EXISTS menor_documento text,
  ADD COLUMN IF NOT EXISTS parentesco      text;

-- Una sola sentencia que crea el CHECK solo si todavía no existe.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'consentimientos_menor_completo'
      AND conrelid = 'public.consentimientos'::regclass
  ) THEN
    ALTER TABLE public.consentimientos
      ADD CONSTRAINT consentimientos_menor_completo CHECK (
        (autoriza_menor = false AND menor_nombre IS NULL AND menor_documento IS NULL AND parentesco IS NULL)
        OR
        (autoriza_menor = true
          AND length(btrim(coalesce(menor_nombre, '')))    >= 3
          AND length(btrim(coalesce(menor_documento, ''))) >= 4
          AND length(btrim(coalesce(parentesco, '')))      >= 3)
      );
  END IF;
END $$;
