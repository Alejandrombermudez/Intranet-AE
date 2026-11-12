'use client'

/**
 * /intranet/ras/fenologia — calendarios fenológicos de los árboles semilleros.
 *
 * Lee ras.monitoreos_semilleros (app de semilleros + los de Kobo), la base de
 * árboles de la app y el clima de referencia, por /api/ras/fenologia. Todo lo
 * demás se calcula aquí (lib/fenologia.ts). Sigue el criterio técnico de
 * restauración: calendario lineal, mapa de calor, calendario circular por
 * especie, clima integrado, índices de Fournier y de actividad.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, CalendarRange, CloudRain, Flower2, Grid3x3, LayoutDashboard, MapPinned } from 'lucide-react'
import { Aviso, Cabecera, Cargando, Contenido, Pestanas, Vacio } from '@/app/components/marca'
import { fetchConSesion } from '@/lib/fetch-sesion'
import {
  climaCompleto, etiquetaRonda, mesesLluviosos, resumenEspecies,
  type Arbol, type Clima, type Foto, type Monitoreo,
} from '@/lib/fenologia'
import {
  VistaCalendario, VistaClima, VistaEspecie, VistaIndices, VistaMapaCalor, VistaPredios, VistaResumen,
  type Contexto,
} from './vistas'

type Datos = { monitoreos: Monitoreo[]; arboles: Arbol[]; fotos: Foto[]; clima: Clima[]; pendiente: string[] }
type Tab = 'resumen' | 'calendario' | 'calor' | 'especie' | 'predios' | 'indices' | 'clima'

export default function FenologiaPage() {
  const router = useRouter()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('resumen')
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

  useEffect(() => { cargar() }, [cargar])

  const nucleos = useMemo(() => {
    if (!datos) return []
    return [...new Set([...datos.monitoreos.map((m) => m.nucleo), ...datos.arboles.map((a) => a.nucleo)])].sort()
  }, [datos])
  const nuc = nucleo || nucleos[0] || 'Solano'

  const ctx: Contexto | null = useMemo(() => {
    if (!datos) return null
    const ms = datos.monitoreos.filter((m) =>
      m.nucleo === nuc && (!predio || m.predio === predio) && (!origen || m.origen === origen) && (!anio || m.ronda.startsWith(anio)))
    const arboles = datos.arboles.filter((a) => a.nucleo === nuc && (!predio || a.predio === predio))
    const clima = datos.clima.find((c) => c.nucleo === nuc) ?? null
    const rondas = [...new Set(ms.map((m) => m.ronda))].sort()
    const { meses: lluviosos, criterio } = mesesLluviosos(clima)
    const nArboles = new Set(ms.map((m) => m.codigo)).size
    const pie = `Fuente: monitoreo fenológico RAS – ${nuc}${predio ? `, predio ${predio}` : ''} (${origen === 'kobo' ? 'Kobo' : origen === 'app' ? 'app de semilleros' : 'app de semilleros y Kobo'}); ` +
      `${rondas.length ? `rondas ${etiquetaRonda(rondas[0])} a ${etiquetaRonda(rondas[rondas.length - 1])}` : 'sin rondas'}; ${nArboles} árboles, ${ms.length} monitoreos. ` +
      `Intensidad: índice de Fournier (promedio del % de copa).` +
      (clima?.fuente ? ` Clima: ${clima.fuente}${clima.estacion ? `, ${clima.estacion}` : ''}${clima.periodo ? `, ${clima.periodo}` : ''}.` : '')
    return {
      ms, arboles, fotos: datos.fotos, clima, climaListo: climaCompleto(clima), lluviosos, criterioLluvia: criterio,
      rondas, especies: resumenEspecies(ms), pie, nucleo: nuc,
    }
  }, [datos, nuc, predio, origen, anio])

  if (error) return <Cargando texto={error} />
  if (!datos || !ctx) return <Cargando texto="Cargando la fenología…" />

  const predios = [...new Set([...datos.arboles.filter((a) => a.nucleo === nuc).map((a) => a.predio), ...datos.monitoreos.filter((m) => m.nucleo === nuc).map((m) => m.predio)])].sort()
  const anios = [...new Set(datos.monitoreos.map((m) => m.ronda.slice(0, 4)))].sort()
  const irEspecie = (e: string) => { setEspecie(e); setTab('especie'); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const TABS: { id: Tab; label: string; icono: React.ReactNode }[] = [
    { id: 'resumen', label: 'Resumen', icono: <LayoutDashboard size={14} /> },
    { id: 'calendario', label: 'Calendario', icono: <CalendarRange size={14} /> },
    { id: 'calor', label: 'Mapa de calor', icono: <Grid3x3 size={14} /> },
    { id: 'especie', label: 'Por especie', icono: <Flower2 size={14} /> },
    { id: 'predios', label: 'Predios', icono: <MapPinned size={14} /> },
    { id: 'indices', label: 'Índices', icono: <Activity size={14} /> },
    { id: 'clima', label: 'Clima', icono: <CloudRain size={14} /> },
  ]
  const sel = 'rounded-full border border-linea/80 bg-white px-3 py-1.5 text-[13px] text-tinta'

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        volver={{ href: '/intranet/ras', label: 'RAS' }}
        modulo="Conservación · Red de Árboles Semilleros"
        titulo="Fenología"
        descripcion="Cuándo florece y cuándo da fruto cada especie monitoreada: ventanas de recolección de semilla, calendarios por especie y por predio, y su relación con la lluvia."
        cifras={[
          { n: ctx.ms.length.toLocaleString('es-CO'), l: 'monitoreos' },
          { n: String(new Set(ctx.ms.map((m) => m.codigo)).size), l: 'árboles monitoreados' },
          { n: String(ctx.especies.length), l: 'especies' },
          { n: String(new Set(ctx.ms.map((m) => m.predio)).size), l: 'predios' },
          { n: String(ctx.rondas.length), l: 'rondas' },
        ]}
        pie={<Pestanas tono="oscuro" items={TABS.map((t) => ({ ...t, activa: tab === t.id, onClick: () => setTab(t.id) }))} />}
      />
      <Contenido>
        <div className="mb-8 flex flex-wrap items-center gap-2">
          {nucleos.length > 1 && (
            <select value={nuc} onChange={(e) => { setNucleo(e.target.value); setPredio('') }} className={sel}>
              {nucleos.map((n) => <option key={n}>{n}</option>)}
            </select>
          )}
          <select value={predio} onChange={(e) => setPredio(e.target.value)} className={sel}>
            <option value="">Todos los predios</option>
            {predios.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select value={origen} onChange={(e) => setOrigen(e.target.value as typeof origen)} className={sel}>
            <option value="">App y Kobo</option>
            <option value="app">Solo app</option>
            <option value="kobo">Solo Kobo</option>
          </select>
          {anios.length > 1 && (
            <select value={anio} onChange={(e) => setAnio(e.target.value)} className={sel}>
              <option value="">Todos los años</option>
              {anios.map((a) => <option key={a}>{a}</option>)}
            </select>
          )}
          {(predio || origen || anio) && (
            <button onClick={() => { setPredio(''); setOrigen(''); setAnio('') }} className="px-2 text-[12.5px] text-suave underline">Quitar filtros</button>
          )}
        </div>

        {datos.pendiente.includes('arboles') && (
          <Aviso tono="arcilla" titulo="Falta correr la migración de fenología" className="mb-6">
            Sin <code>docs/sql/migration_fenologia_intranet.sql</code> y su carga, la pantalla no sabe la vereda, la coordenada ni cuántos árboles tiene cada predio.
          </Aviso>
        )}

        {datos.monitoreos.length === 0 && tab !== 'clima' ? (
          <Vacio>
            Todavía no hay monitoreos en la base. Los 1.329 de Kobo (abril–agosto de 2026) entran con la carga de la migración de fenología; los nuevos llegan solos desde la app de semilleros.
          </Vacio>
        ) : ctx.ms.length === 0 && tab !== 'clima' ? (
          <Vacio>Ningún monitoreo con estos filtros.</Vacio>
        ) : (
          <>
            {tab === 'resumen' && <VistaResumen c={ctx} irEspecie={irEspecie} />}
            {tab === 'calendario' && <VistaCalendario c={ctx} />}
            {tab === 'calor' && <VistaMapaCalor c={ctx} />}
            {tab === 'especie' && <VistaEspecie c={ctx} especie={especie} setEspecie={setEspecie} />}
            {tab === 'predios' && <VistaPredios c={ctx} irEspecie={irEspecie} />}
            {tab === 'indices' && <VistaIndices c={ctx} />}
            {tab === 'clima' && <VistaClima key={nuc} c={ctx} pendiente={datos.pendiente.includes('clima')} alGuardar={cargar} />}
          </>
        )}
      </Contenido>
    </div>
  )
}
