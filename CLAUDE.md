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
- **Municipio, vereda y zona AE se guardan normalizados** (`normalizarMunicipio` / `normalizarVereda` / `normalizarZonaAe` de `lib/veredas-caqueta.ts`, Tipo Título en español). Se hace **en el servidor**, en las rutas que escriben `core.predios`, no solo en el formulario: si se guarda el valor como llega, los filtros del tablero SIG vuelven a partir el mismo municipio en "MORELIA" y "Morelia" (pasó hasta el 2026-09-17, con 111 predios ya cargados).
- **Nunca hardcodear la service_role key ni ninguna key.** Se lee de `.env` (gitignored). Confirma que exista antes de escribir un script que la use — no la pidas ni la imprimas.
- **Toda API route identifica a quien llama por el token de sesión, nunca por un correo que manda el cliente.** En el servidor: `exigirSesion(req, supabase, PUEDE.xxx)` de `lib/auth-api.ts` (el correo para `created_by` sale de `sesion.perfil.email`). En el navegador: `fetchConSesion` de `lib/fetch-sesion.ts`. Hasta el 2026-09-14, 18 rutas autorizaban con `?email=`/`created_by`/`requesterEmail` y 3 no verificaban nada: sin iniciar sesión se podía leer todo jurídica, reporte y SIG, y darse administrador. No volver a copiar ese patrón.

## Sistema visual — Manual de Identidad de Marca 2024

Toda la intranet habla el lenguaje del módulo Reporte: Josefin Sans para títulos, Poppins para el cuerpo,
papel y tinta, verde bosque como color firma, filetes finos en vez de cajas de color. Dónde vive:

- **`app/globals.css`** — la paleta del manual con nombre propio (`bg-bosque`, `text-tenue`, `border-linea`…)
  y, ojo, **las familias estándar de Tailwind remapeadas a la marca**: `stone`/`gray` → neutros cálidos,
  `primary`/`emerald`/`teal`/`green` → verde bosque, `amber`/`yellow` → ámbar, `orange` → marrón,
  `red`/`rose` → arcilla, `sky`/`blue`/`cyan`/`indigo` → pizarra, `violet`/`purple` → musgo.
  **`bg-red-500` no es rojo.** Los radios (2–4 px) y las sombras tenues también salen de ahí.
- **`app/components/marca/`** — las piezas: `Cabecera` (la banda en tinta de cada módulo), `Contenido`,
  `Pestanas`, `Seccion`, `Boton`, `MarcaEstado`, `Aviso`, `Cargando`, `Vacio`, `Firma`. Una pantalla nueva
  empieza por `Cabecera` + `Contenido`. No escribas colores en hexadecimal: usa la paleta con nombre.
- **Los mapas no pasan por la paleta, a propósito.** Los colores de campo (confirmada, modificada, nueva,
  descartada) viven en `lib/colores-campo.ts` —sin Leaflet, para poder importarlos en el render del
  servidor— y los leen tanto `MapaCampo` como las leyendas. Tienen que leerse sobre el satelital.
- **Si cambias `globals.css` y no se ve el cambio:** Turbopack puede quedarse sirviendo el CSS de caché
  (pasó el 2026-09-11). Detén el servidor, borra `.next` y vuelve a arrancar.

## Rutas / módulos (`app/`)

