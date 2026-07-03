-- =============================================================
-- RAS — Red de Árboles Semilleros
-- Tabla por-árbol + vista de indicadores por predio
-- Schema: ras   ·   Requiere: PostGIS (ya habilitado por geo)
-- Requiere: catalogo.especies YA CREADA (correr migration_catalogo.sql
--            + seed_catalogo_especies.sql ANTES que este script).
-- Fuente de datos: arboles_para_subir.xlsx, hoja "Se sube"
-- =============================================================

-- ── 1. Tabla principal: un registro por árbol semillero ──────────────────────
-- Normalizada: la especie NO se repite por árbol. Cada fila solo guarda
-- especie_id (FK a catalogo.especies) — el nombre científico, género, familia,
-- autor, IUCN, etc. viven UNA sola vez en el catálogo y se consultan por join.
create table if not exists ras.arboles_semilleros (
  id                    uuid primary key default gen_random_uuid(),

  -- Identidad
  codigo                text not null,                      -- código de placa (único global)
  nucleo                text,                               -- Piedemonte | Solano | ...
  predio                text,                               -- nombre del predio (texto, ya unificado)
  familia_id            uuid references ras.familias(id) on delete set null, -- predio/familia anfitrión (nullable)

  -- Especie — SIN duplicar taxonomía (eso vive en catalogo.especies)
  especie_id            uuid references catalogo.especies(id) on delete set null,
  especie_pendiente      text,                              -- lo registrado en campo cuando AÚN no hay match con el catálogo
                                                              -- (ej. "Parkia sp.", "Fono negro"); se limpia al determinar la especie
  especie_anterior      text,                               -- determinación previa de ESTE árbol antes de la revisión botánica (histórico)
  colecta               text,                               -- voucher de la colecta de ESTE árbol (ej. "LR 1516")

  -- Dendrometría y sitio (propio de cada árbol, no de la especie)
  cobertura_vegetal     text,
  pendiente             text,
  drenaje               text,
  tipo_suelo            text,
  forma_fuste           text,
  cap_cm                numeric,                            -- circunferencia a la altura del pecho
  dap_cm                numeric,                            -- diámetro a la altura del pecho
  ab_m2                 numeric,                            -- área basal = π·(DAP/200)²  (se calcula al cargar)
  altura_comercial_m    numeric,
  altura_total_m        numeric,
  clase_copa            text,                               -- dominante | codominante | intermedio
  copa_x_m              numeric,
  copa_y_m              numeric,
  especies_asociadas    text,                               -- líquenes / epífitas / lianas (bioindicador)

  -- Geo
  latitud               numeric,
  longitud              numeric,
  geom                  geometry(Point,4326)
                        generated always as
                        (case when latitud is not null and longitud is not null
                              then st_setsrid(st_makepoint(longitud, latitud), 4326) end) stored,

  -- Monitoreo dron
  monitoreo_dron        boolean,
  razon_no_dron         text,
  metodo_colecta        text,
  metodo_trepa          text,
  ruta_dron             text,
  codigo_dron           text,

  -- Registro / trazabilidad
  fecha_registro        date,
  foto_url              text,
  origen                text,                               -- kobo | csv | manual | Botánica | RAS-Tablas | Solano
  nombre_registra       text,
  estado_verificacion   text,                               -- campo | verificado (2ª pasada botánica)
  observaciones         text,

  created_at            timestamptz not null default now(),

  -- El código identifica el árbol globalmente (no importa el predio).
  constraint arboles_semilleros_codigo_key unique (codigo)
);

comment on table ras.arboles_semilleros is
  'Red de árboles semilleros (RAS): un registro por árbol, colgado del predio (familia_id) y de su especie (especie_id → catalogo.especies). No duplica taxonomía: muchos árboles comparten especie_id.';
comment on column ras.arboles_semilleros.ab_m2 is 'Área basal en m². Si no viene del campo: π·(DAP_cm/200)².';
comment on column ras.arboles_semilleros.geom is 'Punto 4326 derivado de lat/long, para cruces espaciales (ST_Contains, densidad, vecino más cercano).';
comment on column ras.arboles_semilleros.especie_id is 'FK → catalogo.especies. NULL si el árbol aún está a nivel de género o sin determinar (ver especie_pendiente).';
comment on column ras.arboles_semilleros.especie_pendiente is 'Texto crudo de campo cuando no hay especie_id todavía. Se vacía al cerrar la determinación y asignar especie_id.';

