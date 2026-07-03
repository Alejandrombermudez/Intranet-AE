# Modelo `core` y migración — Semana 1

> **Fecha:** 2026-06-18 · **SQL:** [`sql/migration_core.sql`](sql/migration_core.sql) · **Arquitectura:** [`ARQUITECTURA_ECOSISTEMA.md`](ARQUITECTURA_ECOSISTEMA.md) §4 (D1/D2)
>
> Entregable de la Semana 1 del cronograma: el modelo central (aliados, predios, expedientes) y el mapeo desde las tablas actuales. **Jurídica es la puerta de entrada**: crea la persona, el predio y abre el expediente.

---

## 1. El modelo

```
core.aliados            PERSONA (natural | jurídica)        — identidad única por documento
   │ 1
   │ N  (dueño principal: core.predios.aliado_id)
   ▼
core.predios            PREDIO                              — matrícula, catastral, área, ubicación
   │ 1                       ▲ N
   │                         │  core.predio_propietarios (N—N: copropiedad)
   │ 1
   ▼
core.expedientes        PROCESO del predio                 — etapa, línea, fase, responsable

Cuelgan del predio / persona (dominio jurídico):
  juridica.debida_diligencia   1:1 predio   — estado DD + manifestación + PDFs + cédula
  juridica.analisis_juridico   1:1 predio   — folio de matrícula + semáforo
  juridica.antecedentes        1:1 persona  — 14 listas restrictivas + PEP + prensa
```

**Por qué así:**
- La **persona** se identifica y se veta **una vez** (antecedentes cuelga de `core.aliados`), aunque traiga varios predios.
- El **folio** (`analisis_juridico`) y la **DD** son **del predio** → cuelgan de `core.predios`.
- El **expediente** es la máquina de estados del predio en el proceso completo (jurídica → SIG → campo → plan → aval → ejecución). Decisión D1 (a).

---

## 2. Mapeo campo a campo: `juridica.aliados` (viejo) → modelo `core`

La tabla vieja mezclaba 3 entidades. Cada campo va a:

| `juridica.aliados` (legacy) | → | Destino |
|---|---|---|
| `nombre_completo` | → | `core.aliados.nombre_completo` |
| `tipo_documento` | → | `core.aliados.tipo_documento` |
| `numero_documento` | → | `core.aliados.numero_documento` (UNIQUE) |
| *(detección NIT)* | → | `core.aliados.tipo_persona` = `juridica` si `tipo_documento='NIT'`, si no `natural` |
| `nombre_predio` | → | `core.predios.nombre_predio` |
| `departamento` | → | `core.predios.departamento` |
| `municipio` | → | `core.predios.municipio` |
| `vereda` | → | `core.predios.vereda` |
| `zona_ae` | → | `core.predios.zona_ae` |
| `matricula_inmobiliaria` | → | `core.predios.matricula_inmobiliaria` |
| `codigo_catastral` | → | `core.predios.codigo_catastral` |
| `area_registral` | → | `core.predios.area_registral` |
| *(propietario principal)* | → | `core.predio_propietarios` (predio, aliado, rol=`principal`) |
| *(nuevo expediente)* | → | `core.expedientes` (predio, etapa=`juridica`, estado=`activo`) |
| `estado` | → | `juridica.debida_diligencia.estado` |
| `certificado_tradicion_url` | → | `juridica.debida_diligencia.certificado_tradicion_url` |
| `recibo_predial_url` | → | `juridica.debida_diligencia.recibo_predial_url` |
| `anio_ultimo_pago_predial` | → | `juridica.debida_diligencia.anio_ultimo_pago_predial` |
| `manifestacion_interes` | → | `juridica.debida_diligencia.manifestacion_interes` |
| `manifestacion_observaciones` | → | `juridica.debida_diligencia.manifestacion_observaciones` |
| `manifestacion_url` | → | `juridica.debida_diligencia.manifestacion_url` |
| *(nuevo)* | → | `juridica.debida_diligencia.cedula_url` — escaneo del documento (pendiente histórico) |
| `created_by`, `created_at` | → | se conservan en cada tabla destino |

`juridica.antecedentes`: misma estructura, su `aliado_id` ahora apunta a **`core.aliados`**.
`juridica.analisis_juridico`: misma estructura, deja de tener `aliado_id` y pasa a tener **`predio_id` → `core.predios`**.

---

