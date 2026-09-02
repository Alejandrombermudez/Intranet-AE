-- ============================================================
-- Unificar propietarios duplicados en core.aliados
-- Escrito: 2026-09-01 · Ejecutar a mano en Supabase → SQL Editor
--
-- ESTADO: BLOQUE 1 ya ejecutado (2026-09-01, verificado por REST: 94 aliados,
--   los dos predios San Francisco bajo un solo propietario). Volver a correrlo
--   no rompe nada — los UPDATE/DELETE ya no encuentran filas — pero no hace
--   falta. BLOQUE 2 sigue pendiente de tu decisión. BLOQUE 3 es solo lectura.
--
-- CONTEXTO — qué se encontró al revisar los 95 aliados de producción:
--
--   · NO hay propietarios repetidos 2 o 3 veces en core.aliados.
--     Lo que se ve repetido en el listado de Jurídica es la MISMA persona con
--     VARIOS PREDIOS: una ficha por predio (Edilberto Lozano Vargas y Luis
--     Felipe Florez tienen 3 cada uno). Cada predio tiene su propia matrícula
--     inmobiliaria — borrarlos perdería predios reales. La tarjeta del listado
--     ahora muestra el nombre del predio y la matrícula para distinguirlos.
--
--   · Duplicado REAL: "Álvaro Marlés Artunduaga" y "Álvaro Marlés Artunduaga 2".
--     Son la misma persona, cargada dos veces para poder colgarle dos predios
--     (San Francisco Lote 1 y Lote 2, matrículas 420-109277 y 420-109278).
--     BLOQUE 1 los une: los dos predios quedan bajo un solo propietario.
--
--   · Ficha sin ningún predio: "Rodrigo Silva Hermida" (CC 17638410).
--     BLOQUE 2, comentado — decide si se borra o si le falta cargarle el predio.
--
-- NADA de esto es DDL: son UPDATE/DELETE de datos. Aun así, corre primero las
-- verificaciones de cada bloque y confirma que devuelven lo esperado.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOQUE 1 — Unir "Álvaro Marlés Artunduaga" + "… 2"
-- ════════════════════════════════════════════════════════════
--   SE CONSERVA : ce4ef582-75f5-4422-b289-1f7af09de4c3  (nombre sin el "2")
--   SE ELIMINA  : 31334f00-9a76-46e3-845d-3c04bf16518f  (tras mover su predio)
--
-- Se conserva el de nombre limpio; en información los dos están igual (ambos
-- sin teléfono, sin correo, con documento placeholder S/D- y sin antecedentes).
-- El predio del eliminado NO se toca: solo cambia de propietario.

-- 1.0 VERIFICAR ANTES (deben salir exactamente 2 filas, 1 predio cada una)
SELECT a.id, a.nombre_completo, a.numero_documento, p.nombre_predio, p.matricula_inmobiliaria
FROM   core.aliados a
LEFT   JOIN core.predios p ON p.aliado_id = a.id
WHERE  a.id IN ('ce4ef582-75f5-4422-b289-1f7af09de4c3',
                '31334f00-9a76-46e3-845d-3c04bf16518f');

BEGIN;

-- 1.1 El predio del duplicado pasa al propietario que se conserva
UPDATE core.predios
   SET aliado_id  = 'ce4ef582-75f5-4422-b289-1f7af09de4c3',
       updated_at = now()
 WHERE aliado_id  = '31334f00-9a76-46e3-845d-3c04bf16518f';

-- 1.2 Copropiedad: repuntar las filas, evitando chocar con una que ya exista
--     para el mismo (predio, aliado).
UPDATE core.predio_propietarios pp
   SET aliado_id = 'ce4ef582-75f5-4422-b289-1f7af09de4c3'
 WHERE pp.aliado_id = '31334f00-9a76-46e3-845d-3c04bf16518f'
   AND NOT EXISTS (
         SELECT 1 FROM core.predio_propietarios x
          WHERE x.predio_id = pp.predio_id
            AND x.aliado_id = 'ce4ef582-75f5-4422-b289-1f7af09de4c3');
DELETE FROM core.predio_propietarios
 WHERE aliado_id = '31334f00-9a76-46e3-845d-3c04bf16518f';

-- 1.3 Antecedentes (1 por persona). Hoy ninguno de los dos tiene; si el
--     duplicado tuviera y el que se conserva no, se traslada. Si ambos
--     tuvieran, gana el que se conserva y el otro se descarta.
UPDATE juridica.antecedentes
   SET aliado_id = 'ce4ef582-75f5-4422-b289-1f7af09de4c3'
 WHERE aliado_id = '31334f00-9a76-46e3-845d-3c04bf16518f'
   AND NOT EXISTS (SELECT 1 FROM juridica.antecedentes
                    WHERE aliado_id = 'ce4ef582-75f5-4422-b289-1f7af09de4c3');
