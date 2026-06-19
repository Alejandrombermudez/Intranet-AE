-- ============================================================
--  MIGRACIÓN: Schema core (modelo canónico aliados/predios/expedientes)
--  Proyecto: Intranet Amazonia Emprende
--  Archivo : docs/sql/migration_core.sql
--  Fecha   : 2026-06-18
--
--  QUÉ HACE
--    Crea el núcleo canónico (core) que separa PERSONA de PREDIO de PROCESO,
--    y descompone juridica.aliados (que hoy mezcla los tres) en su sitio.
--    Jurídica pasa a ser la puerta de entrada: crea la persona, el predio
--    y abre el expediente.
--
--  ESTRATEGIA (sin romper nada, reversible)
--    - Los datos actuales de juridica/siembra/ras son de PRUEBA (no producción).
--      No se migran filas basura: se archiva juridica.aliados como _legacy.
--    - core se crea vacío; la abogada entra datos reales directo al modelo bueno.
--    - Nada se DROPea en esta migración. El _legacy se puede borrar después.
--
--  PASO MANUAL (Supabase Dashboard) — IMPRESCINDIBLE:
--    Settings → API → Exposed schemas → agregar: core
--    Hacerlo DESPUÉS de correr este SQL (el schema debe existir primero).
--    Dispara una recarga de PostgREST; sin esto la app da "schema must be one of...".
--
--  Contexto y mapeo campo-a-campo: docs/CORE_MIGRACION.md
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — Schema y función de timestamp
-- ════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS core;
GRANT USAGE ON SCHEMA core TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION core.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — core.aliados (PERSONA: natural o jurídica)
-- ════════════════════════════════════════════════════════════

CREATE TABLE core.aliados (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  tipo_persona       TEXT NOT NULL DEFAULT 'natural'
                       CHECK (tipo_persona IN ('natural','juridica')),
  tipo_documento     TEXT NOT NULL DEFAULT 'CC'
                       CHECK (tipo_documento IN ('CC','NUIP','CE','TI','PP','NIT')),
  numero_documento   TEXT NOT NULL,
  nombre_completo    TEXT NOT NULL,          -- razón social si es jurídica

  telefono           TEXT,
  email              TEXT,

  created_by         TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT aliados_documento_unico UNIQUE (numero_documento)
);

COMMENT ON TABLE core.aliados IS 'Persona (natural o jurídica). Identidad canónica del propietario/aliado. Antes mezclada con el predio en juridica.aliados.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — core.predios (PREDIO)
-- ════════════════════════════════════════════════════════════

