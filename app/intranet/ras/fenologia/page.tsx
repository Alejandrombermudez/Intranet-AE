'use client'

/**
 * /intranet/ras/fenologia — calendarios fenológicos de los árboles semilleros.
 *
 * Lee ras.monitoreos_semilleros (app de semilleros + los de Kobo) y la base de
 * árboles por /api/ras/fenologia, y el clima de Open-Meteo por coordenada de
 * árbol por /api/ras/fenologia/clima (aparte: si tarda o falla, lo demás
 * sigue). Los cálculos están en lib/fenologia.ts. Sigue el criterio técnico de
 * restauración: calendario lineal, mapa de calor, calendario circular por
 * especie, clima integrado, índices de Fournier y de actividad.
 *
 * Con abril–agosto de 2026 solamente, la mitad de las 79 especies no ha
 * mostrado flor ni fruto: por eso la vista de entrada filtra «con flor o
 * fruto» y dibuja solo los meses monitoreados (el año completo es una casilla).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, CloudRain, Flower2, LayoutGrid, MapPinned, Sprout } from 'lucide-react'
import { Aviso, Cabecera, Cargando, Contenido, Pestanas, Vacio } from '@/app/components/marca'
import { fetchConSesion } from '@/lib/fetch-sesion'
import {
  agrupar, climaPonderado, especieDe, estadoEn, etiquetaRonda, indiceCeldas, mesDe, resumenEspecies,
  type Arbol, type ClimaAbierto, type Estado, type Foto, type Monitoreo,
} from '@/lib/fenologia'
import {
  VistaClima, VistaEspecies, VistaFicha, VistaIndices, VistaPredios, VistaRecoleccion,
  type Contexto,
} from './vistas'

type Datos = { monitoreos: Monitoreo[]; arboles: Arbol[]; fotos: Foto[]; pendiente: string[] }
type Tab = 'especies' | 'recoleccion' | 'ficha' | 'predios' | 'clima' | 'indices'

export default function FenologiaPage() {
  const router = useRouter()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [clima, setClima] = useState<ClimaAbierto | null>(null)
  const [climaError, setClimaError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('especies')
  const [nucleo, setNucleo] = useState<string>('')
  const [predio, setPredio] = useState<string>('')
  const [origen, setOrigen] = useState<'' | 'app' | 'kobo'>('')
  const [anio, setAnio] = useState<string>('')
  const [especie, setEspecie] = useState<string | null>(null)

  const cargar = useCallback(() =>
    fetchConSesion('/api/ras/fenologia').then(async (r) => {
      if (r.status === 401 || r.status === 403) { router.push('/'); return }
      const j = await r.json().catch(() => ({ error: 'Respuesta inválida' }))
      if (!r.ok) { setError(j.error ?? 'No se pudieron traer los datos'); return }
      setDatos(j)
    }), [router])

  const cargarClima = useCallback(() =>
    fetchConSesion('/api/ras/fenologia/clima').then(async (r) => {
      const j = await r.json().catch(() => ({ error: 'Respuesta inválida' }))
      if (!r.ok) { setClimaError(j.error ?? 'No se pudo traer el clima'); return }
      setClima(j)
    }).catch(() => setClimaError('No se pudo traer el clima (sin conexión).')), [])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { cargarClima() }, [cargarClima])

  const nucleos = useMemo(() => {
    if (!datos) return []
    return [...new Set([...datos.monitoreos.map((m) => m.nucleo), ...datos.arboles.map((a) => a.nucleo)])].sort()
  }, [datos])
  const nuc = nucleo || nucleos[0] || 'Solano'
  const indiceClima = useMemo(() => indiceCeldas(clima), [clima])

  const ctx: Contexto | null = useMemo(() => {
    if (!datos) return null
    const ms = datos.monitoreos.filter((m) =>
      m.nucleo === nuc && (!predio || m.predio === predio) && (!origen || m.origen === origen) && (!anio || m.ronda.startsWith(anio)))
    const arboles = datos.arboles.filter((a) => a.nucleo === nuc && (!predio || a.predio === predio))
    const rondas = [...new Set(ms.map((m) => m.ronda))].sort()
    const ultima = rondas[rondas.length - 1]
    const especies = resumenEspecies(ms)
    const estado = new Map<string, Estado>()
    for (const [e, l] of agrupar(ms, especieDe)) estado.set(e, estadoEn(l, ultima))
    const protocolo = new Map<string, string>()
    for (const a of arboles) if (a.protocolo) protocolo.set(especieDe(a), a.protocolo)
    const nArboles = new Set(ms.map((m) => m.codigo)).size
    const pie = `Fuente: monitoreo fenológico RAS – ${nuc}${predio ? `, predio ${predio}` : ''} (${origen === 'kobo' ? 'Kobo' : origen === 'app' ? 'app de semilleros' : 'app de semilleros y Kobo'}); ` +
      `${rondas.length ? `rondas ${etiquetaRonda(rondas[0])} a ${etiquetaRonda(ultima)}` : 'sin rondas'}; ${nArboles} árboles, ${ms.length} monitoreos. ` +
      `Intensidad: índice de Fournier (promedio del % de copa).`
    return {
      ms, arboles, fotos: datos.fotos, rondas, ultima,
      mesesMonitoreados: [...new Set(ms.map((m) => mesDe(m) - 1))].sort((a, b) => a - b),
      especies, estado, protocolo, pie, nucleo: nuc,
      clima, climaError, indiceClima,
      climaDe: (claves) => climaPonderado(indiceClima, claves),
    }
  }, [datos, nuc, predio, origen, anio, clima, climaError, indiceClima])

  if (error) return <Cargando texto={error} />
  if (!datos || !ctx) return <Cargando texto="Cargando la fenología…" />

  const predios = [...new Set([...datos.arboles.filter((a) => a.nucleo === nuc).map((a) => a.predio), ...datos.monitoreos.filter((m) => m.nucleo === nuc).map((m) => m.predio)])].sort()
  const anios = [...new Set(datos.monitoreos.map((m) => m.ronda.slice(0, 4)))].sort()
  const hayKobo = datos.monitoreos.some((m) => m.origen === 'kobo')
  const hayApp = datos.monitoreos.some((m) => m.origen === 'app')
  const irEspecie = (e: string) => { setEspecie(e); setTab('ficha'); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const activas = ctx.especies.filter((e) => e.orden < 99).length

  const TABS: { id: Tab; label: string; icono: React.ReactNode }[] = [
    { id: 'especies', label: 'Especies', icono: <LayoutGrid size={14} /> },
    { id: 'recoleccion', label: 'Recolección', icono: <Sprout size={14} /> },
    { id: 'ficha', label: 'Ficha de especie', icono: <Flower2 size={14} /> },
    { id: 'predios', label: 'Predios', icono: <MapPinned size={14} /> },
    { id: 'clima', label: 'Clima', icono: <CloudRain size={14} /> },
    { id: 'indices', label: 'Índices y datos', icono: <Activity size={14} /> },
  ]
  const sel = 'rounded-full border border-linea/80 bg-white px-3 py-1.5 text-[13px] text-tinta'
  const hayFiltro = !!(predio || origen || anio)

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        volver={{ href: '/intranet/ras', label: 'RAS' }}
        modulo="Conservación · Red de Árboles Semilleros"
        titulo="Fenología"
        descripcion="Cuándo florece y cuándo da fruto cada especie monitoreada: ventanas de recolección de semilla, calendarios por especie y por predio, y su relación con la lluvia."
        cifras={[
          { n: ctx.ms.length.toLocaleString('es-CO'), l: 'monitoreos' },
          { n: String(new Set(ctx.ms.map((m) => m.codigo)).size), l: 'árboles' },
          { n: `${activas} / ${ctx.especies.length}`, l: 'especies con flor o fruto' },
          { n: String(new Set(ctx.ms.map((m) => m.predio)).size), l: 'predios' },
          { n: String(ctx.rondas.length), l: ctx.rondas.length ? `rondas · ${etiquetaRonda(ctx.rondas[0])} a ${etiquetaRonda(ctx.ultima!)}` : 'rondas' },
        ]}
        pie={<Pestanas tono="oscuro" items={TABS.map((t) => ({ ...t, activa: tab === t.id, onClick: () => setTab(t.id) }))} />}
      />
      <Contenido>
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {nucleos.length > 1 && (
            <select value={nuc} onChange={(e) => { setNucleo(e.target.value); setPredio('') }} className={sel}>
              {nucleos.map((n) => <option key={n}>{n}</option>)}
            </select>
          )}
          <select value={predio} onChange={(e) => setPredio(e.target.value)} className={sel} aria-label="Predio">
            <option value="">Todos los predios ({predios.length})</option>
            {predios.map((p) => <option key={p}>{p}</option>)}
          </select>
          {anios.length > 1 && (
            <select value={anio} onChange={(e) => setAnio(e.target.value)} className={sel} aria-label="Año">
              <option value="">Todos los años</option>
              {anios.map((a) => <option key={a}>{a}</option>)}
            </select>
          )}
          {hayKobo && hayApp && (
            <select value={origen} onChange={(e) => setOrigen(e.target.value as typeof origen)} className={sel} aria-label="Origen">
              <option value="">App y Kobo</option>
              <option value="app">Solo app</option>
              <option value="kobo">Solo Kobo</option>
            </select>
          )}
          {hayFiltro && (
            <button onClick={() => { setPredio(''); setOrigen(''); setAnio('') }} className="px-2 text-[12.5px] text-suave underline">Quitar filtros</button>
          )}
        </div>

        {datos.pendiente.includes('arboles') && (
          <Aviso tono="arcilla" titulo="Falta correr la migración de fenología" className="mb-6">
            Sin <code>docs/sql/migration_fenologia_intranet.sql</code> y su carga, la pantalla no sabe la vereda, la coordenada ni cuántos árboles tiene cada predio.
          </Aviso>
        )}

        {datos.monitoreos.length === 0 ? (
          <Vacio>Todavía no hay monitoreos en la base. Los nuevos llegan solos desde la app de semilleros.</Vacio>
        ) : ctx.ms.length === 0 ? (
          <Vacio>Ningún monitoreo con estos filtros.</Vacio>
        ) : (
          <>
            {tab === 'especies' && <VistaEspecies c={ctx} irEspecie={irEspecie} />}
            {tab === 'recoleccion' && <VistaRecoleccion c={ctx} irEspecie={irEspecie} />}
            {tab === 'ficha' && <VistaFicha c={ctx} especie={especie} setEspecie={setEspecie} />}
            {tab === 'predios' && <VistaPredios c={ctx} irEspecie={irEspecie} />}
            {tab === 'clima' && <VistaClima c={ctx} />}
            {tab === 'indices' && <VistaIndices c={ctx} />}
          </>
        )}
      </Contenido>
    </div>
  )
}