DELETE FROM juridica.antecedentes
 WHERE aliado_id = '31334f00-9a76-46e3-845d-3c04bf16518f';

-- 1.4 Enganches de campo/conservación (hoy 0 filas, se dejan por seguridad)
UPDATE siembra.familias SET aliado_id = 'ce4ef582-75f5-4422-b289-1f7af09de4c3'
 WHERE aliado_id = '31334f00-9a76-46e3-845d-3c04bf16518f';
UPDATE ras.familias     SET aliado_id = 'ce4ef582-75f5-4422-b289-1f7af09de4c3'
 WHERE aliado_id = '31334f00-9a76-46e3-845d-3c04bf16518f';

-- 1.5 Ya sin referencias: borrar la ficha duplicada
DELETE FROM core.aliados WHERE id = '31334f00-9a76-46e3-845d-3c04bf16518f';

COMMIT;

-- 1.6 VERIFICAR DESPUÉS (1 sola persona, con sus 2 predios)
SELECT a.nombre_completo, a.numero_documento, p.nombre_predio, p.matricula_inmobiliaria
FROM   core.aliados a
JOIN   core.predios p ON p.aliado_id = a.id
WHERE  a.id = 'ce4ef582-75f5-4422-b289-1f7af09de4c3';


-- ════════════════════════════════════════════════════════════
-- BLOQUE 2 — Ficha sin predio (OPCIONAL: descomentar si se decide borrar)
-- ════════════════════════════════════════════════════════════
-- "Rodrigo Silva Hermida" (CC 17638410) quedó en core.aliados sin ningún predio,
-- sin antecedentes y sin expediente. O le falta el predio, o fue un registro
-- abandonado. Borrarlo NO arrastra nada.
--
-- DELETE FROM core.aliados
--  WHERE id = 'a609e94e-cff4-4b22-821b-5a4cb9c883fc'
--    AND NOT EXISTS (SELECT 1 FROM core.predios WHERE aliado_id = core.aliados.id);


-- ════════════════════════════════════════════════════════════
-- BLOQUE 3 — Consultas para volver a revisar duplicados cuando haga falta
--            (solo lectura: se pueden correr en cualquier momento)
-- ════════════════════════════════════════════════════════════

-- 3.1 Mismo documento real (ignora los placeholder S/D-): duplicado seguro.
SELECT numero_documento, count(*), array_agg(nombre_completo), array_agg(id)
FROM   core.aliados
WHERE  numero_documento NOT LIKE 'S/D-%'
GROUP  BY numero_documento
HAVING count(*) > 1;

-- 3.2 Nombres casi iguales: pilla los "Fulano" / "Fulano 2" y las tildes.
--     Compara sin tildes, sin puntuación y sin el sufijo numérico final.
--     Usa `translate` (nativo) y NO `unaccent`: esa extensión no está instalada
--     en este proyecto y pedirla sería DDL.
WITH n AS (
  SELECT id, nombre_completo,
         -- 1) quitar tildes  2) mayúsculas  3) puntuación → espacio
         -- 4) borrar el " 2" final  5) colapsar espacios
         regexp_replace(
           regexp_replace(
             regexp_replace(
               upper(translate(nombre_completo,
                               'áéíóúÁÉÍÓÚñÑüÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛ',
                               'aeiouAEIOUnNuUaeiouAEIOUaeiouAEIOU')),
               '[^A-Z0-9 ]', ' ', 'g'),
             '\s+\d+\s*$', ''),
           '\s+', ' ', 'g')                                    AS clave
  FROM core.aliados
)
SELECT btrim(clave) AS clave_normalizada, count(*),
       array_agg(nombre_completo), array_agg(id)
FROM   n
GROUP  BY btrim(clave)
HAVING count(*) > 1;

-- 3.3 Fichas de persona sin ningún predio colgado.
SELECT a.id, a.nombre_completo, a.numero_documento, a.created_at
FROM   core.aliados a
WHERE  NOT EXISTS (SELECT 1 FROM core.predios p WHERE p.aliado_id = a.id);

-- 3.4 Personas con varios predios — NO son duplicados, es lo normal.
--     Sirve para confirmar de un vistazo que cada ficha repetida en el listado
--     corresponde a un predio distinto (matrículas distintas).
SELECT a.nombre_completo, count(*) AS predios,
       array_agg(coalesce(p.nombre_predio, 'sin nombre')
                 || ' [' || coalesce(p.matricula_inmobiliaria, 'sin matrícula') || ']')
FROM   core.aliados a
JOIN   core.predios p ON p.aliado_id = a.id
GROUP  BY a.id, a.nombre_completo
HAVING count(*) > 1
ORDER  BY 2 DESC;
