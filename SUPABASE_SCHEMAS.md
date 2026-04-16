# Schemas en Supabase

> **Última actualización:** Marzo 2026
> Para seguimiento de migraciones SQL ver `docs/sql/`

---

## Estado actual de schemas

| Schema | Módulo | Estado |
|--------|--------|--------|
| `auth` | Autenticación *(Supabase managed)* | ✅ Gestionado por Supabase |
| `public` | Tablas legacy (`user_profiles`, etc.) | ✅ En uso — migración a schemas propios pendiente/opcional |
| `people` | Gestión de usuarios | ⚠️ Pendiente — ver `docs/sql/pending.sql` |
| `fleet` | Flota vehicular | ⚠️ Pendiente — ver `docs/sql/pending.sql` |
| `siembra` | Módulo Restauración / Siembra | ✅ Ejecutado en producción |
| `ras` | Módulo Conservación | ✅ Ejecutado en producción |
| `storage` | Buckets *(Supabase managed)* | ✅ Buckets creados |

---

## Storage Buckets (acceso público)

| Bucket | Módulo | Contenido |
|--------|--------|-----------|
| `siembra-shapefiles` | Siembra | Polígonos .zip (finca + área en restauración) |
| `siembra-fotos-camara` | Siembra | Fotos de cámaras trampa |
| `ras-shapefiles` | Conservación | Polígonos .zip (finca + área en conservación) |
| `ras-fotos-camara` | Conservación | Fotos de cámaras trampa |

---

## Schema `siembra` — Módulo Restauración / Siembra ✅

| Tabla | Descripción |
|-------|-------------|
| `siembra.familias` | Familia en restauración: info base, socioeconomía, datos de siembra |
| `siembra.monitoreos` | Eventos de monitoreo (fecha + % supervivencia) |
| `siembra.camaras_trampa` | Cámaras trampa (nombre, lat, lon) |
| `siembra.fotos_camara` | Fotos de cámaras trampa |

### SQL ejecutado

```sql
CREATE SCHEMA IF NOT EXISTS siembra;

CREATE TABLE siembra.familias (
  id                         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Identificación
  nombre_propietario         TEXT NOT NULL,
  tipo_documento             TEXT,                       -- CC / NUIP / CE / TI / PP / NIT
  numero_documento           TEXT,
  telefono                   TEXT,
  nucleo                     TEXT,                       -- Ej: "Piedemonte"
  departamento               TEXT,
  municipio                  TEXT NOT NULL,
  vereda                     TEXT,
  nombre_finca               TEXT,
  -- Hogar & Economía
  adultos                    INT DEFAULT 0,
  ninos                      INT DEFAULT 0,
  cant_mujeres               INT DEFAULT 0,
  cant_hombres               INT DEFAULT 0,
  actividad_economica        TEXT,
  tiene_espacio_vegetal      BOOLEAN DEFAULT FALSE,
  empleos_locales            INT DEFAULT 0,
  -- Predio & Inventario forestal
  ha_potreros                NUMERIC,
  ha_bosque                  NUMERIC,
  ha_otras                   NUMERIC,
  bajo_conservacion          BOOLEAN DEFAULT FALSE,
  num_individuos             INT DEFAULT 0,              -- árboles en inventario
  num_especies_inventario    INT DEFAULT 0,              -- especies identificadas (≠ especies sembradas)
  area_bosque_recorrida      NUMERIC,                    -- ha encuestadas en inventario
  distancia_florencia_km     NUMERIC,
  tiempo_florencia_min       INT,
  -- Restauración
  plan_restauracion          TEXT,
  ha_restauracion            NUMERIC,
  parcelas_monitoreo         INT,
  plantulas_sembradas        INT,
  especies_sembradas         INT,
  -- Archivos
  shapefile_finca_url        TEXT,
  shapefile_restauracion_url TEXT,
  shapefile_arboles_url      TEXT,
  documento_acuerdo_url      TEXT,
  -- Auditoría
  created_by                 TEXT,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE siembra.monitoreos (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id        UUID REFERENCES siembra.familias(id) ON DELETE CASCADE,
  fecha             DATE NOT NULL,
  supervivencia_pct NUMERIC CHECK (supervivencia_pct BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE siembra.camaras_trampa (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id UUID REFERENCES siembra.familias(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  latitud    NUMERIC NOT NULL,
  longitud   NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE siembra.fotos_camara (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  camara_id  UUID REFERENCES siembra.camaras_trampa(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE siembra.familias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE siembra.monitoreos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE siembra.camaras_trampa ENABLE ROW LEVEL SECURITY;
ALTER TABLE siembra.fotos_camara   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_familias"     ON siembra.familias       FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_familias"   ON siembra.familias       FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delete_familias"   ON siembra.familias       FOR DELETE TO authenticated USING (true);
CREATE POLICY "read_monitoreos"   ON siembra.monitoreos     FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_monitoreos" ON siembra.monitoreos     FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "read_camaras"      ON siembra.camaras_trampa FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_camaras"    ON siembra.camaras_trampa FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "read_fotos"        ON siembra.fotos_camara   FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_fotos"      ON siembra.fotos_camara   FOR INSERT TO authenticated WITH CHECK (true);

-- IMPORTANTE: Supabase no otorga permisos automáticamente en schemas distintos de public.
-- Sin estos GRANTs se produce "permission denied for table X" aunque las políticas RLS existan.
GRANT USAGE ON SCHEMA siembra TO anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON ALL TABLES IN SCHEMA siembra TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA siembra TO authenticated, service_role;
```

