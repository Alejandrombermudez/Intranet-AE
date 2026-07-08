# Base de Datos — Intranet Amazonia Emprende

> **Última actualización:** 2026-07-06 | Proyecto Supabase: `lbxysovesmbgesxooghw`
> Para seguimiento de migraciones SQL ver `docs/sql/` (historial de lo ejecutado en `docs/sql/pending.sql`)
>
> **Últimas migraciones ejecutadas:** `migration_ras_arboles.sql` + `seed_ras_arboles.sql` (2026-07-01) — tabla `ras.arboles_semilleros` normalizada (523 árboles, FK a `catalogo.especies`). Antes, `migration_catalogo.sql` + `seed_catalogo_especies.sql` (2026-06-30) — maestro único `catalogo.especies` (148 especies). Ver secciones **`catalogo`** y **`ras`** abajo.
>
> **Modelo actual:** Jurídica es la puerta de entrada y escribe sobre `core` (persona/predio/expediente). `catalogo.especies` es el dato maestro que comparten Conservación (RAS), Vivero y Plan — no se duplica taxonomía en ninguna otra tabla.

---

## Cómo correr queries desde el terminal

| Schema | Módulo | Estado |
|--------|--------|--------|
| `auth` | Autenticación *(Supabase managed)* | ✅ Gestionado por Supabase |
| `public` | Tablas transversales (`consentimientos`, `proyecciones`) | ✅ En uso |
| `people` | Gestión de usuarios | ✅ Migrado y en producción |
| `fleet` | Flota vehicular | ✅ En producción — `vehicle_documents` creada (4 filas) |
| `ejecutivo` | Módulo ejecutivo | ✅ En producción — columna `nota` y estado `rechazado` activos |
| `siembra` | Módulo Restauración / Siembra | ✅ Ejecutado en producción |
| `ras` | Módulo Conservación | ✅ En producción — `familias` (17) + `arboles_semilleros` (523, normalizada vía `catalogo.especies`) |
| `catalogo` | Maestro único de especies | ✅ En producción — `especies` (148 filas), compartida por `ras`, vivero y plan |
| `core` | Núcleo canónico (aliados/predios/expedientes) | ✅ En producción — jurídica escribe aquí |
| `juridica` | Módulo Jurídico (Fase 1) | ✅ En producción — sobre `core`; guarda solo `debida_diligencia` + `antecedentes` + `analisis_juridico` |
| `geo` | Geoportal / SIG (zonas PostGIS) | ✅ En producción — `zonas` (3 filas) + función unir zonas (`v3`) |
| `storage` | Buckets *(Supabase managed)* | ✅ Buckets creados |

```js
// _query.mjs (borrar después de usar)
import { createClient } from '@supabase/supabase-js'
const sb = createClient(
  'https://lbxysovesmbgesxooghw.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY  // clave en .env
)
// Schema custom (people, fleet, siembra, ras, ejecutivo)
const { data } = await sb.schema('people').from('user_profiles').select('*')
console.log(JSON.stringify(data, null, 2))
```
```bash
node _query.mjs
```

---

## Storage Buckets (todos públicos)

| Bucket | Módulo | Contenido |
|--------|--------|-----------|
| `siembra-shapefiles` | Siembra | Polígonos .zip (finca + área en restauración) |
| `siembra-fotos-camara` | Siembra | Fotos de cámaras trampa |
| `ras-shapefiles` | Conservación | Polígonos .zip (finca + área en conservación) |
| `ras-fotos-camara` | Conservación | Fotos de cámaras trampa |
| `inspection-photos` | Flota | Fotos de inspecciones vehiculares |
| `campo-fotos` | PWA Campo (familias-res) | Fotos y firmas de evaluaciones AE-CAMPO-001 |

---

## Schema `public` — Tablas generales

### `consentimientos` — Tratamiento de datos (4 filas)
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `nombre` | text |
| `apellido` | text |
| `cedula` | text |
| `celular` | text |
| `correo` | text |
| `acepta_tratamiento` | boolean |
| `acepta_politicas` | boolean |
| `created_at` | timestamptz |

### `proyecciones` — Metas por proyecto (3 filas)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `nombre` | text | Ej: "Fase I · 2026–2030" |
| `subtitulo` | text | |
| `descripcion` | text | |
| `year_inicio` / `year_fin` | integer | |
| `ha_objetivo` / `ha_ejecutado` | numeric | |
| `ha_conservacion` / `ha_restauracion` | numeric | |
| `plantulas_objetivo` / `plantulas_ejecutadas` | integer | |
| `familias_vinculadas` | integer | |
| `municipios_clave` | text[] | |
| `color` | text | HEX para UI |
| `shapefile_url` | text | |
| `orden` | integer | orden en UI |
| `activo` | boolean | |
| `created_at` | timestamptz | |

