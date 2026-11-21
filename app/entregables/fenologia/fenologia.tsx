'use client'
/**
 * Vista pública de los calendarios fenológicos. A propósito más simple que la
 * de la intranet: fondo blanco, cuatro secciones (Especies, Mes a mes, Predios,
 * Clima), un filtro de predio, un buscador y pocos interruptores. El verde queda
 * para los botones al pasar el cursor; los gráficos y los cálculos son los mismos
 * de /intranet/ras/fenologia (graficos.tsx y lib/fenologia.ts), así que las
 * cifras coinciden.
 * Blanco con `bg-[#fff]` y no `bg-white`: la regla global de vidrio vuelve
 * crema (#fffdf9) toda tarjeta `bg-white`.
 */
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import { CalendarioCircular, Climograma, MapaCalor, TiraMeses } from '@/app/intranet/ras/fenologia/graficos'
import {
  COLOR, MESES, MESES_LARGOS, agrupar, celdasMes, climaPonderado, especieDe, etiquetaRonda, mesDe,
  mesesLluviosos, resumenEspecies, valor,
  type Arbol, type CeldaClima, type Monitoreo, type ResumenEspecie,
} from '@/lib/fenologia'
import type { FenologiaPublica } from '@/lib/fenologia-publica'

type Seccion = 'especies' | 'mes' | 'predios' | 'clima'

const BOTON = 'rounded-full border border-linea bg-[#fff] px-4 py-1.5 text-[13.5px] text-tinta transition hover:border-bosque hover:bg-bosque hover:text-white'
const ACTIVO = 'rounded-full border border-tinta bg-[#fff] px-4 py-1.5 text-[13.5px] font-medium text-tinta'
const SELECT = 'rounded-full border border-linea bg-[#fff] px-4 py-1.5 text-[13.5px] text-tinta outline-none transition hover:border-bosque focus:border-tinta'
const n = (x: number) => Math.round(x).toLocaleString('es-CO')
const clave = (x: { nucleo: string; codigo: string }) => `${x.nucleo}|${x.codigo}`
const nombre = (e: ResumenEspecie) => e.comunes[0] ?? e.especie
const activa = (e: ResumenEspecie) => e.orden < 99
const lluviaAnual = (meses: { precip_mm: number | null }[]) => meses.reduce((s, m) => s + (m.precip_mm ?? 0), 0)

/** Lo que comparten las secciones con el filtro de predio aplicado. */
type Ctx = {
  ms: Monitoreo[]
  arboles: Arbol[]
  especies: ResumenEspecie[]
  porEspecie: Map<string, Monitoreo[]>
  rondas: string[]
  meses: number[]
  zona: string
  predio: string
  climaDe: (claves: Iterable<string>) => { meses: { mes: number; precip_mm: number | null; temp_c: number | null }[]; celdas: number; arboles: number } | null
  periodoClima: string | null
  pie: string
}