---

## Schema `ras` — Módulo Conservación ✅

| Tabla | Descripción |
|-------|-------------|
| `ras.familias` | Familia en conservación: info base, hectáreas, plan, indicadores |
| `ras.camaras_trampa` | Cámaras trampa (nombre, lat, lon) |
| `ras.fotos_camara` | Fotos de cámaras trampa |

### SQL ejecutado

```sql
CREATE SCHEMA IF NOT EXISTS ras;

CREATE TABLE ras.familias (
  id                         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  municipio                  TEXT NOT NULL,
  vereda                     TEXT,
  nombre_finca               TEXT,
  nombre_propietario         TEXT NOT NULL,
  adultos                    INT DEFAULT 0,
  ninos                      INT DEFAULT 0,
  ha_potreros                NUMERIC,
  ha_bosque                  NUMERIC,
  ha_otras                   NUMERIC,
  bajo_conservacion          BOOLEAN DEFAULT FALSE,
  acuerdo_conservacion       BOOLEAN DEFAULT FALSE,
  arboles_semilleros         INT DEFAULT 0,
  especies_forestales        INT DEFAULT 0,
  otros_indices              TEXT,
  shapefile_finca_url        TEXT,
  shapefile_conservacion_url TEXT,
  created_by                 TEXT,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ras.camaras_trampa (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id UUID REFERENCES ras.familias(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  latitud    NUMERIC NOT NULL,
  longitud   NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ras.fotos_camara (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  camara_id  UUID REFERENCES ras.camaras_trampa(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ras.familias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ras.camaras_trampa ENABLE ROW LEVEL SECURITY;
ALTER TABLE ras.fotos_camara   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_familias"   ON ras.familias       FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_familias" ON ras.familias       FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delete_familias" ON ras.familias       FOR DELETE TO authenticated USING (true);
CREATE POLICY "read_camaras"    ON ras.camaras_trampa FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_camaras"  ON ras.camaras_trampa FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "read_fotos"      ON ras.fotos_camara   FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_fotos"    ON ras.fotos_camara   FOR INSERT TO authenticated WITH CHECK (true);

-- IMPORTANTE: Supabase no otorga permisos automáticamente en schemas distintos de public.
-- Sin estos GRANTs se produce "permission denied for table X" aunque las políticas RLS existan.
GRANT USAGE ON SCHEMA ras TO anon, authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON ALL TABLES IN SCHEMA ras TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA ras TO authenticated, service_role;
```

---

## Notas de desarrollo

### Multi-schema en Supabase JS

```ts
// Siembra
supabase.schema('siembra').from('familias').select(...)

// Conservación
supabase.schema('ras').from('familias').select(...)
```

### Relación entre módulos y rutas de la app

| Ruta | Schema | Descripción |
|------|--------|-------------|
| `/intranet/ras` | — | Hub selector (Siembra / Conservación) |
| `/intranet/ras/siembra` | `siembra` | Lista de familias en restauración |
| `/intranet/ras/siembra/nueva` | `siembra` | Formulario nuevo registro |
| `/intranet/ras/conservacion` | `ras` | Lista de familias en conservación |
| `/intranet/ras/conservacion/nueva` | `ras` | Formulario nuevo registro |
| `POST /api/ras/familias` | `siembra` | API creación siembra |
| `DELETE /api/ras/familias/[id]` | `siembra` | API eliminación siembra |
| `POST /api/ras/conservacion` | `ras` | API creación conservación |
| `DELETE /api/ras/conservacion/[id]` | `ras` | API eliminación conservación |
