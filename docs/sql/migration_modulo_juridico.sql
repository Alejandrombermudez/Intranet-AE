-- ============================================================
--  MIGRACIÓN: Schema juridica (Módulo Jurídico Fase 1)
--  Proyecto: Intranet Amazonia Emprende
--  Archivo : docs/sql/migration_modulo_juridico.sql
--  Fecha   : Mayo 2026
--
--  CONTEXTO COMPLETO: juridica/CONTEXTO_MODULO_JURIDICO.md
--
--  REQUIERE PASO PREVIO MANUAL EN SUPABASE DASHBOARD:
--    Settings → API → Extra schemas → agregar: juridica
--    (también requerido DESPUÉS de ejecutar este script para
--     que PostgREST exponga el schema vía REST)
--
--  REQUIERE PASO POSTERIOR MANUAL EN SUPABASE DASHBOARD:
--    Storage → New bucket → nombre: juridica-documentos (privado)
--    Aplicar las políticas RLS que están al final de este archivo.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — Schema y permisos base
-- ════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS juridica;

GRANT USAGE ON SCHEMA juridica TO anon, authenticated, service_role;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — Tabla maestra: juridica.aliados (HOJA 1)
-- ════════════════════════════════════════════════════════════

CREATE TABLE juridica.aliados (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Identificación
  nombre_completo             TEXT NOT NULL,
  tipo_documento              TEXT DEFAULT 'CC'
                                CHECK (tipo_documento IN ('CC','NUIP','CE','TI','PP','NIT')),
  numero_documento            TEXT NOT NULL,

  -- Ubicación
  departamento                TEXT,
  municipio                   TEXT NOT NULL,
  vereda                      TEXT,
  zona_ae                     TEXT,

  -- Predio
  nombre_predio               TEXT,
  matricula_inmobiliaria      TEXT,                 -- formato libre: "420-3478"
  certificado_tradicion_url   TEXT,                 -- PDF en bucket juridica-documentos
  area_registral              NUMERIC(12,4),        -- hectáreas registradas (decimal)
  codigo_catastral            TEXT,                 -- preserva ceros a la izquierda

  -- Predial
  anio_ultimo_pago_predial    INTEGER,
  recibo_predial_url          TEXT,                 -- PDF del recibo

  -- Manifestación de interés
  manifestacion_interes       BOOLEAN,
  manifestacion_observaciones TEXT,
  manifestacion_url           TEXT,                 -- PDF firmado

  -- Estado del workflow
  estado                      TEXT DEFAULT 'borrador'
                                CHECK (estado IN ('borrador','antecedentes_ok','juridico_ok','aprobado','rechazado')),

  -- Auditoría
  created_by                  TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),

  -- Un aliado único por número de documento
  CONSTRAINT aliados_documento_unico UNIQUE (numero_documento)
);

COMMENT ON TABLE juridica.aliados IS 'Aliados/familias del proceso de debida diligencia jurídica. Tabla maestra (HOJA 1 del requerimiento).';
COMMENT ON COLUMN juridica.aliados.estado IS 'Workflow: borrador → antecedentes_ok → juridico_ok → aprobado | rechazado';
COMMENT ON COLUMN juridica.aliados.zona_ae IS 'Clasificación interna de Amazonia Emprende (núcleo geográfico). Se mapea a siembra.familias.nucleo';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — Tabla: juridica.antecedentes (HOJA 2)
-- 1:1 con aliados — 14 listas restrictivas + flags reputacionales
-- ════════════════════════════════════════════════════════════

