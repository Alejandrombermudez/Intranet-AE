-- ============================================================
--  Migración: Encuesta predial + Evaluaciones de campo
--  Archivo : docs/sql/migration_encuesta_predial.sql
--  Ejecutar: Supabase SQL Editor (proyecto producción)
--  Creado  : Abril 2026
-- ============================================================

-- ─── §1 Datos Generales ──────────────────────────────────────────────────────
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS encuesta_no            TEXT,
  ADD COLUMN IF NOT EXISTS fecha_encuesta         DATE,
  ADD COLUMN IF NOT EXISTS encuestador            TEXT,
  ADD COLUMN IF NOT EXISTS tipo_encuestado        TEXT;   -- Propietario/Arrendatario/Mayordomo/Trabajador

-- ─── §2 Datos del Predio ─────────────────────────────────────────────────────
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS estrato_paisaje        TEXT,   -- Sabana/Vega/Tierra firme...
  ADD COLUMN IF NOT EXISTS latitud                TEXT,   -- coordenada N (texto para preservar precisión)
  ADD COLUMN IF NOT EXISTS longitud               TEXT,   -- coordenada W
  ADD COLUMN IF NOT EXISTS altitud_msnm           NUMERIC,
  ADD COLUMN IF NOT EXISTS anio_adquisicion       INT,
  ADD COLUMN IF NOT EXISTS distancia_cabecera_km  NUMERIC,
  ADD COLUMN IF NOT EXISTS tipo_via               TEXT[], -- pavimentada/sin pavimentar/río/herradura
  ADD COLUMN IF NOT EXISTS tipo_acceso_predio     TEXT[], -- Carro/Moto/Caballo/Pie/Canoa
  ADD COLUMN IF NOT EXISTS servicios_domiciliarios TEXT[], -- Energía/Solar/Gasolina/No tiene
  ADD COLUMN IF NOT EXISTS fuente_agua            TEXT[], -- Acueducto/Reservorios/Cuerpos/Pozo/No tiene
  ADD COLUMN IF NOT EXISTS senal_telefonica       BOOLEAN;

-- ─── §3 Característica de la Vivienda ────────────────────────────────────────
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS material_techo         TEXT,
  ADD COLUMN IF NOT EXISTS material_paredes       TEXT,
  ADD COLUMN IF NOT EXISTS material_piso          TEXT,
  ADD COLUMN IF NOT EXISTS num_habitaciones       INT,
  ADD COLUMN IF NOT EXISTS personas_vivienda      INT,
  ADD COLUMN IF NOT EXISTS tipo_cocina            TEXT[],
  ADD COLUMN IF NOT EXISTS tipo_bano              TEXT[],
  ADD COLUMN IF NOT EXISTS disposicion_excretas   TEXT,
  ADD COLUMN IF NOT EXISTS disposicion_aguas_servidas TEXT,
  ADD COLUMN IF NOT EXISTS manejo_basuras         TEXT[];

-- ─── §4 Núcleo Familiar ──────────────────────────────────────────────────────
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS poblacion_tendencia    TEXT,   -- incrementado/disminuido
  ADD COLUMN IF NOT EXISTS acceso_salud           BOOLEAN,
  ADD COLUMN IF NOT EXISTS regimen_salud          TEXT,   -- contributivo/subsidiado
  ADD COLUMN IF NOT EXISTS puesto_salud           TEXT,
  ADD COLUMN IF NOT EXISTS acceso_educacion       BOOLEAN,
  ADD COLUMN IF NOT EXISTS distancia_educacion_km NUMERIC,
  ADD COLUMN IF NOT EXISTS tiempo_llegada_region  TEXT,
  ADD COLUMN IF NOT EXISTS razon_llegada          TEXT,
  ADD COLUMN IF NOT EXISTS miembros_familia       JSONB;  -- [{parentesco,edad,sexo,procedencia,...}]

-- ─── §5 Valorización de la Unidad Productiva ─────────────────────────────────
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS ha_total               NUMERIC,
  ADD COLUMN IF NOT EXISTS valor_comercial_ha     NUMERIC,
  ADD COLUMN IF NOT EXISTS tendencia_area         TEXT,   -- incrementado/disminuido
  ADD COLUMN IF NOT EXISTS cambio_area_ha         NUMERIC,
  ADD COLUMN IF NOT EXISTS intencion_vender       BOOLEAN,
  ADD COLUMN IF NOT EXISTS causas_venta           TEXT[],
  ADD COLUMN IF NOT EXISTS medio_transporte_produccion TEXT,
  ADD COLUMN IF NOT EXISTS transporte_propio      BOOLEAN,
  ADD COLUMN IF NOT EXISTS valor_transporte       NUMERIC,
  ADD COLUMN IF NOT EXISTS problemas_mercado      TEXT,
  ADD COLUMN IF NOT EXISTS nivel_ingresos         TEXT;   -- <1SMLV / 1-5SMLV / >5SMLV

-- ─── §6 Actividad Productiva — Cultivos ──────────────────────────────────────
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS cultivos               JSONB;  -- [{cultivo,area_ha,anio_siembra,densidad,rendimiento,destino}]

