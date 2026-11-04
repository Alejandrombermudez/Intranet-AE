-- ============================================================
--  MIGRACIÓN: salidas a campo — entrega, consumo, devolución y cierre de
--             materiales, herramientas y EPP, con actas y responsable
--  Archivo : docs/sql/migration_salidas_campo.sql
--  Fecha   : 2026-10-28
--  Requiere: migration_financiero_inventario.sql y migration_talento_humano.sql
--            (people.personas) ya corridas.
--  Plan    : docs/PLAN_SALIDAS_CAMPO.md
--
--  QUÉ RESUELVE (pedido de la Dirección Financiera y Administrativa, 2026-10-23)
--    1. Cada elemento del catálogo tiene una CLASE: consumible (se gasta),
--       herramienta y epp (vuelven a bodega), dotacion (se queda con quien la recibe).
--    2. Una SALIDA A CAMPO es una bodega más (tipo 'campo') con responsable y fechas.
--       Lo que el equipo tiene a cargo es el saldo de esa bodega:
--         entregar  = traslado bodega física → salida, con acta
--         consumir  = registro de actividad en la app (ya existe)
--         devolver  = traslado salida → bodega física, que se recibe CONTANDO
--         cerrar    = todo lo que queda en el saldo se explica con un motivo de lista
--    3. Quien recibe EPP o herramientas a su nombre tiene su propia bodega
--       «a cargo de» (tipo 'persona'): la intranet sabe qué tiene cada quien.
--    4. Las ACTAS (entrega, adicional, devolución, EPP) llevan consecutivo, una foto
--       fija de lo que dicen y el escaneo firmado (bucket privado inventario-actas).
--    5. La vista inventario.v_conciliacion_salida calcula sola la hoja de
--       conciliación (entregado, adicional, consumido, devuelto, a cargo, diferencia
--       y estado). La intranet la muestra y la descarga en Excel.
--
--  TRABAJADORES DE CAMPO: people.personas exige correo de la organización y los de
--  campo no lo tienen; por eso hay una lista aparte, people.trabajadores_campo.
--  Se cargan desde la intranet, NUNCA en un .sql del repo (es público).
--
--  QUIÉN LEE QUÉ: todo es solo service_role (rutas /api/administrativa/*). La app
--  de campo sigue entrando por campo_*; campo_datos solo AGREGA la clase de cada
--  insumo y deja de mostrar las bodegas «a cargo de» (nombres de trabajadores).
--
--  REGLA DEL PROYECTO: este .sql lo corre el USUARIO en el SQL Editor. El editor
--  NO respeta BEGIN/COMMIT: cada sentencia es repetible; si algo falla a mitad,
--  se corrige y se vuelve a correr el archivo entero.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — Clase de cada elemento
-- ════════════════════════════════════════════════════════════

ALTER TABLE inventario.insumos ADD COLUMN IF NOT EXISTS clase TEXT NOT NULL DEFAULT 'consumible';
ALTER TABLE inventario.insumos DROP CONSTRAINT IF EXISTS insumos_clase_check;
ALTER TABLE inventario.insumos ADD CONSTRAINT insumos_clase_check
  CHECK (clase IN ('consumible','herramienta','epp','dotacion'));
COMMENT ON COLUMN inventario.insumos.clase IS
  'consumible = se gasta en campo · herramienta y epp = vuelven a bodega · dotacion = se queda con quien la recibe. La define SG-SST.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — Trabajadores de campo
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS people.trabajadores_campo (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombres          TEXT NOT NULL CHECK (btrim(nombres) <> ''),
  apellidos        TEXT,
  tipo_documento   TEXT CHECK (tipo_documento IN ('CC','CE','TI','PEP','PPT','PA')),
  numero_documento TEXT,
  celular          TEXT,
  cargo            TEXT,
  -- Si además tiene ficha con correo de la organización.
  persona_id       UUID REFERENCES people.personas(id),
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  notas            TEXT,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS trabajadores_campo_documento_uq
  ON people.trabajadores_campo (numero_documento) WHERE numero_documento IS NOT NULL;
COMMENT ON TABLE people.trabajadores_campo IS
  'Quien trabaja en campo y recibe materiales, herramientas o EPP a su nombre. Sin correo de la organización. Solo service_role; datos personales: se cargan desde la intranet, no desde el repo.';

DROP TRIGGER IF EXISTS trg_trabajadores_campo_updated ON people.trabajadores_campo;
CREATE TRIGGER trg_trabajadores_campo_updated BEFORE UPDATE ON people.trabajadores_campo
  FOR EACH ROW EXECUTE FUNCTION inventario.tocar_updated_at();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — Bodegas: sede física y «a cargo de»
-- ════════════════════════════════════════════════════════════

-- El CHECK de tipo nació sin nombre propio: se quita el que haya y se pone uno
-- con nombre, que admite 'sede' (Florencia, Escuela Bosque…) y 'persona'.
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'inventario.bodegas'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%central%' LOOP
    EXECUTE format('ALTER TABLE inventario.bodegas DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE inventario.bodegas ADD CONSTRAINT bodegas_tipo_check
  CHECK (tipo IN ('central','proyecto','vivero','campo','sede','persona'));

ALTER TABLE inventario.bodegas ADD COLUMN IF NOT EXISTS trabajador_id UUID REFERENCES people.trabajadores_campo(id);
CREATE UNIQUE INDEX IF NOT EXISTS bodegas_trabajador_uq ON inventario.bodegas (trabajador_id) WHERE trabajador_id IS NOT NULL;

COMMENT ON COLUMN inventario.bodegas.tipo IS
  'central = donde entra lo comprado · proyecto · vivero · sede = bodega física de la organización · campo = una SALIDA a campo (ver inventario.salidas) · persona = lo que tiene a cargo un trabajador';

-- Bodegas físicas. El vivero de Morelia ya existe como «Vivero».
INSERT INTO inventario.bodegas (nombre, tipo, responsable, notas)
SELECT v.nombre, 'sede', v.responsable, v.notas
FROM (VALUES
  ('Florencia',       'Logística', 'Bodega de la sede en Florencia.'),
  ('Escuela Bosque',  'Logística', 'Bodega de la Escuela Bosque.')
) AS v(nombre, responsable, notas)
WHERE NOT EXISTS (SELECT 1 FROM inventario.bodegas b WHERE lower(btrim(b.nombre)) = lower(btrim(v.nombre)));


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — Salidas a campo y actas
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS inventario.salidas (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre            TEXT NOT NULL CHECK (btrim(nombre) <> ''),
  proyecto          TEXT REFERENCES catalogo.proyectos(codigo),
  predio_ids        UUID[] NOT NULL DEFAULT '{}',          -- core.predios que se trabajan
  responsable_id    UUID REFERENCES people.trabajadores_campo(id),
  bodega_id         UUID NOT NULL REFERENCES inventario.bodegas(id),     -- la bodega de la salida
  bodega_retorno_id UUID REFERENCES inventario.bodegas(id),              -- a dónde se espera que vuelva
  fecha_salida      DATE NOT NULL,
  fecha_cierre      DATE,
  estado            TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
  notas             TEXT,
  creado_por        TEXT,
  cerrado_por       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS salidas_nombre_uq ON inventario.salidas (lower(btrim(nombre)));
CREATE UNIQUE INDEX IF NOT EXISTS salidas_bodega_uq ON inventario.salidas (bodega_id);
COMMENT ON TABLE inventario.salidas IS
  'Una salida a campo: el equipo sale con materiales de una o varias bodegas y vuelve. Su saldo es el de su bodega (tipo campo). No se cierra mientras quede algo sin explicar.';
DROP TRIGGER IF EXISTS trg_salidas_updated ON inventario.salidas;
CREATE TRIGGER trg_salidas_updated BEFORE UPDATE ON inventario.salidas
  FOR EACH ROW EXECUTE FUNCTION inventario.tocar_updated_at();

CREATE TABLE IF NOT EXISTS inventario.actas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero        TEXT NOT NULL UNIQUE,                       -- ENT-2026-001, ADI-, DEV-, EPP-
  tipo          TEXT NOT NULL CHECK (tipo IN ('entrega','adicional','devolucion','epp')),
  salida_id     UUID NOT NULL REFERENCES inventario.salidas(id),
  trabajador_id UUID REFERENCES people.trabajadores_campo(id),   -- quien firma un acta de EPP
  fecha         DATE NOT NULL,
  -- Foto fija de lo que dice el acta (salida, responsable, bodegas, elementos con su
  -- nombre y unidad): el mismo acta produce siempre el mismo PDF.
  datos         JSONB NOT NULL,
  archivo       TEXT,                                       -- ruta del escaneo firmado en el bucket
  firmada       BOOLEAN NOT NULL DEFAULT FALSE,
  firmada_at    TIMESTAMPTZ,
  notas         TEXT,
  creado_por    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_actas_salida ON inventario.actas (salida_id, fecha);
COMMENT ON TABLE inventario.actas IS
  'Entrega, entrega adicional, devolución y EPP individual de una salida. El escaneo firmado se sube después (archivo + firmada).';

INSERT INTO storage.buckets (id, name, public)
VALUES ('inventario-actas', 'inventario-actas', false)
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — Movimientos: acta, motivo y trabajador
-- ════════════════════════════════════════════════════════════

ALTER TABLE inventario.movimientos ADD COLUMN IF NOT EXISTS acta_id UUID REFERENCES inventario.actas(id);
ALTER TABLE inventario.movimientos ADD COLUMN IF NOT EXISTS motivo TEXT;
ALTER TABLE inventario.movimientos ADD COLUMN IF NOT EXISTS trabajador_id UUID REFERENCES people.trabajadores_campo(id);
ALTER TABLE inventario.movimientos DROP CONSTRAINT IF EXISTS movimientos_motivo_check;
ALTER TABLE inventario.movimientos ADD CONSTRAINT movimientos_motivo_check
  CHECK (motivo IS NULL OR motivo IN ('consumido','instalado','danado','perdido','dotacion','a_cargo','sobrante','conteo'));
CREATE INDEX IF NOT EXISTS idx_mov_acta ON inventario.movimientos (acta_id) WHERE acta_id IS NOT NULL;

COMMENT ON COLUMN inventario.movimientos.motivo IS
  'Por qué se explica una diferencia al cerrar una salida: consumido, instalado, danado, perdido, dotacion (se queda con el trabajador), a_cargo (lo tiene un trabajador y debe devolverlo), sobrante (se devolvió más de lo entregado), conteo.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 — Funciones (solo service_role)
-- ════════════════════════════════════════════════════════════

-- Consecutivo por tipo y año: ENT-2026-001. El candado evita dos iguales si dos
-- personas registran a la vez.
CREATE OR REPLACE FUNCTION inventario.numero_acta(p_tipo text, p_fecha date)
RETURNS text
LANGUAGE plpgsql
SET search_path = inventario, public, pg_temp
AS $$
DECLARE
  v_pref text := CASE p_tipo WHEN 'entrega' THEN 'ENT' WHEN 'adicional' THEN 'ADI'
                             WHEN 'devolucion' THEN 'DEV' WHEN 'epp' THEN 'EPP' END;
  v_anio text := to_char(coalesce(p_fecha, CURRENT_DATE), 'YYYY');
  v_n    int;
BEGIN
  IF v_pref IS NULL THEN RAISE EXCEPTION 'Tipo de acta no válido: %', p_tipo; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('inventario.actas'));
  SELECT count(*) + 1 INTO v_n FROM inventario.actas WHERE numero LIKE v_pref || '-' || v_anio || '-%';
  RETURN v_pref || '-' || v_anio || '-' || lpad(v_n::text, 3, '0');
END $$;

-- La bodega «a cargo de» de un trabajador; la crea la primera vez.
CREATE OR REPLACE FUNCTION inventario.bodega_trabajador(p_trabajador uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = inventario, people, public, pg_temp
AS $$
DECLARE
  t      people.trabajadores_campo;
  v_id   uuid;
  v_nom  text;
BEGIN
  SELECT id INTO v_id FROM inventario.bodegas WHERE trabajador_id = p_trabajador;
  IF FOUND THEN RETURN v_id; END IF;
  SELECT * INTO t FROM people.trabajadores_campo WHERE id = p_trabajador;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ese trabajador no existe.'; END IF;
  v_nom := 'A cargo de ' || btrim(t.nombres || ' ' || coalesce(t.apellidos, ''));
  IF EXISTS (SELECT 1 FROM inventario.bodegas WHERE lower(btrim(nombre)) = lower(v_nom)) THEN
    v_nom := v_nom || ' (' || left(t.id::text, 4) || ')';
  END IF;
  INSERT INTO inventario.bodegas (nombre, tipo, trabajador_id, responsable, notas)
  VALUES (v_nom, 'persona', p_trabajador, btrim(t.nombres || ' ' || coalesce(t.apellidos, '')),
          'Lo que este trabajador tiene a su cargo (EPP, herramientas, dotación).')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Crea la salida y su bodega. p_titulo_ids: títulos de la app de campo que
-- descuentan de ella (solo los que ya tienen bodegas asignadas; los que ven
-- todas la ven sin más).
CREATE OR REPLACE FUNCTION inventario.crear_salida(
  p_nombre text, p_proyecto text, p_predio_ids uuid[], p_responsable uuid, p_bodega_retorno uuid,
  p_fecha date, p_notas text, p_titulo_ids uuid[], p_usuario text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = inventario, people, public, pg_temp
AS $$
DECLARE
  v_bodega uuid;
  v_id     uuid;
  v_resp   text;
BEGIN
  IF coalesce(btrim(p_nombre), '') = '' THEN RAISE EXCEPTION 'Ponle un nombre a la salida.'; END IF;
  IF p_fecha IS NULL THEN RAISE EXCEPTION 'Falta la fecha de salida.'; END IF;
  IF EXISTS (SELECT 1 FROM inventario.salidas WHERE lower(btrim(nombre)) = lower(btrim(p_nombre))) THEN
    RAISE EXCEPTION 'Ya existe una salida llamada «%».', btrim(p_nombre) USING ERRCODE = '23505';
  END IF;
  IF p_responsable IS NOT NULL THEN
    SELECT btrim(nombres || ' ' || coalesce(apellidos, '')) INTO v_resp FROM people.trabajadores_campo WHERE id = p_responsable;
    IF NOT FOUND THEN RAISE EXCEPTION 'El responsable no existe.'; END IF;
  END IF;

  INSERT INTO inventario.bodegas (nombre, tipo, proyecto, responsable, notas)
  VALUES ('Salida · ' || btrim(p_nombre), 'campo', nullif(p_proyecto, ''), v_resp,
          'Bodega de una salida a campo: lo que el equipo lleva y tiene a cargo.')
  RETURNING id INTO v_bodega;

  INSERT INTO inventario.salidas (nombre, proyecto, predio_ids, responsable_id, bodega_id, bodega_retorno_id, fecha_salida, notas, creado_por)
  VALUES (btrim(p_nombre), nullif(p_proyecto, ''), coalesce(p_predio_ids, '{}'), p_responsable, v_bodega,
          p_bodega_retorno, p_fecha, nullif(btrim(coalesce(p_notas, '')), ''), p_usuario)
  RETURNING id INTO v_id;

  IF p_titulo_ids IS NOT NULL THEN
    UPDATE inventario.titulos_campo
       SET bodega_ids = array_append(bodega_ids, v_bodega)
     WHERE id = ANY (p_titulo_ids) AND cardinality(bodega_ids) > 0 AND NOT v_bodega = ANY (bodega_ids);
  END IF;
  RETURN v_id;
END $$;

-- Registra un acta y sus movimientos en una sola transacción.
--   entrega / adicional : p_bodega_otra → bodega de la salida (confirmado: ya se entregó)
--   devolucion          : bodega de la salida → p_bodega_otra (en camino hasta contarlo,
--                         o confirmado si p_recibido)
--   epp                 : bodega de la salida → «a cargo de» p_trabajador (confirmado)
--   p_items = [{insumo_id, cantidad}]
-- Devuelve {acta_id, numero}.
CREATE OR REPLACE FUNCTION inventario.registrar_acta(
  p_salida uuid, p_tipo text, p_fecha date, p_bodega_otra uuid, p_trabajador uuid,
  p_items jsonb, p_notas text, p_usuario text, p_recibido boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = inventario, people, public, pg_temp
AS $$
DECLARE
  s        inventario.salidas;
  v_orig   uuid;
  v_dest   uuid;
  v_estado text;
  v_numero text;
  v_acta   uuid;
  v_items  jsonb := '[]'::jsonb;
  it       jsonb;
  ins      inventario.insumos;
  v_cant   numeric;
  v_motivo text;
  v_trab   text;
BEGIN
  SELECT * INTO s FROM inventario.salidas WHERE id = p_salida;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa salida no existe.'; END IF;
  IF s.estado <> 'abierta' THEN RAISE EXCEPTION 'La salida «%» ya está cerrada.', s.nombre; END IF;
  IF p_tipo NOT IN ('entrega','adicional','devolucion','epp') THEN RAISE EXCEPTION 'Tipo de acta no válido.'; END IF;
  IF p_fecha IS NULL THEN RAISE EXCEPTION 'Falta la fecha del acta.'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El acta no tiene elementos.';
  END IF;

  IF p_tipo IN ('entrega','adicional') THEN
    IF p_bodega_otra IS NULL THEN RAISE EXCEPTION 'Elige la bodega de donde sale lo que se entrega.'; END IF;
    v_orig := p_bodega_otra; v_dest := s.bodega_id; v_estado := 'confirmado';
  ELSIF p_tipo = 'devolucion' THEN
    IF p_bodega_otra IS NULL THEN RAISE EXCEPTION 'Elige la bodega a donde vuelve lo devuelto.'; END IF;
    v_orig := s.bodega_id; v_dest := p_bodega_otra;
    v_estado := CASE WHEN p_recibido THEN 'confirmado' ELSE 'en_transito' END;
  ELSE
    IF p_trabajador IS NULL THEN RAISE EXCEPTION 'Elige el trabajador que recibe y firma.'; END IF;
    v_orig := s.bodega_id; v_dest := inventario.bodega_trabajador(p_trabajador); v_estado := 'confirmado';
  END IF;
  IF v_orig = v_dest THEN RAISE EXCEPTION 'Origen y destino no pueden ser la misma bodega.'; END IF;

  -- Foto fija de los elementos.
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_cant := coalesce((it ->> 'cantidad')::numeric, 0);
    IF v_cant <= 0 THEN RAISE EXCEPTION 'Cada elemento del acta necesita una cantidad mayor que cero.'; END IF;
    SELECT * INTO ins FROM inventario.insumos WHERE id = (it ->> 'insumo_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Un elemento del acta no está en el catálogo.'; END IF;
    v_items := v_items || jsonb_build_object('insumo_id', ins.id, 'nombre', ins.nombre, 'unidad', ins.unidad,
                                              'clase', ins.clase, 'cantidad', v_cant);
  END LOOP;

  SELECT btrim(nombres || ' ' || coalesce(apellidos, '')) INTO v_trab FROM people.trabajadores_campo WHERE id = p_trabajador;

  v_numero := inventario.numero_acta(p_tipo, p_fecha);
  INSERT INTO inventario.actas (numero, tipo, salida_id, trabajador_id, fecha, datos, notas, creado_por)
  VALUES (v_numero, p_tipo, p_salida, p_trabajador, p_fecha,
          jsonb_build_object(
            'salida', s.nombre,
            'responsable', (SELECT btrim(nombres || ' ' || coalesce(apellidos, '')) FROM people.trabajadores_campo WHERE id = s.responsable_id),
            'origen', (SELECT nombre FROM inventario.bodegas WHERE id = v_orig),
            'destino', (SELECT nombre FROM inventario.bodegas WHERE id = v_dest),
            'trabajador', v_trab,
            'trabajador_documento', (SELECT coalesce(tipo_documento || ' ', '') || coalesce(numero_documento, '') FROM people.trabajadores_campo WHERE id = p_trabajador),
            'items', v_items),
          nullif(btrim(coalesce(p_notas, '')), ''), p_usuario)
  RETURNING id INTO v_acta;

  FOR it IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_motivo := NULL;
    IF p_tipo = 'epp' THEN
      v_motivo := CASE WHEN it ->> 'clase' = 'dotacion' THEN 'dotacion' ELSE 'a_cargo' END;
    END IF;
    INSERT INTO inventario.movimientos (tipo, insumo_id, cantidad, origen_id, destino_id, estado, fecha, documento, notas,
                                        creado_por, acta_id, motivo, trabajador_id, recibido_por, recibido_at)
    VALUES ('traslado', (it ->> 'insumo_id')::uuid, (it ->> 'cantidad')::numeric, v_orig, v_dest, v_estado, p_fecha,
            'Acta ' || v_numero, nullif(btrim(coalesce(p_notas, '')), ''), p_usuario, v_acta, v_motivo,
            CASE WHEN p_tipo = 'epp' THEN p_trabajador END,
            CASE WHEN v_estado = 'confirmado' THEN p_usuario END, CASE WHEN v_estado = 'confirmado' THEN NOW() END);
  END LOOP;

  RETURN jsonb_build_object('acta_id', v_acta, 'numero', v_numero);
END $$;

-- Recibir una devolución CONTANDO: lo contado puede ser menos de lo enviado (la
-- diferencia vuelve al saldo de la salida y hay que explicarla); más, no.
CREATE OR REPLACE FUNCTION inventario.recibir_contando(p_id uuid, p_cantidad numeric, p_usuario text)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = inventario, public, pg_temp
AS $$
DECLARE m inventario.movimientos;
BEGIN
  SELECT * INTO m FROM inventario.movimientos WHERE id = p_id AND tipo = 'traslado' AND estado = 'en_transito';
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_cantidad IS NULL OR p_cantidad < 0 THEN RAISE EXCEPTION 'Escribe cuánto contaste.'; END IF;
  IF p_cantidad > m.cantidad THEN
    RAISE EXCEPTION 'Contaste más (%) de lo que se envió (%). Recibe lo enviado y registra el sobrante al cerrar la salida.', p_cantidad, m.cantidad;
  END IF;
  IF p_cantidad = 0 THEN
    UPDATE inventario.movimientos SET estado = 'rechazado', recibido_por = p_usuario, recibido_at = NOW(),
           notas = trim(both ' · ' from coalesce(notas, '') || ' · Se contó 0 de ' || m.cantidad)
     WHERE id = p_id;
  ELSE
    UPDATE inventario.movimientos SET estado = 'confirmado', cantidad = p_cantidad, recibido_por = p_usuario, recibido_at = NOW(),
           notas = CASE WHEN p_cantidad < m.cantidad
                        THEN trim(both ' · ' from coalesce(notas, '') || ' · Enviado ' || m.cantidad || ', contado ' || p_cantidad)
                        ELSE notas END
     WHERE id = p_id;
  END IF;
  RETURN true;
END $$;

-- Explica una diferencia de una salida con un motivo de lista (y una nota).
--   consumido · instalado · danado · perdido   → ajuste que saca de la salida
--   dotacion · a_cargo (necesitan trabajador)  → traslado a su bodega «a cargo de»
--   sobrante                                   → ajuste que entra (se devolvió de más)
CREATE OR REPLACE FUNCTION inventario.justificar(
  p_salida uuid, p_insumo uuid, p_cantidad numeric, p_motivo text, p_nota text,
  p_trabajador uuid, p_fecha date, p_usuario text)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = inventario, people, public, pg_temp
AS $$
DECLARE
  s    inventario.salidas;
  v_id uuid;
BEGIN
  SELECT * INTO s FROM inventario.salidas WHERE id = p_salida;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa salida no existe.'; END IF;
  IF s.estado <> 'abierta' THEN RAISE EXCEPTION 'La salida «%» ya está cerrada.', s.nombre; END IF;
  IF p_motivo NOT IN ('consumido','instalado','danado','perdido','dotacion','a_cargo','sobrante') THEN
    RAISE EXCEPTION 'Elige un motivo de la lista.';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'La cantidad debe ser mayor que cero.'; END IF;
  IF coalesce(btrim(p_nota), '') = '' THEN RAISE EXCEPTION 'Escribe la explicación: ningún faltante queda sin justificar.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM inventario.insumos WHERE id = p_insumo) THEN RAISE EXCEPTION 'Ese elemento no existe.'; END IF;

  IF p_motivo IN ('dotacion','a_cargo') THEN
    IF p_trabajador IS NULL THEN RAISE EXCEPTION 'Elige el trabajador que lo tiene.'; END IF;
    INSERT INTO inventario.movimientos (tipo, insumo_id, cantidad, origen_id, destino_id, estado, fecha, documento, notas,
                                        creado_por, motivo, trabajador_id, recibido_por, recibido_at)
    VALUES ('traslado', p_insumo, p_cantidad, s.bodega_id, inventario.bodega_trabajador(p_trabajador), 'confirmado',
            coalesce(p_fecha, CURRENT_DATE), 'Justificación al cerrar', btrim(p_nota), p_usuario, p_motivo, p_trabajador,
            p_usuario, NOW())
    RETURNING id INTO v_id;
  ELSIF p_motivo = 'sobrante' THEN
    INSERT INTO inventario.movimientos (tipo, insumo_id, cantidad, destino_id, estado, fecha, documento, notas, creado_por, motivo)
    VALUES ('ajuste', p_insumo, p_cantidad, s.bodega_id, 'confirmado', coalesce(p_fecha, CURRENT_DATE),
            'Justificación al cerrar', btrim(p_nota), p_usuario, 'sobrante')
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO inventario.movimientos (tipo, insumo_id, cantidad, origen_id, estado, fecha, documento, notas, creado_por, motivo)
    VALUES ('ajuste', p_insumo, p_cantidad, s.bodega_id, 'confirmado', coalesce(p_fecha, CURRENT_DATE),
            'Justificación al cerrar', btrim(p_nota), p_usuario, p_motivo)
    RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

-- Cierra la salida si no queda nada sin explicar: saldo en cero en todos los
-- elementos y ninguna devolución por recibir. Devuelve cuántas actas siguen sin firma.
CREATE OR REPLACE FUNCTION inventario.cerrar_salida(p_id uuid, p_usuario text, p_fecha date)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = inventario, public, pg_temp
AS $$
DECLARE
  s         inventario.salidas;
  v_pend    int;
  v_camino  int;
  v_sinfirma int;
BEGIN
  SELECT * INTO s FROM inventario.salidas WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esa salida no existe.'; END IF;
  IF s.estado <> 'abierta' THEN RAISE EXCEPTION 'La salida «%» ya está cerrada.', s.nombre; END IF;

  SELECT count(*) INTO v_pend FROM inventario.v_existencias WHERE bodega_id = s.bodega_id AND abs(saldo) > 0.0001;
  SELECT count(*) INTO v_camino FROM inventario.movimientos
   WHERE origen_id = s.bodega_id AND estado = 'en_transito';
  IF v_pend > 0 THEN
    RAISE EXCEPTION 'No se puede cerrar: % elemento(s) tienen diferencia sin explicar.', v_pend;
  END IF;
  IF v_camino > 0 THEN
    RAISE EXCEPTION 'No se puede cerrar: % devolución(es) todavía no se reciben contando.', v_camino;
  END IF;

  UPDATE inventario.salidas
     SET estado = 'cerrada', fecha_cierre = coalesce(p_fecha, CURRENT_DATE), cerrado_por = p_usuario
   WHERE id = p_id;
  UPDATE inventario.bodegas SET activo = false WHERE id = s.bodega_id;
  UPDATE inventario.titulos_campo SET bodega_ids = array_remove(bodega_ids, s.bodega_id) WHERE s.bodega_id = ANY (bodega_ids);

  SELECT count(*) INTO v_sinfirma FROM inventario.actas WHERE salida_id = p_id AND NOT firmada;
  RETURN jsonb_build_object('ok', true, 'actas_sin_firma', v_sinfirma);
END $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 7 — La hoja de conciliación, calculada
-- ════════════════════════════════════════════════════════════

-- Una fila por salida y elemento. Sigue las columnas de la hoja de Administrativa:
--   entregado inicial · adicional · total a cargo · consumido · devuelto · diferencia.
--   (diferencia = saldo de la bodega de la salida: lo que sigue sin explicar)
DROP VIEW IF EXISTS inventario.v_conciliacion_salida;
CREATE VIEW inventario.v_conciliacion_salida AS
WITH base AS (
  SELECT s.id AS salida_id, s.bodega_id, m.insumo_id,
    SUM(CASE WHEN m.destino_id = s.bodega_id AND m.estado = 'confirmado' AND a.tipo = 'entrega' THEN m.cantidad ELSE 0 END) AS inicial,
    SUM(CASE WHEN m.destino_id = s.bodega_id AND m.estado = 'confirmado' AND m.tipo IN ('traslado','entrada')
              AND (a.tipo IS NULL OR a.tipo = 'adicional') THEN m.cantidad ELSE 0 END) AS adicional,
    SUM(CASE WHEN m.origen_id = s.bodega_id AND m.estado = 'confirmado' AND m.tipo = 'consumo' THEN m.cantidad ELSE 0 END) AS consumido_app,
    SUM(CASE WHEN m.origen_id = s.bodega_id AND m.estado = 'confirmado' AND m.tipo = 'traslado' AND m.motivo IS NULL THEN m.cantidad ELSE 0 END) AS devuelto,
    SUM(CASE WHEN m.origen_id = s.bodega_id AND m.estado = 'en_transito' AND m.tipo = 'traslado' THEN m.cantidad ELSE 0 END) AS por_recibir,
    SUM(CASE WHEN m.origen_id = s.bodega_id AND m.estado = 'confirmado' AND m.motivo = 'a_cargo' THEN m.cantidad ELSE 0 END) AS a_cargo,
    SUM(CASE WHEN m.origen_id = s.bodega_id AND m.estado = 'confirmado' AND m.motivo = 'dotacion' THEN m.cantidad ELSE 0 END) AS dotacion,
    SUM(CASE WHEN m.origen_id = s.bodega_id AND m.estado = 'confirmado' AND m.tipo = 'ajuste'
              AND m.motivo IN ('consumido','instalado','danado','perdido','conteo') THEN m.cantidad ELSE 0 END) AS justificado,
    SUM(CASE WHEN m.destino_id = s.bodega_id AND m.estado = 'confirmado' AND m.motivo = 'sobrante' THEN m.cantidad ELSE 0 END) AS sobrante
  FROM inventario.salidas s
  JOIN inventario.movimientos m ON (m.origen_id = s.bodega_id OR m.destino_id = s.bodega_id)
  LEFT JOIN inventario.actas a ON a.id = m.acta_id
  GROUP BY s.id, s.bodega_id, m.insumo_id
)
SELECT b.salida_id, b.insumo_id, i.nombre, i.unidad, i.clase, i.categoria,
       b.inicial, b.adicional, b.inicial + b.adicional AS total,
       b.consumido_app, b.devuelto, b.por_recibir, b.a_cargo, b.dotacion, b.justificado, b.sobrante,
       coalesce(e.saldo, 0) AS saldo,
       CASE
         WHEN coalesce(e.saldo, 0) < -0.0001                                   THEN 'devuelto_de_mas'
         WHEN b.por_recibir > 0                                                THEN 'pendiente_conteo'
         WHEN coalesce(e.saldo, 0) > 0.0001 AND i.clase IN ('herramienta','epp') THEN 'sin_devolucion'
         WHEN coalesce(e.saldo, 0) > 0.0001                                    THEN 'falta_justificar'
         WHEN b.inicial + b.adicional = 0 AND b.devuelto > 0                   THEN 'devuelto_sin_entrega'
         WHEN b.a_cargo > 0                                                    THEN 'a_cargo'
         WHEN b.devuelto = b.inicial + b.adicional AND b.inicial + b.adicional > 0 AND i.clase = 'consumible' THEN 'sin_uso'
         WHEN i.clase = 'consumible' AND b.consumido_app + b.justificado + b.dotacion > 0 THEN 'consumido'
         ELSE 'cuadra'
       END AS estado
  FROM base b
  JOIN inventario.insumos i ON i.id = b.insumo_id
  LEFT JOIN inventario.v_existencias e ON e.bodega_id = b.bodega_id AND e.insumo_id = b.insumo_id;

COMMENT ON VIEW inventario.v_conciliacion_salida IS
  'La hoja de conciliación por salida y elemento. diferencia = saldo = lo que sigue sin explicar. estado: cuadra, consumido, sin_uso, sin_devolucion, falta_justificar, a_cargo, pendiente_conteo, devuelto_de_mas, devuelto_sin_entrega.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 8 — App de campo: campo_datos con la clase de cada insumo
--   Es la definición de migration_financiero_inventario.sql con tres cambios
--   que solo AGREGAN o ESCONDEN: 'clase' en cada insumo, y las bodegas «a cargo
--   de» (nombres de trabajadores) no salen hacia los celulares.
-- ════════════════════════════════════════════════════════════

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
                  FROM inventario.bodegas b WHERE b.activo AND b.tipo <> 'persona'),

    'insumos', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'id', i.id, 'nombre', i.nombre, 'unidad', i.unidad, 'presentacion', i.presentacion,
                  'categoria', i.categoria, 'clase', i.clase, 'costo_promedio', c.costo_promedio) ORDER BY i.nombre), '[]'::jsonb)
                  FROM inventario.insumos i
                  LEFT JOIN inventario.v_costo_insumo c ON c.insumo_id = i.id
                 WHERE i.activo),

    'existencias', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                      'bodega_id', e.bodega_id, 'insumo_id', e.insumo_id, 'entradas', e.entradas,
                      'salidas', e.salidas, 'saldo', e.saldo, 'por_recibir', e.por_recibir)), '[]'::jsonb)
                      FROM inventario.v_existencias e
                     WHERE (cardinality(mis) = 0 OR e.bodega_id = ANY (mis))
                       AND NOT EXISTS (SELECT 1 FROM inventario.bodegas bp WHERE bp.id = e.bodega_id AND bp.tipo = 'persona')),

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
                         AND NOT EXISTS (SELECT 1 FROM inventario.bodegas bp
                                          WHERE bp.tipo = 'persona' AND bp.id IN (m.origen_id, m.destino_id))
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


-- ════════════════════════════════════════════════════════════
-- BLOQUE 9 — RLS y permisos
-- ════════════════════════════════════════════════════════════

ALTER TABLE people.trabajadores_campo ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario.salidas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario.actas          ENABLE ROW LEVEL SECURITY;

GRANT ALL ON people.trabajadores_campo TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA inventario TO service_role;
REVOKE ALL ON people.trabajadores_campo FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA inventario FROM anon, authenticated;

-- Las funciones nuevas nacen con EXECUTE para PUBLIC: se le quita y queda solo
-- service_role. (Los campo_* que anon ya tiene concedidos no se tocan.)
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA inventario FROM PUBLIC;
GRANT  EXECUTE ON ALL FUNCTIONS IN SCHEMA inventario TO service_role;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 10 — Recargar PostgREST
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr
-- ============================================================
--  select nombre, tipo from inventario.bodegas order by tipo, nombre;   -- + Florencia y Escuela Bosque (sede)
--  select column_name from information_schema.columns
--   where table_schema='inventario' and table_name='insumos' and column_name='clase';
--  select count(*) from people.trabajadores_campo;                       -- 0
--  select id, public from storage.buckets where id = 'inventario-actas'; -- public = false
--  select inventario.campo_titulos();                                    -- la app sigue entrando
--  Con la key anon, por REST, NO se debe poder leer: salidas, actas, trabajadores_campo,
--  ni llamar crear_salida / registrar_acta / justificar / cerrar_salida.
-- ============================================================
