/**
 * CLIMA ABIERTO — clima por coordenada de árbol desde Open-Meteo (solo servidor).
 *
 * Usa la Historical Weather API de Open-Meteo (reanálisis ERA5 y ECMWF IFS,
 * datos abiertos CC BY 4.0, sin cuenta). Su cuadrícula en Solano es de ~7 km:
 * se probó el 2026-11-13 y los 13 predios caen en 5 celdas, con lluvia anual
 * entre ~3.100 y ~4.000 mm. Árboles de la misma celda comparten clima.
 *
 * Cuidar el cupo gratuito (600 «llamadas» por minuto, 5.000 por hora, 10.000
 * por día; 10 años diarios en un punto pesan ~260). Por eso:
 * - las coordenadas se redondean a 0,02° (~2 km: 13 puntos para Solano). Con
 *   0,05° algunos árboles saltaban a la celda vecina;
 * - todo va en UNA consulta (2016 → hoy): en la prueba, la segunda consulta
 *   seguida a una grande la rechazó el cupo del minuto;
 * - se guarda el resultado ya resumido (~15 KB) con unstable_cache por tres
 *   días, no la respuesta cruda (>1 MB, cerca del tope de 2 MB de la caché de
 *   Vercel: pasado ese tope no se guarda y cada visita volvería a pedir).
 *
 * No manda nada de las personas: solo coordenadas redondeadas.
 */

import { unstable_cache } from 'next/cache'
import type { CeldaClima, ClimaAbierto, MesClima } from '@/lib/fenologia'

const API = 'https://archive-api.open-meteo.com/v1/archive'
const NORMAL = { inicio: '2016-01-01', desde: 2016, hasta: 2025, etiqueta: '2016–2025' }
const RECIENTE_DESDE = '2025-01'
const PASO = 0.02

type Punto = { lat: number; lon: number }
type Respuesta = {
  latitude: number
  longitude: number
  elevation?: number
  daily: { time: string[]; precipitation_sum: (number | null)[]; temperature_2m_mean: (number | null)[] }
}

export type ArbolUbicable = { nucleo: string; codigo: string; predio: string; latitud: number | null; longitud: number | null }

const redondear = (v: number) => Math.round(v / PASO) * PASO

async function pedir(puntos: Punto[], inicio: string, fin: string): Promise<Respuesta[]> {
  const q = new URLSearchParams({
    latitude: puntos.map((p) => p.lat.toFixed(3)).join(','),
    longitude: puntos.map((p) => p.lon.toFixed(3)).join(','),
    start_date: inicio,
    end_date: fin,
    daily: 'precipitation_sum,temperature_2m_mean',
    timezone: 'America/Bogota',
  })
  const r = await fetch(`${API}?${q}`, { cache: 'no-store' })
  const j = await r.json().catch(() => null)
  if (!r.ok || !j || j.error) {
    const motivo = j?.reason ?? `HTTP ${r.status}`
    throw new Error(r.status === 429
      ? 'Open-Meteo pidió esperar: se agotó el cupo gratuito por un rato. Intenta de nuevo en unos minutos.'
      : `Open-Meteo no respondió (${motivo}).`)
  }
  return Array.isArray(j) ? j : [j]
}

/** Totales de lluvia y temperatura media por mes calendario ('YYYY-MM'). */
function porMes(d: Respuesta['daily']) {
  const m = new Map<string, { p: number; np: number; t: number; nt: number; dias: number }>()
  d.time.forEach((fecha, i) => {
    const k = fecha.slice(0, 7)
    const a = m.get(k) ?? { p: 0, np: 0, t: 0, nt: 0, dias: 0 }
    a.dias++
    const p = d.precipitation_sum[i]
    const t = d.temperature_2m_mean[i]
    if (p !== null && p !== undefined) { a.p += p; a.np++ }
    if (t !== null && t !== undefined) { a.t += t; a.nt++ }
    m.set(k, a)
  })
  return m
}

const diasDelMes = (k: string) => new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 0)).getUTCDate()

function normales(d: Respuesta['daily']): MesClima[] {
  const acc = Array.from({ length: 12 }, () => ({ p: 0, np: 0, t: 0, nt: 0 }))
  for (const [k, a] of porMes(d)) {
    const anio = Number(k.slice(0, 4))
    if (anio < NORMAL.desde || anio > NORMAL.hasta) continue
    const i = Number(k.slice(5, 7)) - 1
    // Solo meses con casi todos los días: un mes a medias bajaría el promedio.
    if (a.np >= diasDelMes(k) - 2) { acc[i].p += a.p; acc[i].np++ }
    if (a.nt) { acc[i].t += a.t / a.nt; acc[i].nt++ }
  }
  return acc.map((a, i) => ({
    mes: i + 1,
    precip_mm: a.np ? Math.round((a.p / a.np) * 10) / 10 : null,
    temp_c: a.nt ? Math.round((a.t / a.nt) * 100) / 100 : null,
  }))
}