**Fases activas (Mayo 2026):**
- Fase I · 2026–2030 — Piedemonte Andino-Amazónico — 13.000 ha objetivo / 980 ejecutadas
- Fase II · 2030–2035 — Cuencas del Caguán — 140.000 ha objetivo / 1.840 ejecutadas
- Fase III · 2035–2050 — Corredor Chiribiquete — 750.000 ha objetivo / 0 ejecutadas

---

## Schema `people` — Usuarios

### `people.user_profiles` — Perfiles internos (13 filas)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `email` | text | único |
| `full_name` | text | |
| `role` | text | |
| `department` | text | `RAS` \| `Ejecutivo` \| `Financiero` \| null |
| `is_admin` | boolean | acceso total al panel admin |
| `can_access_intranet` | boolean | acceso al módulo propio sin ser admin |
| `last_login` | timestamptz | |
| `created_at` | timestamptz | |

**Usuarios activos (Mayo 2026):**

| Email | Nombre | Departamento | Admin |
|-------|--------|-------------|-------|
| tecnologia@amazoniaemprende.com | Alejandro Bermudez | Ejecutivo | ✅ |
| mariafernanda@amazoniaemprende.com | Maria Fernanda Alvarez | Financiero | ✅ |
| julioandres@amazoniaemprende.com | Julio Andrés Rozo Grisales | Ejecutivo | ✅ |
| juliehernandez@amazoniaemprende.com | Julie Hernandez | RAS | ✅ |
| profesional.restauracion@... | Profesional Restauración | RAS | ❌ |
| logistica@amazoniaemprende.com | Katys Blanquicet | Financiero | ❌ |
| comunicaciones@amazoniaemprende.com | Comunicaciones AE | — | ❌ |
| nataliavalderrama@... | Natalia Valderrama | — | ❌ |
| monicasarmiento@... | Monica Sarmiento | — | ❌ |
| finanzas@amazoniaemprende.com | Rocío Ruíz | — | ❌ |
| *(3 cuentas Gmail externas)* | sin perfil | — | ❌ (sin acceso) |

> Los 3 usuarios con email Gmail (deivyortizvalderrama, jv200769, dussanherediay) no tienen perfil completo ni acceso a la intranet. Se registraron vía OAuth pero no fueron habilitados.

**Trigger:** `on_auth_user_created` y `on_auth_user_signed_in` sobre `auth.users` → sincroniza a `people.user_profiles`.

---

## Schema `fleet` — Flota vehicular

### `fleet.vehicle_reservations` — Reservas (30 filas)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `vehicle_id` | text | |
| `vehicle_name` | text | |
| `user_name` | text | |
| `user_email` | text | |
| `start_date` | date | |
| `end_date` | date | |
| `purpose` | text | formato `[Proyecto] Actividad` |
| `created_at` | timestamptz | |

**Vehículos activos:** Chevrolet Samurai, Camioneta Foton (bloqueada lun-mar), Susuki DR 150, Yamaha XTZ-150.

### `fleet.vehicle_inspections` — Inspecciones (3 filas)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `reservation_id` | uuid FK → vehicle_reservations | |
| `inspection_type` | text | `recepcion` \| `devolucion` |
| `step_completed` | integer | paso del wizard (1–7) |
| `submitted_at` | timestamptz | null si no completada |
| `kilometraje` | integer | |
| `cat1_status` … `cat6_status` | text | `ok` \| `novedad` |
| `cat1_issues` … `cat6_issues` | text[] | lista de novedades |
| `cat1_other` … `cat6_other` | text | campo libre por categoría |
| `photo_frontal` | text | URL en bucket inspection-photos |
| `photo_posterior` | text | |
| `photo_lateral_izq` | text | |
| `photo_lateral_der` | text | |
| `photo_tablero` | text | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | auto-actualizado por trigger |

### `fleet.vehicle_documents` — Documentos por vehículo (4 filas)
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `vehicle_id` | text |
| `vehicle_name` | text |
| `soat_expiry` | date |
| `tecnomecanica_expiry` | date |
| `updated_at` | timestamptz |
| `updated_by` | text |

**Vehículos registrados:** Chevrolet Samurai, Camioneta Foton, Susuki DR 150, Yamaha XTZ-150. Las fechas de SOAT y Tecnomecánica están en null — se deben llenar desde el panel admin (`/intranet/admin`).

---

## Schema `ejecutivo` — Módulo ejecutivo

### `ejecutivo.sesiones` — Sesiones de seguimiento (1 fila)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `iniciado_por` | uuid FK → people.user_profiles | usuario que crea la sesión |
| `ejecutivo_id` | uuid FK → people.user_profiles | ejecutivo de la sesión |
| `persona_id` | uuid FK → people.user_profiles | persona a quien va dirigida |
| `titulo` | text | |
| `fecha` | date | |
| `notas` | text | notas generales de la sesión |
| `cerrada` | boolean | false = activa |
| `created_at` / `updated_at` | timestamptz | |

