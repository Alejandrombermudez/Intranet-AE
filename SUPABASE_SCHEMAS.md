# Base de Datos — Intranet Amazonia Emprende

> Última verificación contra BD real: Mayo 2026
> Proyecto Supabase: `lbxysovesmbgesxooghw`

---

## Cómo correr queries desde el terminal

```js
// _query.mjs (borrar después de usar)
import { createClient } from '@supabase/supabase-js'
const sb = createClient(
  'https://lbxysovesmbgesxooghw.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY  // clave en .env
)
// Schema público
const { data } = await sb.from('user_profiles').select('*')
// Schema custom
const { data } = await sb.schema('siembra').from('familias').select('*')
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

---

## Schema `public` — Tablas generales

### `user_profiles` — Usuarios de la intranet (13 filas)
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `email` | text | único |
| `full_name` | text | |
| `role` | text | |
| `department` | text | |
| `is_admin` | boolean | acceso total al panel admin |
| `can_access_intranet` | boolean | acceso al módulo propio sin ser admin |
| `last_login` | timestamptz | |
| `created_at` | timestamptz | |

### `vehicle_reservations` — Reservas de vehículos (28 filas)
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

### `vehicle_inspections` — Inspecciones vehiculares (2 filas)
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

### `vehicle_documents` — Documentos de vehículos
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `vehicle_id` | text |
| `vehicle_name` | text |
| `soat_expiry` | date |
| `tecnomecanica_expiry` | date |
| `updated_at` | timestamptz |
| `updated_by` | text |

### `consentimientos` — Módulo financiero (4 filas)
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

### `proyecciones` — Metas por proyecto
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `nombre` | text | |
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

### Tablas beta / en uso limitado
| Tabla | Descripción |
|-------|-------------|
| `profiles` | Perfil extendido de empleados (RRHH) — `first_name`, `last_name`, `document_id`, `role_id`, `department_id`, `contract_type`, `job_title`, etc. |
| `roles` | Roles con permisos en JSON — `name`, `code`, `level`, `permissions` (jsonb) |
| `document_types` | Tipos de documento de RRHH — `name`, `category`, `retention_policy` |
| `arboles_beta` | Árboles geolocalizados (beta) — `lat`, `lng`, `especie`, `altura_m`, `estado_sanitario`, `foto_url` |
| `predio` / `arbol` / `sesion` / `imagen_registro` | Sistema de monitoreo de árboles en campo (beta) |
| `poligonos_demo` / `ha_restauradas_demo` | Polígonos geoespaciales (demo, PostGIS) |

---

## Schema `siembra` — Módulo Restauración / Siembra

### Diagrama de relaciones
```
predios
  └── familias (FK: predio_id)
        ├── monitoreos
        ├── camaras_trampa
        │     └── fotos_camara
        └── fotos_predio
  └── evaluaciones_campo (FK: predio_id, familia_id)
```

### `siembra.predios` — Predios registrados en campo
| Columna | Tipo | Notas |
|---------|------|-------|
| `id` | uuid PK | |
| `local_id` | text | ID generado offline en app móvil |
| `nombre_predio` | text | |
| `nombre_propietario` | text | |
| `municipio` | text | |
| `vereda` | text | |
| `departamento` | text | |
| `fecha` | date | |
| `contacto` | text | |
| `num_zonas` | integer | zonas de restauración |
| `created_by` | text | |
| `sync_origin` | text | `web` \| `mobile` |
| `created_at` / `updated_at` | timestamptz | |

### `siembra.familias` — Encuesta socioeconómica completa (9 filas)

> Tabla principal del módulo. Contiene la encuesta de caracterización completa.
> Las columnas `sec_*` guardan snapshots JSON de cada sección del formulario móvil.

**Identificación**
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `predio_id` | uuid FK → predios |
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
| `problemas_agropecuarios` | text[] |
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

**Sincronización & Auditoría**
| Columna | Tipo | Notas |
|---------|------|-------|
| `local_id` | text | ID offline del dispositivo |
| `sync_origin` | text | `web` \| `mobile` |
| `step_completed` | integer | sección del form completada |
| `sec_general` … `sec_bosque` | jsonb | snapshots de sección por sección |
| `created_by` | text | |
| `created_at` / `updated_at` | timestamptz | |

### `siembra.evaluaciones_campo` — Evaluación técnica de predio
> Formulario de evaluación en campo (suelo, vegetación, acceso, riesgos).
> Vinculado tanto a `predios` como a `familias`.

| Grupo | Columnas clave |
|-------|---------------|
| Identificación | `id`, `familia_id`, `predio_id`, `nombre_predio`, `codigo_formato`, `version` |
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
| Sync | `local_id`, `sync_origin`, `step_completed` |
| Auditoría | `created_by`, `created_at`, `updated_at` |

### `siembra.monitoreos`
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `familia_id` | uuid FK → familias |
| `fecha` | date |
| `supervivencia_pct` | numeric (0–100) |
| `created_at` | timestamptz |

### `siembra.camaras_trampa`
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `familia_id` | uuid FK → familias |
| `nombre` | text |
| `latitud` / `longitud` | numeric |
| `created_at` | timestamptz |

### `siembra.fotos_camara`
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `camara_id` | uuid FK → camaras_trampa |
| `url` | text |
| `created_at` | timestamptz |

### `siembra.fotos_predio` — Fotos por categoría
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
  ├── monitoreos
  ├── camaras_trampa
  │     └── fotos_camara
  └── fotos_predio
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

**Restauración** *(columnas heredadas — no aplican en conservación pero existen en la tabla)*
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

### `ras.monitoreos`
| Columna | Tipo |
|---------|------|
| `id` | uuid PK |
| `familia_id` | uuid FK → familias |
| `fecha` | date |
| `supervivencia_pct` | numeric (0–100) |
| `created_at` | timestamptz |

### `ras.camaras_trampa`
*(misma estructura que `siembra.camaras_trampa`)*

### `ras.fotos_camara`
*(misma estructura que `siembra.fotos_camara`)*

### `ras.fotos_predio`
*(misma estructura que `siembra.fotos_predio` — tabla existe, sin filas aún)*

---

## Rutas de la app ↔ tablas

| Ruta | Tabla(s) |
|------|----------|
| `/calendar` | `vehicle_reservations` |
| `/validar-reserva` | `vehicle_inspections`, `vehicle_reservations` |
| `/consentimiento` | `consentimientos` |
| `/intranet` | `user_profiles`, stats |
| `/intranet/ras/siembra` | `siembra.familias` |
| `/intranet/ras/siembra/nueva` | `siembra.familias`, `siembra.predios` |
| `/intranet/ras/conservacion` | `ras.familias` |
| `/intranet/ras/conservacion/nueva` | `ras.familias` |

---

## Pendiente de ejecutar en Supabase

Ver [`docs/sql/pending.sql`](docs/sql/pending.sql) — solo contiene items no verificados.
