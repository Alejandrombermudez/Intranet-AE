-- =============================================================
-- Monitoreo fenológico de árboles semilleros (Solano) — la app de campo
-- guarda en la base.
-- Schema: ras (Conservación)
-- Requiere: migration_financiero_inventario.sql (inventario.titulos_campo y
--           sesiones_campo) y migration_ras_arboles.sql (ras.arboles_semilleros).
--
-- Qué hace
--   1. Un título de campo nuevo con rol 'semilleros' (SEMILLEROS). Se entra a
--      la app con título + clave, igual que la app de actividades. La clave se
--      pone desde la intranet (Administrativa → App de campo).
--   2. Tres tablas: monitoreos, puntos GPS y fotos. Solo service_role las toca;
--      la app de campo (key anon) habla únicamente por las funciones
--      ras.semilleros_*, que exigen el token de una sesión SEMILLEROS.
--   3. Una vista para leer los monitoreos vigentes con su árbol y su punto.
--
-- Decisiones
--   * Los árboles de Solano NO están en ras.arboles_semilleros (hoy solo
--     Orotuyo, Piedemonte y Yaguara) y esa tabla tiene `codigo` único global,
--     así que no hay FK. El monitoreo guarda (nucleo, codigo); la vista cruza
--     por ahí cuando el árbol exista.
--   * Una sola dirección: el celular empuja, la base recibe. Mismo id (uuid del
--     celular) = mismo registro: reenviar no duplica; gana el actualizado_en
--     más reciente; borrar marca `eliminado`, no destruye.
--   * Las fotos viajan aparte (una por llamada) y no se pisan una vez subidas.
--
-- Escrita como si no hubiera transacción (el editor de Supabase no la respeta):
-- cada sentencia se puede correr de nuevo sin daño.
-- =============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — El rol 'semilleros' para los títulos de campo
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'inventario.titulos_campo'::regclass AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%rol%'
  LOOP
    EXECUTE format('ALTER TABLE inventario.titulos_campo DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE inventario.titulos_campo
    ADD CONSTRAINT titulos_campo_rol_check
    CHECK (rol IN ('bodega', 'siembra', 'monitoreo', 'semilleros'));
END $$;

COMMENT ON TABLE inventario.titulos_campo IS
  'Con qué se entra a las apps de campo. Roles: bodega, siembra y monitoreo (app de actividades); semilleros (app de monitoreo fenológico, ras.semilleros_*). La clave se pone desde la intranet (inventario.fijar_clave_titulo) y solo se guarda su huella bcrypt.';

-- El título nace SIN clave: hay que ponérsela desde la intranet antes de entrar.
INSERT INTO inventario.titulos_campo (nombre, rol, bodega_ids)
SELECT 'SEMILLEROS', 'semilleros', '{}'
WHERE NOT EXISTS (SELECT 1 FROM inventario.titulos_campo WHERE nombre = 'SEMILLEROS');


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — La app de actividades no debe aceptar títulos de semilleros
--   (misma firma que antes: solo se añade la exclusión)
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION inventario.campo_titulos()
RETURNS TABLE (nombre text, rol text, tiene_clave boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = inventario, pg_temp
AS $$
  SELECT nombre, rol, clave_hash IS NOT NULL
    FROM inventario.titulos_campo WHERE activo AND rol <> 'semilleros' ORDER BY nombre;
$$;

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
   WHERE s.token = p_token AND s.expira > NOW() AND tc.activo AND tc.rol <> 'semilleros';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESION_VENCIDA' USING HINT = 'Vuelve a entrar con tu título y clave.';
  END IF;
  UPDATE inventario.sesiones_campo SET ultimo_uso = NOW() WHERE token = p_token;
  RETURN t;
END $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — Tablas
-- ════════════════════════════════════════════════════════════

-- Un registro por árbol y visita. El id lo genera el celular.
CREATE TABLE IF NOT EXISTS ras.monitoreos_semilleros (
  id                   uuid PRIMARY KEY,
  nucleo               text        NOT NULL DEFAULT 'Solano',
  codigo               text        NOT NULL CHECK (btrim(codigo) <> ''),   -- código de la placa
  predio               text        NOT NULL,
  fecha                date        NOT NULL,
  -- La ronda es el mes de trabajo, no el mes de la fecha: la de abril de 2026
  -- se cerró el 1 y 2 de mayo. Todo lo que cuenta por mes usa la ronda.
  ronda                text        NOT NULL CHECK (ronda ~ '^\d{4}-\d{2}$'),
  nombre_comun         text,
  nombre_cientifico    text,
  familia              text,
  en_base              boolean     NOT NULL DEFAULT true,   -- false = árbol que la app no tenía en su lista
  clima                text,
  -- Nueve fenofases, % de la copa. NULL = no se observó (distinto de 0).
  hoja                 smallint CHECK (hoja             IN (0,25,50,75,100)),
  boton_floral         smallint CHECK (boton_floral     IN (0,25,50,75,100)),
  floracion            smallint CHECK (floracion        IN (0,25,50,75,100)),
  aborto_floral        smallint CHECK (aborto_floral    IN (0,25,50,75,100)),
  fruto_inmaduro       smallint CHECK (fruto_inmaduro   IN (0,25,50,75,100)),
  fruto_maduro         smallint CHECK (fruto_maduro     IN (0,25,50,75,100)),
  fruto_postmaduro     smallint CHECK (fruto_postmaduro IN (0,25,50,75,100)),
  aborto_frutal        smallint CHECK (aborto_frutal    IN (0,25,50,75,100)),
  plantulas            smallint CHECK (plantulas        IN (0,25,50,75,100)),
  estado_fitosanitario text[]      NOT NULL DEFAULT '{}',
  cambio_placa         boolean     NOT NULL DEFAULT false,
  placa_anterior       text,
  observaciones        text,
  vio_animal           boolean,                              -- NULL = registro de antes de la pregunta
  animales             jsonb       NOT NULL DEFAULT '[]',    -- [{tipo, nombre, conducta, conductaOtra}]
  sin_foto             jsonb       NOT NULL DEFAULT '[]',    -- [{organo, motivo}] cuando tocaba foto y no se pudo
  monitor              text,                                 -- quien registró (lista de la app)
  titulo               text,                                 -- título de campo con que se sincronizó
  dispositivo_id       text,
  creado_en            timestamptz NOT NULL,                 -- reloj del celular
  actualizado_en       timestamptz NOT NULL,                 -- reloj del celular: decide conflictos
  eliminado            boolean     NOT NULL DEFAULT false,
  origen               text        NOT NULL DEFAULT 'app' CHECK (origen IN ('app', 'kobo')),
  created_at           timestamptz NOT NULL DEFAULT now(),   -- reloj del servidor
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_monit_sem_arbol   ON ras.monitoreos_semilleros (nucleo, codigo, ronda);
CREATE INDEX IF NOT EXISTS idx_monit_sem_predio  ON ras.monitoreos_semilleros (predio, ronda);
COMMENT ON TABLE ras.monitoreos_semilleros IS
  'Monitoreo fenológico por árbol y visita, tal como lo registra la app de campo de semilleros (insumos_aves/semilleros). Sin FK a ras.arboles_semilleros: los árboles de Solano aún no están ahí; la vista v_monitoreos_semilleros cruza por (nucleo, codigo).';

-- La capa de puntos: un punto por monitoreo (volver a tomarlo lo reemplaza).
CREATE TABLE IF NOT EXISTS ras.puntos_monitoreo_semilleros (
  id              uuid PRIMARY KEY,
  monitoreo_id    uuid        NOT NULL UNIQUE REFERENCES ras.monitoreos_semilleros(id) ON DELETE CASCADE,
  latitud         numeric     NOT NULL CHECK (latitud  BETWEEN -90  AND 90),
  longitud        numeric     NOT NULL CHECK (longitud BETWEEN -180 AND 180),
  precision_m     numeric,        -- incertidumbre del fix: bajo dosel ±40 m es normal; sirve para filtrar
  altitud_m       numeric,
  precision_alt_m numeric,
  fuente          text        NOT NULL DEFAULT 'gps' CHECK (fuente IN ('gps', 'manual')),
  capturado_en    timestamptz,
  actualizado_en  timestamptz NOT NULL,
  dispositivo_id  text,
  eliminado       boolean     NOT NULL DEFAULT false,
  geom            geometry(Point, 4326)
                  GENERATED ALWAYS AS (st_setsrid(st_makepoint(longitud::float8, latitud::float8), 4326)) STORED,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_puntos_monit_sem_geom ON ras.puntos_monitoreo_semilleros USING gist (geom);

-- Las fotos de flor o fruto maduro (se piden con 50 % o más). Una vez subida,
-- una foto no cambia: se identifica por su id y reenviarla no hace nada.
CREATE TABLE IF NOT EXISTS ras.fotos_monitoreo_semilleros (
  id           uuid PRIMARY KEY,
  monitoreo_id uuid        NOT NULL REFERENCES ras.monitoreos_semilleros(id) ON DELETE CASCADE,
  organo       text        NOT NULL CHECK (organo IN ('flor', 'fruto')),
  mime         text        NOT NULL DEFAULT 'image/jpeg',
  ancho        integer,
  alto         integer,
  bytes        integer,
  nitidez      numeric,
  borrosa      boolean     NOT NULL DEFAULT false,   -- la app la midió borrosa
  aceptada     boolean     NOT NULL DEFAULT false,   -- ...y quien la tomó la dio por buena
  tomada_en    timestamptz,
  contenido    bytea       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fotos_monit_sem ON ras.fotos_monitoreo_semilleros (monitoreo_id);
COMMENT ON TABLE ras.fotos_monitoreo_semilleros IS
  'Fotos de flor y fruto maduro tomadas en el monitoreo, a 2048 px (JPEG). Para leerlas sin traer el contenido, seleccionar todas las columnas menos `contenido`.';

-- Vigentes, con su árbol (si ya está en la red) y su punto.
CREATE OR REPLACE VIEW ras.v_monitoreos_semilleros AS
SELECT m.*,
       a.id AS arbol_id,
       a.especie_id,
       p.latitud, p.longitud, p.precision_m, p.geom,
       (SELECT count(*) FROM ras.fotos_monitoreo_semilleros f WHERE f.monitoreo_id = m.id) AS n_fotos
  FROM ras.monitoreos_semilleros m
  LEFT JOIN ras.arboles_semilleros a ON a.nucleo = m.nucleo AND a.codigo = m.codigo
  LEFT JOIN ras.puntos_monitoreo_semilleros p ON p.monitoreo_id = m.id AND NOT p.eliminado
 WHERE NOT m.eliminado;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — Funciones de la app de campo (anon con token)
--   SECURITY DEFINER: corren con los permisos del dueño de las tablas, así que
--   la key anon no necesita (ni tiene) acceso a ninguna tabla. Cada una valida
--   el token antes de hacer nada.
-- ════════════════════════════════════════════════════════════

-- Interna: el título detrás de un token vigente de rol 'semilleros', o error.
CREATE OR REPLACE FUNCTION ras._sesion_semilleros(p_token uuid)
RETURNS inventario.titulos_campo
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = inventario, pg_temp
AS $$
DECLARE t inventario.titulos_campo;
BEGIN
  SELECT tc.* INTO t
    FROM inventario.sesiones_campo s
    JOIN inventario.titulos_campo tc ON tc.id = s.titulo_id
   WHERE s.token = p_token AND s.expira > NOW() AND tc.activo AND tc.rol = 'semilleros';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SESION_VENCIDA' USING HINT = 'Vuelve a entrar con tu título y clave.';
  END IF;
  UPDATE inventario.sesiones_campo SET ultimo_uso = NOW() WHERE token = p_token;
  RETURN t;
END $$;

-- Interna: una fenofase válida (0, 25, 50, 75, 100) o NULL.
CREATE OR REPLACE FUNCTION ras._fase_semilleros(p jsonb, k text)
RETURNS smallint
LANGUAGE sql IMMUTABLE
AS $$ SELECT CASE WHEN (p ->> k) IN ('0','25','50','75','100') THEN (p ->> k)::smallint END $$;

-- Lista para la pantalla de entrada: solo nombres.
CREATE OR REPLACE FUNCTION ras.semilleros_titulos()
RETURNS TABLE (nombre text, tiene_clave boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = inventario, pg_temp
AS $$
  SELECT nombre, clave_hash IS NOT NULL
    FROM inventario.titulos_campo WHERE activo AND rol = 'semilleros' ORDER BY nombre;
$$;

-- Entrar: devuelve {ok, token, titulo, rol, expira} o {ok:false, error}. La clave
-- y el bloqueo por intentos los maneja inventario.campo_ingresar; aquí solo se
-- exige que el título sea de semilleros.
CREATE OR REPLACE FUNCTION ras.semilleros_ingresar(p_titulo text, p_clave text, p_dispositivo text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = inventario, public, extensions, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM inventario.titulos_campo
                  WHERE nombre = upper(btrim(coalesce(p_titulo, ''))) AND activo AND rol = 'semilleros') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ese título no existe o todavía no tiene clave. Pídela en la oficina.');
  END IF;
  RETURN inventario.campo_ingresar(p_titulo, p_clave, p_dispositivo);
END $$;

-- Guardar (crear o actualizar) un monitoreo, con su punto GPS anidado.
--   p_reg = {id, codigo, predio, fecha, ronda, nombre_comun, nombre_cientifico, familia, en_base,
--            clima, hoja, boton_floral, floracion, aborto_floral, fruto_inmaduro, fruto_maduro,
--            fruto_postmaduro, aborto_frutal, plantulas, estado_fitosanitario[], cambio_placa,
--            placa_anterior, observaciones, vio_animal, animales[], sin_foto[], monitor,
--            dispositivo_id, creado_en, actualizado_en, eliminado,
--            punto: {id, latitud, longitud, precision_m, altitud_m, precision_alt_m, fuente,
--                    capturado_en, actualizado_en, dispositivo_id, eliminado} | null}
-- Idempotente: el mismo id enviado dos veces da el mismo resultado; solo cambia lo ya
-- guardado si lo que llega es más reciente (actualizado_en). El punto se evalúa aparte:
-- uno tomado después sube aunque el monitoreo no haya cambiado.
CREATE OR REPLACE FUNCTION ras.semilleros_guardar(p_token uuid, p_reg jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ras, public, pg_temp
AS $$
DECLARE
  t   inventario.titulos_campo;
  v   ras.monitoreos_semilleros;
  p   ras.puntos_monitoreo_semilleros;
  n   int;
  v_punto jsonb := p_reg -> 'punto';
BEGIN
  t := ras._sesion_semilleros(p_token);
  v := jsonb_populate_record(NULL::ras.monitoreos_semilleros, p_reg);
  IF v.id IS NULL THEN RAISE EXCEPTION 'El monitoreo llegó sin identificador.'; END IF;
  IF coalesce(btrim(v.codigo), '') = '' THEN RAISE EXCEPTION 'El monitoreo llegó sin código de árbol.'; END IF;
  IF coalesce(btrim(v.predio), '') = '' OR v.fecha IS NULL OR v.ronda IS NULL THEN
    RAISE EXCEPTION 'El monitoreo llegó sin predio, fecha o ronda.';
  END IF;
  IF v.actualizado_en IS NULL THEN RAISE EXCEPTION 'El monitoreo llegó sin fecha de actualización.'; END IF;

  INSERT INTO ras.monitoreos_semilleros AS m (
    id, nucleo, codigo, predio, fecha, ronda, nombre_comun, nombre_cientifico, familia, en_base, clima,
    hoja, boton_floral, floracion, aborto_floral, fruto_inmaduro, fruto_maduro, fruto_postmaduro,
    aborto_frutal, plantulas, estado_fitosanitario, cambio_placa, placa_anterior, observaciones,
    vio_animal, animales, sin_foto, monitor, titulo, dispositivo_id, creado_en, actualizado_en, eliminado)
  VALUES (
    v.id, 'Solano', btrim(v.codigo), v.predio, v.fecha, v.ronda, v.nombre_comun, v.nombre_cientifico, v.familia,
    coalesce(v.en_base, true), nullif(v.clima, ''),
    ras._fase_semilleros(p_reg, 'hoja'), ras._fase_semilleros(p_reg, 'boton_floral'),
    ras._fase_semilleros(p_reg, 'floracion'), ras._fase_semilleros(p_reg, 'aborto_floral'),
    ras._fase_semilleros(p_reg, 'fruto_inmaduro'), ras._fase_semilleros(p_reg, 'fruto_maduro'),
    ras._fase_semilleros(p_reg, 'fruto_postmaduro'), ras._fase_semilleros(p_reg, 'aborto_frutal'),
    ras._fase_semilleros(p_reg, 'plantulas'),
    coalesce(v.estado_fitosanitario, '{}'), coalesce(v.cambio_placa, false), nullif(v.placa_anterior, ''),
    nullif(v.observaciones, ''), v.vio_animal, coalesce(v.animales, '[]'), coalesce(v.sin_foto, '[]'),
    nullif(v.monitor, ''), t.nombre, v.dispositivo_id, coalesce(v.creado_en, v.actualizado_en),
    v.actualizado_en, coalesce(v.eliminado, false))
  ON CONFLICT (id) DO UPDATE SET
    codigo = EXCLUDED.codigo, predio = EXCLUDED.predio, fecha = EXCLUDED.fecha, ronda = EXCLUDED.ronda,
    nombre_comun = EXCLUDED.nombre_comun, nombre_cientifico = EXCLUDED.nombre_cientifico, familia = EXCLUDED.familia,
    en_base = EXCLUDED.en_base, clima = EXCLUDED.clima,
    hoja = EXCLUDED.hoja, boton_floral = EXCLUDED.boton_floral, floracion = EXCLUDED.floracion,
    aborto_floral = EXCLUDED.aborto_floral, fruto_inmaduro = EXCLUDED.fruto_inmaduro,
    fruto_maduro = EXCLUDED.fruto_maduro, fruto_postmaduro = EXCLUDED.fruto_postmaduro,
    aborto_frutal = EXCLUDED.aborto_frutal, plantulas = EXCLUDED.plantulas,
    estado_fitosanitario = EXCLUDED.estado_fitosanitario, cambio_placa = EXCLUDED.cambio_placa,
    placa_anterior = EXCLUDED.placa_anterior, observaciones = EXCLUDED.observaciones,
    vio_animal = EXCLUDED.vio_animal, animales = EXCLUDED.animales, sin_foto = EXCLUDED.sin_foto,
    monitor = EXCLUDED.monitor, titulo = EXCLUDED.titulo, dispositivo_id = EXCLUDED.dispositivo_id,
    actualizado_en = EXCLUDED.actualizado_en, eliminado = EXCLUDED.eliminado, updated_at = now()
  WHERE m.actualizado_en < EXCLUDED.actualizado_en;
  GET DIAGNOSTICS n = ROW_COUNT;

  IF v_punto IS NOT NULL AND jsonb_typeof(v_punto) = 'object' AND v_punto ? 'latitud' AND v_punto ? 'longitud' THEN
    p := jsonb_populate_record(NULL::ras.puntos_monitoreo_semilleros, v_punto);
    IF p.id IS NOT NULL AND p.latitud IS NOT NULL AND p.longitud IS NOT NULL THEN
      INSERT INTO ras.puntos_monitoreo_semilleros AS q (
        id, monitoreo_id, latitud, longitud, precision_m, altitud_m, precision_alt_m, fuente,
        capturado_en, actualizado_en, dispositivo_id, eliminado)
      VALUES (
        p.id, v.id, p.latitud, p.longitud, p.precision_m, p.altitud_m, p.precision_alt_m,
        CASE WHEN p.fuente = 'manual' THEN 'manual' ELSE 'gps' END,
        p.capturado_en, coalesce(p.actualizado_en, v.actualizado_en), p.dispositivo_id, coalesce(p.eliminado, false))
      ON CONFLICT (monitoreo_id) DO UPDATE SET
        id = EXCLUDED.id, latitud = EXCLUDED.latitud, longitud = EXCLUDED.longitud,
        precision_m = EXCLUDED.precision_m, altitud_m = EXCLUDED.altitud_m,
        precision_alt_m = EXCLUDED.precision_alt_m, fuente = EXCLUDED.fuente,
        capturado_en = EXCLUDED.capturado_en, actualizado_en = EXCLUDED.actualizado_en,
        dispositivo_id = EXCLUDED.dispositivo_id, eliminado = EXCLUDED.eliminado
      WHERE q.actualizado_en < EXCLUDED.actualizado_en;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v.id, 'aplicado', n > 0);
END $$;

-- Guardar una foto (una por llamada, para no hacer un envío enorme con mala señal).
--   p_foto = {id, monitoreo_id, organo, mime, ancho, alto, bytes, nitidez, borrosa, aceptada,
--             tomada_en, data (JPEG en base64)}
-- El monitoreo tiene que haber llegado antes. Una foto ya subida no se pisa.
CREATE OR REPLACE FUNCTION ras.semilleros_guardar_foto(p_token uuid, p_foto jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ras, public, pg_temp
AS $$
DECLARE
  t       inventario.titulos_campo;
  v_id    uuid := (p_foto ->> 'id')::uuid;
  v_mon   uuid := (p_foto ->> 'monitoreo_id')::uuid;
  v_datos bytea;
BEGIN
  t := ras._sesion_semilleros(p_token);
  IF v_id IS NULL OR v_mon IS NULL THEN RAISE EXCEPTION 'La foto llegó sin identificador.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ras.monitoreos_semilleros WHERE id = v_mon) THEN
    RAISE EXCEPTION 'La foto llegó antes que su monitoreo.';
  END IF;
  IF coalesce(p_foto ->> 'data', '') = '' THEN RAISE EXCEPTION 'La foto llegó vacía.'; END IF;
  v_datos := decode(p_foto ->> 'data', 'base64');
  IF octet_length(v_datos) < 1000 THEN RAISE EXCEPTION 'La foto llegó incompleta.'; END IF;

  INSERT INTO ras.fotos_monitoreo_semilleros (id, monitoreo_id, organo, mime, ancho, alto, bytes, nitidez,
                                              borrosa, aceptada, tomada_en, contenido)
  VALUES (v_id, v_mon, p_foto ->> 'organo', coalesce(nullif(p_foto ->> 'mime', ''), 'image/jpeg'),
          nullif(p_foto ->> 'ancho', '')::int, nullif(p_foto ->> 'alto', '')::int, octet_length(v_datos),
          nullif(p_foto ->> 'nitidez', '')::numeric, coalesce((p_foto ->> 'borrosa')::boolean, false),
          coalesce((p_foto ->> 'aceptada')::boolean, false), nullif(p_foto ->> 'tomada_en', '')::timestamptz,
          v_datos)
  ON CONFLICT (id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END $$;

-- Cuánto hay en la base, para que la app diga «al día» con un número que se pueda comprobar.
CREATE OR REPLACE FUNCTION ras.semilleros_estado(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ras, public, pg_temp
AS $$
DECLARE t inventario.titulos_campo;
BEGIN
  t := ras._sesion_semilleros(p_token);
  RETURN jsonb_build_object(
    'ok', true,
    'servidor_ahora', now(),
    'titulo', t.nombre,
    'monitoreos', (SELECT count(*) FROM ras.monitoreos_semilleros WHERE NOT eliminado),
    'fotos',      (SELECT count(*) FROM ras.fotos_monitoreo_semilleros f
                    JOIN ras.monitoreos_semilleros m ON m.id = f.monitoreo_id WHERE NOT m.eliminado));
END $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — RLS y permisos
-- ════════════════════════════════════════════════════════════

ALTER TABLE ras.monitoreos_semilleros        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ras.puntos_monitoreo_semilleros  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ras.fotos_monitoreo_semilleros   ENABLE ROW LEVEL SECURITY;

-- Sin políticas y sin GRANT para anon/authenticated: las tablas solo las toca
-- service_role (la intranet) y las funciones de arriba.
GRANT USAGE ON SCHEMA ras TO anon, authenticated, service_role;
REVOKE ALL ON ras.monitoreos_semilleros, ras.puntos_monitoreo_semilleros,
              ras.fotos_monitoreo_semilleros, ras.v_monitoreos_semilleros FROM anon, authenticated;
GRANT ALL ON ras.monitoreos_semilleros, ras.puntos_monitoreo_semilleros,
             ras.fotos_monitoreo_semilleros, ras.v_monitoreos_semilleros TO service_role;

-- Postgres le regala EXECUTE a PUBLIC en toda función nueva: se le quita y se da a quien corresponde.
REVOKE EXECUTE ON FUNCTION ras._sesion_semilleros(uuid)                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ras._fase_semilleros(jsonb, text)                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ras.semilleros_titulos()                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ras.semilleros_ingresar(text, text, text)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ras.semilleros_guardar(uuid, jsonb)               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ras.semilleros_guardar_foto(uuid, jsonb)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ras.semilleros_estado(uuid)                       FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION ras._sesion_semilleros(uuid)                      TO service_role;
GRANT  EXECUTE ON FUNCTION ras._fase_semilleros(jsonb, text)                 TO service_role;

-- La app de campo de semilleros (key anon): solo estas cinco.
GRANT EXECUTE ON FUNCTION ras.semilleros_titulos()                           TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ras.semilleros_ingresar(text, text, text)          TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ras.semilleros_guardar(uuid, jsonb)                TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ras.semilleros_guardar_foto(uuid, jsonb)           TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ras.semilleros_estado(uuid)                        TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr (solo lectura, por REST)
-- ============================================================
--  select nombre, rol, clave_hash is null as sin_clave from inventario.titulos_campo;
--      -- BODEGA / SIEMBRA / MONITOREO como estaban, y SEMILLEROS sin clave
--  select ras.semilleros_titulos();                    -- [{"nombre":"SEMILLEROS","tiene_clave":false}]
--  select inventario.campo_titulos();                  -- los tres de antes, sin SEMILLEROS
--  Con la key anon, por REST, NO se debe poder leer ninguna tabla:
--      GET /rest/v1/monitoreos_semilleros  (Accept-Profile: ras)  → 401/42501
--  y SÍ responder la función de entrada:
--      POST /rest/v1/rpc/semilleros_titulos  (Content-Profile: ras) → 200
--  Después: Intranet → Administrativa → App de campo → ponerle clave al título SEMILLEROS.
-- ============================================================
