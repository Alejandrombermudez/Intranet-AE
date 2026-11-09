-- ============================================================
-- migration_vista_campo_fuente.sql — 2026-11-09
--
-- La app de campo filtra los predios de Lácteos del Hogar (pedido desde campo:
-- «que aparezcan todos los predios de Lácteos del Hogar para revisarlos»).
-- Para eso la vista que lee el celular trae la FUENTE del predio
-- (core.predios.fuente_informacion, p. ej. 'lacteos_del_hogar').
--
-- Solo agrega una columna AL FINAL de core.v_predios_campo: mismas columnas,
-- mismo orden y mismo tipo que la vigente (migration_campo_primero.sql,
-- verificada por REST el 2026-11-09), así CREATE OR REPLACE la acepta sin DROP
-- y los celulares con la versión vieja, que piden columnas por nombre, no notan
-- nada. Las filas no cambian: siguen siendo todos los expedientes activos.
--
-- La app nueva tolera que esto no haya corrido: pide la columna y, si no
-- existe (42703), repite sin ella; el filtro simplemente no aparece.
--
-- Idempotente: se puede correr dos veces.
-- ============================================================

CREATE OR REPLACE VIEW core.v_predios_campo AS
SELECT
  p.id                    AS predio_id,
  e.id                    AS expediente_id,
  a.id                    AS aliado_id,
  COALESCE(NULLIF(btrim(p.nombre_predio), ''), 'Sin nombre') AS nombre_predio,
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
  e.updated_at,
  CASE WHEN EXISTS (
         SELECT 1 FROM geo.zonas z
         WHERE z.predio_id = p.id AND z.tipo = 'restauracion'
           AND z.estado <> 'descartada' AND z.vigente
           AND NOT EXISTS (SELECT 1 FROM geo.zona_revision r
                           WHERE r.zona_id = z.id AND r.accion = 'nueva')
       ) THEN 'sig_primero' ELSE 'campo_primero'
  END                     AS flujo_campo,
  -- NUEVO: cómo llegó el predio (catalogo.fuentes_informacion.codigo)
  p.fuente_informacion
FROM core.predios p
JOIN core.expedientes e ON e.predio_id = p.id
JOIN core.aliados a     ON a.id = p.aliado_id
WHERE e.estado = 'activo';

GRANT SELECT ON core.v_predios_campo TO anon, authenticated, service_role;

-- Verificación (solo lectura): cuántos predios de Lácteos del Hogar ve campo.
-- Al 2026-11-09 deberían ser 65 de 140.
SELECT fuente_informacion, count(*) FROM core.v_predios_campo GROUP BY 1 ORDER BY 2 DESC;
