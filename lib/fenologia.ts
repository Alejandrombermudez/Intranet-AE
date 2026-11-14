/**
 * FENOLOGÍA — cálculos del módulo /intranet/ras/fenologia.
 *
 * Sigue el «criterio técnico de calendarios fenológicos» de restauración
 * (RAS, Solano). Lo esencial:
 *
 * - El mes es el de la RONDA (`ronda` = 'YYYY-MM'), no el de la fecha: la ronda
 *   de abril se cerró el 1 y 2 de mayo, y agrupar por fecha la partiría.
 * - Cada fenofase se registra en % de copa (0 · 25 · 50 · 75 · 100), que es la
 *   escala de Fournier (0–4) multiplicada por 25. El promedio de esos % es el
 *   índice de Fournier en porcentaje; dividido por 25, la categoría 0–4.
 * - Floración = máximo de botón floral y floración; fructificación = máximo de
 *   fruto inmaduro y fruto maduro (por monitoreo, antes de promediar).
 * - Un mes SIN monitoreo no es un mes sin actividad: se dibuja distinto. Con
 *   abril–agosto de 2026 nada más, la mitad del año es «sin dato».
 *
 * Sin React ni DOM: se puede usar en el servidor.
 */

export const FENOFASES = [
  { k: 'hoja', n: 'Hoja' },
  { k: 'boton_floral', n: 'Botón floral' },
  { k: 'floracion', n: 'Floración' },
  { k: 'aborto_floral', n: 'Aborto floral' },
  { k: 'fruto_inmaduro', n: 'Fruto inmaduro' },
  { k: 'fruto_maduro', n: 'Fruto maduro' },
  { k: 'fruto_postmaduro', n: 'Fruto postmaduro' },
  { k: 'aborto_frutal', n: 'Aborto frutal' },
  { k: 'plantulas', n: 'Plántulas' },
] as const

export type ColFase = (typeof FENOFASES)[number]['k']
export const COLUMNAS_FASE: ColFase[] = FENOFASES.map((f) => f.k)

/** Lo que se grafica: una fenofase o uno de los dos grupos del criterio técnico. */
export type Serie = ColFase | 'flor' | 'fruto'
export const GRUPOS: Record<'flor' | 'fruto', ColFase[]> = {
  flor: ['boton_floral', 'floracion'],
  fruto: ['fruto_inmaduro', 'fruto_maduro'],
}
export const NOMBRE_SERIE: Record<Serie, string> = {
  flor: 'Floración',
  fruto: 'Fructificación',
  ...(Object.fromEntries(FENOFASES.map((f) => [f.k, f.n])) as Record<ColFase, string>),
}

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre']

/**
 * Colores de los gráficos. No pasan por la paleta de la marca, a propósito
 * (como los mapas): son los del criterio técnico y tienen que ser los mismos
 * en la intranet, en los PNG del informe y en los gráficos de R.
 */
export const COLOR = {
  florLineal: '#D9822B',
  frutoLineal: '#3B7D4F',
  florAnillo: '#F4A9AC',
  frutoAnillo: '#3B7A4A',
  sinActividad: '#EDEDED',
  lluvia: '#7FB3D5',
  tempFria: '#FDE0C5',
  tempCalida: '#C0392B',
  calorBajo: '#F2F2F2',
  calorAlto: '#2E5E3E',
  tinta: '#2b2b28',
  tenue: '#8a8478',
} as const

// ─── Tipos de datos ──────────────────────────────────────────────────────────

export type Animal = { tipo?: string; nombre?: string; conducta?: string; conductaOtra?: string }

export type Monitoreo = {
  id: string
  nucleo: string
  codigo: string
  predio: string
  fecha: string
  ronda: string
  nombre_comun: string | null
  nombre_cientifico: string | null
  familia: string | null
  en_base: boolean
  estado_fitosanitario: string[] | null
  observaciones: string | null
  vio_animal: boolean | null
  animales: Animal[] | null
  monitor: string | null
  origen: 'app' | 'kobo'
} & Record<ColFase, number | null>

export type Arbol = {
  nucleo: string
  codigo: string
  predio: string
  vereda: string | null
  nombre_comun: string | null
  nombre_cientifico: string | null
  familia: string | null
  latitud: number | null
  longitud: number | null
  dap_cm: number | null
  altura_m: number | null
  protocolo: 'especie' | 'genero' | null
}

export type Foto = { id: string; monitoreo_id: string; organo: 'flor' | 'fruto'; aceptada: boolean; borrosa: boolean; tomada_en: string | null }

