-- ════════════════════════════════════════════════════════════
-- Fechas por defecto en hora de Colombia
-- 2026-10-14
-- ════════════════════════════════════════════════════════════
--
-- CURRENT_DATE en Supabase es la fecha en UTC: de 7 p. m. a medianoche en
-- Colombia ya es «mañana». Una cuenta de cobro radicada la noche del 31 quedaba
-- con fecha del 1 del mes siguiente: otro mes en la bandeja de talento humano,
-- en el filtro por fechas y en el encabezado del PDF.
--
-- people.radicar_cuenta_cobro no recibe fecha: la pone este valor por defecto.
-- En inventario.movimientos la intranet y la app de campo ya mandan la fecha;
-- se corrige igual para lo que llegue sin ella.
--
-- Solo cambia el valor por defecto: no toca filas existentes. Se puede correr
-- más de una vez.

ALTER TABLE people.cuentas_cobro
  ALTER COLUMN fecha SET DEFAULT ((now() AT TIME ZONE 'America/Bogota')::date);

ALTER TABLE inventario.movimientos
  ALTER COLUMN fecha SET DEFAULT ((now() AT TIME ZONE 'America/Bogota')::date);

-- Verificación (debe mostrar las dos columnas con America/Bogota):
-- SELECT table_schema, table_name, column_default
--   FROM information_schema.columns
--  WHERE (table_schema, table_name, column_name) IN (('people', 'cuentas_cobro', 'fecha'),
--                                                    ('inventario', 'movimientos', 'fecha'));