-- Índices
create index if not exists arboles_familia_idx  on ras.arboles_semilleros(familia_id);
create index if not exists arboles_predio_idx   on ras.arboles_semilleros(nucleo, predio);
create index if not exists arboles_especie_idx  on ras.arboles_semilleros(especie_id);
create index if not exists arboles_geom_gix     on ras.arboles_semilleros using gist(geom);

-- ── 2. Vista de indicadores por predio ───────────────────────────────────────
-- Reemplaza los conteos manuales ras.familias.arboles_semilleros / especies_forestales.
-- La especie, familia y género se obtienen por JOIN a catalogo.especies (nunca duplicados).
create or replace view ras.v_indicadores_predio as
with conteo as (   -- abundancia por especie (solo determinadas) para diversidad
  select a.nucleo, a.predio, a.especie_id, count(*)::numeric as n
  from ras.arboles_semilleros a
  where a.especie_id is not null
  group by a.nucleo, a.predio, a.especie_id
),
tot as (
  select nucleo, predio, sum(n) as nd, count(*) as s
  from conteo group by nucleo, predio
),
div as (
  select c.nucleo, c.predio,
         t.s  as especies_forestales,
         round(-sum((c.n/t.nd) * ln(c.n/t.nd)), 3)                                    as shannon_h,
         round(1 - sum(c.n*(c.n-1)) / nullif(t.nd*(t.nd-1),0), 3)                     as simpson_1d,
         round( (-sum((c.n/t.nd) * ln(c.n/t.nd))) / nullif(ln(t.s::numeric),0), 3)    as pielou_j,
         round((t.s::numeric - 1) / nullif(ln(nullif(t.nd,1)),0), 3)                  as margalef
  from conteo c join tot t using (nucleo, predio)
  group by c.nucleo, c.predio, t.s, t.nd
),
agg as (
  select a.nucleo, a.predio, max(a.familia_id::text)::uuid as familia_id,
         count(*)                                          as arboles_semilleros,
         count(distinct e.familia)                         as familias,
         count(distinct e.genero)                          as generos,
         round(sum(a.ab_m2)::numeric, 3)                   as area_basal_m2,
         round(avg(a.dap_cm)::numeric, 1)                  as dap_medio_cm,
         max(a.dap_cm)                                     as dap_max_cm,
         count(*) filter (where a.dap_cm >= 50)            as arboles_grandes_dap50,
         round(avg(a.altura_total_m)::numeric, 1)          as altura_media_m,
         count(*) filter (where a.geom is not null)        as con_coordenada,
         count(distinct e.id) filter
           (where e.iucn in ('NT','VU','EN','CR'))         as esp_amenazadas,
         count(*) filter
           (where e.iucn in ('NT','VU','EN','CR'))         as arb_amenazados,
         -- grupo funcional (rol sucesional) — vocabulario exacto confirmado en catalogo.especies
         count(*) filter (where e.rol_sucesional = 'Pionera')    as pioneras,
         count(*) filter (where e.rol_sucesional = 'Intermedia') as intermedias,
         count(*) filter (where e.rol_sucesional = 'Tardia')     as tardias,
         -- síndrome de dispersión
         count(*) filter (where e.dispersion = 'Zoocoria')   as zoocoria,
         count(*) filter (where e.dispersion = 'Anemocoria') as anemocoria,
         count(*) filter (where e.dispersion = 'Autocoria')  as autocoria,
         count(*) filter (where e.dispersion = 'Barocoria')  as barocoria
  from ras.arboles_semilleros a
  left join catalogo.especies e on e.id = a.especie_id
  group by a.nucleo, a.predio
)
select agg.nucleo, agg.predio, agg.familia_id,
       agg.arboles_semilleros,
       coalesce(div.especies_forestales, 0) as especies_forestales,
       agg.familias, agg.generos,
       div.shannon_h, div.simpson_1d, div.pielou_j, div.margalef,
       agg.area_basal_m2, agg.dap_medio_cm, agg.dap_max_cm,
       agg.arboles_grandes_dap50, agg.altura_media_m, agg.con_coordenada,
       agg.esp_amenazadas, agg.arb_amenazados,
       f.area_bosque_recorrida,
       case when coalesce(f.area_bosque_recorrida,0) > 0
            then round(agg.arboles_semilleros::numeric / f.area_bosque_recorrida, 2) end as densidad_arb_ha,
       -- columnas nuevas: SIEMPRE al final (create or replace view no permite insertarlas en medio)
       agg.pioneras, agg.intermedias, agg.tardias,
       agg.zoocoria, agg.anemocoria, agg.autocoria, agg.barocoria
