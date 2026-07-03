-- =============================================================
-- catalogo.especies — Maestro único de especies
-- Lo comparten Conservación (ras.arboles_semilleros), Vivero y Plan.
-- Schema: catalogo
-- =============================================================

create schema if not exists catalogo;

create table if not exists catalogo.especies (
  id                          uuid primary key default gen_random_uuid(),

  -- ── Identidad taxonómica ──────────────────────────────────────────────
  nombre_cientifico           text not null,
  autor                       text,                 -- ej. "L.", "(Bertero & Balb. ex Kunth) Skeels"
  genero                      text,
  epiteto                     text,
  familia                     text,
  nombres_comunes             text[] not null default '{}',
  especie_anterior            text,                 -- sinónimo / determinación previa de campo

  -- ── Descriptivo ───────────────────────────────────────────────────────
  descripcion                 text,
  habito                      text,                 -- árbol | palma | arbusto | liana ...
  foto_url                    text,                 -- bucket species-photos

  -- ── Usos / programa ───────────────────────────────────────────────────
  usos                        text[] not null default '{}',
  aplica_ley_arbol            boolean,

  -- ── Conservación ──────────────────────────────────────────────────────
  iucn                        text,                 -- categoría IUCN global: LC|NT|VU|EN|CR|DD|NE
  amenaza                     text,                 -- categoría nacional (Resolución 1912 de 2017) — pendiente
  cites                       text,                 -- NA | Apéndice I/II/III

  -- ── Ecológico ─────────────────────────────────────────────────────────
  orden                       text,                 -- orden taxonómico (ej. Fabales)
  origen                      text,                 -- nativa | introducida
  dispersion                  text,                 -- zoocoria | anemocoria | autocoria | barocoria
  polinizacion                text,                 -- zoófila | entomófila | anemófila
  rol_sucesional              text,                 -- grupo funcional: pionera | intermedia | tardía

  -- ── Propagación (vivero / plan) ───────────────────────────────────────
  tipo_semilla                text,                 -- ortodoxa | recalcitrante | intermedia
  tratamiento_pregerminativo  text,
  pct_germinacion             numeric,
  dias_germinacion            integer,
  dias_crecimiento_vivero     integer,
  semillas_por_kg             numeric,

  -- ── Origen / trazabilidad ─────────────────────────────────────────────
  en_catalogo                 boolean not null default false,  -- venía del catálogo de la botánica
  en_ras                      boolean not null default false,  -- aparece en la red de árboles semilleros
  en_vivero                   boolean not null default false,  -- aparece en vivero
  n_arboles_ras               integer not null default 0,      -- abundancia en RAS (referencia)
  slug                        text,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint especies_nombre_cientifico_key unique (nombre_cientifico)
);

comment on table  catalogo.especies is 'Maestro único de especies (catálogo botánica + RAS + vivero). Llave que comparten ras.arboles_semilleros, vivero y plan.';
comment on column catalogo.especies.en_catalogo is 'true = tiene ficha del catálogo de la botánica (descripción/usos/foto).';
comment on column catalogo.especies.amenaza is 'PENDIENTE para todas: categoría UICN y/o Resolución 1912 de 2017 (Colombia).';

create index if not exists especies_familia_idx       on catalogo.especies(familia);
create index if not exists especies_comunes_gin        on catalogo.especies using gin(nombres_comunes);
create index if not exists especies_usos_gin           on catalogo.especies using gin(usos);
create index if not exists especies_origen_idx         on catalogo.especies(en_ras, en_vivero);

-- updated_at automático
create or replace function catalogo.touch_updated_at() returns trigger
  language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists especies_touch on catalogo.especies;
create trigger especies_touch before update on catalogo.especies
  for each row execute function catalogo.touch_updated_at();

-- ── RLS + permisos ────────────────────────────────────────────────────────
alter table catalogo.especies enable row level security;

drop policy if exists "especies_select" on catalogo.especies;
create policy "especies_select" on catalogo.especies
  for select to anon, authenticated using (true);

drop policy if exists "especies_write_auth" on catalogo.especies;
create policy "especies_write_auth" on catalogo.especies
  for all to authenticated using (true) with check (true);

grant usage on schema catalogo to anon, authenticated, service_role;
grant select on catalogo.especies to anon, authenticated, service_role;
grant insert, update, delete on catalogo.especies to authenticated, service_role;
alter default privileges in schema catalogo grant select, insert, update, delete on tables to authenticated, service_role;

-- (Opcional, cuando exista ras.arboles_semilleros) enlazar la FK:
--   alter table ras.arboles_semilleros
--     add constraint arboles_especie_fk
--     foreign key (especie_id) references catalogo.especies(id) on delete set null;
