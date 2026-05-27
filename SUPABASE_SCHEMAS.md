# Base de Datos — Intranet Amazonia Emprende

> **Última actualización:** Mayo 2026 | Proyecto Supabase: `lbxysovesmbgesxooghw`
> Para seguimiento de migraciones SQL ver `docs/sql/`
>
> **Última migración ejecutada:** `migration_ejecutivo_v2.sql` + creación de `fleet.vehicle_documents` (Mayo 2026)
>
> **Pendiente:** `docs/sql/migration_modulo_juridico.sql` — schema `juridica` (3 tablas) + columna `siembra.familias.aliado_id`. Contexto funcional en `juridica/CONTEXTO_MODULO_JURIDICO.md`.

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
| `ras` | Módulo Conservación | ✅ Ejecutado en producción |
| `juridica` | Módulo Jurídico (Fase 1) | ⏳ Pendiente — ver `juridica/CONTEXTO_MODULO_JURIDICO.md` |
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
| `/intranet/ras/conservacion` | `ras.familias` |
| `/intranet/ras/conservacion/nueva` | `ras.familias` |
| `/intranet/ejecutivo` | `ejecutivo.sesiones`, `ejecutivo.indicaciones`, `people.user_profiles` |
| `/intranet/admin` | `people.user_profiles`, `fleet.vehicle_documents`, `public.consentimientos` |

---

## Pendiente de ejecutar en Supabase

Ver [`docs/sql/pending.sql`](docs/sql/pending.sql) — detalle de lo que falta y el historial de lo ejecutado.
