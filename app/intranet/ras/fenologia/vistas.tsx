'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Download, FileSpreadsheet, Camera, ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { Aviso, Boton, Seccion, Vacio } from '@/app/components/marca'
import { fetchConSesion } from '@/lib/fetch-sesion'
import {
  COLOR, ESTADOS, FENOFASES, MESES, MESES_LARGOS, NOMBRE_SERIE, agrupar, celdasMes, csv, especieDe,
  etiquetaRonda, lluviaRecientePonderada, mesDe, mesesLluviosos, tablaLargaR, valor,
  type Arbol, type CeldaClima, type ClimaAbierto, type Estado, type Foto, type MesClima, type Monitoreo,
  type ResumenEspecie, type Serie,
} from '@/lib/fenologia'
import {
  CalendarioCircular, CalendarioLineal, Climograma, CurvasRonda, LluviaRondas, MapaCalor, TiraMeses,
  descargarBlob, descargarPng, type GrupoEspecies,
} from './graficos'
import type { CeldaMapa, PuntoMapa } from './mapa-clima'

const MapaClima = dynamic(() => import('./mapa-clima'), {
  ssr: false,
  loading: () => <div className="grid h-[460px] place-items-center rounded-2xl bg-hueso/60 text-[13px] text-suave">Cargando el mapa…</div>,
})

const fmt = (n: number, d = 0) => n.toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d })
const pct = (n: number) => `${fmt(n)} %`
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
export const claveArbol = (x: { nucleo: string; codigo: string }) => `${x.nucleo}|${x.codigo}`

export type ClimaGrupo = { meses: MesClima[]; celdas: CeldaClima[]; arboles: number } | null

export type Contexto = {
  ms: Monitoreo[]
  arboles: Arbol[]
  fotos: Foto[]
  rondas: string[]
  ultima: string | undefined
  /** Meses (0–11) con al menos una ronda: lo que se dibuja con «solo meses monitoreados». */
  mesesMonitoreados: number[]
  especies: ResumenEspecie[]
  /** Estado de cada especie en la última ronda. */
  estado: Map<string, Estado>
  protocolo: Map<string, string>
  pie: string
  nucleo: string
  clima: ClimaAbierto | null
  climaError: string | null
  indiceClima: Map<string, CeldaClima>
  climaDe: (claves: Iterable<string>) => ClimaGrupo
}

/** Pie de figura para el clima de un grupo de árboles. */
function pieClima(c: Contexto, g: ClimaGrupo) {
  if (!g || !c.clima) return ''
  return ` Clima: Open-Meteo (reanálisis ERA5 / ECMWF IFS, CC BY 4.0), promedio ${c.clima.periodo}, ponderado por árbol en ${g.celdas.length} celda(s) de ~7 km (${g.arboles} árboles).`
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

function Casilla({ v, set, children, disabled }: { v: boolean; set: (b: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className={`inline-flex select-none items-center gap-2 text-[13px] text-tinta ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={v} disabled={disabled} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-[#2f3f32]" />
      {children}
    </label>
  )
}

/** Botones de una sola elección, en una pastilla. */
function Segmentos<T extends string>({ valor: v, opciones, set, etiqueta }: { valor: T; opciones: { k: T; n: ReactNode }[]; set: (k: T) => void; etiqueta?: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      {etiqueta && <span className="text-[11.5px] uppercase tracking-wide text-suave">{etiqueta}</span>}
      <div className="inline-flex rounded-full border border-linea/80 bg-white p-0.5">
        {opciones.map((o) => (
          <button key={o.k} onClick={() => set(o.k)}
            className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${v === o.k ? 'bg-bosque text-hueso' : 'text-suave hover:text-tinta'}`}>
            {o.n}
          </button>
        ))}
      </div>
    </div>
  )
}

