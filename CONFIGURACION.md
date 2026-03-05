# Guía de Configuración — Intranet Amazonia Emprende

Esta guía contiene los pasos necesarios para activar el módulo
**"Validar mi Reserva"** (inspección vehicular con fotos).

> **Requisito previo:** El módulo usa la sesión de Microsoft 365 ya configurada.
> No requiere correos, códigos de validación ni dependencias adicionales.

---

## PASO 1 — Ejecutar scripts SQL en Supabase

Ve a tu proyecto → **SQL Editor** → **New query**.
Ejecuta cada bloque por separado, en el orden indicado.

---

### Script 1 — Tabla `vehicle_inspections`

```sql
CREATE TABLE IF NOT EXISTS vehicle_inspections (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id      UUID NOT NULL REFERENCES vehicle_reservations(id) ON DELETE CASCADE,
  inspection_type     TEXT NOT NULL CHECK (inspection_type IN ('recepcion', 'devolucion')),
  step_completed      INT NOT NULL DEFAULT 0,
  submitted_at        TIMESTAMPTZ,

  cat1_status TEXT NOT NULL DEFAULT 'ok',
  cat1_issues TEXT[] DEFAULT '{}',
  cat1_other  TEXT,

  cat2_status TEXT NOT NULL DEFAULT 'ok',
  cat2_issues TEXT[] DEFAULT '{}',
  cat2_other  TEXT,

  cat3_status TEXT NOT NULL DEFAULT 'ok',
  cat3_issues TEXT[] DEFAULT '{}',
  cat3_other  TEXT,

  cat4_status TEXT NOT NULL DEFAULT 'ok',
  cat4_issues TEXT[] DEFAULT '{}',
  cat4_other  TEXT,

  cat5_status TEXT NOT NULL DEFAULT 'ok',
  cat5_issues TEXT[] DEFAULT '{}',
  cat5_other  TEXT,

  cat6_status TEXT NOT NULL DEFAULT 'ok',
  cat6_issues TEXT[] DEFAULT '{}',
  cat6_other  TEXT,

  photo_frontal     TEXT,
  photo_posterior   TEXT,
  photo_lateral_izq TEXT,
  photo_lateral_der TEXT,
  photo_tablero     TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_inspection_per_reservation_type
    UNIQUE (reservation_id, inspection_type)
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vehicle_inspections_updated_at
  BEFORE UPDATE ON vehicle_inspections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_vehicle_inspections_reservation_id
  ON vehicle_inspections (reservation_id);
```

> ✅ Después de ejecutar: ve a **Table Editor** y confirma que
> la tabla `vehicle_inspections` aparece en la lista.

---

### Script 2 — Políticas de acceso (RLS)

```sql
ALTER TABLE vehicle_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read inspections"
  ON vehicle_inspections FOR SELECT
  USING (true);

CREATE POLICY "Public insert inspections"
  ON vehicle_inspections FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update inspections"
  ON vehicle_inspections FOR UPDATE
  USING (true)
  WITH CHECK (true);
```

> ✅ Después de ejecutar: ve a **Authentication → Policies**,
> filtra por `vehicle_inspections` y confirma las 3 políticas.

---

### Script 3 — Bucket de fotos en Storage

```sql
INSERT INTO storage.buckets (id, name, public)
  VALUES ('inspection-photos', 'inspection-photos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public upload inspection photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'inspection-photos');

CREATE POLICY "Public read inspection photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'inspection-photos');
```

> ✅ Después de ejecutar: ve a **Storage** y confirma que
> el bucket `inspection-photos` aparece con visibilidad **Public**.

---

## PASO 2 — Variable de entorno del servidor

La ruta `/api/inspections/upsert` usa el `service_role_key` de Supabase para escribir
sin restricciones de RLS. Agrega esta variable en `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Supabase → Settings → API → service_role (secret)
```

> En Vercel: **Dashboard → tu proyecto → Settings → Environment Variables**
> y agrega `SUPABASE_SERVICE_ROLE_KEY`.

---

## PASO 3 — Verificación local

```bash
npm run dev
```

Abre el navegador y verifica:

| Prueba | Qué verificar |
|--------|---------------|
| Sin sesión → ir a `/validar-reserva` | Redirige automáticamente a `/` |
| Con sesión, sin reserva hoy | Aparece "Sin vehículos para hoy" con botones de navegación |
| Con sesión y reserva con `start_date` = hoy | Aparece tarjeta con botón "Iniciar Recepción" |
| Con sesión y reserva con `end_date` = hoy | Aparece tarjeta con botón "Iniciar Devolución" |
| Completar los 6 pasos de inspección | Cada "Siguiente" guarda en Supabase (`vehicle_inspections`) |
| Subir fotos en el paso 7 | Aparecen en **Storage → inspection-photos** |
| Pantalla de confirmación | Muestra el resumen de novedades reportadas |
| Volver a entrar el mismo día | La inspección completada aparece con badge "Completada" |

---

## Flujo de trabajo

```
Usuario inicia sesión con Microsoft
        ↓
  /validar-reserva
        ↓
  ¿Tiene sesión activa?
  No → redirige a /
  Sí ↓
  ¿Tiene reservas hoy (start_date = hoy  O  end_date = hoy)?
  No → "Sin vehículos para hoy"
  Sí ↓
  Muestra tarjetas con botones:
    · start_date = hoy → "Iniciar Recepción"
    · end_date  = hoy  → "Iniciar Devolución"
    · Ya completada    → badge "Completada" (sin botón)
        ↓
  Wizard de inspección (7 pasos):
    Pasos 1–6  → 6 categorías vehiculares
    Paso 7     → 5 fotos (frontal, posterior, lat. izq., lat. der., tablero)
        ↓
  Confirmación con resumen de novedades
```

---

## Resumen de archivos del módulo

```
lib/
  supabase-server.ts      → Cliente Supabase con service_role (solo server)
  inspection-data.ts      → Definición de las 6 categorías y los 5 slots de fotos

app/api/
  inspections/
    upsert/route.ts       → Guarda cada paso del wizard en la BD (upsert)

app/validar-reserva/
  page.tsx                → Wizard completo (auth + selección + 6 cats + fotos + confirmación)
```

---

*Amazonia Emprende · Intranet Corporativa*
