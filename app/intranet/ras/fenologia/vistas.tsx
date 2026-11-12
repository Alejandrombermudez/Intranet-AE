'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Download, FileSpreadsheet, Save, Loader2, Camera, ChevronDown, ChevronRight } from 'lucide-react'
import { Aviso, Boton, Seccion, Vacio } from '@/app/components/marca'
import { fetchConSesion } from '@/lib/fetch-sesion'
import {
  COLOR, FENOFASES, MESES, NOMBRE_SERIE, agrupar, celdasMes, csv, especieDe, etiquetaRonda,
  mesDe, mesesClima, tablaLargaR, valor,
  type Arbol, type Clima, type Foto, type MesClima, type Monitoreo, type ResumenEspecie, type Serie,
} from '@/lib/fenologia'
import {
  CalendarioCircular, CalendarioLineal, Climograma, CurvasRonda, MapaCalor, TiraMeses,
  descargarBlob, descargarPng,
} from './graficos'

const fmt = (n: number, d = 0) => n.toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d })
const pct = (n: number) => `${fmt(n)} %`

export type Contexto = {
  ms: Monitoreo[]
  arboles: Arbol[]
  fotos: Foto[]
  clima: Clima | null
  climaListo: boolean
  lluviosos: number[]
  criterioLluvia: string
  rondas: string[]
  especies: ResumenEspecie[]
  pie: string
  nucleo: string
}

