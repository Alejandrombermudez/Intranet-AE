-- ============================================================
--  MIGRACIÓN (datos): una sola escritura por municipio, vereda y zona AE
--  Archivo: docs/sql/migration_normalizar_ubicaciones.sql
--  Fecha  : 2026-09-18   ·   GENERADO por scripts/generar-sql-ubicaciones.mjs
--
--  QUÉ ARREGLA
--    Los filtros del tablero SIG mostraban el mismo lugar dos veces
--    ("MORELIA" y "Morelia"), porque el valor se guardaba como llegara.
--    Aquí se reescribe lo que ya está en core.predios a la forma canónica
--    (Tipo Título en español) que ahora aplican también las rutas de
--    jurídica al guardar — lib/veredas-caqueta.ts. Sin eso, el problema
--    vuelve con el siguiente predio que se capture.
--
--  NO cambia el esquema: son UPDATE de texto. Nada se borra y ningún
--  predio cambia de municipio: solo cambia cómo está escrito.
--
--  Valores distintos, antes → después:
--    municipio : 6 → 4
--    vereda    : 47 → 42
--    zona_ae   : 5 → 4
--
--  Antes de correr, para ver lo mismo desde la base:
--    select municipio, count(*) from core.predios group by 1 order by 1;
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Vereda — 16 escritura(s) por corregir
--    (la clave incluye el municipio ACTUAL: por eso este bloque va antes que el 2)
-- ────────────────────────────────────────────────────────────
UPDATE core.predios SET vereda = 'El Carmen Km36/Bodoquero' WHERE vereda = 'El carmen km36/Bodoquero' AND municipio = 'Florencia';   -- 1 predio(s)
UPDATE core.predios SET vereda = 'La Primavera, San Cristobal Bajo y el Reflejo' WHERE vereda = 'La primavera, San cristobal bajo y el reflejo' AND municipio = 'Florencia';   -- 1 predio(s)
UPDATE core.predios SET vereda = 'La Viciosa' WHERE vereda = 'La viciosa' AND municipio = 'Florencia';   -- 3 predio(s)
UPDATE core.predios SET vereda = 'Vuelta del Gallo' WHERE vereda = 'Vuelta del gallo' AND municipio = 'Florencia';   -- 1 predio(s)
UPDATE core.predios SET vereda = 'Albano' WHERE vereda = 'ALBANO' AND municipio = 'MORELIA';   -- 2 predio(s)
UPDATE core.predios SET vereda = 'Bajo Delicias' WHERE vereda = 'Bajo delicias.' AND municipio = 'Morelia';   -- 1 predio(s)
UPDATE core.predios SET vereda = 'Bocagrande Aguacaliente' WHERE vereda = 'Bocagrande aguacaliente' AND municipio = 'Morelia';   -- 2 predio(s)
UPDATE core.predios SET vereda = 'Bocana Aguacaliente' WHERE vereda = 'BOCANA AGUACALIENTE' AND municipio = 'MORELIA';   -- 1 predio(s)
UPDATE core.predios SET vereda = 'Buenos Aires' WHERE vereda = 'BUENOS AIRES' AND municipio = 'MORELIA';   -- 1 predio(s)
UPDATE core.predios SET vereda = 'Campo Alegre' WHERE vereda = 'Campo Alegre.' AND municipio = 'Morelia';   -- 1 predio(s)
UPDATE core.predios SET vereda = 'Delicias' WHERE vereda = 'DELICIAS' AND municipio = 'MORELIA';   -- 1 predio(s)
UPDATE core.predios SET vereda = 'La Viciosa' WHERE vereda = 'La viciosa' AND municipio = 'Morelia';   -- 1 predio(s)
UPDATE core.predios SET vereda = 'Rochela Alta' WHERE vereda = 'Rochela alta' AND municipio = 'Morelia';   -- 1 predio(s)
UPDATE core.predios SET vereda = 'Rochela Alta' WHERE vereda = 'ROCHELA ALTA' AND municipio = 'MORELIA';   -- 1 predio(s)
UPDATE core.predios SET vereda = 'Rochela Alta/Santa Rosa' WHERE vereda = 'Rochela alta/Santa Rosa' AND municipio = 'Morelia';   -- 2 predio(s)
UPDATE core.predios SET vereda = 'Santa Rosa' WHERE vereda = 'Santa rosa' AND municipio = 'Morelia';   -- 2 predio(s)

-- ────────────────────────────────────────────────────────────
-- 2. Municipio — 3 escritura(s) por corregir
-- ────────────────────────────────────────────────────────────
UPDATE core.predios SET municipio = 'Florencia' WHERE municipio = 'FLORENCIA';   -- 4 predio(s)
UPDATE core.predios SET municipio = 'Morelia' WHERE municipio = 'MORELIA';   -- 9 predio(s)
UPDATE core.predios SET municipio = 'Solano' WHERE municipio = 'SOLANO';   -- 1 predio(s)

-- ────────────────────────────────────────────────────────────
-- 3. Zona AE — 2 escritura(s) por corregir
-- ────────────────────────────────────────────────────────────
UPDATE core.predios SET zona_ae = 'Buenos Aires' WHERE zona_ae = 'BUENOS AIRES';   -- 1 predio(s)
UPDATE core.predios SET zona_ae = 'Lácteos del Hogar' WHERE zona_ae = 'Lácteos del hogar';   -- 1 predio(s)

COMMIT;

-- ============================================================
--  Verificación tras correr
-- ============================================================
--  select municipio, count(*) from core.predios group by 1 order by 1;
--    → 4 filas (antes 6), sin pares que solo cambien de mayúsculas
--  select zona_ae, count(*) from core.predios where zona_ae is not null group by 1 order by 1;
--    → 4 filas (antes 5)
--  select municipio, vereda, count(*) from core.predios where vereda is not null group by 1,2 order by 1,2;
--    → 42 veredas distintas (antes 47)