| Ruta | Módulo | Schema |
|---|---|---|
| `/intranet/juridica` | Debida diligencia, antecedentes, análisis jurídico | `juridica` sobre `core` |
| `/intranet/sig` | Tablero por **fase cartográfica** (sin cartografía / falta zonificar / listo para campo / en campo) — las tarjetas son los filtros. Lo alimenta `/api/sig/worklist`. **Fusionar predios** arma *unidades de siembra* (varios predios, un solo polígono) vía `/api/sig/grupos`: agrupa, no funde — cada predio conserva matrícula, dueño y expediente, y el polígono total lo lleva el predio principal | `geo`, `core` |
| `/intranet/sig/[predioId]` | Ingesta de shapefile (por **lotes versionados**, no destructiva) + pestaña **"Resultados de campo"** (mapa antes/después, bitácora, formularios) vía `/api/sig/campo` —y, desde 2026-09-23, donde el SIG **decide** sobre cada zona: confirmar, editar (vértices sobre el satelital con leaflet-geoman, o límite cargado de un `.zip`) o eliminar, vía `geo.decidir_zonas`— + pestaña **"Nucleación"**: confirmar lotes de siembra y subir los núcleos (`/api/sig/lotes`, `/api/sig/nucleacion`). Descarga a `.shp` con `lib/exportar-zonas.ts` | `geo`, `siembra` |
| `/intranet/expedientes` | Tablero "¿en qué etapa va cada predio?" | `core.expedientes` |
| *(no hay módulo «Siembra», y es correcto)* | Siembra es el **proceso** —jurídica → SIG → campo → SIG II—, no una pantalla. Existía una lista de encuestas heredada en `/intranet/ras/siembra`: rota desde el rediseño del 2026-07-07 (pedía columnas que se movieron a `core`) y redundante. **Se borró el 2026-09-20** junto con `/intranet/ras/nueva` y las rutas `/api/ras/familias/*`, que pese al nombre escribían en `siembra.*`. La encuesta se ve en la pestaña «Resultados de campo» del predio y completa en el Reporte; el departamento `Siembra` entra por el **Reporte**. **La tabla `siembra.familias` NO se tocó**: ahí están las encuestas reales de terreno | — |
| `/intranet/ras`, `/intranet/ras/conservacion` | Conservación / Red de Árboles Semilleros | `ras` |
| `/intranet/catalogo` | Catálogo de especies | `catalogo` |
| `/intranet/reporte`, `/intranet/reporte/[predioId]` | **Módulo Reporte**: expediente completo del predio en un solo documento (predial, jurídica, cartografía, correcciones de terreno, evaluación biofísica, encuesta). Se arma solo desde `/api/reporte/expediente`; diseñado sobre el Manual de Identidad de Marca 2024 (Josefin Sans + Poppins, paleta hueso/verde bosque) y pensado para imprimir | `core`, `juridica`, `geo`, `siembra` |
| `/intranet/sistema`, `/intranet/sistema/documentacion` | **Mapa del sistema**: el ecosistema completo (Siembra + Conservación + núcleo + soporte) como diagrama de tarjetas al estilo entidad-relación, con tres vistas: **Resumen** (la de entrada — cinco navcards con un conteo cada una: aplicaciones, módulos, **Siembra** y **Conservación** por separado —no una sola tarjeta de «etapas»: son dos dominios que no comparten tablas ni flujo, y un conteo común insinuaría lo contrario— y piezas del núcleo. Al tocar una, esa tarjeta pasa al centro y lo que contiene se abre en cuadros de colores; cada cuadro abre esa cosa: la app en su dirección, el módulo en su pantalla, y la etapa o la pieza en el centro de Explorar — `resumen.tsx`), **Explorar** (una tarjeta pasa al centro con lo que la toca alrededor, animado con transiciones de CSS, y se recorre de una en una — `escena.tsx`) y **Comparar** (se eligen varias y el panel dice cómo se comunican y qué comparten — `lienzo.tsx` + `panel.tsx`), y la **bitácora** (decisiones, cambios, frentes abiertos) con lector de los `docs/*.md`. El grafo vive en `lib/sistema/mapa.ts`; las líneas y el análisis de varias tarjetas se deducen de él en `lib/sistema/relaciones.ts` (no se escriben a mano); la posición de cada tarjeta está en `app/intranet/sistema/disposicion.ts` — **una etapa, app o pieza nueva necesita ahí su lugar o no se dibuja**; las cifras **no se escriben a mano** — salen de `/api/sistema/pulso`, que las cuenta en Supabase al abrir la página, y los conteos de las navcards del Resumen se derivan de las listas del mapa (`.length`), no se escriben; la dirección de despliegue de cada app está en `APLICACIONES[].url` de `lib/sistema/mapa.ts` y **se verifica antes de escribirla** —una app sin despliegue confirmado se deja sin `url` y el Resumen no ofrece el enlace—; los departamentos y su módulo viven en `lib/departamentos.ts`, que comparten el hub y el Resumen. Reemplaza a `docs/flujo-trabajo.html`/`.pdf`, que se desactualizó en tres semanas por llevar los números dentro del SVG. Se entra por el tab **Tecnología** del hub: lo ve todo admin (transversal, como Reporte) y quien tenga ese departamento llega directo | lee `core`, `geo`, `catalogo`, `siembra`, `ras`, `people` — solo conteos |
| `/intranet/ejecutivo` | Sesiones/indicaciones ejecutivas | `ejecutivo` |
| `app/api/juridica/aliados/[id]/crear-en-siembra` | Paso SIG→Campo: valida SIG I obligatorio, crea `siembra.familias`, avanza expediente | `core`, `geo`, `siembra` |