export type MesClima = { mes: number; precip_mm: number | null; temp_c: number | null }

/**
 * Clima de Open-Meteo por celda de la cuadrícula del reanálisis (~7 km en
 * Solano). Lo arma /api/ras/fenologia/clima con la coordenada de cada árbol:
 * los árboles de la misma celda comparten clima.
 */
export type CeldaClima = {
  id: string
  lat: number
  lon: number
  elevacion: number | null
  /** Promedio mensual del periodo de referencia (12 meses). */
  normal: MesClima[]
  /** Totales/medias mes a mes recientes; `completo` = false para el mes en curso. */
  reciente: { mes: string; precip_mm: number | null; temp_c: number | null; completo: boolean }[]
  /** Claves `nucleo|codigo` de los árboles que caen en la celda. */
  arboles: string[]
}
export type ClimaAbierto = {
  fuente: string
  periodo: string
  celdas: CeldaClima[]
  /** Árboles sin coordenada a los que se les puso la del centro de su predio. */
  aproximados: string[]
  /** Árboles sin coordenada ni predio con coordenadas: quedan fuera. */
  sinUbicar: string[]
}

// ─── Básicos ─────────────────────────────────────────────────────────────────

/** 1–12 a partir de la ronda. */
export const mesDe = (m: { ronda: string }) => Number(m.ronda.slice(5, 7))
export const anioDe = (m: { ronda: string }) => Number(m.ronda.slice(0, 4))

export const especieDe = (m: { nombre_cientifico: string | null; nombre_comun: string | null }) =>
  m.nombre_cientifico?.trim() || (m.nombre_comun?.trim() ? `(${m.nombre_comun.trim()})` : 'Sin especie')

/** El valor de una serie en un monitoreo; null = no se observó (distinto de 0). */
export function valor(m: Monitoreo, s: Serie): number | null {
  if (s === 'flor' || s === 'fruto') {
    const vs = GRUPOS[s].map((k) => m[k]).filter((v): v is number => v !== null && v !== undefined)
    return vs.length ? Math.max(...vs) : null
  }
  const v = m[s]
  return v === null || v === undefined ? null : v
}

export function etiquetaRonda(r: string) {
  return `${MESES[Number(r.slice(5, 7)) - 1]} ${r.slice(0, 4)}`
}

// ─── Celdas del calendario ───────────────────────────────────────────────────

export type Celda = {
  /** Índice de Fournier en %: promedio del % de copa (0–100). */
  media: number
  /** % de monitoreos (árbol × ronda) con la fase presente. */
  activos: number
  /** Monitoreos con dato. */
  n: number
  /** Árboles distintos con dato. */
  arboles: number
}

/** 12 celdas (ene–dic) de una serie para un conjunto de monitoreos. null = mes sin monitoreo. */
export function celdasMes(ms: Monitoreo[], s: Serie): (Celda | null)[] {
  const acc = Array.from({ length: 12 }, () => ({ suma: 0, act: 0, n: 0, arb: new Set<string>() }))
  for (const m of ms) {
    const v = valor(m, s)
    if (v === null) continue
    const a = acc[mesDe(m) - 1]
    if (!a) continue
    a.suma += v
    a.n += 1
    if (v > 0) a.act += 1
    a.arb.add(`${m.nucleo}|${m.codigo}`)
  }
  return acc.map((a) => (a.n ? { media: a.suma / a.n, activos: (100 * a.act) / a.n, n: a.n, arboles: a.arb.size } : null))
}

export function agrupar<T, K extends string>(xs: T[], clave: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>()
  for (const x of xs) {
    const k = clave(x)
    const l = m.get(k)
    if (l) l.push(x)
    else m.set(k, [x])
  }
  return m
}

// ─── Por especie ─────────────────────────────────────────────────────────────

export type ResumenEspecie = {
  especie: string
  comunes: string[]
  familia: string | null
  arboles: number
  predios: string[]
  monitoreos: number
  rondas: number
  anios: number[]
  flor: (Celda | null)[]
  fruto: (Celda | null)[]
  maduro: (Celda | null)[]
  /** Primer mes (0–11) con floración; si no hay, con fruto; si no, 99. Para ordenar. */
  orden: number
  /** Meses (0–11) con fruto maduro presente. */
  ventana: number[]
  pico: number | null
  preliminar: boolean
  sincroniaFlor: number | null
  sincroniaFruto: number | null
}

