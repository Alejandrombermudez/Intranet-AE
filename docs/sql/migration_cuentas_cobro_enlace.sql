-- ============================================================
--  CUENTAS DE COBRO POR ENLACE — operarios y contratistas sin correo
--  2026-11-18
-- ============================================================
--  Hasta hoy solo pasaba cuenta de cobro quien entra a «Mi espacio» con correo
--  @amazoniaemprende.com y tiene contrato de contratista cargado. Los operarios
--  y muchos contratistas no tienen correo, y otros todavía no están en talento
--  humano. Esta migración abre un ENLACE (/cuenta-cobro?c=<clave>) donde la
--  persona llena sus datos, firma con el dedo y envía. La cuenta llega a la
--  misma bandeja de talento humano.
--
--  1. people.personas.email deja de ser obligatorio: una persona puede existir
--     solo con su cédula. Se reconoce por el número de documento (ya había un
--     índice único sobre él). Si después le cargan correo, es la misma ficha.
--  2. La cuenta de cobro puede no tener contrato (contrato_id NULL) y guarda de
--     dónde vino (origen), el proyecto y el municipio.
--  3. people.config_talento.clave_enlace: la clave que va en el enlace. Sin ella
--     el formulario no recibe nada. Talento humano la cambia desde Plantillas.
--  4. people.radicar_cuenta_enlace(jsonb): busca o crea la persona por cédula y
--     radica. NUNCA sobrescribe la ficha: llena solo lo vacío y, si lo que
--     escribieron (banco, número de cuenta, nombre…) no coincide con lo
--     guardado, lo anota en datos.diferencias para que la bandeja lo avise. Así
--     nadie cambia a dónde se le paga a otra persona sabiendo su cédula.
--  5. people.radicar_cuenta_cobro (la de Mi espacio) recibe además la firma
--     hecha con el dedo y el proyecto.
--
--  Idempotente: se puede correr dos veces. Cada sentencia por su cuenta (el
--  editor de Supabase no respeta BEGIN/COMMIT).
-- ============================================================

-- 1. Personas sin correo ------------------------------------------------------
ALTER TABLE people.personas ALTER COLUMN email DROP NOT NULL;
ALTER TABLE people.personas ADD COLUMN IF NOT EXISTS registrada_por_enlace BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN people.personas.registrada_por_enlace IS
  'La ficha la creó el enlace público de cuentas de cobro (persona sin correo corporativo).';

-- 2. Cuentas sin contrato, con origen, proyecto y municipio --------------------
ALTER TABLE people.cuentas_cobro ALTER COLUMN contrato_id DROP NOT NULL;
ALTER TABLE people.cuentas_cobro ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'intranet';
ALTER TABLE people.cuentas_cobro DROP CONSTRAINT IF EXISTS cuentas_cobro_origen_check;
ALTER TABLE people.cuentas_cobro ADD CONSTRAINT cuentas_cobro_origen_check CHECK (origen IN ('intranet', 'enlace'));
ALTER TABLE people.cuentas_cobro ADD COLUMN IF NOT EXISTS proyecto TEXT;
ALTER TABLE people.cuentas_cobro ADD COLUMN IF NOT EXISTS municipio TEXT;
CREATE INDEX IF NOT EXISTS idx_cuentas_persona ON people.cuentas_cobro (persona_id, consecutivo DESC);

-- 3. La clave del enlace -------------------------------------------------------
ALTER TABLE people.config_talento ADD COLUMN IF NOT EXISTS clave_enlace TEXT;
UPDATE people.config_talento SET clave_enlace = substr(md5(random()::text || clock_timestamp()::text), 1, 10)
 WHERE id = 1 AND clave_enlace IS NULL;

