# Ecosistema de Proyectos — Amazonia Emprende

> **Fecha:** Mayo 2026 · **Actualizado (parcial):** 2026-07-23 — ver nota abajo.
> **Proyecto Supabase compartido:** `lbxysovesmbgesxooghw` (usado por todos salvo los indicados)
>
> **Este archivo es el mapa de carpetas/stack — para arquitectura y estado real de los datos, la fuente
> de verdad es [`ARQUITECTURA_DATOS.md`](ARQUITECTURA_DATOS.md) y [`EMPEZAR_AQUI.md`](EMPEZAR_AQUI.md).**
> Este documento tiende a quedarse atrás porque no se toca en cada sesión — si algo aquí contradice esos
> dos, gana el más reciente.

---

## Mapa de proyectos

| Carpeta | Nombre | Stack | Supabase | Estado |
|---------|--------|-------|----------|--------|
| `Intranet-AE/` | Intranet AE | Next.js 16, React 19, Tailwind 4 | ✅ mismo proyecto | En producción |
| `GeoAE/` | Geovisor AE | Next.js, Leaflet | ✅ mismo proyecto (service role server-side) | En producción — capa Siembra desactualizada, ver `../../GeoAE/CLAUDE.md` |
| `amazonia-emprende-web/` | Sitio público AE | HTML estático autocontenido (`index.html`) | ❌ no toca Supabase | Landing institucional (marca 2024) — repo propio en GitHub |
| `app_campo/` | PWA Campo (AE-CAMPO) | React + Vite, Dexie (offline), Supabase anon | ✅ mismo proyecto | **App productiva desde 2026-07-08** — reconectada a `core`/`geo` |
| `familias-res/` | PWA Campo — versión anterior | React + Vite, Dexie (offline) | ✅ mismo proyecto | **Prueba de concepto, superada por `app_campo/`** (pendiente decidir si se archiva) |
| `amazonia-escuela-bosque/` | Escuela Bosque | Next.js, pnpm | ❌ sin `.env`, sin integración Supabase en el código | En desarrollo |
| `app_vivero/` | App Vivero | — (sin código aún) | ❌ sin conexión Supabase | Por construir / hoy solo Excel |
| `modelo-web/` | Modelo Web | HTML + CSS + JS vanilla, ONNX | ❌ sin Supabase | Prototipo de teledetección (5 bandas), desconectado |

> **`juridica/` ya no es una carpeta aparte.** El módulo se implementó **dentro de `Intranet-AE/`**
> (rutas `/intranet/juridica`, schema `juridica` sobre `core`) y está **en producción** desde 2026-06-19.
> La sección "Módulo Jurídico" más abajo describe el diseño original (Fase 1) — el estado real está en
> `ARQUITECTURA_DATOS.md` §3.2.

---

## Intranet AE (`Intranet-AE/`)

**Propósito:** Plataforma interna de gestión corporativa. Centraliza flota vehicular, campo ambiental, seguimiento ejecutivo y administración de usuarios.

**Autenticación:** Microsoft 365 / Azure AD (OAuth via Supabase)

**URL esquemas Supabase:** `people`, `fleet`, `ejecutivo`, `siembra`, `ras`, `public`, `core`, `geo`, `catalogo`, `juridica` (los últimos 4 se agregaron después de mayo 2026 — ver `ARQUITECTURA_DATOS.md`)

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

**Conexión Supabase:** mismo proyecto (`lbxysovesmbgesxooghw`), service role server-side vía `/api/geovisor-data`. Lee:
- `siembra.familias` → columnas propias + identidad (`nombre_propietario`, `nombre_finca`, `municipio`, `vereda`) resuelta con un segundo query a `core.predios`/`core.aliados` por `predio_id` (fix 2026-07-16, tras el rediseño de `migration_campo_core.sql` — detalle en `../../GeoAE/CLAUDE.md`)
- `siembra.camaras_trampa` → lat/lon, identidad resuelta igual que arriba vía `familias.predio_id`
- `ras.familias` → `shapefile_finca_url`, `shapefile_conservacion_url` (sin cambios, vigente)
- `ras.camaras_trampa` → lat/lon (vigente)

**Buckets de Storage:** `siembra-shapefiles`, `ras-shapefiles` (acceso público).

**Documentación:** `CONTEXTO_GEOVISOR.md` (en `Intranet-AE/docs/`) — desactualizado en la parte de `siembra.familias` (describe las columnas de identidad como si siguieran en esa tabla); el código ya no las usa así, ver `GeoAE/lib/queries.ts`.

---

## PWA Campo (`app_campo/`) — productiva desde 2026-07-08

**Propósito:** Aplicación web progresiva para trabajo de campo sin internet. Un predio solo aparece si
Jurídica aprobó + SIG subió zonas + se pulsó "Enviar a Campo" (SIG I obligatorio). Módulos: SIG (verificar/
corregir zonas, SIG II), Evaluación AE-CAMPO-001, Encuesta Predial.

