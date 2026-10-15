-- ============================================================
-- Reporte de carbono — polígonos de conservación y restauración
-- Tabla geo.reporte_carbono + vista geo.v_reporte_carbono_nucleos
-- Schema: geo (transversal)   ·   Fecha: 2026-10-10
--
-- Motivo: el geoportal público va a mostrar dos tableros —Conservación y
-- Restauración— con sus núcleos, los polígonos de cada uno y las tCO2e
-- (avance a 2026 y horizonte completo). La fuente es el shapefile
-- «Reporte_tco2_2026» que entrega el SIG: 34 polígonos, 7 núcleos.
--
-- Por qué una tabla propia y no columnas en ras.familias / siembra.familias:
--   · Es UNA capa que cruza los dos dominios. Meterla en ras.* o en siembra.*
--     obligaba a partirla, y a fusionar lo que se decidió no fusionar.
--   · Tres predios de restauración (Conexión Nativa) no existían en core. El
--     seed 2 los crea como PREREGISTRO (propietario «Por completar») y sus
--     polígonos quedan enlazados; el enlace sigue siendo opcional por si un
--     corte futuro trae un predio que todavía no se pueda registrar.
--   · No pisa nada: las familias que ya tienen su shapefile de conservación
--     en Storage lo conservan tal cual.
-- La tabla solo REFERENCIA a ras.familias y core.predios (ambas opcionales):
-- no copia fichas ni reemplaza a ninguna de las dos.
--
-- Cada entrega del SIG es un «corte» (hoy '2026'). Un corte nuevo se carga al
-- lado del anterior; no lo borra.
--
-- REGLA DEL PROYECTO: este .sql lo corre el USUARIO en el SQL Editor. El
-- asistente no ejecuta DDL. Todas las sentencias son repetibles. Después de
-- este archivo se corren los cinco seed_reporte_carbono_2026_*.sql, en orden.
-- ============================================================


-- ── 1. Tabla ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS geo.reporte_carbono (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  corte          TEXT NOT NULL DEFAULT '2026',
  -- Código del polígono dentro del corte: CON-PIE-01, RES-CB-03…
  cod_pol        TEXT NOT NULL,

  tablero        TEXT NOT NULL CHECK (tablero IN ('conservacion','restauracion')),
  -- Núcleo (conservación) o actividad (restauración): es el ítem del menú.
  nucleo         TEXT NOT NULL,

  -- Como viene en el shapefile. En conservación suele ser el NOMBRE DE UNA
  -- PERSONA: no se manda al geoportal público (ahí va finca o vereda).
  predio         TEXT NOT NULL,
  finca          TEXT,
  vereda         TEXT,
  municipio      TEXT,
  departamento   TEXT,

  area_ha        NUMERIC(12,2),
  anio_inicio    INT,
  anio_fin       INT,           -- fin del periodo de capitalización
  -- Negativo = mitigación o secuestro; positivo = emisión neta. Se muestra tal cual.
  tco2_2026      NUMERIC(12,2),
  tco2_horizonte NUMERIC(12,2),

  n_semilleros   INT,           -- conservación
  n_especies     INT,
  n_sembrados    INT,           -- restauración
  n_especies_sembradas INT,

  -- Enlaces opcionales a las fichas que ya existen. Si la ficha se borra, el
  -- polígono queda (SET NULL): es un reporte, no depende de ella.
  ras_familia_id UUID REFERENCES ras.familias(id) ON DELETE SET NULL,
  predio_id      UUID REFERENCES core.predios(id) ON DELETE SET NULL,

  geom           geometry(MultiPolygon, 4326) NOT NULL,

  created_by     TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT reporte_carbono_corte_cod_uq UNIQUE (corte, cod_pol)
);

COMMENT ON TABLE geo.reporte_carbono IS
  'Polígonos de conservación y restauración con su carbono (tCO2e a 2026 y a horizonte), tal como los entrega el SIG en cada corte. Alimenta los tableros del geoportal público. Referencia opcional a ras.familias y core.predios; no reemplaza a ninguna.';
COMMENT ON COLUMN geo.reporte_carbono.predio IS
  'Nombre tal como viene en el shapefile. En conservación suele ser el de una persona: no exponerlo en el geoportal público.';

CREATE INDEX IF NOT EXISTS idx_reporte_carbono_geom    ON geo.reporte_carbono USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_reporte_carbono_nucleo  ON geo.reporte_carbono (corte, tablero, nucleo);
CREATE INDEX IF NOT EXISTS idx_reporte_carbono_familia ON geo.reporte_carbono (ras_familia_id);
CREATE INDEX IF NOT EXISTS idx_reporte_carbono_predio  ON geo.reporte_carbono (predio_id);


-- ── 2. Vista: una fila por núcleo (los filtros y el panel de resumen) ───────
-- Las especies no se suman entre predios (la misma especie se repite), así que
-- la vista da el máximo por polígono y no un total que sería falso.
DROP VIEW IF EXISTS geo.v_reporte_carbono_nucleos;
CREATE VIEW geo.v_reporte_carbono_nucleos
WITH (security_invoker = true) AS
SELECT
  corte,
  tablero,
  nucleo,
  COUNT(*)::int                                   AS n_poligonos,
  COUNT(DISTINCT predio)::int                     AS n_predios,
  SUM(area_ha)::numeric(12,2)                     AS area_ha,
  SUM(tco2_2026)::numeric(12,2)                   AS tco2_2026,
  SUM(tco2_horizonte)::numeric(12,2)              AS tco2_horizonte,
  MIN(anio_inicio)                                AS anio_inicio,
  MAX(anio_fin)                                   AS anio_fin,
  SUM(n_semilleros)::int                          AS n_semilleros,
  SUM(n_sembrados)::int                           AS n_sembrados,
  MAX(n_especies)                                 AS max_especies_por_poligono,
  MAX(n_especies_sembradas)                       AS max_especies_sembradas,
  ARRAY_AGG(DISTINCT municipio ORDER BY municipio) AS municipios,
  ARRAY_AGG(DISTINCT departamento ORDER BY departamento) AS departamentos
FROM geo.reporte_carbono
GROUP BY corte, tablero, nucleo;

COMMENT ON VIEW geo.v_reporte_carbono_nucleos IS
  'Resumen por núcleo del reporte de carbono: es la lista de filtros de cada tablero y los totales de su panel.';


-- ── 3. RLS + grants ─────────────────────────────────────────────────────────
-- La intranet lee con sesión; el geoportal lee desde su servidor con
-- service_role y decide qué columnas publica. anon no entra: la columna
-- «predio» trae nombres de personas.
ALTER TABLE geo.reporte_carbono ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "geo_reporte_carbono_select" ON geo.reporte_carbono;
CREATE POLICY "geo_reporte_carbono_select" ON geo.reporte_carbono
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON geo.reporte_carbono           FROM anon;
REVOKE ALL ON geo.v_reporte_carbono_nucleos FROM anon;
GRANT SELECT ON geo.reporte_carbono           TO authenticated;
GRANT SELECT ON geo.v_reporte_carbono_nucleos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON geo.reporte_carbono TO service_role;
GRANT SELECT ON geo.v_reporte_carbono_nucleos TO service_role;


-- ── 4. Verificación tras correr ─────────────────────────────────────────────
-- Tiene que devolver 0 filas y no dar error:
--   select * from geo.v_reporte_carbono_nucleos;
-- Después de los seed, tiene que devolver 7 filas (4 de conservación, 3 de
-- restauración) que suman 34 polígonos y 707,89 ha.