## "Lote" significa UNA sola cosa (desde 2026-09-20)

- **Lote de siembra**: la zona que el SIG dio por buena después de campo (`geo.zonas.estado = 'definitiva'`),
  el pedazo de tierra donde se siembra y sobre el que va la nucleación. Es como le dice el equipo en campo.
- **Carga** (`geo.zonas_carga`, `abrir_carga`, `cerrar_carga`, `zonas.carga_id`): una **subida** del SIG con
  su versión, el mecanismo del versionado ("backup 1, backup 2…").

Hasta el 2026-09-20 las dos cosas se llamaban "lote". Se renombró la subida a *carga*
(`migration_renombrar_carga.sql`) antes de que la nucleación pusiera las dos acepciones en la misma
pantalla: la palabra del negocio gana y la maquinaria cede. **Si ves `zonas_lote`, `abrir_lote`,
`cerrar_lote` o `p_lote_id` en algún lado, es código viejo.**

Queda pendiente la misma cirugía con **"RAS"**, que todavía significa tres cosas: el schema `ras.*`
(Conservación), el equipo RAS en los diagramas del proceso, y el departamento/rutas `/intranet/ras/*`. El
El daño más visible ya se atendió: `/intranet/ras/siembra` servía datos de `siembra.*` protegido por
`department === 'RAS'`, y se borró con el resto de ese módulo el 2026-09-20 — igual que las rutas
`/api/ras/familias/*`, que se llamaban «ras» y escribían en `siembra.*`. Queda el schema, el departamento y
las rutas. Plan acordado: `ras` → `conservacion`, con vistas de compatibilidad porque **GeoAE también lee
`ras.*`** y está desplegado.

## El terreno verifica, el SIG decide (regla de negocio del SIG ↔ Campo)

Hasta el 2026-09-23 la regla era «el terreno tiene la última palabra». Lo que la cambió no fue un cambio de
criterio sino el final del recorrido, que faltaba: lo que vuelve de campo no entra solo al plan de siembra:
el SIG lo mira y responde si va. En «Resultados de campo» **confirma** cada zona (queda como lote,
`estado='definitiva'`, aunque campo la haya descartado), la **edita** (límite nuevo, también lote) o la
**elimina** (`vigente=false`, `'descartada'` — no se borra).

**Lo que no cambió: ninguna versión se destruye.** Cada subida del SIG es una **carga versionada**
(`geo.zonas_carga`) y lo reemplazado queda consultable; `geo.revisar_zona` **nunca falla** porque el SIG
haya cambiado algo (revive la zona retirada, o la recrea con la copia que manda el celular); `cerrar_carga`
no retira zonas que campo ya trabajó — las marca en `geo.v_zonas_conflicto`; y lo que hizo el técnico se
queda entero en `geo.zona_revision`, que es lo que leen el informe, el tablero y el pulso. La decisión de
oficina va aparte, en `geo.zona_decision`, guardando el estado y la geometría de ANTES. Si campo vuelve a
esa zona después, su revisión se aplica como siempre y vuelve a quedar pendiente de decisión.

El RPC es `geo.decidir_zonas`, **solo `service_role`** — pasa por `/api/sig/campo`, que exige sesión y saca
el correo del token. Se niega si la zona no tiene revisión de campo (una propuesta que nadie visitó no se
decide ahí) y si el lote ya tiene núcleos cargados. Detalle en `docs/ARQUITECTURA_DATOS.md` §2.2 y
`docs/CONTEXTO_MODULO_SIG.md`.

## Estado vivo — no lo memorices, verifícalo

**Antes de escribir una cifra en cualquier documento, míralo en `/intranet/sistema`.** Esa página cuenta
contra Supabase en el momento. Los documentos de `docs/` se han contradicho entre sí por llevar conteos a
mano: en septiembre de 2026, `ARQUITECTURA_DATOS.md` §4.2 daba `ras.arboles_semilleros` por construir,
`SUPABASE_SCHEMAS.md` decía 523 filas y la base tenía **2.115**. Si vas a dejar un número escrito, ponle
fecha o no lo pongas.

`docs/sql/pending.sql` lleva la lista de migraciones que **aún no se han corrido** en producción.
Verificado por REST el **2026-09-23: no queda ninguna de esquema pendiente** — la última en correr fue
`migration_decision_sig.sql`, que además cerró lo que quedaba de `migration_predio_grupos_v2.sql`.
Antes de asumir que una tabla/columna existe, verifica por REST en vez de confiar en un doc que puede estar desactualizado.