## 3. Por qué NO migramos los datos actuales

Los datos en `juridica`, `siembra` y `ras` son de **prueba** (ejercicio para el geovisor, confirmado con dirección): basura tipo `"frf"/"frfr"` marcada `aprobado`, documentos como `"17634957, Florencia"` (cédula+ciudad pegadas), familias duplicadas. No hay producción que preservar.

**Decisión:** no se hace backfill de filas. `juridica.aliados` se **renombra** a `juridica.aliados_legacy` (queda como referencia, reversible) y `core` arranca vacío. La abogada entra los datos reales mañana directo al modelo bueno. El mapeo de arriba queda documentado por si en el futuro hubiera datos reales que migrar.

---

## 4. Tablas de campo (siembra/ras)

Datos de prueba — no se reestructuran ahora. Solo se dejan los enganches listos:
- `siembra.familias.aliado_id` repuntado a `core.aliados`; nuevo `siembra.familias.expediente_id` → `core.expedientes`.
- `ras.familias` recibe `aliado_id` y `expediente_id` (→ core) opcionales.
- La fusión `siembra`+`ras` en `intervenciones` (D3) quedó **DESCARTADA (2026-06-27)**: son dominios separados (Siembra = restauración; RAS = conservación).

---

## 5. Runbook del cutover

1. **SQL Editor**: ejecutar [`sql/migration_core.sql`](sql/migration_core.sql) completo. Revisar el BLOQUE 14 (verificación).
2. **Supabase Dashboard → Settings → API → Exposed schemas**: agregar `core` (después de correr el SQL; dispara la recarga de PostgREST). Sin esto la app da "schema must be one of…".
3. **App (ya reescrita en este cutover):** las rutas de `/api/juridica/*` escriben a `core.*` + `juridica.debida_diligencia`. Las 6 páginas no cambiaron (consumen el caso plano). Probar el flujo: crear aliado+predio → antecedentes → análisis → aprobar.
4. **Verificar** que `crear-en-siembra` enlaza al expediente y avanza la etapa a `campo`.
5. Eliminar el archivo viejo: correr [`sql/cleanup_legacy.sql`](sql/cleanup_legacy.sql) (`DROP TABLE juridica.aliados_legacy`). ✅ hecho.

**Estado (2026-06-19): COMPLETO.** SQL corrido, `core` expuesto, `juridica.aliados_legacy` borrada, y la columna `analisis_juridico.acto_adquisicion_actual` eliminada. **Verificado con un caso real** (persona Arnulfo Silva → predio Los Andes → expediente → DD aprobada con 4 documentos → antecedentes → análisis verde). Reglas de negocio probadas: documento único (1 persona por documento), matrícula única (no duplica predios), `crear-en-siembra` enlaza al expediente. Extras añadidos después del cutover: subida de **imagen/Word** además de PDF, y eliminación del campo "acto de adquisición actual".

**Cómo está hecho (código):**
- `lib/juridica-core.ts` — `getCaso` / `listCasos` (reensamblan el "caso plano" desde `core`), `findOrCreateAliado` (reusa persona por documento → modelo 1—N), `subirDocumento` (PDF/imagen/Word).
- Rutas `/api/juridica/aliados/*` — reparten la escritura a `core.aliados` + `core.predios` + `core.predio_propietarios` + `core.expedientes` + `juridica.debida_diligencia`; antecedentes por persona, análisis por predio. **El `[id]` de la UI = `predio_id`.**
- Las 6 páginas de `/intranet/juridica` **no cambiaron de contrato** (siguen consumiendo el caso plano).

**Cambio de comportamiento a tener en cuenta:** si la abogada captura un documento que ya existe, el sistema **reutiliza la persona** y crea otro predio (modelo 1—N), en vez de rechazar por "documento duplicado". Lo que evita predios duplicados es la matrícula (única).

---

## 6. Pendientes que esto cierra / abre

- ✅ Cierra: `cedula_url` (estaba en PENDIENTES de jurídica).
- ✅ Cierra: separación persona/predio (D2) y expediente (D1) para jurídica.
- ⏳ Abre: cuando entren datos reales en SIG/campo, enlazar `siembra.familias.expediente_id` y poblar `core.expedientes.etapa` al avanzar el proceso.
- ⏳ Difiere: copropiedad tiene tabla (`core.predio_propietarios`) pero la UI de jurídica de momento solo captura el dueño principal.
