import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { Geometry } from 'geojson'

/**
 * Expediente completo de un predio: todo lo que el ecosistema sabe de esa
 * familia, en una sola respuesta. Junta lo que hoy vive repartido entre
 * jurídica (`core` + `juridica`), cartografía (`geo`) y terreno (`siembra`).
 *
 * Es de sólo lectura y no inventa nada: lo que no existe llega en null y la
 * página lo dibuja como "sin dato". Así el informe se puede generar para
 * cualquier predio, esté en la etapa que esté.
 */

export interface ZonaExpediente {
  id:          string
  nombre:      string | null
  tipo:        string | null          // finca | restauracion | conservacion
  estado:      string | null          // potencial | validada | definitiva | avalada | descartada
  area_ha:     number | null
  perimetro_m: number | null
  propiedades: Record<string, unknown> | null
  geojson:     Geometry | null
}

export interface RevisionExpediente {
  zona_id:        string | null
  accion:         'confirmada' | 'modificada' | 'nueva' | 'descartada'
  metodo:         string | null
  geom_original:  Geometry | null
  geom_corregida: Geometry | null
  area_ha_campo:  number | null
  observaciones:  string | null
  evaluador:      string | null
  fecha:          string | null
  created_at:     string
}

/** Bloque biofísico que campo llenó para UNA zona (viene de zonas_data). */
export interface ZonaEvaluada {
  zona_id:     string | null
  zona_numero: number | null
  area_ha_sig: number | null
  suelo:     Record<string, unknown> | null
  cobertura: Record<string, unknown> | null
  logistica: Record<string, unknown> | null
  riesgos:   Record<string, unknown> | null
}

export interface Expediente {
  generado_en: string

  predio: {
    id: string
    nombre_predio: string | null
    departamento: string | null
    municipio: string | null
    vereda: string | null
    zona_ae: string | null
    matricula_inmobiliaria: string | null
    matriculas: string[] | null
    codigo_catastral: string | null
    area_registral: number | null
    created_at: string | null
  }

  propietario: {
    id: string
    nombre_completo: string | null
    tipo_persona: string | null
    tipo_documento: string | null
    numero_documento: string | null
    telefono: string | null
    email: string | null
  } | null

  copropietarios: { nombre_completo: string | null; rol: string | null; cuota_pct: number | null }[]

  expediente: {
    etapa: string | null
    estado: string | null
    linea: string | null
    proyecto_fase: string | null
    responsable: string | null
    fecha_inicio: string | null
  } | null

  juridica: {
    debida_diligencia: Record<string, unknown> | null
    analisis:          Record<string, unknown> | null
    antecedentes:      Record<string, unknown> | null
  }

  zonas:      ZonaExpediente[]
  revisiones: RevisionExpediente[]

  evaluacion: {
    id: string | null
    fecha_visita: string | null
    evaluador_1: string | null
    evaluador_2: string | null
    num_zonas_eval: number | null
    step_completed: number | null
    updated_at: string | null
    seccion_1: Record<string, unknown> | null
    seccion_2: Record<string, unknown> | null
    seccion_6: Record<string, unknown> | null
    zonas: ZonaEvaluada[]
    firmas: { eval1: string | null; eval2: string | null; propietario: string | null }
  } | null

  /** Encuesta socioeconómica, ya resuelta: los bloques `sec_*` de la PWA
   *  ganan, y lo que falte se completa con las columnas planas heredadas. */
  encuesta: {
    id: string | null
    fecha_encuesta: string | null
    encuestador: string | null
    step_completed: number | null
    updated_at: string | null
    secciones: Record<string, Record<string, unknown>>
    cultivos: Record<string, unknown>[]
  } | null

  fotos: { categoria: string | null; url: string }[]
}

/** Campos planos de `siembra.familias` que alimentan cada bloque de la encuesta
 *  cuando el `sec_*` correspondiente viene vacío (encuestas del formulario viejo). */