export default function Fenologia({ datos }: { datos: FenologiaPublica | null }) {
  const [seccion, setSeccion] = useState<Seccion>('especies')
  const [predio, setPredio] = useState('')
  const [abierta, setAbierta] = useState<string | null>(null)

  const indice = useMemo(() => {
    const m = new Map<string, CeldaClima>()
    for (const c of datos?.clima?.celdas ?? []) for (const k of c.arboles) m.set(k, c as unknown as CeldaClima)
    return m
  }, [datos])

  const predios = useMemo(() => datos
    ? [...new Set([...datos.arboles.map((a) => a.predio), ...datos.monitoreos.map((m) => m.predio)])].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
    : [], [datos])

  const c: Ctx | null = useMemo(() => {
    if (!datos) return null
    const ms = datos.monitoreos.filter((m) => !predio || m.predio === predio)
    const arboles = datos.arboles.filter((a) => !predio || a.predio === predio)
    const rondas = [...new Set(ms.map((m) => m.ronda))].sort()
    const zona = [...new Set(datos.monitoreos.map((m) => m.nucleo))].join(', ')
    return {
      ms, arboles, rondas, zona, predio,
      especies: resumenEspecies(ms),
      porEspecie: agrupar(ms, especieDe),
      meses: [...new Set(ms.map((m) => mesDe(m) - 1))].sort((a, b) => a - b),
      climaDe: (claves) => {
        const g = climaPonderado(indice, claves)
        return g ? { meses: g.meses, celdas: g.celdas.length, arboles: g.arboles } : null
      },
      periodoClima: datos.clima?.periodo ?? null,
      pie: `Fuente: monitoreo fenológico RAS – ${zona}${predio ? `, ${predio}` : ''}; ` +
        `${rondas.length ? `rondas ${etiquetaRonda(rondas[0])} a ${etiquetaRonda(rondas[rondas.length - 1])}` : 'sin rondas'}; ` +
        `${new Set(ms.map(clave)).size} árboles, ${ms.length} monitoreos. Intensidad: índice de Fournier (promedio del % de copa).`,
    }
  }, [datos, predio, indice])

  const especieAbierta = c && abierta ? c.especies.find((e) => e.especie === abierta) ?? null : null

  return (
    <div className="min-h-screen bg-[#fff]">
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6">
        <header className="mb-6">
          <p className="text-[11px] font-medium uppercase tracking-[.18em] text-suave">Amazonía Emprende · Red de Árboles Semilleros</p>
          <h1 className="mt-1 font-titulo text-[2rem] font-semibold leading-tight text-tinta">Calendarios fenológicos</h1>
          <p className="mt-2 max-w-2xl text-[14.5px] text-suave">
            Cuándo florece y cuándo da fruto cada especie de los árboles semilleros que monitoreamos cada mes. Sirve para saber en qué meses se puede recolectar semilla.
          </p>
        </header>

        {!datos || !c ? (
          <p className="rounded-2xl border border-linea px-4 py-8 text-center text-[14px] text-suave">Los datos no están disponibles en este momento. Intente de nuevo más tarde.</p>
        ) : datos.monitoreos.length === 0 ? (
          <p className="rounded-2xl border border-linea px-4 py-8 text-center text-[14px] text-suave">Todavía no hay monitoreos publicados.</p>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-linea bg-linea sm:grid-cols-4">
              <Cifra v={n(c.especies.length)} t="especies" />
              <Cifra v={n(new Set(c.ms.map(clave)).size)} t="árboles semilleros" />
              <Cifra v={n(new Set(c.ms.map((m) => m.predio)).size)} t={predio ? 'predio' : 'predios'} />
              <Cifra v={datos.periodo} t={`${c.rondas.length} meses de monitoreo`} pequeno />
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-2">
              {([['especies', 'Especies'], ['mes', 'Mes a mes'], ['predios', 'Predios'], ['clima', 'Clima']] as const).map(([k, t]) => (
                <button key={k} onClick={() => setSeccion(k)} className={seccion === k ? ACTIVO : BOTON}>{t}</button>
              ))}
              <span className="mx-1 hidden h-6 w-px bg-linea sm:block" />
              <select value={predio} onChange={(e) => setPredio(e.target.value)} aria-label="Predio" className={SELECT}>
                <option value="">Todos los predios ({predios.length})</option>
                {[...agrupar(predios, (p) => datos.arboles.find((a) => a.predio === p && a.vereda)?.vereda ?? 'Sin vereda')]
                  .sort((a, b) => a[0].localeCompare(b[0], 'es'))
                  .map(([v, ps]) => (
                    <optgroup key={v} label={v}>{ps.map((p) => <option key={p}>{p}</option>)}</optgroup>
                  ))}
              </select>
              {predio && <button onClick={() => setPredio('')} className="px-1 text-[12.5px] text-suave underline hover:text-bosque">Quitar filtro</button>}
            </div>

            {seccion === 'especies' && <Especies c={c} abrir={setAbierta} />}
            {seccion === 'mes' && <MesAMes c={c} abrir={setAbierta} />}
            {seccion === 'predios' && <Predios c={c} abrir={setAbierta} filtrar={(p) => { setPredio(p); setSeccion('especies') }} />}
            {seccion === 'clima' && <Clima c={c} />}

            <p className="mt-10 border-t border-linea pt-4 text-[12px] leading-relaxed text-suave">
              Datos preliminares: {c.rondas.length} meses de monitoreo ({datos.periodo}) en {c.zona}. Un mes sin monitoreo no quiere decir que la especie no tenga flor o fruto en ese mes;
              con más años de datos el calendario se completa. Fuente: monitoreo fenológico de la Red de Árboles Semilleros, Amazonía Emprende.
            </p>
          </>
        )}
      </div>
      {especieAbierta && c && <Ficha e={especieAbierta} c={c} cerrar={() => setAbierta(null)} />}
    </div>
  )
}