### `ejecutivo.indicaciones` — Ítems de acción (2 filas)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `sesion_id` | uuid FK → sesiones | |
| `bloque` | text | `ejecutivo` \| `colaborador` |
| `descripcion` | text | |
| `plataforma` | text | Slack, Notion, WhatsApp, etc. |
| `estado` | text | ver flujo abajo |
| `orden` | integer | |
| `created_at` / `updated_at` | timestamptz | |
| `nota` | text | Razón de rechazo o cancelación (nullable) |

**Flujo de estados por bloque:**
- `bloque = ejecutivo`: `pendiente` → `hecho` → `cancelado`
- `bloque = colaborador`: `pendiente` → `marcado` (colaborador marca hecho) → `confirmado` (ejecutivo confirma) | `cancelado`
- `rechazado` también disponible tras ejecutar v2


**Índices:** `idx_sesiones_ejecutivo`, `idx_sesiones_persona`, `idx_sesiones_iniciado`, `idx_sesiones_fecha`, `idx_indicaciones_sesion`, `idx_indicaciones_bloque`.

---

## Schema `siembra` — Módulo Restauración / Siembra

### Diagrama de relaciones
```
predios (6 filas)
  ├── familias (9 filas, FK: predio_id)
  │     ├── monitoreos (1 fila)
  │     ├── camaras_trampa (0 filas)
  │     │     └── fotos_camara (0 filas)
  │     └── fotos_predio (9 filas)
  └── evaluaciones_campo (10 filas, FK: predio_id)
```

### `siembra.predios` — Predios registrados en campo (6 filas)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `local_id` | text | ID generado offline en PWA |
| `nombre_predio` | text | |
| `nombre_propietario` | text | |
| `municipio` | text | |
| `vereda` | text | |
| `departamento` | text | |
| `fecha` | date | |
| `contacto` | text | |
| `num_zonas` | integer | zonas de restauración |
| `created_by` | text | |
| `sync_origin` | text | `web` \| `mobile` \| `pwa` |
| `created_at` / `updated_at` | timestamptz | |

> Todos los predios actuales tienen `sync_origin = 'pwa'` (cargados desde la app offline).

### `siembra.familias` — Encuesta socioeconómica completa (9 filas)

> Tabla principal del módulo. Contiene la encuesta de caracterización predial completa.
> Las columnas `sec_*` guardan snapshots JSON de cada sección del formulario móvil (PWA familias-res).
> La mayoría de los registros actuales tienen `predio_id` vinculado y campos `sec_*` en JSONB.

**Identificación**
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `predio_id` | uuid FK → predios |
| `local_id` | text | ID offline de dispositivo |
| `nombre_propietario` | text |
| `tipo_documento` | text |
| `numero_documento` | text |
| `telefono` | text |
| `nucleo` | text |
| `departamento` | text |
| `municipio` | text |
| `vereda` | text |
| `nombre_finca` | text |

**Metadatos de encuesta**
| Columna | Tipo |
|---------|------|
| `encuesta_no` | text |
| `fecha_encuesta` | date |
| `encuestador` | text |
| `tipo_encuestado` | text |
| `estrato_paisaje` | text |
| `latitud` / `longitud` | text |
| `altitud_msnm` | numeric |

**Predio**
| Columna | Tipo |
|---------|------|
| `ha_total` | numeric |
| `ha_potreros` / `ha_bosque` / `ha_otras` | numeric |
| `ha_restauracion` | numeric |
| `valor_comercial_ha` | numeric |
| `anio_adquisicion` | integer |
| `tendencia_area` | text |
| `cambio_area_ha` | numeric |
| `intencion_vender` | boolean |
| `causas_venta` | text[] |
| `tipo_via` | text[] |
| `tipo_acceso_predio` | text[] |
| `distancia_florencia_km` | numeric |
| `distancia_cabecera_km` | numeric |
| `tiempo_florencia_min` | integer |
| `medio_transporte_produccion` | text |
| `transporte_propio` | boolean |
| `valor_transporte` | numeric |

**Hogar & Familia**
| Columna | Tipo |
|---------|------|
| `adultos` / `ninos` | integer |
| `cant_mujeres` / `cant_hombres` | integer |
| `personas_vivienda` | integer |
| `miembros_familia` | jsonb |
| `tiempo_llegada_region` | text |
| `razon_llegada` | text |
| `poblacion_tendencia` | text |

**Vivienda & Servicios**
| Columna | Tipo |
|---------|------|
| `material_techo` / `material_paredes` / `material_piso` | text |
| `num_habitaciones` | integer |
| `tipo_cocina` | text[] |
| `tipo_bano` | text[] |
| `disposicion_excretas` | text |
| `disposicion_aguas_servidas` | text |
| `manejo_basuras` | text[] |
| `servicios_domiciliarios` | text[] |
| `fuente_agua` | text[] |
| `senal_telefonica` | boolean |

