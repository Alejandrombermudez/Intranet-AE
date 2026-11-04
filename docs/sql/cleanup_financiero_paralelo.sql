-- ============================================================
--  LIMPIEZA: tablas paralelas de financiero (2026-11-04)
--  Archivo : docs/sql/cleanup_financiero_paralelo.sql
--
--  QUÉ QUITA
--    El 2026-10-16 se corrió en producción un migration_financiero.sql que no está en
--    main (vive en la rama local respaldo/financiero-paralelo-2026-10-16). Creó cuatro
--    tablas que ninguna pantalla lee:
--      financiero.flete_compras · financiero.compra_items · financiero.compras ·
--      financiero.insumos
--    más la función financiero.touch_updated_at() (solo la usaban esas tablas; el resto
--    del proyecto usa inventario.tocar_updated_at) y pisó el COMMENT ON SCHEMA financiero.
--
--  POR QUÉ ES SEGURO (verificado por REST el 2026-11-04, solo lectura)
--    · Nada en main las referencia: ni código, ni FK, ni vistas de otras tablas.
--    · La misma carga está donde corresponde: 15 documentos en financiero.facturas
--      con la misma suma ($43.461.850) que las 15 compras paralelas; 13 insumos
--      paralelos contra el catálogo de inventario.insumos.
--    · Los 12 archivos de financiero-documentos son idénticos byte a byte (mismo ETag)
--      a los 12 de financiero-facturas; ningún registro real apunta al bucket paralelo.
--    · Respaldo de las cuatro tablas (JSON, fuera del repo porque es público):
--      Documents/AE/respaldos/financiero_paralelo_2026-11-04.json
--
--  LO QUE ESTE ARCHIVO NO HACE
--    El bucket financiero-documentos NO se borra por SQL (borrar filas de
--    storage.objects deja los archivos huérfanos en el almacenamiento). Se hace a mano,
--    DESPUÉS de correr esto: Supabase → Storage → financiero-documentos → «Empty
--    bucket» y luego «Delete bucket». El bucket financiero-facturas NO se toca: ahí
--    están los soportes reales.
--
--  REGLA DEL PROYECTO: este .sql lo corre el USUARIO en el SQL Editor. Sin CASCADE a
--  propósito: si algo real dependiera de estas tablas, el DROP falla y no pasa nada.
-- ============================================================

-- Guarda: no borra nada si la carga real no está completa.
DO $$
DECLARE
  v_facturas int;
  v_total    numeric;
BEGIN
  SELECT count(*), coalesce(sum(total), 0) INTO v_facturas, v_total
    FROM financiero.facturas WHERE estado = 'registrada';
  IF v_facturas < 15 OR v_total < 43461850 THEN
    RAISE EXCEPTION 'financiero.facturas tiene % registradas por % (se esperaban 15 por 43.461.850): no se borra nada.',
      v_facturas, v_total;
  END IF;
END $$;

DROP TABLE IF EXISTS financiero.flete_compras;
DROP TABLE IF EXISTS financiero.compra_items;
DROP TABLE IF EXISTS financiero.compras;
DROP TABLE IF EXISTS financiero.insumos;

-- Sin CASCADE: falla si algún trigger de otra tabla la usara.
DROP FUNCTION IF EXISTS financiero.touch_updated_at();

-- El comentario original (migration_financiero_inventario.sql).
COMMENT ON SCHEMA financiero IS
  'Compras: proveedores, facturas electrónicas DIAN y sus líneas. Solo service_role (rutas /api/administrativa de la intranet).';

NOTIFY pgrst, 'reload schema';

-- ============================================================
--  Verificación tras correr
-- ============================================================
--  select table_name from information_schema.tables where table_schema = 'financiero' order by 1;
--    -- deben quedar solo: factura_items, facturas, proveedores (y lo que tenga tu proyecto aparte de estas)
--  select count(*), sum(total) from financiero.facturas;      -- 15 · 43461850 (no cambia)
--  select count(*) from financiero.factura_items;             -- 18 (no cambia)
-- ============================================================