function Cifra({ v, t, pequeno }: { v: string; t: string; pequeno?: boolean }) {
  return (
    <div className="bg-[#fff] px-4 py-3">
      <p className={`font-semibold text-tinta ${pequeno ? 'text-[15px] leading-7' : 'text-[1.5rem] leading-7'}`}>{v}</p>
      <p className="text-[12px] text-suave">{t}</p>
    </div>
  )
}

function Leyenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-suave">
      <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[3px]" style={{ background: COLOR.florLineal }} />Flor</span>
      <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[3px]" style={{ background: COLOR.frutoLineal }} />Fruto</span>
      <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-[3px]" style={{ background: COLOR.sinActividad }} />Sin flor ni fruto</span>
      <span>Color más intenso = más copa cubierta</span>
    </div>
  )
}

function Opciones<T extends string>({ valor: v, set, opciones }: { valor: T; set: (k: T) => void; opciones: [T, string][] }) {
  return (
    <span className="inline-flex overflow-hidden rounded-full border border-linea">
      {opciones.map(([k, t]) => (
        <button key={k} onClick={() => set(k)}
          className={`px-3.5 py-1.5 text-[13px] transition ${v === k ? 'bg-[#fff] font-medium text-tinta underline decoration-2 underline-offset-4' : 'bg-[#fff] text-suave hover:bg-bosque hover:text-white'}`}>
          {t}
        </button>
      ))}
    </span>
  )
}

const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

// ─── Especies ────────────────────────────────────────────────────────────────