-- ─── §6 Actividad Productiva — Ganadería ─────────────────────────────────────
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS tiene_ganaderia              BOOLEAN,
  ADD COLUMN IF NOT EXISTS tipo_tenencia_ganado         TEXT,
  ADD COLUMN IF NOT EXISTS orientacion_ganaderia        TEXT[],
  ADD COLUMN IF NOT EXISTS num_cabezas_ganado           INT,
  ADD COLUMN IF NOT EXISTS ha_ganaderia                 NUMERIC,
  ADD COLUMN IF NOT EXISTS tipos_pasto                  TEXT[],
  ADD COLUMN IF NOT EXISTS litros_leche_dia             NUMERIC,
  ADD COLUMN IF NOT EXISTS tanque_enfriamiento          TEXT,   -- propio/comunitario/arrendado/no
  ADD COLUMN IF NOT EXISTS destino_leche                TEXT[],
  ADD COLUMN IF NOT EXISTS precio_leche_litro           NUMERIC,
  ADD COLUMN IF NOT EXISTS sistema_alimentacion_ganado  TEXT,
  ADD COLUMN IF NOT EXISTS especies_forrajeras          TEXT,
  ADD COLUMN IF NOT EXISTS uso_fertilizacion_ganado     TEXT[],
  ADD COLUMN IF NOT EXISTS manejo_praderas              TEXT[],
  ADD COLUMN IF NOT EXISTS infraestructura_ganadera     TEXT[],
  ADD COLUMN IF NOT EXISTS material_postes              TEXT,
  ADD COLUMN IF NOT EXISTS ha_pasto_ultimo_anio         NUMERIC,
  ADD COLUMN IF NOT EXISTS origen_nuevos_pastos         TEXT[],
  -- Ganadería regenerativa
  ADD COLUMN IF NOT EXISTS pastoreo_rotacional          BOOLEAN,
  ADD COLUMN IF NOT EXISTS diversificacion_forrajera    BOOLEAN,
  ADD COLUMN IF NOT EXISTS cercas_vivas                 BOOLEAN,
  ADD COLUMN IF NOT EXISTS sistemas_silvopastoriles     BOOLEAN,
  ADD COLUMN IF NOT EXISTS captacion_agua_lluvia        BOOLEAN,
  ADD COLUMN IF NOT EXISTS manejo_residuos_organicos    BOOLEAN,
  ADD COLUMN IF NOT EXISTS reduccion_antibioticos       BOOLEAN,
  ADD COLUMN IF NOT EXISTS espacios_sombra_agua         BOOLEAN,
  ADD COLUMN IF NOT EXISTS reduccion_estres             BOOLEAN,
  ADD COLUMN IF NOT EXISTS interes_ganaderia_regenerativa BOOLEAN,
  -- Otras especies pecuarias
  ADD COLUMN IF NOT EXISTS otras_especies_pecuarias     JSONB; -- {equinos:{tiene,cantidad,uso_propio,comercializacion},...}

-- ─── §7 Nivel Tecnológico ────────────────────────────────────────────────────
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS instalaciones_maquinaria     TEXT,
  ADD COLUMN IF NOT EXISTS tiene_tractor                BOOLEAN,
  ADD COLUMN IF NOT EXISTS tiene_camion                 BOOLEAN,
  ADD COLUMN IF NOT EXISTS manejo_suelo_fertilizacion   TEXT,   -- Orgánico/Convencional/Mixto
  ADD COLUMN IF NOT EXISTS tipo_fertilizacion           TEXT[],
  ADD COLUMN IF NOT EXISTS cobertura_arborea            BOOLEAN,
  ADD COLUMN IF NOT EXISTS practica_podas               BOOLEAN,
  ADD COLUMN IF NOT EXISTS practica_raleo               BOOLEAN,
  ADD COLUMN IF NOT EXISTS control_malezas              TEXT[],
  ADD COLUMN IF NOT EXISTS manejo_agua_cultivo          TEXT,
  ADD COLUMN IF NOT EXISTS problemas_manejo             TEXT[],
  ADD COLUMN IF NOT EXISTS especies_variedades          TEXT,
  ADD COLUMN IF NOT EXISTS lleva_registros_productividad BOOLEAN,
  ADD COLUMN IF NOT EXISTS interes_capacitacion         BOOLEAN,
  ADD COLUMN IF NOT EXISTS temas_capacitacion           TEXT;