function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-linea/70 bg-white p-4 sm:p-5 ${className}`}>{children}</div>
}

function Nombre({ e }: { e: string }) {
  return e.startsWith('(') ? <span>{e}</span> : <i>{e}</i>
}

function EstadoChip({ e }: { e: Estado | undefined }) {
  const x = ESTADOS.find((s) => s.k === e)
  if (!x) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-hueso/80 px-2 py-0.5 text-[11px] text-suave">
      <span className="h-2 w-2 rounded-full" style={{ background: x.color }} />{x.n.replace(' en la última ronda', '')}
    </span>
  )
}

function bajarCsv(filas: (string | number | null | undefined)[][], nombre: string) {
  descargarBlob(new Blob([csv(filas)], { type: 'text/csv;charset=utf-8' }), nombre)
}

const ESCALA_COPA = 'Índice de Fournier en %: promedio del % de copa en fase (0 · 25 · 50 · 75 · 100) entre los árboles monitoreados en la ronda.'
const activa = (e: ResumenEspecie) => e.orden < 99

// ═══ Especies: todas, filtradas y agrupadas ══════════════════════════════════

type Mostrar = 'activas' | 'todas' | 'inactivas'
type Agrupar = 'no' | 'estado' | 'familia' | 'arboles'
type Ver = 'tarjetas' | 'calendario' | 'calor'

const SERIES_CALOR: Serie[] = ['flor', 'fruto', ...FENOFASES.map((f) => f.k)]

function grupoArboles(n: number) {
  return n >= 5 ? '5 árboles o más' : n >= 2 ? 'De 2 a 4 árboles' : 'Un solo árbol (calendario preliminar)'
}

export function VistaEspecies({ c, irEspecie }: { c: Contexto; irEspecie: (e: string) => void }) {
  const [buscar, setBuscar] = useState('')
  const [mostrar, setMostrar] = useState<Mostrar>('activas')
  const [agruparPor, setAgrupar] = useState<Agrupar>('estado')
  const [ver, setVer] = useState<Ver>('tarjetas')
  const [anioCompleto, setAnioCompleto] = useState(false)
  // Apagada de entrada: con copas de 5–25 % casi todo queda en la opacidad mínima.
  const [intensidad, setIntensidad] = useState(false)
  const [conClima, setConClima] = useState(true)
  const [series, setSeries] = useState<Serie[]>(['flor', 'fruto'])
  const ref = useRef<SVGSVGElement>(null)

  const nActivas = c.especies.filter(activa).length
  const meses = anioCompleto || c.mesesMonitoreados.length === 0 ? Array.from({ length: 12 }, (_, i) => i) : c.mesesMonitoreados

  const lista = useMemo(() => {
    const q = norm(buscar.trim())
    return c.especies.filter((e) =>
      (mostrar === 'todas' || (mostrar === 'activas') === activa(e)) &&
      (!q || norm(`${e.especie} ${e.comunes.join(' ')} ${e.familia ?? ''}`).includes(q)))
  }, [c.especies, mostrar, buscar])

  const grupos: GrupoEspecies[] = useMemo(() => {
    if (agruparPor === 'no') return [{ especies: lista }]
    if (agruparPor === 'estado') {
      return ESTADOS.map((s) => ({ titulo: s.n, especies: lista.filter((e) => (c.estado.get(e.especie) ?? 'sin') === s.k) })).filter((g) => g.especies.length)
    }
    const clave = agruparPor === 'familia' ? (e: ResumenEspecie) => e.familia ?? 'Sin familia' : (e: ResumenEspecie) => grupoArboles(e.arboles)
    const orden = agruparPor === 'arboles' ? ['5 árboles o más', 'De 2 a 4 árboles', 'Un solo árbol (calendario preliminar)'] : null
    return [...agrupar(lista, clave)]
      .sort((a, b) => orden ? orden.indexOf(a[0]) - orden.indexOf(b[0]) : a[0].localeCompare(b[0]))
      .map(([titulo, especies]) => ({ titulo: agruparPor === 'familia' ? titulo.charAt(0) + titulo.slice(1).toLowerCase() : titulo, especies }))
  }, [lista, agruparPor, c.estado])

  const clima = useMemo(() => c.climaDe([...new Set([...c.arboles.map(claveArbol), ...c.ms.map(claveArbol)])]), [c])
  const lluviosos = mesesLluviosos(clima?.meses)
  const climaVisible = conClima && clima ? clima.meses : null

  // Lo que hay ahora (última ronda), para la línea de arriba.
  const ahora = ESTADOS.slice(0, 3).map((s) => ({ ...s, n_: s.n, n: c.especies.filter((e) => c.estado.get(e.especie) === s.k).length }))
  const alternar = (s: Serie) => setSeries((x) => x.includes(s) ? x.filter((y) => y !== s) : x.length >= 4 ? x : [...x, s])
  const planas = grupos.flatMap((g) => g.especies)
  const gruposMs = useMemo(() => agrupar(c.ms, especieDe), [c.ms])

  return (
    <>
      {c.ultima && (
        <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-linea/70 bg-white px-4 py-3 text-[13px]">
          <span className="text-[11.5px] uppercase tracking-wide text-suave">En {etiquetaRonda(c.ultima)}</span>
          {ahora.map((s) => (
            <span key={s.k} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              <b className="font-semibold tabular-nums">{s.n}</b> {s.n === 1 ? 'especie' : 'especies'} {s.n_.toLowerCase()}
            </span>
          ))}
          <span className="text-suave">· {c.especies.length - nActivas} de {c.especies.length} no han mostrado flor ni fruto en ninguna ronda</span>
        </div>
      )}

      {/* Barra de herramientas */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[16rem] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tenue" />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar especie, nombre común o familia"
              className="w-full rounded-full border border-linea/80 bg-white py-2 pl-9 pr-9 text-[13.5px]" />
            {buscar && <button onClick={() => setBuscar('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-tenue hover:text-tinta" aria-label="Borrar búsqueda"><X size={15} /></button>}
          </label>
          <Segmentos valor={mostrar} set={setMostrar} opciones={[
            { k: 'activas', n: <>Con flor o fruto <span className="opacity-70">{nActivas}</span></> },
            { k: 'todas', n: <>Todas <span className="opacity-70">{c.especies.length}</span></> },
            { k: 'inactivas', n: <>Sin actividad <span className="opacity-70">{c.especies.length - nActivas}</span></> },
          ]} />
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Segmentos etiqueta="Ver" valor={ver} set={setVer} opciones={[
            { k: 'tarjetas', n: 'Tarjetas' }, { k: 'calendario', n: 'Calendario' }, { k: 'calor', n: 'Mapa de calor' },
          ]} />
          <label className="inline-flex items-center gap-2 text-[13px]">
            <span className="text-[11.5px] uppercase tracking-wide text-suave">Agrupar</span>
            <select value={agruparPor} onChange={(e) => setAgrupar(e.target.value as Agrupar)} className="rounded-full border border-linea/80 bg-white px-3 py-1.5 text-[12.5px]">
              <option value="estado">Por lo que tenía en la última ronda</option>
              <option value="familia">Por familia</option>
              <option value="arboles">Por número de árboles</option>
              <option value="no">Sin agrupar</option>
            </select>
          </label>
          <Casilla v={anioCompleto} set={setAnioCompleto}>Año completo</Casilla>
          {ver === 'calendario' && <>
            <Casilla v={intensidad} set={setIntensidad}>Intensidad</Casilla>
            <Casilla v={conClima && !!clima} set={setConClima} disabled={!clima}>Clima encima</Casilla>
          </>}
          <span className="ml-auto text-[12px] text-suave">{lista.length} especie{lista.length === 1 ? '' : 's'}</span>
        </div>
        {ver === 'calor' && (
          <div className="flex flex-wrap items-center gap-1.5">
            {SERIES_CALOR.map((s) => (
              <button key={s} onClick={() => alternar(s)}
                className={`rounded-full px-3 py-1 text-[12px] transition-colors ${series.includes(s) ? 'bg-bosque text-hueso' : 'border border-linea/80 bg-white text-suave hover:text-tinta'}`}>
                {NOMBRE_SERIE[s]}
              </button>
            ))}
            <span className="ml-1 text-[11.5px] text-suave">hasta cuatro</span>
          </div>
        )}
      </div>

      {lista.length === 0 ? <Vacio>Ninguna especie con estos filtros.</Vacio> : ver === 'tarjetas' ? (
        <div className="space-y-8">
          {grupos.map((g) => (
            <div key={g.titulo ?? 'todas'}>
              {g.titulo && (
                <h3 className="mb-3 flex items-baseline gap-2 border-b border-linea/70 pb-1.5 text-[12px] font-semibold uppercase tracking-wide text-tinta">
                  {g.titulo}<span className="font-normal normal-case tracking-normal text-suave">{g.especies.length} especie{g.especies.length === 1 ? '' : 's'}</span>
                </h3>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {g.especies.map((e) => <TarjetaEspecie key={e.especie} e={e} meses={meses} estado={agruparPor === 'estado' ? undefined : c.estado.get(e.especie)} onClick={() => irEspecie(e.especie)} />)}
              </div>
            </div>
          ))}
          <p className="text-[12px] text-suave">Cada casilla es un mes: color = la fase estuvo presente (más intenso, más copa); gris = se monitoreó y no estaba; trama = sin monitoreo. Toca una especie para ver su ficha.</p>
        </div>
      ) : ver === 'calendario' ? (
        <>
          <div className="mb-2 flex justify-end gap-2">
            <Boton variante="secundario" icono={<Download size={14} />} onClick={() => descargarPng(ref.current, `calendario_lineal_${c.nucleo}`, 10)}>PNG</Boton>
            <Boton variante="secundario" icono={<FileSpreadsheet size={14} />} onClick={() => bajarCsv(tablaLargaR(c.ms), `fenologia_formato_largo_${c.nucleo}.csv`)}>Tabla para R</Boton>
          </div>
          <Tarjeta className="p-2 sm:p-3">
            <CalendarioLineal svgRef={ref} grupos={grupos} meses={meses} intensidad={intensidad} clima={climaVisible}
              lluviosos={climaVisible ? lluviosos.meses : []}
              pie={c.pie + pieClima(c, climaVisible ? clima : null) + (climaVisible && lluviosos.criterio ? ` Franja azul: ${lluviosos.criterio}.` : '')} />
          </Tarjeta>
          <p className="mt-3 text-[12px] text-suave">La «Tabla para R» es el formato largo del criterio técnico (especie, mes, fase, intensidad 0–4), resumida por especie y mes, para <code>calendario_fenologico.R</code>. Lleva todas las especies, no solo las filtradas; los meses sin monitoreo no van.</p>
        </>
      ) : (
        <>
          <div className="mb-2 flex justify-end gap-2">
            <Boton variante="secundario" icono={<Download size={14} />} onClick={() => descargarPng(ref.current, `mapa_calor_${c.nucleo}`, 11)}>PNG</Boton>
            <Boton variante="secundario" icono={<FileSpreadsheet size={14} />} onClick={() => bajarCsv(tablaLargaR(c.ms, series), `fenologia_${series.join('_')}_${c.nucleo}.csv`)}>CSV</Boton>
          </div>
          {series.length === 0 ? <Vacio>Elige al menos una fase.</Vacio> : (
            <Tarjeta className="p-2 sm:p-3">
              <MapaCalor svgRef={ref} meses={meses} filas={planas.map((e) => ({ especie: e.especie, n: e.arboles }))} pie={c.pie}
                paneles={series.map((s) => ({ titulo: NOMBRE_SERIE[s], celdas: planas.map((e) => celdasMes(gruposMs.get(e.especie) ?? [], s)) }))} />
            </Tarjeta>
          )}
        </>
      )}
    </>
  )
}

function TarjetaEspecie({ e, meses, estado, onClick }: { e: ResumenEspecie; meses: number[]; estado?: Estado; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex flex-col gap-2.5 rounded-2xl border border-linea/70 bg-white p-4 text-left transition-colors hover:border-bosque">
      <div className="min-w-0">
        <p className="text-[14px] leading-snug text-tinta group-hover:underline"><Nombre e={e.especie} /></p>
        <p className="truncate text-[12px] text-suave">{e.comunes.join(' · ') || 'Sin nombre común'}</p>
        {estado && <div className="mt-1.5"><EstadoChip e={estado} /></div>}
      </div>
      <div className="grid grid-cols-[2.6rem_1fr] items-center gap-x-2 gap-y-1 text-[10.5px] text-suave">
        <span />
        <span className="flex gap-[3px]">{meses.map((i) => <span key={i} className="flex-1 text-center">{meses.length > 6 ? MESES[i][0] : MESES[i]}</span>)}</span>
        <span>Flor</span><span className="flex"><TiraMeses celdas={e.flor} color={COLOR.florLineal} meses={meses} grande /></span>
        <span>Fruto</span><span className="flex"><TiraMeses celdas={e.fruto} color={COLOR.frutoLineal} meses={meses} grande /></span>
      </div>
      <p className="text-[11.5px] text-suave">
        {e.arboles} árbol{e.arboles === 1 ? '' : 'es'} · {e.predios.length} predio{e.predios.length === 1 ? '' : 's'}
        {e.familia && <> · {e.familia.charAt(0) + e.familia.slice(1).toLowerCase()}</>}
        {e.arboles < 2 && <span className="text-ambar"> · preliminar</span>}
      </p>
    </button>
  )
}

// ═══ Recolección ═════════════════════════════════════════════════════════════

export function VistaRecoleccion({ c, irEspecie }: { c: Contexto; irEspecie: (e: string) => void }) {
  const ultima = c.ultima
  const enUltima = c.ms.filter((m) => m.ronda === ultima)
  const maduros = enUltima.filter((m) => (m.fruto_maduro ?? 0) > 0)
  const enFlor = enUltima.filter((m) => (valor(m, 'flor') ?? 0) > 0)
  const porPredio = [...agrupar(maduros, (m) => m.predio)].sort((a, b) => b[1].length - a[1].length)
  const ventanas = c.especies.filter((e) => e.ventana.length > 0).sort((a, b) => a.ventana[0] - b.ventana[0] || b.arboles - a.arboles)

  return (
    <>
      {ultima && (
        <Seccion n="01" titulo={`Qué hay para recolectar · ${etiquetaRonda(ultima)}`}
          sub={`Árboles con fruto maduro en la última ronda (${enUltima.length} árboles visitados: ${maduros.length} con fruto maduro y ${enFlor.length} en flor). Para planear la salida de cosecha con cada propietario.`}>
          {porPredio.length === 0 ? <Vacio>Ningún árbol con fruto maduro en esa ronda.</Vacio> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {porPredio.map(([predio, l]) => (
                <Tarjeta key={predio}>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <p className="font-medium text-tinta">{predio}</p>
                    <span className="text-[12px] text-suave">{l.length} árbol{l.length === 1 ? '' : 'es'}</span>
                  </div>
                  <ul className="space-y-1 text-[12.5px]">
                    {l.sort((a, b) => (b.fruto_maduro ?? 0) - (a.fruto_maduro ?? 0)).map((m) => (
                      <li key={m.id} className="flex items-baseline gap-2">
                        <span className="w-10 shrink-0 tabular-nums text-suave">{m.codigo}</span>
                        <button onClick={() => irEspecie(especieDe(m))} className="min-w-0 flex-1 truncate text-left hover:underline">
                          <Nombre e={especieDe(m)} />{m.nombre_comun ? <span className="text-suave"> · {m.nombre_comun}</span> : null}
                        </button>
                        <span className="shrink-0 tabular-nums" style={{ color: COLOR.frutoLineal }}>{m.fruto_maduro} %</span>
                      </li>
                    ))}
                  </ul>
                </Tarjeta>
              ))}
            </div>
          )}
        </Seccion>
      )}

      <Seccion n="02" titulo="Ventanas de recolección por especie"
        sub="Meses en que la especie tuvo fruto maduro. Más intenso = más copa en fruto; trama = sin monitoreo. Toca una especie para ver su ficha."
        acciones={<Boton variante="secundario" icono={<FileSpreadsheet size={14} />} onClick={() => bajarCsv([
          ['especie', 'nombres_comunes', 'familia', 'arboles', 'meses_fruto_maduro', 'mes_pico', 'fournier_pico_pct', 'protocolo_corpoamazonia', 'preliminar'],
          ...ventanas.map((e) => [e.especie, e.comunes.join(' / '), e.familia, e.arboles, e.ventana.map((i) => MESES[i]).join(' '),
            e.pico !== null ? MESES[e.pico] : '', e.pico !== null ? Math.round(e.maduro[e.pico]!.media) : '', c.protocolo.get(e.especie) ?? 'no', e.preliminar ? 'sí' : 'no']),
        ], `ventanas_cosecha_${c.nucleo}.csv`)}>CSV</Boton>}>
        {ventanas.length === 0 ? <Vacio>Ninguna especie con fruto maduro en los datos filtrados.</Vacio> : (
          <div className="overflow-x-auto rounded-2xl border border-linea/70 bg-white">
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] uppercase tracking-wide text-suave">
                <tr className="border-b border-linea/70">
                  <th className="px-3 py-2.5 font-medium">Especie</th>
                  <th className="px-3 py-2.5 font-medium">Árboles</th>
                  <th className="px-3 py-2.5 font-medium">Fruto maduro</th>
                  <th className="px-3 py-2.5 font-medium">Pico</th>
                  <th className="px-3 py-2.5 font-medium">Protocolo</th>
                </tr>
              </thead>
              <tbody>
                {ventanas.map((e) => (
                  <tr key={e.especie} onClick={() => irEspecie(e.especie)} className="cursor-pointer border-b border-linea/40 last:border-0 hover:bg-hueso/60">
                    <td className="px-3 py-2"><Nombre e={e.especie} /><span className="block text-[11.5px] text-suave">{e.comunes.join(' · ')}</span></td>
                    <td className="px-3 py-2 tabular-nums">{e.arboles}{e.preliminar && <span className="ml-1.5 text-[10.5px] text-ambar" title="Un solo árbol o un solo año: calendario preliminar">prelim.</span>}</td>
                    <td className="px-3 py-2"><TiraMeses celdas={e.maduro} color={COLOR.frutoLineal} meses={c.mesesMonitoreados.length ? c.mesesMonitoreados : undefined} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.pico !== null ? `${MESES[e.pico]} · ${pct(e.maduro[e.pico]!.media)}` : '—'}</td>
                    <td className="px-3 py-2 text-suave">{c.protocolo.get(e.especie) === 'especie' ? 'Especie' : c.protocolo.get(e.especie) === 'genero' ? 'Género' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>
    </>
  )
}

// ═══ Ficha por especie ═══════════════════════════════════════════════════════

const COLORES_FASE: Record<string, string> = {
  // Hoja en gris: en verde se confundía con el fruto inmaduro.
  hoja: '#b3ada0', boton_floral: '#e9b872', floracion: COLOR.florLineal, aborto_floral: '#c9a6a0',
  fruto_inmaduro: '#7fae8a', fruto_maduro: COLOR.frutoLineal, fruto_postmaduro: '#6b4f2e', aborto_frutal: '#b0a99a', plantulas: '#4f7fa0',
}

export function VistaFicha({ c, especie, setEspecie }: { c: Contexto; especie: string | null; setEspecie: (e: string) => void }) {
  const [intensidad, setIntensidad] = useState(false)
  const [modoClima, setModoClima] = useState<'no' | 'integrado' | 'al-lado'>('integrado')
  const refC = useRef<SVGSVGElement>(null)
  const refL = useRef<SVGSVGElement>(null)
  const refK = useRef<SVGSVGElement>(null)
  const ordenadas = useMemo(() => [...c.especies].sort((a, b) => a.especie.localeCompare(b.especie)), [c.especies])
  const e = c.especies.find((x) => x.especie === especie) ?? ordenadas.find(activa) ?? ordenadas[0]
  const ms = useMemo(() => (e ? c.ms.filter((m) => especieDe(m) === e.especie) : []), [c.ms, e])
  const arbolesBase = useMemo(() => (e ? c.arboles.filter((a) => especieDe(a) === e.especie) : []), [c.arboles, e])
  const climaG = useMemo(() => c.climaDe([...new Set([...arbolesBase.map(claveArbol), ...ms.map(claveArbol)])]), [c, arbolesBase, ms])
  if (!e) return <Vacio>No hay especies con los filtros actuales.</Vacio>

  const rondas = [...new Set(ms.map((m) => m.ronda))].sort()
  const curvas = FENOFASES.map((f) => ({
    nombre: f.n, color: COLORES_FASE[f.k],
    valores: rondas.map((r) => {
      const vs = ms.filter((m) => m.ronda === r).map((m) => m[f.k]).filter((v): v is number => v !== null)
      return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
    }),
  }))
  const codigos = [...new Set([...ms.map((m) => m.codigo), ...arbolesBase.map((a) => a.codigo)])].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  const fito = contar(ms.flatMap((m) => m.estado_fitosanitario ?? []))
  const fauna = contar(ms.flatMap((m) => (m.animales ?? []).map((a) => [a.tipo, a.nombre].filter(Boolean).join(': '))).filter(Boolean))
  const idsMs = new Set(ms.map((m) => m.id))
  const fotos = c.fotos.filter((f) => idsMs.has(f.monitoreo_id))
  const clima = modoClima !== 'no' && climaG ? climaG.meses : null
  const pie = `Monitoreo fenológico RAS – ${c.nucleo}: ${e.arboles} árbol(es), ${e.rondas} ronda(s) (${rondas.map(etiquetaRonda).join(', ')}).${e.preliminar ? ' Calendario preliminar.' : ''}${clima ? pieClima(c, climaG) : ''}`
  const nombreArchivo = e.especie.replace(/[^\p{L}\p{N}]+/gu, '_')
  const meses = c.mesesMonitoreados.length ? c.mesesMonitoreados : undefined

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select value={e.especie} onChange={(ev) => setEspecie(ev.target.value)}
          className="min-w-[18rem] max-w-full rounded-xl border border-linea bg-white px-3 py-2 text-[14px]">
          {[['Con flor o fruto', ordenadas.filter(activa)], ['Sin actividad todavía', ordenadas.filter((x) => !activa(x))]].map(([t, l]) => (
            (l as ResumenEspecie[]).length > 0 && (
              <optgroup key={t as string} label={t as string}>
                {(l as ResumenEspecie[]).map((x) => <option key={x.especie} value={x.especie}>{x.especie}{x.comunes.length ? ` — ${x.comunes.join(', ')}` : ''} ({x.arboles})</option>)}
              </optgroup>
            )
          ))}
        </select>
        <Casilla v={intensidad} set={setIntensidad}>Intensidad</Casilla>
        <label className="inline-flex items-center gap-2 text-[13px] text-tinta">
          Clima
          <select value={climaG ? modoClima : 'no'} onChange={(ev) => setModoClima(ev.target.value as typeof modoClima)} disabled={!climaG}
            className="rounded-lg border border-linea bg-white px-2 py-1 disabled:opacity-50">
            <option value="no">Sin clima</option>
            <option value="integrado">En el círculo</option>
            <option value="al-lado">Climograma al lado</option>
          </select>
        </label>
        {!climaG && <span className="text-[12px] text-suave">{c.climaError ? 'El clima no cargó.' : c.clima ? 'Sin coordenadas para estos árboles.' : 'Cargando el clima…'}</span>}
      </div>

      <Seccion n="01" titulo={<Nombre e={e.especie} />}
        sub={`${e.comunes.join(' · ') || 'Sin nombre común'}${e.familia ? ` · ${e.familia}` : ''} · ${e.arboles} árbol(es) en ${e.predios.length} predio(s) · ${e.monitoreos} monitoreos`}
        acciones={<Boton variante="secundario" icono={<Download size={14} />} onClick={() => descargarPng(refC.current, `calendario_circular_${nombreArchivo}`, 8.5)}>PNG</Boton>}>
        <div className={`grid gap-4 ${modoClima === 'al-lado' && clima ? 'lg:grid-cols-[1.1fr_1fr]' : 'lg:grid-cols-[1.25fr_1fr]'}`}>
          <Tarjeta className="p-2 sm:p-3">
            <CalendarioCircular svgRef={refC} e={e} intensidad={intensidad} clima={modoClima === 'integrado' ? clima : null} pie={pie} />
          </Tarjeta>
          <div className="space-y-4">
            {modoClima === 'al-lado' && clima && (
              <Tarjeta className="p-2 sm:p-3">
                <Climograma svgRef={refK} meses={clima} lluviosos={mesesLluviosos(clima).meses} titulo="Clima donde están sus árboles" />
              </Tarjeta>
            )}
            <Tarjeta>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <Dato t="En la última ronda" v={ESTADOS.find((s) => s.k === c.estado.get(e.especie))?.n ?? '—'} />
                <Dato t="Ventana de fruto maduro" v={e.ventana.length ? e.ventana.map((i) => MESES[i]).join(', ') : 'No se observó'} />
                <Dato t="Mes pico" v={e.pico !== null ? `${MESES[e.pico]} (${pct(e.maduro[e.pico]!.media)})` : '—'} />
                <Dato t="Representatividad" v={e.preliminar ? 'Preliminar' : 'Suficiente'} ayuda="Preliminar = un solo árbol o un solo año" />
                <Dato t="Sincronía floración" v={e.sincroniaFlor !== null ? fmt(e.sincroniaFlor, 2) : '—'} ayuda="Augspurger: 1 = todos los árboles a la vez; necesita ≥ 2 en fase" />
                <Dato t="Sincronía fructificación" v={e.sincroniaFruto !== null ? fmt(e.sincroniaFruto, 2) : '—'} />
                {climaG && <Dato t="Lluvia anual (normal)" v={`${fmt(climaG.meses.reduce((s, m) => s + (m.precip_mm ?? 0), 0))} mm`} ayuda="Open-Meteo, promedio 2016–2025 en las celdas de sus árboles" />}
                <Dato t="Años de monitoreo" v={e.anios.join(', ')} />
              </dl>
            </Tarjeta>
            {(fito.length > 0 || fauna.length > 0) && (
              <Tarjeta>
                {fito.length > 0 && <><p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-suave">Estado fitosanitario</p>
                  <p className="mb-3 text-[13px]">{fito.map(([k, n]) => `${k} (${n})`).join(' · ')}</p></>}
                {fauna.length > 0 && <><p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-suave">Fauna vista en el árbol</p>
                  <p className="text-[13px]">{fauna.map(([k, n]) => `${k} (${n})`).join(' · ')}</p></>}
              </Tarjeta>
            )}
          </div>
        </div>
      </Seccion>

      <Seccion n="02" titulo="Las nueve fenofases por ronda" sub={ESCALA_COPA}
        acciones={<Boton variante="secundario" icono={<Download size={14} />} onClick={() => descargarPng(refL.current, `fenofases_${nombreArchivo}`, 10)}>PNG</Boton>}>
        <Tarjeta className="p-2 sm:p-3"><CurvasRonda svgRef={refL} rondas={rondas} series={curvas} /></Tarjeta>
      </Seccion>

      <Seccion n="03" titulo="Árboles" sub="Cada árbol con su floración y su fruto maduro mes a mes.">
        <div className="overflow-x-auto rounded-2xl border border-linea/70 bg-white">
          <table className="w-full text-[12.5px]">
            <thead className="text-left text-[11px] uppercase tracking-wide text-suave">
              <tr className="border-b border-linea/70">
                <th className="px-3 py-2.5 font-medium">Placa</th><th className="px-3 py-2.5 font-medium">Predio</th>
                <th className="px-3 py-2.5 font-medium">DAP · altura</th><th className="px-3 py-2.5 font-medium">Floración</th>
                <th className="px-3 py-2.5 font-medium">Fruto maduro</th><th className="px-3 py-2.5 font-medium">Última ronda</th>
              </tr>
            </thead>
            <tbody>
              {codigos.map((cod) => {
                const l = ms.filter((m) => m.codigo === cod)
                const a = arbolesBase.find((x) => x.codigo === cod)
                const u = [...l].sort((x, y) => y.ronda.localeCompare(x.ronda))[0]
                return (
                  <tr key={cod} className="border-b border-linea/40 last:border-0">
                    <td className="px-3 py-2 tabular-nums">{cod}</td>
                    <td className="px-3 py-2">{a?.predio ?? u?.predio}{a?.vereda && <span className="text-suave"> · {a.vereda}</span>}</td>
                    <td className="px-3 py-2 tabular-nums text-suave">{a?.dap_cm ? `${fmt(a.dap_cm, 1)} cm` : '—'}{a?.altura_m ? ` · ${fmt(a.altura_m)} m` : ''}</td>
                    <td className="px-3 py-2">{l.length ? <TiraMeses celdas={celdasMes(l, 'flor')} color={COLOR.florLineal} meses={meses} /> : '—'}</td>
                    <td className="px-3 py-2">{l.length ? <TiraMeses celdas={celdasMes(l, 'fruto_maduro')} color={COLOR.frutoLineal} meses={meses} /> : '—'}</td>
                    <td className="px-3 py-2 text-suave">{u ? `${etiquetaRonda(u.ronda)}${u.observaciones ? ` · ${u.observaciones}` : ''}` : 'Sin monitoreo'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Seccion>

      {fotos.length > 0 && (
        <Seccion n="04" titulo="Fotos de flor y fruto" sub="Las que se tomaron en el monitoreo con la app.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {fotos.slice(0, 24).map((f) => <FotoMonitoreo key={f.id} f={f} m={ms.find((m) => m.id === f.monitoreo_id)} />)}
          </div>
        </Seccion>
      )}
    </>
  )
}

function Dato({ t, v, ayuda }: { t: string; v: ReactNode; ayuda?: string }) {
  return (
    <div title={ayuda}>
      <dt className="text-[11px] uppercase tracking-wide text-suave">{t}</dt>
      <dd className="mt-0.5 text-tinta">{v}</dd>
    </div>
  )
}

function contar(xs: string[]): [string, number][] {
  const m = new Map<string, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
}

function FotoMonitoreo({ f, m }: { f: Foto; m?: Monitoreo }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    let u: string | null = null
    fetchConSesion(`/api/ras/fenologia/foto/${f.id}`).then((r) => (r.ok ? r.blob() : null)).then((b) => {
      if (b && vivo) { u = URL.createObjectURL(b); setUrl(u) }
    })
    return () => { vivo = false; if (u) URL.revokeObjectURL(u) }
  }, [f.id])
  return (
    <figure className="overflow-hidden rounded-xl border border-linea/70 bg-white">
      <div className="grid aspect-square place-items-center bg-hueso/60">
        {url ? <img src={url} alt={`${f.organo} del árbol ${m?.codigo ?? ''}`} className="h-full w-full object-cover" /> : <Camera size={20} className="text-tenue" />}
      </div>
      <figcaption className="px-2 py-1.5 text-[11px] text-suave">{f.organo === 'flor' ? 'Flor' : 'Fruto'} · {m?.codigo} · {m ? etiquetaRonda(m.ronda) : ''}{f.borrosa ? ' · borrosa' : ''}</figcaption>
    </figure>
  )
}

// ═══ Predios ═════════════════════════════════════════════════════════════════

export function VistaPredios({ c, irEspecie }: { c: Contexto; irEspecie: (e: string) => void }) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const ultima = c.ultima
  const predios = useMemo(() => {
    const nombres = new Set([...c.arboles.map((a) => a.predio), ...c.ms.map((m) => m.predio)])
    return [...nombres].map((p) => {
      const base = c.arboles.filter((a) => a.predio === p)
      const ms = c.ms.filter((m) => m.predio === p)
      const u = ms.filter((m) => m.ronda === ultima)
      const g = c.climaDe(base.map(claveArbol))
      return {
        predio: p,
        vereda: base.find((a) => a.vereda)?.vereda ?? null,
        base: base.length,
        monitoreados: new Set(ms.map((m) => m.codigo)).size,
        especies: new Set([...base.map(especieDe), ...ms.map(especieDe)]).size,
        porRonda: c.rondas.map((r) => new Set(ms.filter((m) => m.ronda === r).map((m) => m.codigo)).size),
        flor: u.filter((m) => (valor(m, 'flor') ?? 0) > 0).length,
        maduro: u.filter((m) => (m.fruto_maduro ?? 0) > 0).length,
        lluvia: g ? g.meses.reduce((s, m) => s + (m.precip_mm ?? 0), 0) : null,
        monitores: [...new Set(ms.map((m) => m.monitor).filter(Boolean))] as string[],
        ms, base_: base,
      }
    }).sort((a, b) => (a.vereda ?? '').localeCompare(b.vereda ?? '') || a.predio.localeCompare(b.predio))
  }, [c, ultima])

  return (
    <Seccion n="01" titulo="Predios"
      sub={`Árboles de cada predio, cuántos se visitaron en cada ronda y qué estaba en flor o en fruto maduro en ${ultima ? etiquetaRonda(ultima) : 'la última ronda'}. Toca un predio para ver sus árboles.`}
      acciones={<Boton variante="secundario" icono={<FileSpreadsheet size={14} />} onClick={() => bajarCsv([
        ['predio', 'vereda', 'arboles_base', 'arboles_monitoreados', 'especies', ...c.rondas.map((r) => `visitados_${r}`), 'en_flor_ultima', 'fruto_maduro_ultima', 'lluvia_anual_mm', 'quien_monitorea'],
        ...predios.map((p) => [p.predio, p.vereda, p.base, p.monitoreados, p.especies, ...p.porRonda, p.flor, p.maduro, p.lluvia === null ? '' : Math.round(p.lluvia), p.monitores.join(' / ')]),
      ], `predios_fenologia_${c.nucleo}.csv`)}>CSV</Boton>}>
      <div className="overflow-x-auto rounded-2xl border border-linea/70 bg-white">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-[11px] uppercase tracking-wide text-suave">
            <tr className="border-b border-linea/70">
              <th className="px-3 py-2.5 font-medium">Predio</th>
              <th className="px-3 py-2.5 font-medium">Árboles</th>
              <th className="px-3 py-2.5 font-medium">Especies</th>
              {c.rondas.map((r) => <th key={r} className="px-2 py-2.5 text-center font-medium">{etiquetaRonda(r).replace(' 20', ' ')}</th>)}
              <th className="px-3 py-2.5 font-medium">En flor</th>
              <th className="px-3 py-2.5 font-medium">Fruto maduro</th>
              <th className="px-3 py-2.5 font-medium" title="Open-Meteo, promedio 2016–2025">Lluvia anual</th>
            </tr>
          </thead>
          <tbody>
            {predios.map((p) => {
              const total = p.base || p.monitoreados
              return [
                <tr key={p.predio} onClick={() => setAbierto(abierto === p.predio ? null : p.predio)} className="cursor-pointer border-b border-linea/40 hover:bg-hueso/60">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">{abierto === p.predio ? <ChevronDown size={13} /> : <ChevronRight size={13} />}<b className="font-medium">{p.predio}</b></span>
                    {p.vereda && <span className="block pl-5 text-[11.5px] text-suave">{p.vereda}</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{p.base || '—'}<span className="text-suave"> · {p.monitoreados} monit.</span></td>
                  <td className="px-3 py-2 tabular-nums">{p.especies}</td>
                  {p.porRonda.map((n, i) => {
                    const completo = total > 0 && n >= total
                    return (
                      <td key={i} className="px-2 py-2 text-center tabular-nums">
                        <span className={`inline-block min-w-[2.6rem] rounded-full px-1.5 py-0.5 text-[11.5px] ${n === 0 ? 'bg-red-50 text-red-700' : completo ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                          {n}/{total}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 tabular-nums" style={{ color: COLOR.florLineal }}>{p.flor || '—'}</td>
                  <td className="px-3 py-2 tabular-nums" style={{ color: COLOR.frutoLineal }}>{p.maduro || '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-suave">{p.lluvia === null ? '—' : `${fmt(p.lluvia)} mm`}</td>
                </tr>,
                abierto === p.predio && (
                  <tr key={`${p.predio}-detalle`} className="border-b border-linea/40 bg-hueso/40">
                    <td colSpan={6 + c.rondas.length} className="px-4 py-3">
                      {p.monitores.length > 0 && <p className="mb-2 text-[12px] text-suave">Monitorea: {p.monitores.join(', ')}</p>}
                      <ArbolesPredio p={p} meses={c.mesesMonitoreados} irEspecie={irEspecie} />
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </div>
    </Seccion>
  )
}

function ArbolesPredio({ p, meses, irEspecie }: { p: { ms: Monitoreo[]; base_: Arbol[] }; meses: number[]; irEspecie: (e: string) => void }) {
  const codigos = [...new Set([...p.base_.map((a) => a.codigo), ...p.ms.map((m) => m.codigo)])].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  const m_ = meses.length ? meses : undefined
  return (
    <div className="grid gap-x-8 gap-y-1.5 xl:grid-cols-2">
      {codigos.map((cod) => {
        const l = p.ms.filter((m) => m.codigo === cod)
        const a = p.base_.find((x) => x.codigo === cod)
        const esp = a ? especieDe(a) : l[0] ? especieDe(l[0]) : '—'
        return (
          <div key={cod} className="flex items-center gap-2 text-[12px]">
            <span className="w-9 shrink-0 tabular-nums text-suave">{cod}</span>
            <button onClick={() => irEspecie(esp)} className="min-w-0 flex-1 truncate text-left hover:underline">
              <Nombre e={esp} />{a?.nombre_comun ? <span className="text-suave"> · {a.nombre_comun}</span> : null}
            </button>
            {l.length ? <>
              <span title="Floración"><TiraMeses celdas={celdasMes(l, 'flor')} color={COLOR.florLineal} meses={m_} /></span>
              <span title="Fruto maduro"><TiraMeses celdas={celdasMes(l, 'fruto_maduro')} color={COLOR.frutoLineal} meses={m_} /></span>
            </> : <span className="text-tenue">sin monitoreo</span>}
          </div>
        )
      })}
      <p className="text-[11px] text-suave xl:col-span-2">Primera tira: floración; segunda: fruto maduro.</p>
    </div>
  )
}

// ═══ Clima ═══════════════════════════════════════════════════════════════════

type Variable = 'anual' | 'seco' | 'humedo' | 'temp'
const VARIABLES: { k: Variable; n: string; unidad: string }[] = [
  { k: 'anual', n: 'Lluvia anual', unidad: 'mm' },
  { k: 'seco', n: 'Lluvia del mes más seco', unidad: 'mm' },
  { k: 'humedo', n: 'Lluvia del mes más lluvioso', unidad: 'mm' },
  { k: 'temp', n: 'Temperatura media', unidad: '°C' },
]

function valorCelda(celda: CeldaClima, v: Variable): number | null {
  const ps = celda.normal.map((m) => m.precip_mm).filter((x): x is number => x !== null)
  const ts = celda.normal.map((m) => m.temp_c).filter((x): x is number => x !== null)
  if (v === 'temp') return ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length : null
  if (!ps.length) return null
  return v === 'anual' ? ps.reduce((a, b) => a + b, 0) : v === 'seco' ? Math.min(...ps) : Math.max(...ps)
}

function mezclar(a: string, b: string, t: number) {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  return `#${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, '0')).join('')}`
}

const coord = (lat: number, lon: number) => `${fmt(Math.abs(lat), 3)}° ${lat >= 0 ? 'N' : 'S'} · ${fmt(Math.abs(lon), 3)}° ${lon < 0 ? 'O' : 'E'}`

export function VistaClima({ c }: { c: Contexto }) {
  const [variable, setVariable] = useState<Variable>('anual')
  const refR = useRef<SVGSVGElement>(null)
  const refG = useRef<SVGSVGElement>(null)
  const claves = useMemo(() => [...new Set([...c.arboles.map(claveArbol), ...c.ms.map(claveArbol)])], [c.arboles, c.ms])
  const general = useMemo(() => c.climaDe(claves), [c, claves])
  const reciente = useMemo(() => lluviaRecientePonderada(c.indiceClima, claves), [c.indiceClima, claves])

  if (c.climaError) return <Aviso tono="arcilla" titulo="No se pudo traer el clima">{c.climaError}</Aviso>
  if (!c.clima) return <Vacio>Trayendo el clima de Open-Meteo para cada árbol…</Vacio>
  if (!general) return <Vacio>Los árboles filtrados no tienen coordenadas.</Vacio>

  const aprox = new Set(c.clima.aproximados)
  const celdas = [...general.celdas].sort((x, y) => y.arboles.length - x.arboles.length)
  const vs = celdas.map((x) => valorCelda(x, variable)).filter((x): x is number => x !== null)
  const min = Math.min(...vs), max = Math.max(...vs)
  const def = VARIABLES.find((x) => x.k === variable)!
  const color = (v: number | null) => {
    if (v === null) return '#cccccc'
    const t = max > min ? (v - min) / (max - min) : 0.5
    return variable === 'temp' ? mezclar('#fde0c5', '#b03a2e', t) : mezclar('#fff3b0', '#0b3c6b', t)
  }
  const texto = (v: number | null) => (v === null ? '—' : `${fmt(v, variable === 'temp' ? 1 : 0)} ${def.unidad}`)

  const arbolPorClave = new Map(c.arboles.map((a) => [claveArbol(a), a]))
  const puntos: PuntoMapa[] = []
  for (const k of claves) {
    const celda = c.indiceClima.get(k)
    const a = arbolPorClave.get(k)
    if (!celda || !a) continue
    let lat = a.latitud, lon = a.longitud
    if (lat === null || lon === null) {
      const vecinos = c.arboles.filter((x) => x.predio === a.predio && x.latitud !== null && x.longitud !== null)
      if (!vecinos.length) continue
      lat = vecinos.reduce((s, x) => s + Number(x.latitud), 0) / vecinos.length
      lon = vecinos.reduce((s, x) => s + Number(x.longitud), 0) / vecinos.length
    }
    const v = valorCelda(celda, variable)
    puntos.push({
      id: k, lat: Number(lat), lon: Number(lon), color: color(v), aproximado: aprox.has(k),
      texto: `<b>${a.codigo}</b> · <i>${especieDe(a)}</i><br>${a.predio}<br>${def.n}: ${texto(v)}${aprox.has(k) ? '<br><span style="color:#a0522d">Sin coordenada: centro del predio</span>' : ''}`,
    })
  }
  const prediosDe = (celda: CeldaClima) => [...new Set(celda.arboles.map((k) => arbolPorClave.get(k)?.predio).filter(Boolean))] as string[]
  const marcas: CeldaMapa[] = celdas.map((x) => ({
    id: x.id, lat: x.lat, lon: x.lon, etiqueta: texto(valorCelda(x, variable)),
    detalle: `Celda ${coord(x.lat, x.lon)} · ${x.arboles.length} árboles · ${prediosDe(x).join(', ')}`,
  }))

  const rondas = c.rondas
  const porRonda = agrupar(c.ms, (m) => m.ronda)
  const pctArboles = (l: Monitoreo[], s: Serie) => {
    const xs = l.map((m) => valor(m, s)).filter((x): x is number => x !== null)
    return xs.length ? (100 * xs.filter((x) => x > 0).length) / xs.length : null
  }
  const reales = rondas.map((r) => reciente.get(r)?.precip_mm ?? null)
  const incompletas = rondas.filter((r) => reciente.get(r) && !reciente.get(r)!.completo)
  const pieBase = `Clima: Open-Meteo, Historical Weather API (reanálisis ERA5 / ECMWF IFS, CC BY 4.0).`

  return (
    <>
      <Seccion n="01" titulo="Mapa del clima por árbol"
        sub={`Cada punto es un árbol, con el color del clima de su celda (promedio ${c.clima.periodo}). Las etiquetas blancas son el centro de cada celda de ~7 km del reanálisis: los árboles de una misma celda comparten clima, así que el mapa distingue zonas, no árboles vecinos.`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {VARIABLES.map((x) => (
            <button key={x.k} onClick={() => setVariable(x.k)}
              className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${variable === x.k ? 'bg-bosque text-hueso' : 'border border-linea/80 bg-white text-suave hover:text-tinta'}`}>
              {x.n}
            </button>
          ))}
        </div>
        <MapaClima puntos={puntos} celdas={marcas} />
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-suave">
          <span className="inline-flex items-center gap-2">
            {texto(min)}
            <span className="h-2.5 w-40 rounded-full" style={{ background: `linear-gradient(90deg, ${color(min)}, ${color(max)})` }} />
            {texto(max)}
          </span>
          {aprox.size > 0 && <span>Borde marrón punteado: árbol sin coordenada, ubicado en el centro de su predio ({[...aprox].map((k) => k.split('|')[1]).join(', ')}).</span>}
        </div>
      </Seccion>

      <Seccion n="02" titulo="Celdas de clima"
        sub="Lo que dice Open-Meteo en cada celda donde hay árboles. El climograma de cada especie y de cada gráfico es el promedio de las celdas de sus árboles, pesado por cuántos árboles caen en cada una."
        acciones={<Boton variante="secundario" icono={<FileSpreadsheet size={14} />} onClick={() => bajarCsv([
          ['codigo', 'predio', 'especie', 'celda_lat', 'celda_lon', 'coordenada_aproximada', ...MESES_LARGOS.map((m) => `lluvia_${m}_mm`), ...MESES_LARGOS.map((m) => `temp_${m}_c`)],
          ...claves.flatMap((k) => {
            const celda = c.indiceClima.get(k), a = arbolPorClave.get(k)
            if (!celda || !a) return []
            return [[a.codigo, a.predio, especieDe(a), celda.lat, celda.lon, aprox.has(k) ? 'sí' : 'no', ...celda.normal.map((m) => m.precip_mm), ...celda.normal.map((m) => m.temp_c)]]
          }),
        ], `clima_por_arbol_${c.nucleo}.csv`)}>CSV por árbol</Boton>}>
        <div className="overflow-x-auto rounded-2xl border border-linea/70 bg-white">
          <table className="w-full text-[12.5px]">
            <thead className="text-left text-[11px] uppercase tracking-wide text-suave">
              <tr className="border-b border-linea/70">
                <th className="px-3 py-2.5 font-medium">Celda</th><th className="px-3 py-2.5 font-medium">Árboles</th>
                <th className="px-3 py-2.5 font-medium">Predios</th><th className="px-3 py-2.5 font-medium">Lluvia anual</th>
                <th className="px-3 py-2.5 font-medium whitespace-nowrap">Mes más seco</th><th className="px-3 py-2.5 font-medium">Más lluvioso</th>
                <th className="px-3 py-2.5 font-medium">Temp. media</th><th className="px-3 py-2.5 font-medium">Ene → Dic</th>
              </tr>
            </thead>
            <tbody>
              {celdas.map((x) => {
                const ps = x.normal.map((m) => m.precip_mm ?? 0)
                const iSeco = ps.indexOf(Math.min(...ps)), iHum = ps.indexOf(Math.max(...ps))
                const pmax = Math.max(...ps)
                const enFiltro = x.arboles.filter((k) => claves.includes(k)).length
                return (
                  <tr key={x.id} className="border-b border-linea/40 last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{coord(x.lat, x.lon)}{x.elevacion !== null && <span className="block text-[11px] text-suave">{fmt(x.elevacion)} m s. n. m.</span>}</td>
                    <td className="px-3 py-2 tabular-nums">{enFiltro}</td>
                    <td className="px-3 py-2 text-suave">{prediosDe(x).join(', ')}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fmt(valorCelda(x, 'anual') ?? 0)} mm</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{MESES[iSeco]} · {fmt(ps[iSeco])} mm</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{MESES[iHum]} · {fmt(ps[iHum])} mm</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fmt(valorCelda(x, 'temp') ?? 0, 1)} °C</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex h-6 items-end gap-[2px]">
                        {ps.map((p, i) => <span key={i} title={`${MESES[i]}: ${fmt(p)} mm`} className="w-2 rounded-t-[2px]" style={{ height: `${Math.max(8, (100 * p) / pmax)}%`, background: COLOR.lluvia }} />)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Tarjeta className="p-2 sm:p-3">
            <div className="mb-1 flex justify-end"><Boton variante="fantasma" icono={<Download size={14} />} onClick={() => descargarPng(refG.current, `climograma_${c.nucleo}`, 8)}>PNG</Boton></div>
            <Climograma svgRef={refG} meses={general.meses} lluviosos={mesesLluviosos(general.meses).meses}
              titulo={`${c.nucleo} · promedio de ${general.arboles} árboles (${c.clima.periodo})`} />
          </Tarjeta>
          <Tarjeta>
            <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-suave">Cómo leer este clima</p>
            <ul className="list-disc space-y-1.5 pl-4 text-[13px] text-tinta">
              <li>En Solano llueve todo el año: ningún mes baja de unos 150 mm. «Mes lluvioso» (la franja azul) quiere decir más lluvioso que la mitad del año, no lo contrario de un mes seco.</li>
              <li>La temperatura cambia menos de 1 °C en el año. Pesa poco en la fenología; la lluvia, más.</li>
              <li>Es reanálisis (modelo + observaciones), no una estación. Sirve para comparar zonas y meses; para un valor exacto de un punto hace falta estación IDEAM.</li>
              <li>{pieBase} Promedio {c.clima.periodo}. La lluvia de cada ronda es la del mes calendario.</li>
            </ul>
          </Tarjeta>
        </div>
      </Seccion>

      <Seccion n="03" titulo="¿Llovió más o menos de lo normal en cada ronda?"
        sub="La lluvia que cayó en el mes de cada ronda frente a la normal de ese mes, con el % de árboles visitados que estaban en flor o con fruto. Que coincidan no prueba que la lluvia cause la fase."
        acciones={<Boton variante="secundario" icono={<Download size={14} />} onClick={() => descargarPng(refR.current, `lluvia_por_ronda_${c.nucleo}`, 10)}>PNG</Boton>}>
        <Tarjeta className="p-2 sm:p-3">
          <LluviaRondas svgRef={refR} rondas={rondas} real={reales}
            normal={rondas.map((r) => general.meses[Number(r.slice(5, 7)) - 1]?.precip_mm ?? null)}
            flor={rondas.map((r) => pctArboles(porRonda.get(r) ?? [], 'flor'))}
            fruto={rondas.map((r) => pctArboles(porRonda.get(r) ?? [], 'fruto'))}
            pie={`${c.pie} ${pieBase} Normal ${c.clima.periodo}; ponderado por árbol.`} />
        </Tarjeta>
        {incompletas.length > 0 && <p className="mt-2 text-[12px] text-suave">El mes de {incompletas.map(etiquetaRonda).join(', ')} todavía no está completo en Open-Meteo (llega con unos días de atraso).</p>}
      </Seccion>
    </>
  )
}

// ═══ Índices ═════════════════════════════════════════════════════════════════

export function VistaIndices({ c }: { c: Contexto }) {
  const refF = useRef<SVGSVGElement>(null)
  const refA = useRef<SVGSVGElement>(null)
  const porRonda = useMemo(() => agrupar(c.ms, (m) => m.ronda), [c.ms])
  const media = (l: Monitoreo[], s: Serie) => {
    const vs = l.map((m) => valor(m, s)).filter((v): v is number => v !== null)
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
  }
  const activos = (l: Monitoreo[], s: Serie) => {
    const vs = l.map((m) => valor(m, s)).filter((v): v is number => v !== null)
    return vs.length ? (100 * vs.filter((v) => v > 0).length) / vs.length : null
  }
  const fournier = FENOFASES.map((f) => ({ nombre: f.n, color: COLORES_FASE[f.k], valores: c.rondas.map((r) => media(porRonda.get(r) ?? [], f.k)) }))
  const actividad = ([['flor', COLOR.florLineal], ['fruto', '#7fae8a'], ['fruto_maduro', COLOR.frutoLineal], ['plantulas', '#4f7fa0']] as [Serie, string][])
    .map(([s, color]) => ({ nombre: `${NOMBRE_SERIE[s]} (% árboles)`, color, valores: c.rondas.map((r) => activos(porRonda.get(r) ?? [], s)) }))

  const sanos = c.rondas.map((r) => {
    const l = porRonda.get(r) ?? []
    const con = l.filter((m) => (m.estado_fitosanitario ?? []).length > 0)
    return { r, n: l.length, sano: con.length ? (100 * con.filter((m) => m.estado_fitosanitario!.includes('Sano')).length) / con.length : null }
  })
  const problemas = contar(c.ms.flatMap((m) => (m.estado_fitosanitario ?? []).filter((x) => x !== 'Sano')))
  const conFauna = c.ms.filter((m) => (m.animales ?? []).length > 0)
  const fauna = contar(conFauna.flatMap((m) => (m.animales ?? []).map((a) => [a.tipo, a.nombre].filter(Boolean).join(': '))))

  const fuera = c.ms.filter((m) => !m.en_base)
  const desfase = c.ms.filter((m) => m.fecha && Number(m.fecha.slice(5, 7)) !== mesDe(m)).length
  const monitoreados = new Set(c.ms.map((m) => m.codigo))
  const sinNunca = c.arboles.filter((a) => !monitoreados.has(a.codigo))
  const ultima = c.ultima
  const enUltima = new Set(c.ms.filter((m) => m.ronda === ultima).map((m) => m.codigo))
  const faltanUltima = c.arboles.filter((a) => !enUltima.has(a.codigo))
  const sinCoord = c.arboles.filter((a) => a.latitud === null || a.longitud === null)
  const tablaSinc = c.especies.filter((e) => e.arboles >= 2 && activa(e)).sort((a, b) => b.arboles - a.arboles)

  return (
    <>
      <Seccion n="01" titulo="Índice de Fournier por ronda" sub={`${ESCALA_COPA} Todas las especies juntas, con los filtros de arriba.`}
        acciones={<>
          <Boton variante="secundario" icono={<Download size={14} />} onClick={() => descargarPng(refF.current, `fournier_por_ronda_${c.nucleo}`, 10)}>PNG</Boton>
          <Boton variante="secundario" icono={<FileSpreadsheet size={14} />} onClick={() => bajarCsv([
            ['ronda', 'monitoreos', ...FENOFASES.map((f) => `fournier_${f.k}`), ...FENOFASES.map((f) => `pct_arboles_${f.k}`)],
            ...c.rondas.map((r) => { const l = porRonda.get(r) ?? []; return [r, l.length, ...FENOFASES.map((f) => { const v = media(l, f.k); return v === null ? '' : +v.toFixed(1) }), ...FENOFASES.map((f) => { const v = activos(l, f.k); return v === null ? '' : +v.toFixed(1) })] }),
          ], `indices_por_ronda_${c.nucleo}.csv`)}>CSV</Boton>
        </>}>
        <Tarjeta className="p-2 sm:p-3"><CurvasRonda svgRef={refF} rondas={c.rondas} series={fournier} alto={280} /></Tarjeta>
      </Seccion>

      <Seccion n="02" titulo="Actividad: % de árboles en fase" sub="Qué parte de los árboles visitados tenía la fase, sin importar cuánta copa. Complementa al de Fournier, que mide intensidad."
        acciones={<Boton variante="secundario" icono={<Download size={14} />} onClick={() => descargarPng(refA.current, `actividad_por_ronda_${c.nucleo}`, 10)}>PNG</Boton>}>
        <Tarjeta className="p-2 sm:p-3"><CurvasRonda svgRef={refA} rondas={c.rondas} series={actividad} /></Tarjeta>
      </Seccion>

      <Seccion n="03" titulo="Sincronía por especie" sub="Índice de Augspurger: de 0 (los árboles de la especie nunca coinciden en la fase) a 1 (todos a la vez). Solo especies con dos árboles o más y alguna flor o fruto; con pocos árboles o rondas el valor es inestable.">
        {tablaSinc.length === 0 ? <Vacio>Ninguna especie cumple con estos filtros.</Vacio> : (
          <div className="overflow-x-auto rounded-2xl border border-linea/70 bg-white">
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] uppercase tracking-wide text-suave">
                <tr className="border-b border-linea/70">
                  <th className="px-3 py-2.5 font-medium">Especie</th><th className="px-3 py-2.5 font-medium">Árboles</th>
                  <th className="px-3 py-2.5 font-medium">Sincronía flor</th><th className="px-3 py-2.5 font-medium">Sincronía fruto</th>
                  <th className="px-3 py-2.5 font-medium">Meses con flor</th><th className="px-3 py-2.5 font-medium">Meses con fruto</th>
                </tr>
              </thead>
              <tbody>
                {tablaSinc.map((e) => (
                  <tr key={e.especie} className="border-b border-linea/40 last:border-0">
                    <td className="px-3 py-2"><Nombre e={e.especie} /></td>
                    <td className="px-3 py-2 tabular-nums">{e.arboles}</td>
                    <td className="px-3 py-2 tabular-nums">{e.sincroniaFlor !== null ? fmt(e.sincroniaFlor, 2) : '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{e.sincroniaFruto !== null ? fmt(e.sincroniaFruto, 2) : '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{e.flor.filter((x) => x && x.media > 0).length}</td>
                    <td className="px-3 py-2 tabular-nums">{e.fruto.filter((x) => x && x.media > 0).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Seccion n="04" titulo="Sanidad y fauna">
        <div className="grid gap-4 md:grid-cols-2">
          <Tarjeta>
            <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-suave">% de árboles sanos por ronda</p>
            <ul className="space-y-1.5 text-[13px]">
              {sanos.map((s) => (
                <li key={s.r} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-suave">{etiquetaRonda(s.r)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-hueso"><span className="block h-full rounded-full bg-bosque" style={{ width: `${s.sano ?? 0}%` }} /></span>
                  <span className="w-14 text-right tabular-nums">{s.sano === null ? '—' : pct(s.sano)}</span>
                </li>
              ))}
            </ul>
            {problemas.length > 0 && <p className="mt-3 text-[12.5px] text-suave">Problemas registrados: {problemas.map(([k, n]) => `${k} (${n})`).join(' · ')}</p>}
          </Tarjeta>
          <Tarjeta>
            <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-suave">Fauna en los árboles</p>
            {fauna.length === 0 ? <p className="text-[13px] text-suave">Sin registros de fauna con estos filtros. La pregunta llegó con la app (los monitoreos de Kobo no la traen).</p> : (
              <p className="text-[13px]">{conFauna.length} monitoreos con fauna: {fauna.map(([k, n]) => `${k} (${n})`).join(' · ')}</p>
            )}
          </Tarjeta>
        </div>
      </Seccion>

      <Seccion n="05" titulo="Calidad de los datos" sub="Lo que conviene revisar antes de llevar un calendario al informe.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Indicador n={fuera.length} t="monitoreos de árboles fuera de la base" d={fuera.length ? `Placas: ${[...new Set(fuera.map((m) => m.codigo))].slice(0, 12).join(', ')}` : 'Todos los códigos existen en la base.'} />
          <Indicador n={desfase} t="monitoreos con fecha en otro mes que la ronda" d="Normal al cerrar una ronda los primeros días del mes siguiente. Todo se cuenta por ronda." />
          <Indicador n={faltanUltima.length} t={`árboles de la base sin visita en ${ultima ? etiquetaRonda(ultima) : 'la última ronda'}`} d={faltanUltima.slice(0, 14).map((a) => a.codigo).join(', ')} />
          <Indicador n={sinNunca.length} t="árboles de la base nunca monitoreados" d={sinNunca.slice(0, 14).map((a) => a.codigo).join(', ') || '—'} />
          <Indicador n={sinCoord.length} t="árboles sin coordenada" d={sinCoord.length ? `${sinCoord.map((a) => a.codigo).join(', ')}. Para el clima se usa el centro de su predio.` : '—'} />
          <Indicador n={c.especies.filter((e) => e.preliminar).length} t="especies con calendario preliminar" d="Un solo árbol o un solo año de monitoreo." />
        </div>
      </Seccion>

      <Criterios />
    </>
  )
}

function Indicador({ n, t, d }: { n: number; t: string; d?: string }) {
  return (
    <Tarjeta>
      <p className="text-2xl font-semibold tabular-nums text-tinta">{n.toLocaleString('es-CO')}</p>
      <p className="text-[13px] text-tinta">{t}</p>
      {d && <p className="mt-1 text-[11.5px] text-suave">{d}</p>}
    </Tarjeta>
  )
}

function Criterios() {
  return (
    <Seccion n="06" titulo="Cómo leer estos gráficos">
      <div className="grid gap-3 md:grid-cols-2">
        <Aviso tono="pizarra" titulo="Coincidir no es causar">
          Que una fase caiga en la época de lluvias no prueba que la lluvia la cause. Para sostenerlo hace falta un análisis aparte (correlación con desfase de 1–2 meses o estadística circular).
        </Aviso>
        <Aviso tono="pizarra" titulo="La temperatura casi no cambia">
          En la Amazonía varía 2–3 °C en el año. Por eso el eje de temperatura empieza en 0: recortarlo exagera la diferencia. La lluvia suele pesar más en la fenología.
        </Aviso>
        <Aviso tono="ambar" titulo="Representatividad">
          Cada figura dice cuántos árboles y rondas la sostienen. Con un solo árbol o un solo año, el calendario es <b>preliminar</b>. Los meses sin monitoreo se dibujan con trama, no en gris: no sabemos qué pasó ahí.
        </Aviso>
        <Aviso tono="ambar" titulo="Fuentes">
          La fenología es monitoreo propio (app de semilleros y Kobo). El clima es de Open-Meteo, por la coordenada de cada árbol. Lo que venga de literatura o del conocimiento local se marca aparte en el informe.
        </Aviso>
      </div>
    </Seccion>
  )
}
