-- ============================================================
--  MIGRACIÓN: tipo de proyecto + fuente de información del predio
--  Proyecto: Intranet Amazonia Emprende
--  Archivo : docs/sql/migration_proyecto_fuente.sql
--  Fecha   : 2026-09-08
--
--  QUÉ HACE
--   1. Dos catálogos parametrizables (se les agregan opciones desde la UI,
--      no hay que tocar la BD cada vez que aparece un proyecto nuevo o un
--      aliado que trae predios):
--        catalogo.proyectos            → Conexión Biodiversa, Ley del Árbol…
--        catalogo.fuentes_informacion  → socialización veredal, comunitaria,
--                                        Lácteos del Hogar…
--   2. Dos columnas en core.predios que apuntan a esos catálogos:
--        core.predios.tipo_proyecto       (código del proyecto)
--        core.predios.fuente_informacion  (código de la fuente)
--
--  POR QUÉ EN core.predios Y NO EN juridica
--   El predio es del backbone: SIG, campo, vivero y reportes leen core.predios.
--   Si la marca de proyecto viviera en el schema jurídico, las otras dependencias
--   tendrían que cruzar tablas de jurídica para saber a qué proyecto responde el
--   predio que están zonificando o sembrando. Se captura en jurídica (HOJA 1),
--   que es la puerta de entrada, pero se guarda donde todos lo ven.
--
--  POR QUÉ TEXTO Y NO UUID
--   El valor guardado es el CÓDIGO legible (conexion_biodiversa), con FK real
--   contra el catálogo. Así cualquier dependencia filtra por REST
--   (?tipo_proyecto=eq.conexion_biodiversa) sin join, y un export a Excel se
--   entiende sin resolver ids. ON UPDATE CASCADE deja renombrar el código sin
--   romper los predios.
--
--  UN PREDIO = UN PROYECTO. Si más adelante un predio necesita responder a dos
--  programas a la vez, esto pasa a ser tabla puente (core.predio_proyectos); hoy
--  no hay ese caso y una columna simple mantiene los filtros baratos.
--
--  CORRER EN: Supabase → SQL Editor (bloque por bloque o todo de una).
--  Es idempotente: se puede volver a correr sin romper nada.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — Catálogo de proyectos
-- ════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS catalogo;