from agg
left join div using (nucleo, predio)
left join ras.familias f on f.id = agg.familia_id;

comment on view ras.v_indicadores_predio is
  'Indicadores por predio: riqueza, Shannon, Simpson, Pielou, Margalef, área basal, DAP, especies amenazadas, distribución por grupo funcional (pioneras/intermedias/tardías) y por síndrome de dispersión (zoocoria/anemocoria/autocoria/barocoria), densidad. Especie/familia/género vienen de catalogo.especies vía especie_id (join), nunca duplicados en la tabla de árboles. Densidad usa area_bosque_recorrida; al cargar el polígono de conservación a geo.zonas se puede sustituir por ST_Area(geom) real.';

-- La vista respeta las políticas RLS del que consulta (no las del owner).
alter view ras.v_indicadores_predio set (security_invoker = on);

-- ── 2b. Vista de lectura "aplanada" (para la intranet y el geovisor) ─────────
-- La tabla NO duplica taxonomía; esta vista la trae por JOIN para que las
-- pantallas ya construidas (ficha de árbol, geovisor) puedan seguir leyendo
-- nombre_cientifico/genero/familia_botanica/nombre_comun como columnas planas,
-- sin que ese dato esté copiado por árbol en el disco.
create or replace view ras.v_arboles_con_especie as
select
  a.id, a.codigo, a.nucleo, a.predio, a.familia_id, a.especie_id,
  coalesce(e.nombre_cientifico, a.especie_pendiente)  as nombre_cientifico,
  e.genero                                            as genero,
  e.familia                                            as familia_botanica,
  coalesce(e.nombres_comunes[1], a.especie_pendiente) as nombre_comun,
  e.iucn, e.cites,
  a.especie_anterior, a.colecta,
  a.cobertura_vegetal, a.pendiente, a.drenaje, a.tipo_suelo, a.forma_fuste,
  a.cap_cm, a.dap_cm, a.ab_m2, a.altura_comercial_m, a.altura_total_m,
  a.clase_copa, a.copa_x_m, a.copa_y_m, a.especies_asociadas,
  a.latitud, a.longitud, a.geom,
  a.monitoreo_dron, a.razon_no_dron, a.metodo_colecta, a.metodo_trepa, a.ruta_dron, a.codigo_dron,
  a.fecha_registro, a.foto_url, a.origen, a.nombre_registra, a.estado_verificacion, a.observaciones,
  a.created_at,
  -- columna nueva: al final (create or replace view no permite insertarla en medio)
  a.especie_pendiente
from ras.arboles_semilleros a
left join catalogo.especies e on e.id = a.especie_id;

comment on view ras.v_arboles_con_especie is
  'Vista de lectura: árbol + su especie (join a catalogo.especies). Úsala desde la app en vez de la tabla cuando necesites nombre_cientifico/familia/género — la tabla base no los duplica.';
alter view ras.v_arboles_con_especie set (security_invoker = on);
grant select on ras.v_arboles_con_especie to anon, authenticated, service_role;

-- ── 3. RLS + permisos (igual que el resto del schema ras) ────────────────────
alter table ras.arboles_semilleros enable row level security;

drop policy if exists "arboles_select_auth" on ras.arboles_semilleros;
create policy "arboles_select_auth" on ras.arboles_semilleros
  for select to authenticated using (true);

drop policy if exists "arboles_write_auth" on ras.arboles_semilleros;
create policy "arboles_write_auth" on ras.arboles_semilleros
  for all to authenticated using (true) with check (true);

grant usage on schema ras to anon, authenticated, service_role;
grant select on ras.arboles_semilleros to anon, authenticated, service_role;
grant insert, update, delete on ras.arboles_semilleros to authenticated, service_role;
grant select on ras.v_indicadores_predio to anon, authenticated, service_role;

-- ── 4. (Opcional) sincronizar los conteos manuales de ras.familias ───────────
-- Los campos arboles_semilleros / especies_forestales de ras.familias pasan a
-- DERIVARSE. Para refrescarlos a partir de la vista:
--
-- update ras.familias f
--    set arboles_semilleros  = v.arboles_semilleros,
--        especies_forestales = v.especies_forestales
--   from ras.v_indicadores_predio v
--  where v.familia_id = f.id;