function Especies({ c, abrir }: { c: Ctx; abrir: (e: string) => void }) {
  const [q, setQ] = useState('')
  const [todas, setTodas] = useState(false)
  const [ver, setVer] = useState<'lista' | 'calor'>('lista')
  const lista = useMemo(() => {
    const t = sinTildes(q.trim())
    return c.especies.filter((e) => (todas || activa(e)) && (!t || sinTildes([e.especie, ...e.comunes, e.familia ?? ''].join(' ')).includes(t)))
  }, [c.especies, q, todas])
  const conActividad = c.especies.filter(activa).length

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar especie…" aria-label="Buscar especie"
          className="min-w-0 flex-1 rounded-full border border-linea bg-[#fff] px-4 py-2 text-[14px] text-tinta outline-none focus:border-tinta sm:max-w-xs" />
        <button onClick={() => setTodas(!todas)} className={BOTON}>
          {todas ? `Solo con flor o fruto (${conActividad})` : `Ver todas (${c.especies.length})`}
        </button>
        <span className="sm:ml-auto"><Opciones valor={ver} set={setVer} opciones={[['lista', 'Lista'], ['calor', 'Mapa de calor']]} /></span>
      </div>

      {lista.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-suave">Ninguna especie con ese nombre.</p>
      ) : ver === 'calor' ? (
        <div className="rounded-2xl border border-linea p-2 sm:p-3">
          <MapaCalor meses={c.meses} pie={c.pie}
            filas={lista.map((e) => ({ especie: e.especie, n: e.arboles }))}
            paneles={(['flor', 'fruto'] as const).map((s) => ({
              titulo: s === 'flor' ? 'Floración' : 'Fructificación',
              celdas: lista.map((e) => celdasMes(c.porEspecie.get(e.especie) ?? [], s)),
            }))} />
        </div>
      ) : (
        <>
          <div className="mb-3"><Leyenda /></div>
          <div className="overflow-hidden rounded-2xl border border-linea">
            <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 border-b border-linea px-4 py-2 text-[11px] text-suave sm:grid">
              <span>Especie</span>
              <span className="flex gap-[3px]">{c.meses.map((i) => <span key={i} className="flex-1 text-center">{MESES[i]}</span>)}</span>
            </div>
            <ul>
              {lista.map((e) => (
                <li key={e.especie} className="border-b border-linea last:border-0">
                  <button onClick={() => abrir(e.especie)} className="group grid w-full gap-2 px-4 py-3 text-left transition hover:bg-bosque/[.06] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center sm:gap-4">
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-medium text-tinta group-hover:text-bosque">{nombre(e)}</span>
                      <span className="block truncate text-[12px] italic text-suave">{e.especie} · {e.arboles} {e.arboles === 1 ? 'árbol' : 'árboles'}</span>
                    </span>
                    <span className="space-y-1">
                      <span className="flex gap-[3px] text-[10px] text-suave sm:hidden">{c.meses.map((i) => <span key={i} className="flex-1 text-center">{MESES[i]}</span>)}</span>
                      <TiraMeses celdas={e.flor} color={COLOR.florLineal} meses={c.meses} grande />
                      <TiraMeses celdas={e.fruto} color={COLOR.frutoLineal} meses={c.meses} grande />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {!todas && conActividad < c.especies.length && (
        <p className="mt-3 text-[12.5px] text-suave">{c.especies.length - conActividad} especies no han mostrado flor ni fruto en estos meses; aparecen con «Ver todas».</p>
      )}
    </section>
  )
}

// ─── Mes a mes ───────────────────────────────────────────────────────────────

function MesAMes({ c, abrir }: { c: Ctx; abrir: (e: string) => void }) {
  const [mes, setMes] = useState(c.meses[c.meses.length - 1] ?? 0)
  const monitoreado = c.meses.includes(mes)
  const enFlor = c.especies.filter((e) => (e.flor[mes]?.media ?? 0) > 0)
  const conFruto = c.especies.filter((e) => (e.maduro[mes]?.media ?? 0) > 0)
  const fruto = c.especies.filter((e) => (e.fruto[mes]?.media ?? 0) > 0 && !conFruto.includes(e))

  return (
    <section>
      <div className="mb-5 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {MESES.map((m, i) => (
          <button key={m} onClick={() => setMes(i)} title={c.meses.includes(i) ? undefined : 'Sin monitoreo todavía'}
            className={`rounded-xl border py-2 text-[13px] transition ${mes === i ? 'border-tinta font-medium' : 'border-linea hover:border-bosque hover:bg-bosque hover:text-white'} ${c.meses.includes(i) ? 'text-tinta' : 'text-tenue'}`}>
            {m}
          </button>
        ))}
      </div>

      <h2 className="mb-1 font-titulo text-[1.35rem] font-semibold capitalize text-tinta">{MESES_LARGOS[mes]}</h2>
      {!monitoreado ? (
        <p className="py-6 text-[14px] text-suave">Este mes todavía no se ha monitoreado. Hay datos de: {c.meses.map((i) => MESES_LARGOS[i]).join(', ')}.</p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Grupo titulo="Con fruto maduro" ayuda="Listas para recolectar semilla" color={COLOR.frutoLineal} xs={conFruto} abrir={abrir} />
          <Grupo titulo="Con fruto verde" ayuda="Fruto en formación" color="#7fae8a" xs={fruto} abrir={abrir} />
          <Grupo titulo="En flor" ayuda="Botón floral o flor abierta" color={COLOR.florLineal} xs={enFlor} abrir={abrir} />
        </div>
      )}
    </section>
  )
}