function Casilla({ v, set, children }: { v: boolean; set: (b: boolean) => void; children: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-tinta">
      <input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-[#2f3f32]" />
      {children}
    </label>
  )
}

function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-linea/70 bg-white p-4 sm:p-5 ${className}`}>{children}</div>
}

function Nombre({ e }: { e: string }) {
  return e.startsWith('(') ? <span>{e}</span> : <i>{e}</i>
}

function bajarCsv(filas: (string | number | null | undefined)[][], nombre: string) {
  descargarBlob(new Blob([csv(filas)], { type: 'text/csv;charset=utf-8' }), nombre)
}

const ESCALA_COPA = 'Índice de Fournier en %: promedio del % de copa en fase (0 · 25 · 50 · 75 · 100) entre los árboles monitoreados en la ronda.'

// ═══ Resumen ═════════════════════════════════════════════════════════════════

export function VistaResumen({ c, irEspecie }: { c: Contexto; irEspecie: (e: string) => void }) {
  const ultima = c.rondas[c.rondas.length - 1]
  const enUltima = c.ms.filter((m) => m.ronda === ultima)
  const maduros = enUltima.filter((m) => (m.fruto_maduro ?? 0) > 0)
  const enFlor = enUltima.filter((m) => (valor(m, 'flor') ?? 0) > 0)
  const porPredio = [...agrupar(maduros, (m) => m.predio)].sort((a, b) => b[1].length - a[1].length)
  const protocolo = useMemo(() => {
    const p = new Map<string, string>()
    for (const a of c.arboles) if (a.protocolo) p.set(especieDe(a), a.protocolo)
    return p
  }, [c.arboles])
  const ventanas = c.especies.filter((e) => e.ventana.length > 0).sort((a, b) => a.ventana[0] - b.ventana[0] || b.arboles - a.arboles)

  return (
    <>
      {ultima && (
        <Seccion n="01" titulo={`Qué hay para recolectar · ${etiquetaRonda(ultima)}`}
          sub={`Árboles con fruto maduro en la última ronda monitoreada (${enUltima.length} árboles visitados: ${maduros.length} con fruto maduro y ${enFlor.length} en floración). Sirve para planear la salida de cosecha con cada propietario.`}>
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
        sub="Meses (por ronda) en que la especie tuvo fruto maduro. El color más intenso es el mes con más copa en fruto; la trama, meses sin monitoreo. Toca una especie para ver su ficha."
        acciones={<Boton variante="secundario" icono={<FileSpreadsheet size={14} />} onClick={() => bajarCsv([
          ['especie', 'nombres_comunes', 'familia', 'arboles', 'meses_fruto_maduro', 'mes_pico', 'fournier_pico_pct', 'protocolo_corpoamazonia', 'preliminar'],
          ...ventanas.map((e) => [e.especie, e.comunes.join(' / '), e.familia, e.arboles, e.ventana.map((i) => MESES[i]).join(' '),
            e.pico !== null ? MESES[e.pico] : '', e.pico !== null ? Math.round(e.maduro[e.pico]!.media) : '', protocolo.get(e.especie) ?? 'no', e.preliminar ? 'sí' : 'no']),
        ], `ventanas_cosecha_${c.nucleo}.csv`)}>CSV</Boton>}>
        {ventanas.length === 0 ? <Vacio>Ninguna especie con fruto maduro en los datos filtrados.</Vacio> : (
          <div className="overflow-x-auto rounded-2xl border border-linea/70 bg-white">
            <table className="w-full text-[12.5px]">
              <thead className="text-left text-[11px] uppercase tracking-wide text-suave">
                <tr className="border-b border-linea/70">
                  <th className="px-3 py-2.5 font-medium">Especie</th>
                  <th className="px-3 py-2.5 font-medium">Árboles</th>
                  <th className="px-3 py-2.5 font-medium">Ene → Dic</th>
                  <th className="px-3 py-2.5 font-medium">Pico</th>
                  <th className="px-3 py-2.5 font-medium">Protocolo</th>
                </tr>
              </thead>
              <tbody>
                {ventanas.map((e) => (
                  <tr key={e.especie} onClick={() => irEspecie(e.especie)} className="cursor-pointer border-b border-linea/40 last:border-0 hover:bg-hueso/60">
                    <td className="px-3 py-2"><Nombre e={e.especie} /><span className="block text-[11.5px] text-suave">{e.comunes.join(' · ')}</span></td>
                    <td className="px-3 py-2 tabular-nums">{e.arboles}{e.preliminar && <span className="ml-1.5 text-[10.5px] text-ambar" title="Un solo árbol o un solo año: calendario preliminar">prelim.</span>}</td>
                    <td className="px-3 py-2"><TiraMeses celdas={e.maduro} color={COLOR.frutoLineal} /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{e.pico !== null ? `${MESES[e.pico]} · ${pct(e.maduro[e.pico]!.media)}` : '—'}</td>
                    <td className="px-3 py-2 text-suave">{protocolo.get(e.especie) === 'especie' ? 'Especie' : protocolo.get(e.especie) === 'genero' ? 'Género' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Criterios />
    </>
  )
}

export function Criterios() {
  return (
    <Seccion n="·" titulo="Cómo leer estos gráficos">
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
        <Aviso tono="ambar" titulo="Fuentes secundarias">
          Todo lo que se ve aquí es monitoreo propio (app de semilleros y Kobo). Lo que venga de literatura o del conocimiento local se marca aparte en el informe.
        </Aviso>
      </div>
    </Seccion>
  )
}

// ═══ Calendario lineal ═══════════════════════════════════════════════════════

export function VistaCalendario({ c }: { c: Contexto }) {
  const [intensidad, setIntensidad] = useState(true)
  const [conClima, setConClima] = useState(c.climaListo)
  const [soloActivas, setSoloActivas] = useState(true)
  const [minArboles, setMinArboles] = useState(1)
  const ref = useRef<SVGSVGElement>(null)
  const especies = c.especies.filter((e) => e.arboles >= minArboles && (!soloActivas || e.orden < 99))
  const clima = conClima && c.climaListo ? mesesClima(c.clima) : null

  return (
    <Seccion n="01" titulo="Calendario lineal multiespecie"
      sub="Todas las especies sobre el mismo eje: floración arriba, fructificación abajo, ordenadas por el mes en que empieza la floración. Con clima, el climograma va encima con los meses alineados (versión recomendada para el informe)."
      acciones={<>
        <Boton variante="secundario" icono={<Download size={14} />} onClick={() => descargarPng(ref.current, `calendario_lineal_${c.nucleo}`, 10)}>PNG</Boton>
        <Boton variante="secundario" icono={<FileSpreadsheet size={14} />} onClick={() => bajarCsv(tablaLargaR(c.ms), `fenologia_formato_largo_${c.nucleo}.csv`)}>Tabla para R</Boton>
      </>}>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Casilla v={intensidad} set={setIntensidad}>Intensidad (transparencia)</Casilla>
        <Casilla v={conClima && c.climaListo} set={setConClima}>
          Climograma encima{!c.climaListo && <span className="text-tenue"> (carga el clima en la pestaña Clima)</span>}
        </Casilla>
        <Casilla v={soloActivas} set={setSoloActivas}>Solo especies con floración o fruto</Casilla>
        <label className="inline-flex items-center gap-2 text-[13px] text-tinta">
          Mínimo de árboles
          <select value={minArboles} onChange={(e) => setMinArboles(Number(e.target.value))} className="rounded-lg border border-linea bg-white px-2 py-1">
            {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="text-[12px] text-suave">{especies.length} especies</span>
      </div>
      {especies.length === 0 ? <Vacio>Ninguna especie cumple el filtro.</Vacio> : (
        <Tarjeta className="p-2 sm:p-3">
          <CalendarioLineal svgRef={ref} especies={especies} intensidad={intensidad} clima={clima}
            lluviosos={clima ? c.lluviosos : []} pie={c.pie + (clima && c.criterioLluvia ? ` Franja azul: meses lluviosos (${c.criterioLluvia}).` : '')} />
        </Tarjeta>
      )}
      <p className="mt-3 text-[12px] text-suave">La «Tabla para R» es el formato largo del criterio técnico (especie, mes, fase, intensidad 0–4), ya resumida por especie y mes: sirve directo para <code>calendario_fenologico.R</code>. Los meses sin monitoreo no van en la tabla.</p>
    </Seccion>
  )
}

// ═══ Mapa de calor ═══════════════════════════════════════════════════════════

const SERIES_CALOR: Serie[] = ['flor', 'fruto', ...FENOFASES.map((f) => f.k)]

export function VistaMapaCalor({ c }: { c: Contexto }) {
  const [series, setSeries] = useState<Serie[]>(['flor', 'fruto'])
  const [minArboles, setMinArboles] = useState(1)
  const ref = useRef<SVGSVGElement>(null)
  const grupos = useMemo(() => agrupar(c.ms, especieDe), [c.ms])
  const filas = c.especies.filter((e) => e.arboles >= minArboles)
  const paneles = series.map((s) => ({ titulo: NOMBRE_SERIE[s], celdas: filas.map((e) => celdasMes(grupos.get(e.especie) ?? [], s)) }))
  const alternar = (s: Serie) => setSeries((x) => x.includes(s) ? x.filter((y) => y !== s) : x.length >= 4 ? x : [...x, s])

  return (
    <Seccion n="01" titulo="Mapa de calor por fase"
      sub="Especie × mes, un panel por fase, con la intensidad en escala continua. Sirve para comparar entre especies; para seguir la secuencia flor → fruto de una especie, mejor su ficha. Hasta cuatro paneles."
      acciones={<>
        <Boton variante="secundario" icono={<Download size={14} />} onClick={() => descargarPng(ref.current, `mapa_calor_${c.nucleo}`, 11)}>PNG</Boton>
        <Boton variante="secundario" icono={<FileSpreadsheet size={14} />} onClick={() => bajarCsv(tablaLargaR(c.ms, series), `fenologia_${series.join('_')}_${c.nucleo}.csv`)}>CSV</Boton>
      </>}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {SERIES_CALOR.map((s) => (
          <button key={s} onClick={() => alternar(s)}
            className={`rounded-full px-3 py-1.5 text-[12.5px] transition-colors ${series.includes(s) ? 'bg-bosque text-hueso' : 'vidrio text-suave hover:text-tinta'}`}>
            {NOMBRE_SERIE[s]}
          </button>
        ))}
        <label className="ml-2 inline-flex items-center gap-2 text-[13px] text-tinta">
          Mínimo de árboles
          <select value={minArboles} onChange={(e) => setMinArboles(Number(e.target.value))} className="rounded-lg border border-linea bg-white px-2 py-1">
            {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      {series.length === 0 || filas.length === 0 ? <Vacio>Elige al menos una fase.</Vacio> : (
        <Tarjeta className="p-2 sm:p-3">
          <MapaCalor svgRef={ref} filas={filas.map((e) => ({ especie: e.especie, n: e.arboles }))} paneles={paneles} pie={c.pie} />
        </Tarjeta>
      )}
    </Seccion>
  )
}

// ═══ Ficha por especie ═══════════════════════════════════════════════════════

const COLORES_FASE: Record<string, string> = {
  hoja: '#8fb27a', boton_floral: '#e9b872', floracion: COLOR.florLineal, aborto_floral: '#c9a6a0',
  fruto_inmaduro: '#7fae8a', fruto_maduro: COLOR.frutoLineal, fruto_postmaduro: '#6b4f2e', aborto_frutal: '#b0a99a', plantulas: '#4f7fa0',
}

export function VistaEspecie({ c, especie, setEspecie }: { c: Contexto; especie: string | null; setEspecie: (e: string) => void }) {
  const [intensidad, setIntensidad] = useState(false)
  const [modoClima, setModoClima] = useState<'no' | 'integrado' | 'al-lado'>(c.climaListo ? 'integrado' : 'no')
  const refC = useRef<SVGSVGElement>(null)
  const refL = useRef<SVGSVGElement>(null)
  const refK = useRef<SVGSVGElement>(null)
  const ordenadas = useMemo(() => [...c.especies].sort((a, b) => a.especie.localeCompare(b.especie)), [c.especies])
  const e = c.especies.find((x) => x.especie === especie) ?? ordenadas[0]
  const ms = useMemo(() => (e ? c.ms.filter((m) => especieDe(m) === e.especie) : []), [c.ms, e])
  if (!e) return <Vacio>No hay especies con los filtros actuales.</Vacio>

  const rondas = [...new Set(ms.map((m) => m.ronda))].sort()
  const curvas = FENOFASES.map((f) => ({
    nombre: f.n, color: COLORES_FASE[f.k],
    valores: rondas.map((r) => {
      const vs = ms.filter((m) => m.ronda === r).map((m) => m[f.k]).filter((v): v is number => v !== null)
      return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
    }),
  }))
  const arbolesBase = c.arboles.filter((a) => especieDe(a) === e.especie)
  const codigos = [...new Set([...ms.map((m) => m.codigo), ...arbolesBase.map((a) => a.codigo)])].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  const fito = contar(ms.flatMap((m) => m.estado_fitosanitario ?? []))
  const fauna = contar(ms.flatMap((m) => (m.animales ?? []).map((a) => [a.tipo, a.nombre].filter(Boolean).join(': '))).filter(Boolean))
  const idsMs = new Set(ms.map((m) => m.id))
  const fotos = c.fotos.filter((f) => idsMs.has(f.monitoreo_id))
  const clima = modoClima !== 'no' && c.climaListo ? mesesClima(c.clima) : null
  const pie = `Monitoreo fenológico RAS – ${c.nucleo}: ${e.arboles} árbol(es), ${e.rondas} ronda(s) (${rondas.map(etiquetaRonda).join(', ')}).${e.preliminar ? ' Calendario preliminar.' : ''}${clima && c.clima?.fuente ? ` Clima: ${c.clima.fuente}${c.clima.periodo ? `, ${c.clima.periodo}` : ''}.` : ''}`
  const nombreArchivo = e.especie.replace(/[^\p{L}\p{N}]+/gu, '_')

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select value={e.especie} onChange={(ev) => setEspecie(ev.target.value)}
          className="min-w-[18rem] max-w-full rounded-xl border border-linea bg-white px-3 py-2 text-[14px]">
          {ordenadas.map((x) => <option key={x.especie} value={x.especie}>{x.especie}{x.comunes.length ? ` — ${x.comunes.join(', ')}` : ''} ({x.arboles})</option>)}
        </select>
        <Casilla v={intensidad} set={setIntensidad}>Intensidad</Casilla>
        <label className="inline-flex items-center gap-2 text-[13px] text-tinta">
          Clima
          <select value={modoClima} onChange={(ev) => setModoClima(ev.target.value as typeof modoClima)} disabled={!c.climaListo}
            className="rounded-lg border border-linea bg-white px-2 py-1 disabled:opacity-50">
            <option value="no">Sin clima</option>
            <option value="integrado">En el círculo</option>
            <option value="al-lado">Climograma al lado</option>
          </select>
        </label>
      </div>

      <Seccion n="01" titulo={<><Nombre e={e.especie} /></>}
        sub={`${e.comunes.join(' · ') || 'Sin nombre común'}${e.familia ? ` · ${e.familia}` : ''} · ${e.arboles} árbol(es) en ${e.predios.length} predio(s) · ${e.monitoreos} monitoreos`}
        acciones={<Boton variante="secundario" icono={<Download size={14} />} onClick={() => descargarPng(refC.current, `calendario_circular_${nombreArchivo}`, 8.5)}>PNG</Boton>}>
        <div className={`grid gap-4 ${modoClima === 'al-lado' && clima ? 'lg:grid-cols-[1.1fr_1fr]' : 'lg:grid-cols-[1.25fr_1fr]'}`}>
          <Tarjeta className="p-2 sm:p-3">
            <CalendarioCircular svgRef={refC} e={e} intensidad={intensidad} clima={modoClima === 'integrado' ? clima : null} pie={pie} />
          </Tarjeta>
          <div className="space-y-4">
            {modoClima === 'al-lado' && clima && (
              <Tarjeta className="p-2 sm:p-3">
                <Climograma svgRef={refK} meses={clima} lluviosos={c.lluviosos} titulo={`Clima de referencia · ${c.nucleo}`} />
              </Tarjeta>
            )}
            <Tarjeta>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                <Dato t="Ventana de fruto maduro" v={e.ventana.length ? e.ventana.map((i) => MESES[i]).join(', ') : 'No se observó'} />
                <Dato t="Mes pico" v={e.pico !== null ? `${MESES[e.pico]} (${pct(e.maduro[e.pico]!.media)})` : '—'} />
                <Dato t="Sincronía floración" v={e.sincroniaFlor !== null ? fmt(e.sincroniaFlor, 2) : '—'} ayuda="Augspurger: 1 = todos los árboles a la vez; necesita ≥ 2 en fase" />
                <Dato t="Sincronía fructificación" v={e.sincroniaFruto !== null ? fmt(e.sincroniaFruto, 2) : '—'} />
                <Dato t="Años de monitoreo" v={e.anios.join(', ')} />
                <Dato t="Representatividad" v={e.preliminar ? 'Preliminar' : 'Suficiente'} ayuda="Preliminar = un solo árbol o un solo año" />
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

      <Seccion n="03" titulo="Árboles" sub="Cada árbol con su floración y su fruto maduro mes a mes. Los de la base que no tienen monitoreo con estos filtros aparecen sin casillas.">
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
                    <td className="px-3 py-2">{l.length ? <TiraMeses celdas={celdasMes(l, 'flor')} color={COLOR.florLineal} /> : '—'}</td>
                    <td className="px-3 py-2">{l.length ? <TiraMeses celdas={celdasMes(l, 'fruto_maduro')} color={COLOR.frutoLineal} /> : '—'}</td>
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
  const ultima = c.rondas[c.rondas.length - 1]
  const predios = useMemo(() => {
    const nombres = new Set([...c.arboles.map((a) => a.predio), ...c.ms.map((m) => m.predio)])
    return [...nombres].map((p) => {
      const base = c.arboles.filter((a) => a.predio === p)
      const ms = c.ms.filter((m) => m.predio === p)
      const u = ms.filter((m) => m.ronda === ultima)
      return {
        predio: p,
        vereda: base.find((a) => a.vereda)?.vereda ?? null,
        base: base.length,
        monitoreados: new Set(ms.map((m) => m.codigo)).size,
        especies: new Set([...base.map(especieDe), ...ms.map(especieDe)]).size,
        porRonda: c.rondas.map((r) => new Set(ms.filter((m) => m.ronda === r).map((m) => m.codigo)).size),
        flor: u.filter((m) => (valor(m, 'flor') ?? 0) > 0).length,
        maduro: u.filter((m) => (m.fruto_maduro ?? 0) > 0).length,
        monitores: [...new Set(ms.map((m) => m.monitor).filter(Boolean))] as string[],
        ms, base_: base,
      }
    }).sort((a, b) => (a.vereda ?? '').localeCompare(b.vereda ?? '') || a.predio.localeCompare(b.predio))
  }, [c.arboles, c.ms, c.rondas, ultima])

  return (
    <Seccion n="01" titulo="Predios"
      sub={`Cuántos árboles tiene cada predio, cuántos se visitaron en cada ronda y qué estaba en flor o en fruto maduro en ${ultima ? etiquetaRonda(ultima) : 'la última ronda'}. Toca un predio para ver sus árboles.`}
      acciones={<Boton variante="secundario" icono={<FileSpreadsheet size={14} />} onClick={() => bajarCsv([
        ['predio', 'vereda', 'arboles_base', 'arboles_monitoreados', 'especies', ...c.rondas.map((r) => `visitados_${r}`), 'en_flor_ultima', 'fruto_maduro_ultima', 'quien_monitorea'],
        ...predios.map((p) => [p.predio, p.vereda, p.base, p.monitoreados, p.especies, ...p.porRonda, p.flor, p.maduro, p.monitores.join(' / ')]),
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
                </tr>,
                abierto === p.predio && (
                  <tr key={`${p.predio}-detalle`} className="border-b border-linea/40 bg-hueso/40">
                    <td colSpan={5 + c.rondas.length} className="px-4 py-3">
                      {p.monitores.length > 0 && <p className="mb-2 text-[12px] text-suave">Monitorea: {p.monitores.join(', ')}</p>}
                      <ArbolesPredio p={p} irEspecie={irEspecie} />
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

function ArbolesPredio({ p, irEspecie }: { p: { ms: Monitoreo[]; base_: Arbol[] }; irEspecie: (e: string) => void }) {
  const codigos = [...new Set([...p.base_.map((a) => a.codigo), ...p.ms.map((m) => m.codigo)])].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  return (
    <div className="grid gap-x-8 gap-y-1.5 xl:grid-cols-2">
      <div className="flex gap-2 text-[10.5px] uppercase tracking-wide text-suave xl:col-span-2">
        <span className="flex-1">Placa · especie</span><span className="w-[166px]">Floración</span><span className="w-[166px]">Fruto maduro</span>
      </div>
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
              <TiraMeses celdas={celdasMes(l, 'flor')} color={COLOR.florLineal} />
              <TiraMeses celdas={celdasMes(l, 'fruto_maduro')} color={COLOR.frutoLineal} />
            </> : <span className="text-tenue">sin monitoreo</span>}
          </div>
        )
      })}
    </div>
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

  // Calidad de los datos
  const fuera = c.ms.filter((m) => !m.en_base)
  const desfase = c.ms.filter((m) => m.fecha && Number(m.fecha.slice(5, 7)) !== mesDe(m)).length
  const monitoreados = new Set(c.ms.map((m) => m.codigo))
  const sinNunca = c.arboles.filter((a) => !monitoreados.has(a.codigo))
  const ultima = c.rondas[c.rondas.length - 1]
  const enUltima = new Set(c.ms.filter((m) => m.ronda === ultima).map((m) => m.codigo))
  const faltanUltima = c.arboles.filter((a) => !enUltima.has(a.codigo))
  const sinCoord = c.arboles.filter((a) => a.latitud === null || a.longitud === null)

  const tablaSinc = c.especies.filter((e) => e.arboles >= 2).sort((a, b) => b.arboles - a.arboles)

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

      <Seccion n="02" titulo="Actividad: % de árboles en fase" sub="El índice de actividad (presencia/ausencia): qué parte de los árboles visitados tenía la fase, sin importar cuánta copa. Complementa al de Fournier, que mide intensidad."
        acciones={<Boton variante="secundario" icono={<Download size={14} />} onClick={() => descargarPng(refA.current, `actividad_por_ronda_${c.nucleo}`, 10)}>PNG</Boton>}>
        <Tarjeta className="p-2 sm:p-3"><CurvasRonda svgRef={refA} rondas={c.rondas} series={actividad} /></Tarjeta>
      </Seccion>

      <Seccion n="03" titulo="Sincronía por especie" sub="Índice de Augspurger: de 0 (los árboles de la especie nunca coinciden en la fase) a 1 (todos a la vez). Solo especies con dos árboles o más; con pocos árboles o rondas el valor es inestable.">
        {tablaSinc.length === 0 ? <Vacio>Ninguna especie tiene dos árboles con estos filtros.</Vacio> : (
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
          <Indicador n={sinCoord.length} t="árboles sin coordenada" d={sinCoord.map((a) => a.codigo).join(', ') || '—'} />
          <Indicador n={c.especies.filter((e) => e.preliminar).length} t="especies con calendario preliminar" d="Un solo árbol o un solo año de monitoreo." />
        </div>
      </Seccion>
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

// ═══ Clima ═══════════════════════════════════════════════════════════════════

export function VistaClima({ c, pendiente, alGuardar }: { c: Contexto; pendiente: boolean; alGuardar: () => void }) {
  const inicial = mesesClima(c.clima)
  const [meses, setMeses] = useState<{ p: string; t: string }[]>(inicial.map((m) => ({ p: m.precip_mm?.toString() ?? '', t: m.temp_c?.toString() ?? '' })))
  const [fuente, setFuente] = useState(c.clima?.fuente ?? '')
  const [estacion, setEstacion] = useState(c.clima?.estacion ?? '')
  const [periodo, setPeriodo] = useState(c.clima?.periodo ?? '')
  const [umbral, setUmbral] = useState(c.clima?.umbral_lluvia_mm?.toString() ?? '')
  const [notas, setNotas] = useState(c.clima?.notas ?? '')
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const ref = useRef<SVGSVGElement>(null)
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
  const vista: MesClima[] = meses.map((m, i) => ({ mes: i + 1, precip_mm: num(m.p), temp_c: num(m.t) }))
  const borrador: Clima = { nucleo: c.nucleo, fuente, estacion, periodo, umbral_lluvia_mm: num(umbral), notas, meses: vista }

  const pegar = (texto: string) => {
    // Pegar 12 filas desde Excel: «precip<TAB>temp» por línea.
    const filas = texto.trim().split(/\r?\n/).map((l) => l.split(/\t|;/).map((x) => x.trim()))
    if (filas.length < 12) return false
    setMeses(filas.slice(0, 12).map((f) => ({ p: f[0] ?? '', t: f[1] ?? '' })))
    return true
  }

  const guardar = async () => {
    setGuardando(true)
    setMsg(null)
    const r = await fetchConSesion('/api/ras/fenologia', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nucleo: c.nucleo, fuente, estacion, periodo, umbral_lluvia_mm: num(umbral), notas, meses: vista }),
    })
    const j = await r.json().catch(() => ({}))
    setGuardando(false)
    if (r.ok) { setMsg({ ok: true, t: 'Guardado.' }); alGuardar() } else setMsg({ ok: false, t: j.error ?? 'No se pudo guardar.' })
  }

  const { meses: lluv } = (() => {
    const ps = vista.map((m) => m.precip_mm)
    if (ps.some((p) => p === null || isNaN(p))) return { meses: [] as number[] }
    const u = num(umbral)
    const ord = [...(ps as number[])].sort((a, b) => a - b)
    const lim = u ?? (ord[5] + ord[6]) / 2
    return { meses: (ps as number[]).flatMap((p, i) => (p > lim ? [i] : [])) }
  })()

  return (
    <>
      {pendiente && (
        <Aviso tono="arcilla" titulo="Falta correr la migración" className="mb-6">
          Las tablas de clima se crean con <code>docs/sql/migration_fenologia_intranet.sql</code>. Hasta que se corra en el SQL Editor no se puede guardar.
        </Aviso>
      )}
      <Seccion n="01" titulo={`Clima de referencia · ${c.nucleo}`}
        sub="Promedios multianuales por mes. Fuente preferida: normales climatológicas de la estación IDEAM más cercana; si no hay una representativa, CHIRPS para lluvia y WorldClim o ERA5-Land para temperatura. La fuente, la estación o el pixel y el periodo salen en el pie de cada figura.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <Tarjeta>
            <table className="w-full text-[13px]" onPaste={(e) => { if (pegar(e.clipboardData.getData('text'))) e.preventDefault() }}>
              <thead className="text-left text-[11px] uppercase tracking-wide text-suave">
                <tr><th className="pb-2 font-medium">Mes</th><th className="pb-2 font-medium">Lluvia (mm)</th><th className="pb-2 font-medium">Temp. (°C)</th></tr>
              </thead>
              <tbody>
                {meses.map((m, i) => (
                  <tr key={i}>
                    <td className="py-0.5 pr-2 text-suave">{MESES[i]}</td>
                    <td className="py-0.5 pr-2"><input inputMode="decimal" value={m.p} onChange={(e) => setMeses((x) => x.map((y, j) => (j === i ? { ...y, p: e.target.value } : y)))} className="w-full rounded-lg border border-linea bg-white px-2 py-1 tabular-nums" /></td>
                    <td className="py-0.5"><input inputMode="decimal" value={m.t} onChange={(e) => setMeses((x) => x.map((y, j) => (j === i ? { ...y, t: e.target.value } : y)))} className="w-full rounded-lg border border-linea bg-white px-2 py-1 tabular-nums" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11.5px] text-suave">Se pueden pegar las 12 filas desde Excel (lluvia y temperatura en dos columnas).</p>
          </Tarjeta>
          <div className="space-y-4">
            <Tarjeta>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo t="Fuente *"><input list="fuentes-clima" value={fuente} onChange={(e) => setFuente(e.target.value)} className="w-full rounded-lg border border-linea bg-white px-2.5 py-1.5" />
                  <datalist id="fuentes-clima">{['IDEAM — normales climatológicas', 'CHIRPS (precipitación)', 'WorldClim 2.1', 'ERA5-Land', 'CHIRPS + WorldClim'].map((f) => <option key={f} value={f} />)}</datalist></Campo>
                <Campo t="Estación o pixel"><input value={estacion} onChange={(e) => setEstacion(e.target.value)} placeholder="Nombre y código IDEAM" className="w-full rounded-lg border border-linea bg-white px-2.5 py-1.5" /></Campo>
                <Campo t="Periodo de referencia"><input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="1991–2020" className="w-full rounded-lg border border-linea bg-white px-2.5 py-1.5" /></Campo>
                <Campo t="Umbral de mes lluvioso (mm)"><input inputMode="decimal" value={umbral} onChange={(e) => setUmbral(e.target.value)} placeholder="Vacío = mediana anual" className="w-full rounded-lg border border-linea bg-white px-2.5 py-1.5" /></Campo>
                <Campo t="Notas" ancho><textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full rounded-lg border border-linea bg-white px-2.5 py-1.5" /></Campo>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Boton icono={guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} onClick={guardar} disabled={guardando || pendiente || !fuente.trim()}>Guardar clima</Boton>
                <Boton variante="secundario" icono={<FileSpreadsheet size={14} />} onClick={() => bajarCsv([['mes', 'precip_mm', 'temp_c'], ...vista.map((m) => [m.mes, m.precip_mm, m.temp_c])], `clima_${c.nucleo}.csv`)}>CSV para R</Boton>
                {msg && <span className={`text-[13px] ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>{msg.t}</span>}
                {c.clima?.updated_by && <span className="text-[12px] text-suave">Última edición: {c.clima.updated_by}</span>}
              </div>
              <p className="mt-3 text-[12px] text-suave">El umbral con sentido ecológico es mejor que la mediana (por ejemplo, &gt; 200 mm, o la estacionalidad que reporte el IDEAM para la zona). Lo que se elija se declara en el pie de figura.</p>
            </Tarjeta>
            <Tarjeta className="p-2 sm:p-3">
              <div className="mb-1 flex justify-end"><Boton variante="fantasma" icono={<Download size={14} />} onClick={() => descargarPng(ref.current, `climograma_${c.nucleo}`, 8)}>PNG</Boton></div>
              <Climograma svgRef={ref} meses={borrador.meses} lluviosos={lluv} titulo={fuente ? `${c.nucleo} · ${fuente}${periodo ? ` (${periodo})` : ''}` : `Clima de referencia · ${c.nucleo}`} />
            </Tarjeta>
          </div>
        </div>
      </Seccion>
    </>
  )
}

function Campo({ t, children, ancho }: { t: string; children: ReactNode; ancho?: boolean }) {
  return (
    <label className={`block text-[13px] ${ancho ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-[11.5px] uppercase tracking-wide text-suave">{t}</span>
      {children}
    </label>
  )
}
