-- ============================================================
--  MIGRACIÓN: talento humano — ficha de cada persona, contratos,
--             documentos, certificados laborales y cuentas de cobro
--  Archivo : docs/sql/migration_talento_humano.sql
--  Fecha   : 2026-10-14
--  Requiere: esquema people (migration_schemas_people_fleet.sql) y
--            catalogo.proyectos (migration_proyecto_fuente.sql).
--            Independiente de migration_financiero_inventario.sql: se pueden
--            correr en cualquier orden.
--
--  QUÉ RESUELVE
--    1. Cada persona con correo @amazoniaemprende.com tiene su FICHA
--       (people.personas): identificación, contacto, seguridad social, tipo de
--       sangre, contacto de emergencia, formación, cuenta para pagos, tallas
--       de dotación. La llena ella misma en «Mi perfil»; nombres, apellidos y
--       lo que tenga Microsoft 365 (cargo, celular, foto) llegan solos desde el
--       inicio de sesión.
--    2. Sus CONTRATOS (people.contratos), con la diferencia que manda todo lo
--       demás: PLANTA (laboral) o CONTRATISTA (prestación de servicios).
--       Talento humano los registra y sube el PDF firmado.
--    3. CUENTAS DE COBRO (people.cuentas_cobro): solo contratistas con contrato
--       vigente. La persona pone el concepto y el valor (por defecto, sus
--       honorarios); el sistema pone el consecutivo, la fecha y sus datos. Cada
--       cuenta guarda una FOTO FIJA (`datos`) de la persona, el contrato y la
--       organización al momento de radicarla: si después cambia la cuenta
--       bancaria, la cuenta de cobro ya radicada no cambia. Talento humano las
--       ve todas, las aprueba, devuelve o marca pagadas, y las descarga juntas.
--    4. CERTIFICADOS LABORALES (people.certificados): cada uno que se expide
--       queda registrado con un código de verificación y la foto fija de lo que
--       certificó.
--    5. DOCUMENTOS de la persona (cédula, RUT, certificación bancaria…) en el
--       bucket privado `talento-humano`.
--
--  DATOS SENSIBLES (Ley 1581 de 2012)
--    El tipo de sangre y la información médica son datos sensibles. La ficha
--    guarda la autorización de tratamiento de datos (y la de datos sensibles)
--    con su fecha y la versión del texto aceptado. Sin la autorización la
--    intranet no deja guardar la ficha.
--
--  QUIÉN LEE QUÉ
--    Todas las tablas: SOLO service_role (RLS encendido sin políticas, sin
--    permisos para anon ni authenticated). Se llega por las rutas
--    /api/talento/* de la intranet, que deciden con el token de la sesión:
--      · cada persona: su propia ficha, sus contratos, sus documentos, sus
--        cuentas de cobro y sus certificados;
--      · talento humano (departamentos Financiero y Ejecutivo): todo.
--    `people` ya está en Exposed schemas: no hay paso manual en Supabase.
--
--  REGLA DEL PROYECTO: este .sql lo corre el USUARIO en el SQL Editor. El
--  asistente no ejecuta DDL. El editor de Supabase NO respeta BEGIN/COMMIT:
--  cada sentencia es repetible; si algo falla, se corrige y se corre entero.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 0 — Utilidades
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION people.tocar_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — La ficha de cada persona
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS people.personas (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- El correo con que entra (Microsoft 365). Es la llave con la sesión.
  email                  TEXT NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND email LIKE '%_@_%'),
  m365_oid               TEXT UNIQUE,          -- identificador de la persona en Microsoft 365

  -- Identificación
  tipo_documento         TEXT CHECK (tipo_documento IN ('CC','CE','TI','PEP','PPT','PA')),
  numero_documento       TEXT,
  fecha_expedicion       DATE,
  lugar_expedicion       TEXT,
  nombres                TEXT,
  apellidos              TEXT,

  -- Datos personales
  fecha_nacimiento       DATE,
  lugar_nacimiento       TEXT,
  sexo                   TEXT CHECK (sexo IN ('F','M','X')),   -- X: otro / prefiere no decir
  estado_civil           TEXT,
  nacionalidad           TEXT,

  -- Contacto y residencia
  celular                TEXT,
  telefono_fijo          TEXT,
  correo_personal        TEXT,
  direccion              TEXT,
  barrio                 TEXT,
  municipio              TEXT,
  departamento           TEXT,

  -- Salud y seguridad social (grupo sanguíneo e información médica: datos sensibles)
  grupo_sanguineo        TEXT CHECK (grupo_sanguineo IN ('O+','O-','A+','A-','B+','B-','AB+','AB-')),
  eps                    TEXT,
  fondo_pensiones        TEXT,
  fondo_cesantias        TEXT,
  arl                    TEXT,
  caja_compensacion      TEXT,
  informacion_medica     TEXT,                 -- alergias, medicamentos, condiciones a tener en cuenta en campo

  -- Contacto de emergencia
  emergencia_nombre      TEXT,
  emergencia_parentesco  TEXT,
  emergencia_telefono    TEXT,

  -- Formación
  nivel_educativo        TEXT,
  profesion              TEXT,
  tarjeta_profesional    TEXT,

  -- Para pagos (nómina o cuentas de cobro)
  banco                  TEXT,
  tipo_cuenta            TEXT CHECK (tipo_cuenta IN ('ahorros','corriente','deposito_electronico')),
  numero_cuenta          TEXT,
  responsable_iva        BOOLEAN NOT NULL DEFAULT FALSE,   -- contratistas: casi nunca

  -- Dotación
  talla_camisa           TEXT,
  talla_pantalon         TEXT,
  talla_calzado          TEXT,

  -- Imagen de la firma, para las cuentas de cobro (PNG en base64, opcional)
  firma                  TEXT CHECK (firma IS NULL OR length(firma) <= 200000),

  -- Lo que llegó de Microsoft 365 (cargo, departamento, teléfonos, oficina…)
  m365                   JSONB,
  foto                   TEXT CHECK (foto IS NULL OR length(foto) <= 250000),
  m365_sincronizado_at   TIMESTAMPTZ,

  -- Autorización de tratamiento de datos (Ley 1581 de 2012)
  autoriza_datos         BOOLEAN NOT NULL DEFAULT FALSE,
  autoriza_sensibles     BOOLEAN NOT NULL DEFAULT FALSE,
  autoriza_at            TIMESTAMPTZ,
  autoriza_version       TEXT,

  activo                 BOOLEAN NOT NULL DEFAULT TRUE,
  notas_rrhh             TEXT,                 -- solo las ve talento humano
  created_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by             TEXT,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS personas_documento_uq
  ON people.personas (numero_documento) WHERE numero_documento IS NOT NULL;
COMMENT ON TABLE people.personas IS
  'Ficha de talento humano de cada persona (llave: el correo de Microsoft 365). Solo service_role. Contiene datos sensibles (grupo sanguíneo, información médica) con su autorización.';

DROP TRIGGER IF EXISTS trg_personas_updated ON people.personas;
CREATE TRIGGER trg_personas_updated BEFORE UPDATE ON people.personas
  FOR EACH ROW EXECUTE FUNCTION people.tocar_updated_at();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — Contratos
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS people.contratos (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id          UUID NOT NULL REFERENCES people.personas(id) ON DELETE RESTRICT,
  -- planta = contrato laboral (nómina, no pasa cuentas de cobro)
  -- contratista = prestación de servicios (honorarios, pasa cuenta de cobro)
  vinculacion         TEXT NOT NULL CHECK (vinculacion IN ('planta','contratista','aprendiz','practicante')),
  modalidad           TEXT CHECK (modalidad IN ('termino_indefinido','termino_fijo','obra_labor',
                                                'prestacion_servicios','aprendizaje','practica')),
  numero              TEXT,                    -- número del contrato
  cargo               TEXT NOT NULL,           -- cargo, o rol del contratista
  objeto              TEXT,                    -- contratistas: el objeto del contrato
  proyecto            TEXT REFERENCES catalogo.proyectos(codigo),
  fecha_inicio        DATE NOT NULL,
  fecha_fin           DATE,                    -- NULL = indefinido
  valor_mensual       NUMERIC CHECK (valor_mensual IS NULL OR valor_mensual >= 0),  -- salario u honorarios del mes
  valor_total         NUMERIC CHECK (valor_total IS NULL OR valor_total >= 0),
  supervisor          TEXT,                    -- quién recibe el trabajo del contratista
  archivo             TEXT,                    -- PDF firmado (bucket talento-humano)
  estado              TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente','terminado','anulado')),
  fecha_terminacion   DATE,
  motivo_terminacion  TEXT,
  notas               TEXT,
  created_by          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contrato_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
CREATE INDEX IF NOT EXISTS idx_contratos_persona ON people.contratos (persona_id, fecha_inicio DESC);
COMMENT ON TABLE people.contratos IS
  'Contratos de cada persona. vinculacion=planta (laboral) o contratista (prestación de servicios): solo los contratistas con contrato vigente pasan cuentas de cobro.';

DROP TRIGGER IF EXISTS trg_contratos_updated ON people.contratos;
CREATE TRIGGER trg_contratos_updated BEFORE UPDATE ON people.contratos
  FOR EACH ROW EXECUTE FUNCTION people.tocar_updated_at();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — Documentos de la persona
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS people.documentos_persona (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id  UUID NOT NULL REFERENCES people.personas(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL CHECK (tipo IN ('documento_identidad','rut','certificacion_bancaria','hoja_vida',
                                            'titulo','afiliaciones','examen_medico','antecedentes','otro')),
  nombre      TEXT NOT NULL,
  ruta        TEXT NOT NULL,                   -- bucket talento-humano
  tamano      INT,
  subido_por  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documentos_persona ON people.documentos_persona (persona_id);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 4 — Datos de la organización para las plantillas
--   Una sola fila. Talento humano la llena desde la intranet: razón social,
--   NIT, dirección y quién firma los certificados.
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS people.config_talento (
  id                     INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  razon_social           TEXT,
  nit                    TEXT,
  direccion              TEXT,
  ciudad                 TEXT,
  telefono               TEXT,
  correo                 TEXT,
  firmante_nombre        TEXT,                 -- quien firma los certificados laborales
  firmante_cargo         TEXT,
  firmante_firma         TEXT CHECK (firmante_firma IS NULL OR length(firmante_firma) <= 200000),
  -- Lo que va al pie de cada cuenta de cobro (declaraciones del contratista)
  texto_cuenta_cobro     TEXT,
  updated_by             TEXT,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO people.config_talento (id, razon_social, ciudad, texto_cuenta_cobro)
VALUES (1, 'Amazonía Emprende', 'Florencia',
  'Declaro que no soy responsable del impuesto sobre las ventas (IVA) y que no he contratado ni vinculado dos o más trabajadores asociados a la actividad objeto del contrato. Declaro que he realizado los aportes al Sistema de Seguridad Social Integral correspondientes al periodo cobrado.')
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_config_talento_updated ON people.config_talento;
CREATE TRIGGER trg_config_talento_updated BEFORE UPDATE ON people.config_talento
  FOR EACH ROW EXECUTE FUNCTION people.tocar_updated_at();


-- ════════════════════════════════════════════════════════════
-- BLOQUE 5 — Cuentas de cobro
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS people.cuentas_cobro (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id       UUID NOT NULL REFERENCES people.personas(id) ON DELETE RESTRICT,
  contrato_id      UUID NOT NULL REFERENCES people.contratos(id) ON DELETE RESTRICT,
  consecutivo      INT  NOT NULL,              -- N.º de la cuenta, por persona
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  periodo_desde    DATE,
  periodo_hasta    DATE,
  concepto         TEXT NOT NULL CHECK (btrim(concepto) <> ''),
  valor            NUMERIC NOT NULL CHECK (valor > 0),
  -- Foto fija al radicar: persona (nombre, documento, banco, cuenta, contacto),
  -- contrato (número, objeto) y organización (razón social, NIT). El PDF se arma
  -- desde aquí, así que una cuenta ya radicada no cambia si cambia la ficha.
  datos            JSONB NOT NULL,
  soporte_planilla TEXT,                       -- planilla de seguridad social del periodo (bucket)
  -- radicada → aprobada → pagada; devuelta = talento humano pide corregir; anulada = no va
  estado           TEXT NOT NULL DEFAULT 'radicada'
                   CHECK (estado IN ('radicada','aprobada','devuelta','pagada','anulada')),
  observacion      TEXT,                       -- de talento humano al devolver o anular
  revisada_por     TEXT,
  revisada_at      TIMESTAMPTZ,
  pagada_at        DATE,
  radicada_por     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (persona_id, consecutivo),
  CONSTRAINT cuenta_periodo CHECK (periodo_hasta IS NULL OR periodo_desde IS NULL OR periodo_hasta >= periodo_desde)
);
CREATE INDEX IF NOT EXISTS idx_cuentas_fecha ON people.cuentas_cobro (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_cuentas_estado ON people.cuentas_cobro (estado);
COMMENT ON TABLE people.cuentas_cobro IS
  'Cuentas de cobro de contratistas. `datos` es la foto fija al radicar: el PDF se arma desde ahí. Nada se borra: se anula.';

DROP TRIGGER IF EXISTS trg_cuentas_updated ON people.cuentas_cobro;
CREATE TRIGGER trg_cuentas_updated BEFORE UPDATE ON people.cuentas_cobro
  FOR EACH ROW EXECUTE FUNCTION people.tocar_updated_at();

-- Radicar una cuenta de cobro. Toma el consecutivo con la ficha bloqueada (dos
-- envíos a la vez no repiten número) y arma la foto fija.
--   p_cuenta = {contrato_id, concepto, valor, periodo_desde, periodo_hasta, soporte_planilla}
CREATE OR REPLACE FUNCTION people.radicar_cuenta_cobro(p_email text, p_cuenta jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = people, public, pg_temp
AS $$
DECLARE
  per   people.personas;
  con   people.contratos;
  org   people.config_talento;
  v_n   int;
  v_id  uuid;
  v_val numeric := nullif(p_cuenta ->> 'valor', '')::numeric;
BEGIN
  SELECT * INTO per FROM people.personas WHERE email = lower(btrim(p_email)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes ficha en talento humano todavía.'; END IF;

  SELECT * INTO con FROM people.contratos
   WHERE id = (p_cuenta ->> 'contrato_id')::uuid AND persona_id = per.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ese contrato no es tuyo.'; END IF;
  IF con.vinculacion <> 'contratista' THEN
    RAISE EXCEPTION 'Las cuentas de cobro son para contratos de prestación de servicios.';
  END IF;
  IF con.estado <> 'vigente' THEN RAISE EXCEPTION 'El contrato no está vigente.'; END IF;
  IF coalesce(btrim(p_cuenta ->> 'concepto'), '') = '' THEN RAISE EXCEPTION 'Escribe el concepto.'; END IF;
  IF v_val IS NULL OR v_val <= 0 THEN RAISE EXCEPTION 'El valor debe ser mayor que cero.'; END IF;
  IF per.numero_documento IS NULL OR per.nombres IS NULL OR per.apellidos IS NULL THEN
    RAISE EXCEPTION 'Completa en tu ficha los nombres, apellidos y documento antes de pasar la cuenta.';
  END IF;
  IF per.banco IS NULL OR per.numero_cuenta IS NULL THEN
    RAISE EXCEPTION 'Completa en tu ficha el banco y el número de cuenta: es donde se paga.';
  END IF;

  SELECT * INTO org FROM people.config_talento WHERE id = 1;
  SELECT coalesce(max(consecutivo), 0) + 1 INTO v_n FROM people.cuentas_cobro WHERE persona_id = per.id;

  INSERT INTO people.cuentas_cobro (persona_id, contrato_id, consecutivo, periodo_desde, periodo_hasta,
                                    concepto, valor, datos, soporte_planilla, radicada_por)
  VALUES (per.id, con.id, v_n,
          nullif(p_cuenta ->> 'periodo_desde', '')::date, nullif(p_cuenta ->> 'periodo_hasta', '')::date,
          btrim(p_cuenta ->> 'concepto'), v_val,
          jsonb_build_object(
            'persona', jsonb_build_object(
              'nombres', per.nombres, 'apellidos', per.apellidos, 'tipo_documento', per.tipo_documento,
              'numero_documento', per.numero_documento, 'lugar_expedicion', per.lugar_expedicion,
              'direccion', per.direccion, 'municipio', per.municipio, 'celular', per.celular, 'email', per.email,
              'banco', per.banco, 'tipo_cuenta', per.tipo_cuenta, 'numero_cuenta', per.numero_cuenta,
              'responsable_iva', per.responsable_iva, 'firma', per.firma),
            'contrato', jsonb_build_object(
              'numero', con.numero, 'objeto', con.objeto, 'cargo', con.cargo, 'proyecto', con.proyecto,
              'fecha_inicio', con.fecha_inicio, 'fecha_fin', con.fecha_fin, 'valor_mensual', con.valor_mensual),
            'organizacion', jsonb_build_object(
              'razon_social', org.razon_social, 'nit', org.nit, 'direccion', org.direccion,
              'ciudad', org.ciudad, 'texto_cuenta_cobro', org.texto_cuenta_cobro),
            'radicada', NOW()),
          nullif(p_cuenta ->> 'soporte_planilla', ''), per.email)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'consecutivo', v_n);
END $$;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 6 — Certificados laborales expedidos
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS people.certificados (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  persona_id       UUID NOT NULL REFERENCES people.personas(id) ON DELETE RESTRICT,
  tipo             TEXT NOT NULL DEFAULT 'laboral' CHECK (tipo IN ('laboral')),
  incluye_salario  BOOLEAN NOT NULL DEFAULT FALSE,
  dirigido_a       TEXT,                        -- «A quien interese» si va vacío
  codigo           TEXT NOT NULL UNIQUE,        -- para verificar el certificado
  datos            JSONB NOT NULL,              -- foto fija de lo que se certificó
  generado_por     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_certificados_persona ON people.certificados (persona_id, created_at DESC);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 7 — Vista para el tablero de talento humano
--   Cada persona con su contrato vigente más reciente.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW people.v_personas AS
SELECT p.id, p.email, p.nombres, p.apellidos, p.tipo_documento, p.numero_documento, p.celular,
       p.foto, p.m365 ->> 'cargo' AS cargo_m365, p.activo, p.autoriza_datos, p.updated_at,
       c.id AS contrato_id, c.vinculacion, c.modalidad, c.cargo, c.proyecto, c.fecha_inicio, c.fecha_fin,
       c.valor_mensual,
       (SELECT count(*) FROM people.cuentas_cobro cc WHERE cc.persona_id = p.id AND cc.estado = 'radicada') AS cuentas_por_revisar,
       (SELECT count(*) FROM people.documentos_persona d WHERE d.persona_id = p.id) AS n_documentos
  FROM people.personas p
  LEFT JOIN LATERAL (
    SELECT * FROM people.contratos c
     WHERE c.persona_id = p.id AND c.estado = 'vigente'
     ORDER BY c.fecha_inicio DESC LIMIT 1
  ) c ON TRUE;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 8 — Bucket privado
--   Contratos firmados, documentos de las personas y planillas de seguridad
--   social. Solo el servidor de la intranet (service_role) sube y firma URLs.
-- ════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('talento-humano', 'talento-humano', false)
ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- BLOQUE 9 — RLS y permisos: solo service_role
-- ════════════════════════════════════════════════════════════

ALTER TABLE people.personas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE people.contratos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE people.documentos_persona  ENABLE ROW LEVEL SECURITY;
ALTER TABLE people.config_talento      ENABLE ROW LEVEL SECURITY;
ALTER TABLE people.cuentas_cobro       ENABLE ROW LEVEL SECURITY;
ALTER TABLE people.certificados        ENABLE ROW LEVEL SECURITY;

GRANT ALL ON people.personas, people.contratos, people.documentos_persona, people.config_talento,
             people.cuentas_cobro, people.certificados, people.v_personas TO service_role;
REVOKE ALL ON people.personas, people.contratos, people.documentos_persona, people.config_talento,
              people.cuentas_cobro, people.certificados, people.v_personas FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION people.radicar_cuenta_cobro(text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION people.radicar_cuenta_cobro(text, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION people.tocar_updated_at() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr
-- ============================================================
--  select to_regclass('people.personas'), to_regclass('people.cuentas_cobro');   -- no NULL
--  select * from people.config_talento;                -- 1 fila: llenar NIT y firmante desde la intranet
--  select id, public from storage.buckets where id = 'talento-humano';   -- public = false
--  Con la key anon, por REST, people.personas NO debe responder datos (401/42501).
-- ============================================================