export function resumenEspecies(ms: Monitoreo[]): ResumenEspecie[] {
  const grupos = agrupar(ms, especieDe)
  const out: ResumenEspecie[] = []
  for (const [especie, l] of grupos) {
    const flor = celdasMes(l, 'flor')
    const fruto = celdasMes(l, 'fruto')
    const maduro = celdasMes(l, 'fruto_maduro')
    const primero = (cs: (Celda | null)[]) => cs.findIndex((c) => !!c && c.media > 0)
    const fFlor = primero(flor)
    const fFruto = primero(fruto)
    const ventana = maduro.map((c, i) => (c && c.media > 0 ? i : -1)).filter((i) => i >= 0)
    let pico: number | null = null
    for (const i of ventana) if (pico === null || maduro[i]!.media > maduro[pico]!.media) pico = i
    const arboles = new Set(l.map((m) => m.codigo)).size
    const anios = [...new Set(l.map(anioDe))].sort()
    out.push({
      especie,
      comunes: [...new Set(l.map((m) => m.nombre_comun?.trim()).filter((x): x is string => !!x))].sort(),
      familia: l.find((m) => m.familia)?.familia ?? null,
      arboles,
      predios: [...new Set(l.map((m) => m.predio))].sort(),
      monitoreos: l.length,
      rondas: new Set(l.map((m) => m.ronda)).size,
      anios,
      flor,
      fruto,
      maduro,
      orden: fFlor >= 0 ? fFlor : fFruto >= 0 ? 12 + fFruto : 99,
      ventana,
      pico,
      preliminar: arboles < 2 || anios.length < 2,
      sincroniaFlor: sincronia(l, 'flor'),
      sincroniaFruto: sincronia(l, 'fruto'),
    })
  }
  return out.sort((a, b) => a.orden - b.orden || a.especie.localeCompare(b.especie))
}

/**
 * Índice de sincronía de Augspurger (1983): para cada árbol, la fracción de sus
 * rondas activas en que los demás árboles de la especie también lo estaban,
 * promediada. 1 = todos a la vez; 0 = nunca coinciden. Necesita ≥ 2 árboles
 * con la fase; si no, null.
 */
export function sincronia(ms: Monitoreo[], s: Serie): number | null {
  const act = new Map<string, Set<string>>()
  for (const m of ms) {
    const v = valor(m, s)
    if (v && v > 0) {
      const set = act.get(m.codigo) ?? new Set<string>()
      set.add(m.ronda)
      act.set(m.codigo, set)
    }
  }
  const ids = [...act.keys()]
  if (ids.length < 2) return null
  let suma = 0
  for (const i of ids) {
    const ai = act.get(i)!
    let x = 0
    for (const j of ids) {
      if (j === i) continue
      const aj = act.get(j)!
      let e = 0
      for (const r of ai) if (aj.has(r)) e++
      x += e / ai.size
    }
    suma += x / (ids.length - 1)
  }
  return suma / ids.length
}

// ─── Clima ───────────────────────────────────────────────────────────────────

/** Celda de cada árbol (`nucleo|codigo` → celda). */
export function indiceCeldas(c: ClimaAbierto | null): Map<string, CeldaClima> {
  const m = new Map<string, CeldaClima>()
  for (const celda of c?.celdas ?? []) for (const k of celda.arboles) m.set(k, celda)
  return m
}

/**
 * Clima de un grupo de árboles: el promedio de sus celdas, pesado por cuántos
 * árboles del grupo caen en cada una. Así el climograma de una especie es el
 * de donde están sus árboles, no el de todo el núcleo.
 */
export function climaPonderado(indice: Map<string, CeldaClima>, claves: Iterable<string>): { meses: MesClima[]; celdas: CeldaClima[]; arboles: number } | null {
  const peso = new Map<CeldaClima, number>()
  for (const k of claves) {
    const c = indice.get(k)
    if (c) peso.set(c, (peso.get(c) ?? 0) + 1)
  }
  const total = [...peso.values()].reduce((a, b) => a + b, 0)
  if (!total) return null
  const meses = Array.from({ length: 12 }, (_, i) => {
    let p = 0, t = 0, wp = 0, wt = 0
    for (const [c, w] of peso) {
      const m = c.normal[i]
      if (m?.precip_mm !== null && m?.precip_mm !== undefined) { p += m.precip_mm * w; wp += w }
      if (m?.temp_c !== null && m?.temp_c !== undefined) { t += m.temp_c * w; wt += w }
    }
    return { mes: i + 1, precip_mm: wp ? p / wp : null, temp_c: wt ? t / wt : null }
  })
  return { meses, celdas: [...peso.keys()], arboles: total }
}

