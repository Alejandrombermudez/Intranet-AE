'use client'
/**
 * Vista pública de los calendarios fenológicos. A propósito más simple que la
 * de la intranet: fondo blanco, tres secciones (Especies, Mes a mes, Clima),
 * un buscador y un solo interruptor. El verde queda para los botones al pasar
 * el cursor; los gráficos son los mismos de la intranet (graficos.tsx).
 * Blanco con `bg-[#fff]` y no `bg-white`: la regla global de vidrio vuelve
 * crema (#fffdf9) toda tarjeta `bg-white`.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { CalendarioCircular, Climograma, TiraMeses } from '@/app/intranet/ras/fenologia/graficos'
import { COLOR, MESES, MESES_LARGOS, mesesLluviosos, type ResumenEspecie } from '@/lib/fenologia'
import type { EspeciePublica, FenologiaPublica } from '@/lib/fenologia-publica'

type Seccion = 'especies' | 'mes' | 'clima'

const BOTON = 'rounded-full border border-linea bg-[#fff] px-4 py-1.5 text-[13.5px] text-tinta transition hover:border-bosque hover:bg-bosque hover:text-white'
const ACTIVO = 'rounded-full border border-tinta bg-[#fff] px-4 py-1.5 text-[13.5px] font-medium text-tinta'
const n = (x: number) => x.toLocaleString('es-CO')

const nombre = (e: EspeciePublica) => e.comunes[0] ?? e.especie
const activa = (e: EspeciePublica) => e.orden < 99

export default function Fenologia({ datos }: { datos: FenologiaPublica | null }) {
  const [seccion, setSeccion] = useState<Seccion>('especies')
  const [abierta, setAbierta] = useState<EspeciePublica | null>(null)

  return (
    <div className="min-h-screen bg-[#fff]">
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6">
        <header className="mb-6">
          <p className="text-[11px] font-medium uppercase tracking-[.18em] text-suave">Amazonía Emprende · Red de Árboles Semilleros</p>
          <h1 className="mt-1 font-titulo text-[2rem] font-semibold leading-tight text-tinta">Calendarios fenológicos</h1>
          <p className="mt-2 max-w-2xl text-[14.5px] text-suave">
            Cuándo florece y cuándo da fruto cada especie de los árboles semilleros que monitoreamos cada mes. Sirve para saber en qué meses se puede recolectar semilla.
          </p>
        </header>

        {!datos ? (
          <p className="rounded-2xl border border-linea px-4 py-8 text-center text-[14px] text-suave">Los datos no están disponibles en este momento. Intente de nuevo más tarde.</p>
        ) : datos.especies.length === 0 ? (
          <p className="rounded-2xl border border-linea px-4 py-8 text-center text-[14px] text-suave">Todavía no hay monitoreos publicados.</p>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-linea bg-linea sm:grid-cols-4">
              <Cifra v={n(datos.especies.length)} t="especies" />
              <Cifra v={n(datos.arboles)} t="árboles semilleros" />
              <Cifra v={n(datos.predios)} t="predios" />
              <Cifra v={datos.periodo} t={`${datos.rondas} meses de monitoreo`} pequeno />
            </div>

            <nav className="mb-6 flex flex-wrap gap-2">
              {([['especies', 'Especies'], ['mes', 'Mes a mes'], ['clima', 'Clima']] as const).map(([k, t]) => (
                <button key={k} onClick={() => setSeccion(k)} className={seccion === k ? ACTIVO : BOTON}>{t}</button>
              ))}
            </nav>

            {seccion === 'especies' && <Especies d={datos} abrir={setAbierta} />}
            {seccion === 'mes' && <MesAMes d={datos} abrir={setAbierta} />}
            {seccion === 'clima' && <Clima d={datos} />}

            <p className="mt-10 border-t border-linea pt-4 text-[12px] leading-relaxed text-suave">
              Datos preliminares: {datos.rondas} meses de monitoreo ({datos.periodo}) en {datos.zonas.join(', ')}. Un mes sin monitoreo no quiere decir que la especie no tenga flor o fruto en ese mes;
              con más años de datos el calendario se completa. Fuente: monitoreo fenológico de la Red de Árboles Semilleros, Amazonía Emprende.
            </p>
          </>
        )}
      </div>
      {abierta && datos && <Ficha e={abierta} d={datos} cerrar={() => setAbierta(null)} />}
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

// ─── Especies ────────────────────────────────────────────────────────────────

function Especies({ d, abrir }: { d: FenologiaPublica; abrir: (e: EspeciePublica) => void }) {
  const [q, setQ] = useState('')
  const [todas, setTodas] = useState(false)
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
    return d.especies.filter((e) => (todas || activa(e)) &&
      (!t || [e.especie, ...e.comunes, e.familia ?? ''].join(' ').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes(t)))
  }, [d, q, todas])
  const conActividad = d.especies.filter(activa).length

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar especie…" aria-label="Buscar especie"
          className="min-w-0 flex-1 rounded-full border border-linea bg-[#fff] px-4 py-2 text-[14px] text-tinta outline-none focus:border-tinta sm:max-w-xs" />
        <button onClick={() => setTodas(!todas)} className={BOTON}>
          {todas ? `Solo con flor o fruto (${conActividad})` : `Ver todas (${d.especies.length})`}
        </button>
      </div>
      <div className="mb-3"><Leyenda /></div>

      {lista.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-suave">Ninguna especie con ese nombre.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-linea">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-4 border-b border-linea px-4 py-2 text-[11px] text-suave sm:grid">
            <span>Especie</span>
            <span className="flex gap-[3px]">{d.meses.map((i) => <span key={i} className="flex-1 text-center">{MESES[i]}</span>)}</span>
          </div>
          <ul>
            {lista.map((e) => (
              <li key={e.especie} className="border-b border-linea last:border-0">
                <button onClick={() => abrir(e)} className="group grid w-full gap-2 px-4 py-3 text-left transition hover:bg-bosque/[.06] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center sm:gap-4">
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium text-tinta group-hover:text-bosque">{nombre(e)}</span>
                    <span className="block truncate text-[12px] italic text-suave">{e.especie} · {e.arboles} {e.arboles === 1 ? 'árbol' : 'árboles'}</span>
                  </span>
                  <span className="space-y-1">
                    <span className="flex sm:hidden gap-[3px] text-[10px] text-suave">{d.meses.map((i) => <span key={i} className="flex-1 text-center">{MESES[i]}</span>)}</span>
                    <TiraMeses celdas={e.flor} color={COLOR.florLineal} meses={d.meses} grande />
                    <TiraMeses celdas={e.fruto} color={COLOR.frutoLineal} meses={d.meses} grande />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!todas && conActividad < d.especies.length && (
        <p className="mt-3 text-[12.5px] text-suave">{d.especies.length - conActividad} especies no han mostrado flor ni fruto en estos meses; aparecen con «Ver todas».</p>
      )}
    </section>
  )
}

// ─── Mes a mes ───────────────────────────────────────────────────────────────

function MesAMes({ d, abrir }: { d: FenologiaPublica; abrir: (e: EspeciePublica) => void }) {
  const [mes, setMes] = useState(d.meses[d.meses.length - 1] ?? 0)
  const monitoreado = d.meses.includes(mes)
  const enFlor = d.especies.filter((e) => (e.flor[mes]?.media ?? 0) > 0)
  const conFruto = d.especies.filter((e) => (e.maduro[mes]?.media ?? 0) > 0)
  const fruto = d.especies.filter((e) => (e.fruto[mes]?.media ?? 0) > 0 && !conFruto.includes(e))

  return (
    <section>
      <div className="mb-5 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {MESES.map((m, i) => (
          <button key={m} onClick={() => setMes(i)}
            title={d.meses.includes(i) ? undefined : 'Sin monitoreo todavía'}
            className={`rounded-xl border py-2 text-[13px] transition ${mes === i ? 'border-tinta font-medium' : 'border-linea hover:border-bosque hover:bg-bosque hover:text-white'} ${d.meses.includes(i) ? 'text-tinta' : 'text-tenue'}`}>
            {m}
          </button>
        ))}
      </div>

      <h2 className="mb-1 font-titulo text-[1.35rem] font-semibold capitalize text-tinta">{MESES_LARGOS[mes]}</h2>
      {!monitoreado ? (
        <p className="py-6 text-[14px] text-suave">Este mes todavía no se ha monitoreado. Hay datos de: {d.meses.map((i) => MESES_LARGOS[i]).join(', ')}.</p>
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

function Grupo({ titulo, ayuda, color, xs, abrir }: { titulo: string; ayuda: string; color: string; xs: EspeciePublica[]; abrir: (e: EspeciePublica) => void }) {
  return (
    <div className="rounded-2xl border border-linea p-4">
      <p className="flex items-center gap-2 text-[14px] font-medium text-tinta"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />{titulo} <span className="text-suave">· {xs.length}</span></p>
      <p className="mb-3 text-[12px] text-suave">{ayuda}</p>
      {xs.length === 0 ? <p className="text-[13px] text-suave">Ninguna.</p> : (
        <ul className="space-y-0.5">
          {xs.map((e) => (
            <li key={e.especie}>
              <button onClick={() => abrir(e)} className="w-full rounded-lg px-2 py-1 text-left text-[13.5px] text-tinta transition hover:bg-bosque hover:text-white">
                {nombre(e)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Clima ───────────────────────────────────────────────────────────────────

function Clima({ d }: { d: FenologiaPublica }) {
  if (!d.clima) return <p className="py-8 text-center text-[14px] text-suave">El clima no está disponible en este momento.</p>
  const ll = mesesLluviosos(d.clima.meses)
  const total = d.clima.meses.reduce((s, m) => s + (m.precip_mm ?? 0), 0)
  return (
    <section>
      <p className="mb-4 max-w-2xl text-[14px] text-suave">
        Lluvia y temperatura promedio donde están los árboles ({d.clima.periodo}). Llueve todo el año, unos {n(Math.round(total))} mm;
        los meses más lluviosos son {ll.meses.map((i) => MESES_LARGOS[i]).join(', ')}.
      </p>
      <div className="rounded-2xl border border-linea p-2 sm:p-4">
        <Climograma meses={d.clima.meses} lluviosos={ll.meses} />
      </div>
      <p className="mt-2 text-[12px] text-suave">Fuente: reanálisis climático de Open-Meteo (celdas de unos 7 km).</p>
    </section>
  )
}

// ─── Ficha de una especie ────────────────────────────────────────────────────

function Ficha({ e, d, cerrar }: { e: EspeciePublica; d: FenologiaPublica; cerrar: () => void }) {
  useEffect(() => {
    const k = (ev: KeyboardEvent) => { if (ev.key === 'Escape') cerrar() }
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [cerrar])

  const meses = (xs: number[]) => xs.length ? xs.map((i) => MESES_LARGOS[i]).join(', ') : 'ninguno todavía'
  const flor = e.flor.flatMap((c, i) => (c && c.media > 0 ? [i] : []))
  const resumen = { ...e, predios: [] } as ResumenEspecie

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={cerrar}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-[#fff] p-5 shadow-xl sm:rounded-3xl sm:p-6" onClick={(ev) => ev.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-titulo text-[1.6rem] font-semibold leading-tight text-tinta">{nombre(e)}</h2>
            <p className="text-[13px] text-suave"><em>{e.especie}</em>{e.familia && ` · ${e.familia}`}</p>
            {e.comunes.length > 1 && <p className="text-[12.5px] text-suave">También: {e.comunes.slice(1).join(', ')}</p>}
          </div>
          <button onClick={cerrar} aria-label="Cerrar" className="rounded-full border border-linea p-2 text-tinta transition hover:border-bosque hover:bg-bosque hover:text-white"><X size={18} /></button>
        </div>

        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr] md:items-center">
          <CalendarioCircular e={resumen} intensidad clima={null} />
          <dl className="space-y-3 text-[14px]">
            <Dato t="Meses con flor">{meses(flor)}</Dato>
            <Dato t="Meses con fruto maduro">{meses(e.ventana)}</Dato>
            {e.pico !== null && <Dato t="Mejor mes para recolectar">{MESES_LARGOS[e.pico]}</Dato>}
            <Dato t="Árboles monitoreados">{e.arboles} en {e.nPredios} {e.nPredios === 1 ? 'predio' : 'predios'}</Dato>
            {e.preliminar && <p className="text-[12.5px] text-suave">Dato preliminar: pocos árboles o menos de un año de monitoreo.</p>}
          </dl>
        </div>
        <p className="mt-4 text-[12px] text-suave">Monitoreado {d.periodo}. Los meses sin monitoreo aparecen rayados.</p>
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