**Salud & Educación**
| Columna | Tipo |
|---------|------|
| `acceso_salud` | boolean |
| `regimen_salud` | text |
| `puesto_salud` | text |
| `acceso_educacion` | boolean |
| `distancia_educacion_km` | numeric |

**Economía**
| Columna | Tipo |
|---------|------|
| `nivel_ingresos` | text |
| `actividad_economica` | text |
| `empleos_locales` | integer |
| `tiene_espacio_vegetal` | boolean |
| `cultivos` | jsonb |
| `problemas_mercado` | text |

**Ganadería**
| Columna | Tipo |
|---------|------|
| `tiene_ganaderia` | boolean |
| `tipo_tenencia_ganado` | text |
| `orientacion_ganaderia` | text[] |
| `num_cabezas_ganado` | integer |
| `ha_ganaderia` | numeric |
| `tipos_pasto` | text[] |
| `litros_leche_dia` | numeric |
| `tanque_enfriamiento` | text |
| `destino_leche` | text[] |
| `precio_leche_litro` | numeric |
| `sistema_alimentacion_ganado` | text |
| `especies_forrajeras` | text |
| `uso_fertilizacion_ganado` | text[] |
| `manejo_praderas` | text[] |
| `infraestructura_ganadera` | text[] |
| `material_postes` | text |
| `ha_pasto_ultimo_anio` | numeric |
| `origen_nuevos_pastos` | text[] |
| `pastoreo_rotacional` / `diversificacion_forrajera` | boolean |
| `cercas_vivas` / `sistemas_silvopastoriles` | boolean |
| `captacion_agua_lluvia` / `manejo_residuos_organicos` | boolean |
| `reduccion_antibioticos` / `espacios_sombra_agua` / `reduccion_estres` | boolean |
| `interes_ganaderia_regenerativa` | boolean |
| `otras_especies_pecuarias` | jsonb |

**Tecnología & Manejo**
| Columna | Tipo |
|---------|------|
| `instalaciones_maquinaria` | text |
| `tiene_tractor` / `tiene_camion` | boolean |
| `manejo_suelo_fertilizacion` | text |
| `tipo_fertilizacion` | text[] |
| `cobertura_arborea` / `practica_podas` / `practica_raleo` | boolean |
| `control_malezas` | text[] |
| `manejo_agua_cultivo` | text |
| `problemas_manejo` | text[] |
| `especies_variedades` | text |
| `lleva_registros_productividad` / `interes_capacitacion` | boolean |
| `temas_capacitacion` | text |

**Bosque & Ambiente**
| Columna | Tipo |
|---------|------|
| `bajo_conservacion` | boolean |
| `num_individuos` | integer |
| `num_especies_inventario` | integer |
| `area_bosque_recorrida` | numeric |
| `aprovecha_bosque` | boolean |
| `productos_forestales` | text |
| `capacitacion_ambiente` | boolean |
| `entidad_capacitacion` | text |
| `especies_bosque_predio` / `especies_fauna_predio` | text |
| `estudio_academico` | boolean |
| `disminucion_especies` | boolean |
| `especies_afectadas` | text |
| `cambios_caudal` | boolean |
| `cambio_cobertura_ha` | numeric |
| `causa_cambio_cobertura` | text[] |
| `problemas_agropecuarios` | text[] |

**Restauración**
| Columna | Tipo |
|---------|------|
| `plan_restauracion` | text |
| `parcelas_monitoreo` | integer |
| `plantulas_sembradas` | integer |
| `especies_sembradas` | integer |

**Asociatividad & Programas**
| Columna | Tipo |
|---------|------|
| `programas_gubernamentales` / `beneficios_programas` / `impacto_programa` | text |
| `opinion_productores` / `aliado_cooperativa` | boolean |
| `nombre_cooperativa` / `beneficio_cooperativa` / `calificacion_gremios` | text |
| `observaciones_generales` | text |

**Archivos**
| Columna | Tipo |
|---------|------|
| `shapefile_finca_url` | text |
| `shapefile_restauracion_url` | text |
| `shapefile_arboles_url` | text |
| `documento_acuerdo_url` | text |

**Snapshots de sección (PWA)**
| Columna | Tipo | Notas |
|---------|------|-------|
| `sec_general` | jsonb | §1 Datos Generales completo |
| `sec_vivienda` | jsonb | §3 Vivienda |
| `sec_familia` | jsonb | §4 Núcleo Familiar |
| `sec_economia` | jsonb | §5 Valorización |
| `sec_cultivos` | jsonb | §6 Cultivos (array) |
| `sec_ganaderia` | jsonb | §6 Ganadería |
| `sec_tecnologia` | jsonb | §7 Tecnología |
| `sec_bosque` | jsonb | §8 Bosque & Clima |

**Sincronización & Auditoría**
| Columna | Tipo | Notas |
|---------|------|-------|
| `sync_origin` | text | `web` \| `mobile` \| `pwa` |
| `step_completed` | integer | sección del form completada |
| `created_by` | text | |
| `created_at` / `updated_at` | timestamptz | |

