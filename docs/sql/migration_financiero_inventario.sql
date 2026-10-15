-- ============================================================
--  MIGRACIÓN: módulo administrativo y financiero — compras, inventario y
--             bodegas por proyecto + registro de actividades de campo
--  Archivo : docs/sql/migration_financiero_inventario.sql
--  Fecha   : 2026-10-14
--  Requiere: core, geo (con migration_nucleacion.sql), catalogo.proyectos
--            (migration_proyecto_fuente.sql) y siembra ya creados.
--
--  QUÉ RESUELVE
--    1. Las compras entran por la FACTURA ELECTRÓNICA de la DIAN. La persona de
--       administrativa sube el .zip o el .xml que manda el proveedor; la intranet
--       lo lee (proveedor, NIT, CUFE, líneas, IVA, totales) y cada línea queda
--       como GASTO o como ENTRADA A INVENTARIO de un insumo del catálogo. La misma
--       factura no se puede registrar dos veces (CUFE único).
--    2. El inventario es un KARDEX: cada movimiento es una fila (entrada desde
--       factura, traslado entre bodegas, consumo en campo, ajuste). El saldo de
--       una bodega no se escribe en ningún lado: se calcula
--       (inventario.v_existencias). Nada se borra: lo que sobra se ANULA.
--    3. Las bodegas son de PROYECTO (Conexión Biodiversa, Ley del Árbol…), más la
--       central (Recepción) y el Vivero. La central reparte a las de proyecto con
--       traslados que la bodega destino ACEPTA.
--    4. La app de campo de actividades (actividades_monitoreo_campo) deja de ser
--       un demo local: lee los LOTES y NÚCLEOS que cargó el SIG (geo.zonas
--       'definitiva' + geo.nucleos), los INSUMOS del catálogo y el SALDO de su
--       bodega, y cada registro de campo descuenta de esa bodega
--       (siembra.registros_actividad + movimientos tipo 'consumo').
--
--  CÓMO ENTRA LA APP DE CAMPO (no es Supabase Auth, a propósito)
--    La app es pública y usa la key anon. No lee ninguna tabla: solo llama
--    funciones inventario.campo_* que piden un TOKEN. El token se obtiene con
--    inventario.campo_ingresar(título, clave): los títulos (BODEGA, SIEMBRA,
--    MONITOREO…) y sus claves se administran en la intranet. La clave se guarda
--    como huella bcrypt; 5 intentos fallidos bloquean el título 15 minutos.
--    Cambiar la clave o desactivar el título corta las sesiones abiertas.
--
--  QUIÉN LEE QUÉ
--    · financiero.* e inventario.* (tablas): SOLO service_role — es decir, las
--      rutas /api/administrativa/* de la intranet, que exigen sesión y el
--      departamento Financiero (o admin). RLS encendido sin políticas: con la
--      key anon o una sesión de Supabase Auth no se lee nada.
--    · Las funciones campo_*: anon (con token válido).
--
--  PASOS MANUALES (además de correr este archivo)
--    1. Supabase → Settings → API → Exposed schemas: agregar `financiero` e
--       `inventario`. Sin esto la intranet y la app no ven nada.
--    2. Ninguno más: el bucket se crea aquí.
--
--  REGLA DEL PROYECTO: este .sql lo corre el USUARIO en el SQL Editor. El
--  asistente no ejecuta DDL. El editor de Supabase NO respeta BEGIN/COMMIT
--  (ejecuta sentencia por sentencia), así que cada sentencia es repetible: si
--  algo falla a mitad, se corrige y se vuelve a correr el archivo entero.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 0 — Esquemas y extensión
-- ════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS financiero;
CREATE SCHEMA IF NOT EXISTS inventario;

-- bcrypt para las claves de los títulos de campo. En Supabase ya viene
-- instalada en el esquema `extensions`; si es así, esto no hace nada.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

COMMENT ON SCHEMA financiero IS
  'Compras: proveedores, facturas electrónicas DIAN y sus líneas. Solo service_role (rutas /api/administrativa de la intranet).';
COMMENT ON SCHEMA inventario IS
  'Insumos, bodegas por proyecto y kardex de movimientos. Tablas solo service_role; la app de campo entra por las funciones campo_* con token.';

-- Marca la hora de la última modificación. Una sola función para los dos esquemas.
CREATE OR REPLACE FUNCTION inventario.tocar_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

-- Texto comparable: minúsculas, sin tildes, espacios simples. Sirve para
-- reconocer la misma línea de factura la próxima vez que llegue.
CREATE OR REPLACE FUNCTION inventario.normalizar_texto(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(regexp_replace(
           translate(lower(coalesce(p, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou'),
           '\s+', ' ', 'g'));
$$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — Catálogo de insumos y bodegas
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inventario.insumos (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre       TEXT NOT NULL CHECK (btrim(nombre) <> ''),
  -- La unidad en que se CUENTA en bodega y en campo (Bulto, Litros, unidad…).
  -- La factura puede venir en otra (kg, galones): la línea guarda el factor.
  unidad       TEXT NOT NULL CHECK (btrim(unidad) <> ''),
  presentacion TEXT,                 -- "Bulto x 50 kg"
  categoria    TEXT,                 -- fertilizante, herbicida, combustible, cerramiento…
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  notas        TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS insumos_nombre_uq ON inventario.insumos (lower(btrim(nombre)));
COMMENT ON TABLE inventario.insumos IS
  'Catálogo de insumos. Es la lista CERRADA que usa la app de campo: allá no se escriben insumos a mano.';

DROP TRIGGER IF EXISTS trg_insumos_updated ON inventario.insumos;
CREATE TRIGGER trg_insumos_updated BEFORE UPDATE ON inventario.insumos
  FOR EACH ROW EXECUTE FUNCTION inventario.tocar_updated_at();

CREATE TABLE IF NOT EXISTS inventario.bodegas (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      TEXT NOT NULL CHECK (btrim(nombre) <> ''),
  -- central = donde entra lo comprado · proyecto = la bodega de un proyecto ·
  -- vivero · campo = una bodega puesta en un predio
  tipo        TEXT NOT NULL DEFAULT 'proyecto' CHECK (tipo IN ('central','proyecto','vivero','campo')),
  proyecto    TEXT REFERENCES catalogo.proyectos(codigo),
  responsable TEXT,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  notas       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS bodegas_nombre_uq ON inventario.bodegas (lower(btrim(nombre)));
COMMENT ON TABLE inventario.bodegas IS
  'Bodegas: la central (Recepción), una por proyecto y el vivero. El saldo no se guarda: se calcula en inventario.v_existencias.';

DROP TRIGGER IF EXISTS trg_bodegas_updated ON inventario.bodegas;
CREATE TRIGGER trg_bodegas_updated BEFORE UPDATE ON inventario.bodegas
  FOR EACH ROW EXECUTE FUNCTION inventario.tocar_updated_at();

-- Las bodegas que ya usaba el equipo en el demo de campo (hoja «Bodegas» del
-- Excel piloto). «Piloto Biodiversa» pasa a llamarse por su proyecto.
INSERT INTO inventario.bodegas (nombre, tipo, proyecto, responsable, notas)
SELECT v.nombre, v.tipo, v.proyecto, v.responsable, v.notas
FROM (VALUES
  ('Recepción',           'central',  NULL::text,            'Administrativa', 'Bodega central: aquí entra lo que se compra con factura.'),
  ('Conexión Biodiversa', 'proyecto', 'conexion_biodiversa', 'Siembra',        'Antes «Piloto Biodiversa» en el demo de campo.'),
  ('Ley del Árbol',       'proyecto', 'ley_arbol',           'Siembra',        NULL),
  ('Vivero',              'vivero',   NULL,                  'Monitoreo',      NULL)
) AS v(nombre, tipo, proyecto, responsable, notas)
WHERE NOT EXISTS (SELECT 1 FROM inventario.bodegas b WHERE lower(btrim(b.nombre)) = lower(btrim(v.nombre)));

-- El catálogo del piloto (hojas «Inventario» y «Campo» del Excel), el mismo que
-- traía la app de campo. Se edita desde la intranet.
INSERT INTO inventario.insumos (nombre, unidad, presentacion, categoria)
SELECT v.nombre, v.unidad, v.presentacion, v.categoria
FROM (VALUES
  ('Combustible',                          'Litros',       NULL,                 'combustible'),
  ('Cal Dolomita 70-25',                   'Bulto',        'Bulto x 50 kg',      'enmienda'),
  ('Fertiorgánico Bosplant',               'Bulto',        'Bulto x 50 kg',      'fertilizante'),
  ('Fertilizante químico (mezcla física)', 'Bulto',        'Bulto x 50 kg',      'fertilizante'),
  ('Panzer (Glifosato Solución)',          'Bidón',        'Bidón x 20 L',       'herbicida'),
  ('Panzer (Glifosato 747WG)',             'Bolsa',        'Bolsa x 10 kg',      'herbicida'),
  ('Becano',                               'Presentación', 'Presentación x 1 L', NULL),
  ('Dropex',                               'Presentación', 'Presentación x 1 L', NULL),
  ('Hormitek',                             'Bolsa',        'Bolsa x 500 g',      'hormiguicida'),
  ('Avena Hormiguera',                     'Bolsa',        'Bolsa x 475 g',      'hormiguicida'),
  ('Postes, alambre y grapas',             'unidad',       NULL,                 'cerramiento')
) AS v(nombre, unidad, presentacion, categoria)
WHERE NOT EXISTS (SELECT 1 FROM inventario.insumos i WHERE lower(btrim(i.nombre)) = lower(btrim(v.nombre)));


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — Proveedores, facturas y líneas
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financiero.proveedores (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nit              TEXT NOT NULL UNIQUE CHECK (nit ~ '^[0-9A-Za-z-]+$'),   -- sin puntos ni DV
  dv               TEXT,
  razon_social     TEXT NOT NULL,
  nombre_comercial TEXT,
  email            TEXT,
  telefono         TEXT,
  direccion        TEXT,
  ciudad           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_proveedores_updated ON financiero.proveedores;
CREATE TRIGGER trg_proveedores_updated BEFORE UPDATE ON financiero.proveedores
  FOR EACH ROW EXECUTE FUNCTION inventario.tocar_updated_at();

CREATE TABLE IF NOT EXISTS financiero.facturas (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proveedor_id      UUID NOT NULL REFERENCES financiero.proveedores(id),
  tipo_documento    TEXT NOT NULL DEFAULT 'factura'
                    CHECK (tipo_documento IN ('factura','documento_soporte','cuenta_cobro','otro')),
  numero            TEXT NOT NULL CHECK (btrim(numero) <> ''),   -- prefijo + consecutivo, como lo trae la DIAN
  cufe              TEXT UNIQUE,                                 -- NULL solo en las registradas a mano
  fecha_emision     DATE NOT NULL,
  fecha_vencimiento DATE,
  moneda            TEXT NOT NULL DEFAULT 'COP',
  forma_pago        TEXT,                                        -- contado / crédito
  subtotal          NUMERIC NOT NULL DEFAULT 0,                  -- antes de impuestos
  descuentos        NUMERIC NOT NULL DEFAULT 0,
  impuestos         NUMERIC NOT NULL DEFAULT 0,                  -- IVA, INC…
  retenciones       NUMERIC NOT NULL DEFAULT 0,                  -- informativo: no cambia el costo
  total             NUMERIC NOT NULL,                            -- lo que se paga
  adquiriente_nit   TEXT,                                        -- a nombre de quién vino
  -- A qué proyecto se carga el gasto (opcional: una compra general no tiene)
  proyecto          TEXT REFERENCES catalogo.proyectos(codigo),
  origen            TEXT NOT NULL DEFAULT 'xml_dian' CHECK (origen IN ('xml_dian','manual')),
  archivo_xml       TEXT,     -- ruta en el bucket financiero-facturas
  archivo_pdf       TEXT,
  estado            TEXT NOT NULL DEFAULT 'registrada' CHECK (estado IN ('registrada','anulada')),
  anulada_por       TEXT,
  anulada_at        TIMESTAMPTZ,
  motivo_anulacion  TEXT,
  notas             TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proveedor_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON financiero.facturas (fecha_emision DESC);
COMMENT ON TABLE financiero.facturas IS
  'Facturas de compra. El CUFE es único: la misma factura electrónica no entra dos veces. Anular no borra: deja la factura y sus entradas en estado anulado.';
DROP TRIGGER IF EXISTS trg_facturas_updated ON financiero.facturas;
CREATE TRIGGER trg_facturas_updated BEFORE UPDATE ON financiero.facturas
  FOR EACH ROW EXECUTE FUNCTION inventario.tocar_updated_at();

CREATE TABLE IF NOT EXISTS financiero.factura_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  factura_id      UUID NOT NULL REFERENCES financiero.facturas(id) ON DELETE CASCADE,
  linea           INT  NOT NULL,
  codigo          TEXT,               -- código del proveedor para ese producto
  descripcion     TEXT NOT NULL,
  cantidad        NUMERIC NOT NULL,
  unidad_medida   TEXT,               -- código DIAN (94 = unidad, KGM, LTR, GLL…)
  precio_unitario NUMERIC,
  subtotal        NUMERIC NOT NULL DEFAULT 0,   -- cantidad × precio − descuentos
  impuesto_pct    NUMERIC,
  impuesto_valor  NUMERIC NOT NULL DEFAULT 0,
  total           NUMERIC NOT NULL DEFAULT 0,   -- subtotal + impuesto
  -- Qué es esta línea para la organización:
  --   inventario → entra a una bodega como insumo del catálogo
  --   gasto      → se paga pero no se almacena (flete, servicio, herramienta de uso inmediato)
  clase           TEXT NOT NULL DEFAULT 'gasto' CHECK (clase IN ('inventario','gasto')),
  insumo_id       UUID REFERENCES inventario.insumos(id),
  -- Unidades de inventario por cada unidad facturada: la factura trae 1000 kg
  -- de cal y en bodega se cuentan bultos de 50 kg → factor 0,02.
  factor          NUMERIC NOT NULL DEFAULT 1 CHECK (factor > 0),
  bodega_id       UUID REFERENCES inventario.bodegas(id),
  UNIQUE (factura_id, linea),
  CONSTRAINT item_inventario_completo CHECK (clase <> 'inventario' OR (insumo_id IS NOT NULL AND bodega_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_factura_items_insumo ON financiero.factura_items (insumo_id);

-- Lo que se aprendió de cada proveedor: la próxima factura con el mismo código
-- (o la misma descripción) llega ya clasificada.
CREATE TABLE IF NOT EXISTS inventario.insumo_alias (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proveedor_nit TEXT NOT NULL,
  clave         TEXT NOT NULL,      -- código del proveedor, o la descripción normalizada
  clase         TEXT NOT NULL CHECK (clase IN ('inventario','gasto')),
  insumo_id     UUID REFERENCES inventario.insumos(id) ON DELETE CASCADE,
  factor        NUMERIC NOT NULL DEFAULT 1 CHECK (factor > 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proveedor_nit, clave)
);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — Registro de actividades de campo (etapa Ejecución)
--   Lo que antes vivía solo en el celular (app actividades_monitoreo_campo):
--   un día de trabajo sobre unos núcleos de un lote, con sus actividades,
--   jornales y la bodega de donde salieron los insumos.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS siembra.registros_actividad (
  -- El id lo pone el celular: así reenviar el mismo registro sin señal estable
  -- no lo duplica.
  id            UUID PRIMARY KEY,
  predio_id     UUID NOT NULL REFERENCES core.predios(id),
  zona_id       UUID NOT NULL REFERENCES geo.zonas(id),      -- el lote de siembra
  fecha         DATE NOT NULL,
  actividades   TEXT[] NOT NULL CHECK (cardinality(actividades) > 0),
  nucleo_ids    UUID[] NOT NULL DEFAULT '{}',                -- geo.nucleos trabajados
  nucleos_txt   TEXT,                                        -- como los vio la persona: "1-6, 8"
  personas      INT,
  jornales      NUMERIC,
  valor_jornal  NUMERIC,
  bodega_id     UUID REFERENCES inventario.bodegas(id),      -- de dónde salieron los insumos
  titulo        TEXT,                                        -- con qué título se registró
  notas         TEXT,
  anulado       BOOLEAN NOT NULL DEFAULT FALSE,
  anulado_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registros_actividad_zona  ON siembra.registros_actividad (zona_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_registros_actividad_fecha ON siembra.registros_actividad (fecha DESC);
COMMENT ON TABLE siembra.registros_actividad IS
  'Registro de campo de la etapa Ejecución: actividades sobre núcleos de un lote. Los insumos gastados son movimientos tipo consumo en inventario.movimientos (registro_id). Borrar = anulado=true.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — Kardex: inventario.movimientos
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inventario.movimientos (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo             TEXT NOT NULL CHECK (tipo IN ('entrada','traslado','consumo','ajuste')),
  insumo_id        UUID NOT NULL REFERENCES inventario.insumos(id),
  cantidad         NUMERIC NOT NULL CHECK (cantidad > 0),     -- siempre en la unidad del insumo
  origen_id        UUID REFERENCES inventario.bodegas(id),    -- de dónde sale
  destino_id       UUID REFERENCES inventario.bodegas(id),    -- a dónde entra
  -- confirmado  = cuenta en el saldo
  -- en_transito = traslado enviado que la bodega destino no ha recibido:
  --               ya salió del origen, todavía no entra al destino
  -- rechazado   = traslado que el destino no aceptó: vuelve al origen
  -- anulado     = no cuenta (factura anulada, registro editado o borrado, error)
  estado           TEXT NOT NULL DEFAULT 'confirmado'
                   CHECK (estado IN ('confirmado','en_transito','rechazado','anulado')),
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  costo_unitario   NUMERIC,           -- COP por unidad del insumo (entradas: sale de la factura, con IVA)
  factura_item_id  UUID REFERENCES financiero.factura_items(id),
  registro_id      UUID REFERENCES siembra.registros_actividad(id),
  documento        TEXT,
  notas            TEXT,
  creado_por       TEXT,              -- correo (intranet) o «campo:TÍTULO»
  recibido_por     TEXT,
  recibido_at      TIMESTAMPTZ,
  anulado_por      TEXT,
  anulado_at       TIMESTAMPTZ,
  motivo_anulacion TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mov_forma CHECK (
       (tipo = 'entrada'  AND destino_id IS NOT NULL AND origen_id IS NULL)
    OR (tipo = 'traslado' AND origen_id IS NOT NULL AND destino_id IS NOT NULL AND origen_id <> destino_id)
    OR (tipo = 'consumo'  AND origen_id IS NOT NULL AND destino_id IS NULL)
    OR (tipo = 'ajuste'   AND (origen_id IS NULL) <> (destino_id IS NULL))
  ),
  CONSTRAINT mov_estado_traslado CHECK (estado NOT IN ('en_transito','rechazado') OR tipo = 'traslado')
);
CREATE INDEX IF NOT EXISTS idx_mov_origen   ON inventario.movimientos (origen_id, insumo_id);
CREATE INDEX IF NOT EXISTS idx_mov_destino  ON inventario.movimientos (destino_id, insumo_id);
CREATE INDEX IF NOT EXISTS idx_mov_fecha    ON inventario.movimientos (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_mov_registro ON inventario.movimientos (registro_id) WHERE registro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mov_item     ON inventario.movimientos (factura_item_id) WHERE factura_item_id IS NOT NULL;
COMMENT ON TABLE inventario.movimientos IS
  'Kardex. Una fila por movimiento: entrada (factura), traslado (con aceptación), consumo (registro de campo) o ajuste. Nada se borra: se anula.';

DROP TRIGGER IF EXISTS trg_movimientos_updated ON inventario.movimientos;
CREATE TRIGGER trg_movimientos_updated BEFORE UPDATE ON inventario.movimientos
  FOR EACH ROW EXECUTE FUNCTION inventario.tocar_updated_at();

-- Soporte de un traslado tomado en campo (foto de la entrega o PDF), guardado
-- como texto base64. Los celulares no suben a Storage (usan la key anon); por
-- eso pasa por la función con token y se guarda aquí. Tope: ~3 MB.
CREATE TABLE IF NOT EXISTS inventario.soportes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  movimiento_id UUID NOT NULL REFERENCES inventario.movimientos(id) ON DELETE CASCADE,
  nombre        TEXT,
  tipo          TEXT,
  contenido     TEXT NOT NULL CHECK (length(contenido) <= 4200000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_soportes_mov ON inventario.soportes (movimiento_id);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — Saldos y costos (vistas)
-- ════════════════════════════════════════════════════════════

-- Saldo por bodega e insumo. Un traslado en tránsito ya salió del origen y
-- todavía no entra al destino: se muestra aparte como «por recibir».
CREATE OR REPLACE VIEW inventario.v_existencias AS
WITH m AS (
  SELECT destino_id AS bodega_id, insumo_id,
         CASE WHEN estado = 'confirmado'  THEN cantidad ELSE 0 END AS entra,
         0::numeric AS sale,
         CASE WHEN estado = 'en_transito' THEN cantidad ELSE 0 END AS por_recibir
    FROM inventario.movimientos
   WHERE destino_id IS NOT NULL AND estado IN ('confirmado','en_transito')
  UNION ALL
  SELECT origen_id, insumo_id, 0::numeric, cantidad, 0::numeric
    FROM inventario.movimientos
   WHERE origen_id IS NOT NULL AND estado IN ('confirmado','en_transito')
)
SELECT bodega_id, insumo_id,
       SUM(entra)              AS entradas,
       SUM(sale)               AS salidas,
       SUM(entra) - SUM(sale)  AS saldo,
       SUM(por_recibir)        AS por_recibir
  FROM m
 GROUP BY bodega_id, insumo_id;

COMMENT ON VIEW inventario.v_existencias IS
  'Saldo = entradas confirmadas − salidas (confirmadas o en tránsito). Puede quedar negativo: campo registró un consumo antes de que la oficina registrara el traslado. Se muestra en rojo, no se bloquea.';

-- Costo promedio ponderado de cada insumo, sobre todas sus compras vigentes.
CREATE OR REPLACE VIEW inventario.v_costo_insumo AS
SELECT insumo_id,
       SUM(cantidad)                                                   AS cantidad_comprada,
       SUM(cantidad * costo_unitario)                                  AS valor_comprado,
       ROUND(SUM(cantidad * costo_unitario) / NULLIF(SUM(cantidad), 0), 2) AS costo_promedio,
       MAX(fecha)                                                      AS ultima_compra
  FROM inventario.movimientos
 WHERE tipo = 'entrada' AND estado = 'confirmado' AND costo_unitario IS NOT NULL
 GROUP BY insumo_id;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 — Facturas: registrar, sugerir, anular (solo service_role)
-- ════════════════════════════════════════════════════════════

-- Registra una factura completa en una sola transacción: proveedor (lo crea o
-- lo actualiza por NIT), factura, líneas, y una ENTRADA al kardex por cada línea
-- clasificada como inventario. Aprende el alias de cada línea para la próxima.
--
-- p_datos = { proveedor: {nit, dv, razon_social, nombre_comercial, email, telefono, direccion, ciudad},
--             factura:   {tipo_documento, numero, cufe, fecha_emision, fecha_vencimiento, moneda,
--                         forma_pago, subtotal, descuentos, impuestos, retenciones, total,
--                         adquiriente_nit, proyecto, origen, archivo_xml, archivo_pdf, notas},
--             items: [{linea, codigo, descripcion, cantidad, unidad_medida, precio_unitario, subtotal,
--                      impuesto_pct, impuesto_valor, total, clase, insumo_id, factor, bodega_id}] }
CREATE OR REPLACE FUNCTION financiero.registrar_factura(p_datos jsonb, p_usuario text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = financiero, inventario, public, pg_temp
AS $$
DECLARE
  v_prov     jsonb := p_datos -> 'proveedor';
  v_fac      jsonb := p_datos -> 'factura';
  v_nit      text  := regexp_replace(coalesce(v_prov ->> 'nit', ''), '[^0-9A-Za-z-]', '', 'g');
  v_cufe     text  := nullif(btrim(v_fac ->> 'cufe'), '');
  v_prov_id  uuid;
  v_fac_id   uuid;
  v_item_id  uuid;
  it         jsonb;
  v_clase    text;
  v_factor   numeric;
  v_cant     numeric;
  v_total    numeric;
  v_clave    text;
  v_entradas int := 0;
  v_items    int := 0;
BEGIN
  IF v_nit = '' THEN RAISE EXCEPTION 'La factura no trae el NIT del proveedor.'; END IF;
  IF coalesce(btrim(v_prov ->> 'razon_social'), '') = '' THEN RAISE EXCEPTION 'Falta la razón social del proveedor.'; END IF;
  IF coalesce(btrim(v_fac ->> 'numero'), '') = '' THEN RAISE EXCEPTION 'Falta el número de la factura.'; END IF;
  IF (v_fac ->> 'fecha_emision') IS NULL THEN RAISE EXCEPTION 'Falta la fecha de la factura.'; END IF;
  IF jsonb_typeof(p_datos -> 'items') <> 'array' OR jsonb_array_length(p_datos -> 'items') = 0 THEN
    RAISE EXCEPTION 'La factura no tiene líneas.';
  END IF;

  IF v_cufe IS NOT NULL AND EXISTS (SELECT 1 FROM financiero.facturas WHERE cufe = v_cufe) THEN
    RAISE EXCEPTION 'Esta factura ya está registrada (mismo CUFE).' USING ERRCODE = '23505';
  END IF;

  INSERT INTO financiero.proveedores AS p (nit, dv, razon_social, nombre_comercial, email, telefono, direccion, ciudad)
  VALUES (v_nit, nullif(v_prov ->> 'dv', ''), btrim(v_prov ->> 'razon_social'),
          nullif(v_prov ->> 'nombre_comercial', ''), nullif(v_prov ->> 'email', ''),
          nullif(v_prov ->> 'telefono', ''), nullif(v_prov ->> 'direccion', ''), nullif(v_prov ->> 'ciudad', ''))
  ON CONFLICT (nit) DO UPDATE SET
    dv               = coalesce(EXCLUDED.dv, p.dv),
    razon_social     = EXCLUDED.razon_social,
    nombre_comercial = coalesce(EXCLUDED.nombre_comercial, p.nombre_comercial),
    email            = coalesce(EXCLUDED.email, p.email),
    telefono         = coalesce(EXCLUDED.telefono, p.telefono),
    direccion        = coalesce(EXCLUDED.direccion, p.direccion),
    ciudad           = coalesce(EXCLUDED.ciudad, p.ciudad)
  RETURNING id INTO v_prov_id;

  IF EXISTS (SELECT 1 FROM financiero.facturas WHERE proveedor_id = v_prov_id AND numero = btrim(v_fac ->> 'numero')) THEN
    RAISE EXCEPTION 'La factura % de este proveedor ya está registrada.', btrim(v_fac ->> 'numero') USING ERRCODE = '23505';
  END IF;

  INSERT INTO financiero.facturas (
    proveedor_id, tipo_documento, numero, cufe, fecha_emision, fecha_vencimiento, moneda, forma_pago,
    subtotal, descuentos, impuestos, retenciones, total, adquiriente_nit, proyecto, origen,
    archivo_xml, archivo_pdf, notas, created_by)
  VALUES (
    v_prov_id, coalesce(nullif(v_fac ->> 'tipo_documento', ''), 'factura'), btrim(v_fac ->> 'numero'), v_cufe,
    (v_fac ->> 'fecha_emision')::date, nullif(v_fac ->> 'fecha_vencimiento', '')::date,
    coalesce(nullif(v_fac ->> 'moneda', ''), 'COP'), nullif(v_fac ->> 'forma_pago', ''),
    coalesce((v_fac ->> 'subtotal')::numeric, 0), coalesce((v_fac ->> 'descuentos')::numeric, 0),
    coalesce((v_fac ->> 'impuestos')::numeric, 0), coalesce((v_fac ->> 'retenciones')::numeric, 0),
    coalesce((v_fac ->> 'total')::numeric, 0), nullif(v_fac ->> 'adquiriente_nit', ''),
    nullif(v_fac ->> 'proyecto', ''), coalesce(nullif(v_fac ->> 'origen', ''), 'xml_dian'),
    nullif(v_fac ->> 'archivo_xml', ''), nullif(v_fac ->> 'archivo_pdf', ''), nullif(v_fac ->> 'notas', ''),
    p_usuario)
  RETURNING id INTO v_fac_id;

  FOR it IN SELECT * FROM jsonb_array_elements(p_datos -> 'items') LOOP
    v_items  := v_items + 1;
    v_clase  := coalesce(nullif(it ->> 'clase', ''), 'gasto');
    v_factor := coalesce(nullif(it ->> 'factor', '')::numeric, 1);
    v_cant   := coalesce((it ->> 'cantidad')::numeric, 0);
    v_total  := coalesce((it ->> 'total')::numeric, 0);

    IF v_clase = 'inventario' THEN
      IF NOT EXISTS (SELECT 1 FROM inventario.insumos WHERE id = (it ->> 'insumo_id')::uuid) THEN
        RAISE EXCEPTION 'Línea %: elige el insumo del catálogo.', coalesce(it ->> 'linea', v_items::text);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM inventario.bodegas WHERE id = (it ->> 'bodega_id')::uuid) THEN
        RAISE EXCEPTION 'Línea %: elige la bodega que recibe.', coalesce(it ->> 'linea', v_items::text);
      END IF;
      IF v_cant <= 0 THEN
        RAISE EXCEPTION 'Línea %: la cantidad debe ser mayor que cero para entrar a inventario.', coalesce(it ->> 'linea', v_items::text);
      END IF;
    END IF;

    INSERT INTO financiero.factura_items (
      factura_id, linea, codigo, descripcion, cantidad, unidad_medida, precio_unitario, subtotal,
      impuesto_pct, impuesto_valor, total, clase, insumo_id, factor, bodega_id)
    VALUES (
      v_fac_id, coalesce((it ->> 'linea')::int, v_items), nullif(it ->> 'codigo', ''),
      coalesce(nullif(btrim(it ->> 'descripcion'), ''), '(sin descripción)'), v_cant,
      nullif(it ->> 'unidad_medida', ''), nullif(it ->> 'precio_unitario', '')::numeric,
      coalesce((it ->> 'subtotal')::numeric, 0), nullif(it ->> 'impuesto_pct', '')::numeric,
      coalesce((it ->> 'impuesto_valor')::numeric, 0), v_total, v_clase,
      CASE WHEN v_clase = 'inventario' THEN (it ->> 'insumo_id')::uuid END, v_factor,
      CASE WHEN v_clase = 'inventario' THEN (it ->> 'bodega_id')::uuid END)
    RETURNING id INTO v_item_id;

    IF v_clase = 'inventario' THEN
      INSERT INTO inventario.movimientos (
        tipo, insumo_id, cantidad, destino_id, estado, fecha, costo_unitario,
        factura_item_id, documento, creado_por)
      VALUES (
        'entrada', (it ->> 'insumo_id')::uuid, v_cant * v_factor, (it ->> 'bodega_id')::uuid, 'confirmado',
        (v_fac ->> 'fecha_emision')::date, ROUND(v_total / (v_cant * v_factor), 4),
        v_item_id, 'Factura ' || btrim(v_fac ->> 'numero'), p_usuario);
      v_entradas := v_entradas + 1;
    END IF;

    -- Aprender: la próxima línea igual de este proveedor llega clasificada.
    v_clave := coalesce(nullif(btrim(it ->> 'codigo'), ''), inventario.normalizar_texto(it ->> 'descripcion'));
    IF v_clave <> '' THEN
      INSERT INTO inventario.insumo_alias (proveedor_nit, clave, clase, insumo_id, factor)
      VALUES (v_nit, v_clave, v_clase,
              CASE WHEN v_clase = 'inventario' THEN (it ->> 'insumo_id')::uuid END, v_factor)
      ON CONFLICT (proveedor_nit, clave) DO UPDATE
        SET clase = EXCLUDED.clase, insumo_id = EXCLUDED.insumo_id, factor = EXCLUDED.factor, updated_at = NOW();
    END IF;
  END LOOP;

  RETURN jsonb_build_object('factura_id', v_fac_id, 'proveedor_id', v_prov_id, 'items', v_items, 'entradas', v_entradas);
END $$;

-- Para la pantalla de clasificación: ¿la factura ya existe? y, por cada línea,
-- lo que se decidió la última vez (alias) o un insumo cuyo nombre aparece en la
-- descripción.  p_items = [{linea, codigo, descripcion}]
CREATE OR REPLACE FUNCTION financiero.sugerir_items(p_nit text, p_cufe text, p_numero text, p_items jsonb)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = financiero, inventario, public, pg_temp
AS $$
  WITH prov AS (
    SELECT id FROM financiero.proveedores
     WHERE nit = regexp_replace(coalesce(p_nit, ''), '[^0-9A-Za-z-]', '', 'g')
  ),
  dup AS (
    SELECT f.id, f.numero, f.fecha_emision, f.estado
      FROM financiero.facturas f
     WHERE (nullif(p_cufe, '') IS NOT NULL AND f.cufe = p_cufe)
        OR (f.proveedor_id IN (SELECT id FROM prov) AND f.numero = btrim(coalesce(p_numero, '')))
     LIMIT 1
  ),
  it AS (
    SELECT (e ->> 'linea')::int AS linea,
           coalesce(nullif(btrim(e ->> 'codigo'), ''), inventario.normalizar_texto(e ->> 'descripcion')) AS clave,
           inventario.normalizar_texto(e ->> 'descripcion') AS descr
      FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
  ),
  sug AS (
    SELECT it.linea,
           a.clase     AS alias_clase,
           a.insumo_id AS alias_insumo,
           a.factor    AS alias_factor,
           (SELECT i.id FROM inventario.insumos i
             WHERE i.activo AND length(inventario.normalizar_texto(i.nombre)) >= 4
               AND strpos(it.descr, inventario.normalizar_texto(i.nombre)) > 0
             ORDER BY length(i.nombre) DESC LIMIT 1) AS por_nombre
      FROM it
      LEFT JOIN inventario.insumo_alias a
        ON a.proveedor_nit = regexp_replace(coalesce(p_nit, ''), '[^0-9A-Za-z-]', '', 'g') AND a.clave = it.clave
  )
  SELECT jsonb_build_object(
    'proveedor_conocido', EXISTS (SELECT 1 FROM prov),
    'duplicada', (SELECT to_jsonb(dup) FROM dup),
    'items', coalesce((SELECT jsonb_agg(jsonb_build_object(
                'linea', linea,
                'origen', CASE WHEN alias_clase IS NOT NULL THEN 'aprendido' WHEN por_nombre IS NOT NULL THEN 'nombre' END,
                'clase', coalesce(alias_clase, CASE WHEN por_nombre IS NOT NULL THEN 'inventario' END),
                'insumo_id', coalesce(alias_insumo, por_nombre),
                'factor', coalesce(alias_factor, 1)) ORDER BY linea) FROM sug), '[]'::jsonb)
  );
$$;

-- Anular una factura: queda la factura (estado 'anulada') y sus entradas al
-- kardex pasan a 'anulado'. Si ese insumo ya se repartió, la bodega central
-- puede quedar en negativo: es lo correcto (lo repartido salió de algún lado).
CREATE OR REPLACE FUNCTION financiero.anular_factura(p_id uuid, p_usuario text, p_motivo text)
RETURNS int
LANGUAGE plpgsql
SET search_path = financiero, inventario, public, pg_temp
AS $$
DECLARE v_n int;
BEGIN
  UPDATE financiero.facturas
     SET estado = 'anulada', anulada_por = p_usuario, anulada_at = NOW(), motivo_anulacion = p_motivo
   WHERE id = p_id AND estado <> 'anulada';
  IF NOT FOUND THEN RETURN 0; END IF;

  UPDATE inventario.movimientos m
     SET estado = 'anulado', anulado_por = p_usuario, anulado_at = NOW(),
         motivo_anulacion = coalesce(p_motivo, 'Factura anulada')
    FROM financiero.factura_items fi
   WHERE fi.factura_id = p_id AND m.factura_item_id = fi.id AND m.estado <> 'anulado';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 7 — Traslados y ajustes desde la intranet (solo service_role)
-- ════════════════════════════════════════════════════════════

-- Reparte varios insumos de una bodega a otra en un solo envío.
--   p_items = [{insumo_id, cantidad}]
--   p_entregado = true cuando la oficina registra algo que YA se entregó:
--   entra confirmado y no espera a que el destino lo acepte.
CREATE OR REPLACE FUNCTION inventario.trasladar(
  p_origen uuid, p_destino uuid, p_items jsonb, p_fecha date, p_notas text,
  p_usuario text, p_entregado boolean DEFAULT false)
RETURNS uuid[]
LANGUAGE plpgsql
SET search_path = inventario, public, pg_temp
AS $$
DECLARE
  it    jsonb;
  v_id  uuid;
  v_ids uuid[] := '{}';
BEGIN
  IF p_origen IS NULL OR p_destino IS NULL OR p_origen = p_destino THEN
    RAISE EXCEPTION 'Elige una bodega de origen y una de destino distintas.';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El traslado no tiene insumos.';
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF coalesce((it ->> 'cantidad')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Cada insumo del traslado necesita una cantidad mayor que cero.';
    END IF;
    INSERT INTO inventario.movimientos (tipo, insumo_id, cantidad, origen_id, destino_id, estado, fecha, notas, documento, creado_por,
                                        recibido_por, recibido_at)
    VALUES ('traslado', (it ->> 'insumo_id')::uuid, (it ->> 'cantidad')::numeric, p_origen, p_destino,
            CASE WHEN p_entregado THEN 'confirmado' ELSE 'en_transito' END,
            coalesce(p_fecha, CURRENT_DATE), nullif(p_notas, ''), 'Traslado', p_usuario,
            CASE WHEN p_entregado THEN p_usuario END, CASE WHEN p_entregado THEN NOW() END)
    RETURNING id INTO v_id;
    v_ids := v_ids || v_id;
  END LOOP;
  RETURN v_ids;
END $$;

-- La bodega destino acepta (entra al saldo) o rechaza (vuelve al origen).
CREATE OR REPLACE FUNCTION inventario.recibir_traslado(p_id uuid, p_aceptar boolean, p_usuario text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = inventario, public, pg_temp
AS $$
BEGIN
  UPDATE inventario.movimientos
     SET estado = CASE WHEN p_aceptar THEN 'confirmado' ELSE 'rechazado' END,
         recibido_por = p_usuario, recibido_at = NOW()
   WHERE id = p_id AND tipo = 'traslado' AND estado = 'en_transito';
  RETURN FOUND;
END $$;

-- Anular un traslado o un ajuste hecho por error. Las entradas se anulan con su
-- factura y los consumos con su registro de campo: aquí no.
CREATE OR REPLACE FUNCTION inventario.anular_movimiento(p_id uuid, p_usuario text, p_motivo text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = inventario, public, pg_temp
AS $$
BEGIN
  UPDATE inventario.movimientos
     SET estado = 'anulado', anulado_por = p_usuario, anulado_at = NOW(), motivo_anulacion = p_motivo
   WHERE id = p_id AND tipo IN ('traslado','ajuste') AND estado <> 'anulado';
  RETURN FOUND;
END $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 8 — Títulos de campo y sus sesiones
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inventario.titulos_campo (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- No son personas: el cargo o la actividad con la que alguien entra ese día.
  nombre            TEXT NOT NULL UNIQUE CHECK (nombre = upper(btrim(nombre)) AND nombre <> ''),
  -- bodega    = solo inventario de su bodega
  -- siembra   = registros de actividad + resumen + inventario de sus bodegas
  -- monitoreo = lo de siembra + monitoreo de lo sembrado
  rol               TEXT NOT NULL CHECK (rol IN ('bodega','siembra','monitoreo')),
  bodega_ids        UUID[] NOT NULL DEFAULT '{}',   -- vacío = ve el inventario de todas
  clave_hash        TEXT,                           -- bcrypt; NULL = todavía no puede entrar
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  intentos_fallidos INT NOT NULL DEFAULT 0,
  bloqueado_hasta   TIMESTAMPTZ,
  ultimo_ingreso    TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE inventario.titulos_campo IS
  'Con qué se entra a la app de campo de actividades. La clave se pone desde la intranet (inventario.fijar_clave_titulo) y solo se guarda su huella bcrypt.';
DROP TRIGGER IF EXISTS trg_titulos_updated ON inventario.titulos_campo;
CREATE TRIGGER trg_titulos_updated BEFORE UPDATE ON inventario.titulos_campo
  FOR EACH ROW EXECUTE FUNCTION inventario.tocar_updated_at();

CREATE TABLE IF NOT EXISTS inventario.sesiones_campo (
  token       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo_id   UUID NOT NULL REFERENCES inventario.titulos_campo(id) ON DELETE CASCADE,
  creada      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Larga a propósito: el celular pasa semanas sin señal en el predio y no
  -- debe quedarse por fuera de su propio trabajo.
  expira      TIMESTAMPTZ NOT NULL,
  ultimo_uso  TIMESTAMPTZ,
  dispositivo TEXT
);
CREATE INDEX IF NOT EXISTS idx_sesiones_campo_titulo ON inventario.sesiones_campo (titulo_id);

-- Los tres títulos que ya usaba el equipo en el demo. Nacen SIN clave: hay que
-- ponérsela desde la intranet antes de que alguien pueda entrar.
INSERT INTO inventario.titulos_campo (nombre, rol, bodega_ids)
SELECT v.nombre, v.rol,
       coalesce((SELECT array_agg(b.id ORDER BY b.nombre) FROM inventario.bodegas b
                  WHERE b.nombre = ANY (v.bodegas)), '{}')
FROM (VALUES
  ('BODEGA',    'bodega',    ARRAY['Recepción']),
  ('SIEMBRA',   'siembra',   ARRAY['Conexión Biodiversa','Ley del Árbol']),
  ('MONITOREO', 'monitoreo', ARRAY['Vivero'])
) AS v(nombre, rol, bodegas)
WHERE NOT EXISTS (SELECT 1 FROM inventario.titulos_campo t WHERE t.nombre = v.nombre);

-- Poner o cambiar la clave de un título (solo la intranet). Corta las sesiones
-- abiertas con la clave anterior.
CREATE OR REPLACE FUNCTION inventario.fijar_clave_titulo(p_id uuid, p_clave text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = inventario, public, extensions, pg_temp
AS $$
BEGIN
  IF length(coalesce(p_clave, '')) < 6 THEN
    RAISE EXCEPTION 'La clave debe tener al menos 6 caracteres.';
  END IF;
  UPDATE inventario.titulos_campo
     SET clave_hash = crypt(p_clave, gen_salt('bf', 8)), intentos_fallidos = 0, bloqueado_hasta = NULL
   WHERE id = p_id;
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM inventario.sesiones_campo WHERE titulo_id = p_id;
  RETURN true;
END $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 9 — Funciones de la app de campo (anon con token)
--   SECURITY DEFINER: corren con los permisos del dueño de las tablas, así
--   que la key anon no necesita (ni tiene) acceso a ninguna tabla. Cada una
--   valida el token antes de hacer nada.
-- ════════════════════════════════════════════════════════════

-- Lista para la pantalla de entrada: solo nombres y rol.
CREATE OR REPLACE FUNCTION inventario.campo_titulos()
RETURNS TABLE (nombre text, rol text, tiene_clave boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = inventario, pg_temp
AS $$
  SELECT nombre, rol, clave_hash IS NOT NULL
    FROM inventario.titulos_campo WHERE activo ORDER BY nombre;
$$;

-- Entrar: devuelve {ok, token, titulo, rol, expira} o {ok:false, error}.
-- No lanza excepción al fallar, a propósito: una excepción desharía el conteo
-- de intentos fallidos y el bloqueo nunca llegaría.
CREATE OR REPLACE FUNCTION inventario.campo_ingresar(p_titulo text, p_clave text, p_dispositivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = inventario, public, extensions, pg_temp
AS $$
DECLARE
  t       inventario.titulos_campo;
  v_token uuid;
  v_expira timestamptz := NOW() + interval '90 days';
BEGIN
  SELECT * INTO t FROM inventario.titulos_campo WHERE nombre = upper(btrim(coalesce(p_titulo, ''))) AND activo;
  IF NOT FOUND OR t.clave_hash IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ese título no existe o todavía no tiene clave. Pídela en la oficina.');
  END IF;
  IF t.bloqueado_hasta IS NOT NULL AND t.bloqueado_hasta > NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Demasiados intentos con clave equivocada. Espera 15 minutos.');
  END IF;
  IF crypt(coalesce(p_clave, ''), t.clave_hash) <> t.clave_hash THEN
    UPDATE inventario.titulos_campo
       SET intentos_fallidos = intentos_fallidos + 1,
           bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= 5 THEN NOW() + interval '15 minutes' END
     WHERE id = t.id;
    RETURN jsonb_build_object('ok', false, 'error', 'Clave incorrecta.');
  END IF;

  UPDATE inventario.titulos_campo SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_ingreso = NOW() WHERE id = t.id;
  DELETE FROM inventario.sesiones_campo WHERE titulo_id = t.id AND expira < NOW();
  INSERT INTO inventario.sesiones_campo (titulo_id, expira, dispositivo)
  VALUES (t.id, v_expira, left(p_dispositivo, 200))
  RETURNING token INTO v_token;

  RETURN jsonb_build_object('ok', true, 'token', v_token, 'titulo', t.nombre, 'rol', t.rol, 'expira', v_expira);
END $$;

-- Interna: el título detrás de un token vigente, o error.
CREATE OR REPLACE FUNCTION inventario._sesion_campo(p_token uuid)
RETURNS inventario.titulos_campo
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = inventario, pg_temp
AS $$
DECLARE t inventario.titulos_campo;
BEGIN
  SELECT tc.* INTO t
    FROM inventario.sesiones_campo s
    JOIN inventario.titulos_campo tc ON tc.id = s.titulo_id
   WHERE s.token = p_token AND s.expira > NOW() AND tc.activo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESION_VENCIDA' USING HINT = 'Vuelve a entrar con tu título y clave.';
  END IF;
  UPDATE inventario.sesiones_campo SET ultimo_uso = NOW() WHERE token = p_token;
  RETURN t;
END $$;

-- Todo lo que la app necesita para trabajar sin señal, en una sola llamada.
CREATE OR REPLACE FUNCTION inventario.campo_datos(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = inventario, public, pg_temp
AS $$
DECLARE
  t   inventario.titulos_campo;
  mis uuid[];
  r   jsonb;
BEGIN
  t   := inventario._sesion_campo(p_token);
  mis := t.bodega_ids;

  SELECT jsonb_build_object(
    'servidor_ahora', NOW(),
    'titulo', jsonb_build_object('id', t.id, 'nombre', t.nombre, 'rol', t.rol, 'bodega_ids', to_jsonb(t.bodega_ids)),

    'bodegas', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'id', b.id, 'nombre', b.nombre, 'tipo', b.tipo, 'proyecto', b.proyecto,
                  'responsable', b.responsable) ORDER BY b.tipo <> 'central', b.nombre), '[]'::jsonb)
                  FROM inventario.bodegas b WHERE b.activo),

    'insumos', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'id', i.id, 'nombre', i.nombre, 'unidad', i.unidad, 'presentacion', i.presentacion,
                  'categoria', i.categoria, 'costo_promedio', c.costo_promedio) ORDER BY i.nombre), '[]'::jsonb)
                  FROM inventario.insumos i
                  LEFT JOIN inventario.v_costo_insumo c ON c.insumo_id = i.id
                 WHERE i.activo),

    'existencias', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                      'bodega_id', e.bodega_id, 'insumo_id', e.insumo_id, 'entradas', e.entradas,
                      'salidas', e.salidas, 'saldo', e.saldo, 'por_recibir', e.por_recibir)), '[]'::jsonb)
                      FROM inventario.v_existencias e
                     WHERE cardinality(mis) = 0 OR e.bodega_id = ANY (mis)),

    -- Los últimos 400 movimientos que tocan las bodegas del título (sin los de consumo:
    -- esos ya vienen dentro de cada registro).
    'movimientos', (SELECT coalesce(jsonb_agg(x ORDER BY x ->> 'fecha' DESC, x ->> 'creado' DESC), '[]'::jsonb) FROM (
                      SELECT jsonb_build_object(
                        'id', m.id, 'tipo', m.tipo, 'insumo_id', m.insumo_id, 'cantidad', m.cantidad,
                        'origen_id', m.origen_id, 'destino_id', m.destino_id, 'estado', m.estado,
                        'fecha', m.fecha, 'creado', m.created_at, 'costo_unitario', m.costo_unitario,
                        'documento', m.documento, 'notas', m.notas, 'creado_por', m.creado_por,
                        'recibido_por', m.recibido_por,
                        'proveedor', (SELECT p.razon_social FROM financiero.factura_items fi
                                        JOIN financiero.facturas f ON f.id = fi.factura_id
                                        JOIN financiero.proveedores p ON p.id = f.proveedor_id
                                       WHERE fi.id = m.factura_item_id),
                        'tiene_soporte', EXISTS (SELECT 1 FROM inventario.soportes s WHERE s.movimiento_id = m.id)) AS x
                        FROM inventario.movimientos m
                       WHERE m.tipo <> 'consumo' AND m.estado <> 'anulado'
                         AND (cardinality(mis) = 0 OR m.origen_id = ANY (mis) OR m.destino_id = ANY (mis))
                       ORDER BY m.fecha DESC, m.created_at DESC
                       LIMIT 400) q),

    -- Lotes de siembra (zonas 'definitiva') que ya tienen nucleación del SIG.
    'lotes', (SELECT coalesce(jsonb_agg(l ORDER BY l ->> 'predio', l ->> 'lote'), '[]'::jsonb) FROM (
                SELECT jsonb_build_object(
                  'zona_id', z.id, 'predio_id', p.id, 'predio', p.nombre_predio,
                  'municipio', p.municipio, 'vereda', p.vereda, 'proyecto', p.tipo_proyecto,
                  'lote', coalesce(nullif(btrim(z.nombre), ''), 'Lote'),
                  'area_ha', round(z.area_ha::numeric, 2),
                  'geojson', ST_AsGeoJSON(ST_SimplifyPreserveTopology(z.geom, 0.000005), 6)::jsonb,
                  'nucleos', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                                 'id', n.id, 'nombre', n.nombre,
                                 'numero', n.propiedades ->> 'Nucleo',
                                 'x', round(ST_X(ST_Centroid(n.geom))::numeric, 7),
                                 'y', round(ST_Y(ST_Centroid(n.geom))::numeric, 7),
                                 -- Radio en metros: el buffer con que el SIG dibujó el núcleo, o el que da su área.
                                 'radio', CASE WHEN (n.propiedades ->> 'BUFF_DIST') ~ '^[0-9]+(\.[0-9]+)?$'
                                               THEN (n.propiedades ->> 'BUFF_DIST')::numeric
                                               ELSE round(sqrt(coalesce(n.area_ha, 0) * 10000 / pi())::numeric, 1) END
                               ) ORDER BY n.created_at), '[]'::jsonb)
                                FROM geo.nucleos n WHERE n.zona_id = z.id AND n.vigente)
                ) AS l
                  FROM geo.zonas z
                  JOIN core.predios p ON p.id = z.predio_id
                 WHERE z.tipo = 'restauracion' AND z.vigente AND z.estado = 'definitiva'
                   AND EXISTS (SELECT 1 FROM geo.nucleos n WHERE n.zona_id = z.id AND n.vigente)) s),

    -- Los registros de campo vigentes (los 3000 más recientes), con sus consumos.
    'registros', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                    'id', r.id, 'fecha', r.fecha, 'zona_id', r.zona_id, 'predio_id', r.predio_id,
                    'actividades', to_jsonb(r.actividades), 'nucleo_ids', to_jsonb(r.nucleo_ids),
                    'nucleos_txt', r.nucleos_txt, 'personas', r.personas, 'jornales', r.jornales,
                    'valor_jornal', r.valor_jornal, 'bodega_id', r.bodega_id, 'titulo', r.titulo,
                    'notas', r.notas, 'updated_at', r.updated_at,
                    'insumos', (SELECT coalesce(jsonb_agg(jsonb_build_object('insumo_id', m.insumo_id, 'cantidad', m.cantidad)), '[]'::jsonb)
                                  FROM inventario.movimientos m
                                 WHERE m.registro_id = r.id AND m.tipo = 'consumo' AND m.estado <> 'anulado')
                  ) ORDER BY r.fecha DESC, r.created_at DESC), '[]'::jsonb)
                    FROM (SELECT * FROM siembra.registros_actividad WHERE NOT anulado
                           ORDER BY fecha DESC, created_at DESC LIMIT 3000) r)
  ) INTO r;

  RETURN r;
END $$;

-- Guardar (crear o editar) un registro de campo con sus consumos.
--   p_reg = {id, zona_id, fecha, actividades[], nucleo_ids[], nucleos_txt, personas, jornales,
--            valor_jornal, bodega_id, notas, insumos: [{insumo_id, cantidad}]}
-- Al editar, los consumos anteriores quedan anulados y se escriben los nuevos:
-- el kardex conserva lo que hubo.
CREATE OR REPLACE FUNCTION inventario.campo_guardar_registro(p_token uuid, p_reg jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = inventario, public, pg_temp
AS $$
DECLARE
  t        inventario.titulos_campo;
  v_id     uuid := (p_reg ->> 'id')::uuid;
  v_zona   uuid := (p_reg ->> 'zona_id')::uuid;
  v_bodega uuid := nullif(p_reg ->> 'bodega_id', '')::uuid;
  v_predio uuid;
  v_acts   text[];
  v_nucs   uuid[];
  v_insum  jsonb := coalesce(p_reg -> 'insumos', '[]'::jsonb);
  v_existe siembra.registros_actividad;
  it       jsonb;
BEGIN
  t := inventario._sesion_campo(p_token);
  IF t.rol NOT IN ('siembra','monitoreo') THEN
    RAISE EXCEPTION 'El título % no registra actividades de campo.', t.nombre;
  END IF;
  IF v_id IS NULL THEN RAISE EXCEPTION 'El registro llegó sin identificador.'; END IF;

  SELECT predio_id INTO v_predio FROM geo.zonas WHERE id = v_zona;
  IF NOT FOUND THEN RAISE EXCEPTION 'El lote del registro no existe en el SIG.'; END IF;

  SELECT coalesce(array_agg(x), '{}') INTO v_acts FROM jsonb_array_elements_text(coalesce(p_reg -> 'actividades', '[]')) x;
  IF cardinality(v_acts) = 0 THEN RAISE EXCEPTION 'Marca al menos una actividad.'; END IF;
  SELECT coalesce(array_agg(x::uuid), '{}') INTO v_nucs FROM jsonb_array_elements_text(coalesce(p_reg -> 'nucleo_ids', '[]')) x;

  IF jsonb_array_length(v_insum) > 0 THEN
    IF v_bodega IS NULL THEN RAISE EXCEPTION 'Elige la bodega de donde salieron los insumos.'; END IF;
    IF cardinality(t.bodega_ids) > 0 AND NOT v_bodega = ANY (t.bodega_ids) THEN
      RAISE EXCEPTION 'El título % no descuenta de esa bodega.', t.nombre;
    END IF;
  END IF;

  SELECT * INTO v_existe FROM siembra.registros_actividad WHERE id = v_id;
  IF FOUND THEN
    IF v_existe.anulado THEN
      RETURN jsonb_build_object('ok', false, 'id', v_id, 'error', 'Este registro se borró desde otro equipo.');
    END IF;
    UPDATE siembra.registros_actividad SET
      predio_id = v_predio, zona_id = v_zona, fecha = (p_reg ->> 'fecha')::date, actividades = v_acts,
      nucleo_ids = v_nucs, nucleos_txt = nullif(p_reg ->> 'nucleos_txt', ''),
      personas = nullif(p_reg ->> 'personas', '')::int, jornales = nullif(p_reg ->> 'jornales', '')::numeric,
      valor_jornal = nullif(p_reg ->> 'valor_jornal', '')::numeric, bodega_id = v_bodega,
      titulo = t.nombre, notas = nullif(p_reg ->> 'notas', ''), updated_at = NOW()
    WHERE id = v_id;
    UPDATE inventario.movimientos
       SET estado = 'anulado', anulado_por = 'campo:' || t.nombre, anulado_at = NOW(), motivo_anulacion = 'Registro de campo editado'
     WHERE registro_id = v_id AND tipo = 'consumo' AND estado <> 'anulado';
  ELSE
    INSERT INTO siembra.registros_actividad (id, predio_id, zona_id, fecha, actividades, nucleo_ids, nucleos_txt,
      personas, jornales, valor_jornal, bodega_id, titulo, notas)
    VALUES (v_id, v_predio, v_zona, (p_reg ->> 'fecha')::date, v_acts, v_nucs, nullif(p_reg ->> 'nucleos_txt', ''),
      nullif(p_reg ->> 'personas', '')::int, nullif(p_reg ->> 'jornales', '')::numeric,
      nullif(p_reg ->> 'valor_jornal', '')::numeric, v_bodega, t.nombre, nullif(p_reg ->> 'notas', ''));
  END IF;

  FOR it IN SELECT * FROM jsonb_array_elements(v_insum) LOOP
    IF coalesce((it ->> 'cantidad')::numeric, 0) > 0 THEN
      INSERT INTO inventario.movimientos (tipo, insumo_id, cantidad, origen_id, estado, fecha, registro_id, documento, creado_por)
      VALUES ('consumo', (it ->> 'insumo_id')::uuid, (it ->> 'cantidad')::numeric, v_bodega, 'confirmado',
              (p_reg ->> 'fecha')::date, v_id, 'Registro de campo', 'campo:' || t.nombre);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

-- Borrar un registro de campo: queda anulado y sus consumos vuelven al saldo.
CREATE OR REPLACE FUNCTION inventario.campo_anular_registro(p_token uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = inventario, public, pg_temp
AS $$
DECLARE t inventario.titulos_campo;
BEGIN
  t := inventario._sesion_campo(p_token);
  IF t.rol NOT IN ('siembra','monitoreo') THEN
    RAISE EXCEPTION 'El título % no registra actividades de campo.', t.nombre;
  END IF;
  UPDATE siembra.registros_actividad SET anulado = true, anulado_at = NOW(), updated_at = NOW()
   WHERE id = p_id AND NOT anulado;
  UPDATE inventario.movimientos
     SET estado = 'anulado', anulado_por = 'campo:' || t.nombre, anulado_at = NOW(), motivo_anulacion = 'Registro de campo borrado'
   WHERE registro_id = p_id AND tipo = 'consumo' AND estado <> 'anulado';
  RETURN jsonb_build_object('ok', true, 'id', p_id);
END $$;

-- Enviar un traslado desde una bodega del título. Queda en tránsito hasta que el
-- destino lo acepte.  p_mov = {id, origen_id, destino_id, insumo_id, cantidad, fecha, notas,
--                              soporte: {nombre, tipo, data}}
CREATE OR REPLACE FUNCTION inventario.campo_trasladar(p_token uuid, p_mov jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = inventario, public, pg_temp
AS $$
DECLARE
  t        inventario.titulos_campo;
  v_id     uuid := (p_mov ->> 'id')::uuid;
  v_origen uuid := (p_mov ->> 'origen_id')::uuid;
BEGIN
  t := inventario._sesion_campo(p_token);
  IF v_id IS NULL THEN RAISE EXCEPTION 'El traslado llegó sin identificador.'; END IF;
  IF EXISTS (SELECT 1 FROM inventario.movimientos WHERE id = v_id) THEN
    RETURN jsonb_build_object('ok', true, 'id', v_id);       -- ya había llegado: reenvío sin señal estable
  END IF;
  IF cardinality(t.bodega_ids) > 0 AND NOT v_origen = ANY (t.bodega_ids) THEN
    RAISE EXCEPTION 'El título % solo envía desde sus bodegas.', t.nombre;
  END IF;
  INSERT INTO inventario.movimientos (id, tipo, insumo_id, cantidad, origen_id, destino_id, estado, fecha, notas, documento, creado_por)
  VALUES (v_id, 'traslado', (p_mov ->> 'insumo_id')::uuid, (p_mov ->> 'cantidad')::numeric, v_origen,
          (p_mov ->> 'destino_id')::uuid, 'en_transito', coalesce(nullif(p_mov ->> 'fecha', '')::date, CURRENT_DATE),
          nullif(p_mov ->> 'notas', ''), 'Soporte de entrega', 'campo:' || t.nombre);
  IF p_mov -> 'soporte' ->> 'data' IS NOT NULL THEN
    INSERT INTO inventario.soportes (movimiento_id, nombre, tipo, contenido)
    VALUES (v_id, p_mov -> 'soporte' ->> 'nombre', p_mov -> 'soporte' ->> 'tipo', p_mov -> 'soporte' ->> 'data');
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

-- Aceptar o rechazar un traslado que llega a una bodega del título.
CREATE OR REPLACE FUNCTION inventario.campo_recibir(p_token uuid, p_id uuid, p_aceptar boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = inventario, public, pg_temp
AS $$
DECLARE
  t         inventario.titulos_campo;
  v_destino uuid;
  v_estado  text;
BEGIN
  t := inventario._sesion_campo(p_token);
  SELECT destino_id, estado INTO v_destino, v_estado FROM inventario.movimientos WHERE id = p_id AND tipo = 'traslado';
  IF NOT FOUND THEN RAISE EXCEPTION 'Ese traslado no existe.'; END IF;
  IF cardinality(t.bodega_ids) > 0 AND NOT v_destino = ANY (t.bodega_ids) THEN
    RAISE EXCEPTION 'Ese traslado no va para una bodega del título %.', t.nombre;
  END IF;
  IF v_estado <> 'en_transito' THEN
    RETURN jsonb_build_object('ok', true, 'id', p_id, 'estado', v_estado);   -- ya lo resolvió alguien
  END IF;
  PERFORM inventario.recibir_traslado(p_id, p_aceptar, 'campo:' || t.nombre);
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'estado', CASE WHEN p_aceptar THEN 'confirmado' ELSE 'rechazado' END);
END $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 10 — Bucket de facturas (privado)
--   Solo lo usa el servidor de la intranet (service_role, que no necesita
--   políticas). Sin políticas para authenticated: nadie lo lee desde el
--   navegador si no es con una URL firmada que entrega la intranet.
-- ════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('financiero-facturas', 'financiero-facturas', false)
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 11 — RLS y permisos
-- ════════════════════════════════════════════════════════════

ALTER TABLE inventario.insumos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario.bodegas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario.movimientos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario.soportes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario.insumo_alias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario.titulos_campo      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario.sesiones_campo     ENABLE ROW LEVEL SECURITY;
ALTER TABLE financiero.proveedores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE financiero.facturas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE financiero.factura_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE siembra.registros_actividad   ENABLE ROW LEVEL SECURITY;

-- USAGE: anon necesita entrar al esquema inventario para llamar las funciones
-- campo_*; las tablas siguen cerradas (sin GRANT y sin políticas).
GRANT USAGE ON SCHEMA inventario TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA financiero TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA inventario TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA financiero TO service_role;
GRANT ALL ON siembra.registros_actividad    TO service_role;
-- Por si alguna vez se otorgó algo de más (las vistas heredan del dueño):
REVOKE ALL ON ALL TABLES IN SCHEMA inventario FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA financiero FROM anon, authenticated;
REVOKE ALL ON siembra.registros_actividad    FROM anon, authenticated;

-- Postgres le regala EXECUTE a PUBLIC en toda función nueva: se le quita a
-- todas y se da a quien corresponde.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA inventario FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA financiero FROM PUBLIC;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA inventario TO service_role;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA financiero TO service_role;

-- La app de campo (key anon): solo estas siete.
GRANT EXECUTE ON FUNCTION inventario.campo_titulos()                         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION inventario.campo_ingresar(text, text, text)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION inventario.campo_datos(uuid)                       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION inventario.campo_guardar_registro(uuid, jsonb)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION inventario.campo_anular_registro(uuid, uuid)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION inventario.campo_trasladar(uuid, jsonb)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION inventario.campo_recibir(uuid, uuid, boolean)      TO anon, authenticated;
-- normalizar_texto y tocar_updated_at son internas; _sesion_campo también.


-- ════════════════════════════════════════════════════════════
-- BLOQUE 12 — Recargar PostgREST
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr (y tras agregar los esquemas en Exposed schemas)
-- ============================================================
--  select count(*) from inventario.bodegas;        -- 4 (Recepción, Conexión Biodiversa, Ley del Árbol, Vivero)
--  select count(*) from inventario.insumos;        -- 11
--  select nombre, rol, cardinality(bodega_ids), clave_hash is null as sin_clave
--    from inventario.titulos_campo;                -- BODEGA / SIEMBRA / MONITOREO, los tres sin clave
--  select id, public from storage.buckets where id = 'financiero-facturas';   -- public = false
--  select inventario.campo_titulos();              -- los tres títulos
--
--  Con la key anon, por REST, NO se debe poder leer ninguna tabla:
--    GET /rest/v1/movimientos  (Accept-Profile: inventario)  → 401/42501
--  y SÍ responder la función de entrada:
--    POST /rest/v1/rpc/campo_titulos (Content-Profile: inventario) → 200
-- ============================================================