**Tecnología:** React + Vite, Dexie.js (IndexedDB offline), `@supabase/supabase-js`, Leaflet + leaflet-geoman, turf.

**Offline → Supabase (al sincronizar):** lee `core.v_predios_campo` (vista angosta sobre `core.*`) +
RPC `geo.zonas_de_predio`; escribe correcciones de zona **solo** vía RPC `geo.revisar_zona`; evaluación →
`siembra.evaluaciones_campo`; encuesta → `siembra.familias` (ninguna identidad se duplica, todo por FK a `core`).

**Acceso Supabase:** anon key, sin login (RLS vía la vista + RPCs SECURITY DEFINER, no acceso directo a `core.*`).

**Detalle completo:** `../../app_campo/CONTEXTO_APP_CAMPO.md` y `../../app_campo/CLAUDE.md`.

### `familias-res/` — versión anterior, superada

Fue la prueba de concepto (registrar predios "en blanco", sin conexión al flujo Jurídica→SIG). Quedó
desactualizada tras `migration_campo_core.sql` (asume `siembra.predios`, que ya no existe). Pendiente
decidir si se archiva — no usarla como referencia de arquitectura actual.

---

## App Vivero (`app_vivero/`)

**Propósito:** Gestión de germinación del vivero. Actualmente basado en un Excel (`vivero_germinacion.xlsx`) y un prototipo Node.js sin conexión a Supabase.

**Estado:** Prototipo inicial. No conectado al ecosistema Supabase.

---

## Escuela Bosque (`amazonia-escuela-bosque/`, `Escuela bosque/`)

**Propósito:** Plataforma educativa / landing de la escuela de campo.

**Estado:** En desarrollo. Stack Next.js con pnpm. No tiene `.env` visible en el repo.

---

## Sitio público (`amazonia-emprende-web/`)

**Propósito:** Sitio oficial de presentación de Amazonía Emprende (landing institucional): las dos escuelas (Bosque y Páramo), Centro de Semillas Nativas, ecosistema tecnológico y cursos.

**Tecnología:** Página estática autocontenida (`index.html`) con la identidad de marca 2024 embebida (paleta, Josefin Sans + Poppins, isotipo de huella).

**Estado:** Repo git propio (`github.com/Alejandrombermudez/amazonia-emprende-web`). No toca Supabase. Se sirve en cualquier host estático (GitHub Pages / Vercel / Netlify).

---

## Modelo Web (`modelo-web/`)

**Propósito:** Prototipo de teledetección — clasificador de especies forestales (5 especies) a partir de imágenes multiespectrales de **5 bandas** `[B, G, R, RE, NIR]`. Ensemble de dos modelos ONNX (EfficientNet + ResNet) corriendo client-side. Rol en el ecosistema: insumo de SIG I (zonas potenciales).

**Tecnología:** HTML/CSS/JS vanilla + `onnxruntime-web`; pesos servidos desde HuggingFace (`AlejandroBermudez123/especies-arboreas`).

**Estado:** Prototipo **desconectado** — no lee ni escribe en Supabase. Detalle: `../../modelo-web/CLAUDE.md`.

---

## Módulo Jurídico (`juridica/`)

**Propósito:** Captura de debida diligencia jurídica realizada por la abogada antes de autorizar la visita de campo al equipo RAS. Centraliza identificación del aliado, revisión de listas restrictivas (Procuraduría, OFAC, INTERPOL...) y análisis del folio de matrícula inmobiliaria.

**Origen del requerimiento:** Excel `Libro(Fase 1).csv` con 3 hojas/módulos.

**Estado: ✅ en producción desde 2026-06-19**, dentro de `Intranet-AE/` (ruta `/intranet/juridica`,
no una carpeta aparte). El diseño original se ajustó al cutover a `core`: la identidad de persona/predio
salió de `juridica.aliados` (que se archivó y luego se borró) y ahora vive en `core.aliados`/`core.predios`.

**Tablas reales (schema `juridica`, sobre `core`):**
- `juridica.debida_diligencia` — workflow + soportes, 1:1 con `core.predios` (HOJA 1)
- `juridica.antecedentes` — 14 listas restrictivas + PEP + prensa, 1:1 con `core.aliados` (HOJA 2)
- `juridica.analisis_juridico` — folio matrícula + semáforo, 1:1 con `core.predios` (HOJA 3)

**Punto clave de integración:** evita reprocesos. Los datos básicos capturados en jurídica se leen por JOIN
desde `core` en las etapas siguientes (SIG, Campo vía `core.v_predios_campo`) — no se copian a mano.
Detalle completo: `ARQUITECTURA_DATOS.md` §3.2 y `CORE_MIGRACION.md`.

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