### `siembra.evaluaciones_campo` — Evaluación técnica de predio (10 filas)
> Formulario AE-CAMPO-001 de evaluación en campo. Vinculado a `predios` (no a `familias` directamente).
> Todos los registros actuales provienen de la PWA (`sync_origin = 'pwa'`).

| Grupo | Columnas clave |
|-------|---------------|
| Identificación | `id`, `predio_id`, `familia_id`, `nombre_predio`, `codigo_formato`, `version` |
| Visita | `fecha_visita`, `evaluador_1`, `evaluador_2`, `codigo_predio`, `num_zonas`, `num_zonas_eval` |
| Conectividad | `senal_celular_eval`, `operador_celular`, `area_zonas_ha`, `tiempo_desde_via` |
| Social | `disposicion_propietario`, `observaciones_sociales`, `mano_obra_disponible`, `experiencia_restauracion` |
| Vegetación | `cobertura_dominante`, `pct_cobertura_boscosa`, `densidad_rastrojo`, `especies_arboreas_alturas`, `regeneracion_natural`, `defaunacion`, `presion_fauna_ganado_eval`, `requiere_proteccion` |
| Suelo | `textura_suelo`, `drenaje_superficial`, `pendiente`, `presencia_roca`, `erosion`, `observaciones_suelo` |
| Agua | `fuente_agua_eval`, `distancia_agua_m` |
| Acceso | `tipo_via_eval`, `medio_acceso_zonas` (array), `tiempo_predio_zona`, `condicion_camino`, `lugar_deposito_material`, `complejidad_acceso`, `descripcion_ruta` |
| Riesgos | `quemas_recientes`, `anio_quema`, `ganado_activo_poligono`, `cabezas_poligono`, `conflictos_tenencia`, `restricciones_uso`, `otros_riesgos` |
| Fotos | `foto_suelo_url`, `foto_drenaje_url`, `foto_pendiente_url`, `foto_erosion_url`, `foto_via_url` |
| Firmas | `firma_eval1_url`, `firma_eval2_url`, `firma_prop_url` |
| Datos JSON | `zonas_data`, `seccion_1_data`, `seccion_2_data`, `seccion_6_data` (jsonb) |
| PWA/Sync | `local_id`, `sync_origin`, `step_completed`, `num_zonas_eval` |
| Auditoría | `created_by`, `created_at`, `updated_at` |

### `siembra.monitoreos` (1 fila)
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `familia_id` | uuid FK → familias |
| `fecha` | date |
| `supervivencia_pct` | numeric (0–100) |
| `created_at` | timestamptz |

### `siembra.camaras_trampa` (0 filas)
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `familia_id` | uuid FK → familias |
| `nombre` | text |
| `latitud` / `longitud` | numeric |
| `created_at` | timestamptz |

### `siembra.fotos_camara` (0 filas)
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `camara_id` | uuid FK → camaras_trampa |
| `url` | text |
| `created_at` | timestamptz |

### `siembra.fotos_predio` (9 filas)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `familia_id` | uuid FK → familias | |
| `categoria` | text | `predio` \| `familia` \| `arboles` \| `otras` |
| `url` | text | URL en bucket |

---

## Schema `ras` — Módulo Conservación

### Diagrama de relaciones
```
familias (17 filas)
  ├── monitoreos (0 filas)
  ├── camaras_trampa (0 filas)
  │     └── fotos_camara (0 filas)
  └── fotos_predio (0 filas)

arboles_semilleros (523 filas) — Red de Árboles Semilleros (RAS)
  ├── familia_id  → ras.familias (nullable — predio/familia anfitrión)
  └── especie_id  → catalogo.especies (taxonomía NUNCA duplicada aquí)
```

### `ras.familias` — Familias en conservación (17 filas)

**Identificación**
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `nombre_propietario` | text |
| `tipo_documento` / `numero_documento` | text |
| `telefono` | text |
| `nucleo` / `departamento` | text |
| `municipio` / `vereda` / `nombre_finca` | text |

**Predio**
| Columna | Tipo |
|---------|------|
| `ha_potreros` / `ha_bosque` / `ha_otras` | numeric |
| `distancia_florencia_km` | numeric |
| `tiempo_florencia_min` | integer |

**Hogar**
| Columna | Tipo |
|---------|------|
| `adultos` / `ninos` | integer |
| `cant_mujeres` / `cant_hombres` | integer |
| `actividad_economica` | text |
| `empleos_locales` | integer |
| `tiene_espacio_vegetal` | boolean |

**Conservación**
| Columna | Tipo |
|---------|------|
| `bajo_conservacion` | boolean |
| `acuerdo_conservacion` | boolean |
| `arboles_semilleros` | integer |
| `especies_forestales` | integer |
| `num_individuos` | integer |
| `num_especies_inventario` | integer |
| `area_bosque_recorrida` | numeric |
| `otros_indices` | text |

