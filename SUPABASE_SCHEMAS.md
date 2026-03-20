# Recomendación de Schemas en Supabase

## Schemas propuestos

### `auth` *(gestionado por Supabase — no modificar)*
Tablas internas de autenticación de Supabase.

---

### `people` — Gestión de usuarios
| Tabla | Descripción |
|-------|-------------|
| `user_profiles` | Perfiles de empleados: nombre, rol, departamento, flag admin, último login |

---

### `fleet` — Flota vehicular
| Tabla | Descripción |
|-------|-------------|
| `vehicles` | Catálogo de vehículos (actualmente definido en `lib/vehicles.ts`) |
| `vehicle_reservations` | Reservas del calendario por vehículo y usuario |
| `vehicle_inspections` | Inspecciones de recepción/devolución (7 pasos + fotos) |

---

### `ras` — Restauración Ambiental y Social
| Tabla | Descripción |
|-------|-------------|
| `ras.familias` | Registro principal de familias en restauración (info base, socioeconomía, datos de restauración) |
| `ras.monitoreos` | Eventos de monitoreo por familia (fecha + % supervivencia) |
| `ras.camaras_trampa` | Cámaras trampa por familia (nombre, coordenadas) |
| `ras.fotos_camara` | Fotos de captura asociadas a cada cámara trampa |

**Storage buckets:**
- `ras-shapefiles` — Archivos .zip con shapefiles de predios
- `ras-fotos-camara` — Fotografías de captura de cámaras trampa

**Estado:** ✅ Implementado y en producción. Schema, tablas, políticas RLS y buckets ejecutados.

---

### `storage` *(gestionado por Supabase — no modificar)*
El bucket `inspection-photos` ya reside aquí.

---

## Migración desde `public`

Al mover tablas fuera del schema `public`, se deben tener en cuenta tres puntos:

1. **Políticas RLS** — deben eliminarse y recrearse dentro del nuevo schema.
2. **Código de la aplicación** — Supabase JS apunta a `public` por defecto; se debe configurar el `search_path` en el cliente o calificar los nombres (`fleet.vehicle_reservations`).
3. **Service role / anon key** — siguen funcionando sin cambios, solo se ajustan las políticas.

---

## SQL del schema `ras` (ejecutar en Supabase)

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
  empleos_locales            INT DEFAULT 0,
  plan_restauracion          TEXT,
  ha_restauracion            NUMERIC,
  parcelas_monitoreo         INT,
  plantulas_sembradas        INT,
  especies_sembradas         INT,
  shapefile_finca_url        TEXT,
  shapefile_restauracion_url TEXT,
  created_by                 TEXT,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ras.monitoreos (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id        UUID REFERENCES ras.familias(id) ON DELETE CASCADE,
  fecha             DATE NOT NULL,
  supervivencia_pct NUMERIC CHECK (supervivencia_pct BETWEEN 0 AND 100),
  created_at        TIMESTAMPTZ DEFAULT NOW()
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
ALTER TABLE ras.monitoreos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ras.camaras_trampa ENABLE ROW LEVEL SECURITY;
ALTER TABLE ras.fotos_camara   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_familias"     ON ras.familias       FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_familias"   ON ras.familias       FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "read_monitoreos"   ON ras.monitoreos     FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_monitoreos" ON ras.monitoreos     FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "read_camaras"      ON ras.camaras_trampa FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_camaras"    ON ras.camaras_trampa FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "read_fotos"        ON ras.fotos_camara   FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_fotos"      ON ras.fotos_camara   FOR INSERT TO authenticated WITH CHECK (true);

-- Eliminar familias (CASCADE sobre monitoreos, camaras_trampa y fotos_camara)
CREATE POLICY "delete_familias"   ON ras.familias       FOR DELETE TO authenticated USING (true);
```

**Storage buckets a crear manualmente en Supabase → Storage:**
- `ras-shapefiles` (acceso público)
- `ras-fotos-camara` (acceso público)

---

## SQL de schemas existentes (pendiente de ejecutar)

```sql
-- Crear schemas
CREATE SCHEMA IF NOT EXISTS people;
CREATE SCHEMA IF NOT EXISTS fleet;

-- Mover tablas
ALTER TABLE public.user_profiles      SET SCHEMA people;
ALTER TABLE public.vehicle_reservations SET SCHEMA fleet;
ALTER TABLE public.vehicle_inspections  SET SCHEMA fleet;

-- Si vehicles se migra a BD en el futuro:
-- ALTER TABLE public.vehicles SET SCHEMA fleet;
```

> **Estado:** Pendiente de aprobación y ejecución.
