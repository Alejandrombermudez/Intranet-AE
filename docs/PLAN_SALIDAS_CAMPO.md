# Salidas a campo: entrega, consumo, devolución y cierre de materiales

> Plan, 2026-10-28. **Nada de esto está construido todavía.**
> Pedido de la Dirección Financiera y Administrativa (correo del 2026-10-23, después de conciliar a mano el
> primer piloto de siembra en tres predios de Morelia). Su hoja de conciliación —hojas «Resumen» y
> «Conciliación»— es el formato que este módulo tiene que producir solo.

## Qué se pide

1. Que todo movimiento de materiales, herramientas, insumos y EPP quede en la intranet, no en informes de texto.
2. Por cada elemento: entrega inicial (fecha, cantidad y acta), compras o entregas adicionales, consumo en campo,
   saldo devuelto y la bodega donde queda (Morelia, Florencia, Escuela Bosque u otra), y responsable.
3. Ningún faltante sin explicación escrita: si se consumió, si quedó instalado, si se dañó o si lo tiene alguien.
4. Actas firmadas de entrega y devolución como soporte.
5. Separar dotación personal (se la queda el trabajador) de EPP y herramientas (se devuelven), según defina
   SG-SST, con acta individual firmada por cada trabajador.
6. Reportes en hoja de cálculo.

## Lo que ya existe y se reutiliza

El inventario de `migration_financiero_inventario.sql` ya hace casi todo el movimiento; falta la idea de
**salida** y de **persona**.

- Kardex `inventario.movimientos` (entrada, traslado, consumo, ajuste; nada se borra) y saldo calculado en
  `inventario.v_existencias`, que **admite negativos**.
- Facturas DIAN → entrada a cualquier bodega.
- Envíos entre bodegas con aceptación (`trasladar`, `recibir_traslado`, `campo_trasladar`, `campo_recibir`).
- Consumo desde la app de campo: cada registro de actividad descuenta de la bodega elegida.
- Ajuste por conteo físico, que ya exige motivo.
- PDF en el navegador con la plantilla de `lib/talento-pdf.ts` (jsPDF); `xlsx` y `jszip` ya instalados;
  `lib/comprimir-pdf.ts` para aligerar escaneos; bucket privado con URL firmada (patrón de facturas).

## Estado de la base (lectura por REST, 2026-10-27)

- El kardex solo tiene las 15 entradas de la carga inicial de facturas, todas en **Recepción**. Ningún envío,
  consumo ni ajuste. Las bodegas de proyecto están vacías.
- Cero registros en la app de campo; solo el título SIEMBRA tiene clave.
- `people.personas` tiene 3 personas y exige correo de la organización: **los trabajadores de campo no están
  y no caben ahí.**

## Supuestos (no bloquean el código; se confirman con Administrativa)

- **Bodegas por lugar:** Morelia, Florencia y Escuela Bosque, más Recepción como central. Las de proyecto se
  desactivan (están vacías). Es un cambio de datos desde la pantalla «Insumos y bodegas», no de código.
- **La clase de cada elemento la define SG-SST.** Mientras tanto se carga la que sugiere la hoja del piloto
  (impermeable, guantes, gafas = EPP que vuelve; tapabocas = consumible).

## La idea

**Una salida a campo es una bodega más, con responsable y fechas.** Lo que el equipo tiene a cargo es el saldo
de esa bodega:

- Entregar = envío de la bodega de origen a la salida, con acta.
- Compra adicional = otro envío con acta, o una factura que entra directo a la salida.
- Consumir = registro de actividad en la app (o consumo manual en la intranet).
- Devolver = envío de la salida a una bodega física, que **cuenta al recibir**.
- Cerrar = todo lo que siga en el saldo se explica con un motivo de lista. Con saldo pendiente sin explicar o
  un acta sin firmar, la salida no se cierra.

**Cada trabajador que recibe EPP o herramientas tiene su propia bodega «a cargo de»**, que se crea sola. Así la
intranet responde en cualquier momento qué tiene cada quien, y al terminar un contrato puede dar el paz y salvo.

## Modelo de datos — `docs/sql/migration_salidas_campo.sql` (una sola migración, la corre el usuario)

| Cambio | Para qué |
|---|---|
| `inventario.insumos.clase` ∈ `consumible`, `herramienta`, `epp`, `dotacion` (por defecto `consumible`) | Qué se espera al cerrar: lo consumible se gasta, lo demás vuelve, la dotación se queda con el trabajador. En pantalla el catálogo pasa a llamarse «Elementos»; la tabla no se renombra |
| `people.trabajadores_campo` (nombres, apellidos, documento único, celular, cargo, `persona_id` opcional → `people.personas`, activo) | El responsable de una salida y quien firma un acta de EPP no tiene correo de la organización |
| `inventario.bodegas`: `tipo` admite `persona`; columna `trabajador_id` (única) | La bodega «a cargo de» cada trabajador |
| `inventario.salidas` (nombre, proyecto, `predio_ids` → `core.predios`, `responsable_id` → trabajador, `bodega_id` → su bodega tipo `campo`, `bodega_retorno_id`, fecha de salida, fecha de cierre, estado `abierta`/`cerrada`, notas, quién creó y quién cerró) | La salida en sí |
| `inventario.actas` (número consecutivo por tipo y año —`ENT-2026-001`, `ADI-`, `DEV-`, `EPP-`, `CIE-`—, tipo, salida, trabajador que firma, fecha, `datos` jsonb con la foto fija de lo que dice el acta, ruta del escaneo firmado, firmada sí/no) + bucket privado `inventario-actas` | Soporte de cada entrega, adicional, devolución, EPP individual y cierre |
| `inventario.movimientos`: `acta_id`; `motivo` ∈ `consumido`, `instalado`, `danado`, `perdido`, `dotacion`, `sobrante`, `conteo` | Cada movimiento sabe en qué acta va; los ajustes de cierre llevan motivo de lista además de la nota |
| Vista `inventario.v_conciliacion_salida` | La hoja «Conciliación» de Administrativa, calculada (ver abajo) |
| Funciones solo `service_role`: `crear_salida`, `registrar_acta` (acta + sus movimientos en una transacción), `recibir_contando` (acepta lo contado; la diferencia se queda en la salida), `justificar` (ajuste con motivo, o envío a la bodega de un trabajador si «lo tiene alguien»), `cerrar_salida` | Todo pasa por funciones para que acta y movimientos no queden a medias |
| `inventario.campo_datos`: agrega `clase` a cada insumo | Solo se **agrega** un campo: la app que ya está instalada sigue funcionando |

