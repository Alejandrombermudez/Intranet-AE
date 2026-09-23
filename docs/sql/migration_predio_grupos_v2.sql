-- ============================================================
--  MIGRACIÓN: predio_grupos v2 — quitar el EXECUTE que Postgres da a PUBLIC
--  Archivo: docs/sql/migration_predio_grupos_v2.sql
--
--  ⚠ YA VA INCLUIDO en migration_decision_sig.sql (PARTE 3, 2026-09-23):
--    no hace falta correr este archivo aparte. Se deja por su explicación.
--  Fecha  : 2026-09-19
--  Requiere: migration_predio_grupos.sql ejecutado (2026-09-17).
--
--  QUÉ PASA HOY
--    Postgres concede EXECUTE a PUBLIC en cada función nueva, y un
--    `GRANT EXECUTE ... TO authenticated, service_role` NO revoca eso. Verificado
--    por REST el 2026-09-19: con la key `anon` (la que viaja al navegador),
--    `core.fusionar_predios` **se ejecuta** — responde P0001 "Alguno de los
--    predios no existe", que es el RAISE de la propia función.
--
--  NO ES UN HUECO ABIERTO — hay dos barreras detrás, ambas comprobadas:
--    1. La función no es SECURITY DEFINER: por dentro corre como `anon`, y la
--       RLS de core.predios (policy solo TO authenticated) le devuelve 0 filas,
--       así que la validación "¿existen los predios?" aborta SIEMPRE, con
--       cualquier uuid real.
--    2. `anon` no tiene INSERT/UPDATE en core.predio_grupos ni en
--       core.predio_grupo_miembros (42501 permission denied).
--
--  POR QUÉ CERRARLO IGUAL
--    Es la barrera que no depende de que nadie se equivoque después: el día que
--    alguien agregue una policy para `anon` o marque la función SECURITY
--    DEFINER, el hueco se abre solo. Y estas dos funciones ESCRIBEN y solo las
--    llama la intranet desde el servidor (service_role) — nadie más las
--    necesita. Va en la misma línea del endurecimiento del 2026-09-14
--    (autorizar por token, no por lo que mande el cliente).
--
--    Lo único que queda expuesto sin esto es el mensaje de error, que dice si
--    un uuid de predio existe o no. Poco, pero gratis de cerrar.
-- ============================================================

REVOKE EXECUTE ON FUNCTION core.fusionar_predios(uuid[], uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION core.disolver_grupo(uuid, text)                       FROM PUBLIC;

-- Se vuelven a conceder explícitamente a quien sí las usa (el REVOKE a PUBLIC
-- no toca estos grants, pero quedan escritos para que se lea de una vez quién
-- puede): la intranet llama por service_role desde las API routes.
GRANT EXECUTE ON FUNCTION core.fusionar_predios(uuid[], uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION core.disolver_grupo(uuid, text)                       TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';


-- ============================================================
--  Verificación tras correr
-- ============================================================
--  Con la key anon, llamar al RPC debe dar 401/403 (permission denied for
--  function), ya no P0001:
--    curl -s -X POST "$URL/rest/v1/rpc/fusionar_predios" \
--      -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--      -H "Content-Profile: core" -H "Content-Type: application/json" \
--      -d '{"p_predio_ids":["00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002"],"p_principal":"00000000-0000-0000-0000-000000000001"}'
--
--  Y desde SQL:
--    select has_function_privilege('anon', 'core.fusionar_predios(uuid[],uuid,text,text,text)', 'execute');  -- false
--    select has_function_privilege('service_role', 'core.fusionar_predios(uuid[],uuid,text,text,text)', 'execute');  -- true
--
--  OJO: el mismo patrón (EXECUTE a PUBLIC por defecto) lo tienen las funciones
--  de geo escritas antes — geo.crear_zona, geo.crear_zona_union, geo.abrir_lote,
--  geo.cerrar_lote. Ahí la barrera también son los GRANT de tabla, y
--  geo.revisar_zona SÍ debe quedar abierta a anon (la llama el celular). No se
--  toca aquí: es una revisión aparte, no una consecuencia de esta migración.
