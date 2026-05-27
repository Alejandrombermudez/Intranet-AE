# Ecosistema de Proyectos — Amazonia Emprende

> **Fecha:** Mayo 2026
> **Proyecto Supabase compartido:** `lbxysovesmbgesxooghw` (usado por todos salvo los indicados)

---

## Mapa de proyectos

| Carpeta | Nombre | Stack | Supabase | Estado |
|---------|--------|-------|----------|--------|
| `Intranet-AE/` | Intranet AE | Next.js 16, React 19, Tailwind 4 | ✅ mismo proyecto | En producción |
| `GeoAE/` | Geovisor AE | Next.js, Leaflet/Mapbox | ✅ mismo proyecto | En producción |
| `familias-res/` | PWA Campo (AE-CAMPO) | React + Vite, Dexie (offline) | ✅ mismo proyecto | En producción |
| `amazonia-escuela-bosque/` | Escuela Bosque | Next.js | ❓ sin .env visible | En desarrollo |
| `app_vivero/` | App Vivero | Node.js | ❌ sin conexión Supabase | Prototipo / Excel |
| `modelo-web/` | Modelo Web | HTML + CSS + JS vanilla | ❌ sin Supabase | Template estático |
| `juridica/` | Módulo Jurídico (Fase 1) | (futuro: Next.js dentro de Intranet) | ⏳ Schema `juridica` pendiente | Documentado, SQL listo, sin código aún |

---

## Intranet AE (`Intranet-AE/`)

**Propósito:** Plataforma interna de gestión corporativa. Centraliza flota vehicular, campo ambiental, seguimiento ejecutivo y administración de usuarios.

**Autenticación:** Microsoft 365 / Azure AD (OAuth via Supabase)

**URL esquemas Supabase:** `people`, `fleet`, `ejecutivo`, `siembra`, `ras`, `public`

**Documentación interna:**
- `SUPABASE_SCHEMAS.md` — estructura completa de BD con conteos actuales
- `docs/INTRANET_DESCRIPCION.md` — descripción funcional por módulo
- `docs/GUIA_MIGRACION_SCHEMAS.md` — cómo crear nuevos schemas
- `docs/CONTEXTO_GEOVISOR.md` — contexto para integrar el geovisor
- `docs/sql/` — migraciones SQL (ejecutadas e historial)

---

## Geovisor AE (`GeoAE/`)

**Propósito:** Visualización geoespacial de fincas, polígonos de restauración/conservación y cámaras trampa.

**Tecnología:** Next.js, Leaflet o Mapbox GL JS, `shpjs` para parsear shapefiles ZIP.

**Conexión Supabase:** mismo proyecto (`lbxysovesmbgesxooghw`), usa anon key. Lee:
- `siembra.familias` → `shapefile_finca_url`, `shapefile_restauracion_url`
- `siembra.camaras_trampa` → lat/lon
- `ras.familias` → `shapefile_finca_url`, `shapefile_conservacion_url`
- `ras.camaras_trampa` → lat/lon

**Buckets de Storage:** `siembra-shapefiles`, `ras-shapefiles` (acceso público).

**Documentación:** `CONTEXTO_GEOVISOR.md` (en `Intranet-AE/docs/`)

---

## PWA Campo (`familias-res/`)

**Propósito:** Aplicación web progresiva para trabajo de campo sin internet. Permite registrar predios, evaluaciones AE-CAMPO-001 y encuestas prediales. Al recuperar señal, sincroniza con Supabase.

**Tecnología:** React + Vite, Dexie.js (IndexedDB offline), `@supabase/supabase-js`

**Offline → Supabase (al sincronizar):**
- `db.familias` (Dexie) → `siembra.predios` (FK padre)
- `db.predios` (Dexie) → `siembra.evaluaciones_campo` + `siembra.familias` (upsert dual)
- `db.encuestas` (Dexie) → `siembra.familias` (encuesta socioeconómica)
- `db.evaluaciones` (Dexie) → `siembra.evaluaciones_campo`
- `db.photos` (Dexie) → Storage bucket `campo-fotos` → URL en JSONB de la evaluación