**Restauración** *(columnas heredadas — no aplican típicamente en conservación)*
| Columna | Tipo |
|---------|------|
| `plan_restauracion` | text |
| `ha_restauracion` | numeric |
| `parcelas_monitoreo` | integer |
| `plantulas_sembradas` | integer |
| `especies_sembradas` | integer |

**Archivos**
| Columna | Tipo |
|---------|------|
| `shapefile_finca_url` | text |
| `shapefile_conservacion_url` | text |
| `shapefile_arboles_url` | text |
| `documento_acuerdo_url` | text |
| `shapefile_restauracion_url` | text *(legacy)* |

**Auditoría**
| Columna | Tipo |
|---------|------|
| `created_by` | text |
| `created_at` / `updated_at` | timestamptz |

### `ras.monitoreos`, `ras.camaras_trampa`, `ras.fotos_camara`, `ras.fotos_predio`
*(misma estructura que sus homólogos en `siembra` — actualmente sin filas)*

### `ras.arboles_semilleros` — Red de Árboles Semilleros, un registro por árbol (523 filas)

> Fuente de datos: `arboles_para_subir.xlsx` (hoja "Se sube"). Normalizada: la taxonomía
> (nombre científico, género, familia, autor, IUCN…) **no se repite por árbol** — vive una
> sola vez en `catalogo.especies` y se consulta por `especie_id` (join).

**Identidad**
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `codigo` | text | **UNIQUE** — código de placa global |
| `nucleo` / `predio` | text | ej. Piedemonte, Solano |
| `familia_id` | uuid FK → `ras.familias` | predio/familia anfitrión (nullable) |
| `especie_id` | uuid FK → `catalogo.especies` | null si aún no determinada (ver `especie_pendiente`) |
| `especie_pendiente` | text | texto crudo de campo cuando aún no hay match con el catálogo |
| `especie_anterior` | text | determinación previa de campo (histórico) |
| `colecta` | text | voucher de la colecta de este árbol |

**Dendrometría y sitio**
| Columna | Tipo |
|---------|------|
| `cobertura_vegetal` / `pendiente` / `drenaje` / `tipo_suelo` / `forma_fuste` | text |
| `cap_cm` / `dap_cm` / `ab_m2` | numeric |
| `altura_comercial_m` / `altura_total_m` | numeric |
| `clase_copa` | text | dominante \| codominante \| intermedio |
| `copa_x_m` / `copa_y_m` | numeric |
| `especies_asociadas` | text | líquenes / epífitas / lianas (bioindicador) |

**Geo**
| Columna | Tipo | Notas |
|---------|------|-------|
| `latitud` / `longitud` | numeric | |
| `geom` | geometry(Point,4326) | generada automáticamente desde lat/long |

**Monitoreo dron & registro**
| Columna | Tipo |
|---------|------|
| `monitoreo_dron` / `razon_no_dron` / `metodo_colecta` / `metodo_trepa` / `ruta_dron` / `codigo_dron` | — |
| `fecha_registro` / `foto_url` / `origen` / `nombre_registra` / `estado_verificacion` / `observaciones` | — |

`origen` distingue la procedencia del registro: `kobo` \| `csv` \| `manual` \| `Botánica` \| `RAS-Tablas` \| `Solano`.

### Vistas de `ras`

- **`ras.v_indicadores_predio`** — indicadores por predio: riqueza, Shannon, Simpson, Pielou, Margalef, área basal, DAP, especies amenazadas, distribución por grupo funcional (pionera/intermedia/tardía) y síndrome de dispersión, densidad (árboles/ha). Especie/familia/género vienen de `catalogo.especies` vía join, nunca duplicados en `arboles_semilleros`.
- **`ras.v_arboles_con_especie`** — lectura "aplanada" (árbol + especie por join) para pantallas ya construidas (ficha de árbol, geovisor) que esperan `nombre_cientifico` / `genero` / `familia_botanica` / `nombre_comun` como columnas planas.

---

## Schema `catalogo` — Maestro único de especies (2026-06-30)

### `catalogo.especies` — Especies botánicas (148 filas)

> Dato maestro compartido por Conservación (`ras.arboles_semilleros.especie_id`), Vivero y Plan.
> La taxonomía y descripción de una especie viven **una sola vez** aquí; el resto de módulos
> referencian por `especie_id` en vez de recopiar. Constraint `unique(nombre_cientifico)`.

**Identidad taxonómica**
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `nombre_cientifico` | text | **UNIQUE** |
| `autor` | text | ej. "L.", "(Bertero & Balb. ex Kunth) Skeels" |
| `genero` / `epiteto` / `familia` | text | |
| `nombres_comunes` | text[] | |
| `especie_anterior` | text | sinónimo / determinación previa de campo |

