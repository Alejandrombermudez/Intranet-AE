-- ============================================================
--  CONSENTIMIENTOS — aceptación de la cesión de imagen (2026-10-28)
--  Archivo: docs/sql/migration_consentimientos_cesion_imagen.sql
--
--  CÓMO CORRERLA
--    Supabase → SQL Editor → pegar el archivo completo → Run.
--    Se puede volver a correr sin romper nada. Una sola sentencia.
--    CORRERLA ANTES de publicar el cambio de la intranet: el formulario
--    público /consentimiento ya envía `acepta_cesion` y, sin la columna,
--    el guardado falla.
--
--  QUÉ ES
--    El formulario público /consentimiento tenía dos aceptaciones
--    (tratamiento de datos y políticas). Se agrega la tercera: la
--    «Autorización de tratamiento de datos personales y uso de imagen»
--    (public/docs/cesion-imagen.pdf, versión VF del SharePoint del Centro
--    de Semillas Nativas).
--
--  REGISTROS ANTERIORES
--    Quedan en false: esas personas aceptaron los dos documentos de
--    entonces, no la cesión de imagen. No se les marca como aceptada.
-- ============================================================

ALTER TABLE public.consentimientos
  ADD COLUMN IF NOT EXISTS acepta_cesion boolean NOT NULL DEFAULT false;