**Acceso Supabase:** usa anon key + RLS especiales que permiten INSERT/UPDATE sin auth (la PWA no usa login).

**Versiones del schema Dexie (IndexedDB):**
- v1: evaluaciones + photos
- v2: + encuestas
- v3: + predios
- v4: + familias (relación familia → evaluación/encuesta)
- v5: + supabase_id en todas las tablas (para merge colaborativo)

---

## App Vivero (`app_vivero/`)

**Propósito:** Gestión de germinación del vivero. Actualmente basado en un Excel (`vivero_germinacion.xlsx`) y un prototipo Node.js sin conexión a Supabase.

**Estado:** Prototipo inicial. No conectado al ecosistema Supabase.

---

## Escuela Bosque (`amazonia-escuela-bosque/`, `Escuela bosque/`)

**Propósito:** Plataforma educativa / landing de la escuela de campo.

**Estado:** En desarrollo. Stack Next.js con pnpm. No tiene `.env` visible en el repo.

---

## Modelo Web (`modelo-web/`)

**Propósito:** Template HTML/CSS/JS estático para sitio institucional o prototipo de landing.

**Estado:** Estático, sin backend.

---

## Módulo Jurídico (`juridica/`)

**Propósito:** Captura de debida diligencia jurídica realizada por la abogada antes de autorizar la visita de campo al equipo RAS. Centraliza identificación del aliado, revisión de listas restrictivas (Procuraduría, OFAC, INTERPOL...) y análisis del folio de matrícula inmobiliaria.

**Origen del requerimiento:** Excel `juridica/Libro(Fase 1).csv` con 3 hojas/módulos.

**Estado:**
- 📄 Contexto funcional completo: `juridica/CONTEXTO_MODULO_JURIDICO.md`
- 💾 Migración SQL lista: `Intranet-AE/docs/sql/migration_modulo_juridico.sql`
- ⏳ Pendiente ejecutar en Supabase + implementar frontend en Intranet

**Tablas que creará el módulo:**
- `juridica.aliados` — datos básicos + catastrales + manifestación de interés (HOJA 1)
- `juridica.antecedentes` — 14 listas restrictivas + PEP + prensa (HOJA 2)
- `juridica.analisis_juridico` — folio matrícula + semáforo final (HOJA 3)
- `siembra.familias.aliado_id` — FK opcional para prellenar la encuesta de campo desde el aliado aprobado

**Punto clave de integración:** evita reprocesos. Los 6 campos básicos (nombre, cédula, departamento, municipio, vereda, nombre del predio) capturados en el módulo jurídico se prellenan automáticamente en la encuesta de campo cuando RAS crea la familia.

---

## Variables de entorno compartidas

Todos los proyectos conectados al mismo Supabase usan:

```env
SUPABASE_URL=https://lbxysovesmbgesxooghw.supabase.co
SUPABASE_ANON_KEY=eyJhbG...  # clave pública (safe para frontend)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # solo en servidor/API routes
```

> La `SUPABASE_SERVICE_ROLE_KEY` nunca debe exponerse en el cliente.
> Solo `Intranet-AE` y `GeoAE` tienen `.env.local` con service role.

---

## Patrones comunes de acceso a BD

```typescript
// Siempre especificar schema (no usar .from() directo sin schema)
supabase.schema('siembra').from('familias').select(...)
supabase.schema('ras').from('familias').select(...)
supabase.schema('people').from('user_profiles').select(...)
supabase.schema('fleet').from('vehicle_reservations').select(...)
supabase.schema('ejecutivo').from('sesiones').select(...)
// public no necesita .schema()
supabase.from('consentimientos').select(...)
supabase.from('proyecciones').select(...)
```