**Descriptivo / usos**
| Columna | Tipo | Notas |
|---------|------|-------|
| `descripcion` | text | |
| `habito` | text | árbol \| palma \| arbusto \| liana... |
| `foto_url` | text | bucket `species-photos` |
| `usos` | text[] | |
| `aplica_ley_arbol` | boolean | |

**Conservación / ecología**
| Columna | Tipo | Notas |
|---------|------|-------|
| `iucn` | text | LC\|NT\|VU\|EN\|CR\|DD\|NE |
| `amenaza` | text | categoría nacional (Res. 1912/2017) — **pendiente para todas** |
| `cites` | text | NA \| Apéndice I/II/III |
| `orden` | text | orden taxonómico (ej. Fabales) |
| `origen` | text | nativa \| introducida |
| `dispersion` | text | zoocoria \| anemocoria \| autocoria \| barocoria |
| `polinizacion` | text | zoófila \| entomófila \| anemófila |
| `rol_sucesional` | text | pionera \| intermedia \| tardía |

**Propagación (vivero/plan)**
| Columna | Tipo |
|---------|------|
| `tipo_semilla` | text — ortodoxa \| recalcitrante \| intermedia |
| `tratamiento_pregerminativo` | text |
| `pct_germinacion` / `dias_germinacion` / `dias_crecimiento_vivero` / `semillas_por_kg` | numeric/integer |

**Origen / trazabilidad**
| Columna | Tipo | Notas |
|---------|------|-------|
| `en_catalogo` | boolean | true = tiene ficha de la botánica (descripción/usos/foto) |
| `en_ras` | boolean | aparece en la Red de Árboles Semilleros |
| `en_vivero` | boolean | aparece en vivero |
| `n_arboles_ras` | integer | abundancia en RAS (referencia, no fuente de verdad — ver `ras.v_indicadores_predio`) |
| `slug` | text | usado para `foto_url` en el bucket |

> Muchas especies solo-vivero (`en_catalogo = false`) tienen apenas `nombre_cientifico` + `genero` + `epiteto` + a veces `tipo_semilla`; su ficha completa (descripción/usos/foto) llega cuando la botánica las levanta.

---

## Schema `core` — Núcleo canónico (2026-06-19)

Separa **persona**, **predio** y **proceso**. Jurídica es la puerta de entrada: crea las tres. Los demás módulos referencian en vez de recopiar. Mapeo y runbook: `docs/CORE_MIGRACION.md`.

```
aliados (persona)
  └── predios (FK aliado_id = dueño principal)
        ├── predio_propietarios (N—N: copropiedad)
        ├── expedientes (1:1: máquina de estados del proceso)
        ├── juridica.debida_diligencia (1:1)
        └── juridica.analisis_juridico (1:1)
aliados ── juridica.antecedentes (1:1, por persona)
```

### `core.aliados` — Persona (natural o jurídica)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `tipo_persona` | text | `natural` \| `juridica` |
| `tipo_documento` | text | CC/NUIP/CE/TI/PP/NIT |
| `numero_documento` | text | **UNIQUE** |
| `nombre_completo` | text | razón social si jurídica |
| `telefono` / `email` | text | |
| `created_by` / `created_at` / `updated_at` | — | auditoría |

### `core.predios` — Predio
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `aliado_id` | uuid FK → core.aliados | dueño principal (ON DELETE RESTRICT) |
| `nombre_predio` / `departamento` / `municipio` / `vereda` / `zona_ae` | text | |
| `matricula_inmobiliaria` | text | índice único parcial (cuando no es null) |
| `codigo_catastral` | text | |
| `area_registral` | numeric(12,4) | hectáreas del folio |

### `core.predio_propietarios` — Copropiedad (N—N)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `predio_id` | uuid FK → core.predios | ON DELETE CASCADE |
| `aliado_id` | uuid FK → core.aliados | |
| `rol` | text | `principal` \| `copropietario` |
| `cuota_pct` | numeric(5,2) | opcional |

### `core.expedientes` — Proceso del predio (máquina de estados)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `predio_id` | uuid FK → core.predios | **UNIQUE** (1 expediente por predio) |
| `etapa` | text | `juridica`→`sig_i`→`campo`→`sig_ii`→`plan`→`juridica_ii`→`ejecucion`→`archivado` |
| `estado` | text | `activo` \| `rechazado` \| `archivado` \| `completado` |
| `linea` | text | `restauracion` \| `conservacion` \| `ambas` |
| `proyecto_fase` / `responsable` | text | |
| `fecha_inicio` | timestamptz | |

---

## Schema `juridica` — Debida diligencia (sobre `core`)

Tras el cutover guarda **solo lo jurídico**; persona/predio viven en `core`. **El `[id]` de la UI de jurídica = `predio_id`.** Código: rutas `/api/juridica/*` reparten/reensamblan vía `lib/juridica-core.ts`.