const PLANOS_POR_SECCION: Record<string, string[]> = {
  general: [
    'encuestador', 'tipo_encuestado', 'fecha_encuesta', 'estrato_paisaje', 'altitud_msnm',
    'anio_adquisicion', 'distancia_cabecera_km', 'distancia_florencia_km', 'tiempo_florencia_min',
    'tipo_via', 'tipo_acceso_predio', 'servicios_domiciliarios', 'fuente_agua', 'senal_telefonica',
  ],
  vivienda: [
    'material_techo', 'material_paredes', 'material_piso', 'num_habitaciones', 'personas_vivienda',
    'tipo_cocina', 'tipo_bano', 'disposicion_excretas', 'disposicion_aguas_servidas', 'manejo_basuras',
  ],
  familia: [
    'adultos', 'ninos', 'cant_mujeres', 'cant_hombres', 'miembros_familia', 'poblacion_tendencia',
    'acceso_salud', 'regimen_salud', 'puesto_salud', 'acceso_educacion', 'distancia_educacion_km',
    'tiempo_llegada_region', 'razon_llegada',
  ],
  economia: [
    'ha_total', 'ha_potreros', 'ha_bosque', 'ha_otras', 'valor_comercial_ha', 'tendencia_area',
    'cambio_area_ha', 'intencion_vender', 'causas_venta', 'actividad_economica', 'empleos_locales',
    'nivel_ingresos', 'medio_transporte_produccion', 'transporte_propio', 'valor_transporte',
    'problemas_mercado',
  ],
  ganaderia: [
    'tiene_ganaderia', 'tipo_tenencia_ganado', 'orientacion_ganaderia', 'num_cabezas_ganado',
    'ha_ganaderia', 'tipos_pasto', 'litros_leche_dia', 'tanque_enfriamiento', 'destino_leche',
    'precio_leche_litro', 'sistema_alimentacion_ganado', 'especies_forrajeras',
    'uso_fertilizacion_ganado', 'manejo_praderas', 'infraestructura_ganadera', 'material_postes',
    'ha_pasto_ultimo_anio', 'origen_nuevos_pastos', 'pastoreo_rotacional', 'diversificacion_forrajera',
    'cercas_vivas', 'sistemas_silvopastoriles', 'captacion_agua_lluvia', 'manejo_residuos_organicos',
    'reduccion_antibioticos', 'espacios_sombra_agua', 'reduccion_estres',
    'interes_ganaderia_regenerativa', 'otras_especies_pecuarias',
  ],
  tecnologia: [
    'instalaciones_maquinaria', 'tiene_tractor', 'tiene_camion', 'manejo_suelo_fertilizacion',
    'tipo_fertilizacion', 'cobertura_arborea', 'practica_podas', 'practica_raleo', 'control_malezas',
    'manejo_agua_cultivo', 'problemas_manejo', 'especies_variedades', 'lleva_registros_productividad',
    'interes_capacitacion', 'temas_capacitacion',
  ],
  bosque: [
    'aprovecha_bosque', 'productos_forestales', 'capacitacion_ambiente', 'entidad_capacitacion',
    'especies_bosque_predio', 'especies_fauna_predio', 'estudio_academico', 'disminucion_especies',
    'especies_afectadas', 'cambios_caudal', 'cambio_cobertura_ha', 'causa_cambio_cobertura',
    'problemas_agropecuarios', 'programas_gubernamentales', 'beneficios_programas', 'impacto_programa',
    'opinion_productores', 'aliado_cooperativa', 'nombre_cooperativa', 'beneficio_cooperativa',
    'calificacion_gremios', 'bajo_conservacion', 'tiene_espacio_vegetal', 'observaciones_generales',
  ],
}

const vacio = (v: unknown) =>
  v === null || v === undefined || v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)

/** Une el snapshot JSONB de la PWA con las columnas planas del formulario viejo. */
function resolverSecciones(fila: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const [seccion, planos] of Object.entries(PLANOS_POR_SECCION)) {
    const snap = (fila[`sec_${seccion}`] ?? {}) as Record<string, unknown>
    const merged: Record<string, unknown> = { ...(typeof snap === 'object' && !Array.isArray(snap) ? snap : {}) }
    for (const col of planos) {
      if (vacio(merged[col]) && !vacio(fila[col])) merged[col] = fila[col]
    }
    for (const k of Object.keys(merged)) if (vacio(merged[k])) delete merged[k]
    out[seccion] = merged
  }
  return out
}