-- 4. Radicar desde el enlace ---------------------------------------------------
--   p = {tipo_documento, numero_documento, lugar_expedicion, nombres, apellidos,
--        celular, direccion, municipio, correo, banco, tipo_cuenta, numero_cuenta,
--        concepto, valor, periodo_desde, periodo_hasta, proyecto, firma,
--        soporte_planilla, ip}
--   La clave del enlace la revisa la ruta antes de llamar.
CREATE OR REPLACE FUNCTION people.radicar_cuenta_enlace(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = people, public, pg_temp
AS $$
DECLARE
  per    people.personas;
  con    people.contratos;
  org    people.config_talento;
  -- Sin puntos ni espacios, como lo guarda la ficha (limpiarFicha); el pasaporte puede llevar letras.
  v_doc  text := upper(regexp_replace(coalesce(p ->> 'numero_documento', ''), '[^0-9A-Za-z]', '', 'g'));
  v_val  numeric := nullif(p ->> 'valor', '')::numeric;
  v_n    int;
  v_id   uuid;
  v_nueva boolean := false;
  v_dif  jsonb := '[]'::jsonb;
  v_tipo text := coalesce(nullif(p ->> 'tipo_documento', ''), 'CC');
  v_tcta text := nullif(p ->> 'tipo_cuenta', '');
  t      text;
BEGIN
  IF length(v_doc) < 5 THEN RAISE EXCEPTION 'Escriba su número de documento.'; END IF;
  IF coalesce(btrim(p ->> 'nombres'), '') = '' OR coalesce(btrim(p ->> 'apellidos'), '') = '' THEN
    RAISE EXCEPTION 'Escriba sus nombres y apellidos.';
  END IF;
  IF coalesce(btrim(p ->> 'concepto'), '') = '' THEN RAISE EXCEPTION 'Escriba el concepto.'; END IF;
  IF v_val IS NULL OR v_val <= 0 THEN RAISE EXCEPTION 'El valor debe ser mayor que cero.'; END IF;
  IF coalesce(btrim(p ->> 'banco'), '') = '' OR coalesce(btrim(p ->> 'numero_cuenta'), '') = '' THEN
    RAISE EXCEPTION 'Escriba el banco y el número de cuenta: es donde se le paga.';
  END IF;
  IF coalesce(p ->> 'firma', '') !~ '^data:image/png;base64,' THEN RAISE EXCEPTION 'Falta la firma.'; END IF;
  IF v_tcta IS NOT NULL AND v_tcta NOT IN ('ahorros', 'corriente', 'deposito_electronico') THEN v_tcta := NULL; END IF;
  IF v_tipo NOT IN ('CC','CE','TI','PEP','PPT','PA') THEN v_tipo := 'CC'; END IF;

  SELECT * INTO per FROM people.personas WHERE numero_documento = v_doc FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO people.personas (tipo_documento, numero_documento, lugar_expedicion, nombres, apellidos,
                                 celular, direccion, municipio, correo_personal, banco, tipo_cuenta, numero_cuenta,
                                 firma, autoriza_datos, autoriza_at, autoriza_version, registrada_por_enlace, created_by)
    VALUES (v_tipo, v_doc, nullif(btrim(p ->> 'lugar_expedicion'), ''), btrim(p ->> 'nombres'), btrim(p ->> 'apellidos'),
            nullif(btrim(p ->> 'celular'), ''), nullif(btrim(p ->> 'direccion'), ''), nullif(btrim(p ->> 'municipio'), ''),
            nullif(lower(btrim(p ->> 'correo')), ''), btrim(p ->> 'banco'), v_tcta, btrim(p ->> 'numero_cuenta'),
            p ->> 'firma', true, now(), 'enlace-cuenta-cobro-2026-11', true, 'enlace')
    RETURNING * INTO per;
    v_nueva := true;
  ELSE
    -- Lo que ya está guardado no se toca; se anota lo que no coincide.
    FOREACH t IN ARRAY ARRAY['nombres','apellidos','banco','numero_cuenta','tipo_cuenta'] LOOP
      IF nullif(btrim(p ->> t), '') IS NOT NULL AND to_jsonb(per) ->> t IS NOT NULL
         AND lower(regexp_replace(to_jsonb(per) ->> t, '\s', '', 'g')) <> lower(regexp_replace(p ->> t, '\s', '', 'g')) THEN
        v_dif := v_dif || jsonb_build_object('campo', t, 'guardado', to_jsonb(per) ->> t, 'escrito', btrim(p ->> t));
      END IF;
    END LOOP;
    UPDATE people.personas SET
      lugar_expedicion = coalesce(lugar_expedicion, nullif(btrim(p ->> 'lugar_expedicion'), '')),
      celular          = coalesce(celular, nullif(btrim(p ->> 'celular'), '')),
      direccion        = coalesce(direccion, nullif(btrim(p ->> 'direccion'), '')),
      municipio        = coalesce(municipio, nullif(btrim(p ->> 'municipio'), '')),
      correo_personal  = coalesce(correo_personal, nullif(lower(btrim(p ->> 'correo')), '')),
      banco            = coalesce(banco, btrim(p ->> 'banco')),
      tipo_cuenta      = coalesce(tipo_cuenta, v_tcta),
      numero_cuenta    = coalesce(numero_cuenta, btrim(p ->> 'numero_cuenta')),
      autoriza_datos   = true,
      autoriza_at      = coalesce(autoriza_at, now()),
      autoriza_version = coalesce(autoriza_version, 'enlace-cuenta-cobro-2026-11'),
      updated_by       = 'enlace'
     WHERE id = per.id;
  END IF;

  -- Si tiene contrato de contratista vigente, la cuenta va contra él.
  SELECT * INTO con FROM people.contratos
   WHERE persona_id = per.id AND vinculacion = 'contratista' AND estado = 'vigente'
   ORDER BY fecha_inicio DESC LIMIT 1;

  SELECT * INTO org FROM people.config_talento WHERE id = 1;
  SELECT coalesce(max(consecutivo), 0) + 1 INTO v_n FROM people.cuentas_cobro WHERE persona_id = per.id;

  INSERT INTO people.cuentas_cobro (persona_id, contrato_id, consecutivo, fecha, periodo_desde, periodo_hasta,
                                    concepto, valor, datos, soporte_planilla, radicada_por, origen, proyecto, municipio)
  VALUES (per.id, con.id, v_n, (now() AT TIME ZONE 'America/Bogota')::date,
          nullif(p ->> 'periodo_desde', '')::date, nullif(p ->> 'periodo_hasta', '')::date,
          btrim(p ->> 'concepto'), v_val,
          jsonb_build_object(
            -- La cuenta lleva lo que la persona escribió y firmó en el enlace.
            'persona', jsonb_build_object(
              'nombres', btrim(p ->> 'nombres'), 'apellidos', btrim(p ->> 'apellidos'), 'tipo_documento', v_tipo,
              'numero_documento', v_doc, 'lugar_expedicion', nullif(btrim(p ->> 'lugar_expedicion'), ''),
              'direccion', nullif(btrim(p ->> 'direccion'), ''), 'municipio', nullif(btrim(p ->> 'municipio'), ''),
              'celular', nullif(btrim(p ->> 'celular'), ''), 'email', nullif(lower(btrim(p ->> 'correo')), ''),
              'banco', btrim(p ->> 'banco'), 'tipo_cuenta', v_tcta, 'numero_cuenta', btrim(p ->> 'numero_cuenta'),
              'responsable_iva', coalesce(per.responsable_iva, false), 'firma', p ->> 'firma'),
            'contrato', CASE WHEN con.id IS NULL THEN NULL ELSE jsonb_build_object(
              'numero', con.numero, 'objeto', con.objeto, 'cargo', con.cargo, 'proyecto', con.proyecto,
              'fecha_inicio', con.fecha_inicio, 'fecha_fin', con.fecha_fin, 'valor_mensual', con.valor_mensual) END,
            'organizacion', jsonb_build_object(
              'razon_social', org.razon_social, 'nit', org.nit, 'direccion', org.direccion,
              'ciudad', org.ciudad, 'texto_cuenta_cobro', org.texto_cuenta_cobro),
            'radicada', now(),
            'firmada', now(),
            'ip', nullif(p ->> 'ip', ''),
            'persona_nueva', v_nueva,
            'diferencias', v_dif),
          nullif(p ->> 'soporte_planilla', ''), 'enlace', 'enlace',
          coalesce(nullif(btrim(p ->> 'proyecto'), ''), (SELECT pr.nombre FROM catalogo.proyectos pr WHERE pr.codigo = con.proyecto), con.proyecto), nullif(btrim(p ->> 'municipio'), ''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'consecutivo', v_n, 'persona_id', per.id, 'persona_nueva', v_nueva);
END $$;

REVOKE EXECUTE ON FUNCTION people.radicar_cuenta_enlace(jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION people.radicar_cuenta_enlace(jsonb) TO service_role;

-- 5. Mi espacio: firma con el dedo y proyecto ----------------------------------
--   p_cuenta = {contrato_id, concepto, valor, periodo_desde, periodo_hasta,
--               soporte_planilla, proyecto, firma}
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
  v_firma text := CASE WHEN coalesce(p_cuenta ->> 'firma', '') ~ '^data:image/png;base64,' THEN p_cuenta ->> 'firma' END;
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
  IF v_firma IS NULL AND per.firma IS NULL THEN RAISE EXCEPTION 'Falta la firma.'; END IF;

  SELECT * INTO org FROM people.config_talento WHERE id = 1;
  SELECT coalesce(max(consecutivo), 0) + 1 INTO v_n FROM people.cuentas_cobro WHERE persona_id = per.id;

  INSERT INTO people.cuentas_cobro (persona_id, contrato_id, consecutivo, fecha, periodo_desde, periodo_hasta,
                                    concepto, valor, datos, soporte_planilla, radicada_por, origen, proyecto, municipio)
  VALUES (per.id, con.id, v_n, (now() AT TIME ZONE 'America/Bogota')::date,
          nullif(p_cuenta ->> 'periodo_desde', '')::date, nullif(p_cuenta ->> 'periodo_hasta', '')::date,
          btrim(p_cuenta ->> 'concepto'), v_val,
          jsonb_build_object(
            'persona', jsonb_build_object(
              'nombres', per.nombres, 'apellidos', per.apellidos, 'tipo_documento', per.tipo_documento,
              'numero_documento', per.numero_documento, 'lugar_expedicion', per.lugar_expedicion,
              'direccion', per.direccion, 'municipio', per.municipio, 'celular', per.celular, 'email', per.email,
              'banco', per.banco, 'tipo_cuenta', per.tipo_cuenta, 'numero_cuenta', per.numero_cuenta,
              'responsable_iva', per.responsable_iva, 'firma', coalesce(v_firma, per.firma)),
            'contrato', jsonb_build_object(
              'numero', con.numero, 'objeto', con.objeto, 'cargo', con.cargo, 'proyecto', con.proyecto,
              'fecha_inicio', con.fecha_inicio, 'fecha_fin', con.fecha_fin, 'valor_mensual', con.valor_mensual),
            'organizacion', jsonb_build_object(
              'razon_social', org.razon_social, 'nit', org.nit, 'direccion', org.direccion,
              'ciudad', org.ciudad, 'texto_cuenta_cobro', org.texto_cuenta_cobro),
            'radicada', now(),
            'firmada', CASE WHEN v_firma IS NOT NULL THEN now() END),
          nullif(p_cuenta ->> 'soporte_planilla', ''), per.email, 'intranet',
          coalesce(nullif(btrim(p_cuenta ->> 'proyecto'), ''), (SELECT pr.nombre FROM catalogo.proyectos pr WHERE pr.codigo = con.proyecto), con.proyecto), per.municipio)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'consecutivo', v_n);
END $$;

REVOKE EXECUTE ON FUNCTION people.radicar_cuenta_cobro(text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION people.radicar_cuenta_cobro(text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ============================================================
--  Verificación tras correr
-- ============================================================
--  select clave_enlace from people.config_talento;            -- 10 caracteres, no NULL
--  select column_name, is_nullable from information_schema.columns
--   where table_schema = 'people' and table_name = 'personas' and column_name = 'email';     -- YES
--  select origen, proyecto, municipio from people.cuentas_cobro limit 1;                       -- no falla
--  Con la key anon, por REST, people.radicar_cuenta_enlace NO debe poder llamarse (401/42501).
-- ============================================================
