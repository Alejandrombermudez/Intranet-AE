# Intranet AE

Next.js 16 (App Router) + React 19 + Tailwind 4 + Supabase (`lbxysovesmbgesxooghw`), auth Microsoft 365/Azure AD.
Es el hub del ecosistema: aquí viven **jurídica, SIG, expedientes, RAS/conservación, flota, ejecutivo** — y los
documentos maestros de arquitectura de todo el ecosistema (no solo de esta app).

## Antes de escribir código — orden de lectura

1. [`docs/EMPEZAR_AQUI.md`](docs/EMPEZAR_AQUI.md) — punto de entrada, qué leer y en qué orden.
2. [`docs/ARQUITECTURA_DATOS.md`](docs/ARQUITECTURA_DATOS.md) — ER completo, todas las tablas/PK/FK, estado por entidad. **La base para cualquier cambio de datos.**
3. [`docs/ARQUITECTURA_ECOSISTEMA.md`](docs/ARQUITECTURA_ECOSISTEMA.md) — las 4 vistas (proceso/dominios/apps/datos) y decisiones D1–D5.
4. [`docs/PENDIENTES_INTEGRACION.md`](docs/PENDIENTES_INTEGRACION.md) — backlog vivo por módulo.
5. `SUPABASE_SCHEMAS.md` — introspección de producción. **Ojo:** desactualizado para `siembra.familias`/`evaluaciones_campo` tras el rediseño del 2026-07-07 (ver nota en `ARQUITECTURA_DATOS.md` §3.3).

## Reglas no negociables

- **Nunca ejecutar DDL contra Supabase.** Las migraciones son archivos en `docs/sql/` que **el usuario** corre en el SQL Editor. Tu trabajo es escribir/actualizar el `.sql` y, si hace falta verificar, hacerlo por **lectura** vía REST (patrón `_query.mjs` en `SUPABASE_SCHEMAS.md`), nunca DDL.
- **Dos dominios separados:** `siembra.*` (proceso Restauración) y `ras.*` (Conservación) no se fusionan — decisión cerrada (D3 descartada). No propongas unificarlos.
- **`core.*` es el núcleo canónico** (persona=`core.aliados`, predio=`core.predios`, proceso=`core.expedientes`). Jurídica ya escribe sobre `core`. Los demás módulos **referencian** `predio_id`/`aliado_id`/`expediente_id` — no copian nombre/municipio/vereda/etc. Si ves un módulo guardando esos campos por su cuenta, es deuda del rediseño, no el patrón a seguir.
- **Siempre especificar schema** en las queries: `supabase.schema('siembra').from('familias')...` (excepto `public`).
- **Nunca hardcodear la service_role key ni ninguna key.** Se lee de `.env` (gitignored). Confirma que exista antes de escribir un script que la use — no la pidas ni la imprimas.

## Rutas / módulos (`app/`)

| Ruta | Módulo | Schema |
|---|---|---|
| `/intranet/juridica` | Debida diligencia, antecedentes, análisis jurídico | `juridica` sobre `core` |
| `/intranet/sig` | Tablero por **fase cartográfica** (sin cartografía / falta zonificar / listo para campo / en campo) — las tarjetas son los filtros. Lo alimenta `/api/sig/worklist` | `geo`, `core` |
| `/intranet/sig/[predioId]` | Ingesta de shapefile (por **lotes versionados**, no destructiva) + pestaña **"Resultados de campo"** (mapa antes/después, bitácora, formularios) vía `/api/sig/campo`. Descarga a `.shp` con `lib/exportar-zonas.ts` | `geo`, `siembra` |
| `/intranet/expedientes` | Tablero "¿en qué etapa va cada predio?" | `core.expedientes` |
| `/intranet/ras/siembra`, `/intranet/ras/conservacion` | Encuesta/evaluación de campo (legado `siembra.*`) y conservación (`ras.*`) | `siembra`, `ras` |
| `/intranet/catalogo` | Catálogo de especies | `catalogo` |
| `/intranet/reporte`, `/intranet/reporte/[predioId]` | **Módulo Reporte**: expediente completo del predio en un solo documento (predial, jurídica, cartografía, correcciones de terreno, evaluación biofísica, encuesta). Se arma solo desde `/api/reporte/expediente`; diseñado sobre el Manual de Identidad de Marca 2024 (Josefin Sans + Poppins, paleta hueso/verde bosque) y pensado para imprimir | `core`, `juridica`, `geo`, `siembra` |
| `/intranet/ejecutivo` | Sesiones/indicaciones ejecutivas | `ejecutivo` |
| `app/api/juridica/aliados/[id]/crear-en-siembra` | Paso SIG→Campo: valida SIG I obligatorio, crea `siembra.familias`, avanza expediente | `core`, `geo`, `siembra` |

## El terreno tiene la última palabra (regla de negocio del SIG ↔ Campo)

La oficina propone zonas, la persona parada en el predio dispone, y **ninguna de las dos versiones se
destruye**. Traducido a datos: cada subida del SIG es un **lote versionado** (`geo.zonas_lote`), lo
reemplazado queda `vigente=false` y consultable; `geo.revisar_zona` **nunca falla** porque el SIG haya
cambiado algo (revive la zona retirada, o la recrea con la copia que manda el celular); y `cerrar_lote`
no retira zonas que campo ya trabajó — las marca en `geo.v_zonas_conflicto` para resolverlas mirando las
dos. Detalle en `docs/ARQUITECTURA_DATOS.md` §2.2 y `docs/CONTEXTO_MODULO_SIG.md`.

## Estado vivo — no lo memorices, verifícalo

`docs/sql/pending.sql` lleva la lista de migraciones que **aún no se han corrido** en producción.
Verificado por REST el **2026-08-12: no queda ninguna pendiente** — todas las escritas están aplicadas.
Antes de asumir que una tabla/columna existe, verifica por REST en vez de confiar en un doc que puede estar desactualizado.