// GET /api/reporte/expediente?predio_id=...&email=...
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const email    = req.nextUrl.searchParams.get('email')
  const predioId = req.nextUrl.searchParams.get('predio_id')
  if (!email || !predioId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })

  const { data: profile } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin, department, can_access_intranet')
    .eq('email', email)
    .single()
  if (!profile || (!profile.is_admin && !profile.can_access_intranet && !profile.department)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const { data: predio, error: errPredio } = await supabase
      .schema('core').from('predios')
      .select('id, aliado_id, nombre_predio, departamento, municipio, vereda, zona_ae, matricula_inmobiliaria, matriculas, codigo_catastral, area_registral, created_at')
      .eq('id', predioId)
      .single()
    if (errPredio || !predio) return NextResponse.json({ error: 'Predio no encontrado' }, { status: 404 })

    const [
      { data: aliado }, { data: copros }, { data: expediente },
      { data: dd }, { data: analisis },
      { data: zonasRpc }, { data: revisiones },
      { data: evals }, { data: encuestas },
    ] = await Promise.all([
      predio.aliado_id
        ? supabase.schema('core').from('aliados')
            .select('id, nombre_completo, tipo_persona, tipo_documento, numero_documento, telefono, email')
            .eq('id', predio.aliado_id).single()
        : Promise.resolve({ data: null }),
      supabase.schema('core').from('predio_propietarios')
        .select('rol, cuota_pct, aliado:aliado_id(nombre_completo)')
        .eq('predio_id', predioId),
      supabase.schema('core').from('expedientes')
        .select('etapa, estado, linea, proyecto_fase, responsable, fecha_inicio')
        .eq('predio_id', predioId).maybeSingle(),
      supabase.schema('juridica').from('debida_diligencia')
        .select('*').eq('predio_id', predioId).maybeSingle(),
      supabase.schema('juridica').from('analisis_juridico')
        .select('*').eq('predio_id', predioId).maybeSingle(),
      supabase.schema('geo').rpc('zonas_de_predio', { p_predio_id: predioId }),
      supabase.schema('geo').from('zona_revision')
        .select('zona_id, accion, metodo, geom_original, geom_corregida, area_ha_campo, observaciones, evaluador, fecha, created_at')
        .eq('predio_id', predioId).order('created_at', { ascending: true }),
      supabase.schema('siembra').from('evaluaciones_campo')
        .select('*').eq('predio_id', predioId).order('updated_at', { ascending: false }).limit(1),
      supabase.schema('siembra').from('familias')
        .select('*').eq('predio_id', predioId).is('deleted_at', null)
        .order('updated_at', { ascending: false }).limit(1),
    ])

    // Antecedentes cuelgan de la persona, no del predio.
    const { data: antecedentes } = predio.aliado_id
      ? await supabase.schema('juridica').from('antecedentes')
          .select('*').eq('aliado_id', predio.aliado_id).maybeSingle()
      : { data: null }

    const ev  = (evals?.[0] ?? null) as Record<string, unknown> | null
    const enc = (encuestas?.[0] ?? null) as Record<string, unknown> | null

    // Fotos del predio (cuelgan de la familia, no del predio).
    const { data: fotos } = enc?.id
      ? await supabase.schema('siembra').from('fotos_predio')
          .select('categoria, url').eq('familia_id', enc.id as string)
      : { data: [] }

    const zonasEvaluadas: ZonaEvaluada[] = Array.isArray(ev?.zonas_data)
      ? (ev.zonas_data as Record<string, unknown>[]).map((z) => ({
          zona_id:     (z.zona_id as string) ?? null,
          zona_numero: (z.zona_numero as number) ?? null,
          area_ha_sig: (z.area_ha_sig as number) ?? null,
          suelo:     (z.suelo as Record<string, unknown>) ?? null,
          cobertura: (z.cobertura as Record<string, unknown>) ?? null,
          logistica: (z.logistica as Record<string, unknown>) ?? null,
          riesgos:   (z.riesgos as Record<string, unknown>) ?? null,
        }))
      : []

    // El RPC `zonas_de_predio` devuelve la geometría como TEXTO json, no como
    // objeto: si se lo pasamos tal cual a Leaflet revienta con "Invalid GeoJSON".
    const zonas: ZonaExpediente[] = ((zonasRpc ?? []) as Record<string, unknown>[]).map(z => {
      const g = z.geojson
      let geom: Geometry | null = null
      if (typeof g === 'string') {
        try { geom = JSON.parse(g) as Geometry } catch { geom = null }
      } else if (g && typeof g === 'object') {
        geom = g as Geometry
      }
      return { ...(z as unknown as ZonaExpediente), geojson: geom }
    })

    const cultivosRaw = enc?.sec_cultivos ?? enc?.cultivos
    const cultivos = Array.isArray(cultivosRaw)
      ? (cultivosRaw as Record<string, unknown>[]).filter(c => Object.values(c).some(v => !vacio(v)))
      : []

    const out: Expediente = {
      generado_en: new Date().toISOString(),
      predio: {
        id: predio.id,
        nombre_predio: predio.nombre_predio,
        departamento: predio.departamento,
        municipio: predio.municipio,
        vereda: predio.vereda,
        zona_ae: predio.zona_ae,
        matricula_inmobiliaria: predio.matricula_inmobiliaria,
        matriculas: predio.matriculas,
        codigo_catastral: predio.codigo_catastral,
        area_registral: predio.area_registral,
        created_at: predio.created_at,
      },
      propietario: aliado ?? null,
      copropietarios: (copros ?? []).map((c: Record<string, unknown>) => ({
        nombre_completo:
          (c.aliado as { nombre_completo?: string } | null)?.nombre_completo ?? null,
        rol: (c.rol as string) ?? null,
        cuota_pct: (c.cuota_pct as number) ?? null,
      })),
      expediente: expediente ?? null,
      juridica: {
        debida_diligencia: dd ?? null,
        analisis: analisis ?? null,
        antecedentes: antecedentes ?? null,
      },
      zonas,
      revisiones: (revisiones ?? []) as RevisionExpediente[],
      evaluacion: ev
        ? {
            id: (ev.id as string) ?? null,
            fecha_visita: (ev.fecha_visita as string) ?? null,
            evaluador_1: (ev.evaluador_1 as string) ?? null,
            evaluador_2: (ev.evaluador_2 as string) ?? null,
            num_zonas_eval: (ev.num_zonas_eval as number) ?? null,
            step_completed: (ev.step_completed as number) ?? null,
            updated_at: (ev.updated_at as string) ?? null,
            seccion_1: (ev.seccion_1_data as Record<string, unknown>) ?? null,
            seccion_2: (ev.seccion_2_data as Record<string, unknown>) ?? null,
            seccion_6: (ev.seccion_6_data as Record<string, unknown>) ?? null,
            zonas: zonasEvaluadas,
            firmas: {
              eval1: (ev.firma_eval1_url as string) ?? null,
              eval2: (ev.firma_eval2_url as string) ?? null,
              propietario: (ev.firma_prop_url as string) ?? null,
            },
          }
        : null,
      encuesta: enc
        ? {
            id: (enc.id as string) ?? null,
            fecha_encuesta: (enc.fecha_encuesta as string) ?? null,
            encuestador:
              ((enc.sec_general as Record<string, unknown> | null)?.encuestador as string) ??
              (enc.encuestador as string) ?? null,
            step_completed: (enc.step_completed as number) ?? null,
            updated_at: (enc.updated_at as string) ?? null,
            secciones: resolverSecciones(enc),
            cultivos,
          }
        : null,
      fotos: (fotos ?? []) as { categoria: string | null; url: string }[],
    }

    return NextResponse.json(out)
  } catch (err) {
    console.error('GET /api/reporte/expediente error:', err)
    return NextResponse.json({ error: 'Error al armar el expediente' }, { status: 500 })
  }
}
