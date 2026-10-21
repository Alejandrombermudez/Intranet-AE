-- ============================================================
--  ALERTAS DE JURÍDICA — datos del predio por revisar (2026-10-21)
--  Archivo: docs/sql/migration_alertas_juridica.sql
--
--  CÓMO CORRERLA
--    Supabase → SQL Editor → pegar el archivo completo → Run.
--    Se puede volver a correr sin romper nada. Solo esquema, sin datos.
--
--  QUÉ ES
--    Una lista de trabajo para jurídica: cosas de un predio que no cuadran y
--    que alguien tiene que mirar —el SIG llama distinto a la finca, el
--    municipio está «Por definir», la vereda dice el nombre del municipio, una
--    finca que el SIG tiene y jurídica no ha registrado, un posible duplicado—.
--    Pedida por el usuario el 2026-10-21, después del cruce del shapefile de
--    Elegibilidad LDH con jurídica. Pantalla: /intranet/juridica/alertas.
--
--  DE DÓNDE SALEN LAS ALERTAS
--    · 'regla'  — las detecta la intranet sola cada vez que se abre la
--      pantalla (lib/alertas-juridica.ts) y las cierra sola cuando la ficha se
--      corrige.
--    · 'elegibilidad_ldh' (u otro origen) — se cargan con un SQL aparte. Las del
--      cruce LDH van FUERA del repo porque llevan nombres de propietarios:
--      trabajo_elegibilidad_ldh/sql/03_alertas_juridica_ldh.sql.
--    `clave` hace que cargar dos veces no duplique, y que una regla y una carga
--    sobre el mismo problema sean UNA alerta ('municipio:<predio_id>').
--
--  NADA SE BORRA
--    Una alerta se resuelve o se descarta, con nota y con quién; queda para
--    consultar. Si el predio se borra, sus alertas se van con él.
--
--  PERMISOS
--    Solo service_role: se lee y se escribe por /api/juridica/alertas, que exige
--    sesión de jurídica (lib/auth-api.ts). El schema juridica da por defecto
--    SELECT/INSERT/UPDATE/DELETE a authenticated (migration_modulo_juridico.sql):
--    aquí se le quita a propósito.
-- ============================================================

CREATE TABLE IF NOT EXISTS juridica.alertas (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identidad del problema, para no duplicar: 'nombre:<predio_id>',
  -- 'sin_predio:ldh:<finca>:<propietario>', 'duplicado:<id menor>:<id mayor>'…
  clave          text        NOT NULL UNIQUE,
  -- NULL cuando el predio todavía no existe en jurídica (tipo 'sin_predio').
  predio_id      uuid        REFERENCES core.predios(id) ON DELETE CASCADE,
  tipo           text        NOT NULL
                 CHECK (tipo IN ('nombre', 'municipio', 'vereda', 'sin_predio', 'duplicado')),
  titulo         text        NOT NULL,
  detalle        text,
  -- Si hay una corrección concreta, qué campo de core.predios y con qué valor:
  -- la pantalla ofrece «Aplicar» (la API normaliza municipio y vereda).
  campo          text        CHECK (campo IN ('nombre_predio', 'municipio', 'vereda')),
  valor_sugerido text,
  -- Lo que haga falta para trabajarla: la finca del SIG (propietario,
  -- municipio, vereda, área), el otro predio de un duplicado, el aliado…
  datos          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  origen         text        NOT NULL DEFAULT 'manual',
  estado         text        NOT NULL DEFAULT 'abierta'
                 CHECK (estado IN ('abierta', 'resuelta', 'descartada')),
  nota           text,
  resuelta_por   text,
  resuelta_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     text,
  CONSTRAINT alertas_sugerencia_con_campo CHECK (valor_sugerido IS NULL OR campo IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS alertas_estado_idx    ON juridica.alertas (estado);
CREATE INDEX IF NOT EXISTS alertas_predio_id_idx ON juridica.alertas (predio_id);

COMMENT ON TABLE juridica.alertas IS
  'Lista de trabajo de jurídica: datos de un predio que no cuadran (nombre, municipio, vereda), fincas del SIG sin predio y posibles duplicados. origen=''regla'' las detecta y cierra la intranet sola; las demás se cargan por SQL. Se resuelven o descartan con nota; no se borran. Solo service_role (/api/juridica/alertas).';

ALTER TABLE juridica.alertas ENABLE ROW LEVEL SECURITY;
GRANT  ALL ON juridica.alertas TO service_role;
REVOKE ALL ON juridica.alertas FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr (lectura)
-- ============================================================
--   select count(*) from juridica.alertas;                                   -- 0 (o lo que ya se cargó)
--   select has_table_privilege('authenticated', 'juridica.alertas', 'select'); -- false
--   select has_table_privilege('service_role',  'juridica.alertas', 'select'); -- true
-- ============================================================