CREATE TABLE juridica.antecedentes (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aliado_id                UUID NOT NULL UNIQUE
                             REFERENCES juridica.aliados(id) ON DELETE CASCADE,

  -- Listas nacionales (Colombia). true = APARECE en la lista (bandera roja)
  rama_judicial            BOOLEAN,
  rama_judicial_url        TEXT,
  procuraduria             BOOLEAN,
  procuraduria_url         TEXT,
  contraloria              BOOLEAN,
  contraloria_url          TEXT,
  policia_nacional         BOOLEAN,
  policia_nacional_url     TEXT,
  rnmc                     BOOLEAN,            -- Registro Nacional Medidas Correctivas
  rnmc_url                 TEXT,

  -- Listas internacionales
  onu                      BOOLEAN,
  onu_url                  TEXT,
  ofac                     BOOLEAN,            -- Office of Foreign Assets Control (EEUU)
  ofac_url                 TEXT,
  bid                      BOOLEAN,            -- Banco Interamericano de Desarrollo
  bid_url                  TEXT,
  banco_mundial            BOOLEAN,
  banco_mundial_url        TEXT,
  hm_treasury              BOOLEAN,            -- HM Treasury — UK Sanctions List
  hm_treasury_url          TEXT,
  fbi                      BOOLEAN,
  fbi_url                  TEXT,
  interpol                 BOOLEAN,
  interpol_url             TEXT,
  ue_terroristas           BOOLEAN,            -- Lista UE Organizaciones Terroristas
  ue_terroristas_url       TEXT,
  dea                      BOOLEAN,            -- Drug Enforcement Administration
  dea_url                  TEXT,

  -- Flags reputacionales (sin URL — son hallazgos manuales)
  pep                      BOOLEAN,            -- Persona Expuesta Políticamente
  prensa_negativa          BOOLEAN,

  -- Resultado de la due diligence
  observaciones            TEXT,
  aprobado                 BOOLEAN,            -- true = pasa, false = rechazado

  -- Auditoría
  created_by               TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE juridica.antecedentes IS 'Revisión de listas restrictivas y reputacionales (HOJA 2). Una fila por aliado.';
COMMENT ON COLUMN juridica.antecedentes.rama_judicial IS 'true = APARECE en la lista (bandera roja). false = consulta limpia. null = consulta pendiente.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — Tabla: juridica.analisis_juridico (HOJA 3)
-- 1:1 con aliados — análisis del folio de matrícula
-- ════════════════════════════════════════════════════════════

CREATE TABLE juridica.analisis_juridico (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  aliado_id                   UUID NOT NULL UNIQUE
                                REFERENCES juridica.aliados(id) ON DELETE CASCADE,

  -- Estado del folio
  estado_folio                TEXT CHECK (estado_folio IN ('ACTIVO','CERRADO')),
  vereda_registral            TEXT,                -- vereda según el folio (puede diferir de la física)
  fmi_matrices                TEXT,                -- Folios de Matrícula Inmobiliaria matrices
  fmi_derivados               TEXT,                -- Folios derivados de éste

  -- Tradición
  acto_origen                 TEXT,                -- Tipo de acto que originó el folio
  descripcion_acto_origen     TEXT,
  acto_adquisicion_actual     TEXT,                -- Cómo adquirió el propietario actual
  naturaleza_juridica         TEXT,                -- Privado, baldío, etc.

  -- Banderas jurídicas (true = problema detectado)
  falsa_tradicion             BOOLEAN,
  procesos_judiciales         BOOLEAN,
  procesos_judiciales_desc    TEXT,
  medidas_cautelares          BOOLEAN,
  medidas_cautelares_desc     TEXT,
  liquidaciones               BOOLEAN,
  liquidaciones_desc          TEXT,
  sucesiones                  BOOLEAN,
  sucesiones_desc             TEXT,

  -- Conceptos institucionales
  concepto_ant                TEXT,                -- Agencia Nacional de Tierras
  concepto_urt                TEXT,                -- Unidad de Restitución de Tierras
  concepto_pnn                TEXT,                -- Parques Nacionales Naturales

  -- Resultado final
  observaciones               TEXT,
  semaforo                    TEXT CHECK (semaforo IN ('verde','amarillo','naranja','rojo')),

  -- Auditoría
  created_by                  TEXT,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE juridica.analisis_juridico IS 'Análisis jurídico del folio de matrícula inmobiliaria (HOJA 3). Una fila por aliado.';
COMMENT ON COLUMN juridica.analisis_juridico.semaforo IS 'Veredicto final: verde (autoriza), amarillo (con seguimiento), naranja (comité), rojo (no procede).';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — Integración con siembra.familias
-- Permite vincular cada familia a un aliado jurídico aprobado.
-- ════════════════════════════════════════════════════════════

ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS aliado_id UUID
    REFERENCES juridica.aliados(id) ON DELETE SET NULL;

COMMENT ON COLUMN siembra.familias.aliado_id IS 'Vínculo opcional al aliado jurídico aprobado. Si se vincula, los 6 campos básicos se prellenan desde juridica.aliados.';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 — Índices
-- ════════════════════════════════════════════════════════════

CREATE INDEX idx_aliados_municipio       ON juridica.aliados(municipio);
CREATE INDEX idx_aliados_estado          ON juridica.aliados(estado);
CREATE INDEX idx_aliados_documento       ON juridica.aliados(numero_documento);
CREATE INDEX idx_antecedentes_aliado     ON juridica.antecedentes(aliado_id);
CREATE INDEX idx_juridico_aliado         ON juridica.analisis_juridico(aliado_id);
CREATE INDEX idx_juridico_semaforo       ON juridica.analisis_juridico(semaforo);
CREATE INDEX idx_familias_aliado         ON siembra.familias(aliado_id);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 7 — Trigger updated_at
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION juridica.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aliados_updated_at
  BEFORE UPDATE ON juridica.aliados
  FOR EACH ROW EXECUTE FUNCTION juridica.set_updated_at();

CREATE TRIGGER trg_antecedentes_updated_at
  BEFORE UPDATE ON juridica.antecedentes
  FOR EACH ROW EXECUTE FUNCTION juridica.set_updated_at();

CREATE TRIGGER trg_juridico_updated_at
  BEFORE UPDATE ON juridica.analisis_juridico
  FOR EACH ROW EXECUTE FUNCTION juridica.set_updated_at();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 8 — Row Level Security
-- ════════════════════════════════════════════════════════════

ALTER TABLE juridica.aliados            ENABLE ROW LEVEL SECURITY;
ALTER TABLE juridica.antecedentes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE juridica.analisis_juridico  ENABLE ROW LEVEL SECURITY;

-- Acceso desde la app: autorización fina se maneja en las API routes
-- (service_role bypass RLS). Estas políticas son defensivas para acceso directo.
CREATE POLICY "aliados_select"      ON juridica.aliados            FOR SELECT TO authenticated USING (true);
CREATE POLICY "antecedentes_select" ON juridica.antecedentes       FOR SELECT TO authenticated USING (true);
CREATE POLICY "juridico_select"     ON juridica.analisis_juridico  FOR SELECT TO authenticated USING (true);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 9 — Permisos (CRÍTICO: sin esto, "permission denied")
-- ════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA juridica
  TO authenticated, service_role;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA juridica
  TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA juridica
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA juridica
  GRANT USAGE ON SEQUENCES TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 10 — Recargar PostgREST
-- ════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 11 — Verificación (correr al final)
-- ════════════════════════════════════════════════════════════

-- Debe devolver 3 filas:
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'juridica'
ORDER BY tablename;
-- Esperado:
--   juridica | aliados
--   juridica | analisis_juridico
--   juridica | antecedentes

-- Debe devolver 1 fila confirmando el FK:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='siembra' AND table_name='familias' AND column_name='aliado_id';
-- Esperado: aliado_id | uuid | YES


-- ════════════════════════════════════════════════════════════
-- BLOQUE 12 — Storage bucket (ejecutar MANUALMENTE en Dashboard)
-- ════════════════════════════════════════════════════════════
--
--  1. Supabase Dashboard → Storage → New bucket
--     - Nombre: juridica-documentos
--     - Público: FALSE (importante)
--
--  2. Storage → juridica-documentos → Policies → New policy → CUSTOM:
--
--  CREATE POLICY "auth_read_juridica" ON storage.objects
--    FOR SELECT TO authenticated USING (bucket_id = 'juridica-documentos');
--
--  CREATE POLICY "auth_write_juridica" ON storage.objects
--    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'juridica-documentos');
--
--  CREATE POLICY "auth_update_juridica" ON storage.objects
--    FOR UPDATE TO authenticated USING (bucket_id = 'juridica-documentos');
--
--  CREATE POLICY "auth_delete_juridica" ON storage.objects
--    FOR DELETE TO authenticated USING (bucket_id = 'juridica-documentos');
--
--  Estructura de paths en el bucket:
--    {aliado_id}/certificado_tradicion.pdf
--    {aliado_id}/recibo_predial.pdf
--    {aliado_id}/manifestacion.pdf
--    {aliado_id}/antecedentes/{lista}.pdf