### `juridica.debida_diligencia` — Workflow + soportes (1:1 con el predio)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `predio_id` | uuid FK → core.predios | **UNIQUE** |
| `estado` | text | `borrador`→`antecedentes_ok`→`juridico_ok`→`aprobado`\|`rechazado` |
| `cedula_url` / `certificado_tradicion_url` / `recibo_predial_url` / `manifestacion_url` | text | PDF/imagen/Word en bucket `juridica-documentos` |
| `anio_ultimo_pago_predial` | integer | |
| `manifestacion_interes` / `manifestacion_observaciones` | bool / text | |

### `juridica.antecedentes` — 14 listas restrictivas + PEP/prensa (1:1 por persona)
FK `aliado_id` → **core.aliados** (la persona se veta una vez, sirve para todos sus predios). Columnas: igual que antes (rama_judicial, procuraduria, ofac, interpol… con `_url`; `pep`, `prensa_negativa`, `aprobado`).

### `juridica.analisis_juridico` — Folio de matrícula + semáforo (1:1 con el predio)
FK `predio_id` → **core.predios**. Banderas (falsa_tradicion, procesos_judiciales, medidas_cautelares…), conceptos ANT/URT/PNN, `semaforo` (verde/amarillo/naranja/rojo). *(Se quitó `acto_adquisicion_actual`.)*

> **Documentos:** bucket privado `juridica-documentos`. Soportes del predio en `{predio_id}/…`; consultas de antecedentes en `{aliado_id}/antecedentes/…`. Acepta PDF (se comprime), imagen y Word (se suben tal cual). Helper `subirDocumento` en `lib/juridica-core.ts`.

---

## Schema `geo` — Geoportal / SIG (2026-06-19)

### `geo.zonas` — Polígonos georreferenciados (3 filas, PostGIS)

> Fuente de verdad geoespacial: el `.zip` (shapefile) subido en SIG I se desglosa aquí;
> el geovisor y el resto de la app leen de esta tabla (no del archivo original).

| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `predio_id` | uuid FK → `core.predios` | |
| `tipo` | text | ej. `finca`, según `p_tipo` en `crear_zona_union` |
| `origen` | text | ej. `sig` |
| `nombre` | text | |
| `geom` | geometry | PostGIS |
| `propiedades` | jsonb | atributos leídos del `.dbf` del shapefile *(v2)* |
| `perimetro_m` | numeric | *(v2)* |
| `expediente_id` | uuid FK → `core.expedientes` | |

**Funciones**
- `geo.zonas_de_predio(p_predio_id uuid)` — zonas de un predio con geometría en GeoJSON, para pintar en el mapa *(migration_geo_v2.sql, ejecutada)*.
- `geo.crear_zona_union(...)` — une (`ST_Union`) una geometría nueva con zonas existentes que se sobreponen *(migration_geo_v3.sql, ejecutada — usada en `app/api/sig/ingesta/route.ts`)*.

---

## Rutas de la app ↔ tablas

| Ruta | Tabla(s) |
|------|----------|
| `/calendar` | `fleet.vehicle_reservations` |
| `/validar-reserva` | `fleet.vehicle_inspections`, `fleet.vehicle_reservations` |
| `/consentimiento` | `public.consentimientos` |
| `/intranet` | `people.user_profiles`, stats |
| `/intranet/ras/siembra` | `siembra.familias`, `siembra.predios` |
| `/intranet/ras/siembra/nueva` | `siembra.familias`, `siembra.predios` |
| `/intranet/ras/conservacion` (+ `nueva`, `[id]`, `[id]/editar`) | `ras.familias` |
| `/intranet/ras` | `ras.arboles_semilleros` (vía `lib/ras-arboles.ts`) |
| `/api/ras/arboles/[id]/foto` | `ras.arboles_semilleros` (bucket `species-photos`) |
| `/api/catalogo/[id]/foto` | `catalogo.especies` (vía `lib/catalogo.ts`, bucket `species-photos`) |
| `/api/sig/ingesta` | ingesta de shapefile → `geo.zonas` |
| `/api/sig/zonas` | `geo.zonas` |
| `/intranet/ejecutivo` | `ejecutivo.sesiones`, `ejecutivo.indicaciones`, `people.user_profiles` |
| `/intranet/admin` | `people.user_profiles`, `fleet.vehicle_documents`, `public.consentimientos` |
| `/intranet/juridica` (+ `[id]`, `nuevo`, `editar`, `antecedentes`, `analisis-juridico`) | `core.aliados/predios/predio_propietarios/expedientes` + `juridica.debida_diligencia/antecedentes/analisis_juridico` |
| `/api/juridica/aliados/[id]/crear-en-siembra` | crea `siembra.familias` enlazada a `core.expedientes` (avanza etapa a `campo`) |

---

## Pendiente de ejecutar en Supabase

Ver [`docs/sql/pending.sql`](docs/sql/pending.sql) — detalle de lo que falta y el historial de lo ejecutado.