CREATE TABLE IF NOT EXISTS catalogo.proyectos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo       TEXT NOT NULL UNIQUE,          -- slug estable: conexion_biodiversa
  nombre       TEXT NOT NULL,                 -- lo que ve la gente: Conexión Biodiversa
  descripcion  TEXT,
  activo       BOOLEAN NOT NULL DEFAULT true, -- false = no se ofrece en formularios nuevos,
                                              --         pero los predios ya marcados lo conservan
  orden        INTEGER NOT NULL DEFAULT 100,  -- orden en el desplegable
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  catalogo.proyectos IS 'Programas bajo los que entra un predio (Conexión Biodiversa, Ley del Árbol…). Se amplía desde la UI de jurídica.';
COMMENT ON COLUMN catalogo.proyectos.codigo IS 'Slug estable. Es lo que se guarda en core.predios.tipo_proyecto.';
COMMENT ON COLUMN catalogo.proyectos.activo IS 'false = retirado del desplegable. NO borrar filas en uso: los predios quedarían sin proyecto.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — Catálogo de fuentes de información
--   De dónde salió el predio / cómo llegó a Amazonia Emprende.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS catalogo.fuentes_informacion (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo       TEXT NOT NULL UNIQUE,
  nombre       TEXT NOT NULL,
  descripcion  TEXT,
  activo       BOOLEAN NOT NULL DEFAULT true,
  orden        INTEGER NOT NULL DEFAULT 100,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE catalogo.fuentes_informacion IS 'Cómo llegó el predio: socialización veredal, comunitaria, un aliado que trae su base (Lácteos del Hogar)… Se amplía desde la UI de jurídica.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — Semillas iniciales
--   ON CONFLICT DO NOTHING: correr esto dos veces no duplica ni pisa los
--   nombres que se hayan editado a mano.
-- ════════════════════════════════════════════════════════════

INSERT INTO catalogo.proyectos (codigo, nombre, orden) VALUES
  ('conexion_biodiversa', 'Conexión Biodiversa', 10),
  ('ley_arbol',           'Ley del Árbol',       20)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO catalogo.fuentes_informacion (codigo, nombre, orden) VALUES
  ('socializacion_veredal',     'Socialización veredal',     10),
  ('socializacion_comunitaria', 'Socialización comunitaria', 20),
  ('lacteos_del_hogar',         'Lácteos del Hogar',         30)
ON CONFLICT (codigo) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — Columnas en core.predios
-- ════════════════════════════════════════════════════════════

ALTER TABLE core.predios ADD COLUMN IF NOT EXISTS tipo_proyecto      TEXT;
ALTER TABLE core.predios ADD COLUMN IF NOT EXISTS fuente_informacion TEXT;

-- FK contra el catálogo (por código, no por id).
--   ON UPDATE CASCADE  → renombrar un código arrastra a los predios.
--   ON DELETE SET NULL → borrar una opción no borra predios; los deja sin marcar.
ALTER TABLE core.predios DROP CONSTRAINT IF EXISTS predios_tipo_proyecto_fk;
ALTER TABLE core.predios
  ADD CONSTRAINT predios_tipo_proyecto_fk
  FOREIGN KEY (tipo_proyecto) REFERENCES catalogo.proyectos(codigo)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE core.predios DROP CONSTRAINT IF EXISTS predios_fuente_informacion_fk;
ALTER TABLE core.predios
  ADD CONSTRAINT predios_fuente_informacion_fk
  FOREIGN KEY (fuente_informacion) REFERENCES catalogo.fuentes_informacion(codigo)
  ON UPDATE CASCADE ON DELETE SET NULL;

COMMENT ON COLUMN core.predios.tipo_proyecto      IS 'Programa bajo el que entra el predio. Código de catalogo.proyectos. NULL = todavía sin clasificar.';
COMMENT ON COLUMN core.predios.fuente_informacion IS 'De dónde llegó el predio. Código de catalogo.fuentes_informacion. NULL = sin registrar.';

CREATE INDEX IF NOT EXISTS predios_tipo_proyecto_idx      ON core.predios(tipo_proyecto);
CREATE INDEX IF NOT EXISTS predios_fuente_informacion_idx ON core.predios(fuente_informacion);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — updated_at automático
-- ════════════════════════════════════════════════════════════

-- La función ya existe desde migration_catalogo.sql; se recrea por si acaso.
CREATE OR REPLACE FUNCTION catalogo.touch_updated_at() RETURNS TRIGGER
  LANGUAGE plpgsql AS $fn$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END $fn$;

DROP TRIGGER IF EXISTS proyectos_touch ON catalogo.proyectos;
CREATE TRIGGER proyectos_touch BEFORE UPDATE ON catalogo.proyectos
  FOR EACH ROW EXECUTE FUNCTION catalogo.touch_updated_at();

DROP TRIGGER IF EXISTS fuentes_touch ON catalogo.fuentes_informacion;
CREATE TRIGGER fuentes_touch BEFORE UPDATE ON catalogo.fuentes_informacion
  FOR EACH ROW EXECUTE FUNCTION catalogo.touch_updated_at();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 — RLS + permisos
--   Mismo patrón que catalogo.especies: lectura abierta (los catálogos no son
--   sensibles y el geoportal público también los va a necesitar), escritura solo
--   autenticado. El filtro fino de quién puede agregar opciones lo hace la API
--   route (service_role + department = Juridica | admin).
-- ════════════════════════════════════════════════════════════

ALTER TABLE catalogo.proyectos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo.fuentes_informacion  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proyectos_select" ON catalogo.proyectos;
CREATE POLICY "proyectos_select" ON catalogo.proyectos
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "proyectos_write_auth" ON catalogo.proyectos;
CREATE POLICY "proyectos_write_auth" ON catalogo.proyectos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fuentes_select" ON catalogo.fuentes_informacion;
CREATE POLICY "fuentes_select" ON catalogo.fuentes_informacion
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "fuentes_write_auth" ON catalogo.fuentes_informacion;
CREATE POLICY "fuentes_write_auth" ON catalogo.fuentes_informacion
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Sin estos GRANT sale "permission denied for table" aunque la política exista.
GRANT USAGE ON SCHEMA catalogo TO anon, authenticated, service_role;
GRANT SELECT                   ON catalogo.proyectos           TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE   ON catalogo.proyectos           TO authenticated, service_role;
GRANT SELECT                   ON catalogo.fuentes_informacion TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE   ON catalogo.fuentes_informacion TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 7 — Recargar PostgREST
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 8 — Verificación (correr al final)
-- ════════════════════════════════════════════════════════════

-- 8.1 Los dos catálogos con sus semillas (2 proyectos + 3 fuentes):
SELECT 'proyecto' AS tipo, codigo, nombre, orden FROM catalogo.proyectos
UNION ALL
SELECT 'fuente',           codigo, nombre, orden FROM catalogo.fuentes_informacion
ORDER BY 1, 4;

-- 8.2 Las columnas nuevas en core.predios:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'core' AND table_name = 'predios'
  AND column_name IN ('tipo_proyecto', 'fuente_informacion');
-- Esperado: 2 filas, text, YES

-- 8.3 Cuántos predios quedan por clasificar (al correr esto: los 111):
SELECT
  COUNT(*)                              AS predios,
  COUNT(tipo_proyecto)                  AS con_proyecto,
  COUNT(*) - COUNT(tipo_proyecto)       AS sin_proyecto,
  COUNT(fuente_informacion)             AS con_fuente,
  COUNT(*) - COUNT(fuente_informacion)  AS sin_fuente
FROM core.predios;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 9 — Clasificar los predios que ya existen (OPCIONAL)
--   Los 111 predios actuales quedan en NULL = "sin clasificar", y en la
--   intranet se filtran con «Sin proyecto asignado» para irlos marcando desde
--   HOJA 1.
--
--   Si hay un criterio masivo claro, se puede adelantar trabajo aquí.
--   ESTÁ COMENTADO A PROPÓSITO: descomentar solo cuando el criterio esté
--   confirmado — un UPDATE sin WHERE marca predios que no son.
-- ════════════════════════════════════════════════════════════

-- Todo lo cargado antes de hoy nació bajo Conexión Biodiversa:
-- UPDATE core.predios
--    SET tipo_proyecto = 'conexion_biodiversa'
--  WHERE tipo_proyecto IS NULL
--    AND created_at < '2026-09-08';

-- Los predios de un municipio que entraron por socialización veredal:
-- UPDATE core.predios
--    SET fuente_informacion = 'socializacion_veredal'
--  WHERE fuente_informacion IS NULL
--    AND municipio = 'SOLANO';

-- Antes de cualquiera de esos UPDATE, mirar a quién van a tocar:
-- SELECT municipio, COUNT(*) FROM core.predios
--  WHERE tipo_proyecto IS NULL GROUP BY municipio ORDER BY 2 DESC;