/** Lo mismo, para la lluvia real mes a mes ('YYYY-MM' → mm). */
export function lluviaRecientePonderada(indice: Map<string, CeldaClima>, claves: Iterable<string>): Map<string, { precip_mm: number; completo: boolean }> {
  const peso = new Map<CeldaClima, number>()
  for (const k of claves) {
    const c = indice.get(k)
    if (c) peso.set(c, (peso.get(c) ?? 0) + 1)
  }
  const acc = new Map<string, { s: number; w: number; completo: boolean }>()
  for (const [c, w] of peso) {
    for (const r of c.reciente) {
      if (r.precip_mm === null) continue
      const a = acc.get(r.mes) ?? { s: 0, w: 0, completo: true }
      a.s += r.precip_mm * w
      a.w += w
      a.completo = a.completo && r.completo
      acc.set(r.mes, a)
    }
  }
  return new Map([...acc].map(([k, a]) => [k, { precip_mm: a.s / a.w, completo: a.completo }]))
}

/**
 * Meses lluviosos (0–11): sobre la mediana anual. En Solano llueve todo el año
 * (ningún mes baja de ~150 mm), así que «lluvioso» aquí es «más lluvioso que
 * la mitad del año», no lo contrario de seco. El pie de figura lo dice.
 */
export function mesesLluviosos(meses: MesClima[] | null | undefined): { meses: number[]; criterio: string } {
  const ps = (meses ?? []).map((m) => m.precip_mm).filter((v): v is number => v !== null)
  if (!meses || ps.length < 12) return { meses: [], criterio: '' }
  const ord = [...ps].sort((a, b) => a - b)
  const med = (ord[5] + ord[6]) / 2
  return { meses: meses.flatMap((m, i) => (m.precip_mm! > med ? [i] : [])), criterio: `lluvia sobre la mediana anual (${Math.round(med)} mm)` }
}

// ─── Estado en la última ronda ───────────────────────────────────────────────

export type Estado = 'maduro' | 'verde' | 'flor' | 'nada' | 'sin'
export const ESTADOS: { k: Estado; n: string; color: string }[] = [
  { k: 'maduro', n: 'Con fruto maduro', color: COLOR.frutoLineal },
  { k: 'verde', n: 'Con fruto verde', color: '#7fae8a' },
  { k: 'flor', n: 'En flor', color: COLOR.florLineal },
  { k: 'nada', n: 'Sin flor ni fruto', color: '#b9b3a6' },
  { k: 'sin', n: 'Sin visita en la última ronda', color: '#d9d6cf' },
]

/** Lo más avanzado que tenía al menos un árbol del grupo en la ronda dada. */
export function estadoEn(ms: Monitoreo[], ronda: string | undefined): Estado {
  const l = ms.filter((m) => m.ronda === ronda)
  if (!l.length) return 'sin'
  if (l.some((m) => (m.fruto_maduro ?? 0) > 0)) return 'maduro'
  if (l.some((m) => (m.fruto_inmaduro ?? 0) > 0)) return 'verde'
  if (l.some((m) => (valor(m, 'flor') ?? 0) > 0)) return 'flor'
  return 'nada'
}

// ─── Exportación tabular (formato largo del criterio técnico §2.1) ───────────

export function csv(filas: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + filas.map((f) => f.map(esc).join(',')).join('\r\n')
}

/**
 * La tabla que piden los scripts de R (`calendario_fenologico.R` y compañía):
 * una fila por especie–mes–fase, con la intensidad ya resumida (Fournier 0–4).
 * Solo los meses con monitoreo: el mes sin dato no se escribe como 0.
 */
export function tablaLargaR(ms: Monitoreo[], series: Serie[] = ['flor', 'fruto']) {
  const filas: (string | number | null)[][] = [['especie', 'mes', 'fase', 'intensidad', 'pct_individuos', 'n_monitoreos', 'n_arboles']]
  for (const [especie, l] of agrupar(ms, especieDe)) {
    for (const s of series) {
      celdasMes(l, s).forEach((c, i) => {
        if (!c) return
        filas.push([especie, i + 1, NOMBRE_SERIE[s], +(c.media / 25).toFixed(2), +c.activos.toFixed(1), c.n, c.arboles])
      })
    }
  }
  return filas
}
