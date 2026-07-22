-- ============================================================
-- RAS — Documentos legales por familia (conservación)
-- Tabla ras.documentos_familia + bucket privado ras-documentos-privados
-- Schema: ras   ·   Dominio: Conservación
--
-- Motivo: la CESIÓN DE DERECHOS DE IMAGEN es un documento legal distinto del
-- acuerdo de conservación (ras.familias.documento_acuerdo_url) y un predio puede
-- tener VARIOS titulares (caso real: José Huber + María Alejandra Cadena). Por eso
-- va en tabla propia (1 familia → N documentos), no en una columna suelta.
--
-- Contiene cédulas y firmas → bucket PRIVADO (URL firmada temporal, nunca pública),
-- mismo criterio que juridica-documentos.
--
-- REGLA DEL PROYECTO: este .sql lo corre el USUARIO en el SQL Editor. El asistente
-- no ejecuta DDL. Tras correrlo, mover el bloque de pending.sql al historial.
-- ============================================================


-- ── 1. Tabla ────────────────────────────────────────────────────────────────
create table if not exists ras.documentos_familia (
  id                uuid primary key default gen_random_uuid(),
  familia_id        uuid not null references ras.familias(id) on delete cascade,

  -- Qué documento es. 'acuerdo_conservacion' se incluye para poder, en el futuro,
  -- migrar aquí lo que hoy vive en ras.familias.documento_acuerdo_url (opcional).
  tipo              text not null
                    check (tipo in ('cesion_imagen', 'acuerdo_conservacion', 'otro')),

  -- Titular que firma (para el caso de varios titulares por predio).
  titular_nombre    text,
  titular_documento text,
  fecha             date,                 -- fecha del documento

  -- Fuente de verdad del archivo: la ruta del objeto en el bucket PRIVADO.
  -- La URL de descarga se firma al vuelo en el API (no se guarda: caducan).
  storage_path      text not null,
  nombre_archivo    text,                 -- nombre original, para mostrar

  observaciones     text,
  created_by        text,
  created_at        timestamptz not null default now()
);

comment on table ras.documentos_familia is
  'Documentos legales por familia en conservación (cesión de derechos de imagen, acuerdo, otros). 1 familia → N documentos (soporta varios titulares). Los archivos viven en el bucket privado ras-documentos-privados; storage_path es la fuente de verdad y la URL se firma al leer.';

create index if not exists documentos_familia_familia_idx on ras.documentos_familia(familia_id);
create index if not exists documentos_familia_tipo_idx    on ras.documentos_familia(tipo);


-- ── 2. RLS + grants ─────────────────────────────────────────────────────────
-- Documento sensible: SOLO usuarios autenticados de la intranet (NO anon / NO geovisor).
alter table ras.documentos_familia enable row level security;

drop policy if exists documentos_familia_read_auth  on ras.documentos_familia;
drop policy if exists documentos_familia_write_auth on ras.documentos_familia;

create policy documentos_familia_read_auth
  on ras.documentos_familia for select to authenticated using (true);
create policy documentos_familia_write_auth
  on ras.documentos_familia for all to authenticated using (true) with check (true);

-- Ojo: NO se otorga select a anon (a diferencia de ras.arboles_semilleros).
grant select, insert, update, delete on ras.documentos_familia to authenticated, service_role;


-- ── 3. Bucket privado ───────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('ras-documentos-privados', 'ras-documentos-privados', false)
on conflict (id) do nothing;

-- Políticas de storage: solo autenticados operan sobre este bucket. El API del
-- servidor usa service_role (que además bypassa RLS), pero estas políticas cierran
-- el acceso directo desde el cliente para todo lo que no sea una URL firmada.
drop policy if exists ras_docpriv_read   on storage.objects;
drop policy if exists ras_docpriv_write  on storage.objects;
drop policy if exists ras_docpriv_update on storage.objects;
drop policy if exists ras_docpriv_delete on storage.objects;

create policy ras_docpriv_read   on storage.objects
  for select to authenticated using (bucket_id = 'ras-documentos-privados');
create policy ras_docpriv_write  on storage.objects
  for insert to authenticated with check (bucket_id = 'ras-documentos-privados');
create policy ras_docpriv_update on storage.objects
  for update to authenticated using (bucket_id = 'ras-documentos-privados');
create policy ras_docpriv_delete on storage.objects
  for delete to authenticated using (bucket_id = 'ras-documentos-privados');


-- ── 4. Verificación tras correr ─────────────────────────────────────────────
-- select to_regclass('ras.documentos_familia');                 -- ~> ras.documentos_familia
-- select id, public from storage.buckets where id = 'ras-documentos-privados';  -- ~> false