function recientes(d: Respuesta['daily']): CeldaClima['reciente'] {
  return [...porMes(d)].filter(([k]) => k >= RECIENTE_DESDE).map(([k, a]) => ({
    mes: k,
    precip_mm: a.np ? Math.round(a.p * 10) / 10 : null,
    temp_c: a.nt ? Math.round((a.t / a.nt) * 100) / 100 : null,
    completo: a.np >= diasDelMes(k),
  }))
}

/** Fecha de Colombia menos `dias` (el reanálisis llega con ~5 días de atraso). */
function haceDias(dias: number) {
  const hoy = new Date(Date.now() - 5 * 3600_000)
  hoy.setUTCDate(hoy.getUTCDate() - dias)
  return hoy.toISOString().slice(0, 10)
}

type Celdas = { celdaDePunto: Record<string, string>; celdas: Omit<CeldaClima, 'arboles'>[] }

/** La consulta a Open-Meteo para una lista de puntos «lat,lon», ya resumida por celda. */
export async function consultarCeldas(ids: string[]): Promise<Celdas> {
  const lista = ids.map((id) => { const [lat, lon] = id.split(',').map(Number); return { lat, lon } })
  const resp = await pedir(lista, NORMAL.inicio, haceDias(6))
  const celdas = new Map<string, Omit<CeldaClima, 'arboles'>>()
  const celdaDePunto: Record<string, string> = {}
  ids.forEach((id, i) => {
    const r = resp[i]
    const cid = `${r.latitude.toFixed(3)},${r.longitude.toFixed(3)}`
    if (!celdas.has(cid)) {
      celdas.set(cid, { id: cid, lat: r.latitude, lon: r.longitude, elevacion: r.elevation ?? null, normal: normales(r.daily), reciente: recientes(r.daily) })
    }
    celdaDePunto[id] = cid
  })
  return { celdaDePunto, celdas: [...celdas.values()] }
}

/** Lo mismo con caché de tres días (la clave incluye la lista de puntos). */
const consultarCeldasCache = unstable_cache(consultarCeldas, ['clima-open-meteo-v1'], { revalidate: 3 * 24 * 3600 })

export async function climaPorArbol(arboles: ArbolUbicable[], consultar: (ids: string[]) => Promise<Celdas> = consultarCeldasCache): Promise<ClimaAbierto> {
  // Árbol sin coordenada: la del centro de los demás árboles de su predio.
  const centro = new Map<string, Punto>()
  const porPredio = new Map<string, Punto[]>()
  for (const a of arboles) {
    if (a.latitud && a.longitud) {
      const k = `${a.nucleo}|${a.predio}`
      porPredio.set(k, [...(porPredio.get(k) ?? []), { lat: Number(a.latitud), lon: Number(a.longitud) }])
    }
  }
  for (const [k, ps] of porPredio) {
    centro.set(k, { lat: ps.reduce((s, p) => s + p.lat, 0) / ps.length, lon: ps.reduce((s, p) => s + p.lon, 0) / ps.length })
  }

  const aproximados: string[] = []
  const sinUbicar: string[] = []
  const puntoDe = new Map<string, string>() // árbol → punto de consulta
  const puntos = new Map<string, Punto>()
  for (const a of arboles) {
    const clave = `${a.nucleo}|${a.codigo}`
    let p: Punto | undefined = a.latitud && a.longitud ? { lat: Number(a.latitud), lon: Number(a.longitud) } : undefined
    if (!p) {
      p = centro.get(`${a.nucleo}|${a.predio}`)
      if (p) aproximados.push(clave)
      else { sinUbicar.push(clave); continue }
    }
    const q = { lat: redondear(p.lat), lon: redondear(p.lon) }
    const id = `${q.lat.toFixed(3)},${q.lon.toFixed(3)}`
    puntos.set(id, q)
    puntoDe.set(clave, id)
  }

  const ids = [...puntos.keys()].sort()
  if (!ids.length) return { fuente: fuenteTexto(), periodo: NORMAL.etiqueta, celdas: [], aproximados, sinUbicar }

  // Varios puntos de consulta pueden caer en la misma celda del reanálisis.
  const r = await consultar(ids)
  const celdas = new Map<string, CeldaClima>(r.celdas.map((c) => [c.id, { ...c, arboles: [] }]))
  for (const [clave, id] of puntoDe) celdas.get(r.celdaDePunto[id])?.arboles.push(clave)

  return {
    fuente: fuenteTexto(),
    periodo: NORMAL.etiqueta,
    celdas: [...celdas.values()].sort((a, b) => b.arboles.length - a.arboles.length),
    aproximados,
    sinUbicar,
  }
}

function fuenteTexto() {
  return `Open-Meteo, Historical Weather API (reanálisis ERA5 / ECMWF IFS, CC BY 4.0), celda de ~7 km por árbol; promedio ${NORMAL.etiqueta}`
}
