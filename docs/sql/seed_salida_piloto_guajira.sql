-- ============================================================
--  CARGA: la salida piloto de siembra (La Guajira, Las Dalias y Versalles)
--         tal como la conciliaron Logística y Administrativa el 2026-10-23
--  Archivo : docs/sql/seed_salida_piloto_guajira.sql
--  Fecha   : 2026-10-28
--  Requiere: migration_salidas_campo.sql ya corrida.
--
--  QUÉ HACE
--    Reproduce en la intranet la hoja «Conciliación» de Administrativa (46
--    elementos) como una SALIDA con sus actas, para que de ahí en adelante se
--    trabaje en la intranet y no en el Excel:
--      · crea los elementos que no estaban en el catálogo, ya con su clase;
--      · lo que la hoja da por entregado y la intranet no tiene (EPP, herramientas
--        y las compras adicionales sin factura registrada) entra a la bodega
--        central como AJUSTE por conteo, anulable cuando se registre su factura;
--      · acta de ENTREGA INICIAL, de ENTREGA ADICIONAL y de DEVOLUCIÓN (21/10/2026,
--        recibida en el vivero de Morelia), todas «sin firma» hasta que se suban
--        los escaneos de las actas originales;
--      · lo que Logística ya dio por consumido o instalado queda justificado con
--        esa nota, y falta cruzarlo con la app de campo (no tiene registros).
--    Lo DUDOSO no se justifica: las 7 impermeables, el EPP sin devolución, lo que se
--    devolvió de más o sin registro de entrega, Bosplant, Becano, Hormitek, la avena
--    hormiguera, el termo y los postes por contar quedan en rojo para que Administrativa
--    los resuelva, como pidió.
--
--  ANTES DE CORRERLO
--    · EDITA v_fecha (abajo): la fecha de las actas de entrega 001 y 02. Con la de
--      devolución (21/10/2026) no hace falta: sale del acta de devolución final.
--    · No lleva nombres de personas (el repo es público). El responsable de la
--      salida se pone desde la intranet.
--    · Supuestos de unidad: Dropex, 1 galón = 4 presentaciones de 1 L del catálogo;
--      «Avena hormiguera 475 g» = «Cebo artesanal para hormiga arriera» (88, igual a
--      la factura DSE 574); «Grapa 3/4"» = «Grapa larga 1 1/4" Puma» (15 cajas, igual
--      a la factura FVE403157). Confirmar con Logística.
--
--  Se puede correr una sola vez: si la salida ya existe, no hace nada.
--  REGLA DEL PROYECTO: este .sql lo corre el USUARIO en el SQL Editor.
-- ============================================================