`crear_salida` agrega la bodega de la salida al título de campo que se elija, para que la app descuente de ahí;
`cerrar_salida` la quita.

### La conciliación (por salida y elemento)

Columnas: entregado inicial · adicional · total a cargo · consumido en la app · devuelto (y a qué bodega) ·
a cargo de trabajadores · justificado (por motivo) · **diferencia = saldo de la salida** · estado.

Los estados de la hoja del piloto, calculados:

| Estado en la hoja | Cuándo lo pone el sistema |
|---|---|
| Cuadra | Saldo 0 y nada justificado a mano |
| Consumido en campo | Consumible cuyo saldo se fue en consumos de la app o justificados como consumido/instalado. Se muestra aparte cuánto explica la app y cuánto se declaró: responde la pregunta de la hoja «¿fue el consumo que arroja el app?» |
| Sin uso (devuelto completo) | Consumible con devuelto = total |
| Sin reporte de devolución | Herramienta o EPP con saldo > 0 |
| A cargo del personal | Está en la bodega de un trabajador; «sin acta» si su acta EPP no está firmada |
| Pendiente conteo físico | Devolución enviada que la bodega todavía no recibe contando |
| Devuelto de más / sin registro de entrega | Saldo negativo: se pide justificar (`sobrante`, de dónde venía) |
| Falta justificar | Cualquier diferencia sin motivo. Reemplaza «Por verificar» y «Faltante crítico»: no deja cerrar |

## Pantallas

**Intranet — Administrativa, pestaña nueva «Salidas a campo»** (`PUEDE.financiero`, como el resto):

- **Lista:** abiertas y cerradas, responsable, predios, días en campo, elementos a cargo, filas sin justificar.
- **Ficha de la salida:** la conciliación en vivo y los botones *Entrega inicial*, *Entrega adicional*,
  *Devolución*, *EPP a un trabajador* y *Cerrar*. Cada acta se arma con elementos y cantidades, genera el PDF
  con la plantilla de la organización para imprimir y firmar, y después se sube el escaneo. Hasta entonces
  queda en ámbar «sin firma». *Descargar Excel* produce las dos hojas del formato de Administrativa.
- **Trabajadores de campo:** la lista, y la ficha de cada uno con lo que tiene a cargo, sus actas y el paz y salvo.
- **Elementos (catálogo):** columna y filtro por clase.
- **Inventario:** las bodegas de salidas y de trabajadores no se mezclan con las físicas. Van en grupos aparte,
  plegados.
- **Facturas:** las salidas abiertas aparecen entre las bodegas que reciben, para compras que van directo a campo.

**App de campo (`actividades_monitoreo_campo`):**

- El registro de actividad ofrece solo elementos consumibles: ni herramientas ni EPP.
- Durante la salida, el título ve su bodega y descuenta de ahí. Devolver con foto del acta ya funciona con
  «Enviar traslado».
- Subir `VERSION` en `sw.js`.

## Fases (cada una se despliega sola)

1. **Catálogo y bodegas** (pequeña): migración completa; clase en el catálogo; cargar los ~46 elementos de la
   hoja del piloto; bodegas por lugar; la app filtra por clase.
2. **Salidas y actas** (la grande): trabajadores de campo (solo la lista); crear salida; entrega inicial,
   adicional y devolución con acta en PDF y escaneo firmado; recibir contando; consumo desde la app.
3. **Conciliación y cierre:** la vista, la justificación obligatoria, cerrar, Excel.
4. **EPP y trabajadores:** bodega a cargo de cada trabajador, acta individual de EPP, dotación, paz y salvo.
   Necesita la definición de SG-SST.
5. **Prueba con el piloto:** cargar el piloto como una salida, con sus fechas y actas reales, y comparar con la
   hoja hecha a mano. Tienen que salir los mismos faltantes (7 impermeables, los postes por contar, el EPP sin
   devolución).

Pruebas: la migración se corre dos veces en PGlite y las funciones se prueban con `service_role` y con `anon`
(que no debe poder llamarlas).

## Lo que no es código (lo hacen personas)

- Registrar la compra adicional de 10-30-10 que no está en el sistema.
- Ponerles clave a los títulos BODEGA y MONITOREO, y que la próxima salida use la app desde el primer día.
- Nucleación del predio La Guajira: sin núcleos, la app no puede registrar actividades ahí.
- SG-SST: la clase de cada elemento de protección y de dotación.

## Cuidado

- **Repo público:** los trabajadores (nombres, documentos) se cargan desde la pantalla, nunca en un `.sql` del repo.
- **App de campo en uso:** los cambios a `campo_*` son aditivos; no se quita ni se renombra nada que lea el celular.
- **Fechas:** `hoyColombia()` en las rutas y `(now() AT TIME ZONE 'America/Bogota')::date` en SQL.
- **Actas:** bucket privado, URL firmada desde el servidor y compresión del escaneo antes de subirlo.
