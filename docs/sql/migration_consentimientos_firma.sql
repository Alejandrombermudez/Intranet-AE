-- ============================================================
--  CONSENTIMIENTOS — firma manuscrita (2026-10-28)
--  Archivo: docs/sql/migration_consentimientos_firma.sql
--
--  CÓMO CORRERLA
--    Supabase → SQL Editor → pegar el archivo completo → Run.
--    Se puede volver a correr sin romper nada. Una sola sentencia.
--    CORRERLA ANTES de publicar el cambio: el formulario público
--    /consentimiento ya envía `firma` y, sin la columna, el guardado falla.
--
--  QUÉ ES
--    La firma que la persona hace con el dedo (celular) o el mouse
--    (computador) en el formulario, guardada como imagen PNG en base64
--    (data URL, unos 10–30 KB). La intranet la muestra en la lista de
--    Tratamiento de Datos y en el PDF que se descarga de ahí.
--
--  REGISTROS ANTERIORES
--    Quedan en NULL: se registraron sin firma y no se inventa ninguna.
--    La tabla se lee solo desde el servidor (service_role), como hasta ahora.
-- ============================================================

ALTER TABLE public.consentimientos
  ADD COLUMN IF NOT EXISTS firma text;