DO $$
DECLARE
  c_nombre  CONSTANT text := 'Siembra piloto — La Guajira, Las Dalias y Versalles';
  c_usuario CONSTANT text := 'carga piloto (conciliación de logística, 23/10/2026)';
  v_fecha     date := DATE '2026-10-01';   -- ← EDITA: fecha de las actas de entrega 001 y 02
  v_fecha_dev date := DATE '2026-10-21';   -- devolución al vivero de Morelia (acta de devolución final)
  v_central uuid;
  v_vivero  uuid;
  v_sid     uuid;
  r         record;
  v_actual  numeric;
  v_falta   numeric;
  v_items   jsonb;
  v_n_ajustes int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM inventario.salidas WHERE lower(btrim(nombre)) = lower(c_nombre)) THEN
    RAISE NOTICE 'La salida «%» ya está cargada: no se hizo nada.', c_nombre;
    RETURN;
  END IF;

  SELECT id INTO v_central FROM inventario.bodegas WHERE tipo = 'central' AND activo ORDER BY created_at LIMIT 1;
  SELECT id INTO v_vivero  FROM inventario.bodegas WHERE tipo = 'vivero'  AND activo ORDER BY created_at LIMIT 1;
  IF v_central IS NULL OR v_vivero IS NULL THEN
    RAISE EXCEPTION 'Falta la bodega central (Recepción) o el vivero. Revisa «Elementos y bodegas».';
  END IF;

  -- ── 1. Elementos que todavía no están en el catálogo ───────────────────────
  INSERT INTO inventario.insumos (nombre, unidad, categoria, clase, created_by)
  SELECT v.nombre, v.unidad, v.categoria, v.clase, c_usuario
  FROM (VALUES
    ('Conjunto impermeable PVC amarillo cal. 16 (chaqueta y pantalón)', 'und',   'epp',          'epp'),
    ('Guantes de nitrilo Multiflex',                  'und',   'epp',          'epp'),
    ('Guantes anticorte Vortex',                      'und',   'epp',          'epp'),
    ('Tapabocas negro individual',                    'und',   'epp',          'consumible'),
    ('Canillera con protector de pie',                'par',   'epp',          'epp'),
    ('Protector auditivo de inserción',               'und',   'epp',          'epp'),
    ('Gafa de seguridad policarbonato UV',            'und',   'epp',          'epp'),
    ('Punteras de seguridad para botas',              'par',   'epp',          'epp'),
    ('Botiquín en bolso tipo A',                      'und',   'epp',          'epp'),
    ('Alambre dulce',                                 'kg',    'cerramiento',  'consumible'),
    ('Cinta de peligro',                              'rollo', 'cerramiento',  'consumible'),
    ('Azadón',                                        'und',   'herramienta',  'herramienta'),
    ('Peinilla / machete',                            'und',   'herramienta',  'herramienta'),
    ('Cubierta para peinilla',                        'und',   'herramienta',  'herramienta'),
    ('Pala garlancha',                                'und',   'herramienta',  'herramienta'),
    ('Pala draga',                                    'und',   'herramienta',  'herramienta'),
    ('Pala ancha (palín)',                            'und',   'herramienta',  'herramienta'),
    ('Palín palmero',                                 'und',   'herramienta',  'herramienta'),
    ('Cubierta para pala',                            'und',   'herramienta',  'herramienta'),
    ('Cabo para pala / palín',                        'und',   'herramienta',  'herramienta'),
    ('Pala angosta',                                  'und',   'herramienta',  'herramienta'),
    ('Alicate',                                       'und',   'herramienta',  'herramienta'),
    ('Juego de llaves hexagonales',                   'juego', 'herramienta',  'herramienta'),
    ('Destornillador de estrías',                     'und',   'herramienta',  'herramienta'),
    ('Martillo',                                      'und',   'herramienta',  'herramienta'),
    ('Pala de jardín',                                'und',   'herramienta',  'herramienta'),
    ('Tabla portadocumentos',                         'und',   'herramienta',  'herramienta'),
    ('T para muestras de suelo',                      'und',   'herramienta',  'herramienta'),
    ('Puntillas (caja 400 g)',                        'caja',  'herramienta',  'consumible'),
    ('Pintura en aerosol',                            'und',   'herramienta',  'consumible'),
    ('Máquina ahoyadora',                             'und',   'equipo',       'herramienta'),
    ('Gramera digital SF-400',                        'und',   'equipo',       'herramienta'),
    ('Termo de hidratación Colplast 8 L',             'und',   'equipo',       'herramienta'),
    ('Aceite 2 tiempos',                              'envase','combustible',  'consumible')
  ) AS v(nombre, unidad, categoria, clase)
  WHERE NOT EXISTS (SELECT 1 FROM inventario.insumos i WHERE lower(btrim(i.nombre)) = lower(btrim(v.nombre)));

  -- La canastilla del vivero es herramienta; los demás elementos que ya estaban son consumibles.
  UPDATE inventario.insumos SET clase = 'herramienta' WHERE lower(btrim(nombre)) = 'canastilla plástica';

  -- ── 2. La hoja de Logística ────────────────────────────────────────────────
  --    (elemento del catálogo, entregado inicial, adicional, devuelto, consumido, instalado)
  CREATE TEMP TABLE _piloto (
    nombre text, inicial numeric, adicional numeric, devuelto numeric, consumido numeric, instalado numeric, insumo_id uuid
  ) ON COMMIT DROP;
  INSERT INTO _piloto (nombre, inicial, adicional, devuelto, consumido, instalado) VALUES
    -- EPP
    ('Conjunto impermeable PVC amarillo cal. 16 (chaqueta y pantalón)', 9, 0, 2, 0, 0),
    ('Guantes de nitrilo Multiflex',                10, 0, 0, 0, 0),
    ('Guantes anticorte Vortex',                     6, 0, 0, 0, 0),
    ('Tapabocas negro individual',                  50, 0, 0, 50, 0),
    ('Canillera con protector de pie',               1, 0, 1, 0, 0),
    ('Protector auditivo de inserción',              5, 0, 0, 0, 0),
    ('Gafa de seguridad policarbonato UV',           5, 0, 0, 0, 0),
    ('Punteras de seguridad para botas',             3, 0, 3, 0, 0),
    ('Botiquín en bolso tipo A',                     1, 0, 1, 0, 0),
    -- Cerramiento
    ('Poste plástico macizo 8 x 8 cm x 2,10 m',    670, 310, 0, 0, 0),
    ('Alambre de púas Iowa calibre 14',             15, 9, 8, 0, 16),
    ('Alambre dulce',                                3, 0, 1, 2, 0),
    ('Grapa larga 1 1/4" Puma',                     15, 0, 3, 12, 0),
    ('Lazo trenzado verde',                          0, 0, 1, 0, 0),
    ('Cinta de peligro',                             0, 0, 1, 0, 0),
    -- Herramientas
    ('Azadón',                                       2, 0, 4, 0, 0),
    ('Peinilla / machete',                           1, 0, 2, 0, 0),
    ('Cubierta para peinilla',                       1, 0, 2, 0, 0),
    ('Pala garlancha',                               2, 0, 3, 0, 0),
    ('Pala draga',                                   2, 0, 2, 0, 0),
    ('Pala ancha (palín)',                           1, 0, 1, 0, 0),
    ('Palín palmero',                                1, 0, 0, 0, 0),
    ('Cubierta para pala',                           2, 0, 0, 0, 0),
    ('Cabo para pala / palín',                       2, 0, 2, 0, 0),
    ('Pala angosta',                                 0, 0, 2, 0, 0),
    ('Alicate',                                      2, 0, 3, 0, 0),
    ('Juego de llaves hexagonales',                  1, 0, 1, 0, 0),
    ('Destornillador de estrías',                    1, 0, 1, 0, 0),
    ('Martillo',                                     0, 0, 1, 0, 0),
    ('Pala de jardín',                               0, 0, 2, 0, 0),
    ('Tabla portadocumentos',                        0, 0, 1, 0, 0),
    ('T para muestras de suelo',                     0, 0, 1, 0, 0),
    ('Puntillas (caja 400 g)',                       0, 0, 1, 0, 0),
    ('Pintura en aerosol',                           0, 0, 2, 0, 0),
    -- Equipos
    ('Máquina ahoyadora',                            1, 0, 1, 0, 0),
    ('Gramera digital SF-400',                       0, 0, 1, 0, 0),
    ('Termo de hidratación Colplast 8 L',            1, 0, 0, 0, 0),
    ('Aceite 2 tiempos',                             0, 0, 0.5, 0, 0),
    -- Insumos
    ('Fertilizante 10-30-10 Trefos YaraMila',       20, 30, 18, 32, 0),
    ('Cal Dolomita 70-25',                          110, 0, 44, 66, 0),
    ('Fertiorgánico Bosplant',                       0, 0, 34, 0, 0),
    ('Dropex',                                       4, 0, 4, 0, 0),
    ('Becano',                                       2, 0, 0, 0, 0),
    ('Panzer (Glifosato 747WG)',                     2, 0, 2, 0, 0),
    ('Hormitek',                                    50, 0, 0, 0, 0),
    ('Cebo artesanal para hormiga arriera',         88, 0, 0, 0, 0);

  UPDATE _piloto p SET insumo_id = i.id FROM inventario.insumos i WHERE lower(btrim(i.nombre)) = lower(btrim(p.nombre));
  IF EXISTS (SELECT 1 FROM _piloto WHERE insumo_id IS NULL) THEN
    RAISE EXCEPTION 'Estos elementos no están en el catálogo: %',
      (SELECT string_agg(nombre, ', ') FROM _piloto WHERE insumo_id IS NULL);
  END IF;

  -- ── 3. Lo que la hoja entrega y la intranet no tiene en la bodega central ──
  FOR r IN SELECT * FROM _piloto WHERE inicial + adicional > 0 LOOP
    SELECT coalesce(saldo, 0) INTO v_actual FROM inventario.v_existencias WHERE bodega_id = v_central AND insumo_id = r.insumo_id;
    v_actual := coalesce(v_actual, 0);
    v_falta := (r.inicial + r.adicional) - greatest(v_actual, 0);
    IF v_falta > 0 THEN
      INSERT INTO inventario.movimientos (tipo, insumo_id, cantidad, destino_id, estado, fecha, documento, notas, creado_por, motivo)
      VALUES ('ajuste', r.insumo_id, v_falta, v_central, 'confirmado', v_fecha, 'Carga piloto',
              'Existencia sin factura registrada en la intranet (conciliación del piloto, 23/10/2026). Anular y registrar la factura cuando se tenga.',
              c_usuario, 'conteo');
      v_n_ajustes := v_n_ajustes + 1;
    END IF;
  END LOOP;

  -- ── 4. La salida y sus actas ───────────────────────────────────────────────
  v_sid := inventario.crear_salida(c_nombre, NULL, '{}', NULL, v_vivero, v_fecha,
    'Cargada de la hoja de conciliación de Logística y Administrativa (corte 23/10/2026). Predios y responsable por completar.',
    NULL, c_usuario);

  SELECT jsonb_agg(jsonb_build_object('insumo_id', insumo_id, 'cantidad', inicial)) INTO v_items FROM _piloto WHERE inicial > 0;
  PERFORM inventario.registrar_acta(v_sid, 'entrega', v_fecha, v_central, NULL, v_items,
    'Corresponde a las actas de entrega 001 y 02 firmadas en papel; subir el escaneo.', c_usuario);

  SELECT jsonb_agg(jsonb_build_object('insumo_id', insumo_id, 'cantidad', adicional)) INTO v_items FROM _piloto WHERE adicional > 0;
  IF v_items IS NOT NULL THEN
    PERFORM inventario.registrar_acta(v_sid, 'adicional', v_fecha, v_central, NULL, v_items,
      'Compras o entregas adicionales según la conciliación de Logística.', c_usuario);
  END IF;

  SELECT jsonb_agg(jsonb_build_object('insumo_id', insumo_id, 'cantidad', devuelto)) INTO v_items FROM _piloto WHERE devuelto > 0;
  PERFORM inventario.registrar_acta(v_sid, 'devolucion', v_fecha_dev, v_vivero, NULL, v_items,
    'Acta de devolución final del 21/10/2026 (inventario enviado desde el vivero); subir el escaneo.', c_usuario, true);

  -- ── 5. Lo que Logística ya dio por consumido o instalado ──────────────────
  FOR r IN SELECT * FROM _piloto WHERE consumido > 0 OR instalado > 0 LOOP
    IF r.consumido > 0 THEN
      PERFORM inventario.justificar(v_sid, r.insumo_id, r.consumido, 'consumido',
        'Consumo según la conciliación de Logística del 23/10/2026. Falta cruzarlo con los registros de la app de campo.',
        NULL, v_fecha_dev, c_usuario);
    END IF;
    IF r.instalado > 0 THEN
      PERFORM inventario.justificar(v_sid, r.insumo_id, r.instalado, 'instalado',
        'Instalado en el cerramiento de los predios, según la conciliación de Logística del 23/10/2026. Falta cruzarlo con la app de campo.',
        NULL, v_fecha_dev, c_usuario);
    END IF;
  END LOOP;

  RAISE NOTICE 'Salida cargada: % elementos, % ajustes en la bodega central, 3 actas sin firma.',
    (SELECT count(*) FROM _piloto), v_n_ajustes;
END $$;


-- ============================================================
--  Verificación tras correr (los estados deben coincidir con la hoja de Logística)
-- ============================================================
--  select estado, count(*) from inventario.v_conciliacion_salida group by 1 order by 2 desc;
--  select nombre, saldo from inventario.v_conciliacion_salida
--   where estado in ('sin_devolucion','falta_justificar','devuelto_de_mas') order by estado, nombre;
--  -- impermeables: saldo 7 · postes: saldo 980 · 10-30-10, cal dolomita y alambre: consumido/instalado, saldo 0
--  select numero, tipo, fecha, firmada from inventario.actas order by numero;   -- ENT, ADI, DEV: sin firma
-- ============================================================