-- ─── §8 Usos del Bosque y Cambio Climático ───────────────────────────────────
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS aprovecha_bosque             BOOLEAN,
  ADD COLUMN IF NOT EXISTS productos_forestales         TEXT,
  ADD COLUMN IF NOT EXISTS capacitacion_ambiente        BOOLEAN,
  ADD COLUMN IF NOT EXISTS entidad_capacitacion         TEXT,
  ADD COLUMN IF NOT EXISTS especies_bosque_predio       TEXT,
  ADD COLUMN IF NOT EXISTS especies_fauna_predio        TEXT,
  ADD COLUMN IF NOT EXISTS estudio_academico            BOOLEAN,
  ADD COLUMN IF NOT EXISTS disminucion_especies         BOOLEAN,
  ADD COLUMN IF NOT EXISTS especies_afectadas           TEXT,
  ADD COLUMN IF NOT EXISTS cambios_caudal               BOOLEAN,
  ADD COLUMN IF NOT EXISTS cambio_cobertura_ha          NUMERIC,
  ADD COLUMN IF NOT EXISTS causa_cambio_cobertura       TEXT[],
  ADD COLUMN IF NOT EXISTS problemas_agropecuarios      TEXT[];

-- ─── §9 Relaciones Internas y Externas ───────────────────────────────────────
ALTER TABLE siembra.familias
  ADD COLUMN IF NOT EXISTS programas_gubernamentales    TEXT,
  ADD COLUMN IF NOT EXISTS beneficios_programas         TEXT,
  ADD COLUMN IF NOT EXISTS impacto_programa             TEXT,   -- Positivo/Negativo/No causó cambio
  ADD COLUMN IF NOT EXISTS opinion_productores          BOOLEAN,
  ADD COLUMN IF NOT EXISTS aliado_cooperativa           BOOLEAN,
  ADD COLUMN IF NOT EXISTS nombre_cooperativa           TEXT,
  ADD COLUMN IF NOT EXISTS beneficio_cooperativa        TEXT,
  ADD COLUMN IF NOT EXISTS calificacion_gremios         TEXT,   -- Suficiente/Insuficiente/No existe
  ADD COLUMN IF NOT EXISTS observaciones_generales      TEXT;

-- ─── Nueva tabla: Evaluaciones de campo AE-CAMPO-001 ─────────────────────────
CREATE TABLE IF NOT EXISTS siembra.evaluaciones_campo (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  familia_id                UUID REFERENCES siembra.familias(id) ON DELETE CASCADE,

  -- §1 Identificación
  codigo_formato            TEXT DEFAULT 'AE-CAMPO-001',
  version                   TEXT DEFAULT '1.0',
  fecha_visita              DATE,
  evaluador_1               TEXT,
  evaluador_2               TEXT,
  codigo_predio             TEXT,
  num_zonas                 INT DEFAULT 0,
  senal_celular_eval        BOOLEAN,
  operador_celular          TEXT,
  area_zonas_ha             NUMERIC,
  tiempo_desde_via          TEXT,

  -- §2 Cartografía Social
  disposicion_propietario   TEXT,   -- Muy favorable/Favorable/Neutro/Escéptico/No acepta
  ajustes_poligono          TEXT,
  observaciones_sociales    TEXT,
  mano_obra_disponible      BOOLEAN,
  experiencia_restauracion  BOOLEAN,

  -- §3 Cobertura Vegetal
  cobertura_dominante       TEXT,
  pct_cobertura_boscosa     TEXT,
  densidad_rastrojo         TEXT,
  especies_arboreas_alturas TEXT,
  regeneracion_natural      TEXT,
  defaunacion               TEXT,
  presion_fauna_ganado_eval TEXT,
  requiere_proteccion       TEXT,

  -- §4 Suelo y Topografía
  textura_suelo             TEXT,
  drenaje_superficial       TEXT,
  pendiente                 TEXT,
  presencia_roca            TEXT,
  erosion                   TEXT,
  fuente_agua_eval          TEXT,
  distancia_agua_m          NUMERIC,
  observaciones_suelo       TEXT,

  -- §5 Logística
  tipo_via_eval             TEXT,
  medio_acceso_zonas        TEXT[],
  tiempo_predio_zona        TEXT,
  condicion_camino          TEXT,
  lugar_deposito_material   TEXT,
  complejidad_acceso        TEXT,
  descripcion_ruta          TEXT,

  -- §6 Riesgos
  quemas_recientes          BOOLEAN,
  anio_quema                TEXT,
  ganado_activo_poligono    BOOLEAN,
  cabezas_poligono          INT,
  conflictos_tenencia       BOOLEAN,
  descripcion_conflictos    TEXT,
  restricciones_uso         BOOLEAN,
  cuales_restricciones      TEXT,
  otros_riesgos             TEXT,
  observaciones_riesgos     TEXT,

  -- Fotos de campo (5 puntos del formato)
  foto_suelo_url            TEXT,
  foto_drenaje_url          TEXT,
  foto_pendiente_url        TEXT,
  foto_erosion_url          TEXT,
  foto_via_url              TEXT,

  -- Auditoría
  created_by                TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE siembra.evaluaciones_campo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_evaluaciones"   ON siembra.evaluaciones_campo FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_evaluaciones" ON siembra.evaluaciones_campo FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_evaluaciones" ON siembra.evaluaciones_campo FOR UPDATE TO authenticated USING (true);
CREATE POLICY "delete_evaluaciones" ON siembra.evaluaciones_campo FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON siembra.evaluaciones_campo TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA siembra TO authenticated, service_role;
