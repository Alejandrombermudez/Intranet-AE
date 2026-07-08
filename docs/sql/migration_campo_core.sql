-- ============================================================
--  Migración: Reconectar App de Campo al núcleo (core) + SIG (geo)
--  Archivo : docs/sql/migration_campo_core.sql
--  Ejecutar: Supabase SQL Editor (proyecto producción)
--  Creado  : Julio 2026
--
--  Contexto: siembra.familias/evaluaciones_campo/predios eran datos
--  de PRUEBA (🧪, ver ARQUITECTURA_DATOS.md §3.3) que duplicaban campos
--  ya capturados por Jurídica (core.aliados/core.predios) y por SIG I
--  (geo.zonas). Esta migración:
--    1. Crea core.v_predios_campo (predios habilitados para Campo).
--    2. Repunta los FK de siembra.familias/evaluaciones_campo hacia
--       core.predios (en vez de siembra.predios).
--    3. Elimina las columnas duplicadas (identidad/ubicación/lat-long).
--    4. Elimina siembra.predios (queda 100% subsumida por core).
--    5. Da acceso mínimo de solo-lectura a anon (la PWA no tiene login)
--       únicamente sobre la vista y sobre geo.zonas — NO sobre las
--       tablas crudas core.aliados/core.predios/core.expedientes.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. Vista: predios habilitados para la app de Campo
--    (Jurídica aprobó + expediente avanzó a etapa 'campo' o 'sig_ii')
-- ────────────────────────────────────────────────────────────
-- OJO: security_invoker se deja en false (default) A PROPÓSITO. anon no
-- tiene política RLS sobre core.aliados/predios/expedientes (y no debe
-- tenerla); esta vista corre con el rol dueño (bypassa esa RLS) y expone
-- manualmente solo las columnas necesarias — es la puerta angosta, no un
-- atajo alrededor de ella.
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
WHERE e.etapa IN ('campo', 'sig_ii');

COMMENT ON VIEW core.v_predios_campo IS
  'Predios que Jurídica+SIG ya habilitaron para la app de Campo. Única puerta de lectura de core.* para el rol anon (sin login) — expone solo lo necesario para identificar el predio y su aliado, no toda la tabla.';

GRANT SELECT ON core.v_predios_campo TO anon, authenticated, service_role;


-- ────────────────────────────────────────────────────────────
-- 2. geo.zonas: acceso de lectura para anon (la PWA offline no tiene
--    sesión). Ya tenía USAGE de schema (migration_geo.sql); faltaba
--    la política + grant de la tabla y del RPC de consulta.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anon_read_zonas" ON geo.zonas;
CREATE POLICY "anon_read_zonas" ON geo.zonas
  FOR SELECT TO anon USING (true);

GRANT SELECT ON geo.zonas TO anon;
GRANT EXECUTE ON FUNCTION geo.zonas_de_predio TO anon;


-- ────────────────────────────────────────────────────────────
-- 3. siembra.familias: repuntar predio_id → core.predios y quitar
--    columnas que ya vienen de core (aliado_id/expediente_id YA
--    apuntaban a core desde migration_core.sql; predio_id seguía
--    apuntando a la siembra.predios vieja).
--
--    Las filas actuales son de PRUEBA y su predio_id apunta a la
--    siembra.predios vieja (no a core.predios) — no hay forma de
--    reasignarlas automáticamente, así que se limpian antes de
--    repuntar el FK (igual que se hizo con juridica.antecedentes/
--    analisis_juridico en migration_core.sql bloque 7).
-- ────────────────────────────────────────────────────────────
TRUNCATE siembra.familias CASCADE;

ALTER TABLE siembra.familias DROP CONSTRAINT IF EXISTS familias_predio_id_fkey;
ALTER TABLE siembra.familias
  ADD CONSTRAINT familias_predio_id_fkey
  FOREIGN KEY (predio_id) REFERENCES core.predios(id) ON DELETE CASCADE;

ALTER TABLE siembra.familias
  DROP COLUMN IF EXISTS nombre_propietario,
  DROP COLUMN IF EXISTS tipo_documento,
  DROP COLUMN IF EXISTS numero_documento,
  DROP COLUMN IF EXISTS departamento,
  DROP COLUMN IF EXISTS municipio,
  DROP COLUMN IF EXISTS vereda,
  DROP COLUMN IF EXISTS nombre_finca,
  DROP COLUMN IF EXISTS nucleo,
  DROP COLUMN IF EXISTS latitud,
  DROP COLUMN IF EXISTS longitud;

COMMENT ON COLUMN siembra.familias.predio_id IS
  'FK a core.predios. Identidad/ubicación/propietario se leen por JOIN (core.v_predios_campo) — no se duplican aquí.';


-- ────────────────────────────────────────────────────────────
-- 4. siembra.evaluaciones_campo: mismo repunte + quitar columnas
--    duplicadas. num_zonas/area_zonas_ha se conservan pero pasan
--    a ser un RESUMEN calculado por la app desde geo.zonas, no un
--    dato tecleado por el encuestador.
-- ────────────────────────────────────────────────────────────
TRUNCATE siembra.evaluaciones_campo;

ALTER TABLE siembra.evaluaciones_campo DROP CONSTRAINT IF EXISTS evaluaciones_campo_predio_id_fkey;
ALTER TABLE siembra.evaluaciones_campo
  ADD CONSTRAINT evaluaciones_campo_predio_id_fkey
  FOREIGN KEY (predio_id) REFERENCES core.predios(id) ON DELETE CASCADE;

ALTER TABLE siembra.evaluaciones_campo
  ADD COLUMN IF NOT EXISTS expediente_id UUID REFERENCES core.expedientes(id) ON DELETE SET NULL;

ALTER TABLE siembra.evaluaciones_campo
  DROP COLUMN IF EXISTS nombre_predio;

COMMENT ON COLUMN siembra.evaluaciones_campo.zonas_data IS
  'Array ZonaData[]. Cada elemento ahora incluye zona_id (uuid → geo.zonas.id): las zonas las define el SIG, la app de Campo solo las confirma/describe (SIG II), no crea zonas nuevas a mano.';


-- ────────────────────────────────────────────────────────────
-- 5. Eliminar siembra.predios — queda 100% subsumida por
--    core.predios + core.aliados + core.expedientes.
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS siembra.predios;


-- ────────────────────────────────────────────────────────────
-- Verificación sugerida tras correr esta migración:
--   select * from core.v_predios_campo;                 -- debe listar los predios en etapa campo/sig_ii
--   select column_name from information_schema.columns
--     where table_schema='siembra' and table_name='familias';   -- ya no debe traer nombre_propietario/municipio/...
--   select to_regclass('siembra.predios');               -- debe dar NULL (tabla eliminada)
-- ============================================================
