# Guía de Migración de Schemas — Intranet AE
**Fecha:** Mayo 2026 | **Aplica a:** cualquier nuevo módulo o tabla que se agregue

---

## Contexto

La base de datos de la intranet usa **schemas de PostgreSQL** para separar dominios funcionales. Esta guía explica por qué, cómo se aplicó la migración de Mayo 2026, y cómo replicar el patrón en futuros desarrollos.

---

## Arquitectura de schemas

| Schema   | Propósito                                       | Tablas principales                                      |
|----------|-------------------------------------------------|---------------------------------------------------------|
| `public` | Tablas transversales (auth, consentimientos)    | `consentimientos`                                       |
| `people` | Gestión de personas / usuarios                  | `user_profiles`                                         |
| `fleet`  | Gestión vehicular                               | `vehicle_reservations`, `vehicle_inspections`           |
| `siembra`| Módulo de siembra / encuesta predial            | `familias`, `predios`, `evaluaciones_campo`, `monitoreos`, `fotos_predio` |
| `ras`    | Módulo de conservación RAS                      | `familias`, `monitoreos`, `camaras_trampa`, `fotos_predio` |

**Regla:** cada nuevo módulo va en su propio schema. No usar `public` salvo para tablas genuinamente transversales.

---

## Pasos para aplicar la migración en Supabase

> **Orden importante:** primero el SQL (crea los schemas), luego el Dashboard (los expone).
> Los schemas `people` y `fleet` no aparecen en la lista de Supabase hasta que existan en la BD.

### Paso 1 — Ejecutar el SQL de migración

En **Supabase Dashboard → SQL Editor**, pegar y ejecutar el archivo:

```
docs/sql/migration_schemas_people_fleet.sql
```

El script hace en orden:
1. Crea/actualiza la función `sync_user_profile()` apuntando a `people.user_profiles`
2. Recrea los triggers sobre `auth.users`
3. Crea los schemas `people` y `fleet`
4. Mueve las tablas (`ALTER TABLE ... SET SCHEMA`)
5. Otorga permisos (`GRANT USAGE`, `GRANT ALL`)
6. Hace backfill de usuarios sin perfil
7. Ejecuta queries de verificación

### Paso 2 — Exponer los nuevos schemas en Supabase Dashboard

Ahora que los schemas ya existen en la BD, aparecen en la lista de la API:

1. Ir a **Supabase Dashboard → Project → Settings → API**
2. En el selector de schemas, buscar y marcar `people` y `fleet`
3. Guardar — PostgREST se reinicia en ~30 segundos

> ⚠️ Sin este paso, las queries desde la app retornan error `PGRST106: schema not found`.

### Paso 3 — Verificar

Al final del script aparecen dos queries de verificación. El resultado esperado:

```
fleet  | vehicle_inspections
fleet  | vehicle_reservations
people | user_profiles
```

Y para los triggers:
```
on_auth_user_created   | auth | users
on_auth_user_signed_in | auth | users
```

### Paso 4 — Desplegar el código

El código de la app ya fue actualizado antes de este paso. Deployar normalmente:

```bash
git merge claude/nervous-chebyshev-2db26e
npm run build
```

---

## Qué cambió en el código (Mayo 2026)

### Patrón anterior (roto tras migración)

```typescript
// ❌ Ya no funciona — tabla movida a schema 'people'
const { data } = await supabase.from('user_profiles').select('*')

// ❌ Ya no funciona — tablas movidas a schema 'fleet'
const { data } = await supabase.from('vehicle_reservations').select('*')
const { data } = await supabase.from('vehicle_inspections').select('*')
```

### Patrón correcto

```typescript
// ✅ Correcto — especificar schema antes de .from()
const { data } = await supabase.schema('people').from('user_profiles').select('*')
const { data } = await supabase.schema('fleet').from('vehicle_reservations').select('*')
const { data } = await supabase.schema('fleet').from('vehicle_inspections').select('*')
```

El método `.schema('nombre')` está disponible en `@supabase/supabase-js` v2+. Requiere que el schema esté expuesto en la configuración de PostgREST (Paso 1).

### Archivos modificados

Se actualizaron **37 referencias** en 28 archivos:

| Tabla                  | Schema nuevo | Referencias cambiadas |
|------------------------|--------------|----------------------|
| `user_profiles`        | `people`     | 27                   |
| `vehicle_reservations` | `fleet`      | 6                    |
| `vehicle_inspections`  | `fleet`      | 4                    |

---

## Cómo crear un nuevo módulo con su propio schema

### 1. Crear el schema y tabla en SQL

```sql
-- Crear schema
CREATE SCHEMA IF NOT EXISTS nombre_modulo;

-- Otorgar permisos (siempre incluir estos tres roles)
GRANT USAGE ON SCHEMA nombre_modulo TO anon, authenticated, service_role;
GRANT ALL   ON ALL TABLES    IN SCHEMA nombre_modulo TO anon, authenticated, service_role;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA nombre_modulo TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA nombre_modulo
  GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA nombre_modulo
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Crear tabla dentro del schema
CREATE TABLE nombre_modulo.mi_tabla (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now()
);

-- RLS (siempre activar)
ALTER TABLE nombre_modulo.mi_tabla ENABLE ROW LEVEL SECURITY;
```

### 2. Exponer el schema en Supabase Dashboard

Dashboard → Settings → API → Extra schemas → agregar `nombre_modulo`.

### 3. Usar el schema en el código

```typescript
// Consulta
const { data, error } = await supabase
  .schema('nombre_modulo')
  .from('mi_tabla')
  .select('*')

// Insert
const { data, error } = await supabase
  .schema('nombre_modulo')
  .from('mi_tabla')
  .insert({ campo: valor })

// Desde API route (server-side)
const supabase = createServerSupabaseClient()
const { data } = await supabase
  .schema('nombre_modulo')
  .from('mi_tabla')
  .select('*')
```

### 4. Documentar en SUPABASE_SCHEMAS.md

Agregar la nueva tabla en la sección correspondiente del archivo `SUPABASE_SCHEMAS.md`.

---

## Notas sobre RLS y foreign keys

- **RLS:** al hacer `ALTER TABLE SET SCHEMA`, las políticas RLS se transfieren automáticamente con la tabla. No se pierden.
- **Sequences:** los `DEFAULT gen_random_uuid()` y `SERIAL` también se transfieren.
- **Foreign keys entre tablas del mismo schema:** se preservan (ej: `fleet.vehicle_inspections.reservation_id → fleet.vehicle_reservations.id`).
- **Foreign keys cross-schema:** funcionan, pero requieren referenciar el schema explícito en la definición: `REFERENCES otro_schema.otra_tabla(id)`.
- **Triggers sobre `auth.users`:** la función trigger debe incluir `people` en su `search_path` si referencia `people.user_profiles` (ya implementado en `sync_user_profile()`).

---

## Referencia rápida — schemas activos (Mayo 2026)

```
public.consentimientos          ← 4 filas
public.proyecciones             ← 3 filas
people.user_profiles            ← 13 filas
fleet.vehicle_reservations      ← 30 filas
fleet.vehicle_inspections       ← 3 filas
fleet.vehicle_documents         ← 4 filas (una por vehículo, fechas pendientes de llenar)
ejecutivo.sesiones              ← 1 fila
ejecutivo.indicaciones          ← 2 filas (nota + rechazado activos)
siembra.predios                 ← 6 filas
siembra.familias                ← 9 filas
siembra.evaluaciones_campo      ← 10 filas
siembra.monitoreos              ← 1 fila
siembra.camaras_trampa          ← 0 filas
siembra.fotos_camara            ← 0 filas
siembra.fotos_predio            ← 9 filas
ras.familias                    ← 17 filas
ras.monitoreos                  ← 0 filas
ras.camaras_trampa              ← 0 filas
ras.fotos_camara                ← 0 filas
ras.fotos_predio                ← 0 filas

⏳ PENDIENTE (ver pending.sql + juridica/CONTEXTO_MODULO_JURIDICO.md):
juridica.aliados                ← schema nuevo
juridica.antecedentes           ← schema nuevo
juridica.analisis_juridico      ← schema nuevo
siembra.familias.aliado_id      ← columna FK nueva
```
