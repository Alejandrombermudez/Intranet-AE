-- ============================================================
-- Usuarios del geovisor — tabla people.usuarios_geovisor
-- Schema: people   ·   Fecha: 2026-10-12
--
-- Motivo: el geovisor tenía las cuentas de los aliados escritas en el código
-- (usuario y contraseña en un archivo que el navegador descargaba completo).
-- Ahora las cuentas se crean y se administran desde la intranet
-- (Tecnología → Usuarios del geovisor) y el geovisor solo las verifica en su
-- servidor.
--
-- Por qué una tabla propia y NO usuarios de Supabase Auth:
--   En este proyecto, casi todas las tablas de la intranet se leen con una
--   política «TO authenticated USING (true)». Cualquier sesión de Supabase Auth
--   —la de un aliado externo también— podría leer jurídica, familias y predios
--   directo por REST, sin pasar por el geovisor. Una cuenta de esta tabla no
--   es un usuario de Supabase: no recibe ningún rol en la base. Solo sirve para
--   que el servidor del geovisor decida qué le entrega.
--
-- La contraseña NO se guarda: se guarda su huella (scrypt con sal propia por
-- cuenta). Ni un administrador ni quien lea la tabla puede recuperarla; si se
-- pierde, se pone una nueva desde la intranet.
--
-- Nadie lee esta tabla desde el navegador: RLS encendido sin ninguna política y
-- sin permisos para anon ni authenticated. Solo service_role (las rutas del
-- servidor de la intranet y del geovisor).
--
-- REGLA DEL PROYECTO: este .sql lo corre el USUARIO en el SQL Editor. El
-- asistente no ejecuta DDL. Todas las sentencias son repetibles.
-- ============================================================


-- ── 1. Tabla ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS people.usuarios_geovisor (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Con qué entra: un correo o un nombre corto. Siempre en minúsculas y sin espacios.
  usuario           TEXT NOT NULL UNIQUE
                    CHECK (usuario = lower(btrim(usuario)) AND usuario <> '' AND usuario !~ '\s'),
  nombre            TEXT NOT NULL,          -- cómo se le saluda en el geovisor
  organizacion      TEXT,                   -- aliado o área a la que pertenece
  -- scrypt$N$r$p$<sal en base64>$<huella en base64>
  clave_hash        TEXT NOT NULL,
  activo            BOOLEAN NOT NULL DEFAULT TRUE,

  -- Freno a quien prueba contraseñas: 5 fallos seguidos bloquean 15 minutos.
  intentos_fallidos INT NOT NULL DEFAULT 0,
  bloqueado_hasta   TIMESTAMPTZ,
  ultimo_ingreso    TIMESTAMPTZ,

  nota              TEXT,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE people.usuarios_geovisor IS
  'Cuentas para iniciar sesión en el geovisor. Se administran desde la intranet. NO son usuarios de Supabase Auth: no reciben rol en la base. Solo service_role.';
COMMENT ON COLUMN people.usuarios_geovisor.clave_hash IS
  'Huella scrypt de la contraseña (scrypt$N$r$p$sal$huella). La contraseña no se guarda ni se puede recuperar.';


-- ── 2. Cerrada a todo lo que no sea el servidor ─────────────────────────────
ALTER TABLE people.usuarios_geovisor ENABLE ROW LEVEL SECURITY;

-- Sin políticas a propósito: con RLS encendido y ninguna política, anon y
-- authenticated no ven ninguna fila aunque alguien les diera permisos después.
REVOKE ALL ON people.usuarios_geovisor FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON people.usuarios_geovisor TO service_role;


-- ── 3. Verificación tras correr ─────────────────────────────────────────────
-- Tiene que devolver 0 y no dar error:
--   select count(*) from people.usuarios_geovisor;
-- Tiene que devolver una fila con rowsecurity = true:
--   select relname, relrowsecurity as rowsecurity from pg_class
--   where oid = 'people.usuarios_geovisor'::regclass;
-- No tiene que devolver ninguna fila (nadie más que service_role tiene permisos):
--   select grantee, privilege_type from information_schema.role_table_grants
--   where table_schema = 'people' and table_name = 'usuarios_geovisor'
--     and grantee in ('anon', 'authenticated', 'PUBLIC');
