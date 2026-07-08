-- ============================================================
--  Migración: Endurecer core.v_predios_campo (SIG I obligatorio)
--  Archivo : docs/sql/migration_campo_core_v2.sql
--  Ejecutar: Supabase SQL Editor (después de migration_campo_core.sql)
--  Creado  : Julio 2026
--
--  Contexto: el usuario pidió que sea OBLIGATORIO pasar por SIG I para
--  aparecer en la app de Campo. El backend (crear-en-siembra) ya valida
--  esto (etapa='sig_i' + geo.zonas con tipo='restauracion'), pero la
--  vista que lee la PWA no tenía ese mismo candado — este es el
--  cinturón de seguridad: aunque algo avance `etapa` a 'campo'/'sig_ii'
--  sin que el SIG haya subido zonas (bug futuro, llamada directa a la
--  API, etc.), la PWA de Campo NUNCA debe mostrar ese predio.
-- ============================================================

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
    WHERE z.predio_id = p.id AND z.tipo = 'restauracion'
  );

COMMENT ON VIEW core.v_predios_campo IS
  'Predios que Jurídica+SIG ya habilitaron para la app de Campo. Única puerta de lectura de core.* para el rol anon (sin login) — expone solo lo necesario para identificar el predio y su aliado, no toda la tabla. SIG I es OBLIGATORIO: el EXISTS contra geo.zonas es cinturón de seguridad además de la validación en /api/juridica/aliados/[id]/crear-en-siembra.';

-- Verificación sugerida:
--   select * from core.v_predios_campo;  -- no debe listar ningún predio sin geo.zonas tipo=restauracion
-- ============================================================