CREATE TABLE core.predios (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aliado_id              UUID NOT NULL REFERENCES core.aliados(id) ON DELETE RESTRICT,  -- dueño principal

  nombre_predio          TEXT,
  departamento           TEXT,
  municipio              TEXT NOT NULL,
  vereda                 TEXT,
  zona_ae                TEXT,               -- núcleo Amazonia Emprende (Piedemonte, etc.)

  matricula_inmobiliaria TEXT,               -- formato libre "420-99639"
  codigo_catastral       TEXT,               -- preserva ceros a la izquierda
  area_registral         NUMERIC(12,4),      -- hectáreas del folio

  created_by             TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE core.predios IS 'Predio. aliado_id = propietario principal; copropiedad en core.predio_propietarios.';

-- Evita predios duplicados por matrícula (cuando la matrícula está informada)
CREATE UNIQUE INDEX uq_predios_matricula
  ON core.predios (matricula_inmobiliaria)
  WHERE matricula_inmobiliaria IS NOT NULL;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — core.predio_propietarios (copropiedad N—N)
-- ════════════════════════════════════════════════════════════

CREATE TABLE core.predio_propietarios (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  predio_id   UUID NOT NULL REFERENCES core.predios(id)  ON DELETE CASCADE,
  aliado_id   UUID NOT NULL REFERENCES core.aliados(id)  ON DELETE RESTRICT,
  rol         TEXT NOT NULL DEFAULT 'copropietario'
                CHECK (rol IN ('principal','copropietario')),
  cuota_pct   NUMERIC(5,2),                  -- % de propiedad (opcional)
  created_at  TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT predio_propietario_unico UNIQUE (predio_id, aliado_id)
);

COMMENT ON TABLE core.predio_propietarios IS 'Vincula varios dueños a un predio. El principal también está denormalizado en core.predios.aliado_id.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — core.expedientes (PROCESO de vinculación del predio)
-- ════════════════════════════════════════════════════════════

CREATE TABLE core.expedientes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  predio_id       UUID NOT NULL UNIQUE REFERENCES core.predios(id) ON DELETE CASCADE,

  etapa           TEXT NOT NULL DEFAULT 'juridica'
                    CHECK (etapa IN ('juridica','sig_i','campo','sig_ii','plan','juridica_ii','ejecucion','archivado')),
  estado          TEXT NOT NULL DEFAULT 'activo'
                    CHECK (estado IN ('activo','rechazado','archivado','completado')),
  linea           TEXT CHECK (linea IN ('restauracion','conservacion','ambas')),
  proyecto_fase   TEXT,                      -- "Fase I", "Fase II", ...

  responsable     TEXT,
  fecha_inicio    TIMESTAMPTZ DEFAULT NOW(),

  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE core.expedientes IS 'Máquina de estados del predio en el proceso (jurídica → sig → campo → plan → aval → ejecución). Un expediente por predio.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 — juridica.debida_diligencia (workflow DD + soportes)
-- 1:1 con el predio. Reemplaza la parte "proceso" de juridica.aliados.
-- ════════════════════════════════════════════════════════════

CREATE TABLE juridica.debida_diligencia (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  predio_id                   UUID NOT NULL UNIQUE REFERENCES core.predios(id) ON DELETE CASCADE,

  estado                      TEXT NOT NULL DEFAULT 'borrador'
                                CHECK (estado IN ('borrador','antecedentes_ok','juridico_ok','aprobado','rechazado')),

  -- Soportes documentales (PDFs en bucket juridica-documentos)
  cedula_url                  TEXT,          -- NUEVO: escaneo del documento de identidad
  certificado_tradicion_url   TEXT,
  recibo_predial_url          TEXT,
  anio_ultimo_pago_predial    INTEGER,

  -- Manifestación de interés
  manifestacion_interes       BOOLEAN,
  manifestacion_observaciones TEXT,
  manifestacion_url           TEXT,

  created_by                  TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE juridica.debida_diligencia IS 'Workflow de debida diligencia (estado) + soportes (manifestación, predial, cédula) por predio.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 7 — Repuntar antecedentes y análisis al modelo core
--   antecedentes  → persona (core.aliados)   [la persona se veta una vez]
--   analisis_juridico → predio (core.predios) [el folio es del predio]
-- Las filas actuales son de prueba: se limpian.
-- ════════════════════════════════════════════════════════════

-- 7.1 antecedentes: cambiar el FK de juridica.aliados a core.aliados
ALTER TABLE juridica.antecedentes DROP CONSTRAINT IF EXISTS antecedentes_aliado_id_fkey;
TRUNCATE juridica.antecedentes;
ALTER TABLE juridica.antecedentes
  ADD CONSTRAINT antecedentes_aliado_id_fkey
  FOREIGN KEY (aliado_id) REFERENCES core.aliados(id) ON DELETE CASCADE;

-- 7.2 analisis_juridico: pasar de aliado_id a predio_id (el folio pertenece al predio)
ALTER TABLE juridica.analisis_juridico DROP CONSTRAINT IF EXISTS analisis_juridico_aliado_id_fkey;
TRUNCATE juridica.analisis_juridico;
ALTER TABLE juridica.analisis_juridico DROP COLUMN IF EXISTS aliado_id;
ALTER TABLE juridica.analisis_juridico
  ADD COLUMN predio_id UUID NOT NULL UNIQUE REFERENCES core.predios(id) ON DELETE CASCADE;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 8 — Archivar la tabla vieja (reversible: NO se borra)
-- ════════════════════════════════════════════════════════════

-- Quitar el FK que siembra.familias tenía hacia juridica.aliados…
ALTER TABLE siembra.familias DROP CONSTRAINT IF EXISTS familias_aliado_id_fkey;

-- …y archivar la tabla mezclada como referencia histórica.
ALTER TABLE IF EXISTS juridica.aliados RENAME TO aliados_legacy;
COMMENT ON TABLE juridica.aliados_legacy IS 'OBSOLETA. Modelo viejo (persona+predio mezclados). Reemplazada por core.aliados + core.predios + juridica.debida_diligencia. Borrar tras verificar el cutover.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 9 — Enganche con campo (siembra/ras) hacia el backbone
--   Los datos de siembra/ras son de prueba; solo dejamos los FKs listos
--   para que el flujo nuevo (jurídica → core) los enlace.
-- ════════════════════════════════════════════════════════════

-- siembra.familias: el aliado ahora es core.aliados; y se enlaza al expediente
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS expediente_id UUID REFERENCES core.expedientes(id) ON DELETE SET NULL;
ALTER TABLE siembra.familias
  ADD CONSTRAINT familias_aliado_id_fkey
  FOREIGN KEY (aliado_id) REFERENCES core.aliados(id) ON DELETE SET NULL;

-- ras.familias: enlaces opcionales al backbone (para el futuro flujo de conservación)
ALTER TABLE ras.familias
  ADD COLUMN IF NOT EXISTS aliado_id     UUID REFERENCES core.aliados(id)     ON DELETE SET NULL;
ALTER TABLE ras.familias
  ADD COLUMN IF NOT EXISTS expediente_id UUID REFERENCES core.expedientes(id) ON DELETE SET NULL;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 10 — Índices
-- ════════════════════════════════════════════════════════════

-- Nota: las columnas UNIQUE (predios.matricula, expedientes.predio_id,
-- debida_diligencia.predio_id, analisis_juridico.predio_id, propietarios(predio,aliado))
-- ya tienen su índice por la restricción; aquí solo van los que faltan.
CREATE INDEX idx_aliados_documento     ON core.aliados(numero_documento);
CREATE INDEX idx_predios_aliado        ON core.predios(aliado_id);
CREATE INDEX idx_predios_municipio     ON core.predios(municipio);
CREATE INDEX idx_propietarios_aliado   ON core.predio_propietarios(aliado_id);
CREATE INDEX idx_expedientes_etapa     ON core.expedientes(etapa);
CREATE INDEX idx_dd_estado             ON juridica.debida_diligencia(estado);
CREATE INDEX idx_familias_expediente   ON siembra.familias(expediente_id);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 11 — Triggers updated_at
-- ════════════════════════════════════════════════════════════

CREATE TRIGGER trg_aliados_updated_at      BEFORE UPDATE ON core.aliados              FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_predios_updated_at      BEFORE UPDATE ON core.predios              FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_expedientes_updated_at  BEFORE UPDATE ON core.expedientes          FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER trg_dd_updated_at           BEFORE UPDATE ON juridica.debida_diligencia FOR EACH ROW EXECUTE FUNCTION juridica.set_updated_at();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 12 — RLS + permisos (mismo patrón que el resto del sistema)
-- ════════════════════════════════════════════════════════════

ALTER TABLE core.aliados              ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.predios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.predio_propietarios  ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.expedientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE juridica.debida_diligencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "core_aliados_select"      ON core.aliados              FOR SELECT TO authenticated USING (true);
CREATE POLICY "core_predios_select"      ON core.predios              FOR SELECT TO authenticated USING (true);
CREATE POLICY "core_propietarios_select" ON core.predio_propietarios  FOR SELECT TO authenticated USING (true);
CREATE POLICY "core_expedientes_select"  ON core.expedientes          FOR SELECT TO authenticated USING (true);
CREATE POLICY "dd_select"                ON juridica.debida_diligencia FOR SELECT TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA core TO authenticated, service_role;
GRANT USAGE                          ON ALL SEQUENCES IN SCHEMA core TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT USAGE ON SEQUENCES TO authenticated, service_role;

-- debida_diligencia hereda los grants por defecto del schema juridica ya definidos,
-- pero los repetimos por si esta tabla se creó después del ALTER DEFAULT:
GRANT SELECT, INSERT, UPDATE, DELETE ON juridica.debida_diligencia TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 13 — Recargar PostgREST
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 14 — Verificación (correr al final)
-- ════════════════════════════════════════════════════════════

-- 4 tablas en core:
SELECT 'core' AS schema, tablename FROM pg_tables WHERE schemaname='core'
UNION ALL
SELECT 'juridica', tablename FROM pg_tables WHERE schemaname='juridica'
ORDER BY 1,2;
-- Esperado core: aliados, expedientes, predio_propietarios, predios
-- Esperado juridica: aliados_legacy, analisis_juridico, antecedentes, debida_diligencia

-- analisis_juridico debe tener predio_id (no aliado_id):
SELECT column_name FROM information_schema.columns
WHERE table_schema='juridica' AND table_name='analisis_juridico' AND column_name IN ('aliado_id','predio_id');
-- Esperado: predio_id
