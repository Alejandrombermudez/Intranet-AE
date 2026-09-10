import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * EL PULSO DEL SISTEMA
 * ────────────────────
 * Todas las cifras que muestra el mapa salen de aquí, leídas de Supabase en el
 * momento en que alguien abre la página. Ninguna está escrita a mano.
 *
 * El diagrama anterior (docs/flujo-trabajo.pdf) llevaba los números en el SVG y
 * se desactualizó en tres semanas. Peor: los documentos de arquitectura decían
 * que la red de árboles semilleros estaba «por construir» cuando en la base ya
 * había más de dos mil árboles cargados. Esa es la razón de este endpoint.
 *
 * Cada métrica se pide por separado y falla por separado: si una tabla todavía
 * no existe, esa cifra vuelve como `null` y la página lo dice —«sin datos»—
 * en vez de tumbar el mapa entero.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Una cifra viva: qué se contó y cómo se lee. */
export interface Metrica {
  id: string
  valor: number | null
  /** Cómo se lee el número. Va debajo, en minúscula: «predios en el sistema». */
  etiqueta: string
  /** Opcional: sobre qué total se lee, para las que son proporción. */
  de?: string
  /** Si no se pudo contar, por qué. */
  problema?: string
}

export interface Pulso {
  medido: string
  metricas: Record<string, Metrica>
}

/**
 * El filtro se declara como dato, no como función, para no tener que nombrar el
 * tipo interno del constructor de consultas de PostgREST.
 */
type Filtro =
  | { op: 'eq'; col: string; val: string }
  | { op: 'esVerdadero'; col: string }
  | { op: 'noEsNulo'; col: string }

/** Definición de cada conteo: schema, tabla, filtro y cómo se lee. */
type Def = {
  id: string
  schema: string
  tabla: string
  etiqueta: string
  de?: string
  filtro?: Filtro
}

const DEFINICIONES: Def[] = [
  // ── Núcleo ────────────────────────────────────────────────────────────────
  { id: 'predios_total', schema: 'core', tabla: 'predios', etiqueta: 'predios en el sistema' },
  { id: 'aliados_total', schema: 'core', tabla: 'aliados', etiqueta: 'personas registradas' },
  { id: 'usuarios', schema: 'people', tabla: 'user_profiles', etiqueta: 'personas con acceso' },

  // ── Siembra: en qué etapa va cada predio ──────────────────────────────────
  {
    id: 'etapa_juridica', schema: 'core', tabla: 'expedientes',
    etiqueta: 'esperando en jurídica', de: 'predios_total',
    filtro: { op: 'eq', col: 'etapa', val: 'juridica' },
  },
  {
    id: 'etapa_sig', schema: 'core', tabla: 'expedientes',
    etiqueta: 'esperando cartografía', de: 'predios_total',
    filtro: { op: 'eq', col: 'etapa', val: 'sig_i' },
  },
  {
    id: 'etapa_campo', schema: 'core', tabla: 'expedientes',
    etiqueta: 'en campo o ya visitados', de: 'predios_total',
    filtro: { op: 'eq', col: 'etapa', val: 'campo' },
  },

  // ── Geografía ─────────────────────────────────────────────────────────────
  {
    id: 'zonas_vigentes', schema: 'geo', tabla: 'zonas',
    etiqueta: 'zonas vigentes',
    filtro: { op: 'esVerdadero', col: 'vigente' },
  },
  { id: 'zonas_lote', schema: 'geo', tabla: 'zonas_lote', etiqueta: 'subidas versionadas del SIG' },
  { id: 'revisiones_zona', schema: 'geo', tabla: 'zona_revision', etiqueta: 'zonas revisadas en terreno' },

  // ── Campo ─────────────────────────────────────────────────────────────────
  { id: 'evaluaciones', schema: 'siembra', tabla: 'evaluaciones_campo', etiqueta: 'evaluaciones levantadas' },

  // ── Catálogo ──────────────────────────────────────────────────────────────
  { id: 'especies', schema: 'catalogo', tabla: 'especies', etiqueta: 'especies en el maestro' },
  { id: 'proyectos', schema: 'catalogo', tabla: 'proyectos', etiqueta: 'proyectos activos' },

  // ── Conservación ──────────────────────────────────────────────────────────
  { id: 'ras_familias', schema: 'ras', tabla: 'familias', etiqueta: 'familias en conservación' },
  { id: 'ras_arboles', schema: 'ras', tabla: 'arboles_semilleros', etiqueta: 'árboles semilleros con punto GPS' },
  {
    id: 'ras_arboles_con_especie', schema: 'ras', tabla: 'arboles_semilleros',
    etiqueta: 'enlazados al maestro de especies', de: 'ras_arboles',
    filtro: { op: 'noEsNulo', col: 'especie_id' },
  },
  {
    id: 'ras_arboles_verificados', schema: 'ras', tabla: 'arboles_semilleros',
    etiqueta: 'con especie confirmada por botánica', de: 'ras_arboles',
    filtro: { op: 'eq', col: 'estado_verificacion', val: 'Verificado' },
  },
  { id: 'ras_camaras', schema: 'ras', tabla: 'camaras_trampa', etiqueta: 'cámaras trampa instaladas' },
]

export async function GET() {
  const sb = createServerSupabaseClient()

  const resultados = await Promise.all(
    DEFINICIONES.map(async (d): Promise<Metrica> => {
      try {
        // `head: true` no trae filas: solo el encabezado con el conteo exacto.
        // Por eso da igual que la tabla tenga dos mil filas o doscientas mil.
        let q = sb.schema(d.schema).from(d.tabla).select('*', { count: 'exact', head: true })
        const f = d.filtro
        if (f?.op === 'eq') q = q.eq(f.col, f.val)
        else if (f?.op === 'esVerdadero') q = q.is(f.col, true)
        else if (f?.op === 'noEsNulo') q = q.not(f.col, 'is', null)

        const { count, error } = await q
        if (error) {
          return { id: d.id, valor: null, etiqueta: d.etiqueta, de: d.de, problema: error.message }
        }
        return { id: d.id, valor: count ?? 0, etiqueta: d.etiqueta, de: d.de }
      } catch (e) {
        const motivo = e instanceof Error ? e.message : 'no se pudo consultar'
        return { id: d.id, valor: null, etiqueta: d.etiqueta, de: d.de, problema: motivo }
      }
    }),
  )

  const pulso: Pulso = {
    medido: new Date().toISOString(),
    metricas: Object.fromEntries(resultados.map((m) => [m.id, m])),
  }

  return NextResponse.json(pulso, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