function Grupo({ titulo, ayuda, color, xs, abrir }: { titulo: string; ayuda: string; color: string; xs: ResumenEspecie[]; abrir: (e: string) => void }) {
  return (
    <div className="rounded-2xl border border-linea p-4">
      <p className="flex items-center gap-2 text-[14px] font-medium text-tinta"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />{titulo} <span className="text-suave">· {xs.length}</span></p>
      <p className="mb-3 text-[12px] text-suave">{ayuda}</p>
      {xs.length === 0 ? <p className="text-[13px] text-suave">Ninguna.</p> : (
        <ul className="space-y-0.5">
          {xs.map((e) => (
            <li key={e.especie}>
              <button onClick={() => abrir(e.especie)} className="w-full rounded-lg px-2 py-1 text-left text-[13.5px] text-tinta transition hover:bg-bosque hover:text-white">
                {nombre(e)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Predios ─────────────────────────────────────────────────────────────────

function Predios({ c, abrir, filtrar }: { c: Ctx; abrir: (e: string) => void; filtrar: (p: string) => void }) {
  const [abierto, setAbierto] = useState<string | null>(c.predio || null)
  const ultima = c.rondas[c.rondas.length - 1]
  const filas = useMemo(() => {
    const nombres = new Set([...c.arboles.map((a) => a.predio), ...c.ms.map((m) => m.predio)])
    return [...nombres].map((p) => {
      const base = c.arboles.filter((a) => a.predio === p)
      const ms = c.ms.filter((m) => m.predio === p)
      const u = ms.filter((m) => m.ronda === ultima)
      const g = c.climaDe(base.length ? base.map(clave) : ms.map(clave))
      return {
        predio: p,
        vereda: base.find((a) => a.vereda)?.vereda ?? null,
        arboles: base.length || new Set(ms.map((m) => m.codigo)).size,
        especies: new Set([...base.map(especieDe), ...ms.map(especieDe)]).size,
        porRonda: c.rondas.map((r) => new Set(ms.filter((m) => m.ronda === r).map((m) => m.codigo)).size),
        flor: u.filter((m) => (valor(m, 'flor') ?? 0) > 0).length,
        maduro: u.filter((m) => (m.fruto_maduro ?? 0) > 0).length,
        lluvia: g ? lluviaAnual(g.meses) : null,
        ms, base,
      }
    }).sort((a, b) => (a.vereda ?? '').localeCompare(b.vereda ?? '', 'es') || a.predio.localeCompare(b.predio, 'es', { numeric: true }))
  }, [c, ultima])

  return (
    <section>
      <p className="mb-4 max-w-2xl text-[14px] text-suave">
        Árboles de cada predio, cuántos se visitaron en cada mes y cuántos estaban en flor o en fruto maduro en {ultima ? etiquetaRonda(ultima) : 'el último mes'}. Toque un predio para ver sus árboles.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-linea">
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] text-suave">
            <tr className="border-b border-linea">
              <th className="px-4 py-2.5 font-medium">Predio</th>
              <th className="px-3 py-2.5 font-medium">Árboles</th>
              <th className="px-3 py-2.5 font-medium">Especies</th>
              {c.rondas.map((r) => <th key={r} className="px-1.5 py-2.5 text-center font-medium">{MESES[Number(r.slice(5, 7)) - 1]}</th>)}
              <th className="px-3 py-2.5 font-medium">En flor</th>
              <th className="px-3 py-2.5 font-medium">Fruto maduro</th>
              <th className="px-3 py-2.5 font-medium">Lluvia anual</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((p) => (
              <Fragment key={p.predio}>
                <tr onClick={() => setAbierto(abierto === p.predio ? null : p.predio)} className="cursor-pointer border-b border-linea transition hover:bg-bosque/[.06]">
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 font-medium text-tinta">
                      {abierto === p.predio ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{p.predio}
                    </span>
                    {p.vereda && <span className="block pl-5 text-[11.5px] text-suave">{p.vereda}</span>}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{p.arboles}</td>
                  <td className="px-3 py-2.5 tabular-nums">{p.especies}</td>
                  {p.porRonda.map((v, i) => (
                    <td key={i} className={`px-1.5 py-2.5 text-center tabular-nums ${v < p.arboles ? 'text-suave' : 'text-tinta'}`}>{v}/{p.arboles}</td>
                  ))}
                  <td className="px-3 py-2.5 tabular-nums" style={{ color: COLOR.florLineal }}>{p.flor || '—'}</td>
                  <td className="px-3 py-2.5 tabular-nums" style={{ color: COLOR.frutoLineal }}>{p.maduro || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-suave">{p.lluvia === null ? '—' : `${n(p.lluvia)} mm`}</td>
                </tr>
                {abierto === p.predio && (
                  <tr className="border-b border-linea">
                    <td colSpan={6 + c.rondas.length} className="px-4 py-3">
                      <ArbolesPredio ms={p.ms} base={p.base} meses={c.meses} abrir={abrir} />
                      {!c.predio && (
                        <button onClick={() => filtrar(p.predio)} className={`${BOTON} mt-3`}>Ver solo este predio</button>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ArbolesPredio({ ms, base, meses, abrir }: { ms: Monitoreo[]; base: Arbol[]; meses: number[]; abrir: (e: string) => void }) {
  const codigos = [...new Set([...base.map((a) => a.codigo), ...ms.map((m) => m.codigo)])].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  return (
    <div>
      <div className="grid gap-x-8 gap-y-1.5 lg:grid-cols-2">
        {codigos.map((cod) => {
          const l = ms.filter((m) => m.codigo === cod)
          const a = base.find((x) => x.codigo === cod)
          const esp = a ? especieDe(a) : l[0] ? especieDe(l[0]) : '—'
          const comun = a?.nombre_comun ?? l[0]?.nombre_comun
          return (
            <div key={cod} className="flex items-center gap-2 text-[12.5px]">
              <span className="w-9 shrink-0 tabular-nums text-suave">{cod}</span>
              <button onClick={() => abrir(esp)} className="min-w-0 flex-1 truncate text-left text-tinta hover:text-bosque hover:underline">
                {comun ?? esp}<span className="italic text-suave"> · {esp}</span>
              </button>
              {l.length ? <>
                <span title="Floración"><TiraMeses celdas={celdasMes(l, 'flor')} color={COLOR.florLineal} meses={meses} /></span>
                <span title="Fruto maduro"><TiraMeses celdas={celdasMes(l, 'fruto_maduro')} color={COLOR.frutoLineal} meses={meses} /></span>
              </> : <span className="text-tenue">sin monitoreo</span>}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-[11.5px] text-suave">Número de placa del árbol. Primera tira: floración; segunda: fruto maduro.</p>
    </div>
  )
}

// ─── Clima ───────────────────────────────────────────────────────────────────

function Clima({ c }: { c: Ctx }) {
  const g = useMemo(() => c.climaDe(new Set([...c.arboles.map(clave), ...c.ms.map(clave)])), [c])
  if (!g) return <p className="py-8 text-center text-[14px] text-suave">El clima no está disponible en este momento.</p>
  const ll = mesesLluviosos(g.meses)
  return (
    <section>
      <p className="mb-4 max-w-2xl text-[14px] text-suave">
        Lluvia y temperatura promedio donde están los árboles{c.predio ? ` de ${c.predio}` : ''} ({c.periodoClima}). Llueve todo el año, unos {n(lluviaAnual(g.meses))} mm;
        los meses más lluviosos son {ll.meses.map((i) => MESES_LARGOS[i]).join(', ')}.
      </p>
      <div className="rounded-2xl border border-linea p-2 sm:p-4">
        <Climograma meses={g.meses} lluviosos={ll.meses} />
      </div>
      <p className="mt-2 text-[12px] text-suave">Fuente: Open-Meteo (reanálisis ERA5 / ECMWF IFS, CC BY 4.0), promedio de {g.celdas} celda(s) de unos 7 km.</p>
    </section>
  )
}

// ─── Ficha de una especie ────────────────────────────────────────────────────

function Ficha({ e, c, cerrar }: { e: ResumenEspecie; c: Ctx; cerrar: () => void }) {
  const [modoClima, setModoClima] = useState<'no' | 'integrado' | 'al-lado'>('integrado')
  useEffect(() => {
    const k = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cerrar() }
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [cerrar])

  // Igual que la ficha de la intranet (VistaFicha): clima de donde están sus árboles
  // (los de la base y los monitoreados), sin intensidad, mismo pie de figura.
  const ms = c.porEspecie.get(e.especie) ?? []
  const g = c.climaDe(new Set([...c.arboles.filter((a) => especieDe(a) === e.especie).map(clave), ...ms.map(clave)]))
  const clima = modoClima !== 'no' && g ? g.meses : null
  const rondas = [...new Set(ms.map((m) => m.ronda))].sort()
  const pie = `Monitoreo fenológico RAS – ${c.zona}${c.predio ? `, ${c.predio}` : ''}: ${e.arboles} árbol(es), ${e.rondas} ronda(s) (${rondas.map(etiquetaRonda).join(', ')}).` +
    `${e.preliminar ? ' Calendario preliminar.' : ''}` +
    (clima && g ? ` Clima: Open-Meteo (reanálisis ERA5 / ECMWF IFS, CC BY 4.0), promedio ${c.periodoClima}, ponderado por árbol en ${g.celdas} celda(s) de ~7 km (${g.arboles} árboles).` : '')
  const meses = (xs: number[]) => xs.length ? xs.map((i) => MESES_LARGOS[i]).join(', ') : 'ninguno todavía'
  const flor = e.flor.flatMap((x, i) => (x && x.media > 0 ? [i] : []))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={cerrar}>
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-t-3xl bg-[#fff] p-5 shadow-xl sm:rounded-3xl sm:p-6" onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-titulo text-[1.6rem] font-semibold leading-tight text-tinta">{nombre(e)}</h2>
            <p className="text-[13px] text-suave"><em>{e.especie}</em>{e.familia && ` · ${e.familia}`}</p>
            {e.comunes.length > 1 && <p className="text-[12.5px] text-suave">También: {e.comunes.slice(1).join(', ')}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {g && (
              <select value={modoClima} onChange={(ev) => setModoClima(ev.target.value as typeof modoClima)} aria-label="Clima" className={SELECT}>
                <option value="no">Sin clima</option>
                <option value="integrado">Clima en el círculo</option>
                <option value="al-lado">Climograma al lado</option>
              </select>
            )}
            <button onClick={cerrar} aria-label="Cerrar" className="rounded-full border border-linea p-2 text-tinta transition hover:border-bosque hover:bg-bosque hover:text-white"><X size={18} /></button>
          </div>
        </div>

        <div className={`grid gap-5 ${modoClima === 'al-lado' && clima ? 'lg:grid-cols-2' : 'md:grid-cols-[1.25fr_1fr] md:items-center'}`}>
          <CalendarioCircular e={e} intensidad={false} clima={modoClima === 'integrado' ? clima : null} pie={pie} />
          <div className="space-y-5">
            {modoClima === 'al-lado' && clima && (
              <div className="rounded-2xl border border-linea p-2">
                <Climograma meses={clima} lluviosos={mesesLluviosos(clima).meses} titulo="Clima donde están sus árboles" />
              </div>
            )}
            <dl className="grid gap-3 text-[14px] sm:grid-cols-2 lg:grid-cols-1">
              <Dato t="Meses con flor">{meses(flor)}</Dato>
              <Dato t="Meses con fruto maduro">{meses(e.ventana)}</Dato>
              {e.pico !== null && <Dato t="Mejor mes para recolectar">{MESES_LARGOS[e.pico]}</Dato>}
              <Dato t="Árboles monitoreados">{e.arboles} en {e.predios.length} {e.predios.length === 1 ? 'predio' : 'predios'}</Dato>
              {g && <Dato t="Lluvia anual donde están sus árboles">{n(lluviaAnual(g.meses))} mm</Dato>}
            </dl>
            {e.preliminar && <p className="text-[12.5px] text-suave">Dato preliminar: pocos árboles o menos de un año de monitoreo.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Dato({ t, children }: { t: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-suave">{t}</dt>
      <dd className="text-tinta">{children}</dd>
    </div>
  )
}
