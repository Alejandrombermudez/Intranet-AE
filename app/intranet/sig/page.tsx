'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { SigWorklistRow } from '@/app/api/sig/worklist/route'
import {
  Map as MapIcon, ArrowLeft, Search, Loader2, ChevronRight, MapPin, Layers,
  Hexagon, Sprout, ClipboardCheck, HelpCircle, X, Info,
} from 'lucide-react'

const fmt = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 })

// ─── Las 4 fases del trabajo del SIG ─────────────────────────────────────────
// El eje real no es la etapa del expediente sino qué cartografía falta.
type Fase = SigWorklistRow['fase']

const FASES: { id: Fase; label: string; ayuda: string; cls: string; activo: string }[] = [
  { id: 'sin_cartografia',  label: 'Sin cartografía',   ayuda: 'No tienen ni el polígono del predio',        cls: 'text-rose-600 bg-rose-50 border-rose-100',       activo: 'ring-rose-400 bg-rose-100' },
  { id: 'solo_predio',      label: 'Falta zonificar',   ayuda: 'Ya tienen predio, faltan zonas de siembra',  cls: 'text-amber-600 bg-amber-50 border-amber-100',    activo: 'ring-amber-400 bg-amber-100' },
  { id: 'listo_para_campo', label: 'Listo para campo',  ayuda: 'Predio y zonas cargadas, sin enviar',        cls: 'text-sky-600 bg-sky-50 border-sky-100',          activo: 'ring-sky-400 bg-sky-100' },
  { id: 'en_campo',         label: 'En campo',          ayuda: 'Ya lo está trabajando el equipo de terreno', cls: 'text-emerald-600 bg-emerald-50 border-emerald-100', activo: 'ring-emerald-400 bg-emerald-100' },
]
const faseDe = (f: Fase) => FASES.find(x => x.id === f)!

export default function SigPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [rows, setRows] = useState<SigWorklistRow[]>([])
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda]   = useState('')
  const [fase, setFase]           = useState<Fase | null>(null)
  const [municipio, setMunicipio] = useState('')
  const [zonaAe, setZonaAe]       = useState('')
  const [ayuda, setAyuda]         = useState(false)
  const [tope, setTope]           = useState(40)   // no volcar 111 filas de golpe

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: p } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department, can_access_intranet')
        .eq('email', user.email)
        .single()
      if (!p?.is_admin && !p?.can_access_intranet && !p?.department) { router.push('/'); return }
      setUserEmail(user.email ?? null)
      setAuthReady(true)
    })
  }, [router])

  useEffect(() => {
    if (!authReady || !userEmail) return
    fetch(`/api/sig/worklist?email=${encodeURIComponent(userEmail)}`)
      .then(r => r.json())
      .then((data: SigWorklistRow[]) => { setRows(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [authReady, userEmail])

  const conteos = useMemo(() => {
    const c: Record<Fase, number> = { sin_cartografia: 0, solo_predio: 0, listo_para_campo: 0, en_campo: 0 }
    for (const r of rows) c[r.fase]++
    return c
  }, [rows])

  const municipios = useMemo(
    () => [...new Set(rows.map(r => r.municipio).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  )
  const zonas = useMemo(
    () => [...new Set(rows.map(r => r.zona_ae).filter((z): z is string => !!z))].sort((a, b) => a.localeCompare(b)),
    [rows],
  )

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const filtrados = rows.filter(r => {
      if (fase && r.fase !== fase) return false
      if (municipio && r.municipio !== municipio) return false
      if (zonaAe && r.zona_ae !== zonaAe) return false
      if (!q) return true
      return r.nombre_completo.toLowerCase().includes(q)
        || (r.nombre_predio ?? '').toLowerCase().includes(q)
        || (r.matricula_inmobiliaria ?? '').toLowerCase().includes(q)
        || r.municipio.toLowerCase().includes(q)
        || (r.vereda ?? '').toLowerCase().includes(q)
    })
    // Primero los que ya tienen trabajo encima: son los pocos que hay que
    // mirar. El grueso sin cartografía es la bolsa de pendientes y se llega a
    // ella por su tarjeta, no invadiendo la vista de entrada.
    const orden: Record<Fase, number> = { en_campo: 0, listo_para_campo: 1, solo_predio: 2, sin_cartografia: 3 }
    return filtrados.sort((a, b) =>
      orden[a.fase] - orden[b.fase] ||
      a.municipio.localeCompare(b.municipio) ||
      (a.nombre_predio ?? '').localeCompare(b.nombre_predio ?? ''),
    )
  }, [rows, busqueda, fase, municipio, zonaAe])

  const hayFiltro = !!(fase || municipio || zonaAe || busqueda.trim())
  const limpiar = () => { setFase(null); setMunicipio(''); setZonaAe(''); setBusqueda(''); setTope(40) }
  const mostrados = visibles.slice(0, tope)

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="animate-spin text-stone-400" size={32} /></div>
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/intranet" title="Volver a la intranet" className="text-stone-400 hover:text-stone-700 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <MapIcon size={18} className="text-teal-600" />
            <div>
              <h1 className="text-xl font-black text-stone-900">Módulo SIG</h1>
              <p className="text-sm text-stone-400">{rows.length} predios · cola de trabajo cartográfico</p>
            </div>
          </div>
          <button onClick={() => setAyuda(a => !a)}
            className="flex items-center gap-1.5 text-xs font-bold text-stone-400 hover:text-stone-700 transition-colors">
            <HelpCircle size={15} /> ¿Qué significa cada cosa?
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {ayuda && (
          <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3 text-sm text-stone-600">
            <div className="flex items-start justify-between gap-3">
              <p className="font-black text-stone-800">Cómo leer este tablero</p>
              <button onClick={() => setAyuda(false)} className="text-stone-300 hover:text-stone-600"><X size={16} /></button>
            </div>
            <ul className="space-y-1.5 leading-relaxed">
              <li>· <strong>Predio</strong> = el polígono de la finca (el .zip del lindero). <strong>Zonas</strong> = los sitios de siembra dentro de ella.</li>
              <li>· Un predio solo puede enviarse a Campo cuando tiene <strong>al menos una zona de siembra</strong>.</li>
              <li>· <strong>Área medida</strong> es la que calcula PostGIS sobre el shapefile que subiste. Es la real.</li>
              <li>· <strong>Área registral</strong> es la que dice la escritura o el certificado de tradición, y la captura Jurídica a mano en el expediente — <em>no</em> sale del shapefile. Por eso hay predios con área registral y sin cartografía, y por eso las dos cifras casi nunca coinciden exactamente.</li>
              <li>· Si las dos difieren mucho, vale revisar: suele ser diferencia entre lo escriturado y lo realmente ocupado.</li>
            </ul>
          </div>
        )}

        {/* Fases — son los filtros principales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {FASES.map(f => {
            const activo = fase === f.id
            return (
              <button key={f.id} onClick={() => setFase(activo ? null : f.id)}
                className={`text-left rounded-2xl border px-4 py-3 transition-all ${f.cls} ${activo ? `ring-2 ${f.activo}` : 'hover:brightness-95'}`}>
                <p className="text-2xl font-black leading-none">{conteos[f.id]}</p>
                <p className="text-sm font-bold mt-1">{f.label}</p>
                <p className="text-[11px] opacity-70 leading-snug mt-0.5">{f.ayuda}</p>
              </button>
            )
          })}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por persona, predio, matrícula, municipio o vereda…"
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors"
            />
          </div>
          <select value={municipio} onChange={e => setMunicipio(e.target.value)}
            className="px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400">
            <option value="">Todos los municipios</option>
            {municipios.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {zonas.length > 0 && (
            <select value={zonaAe} onChange={e => setZonaAe(e.target.value)}
              className="px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400">
              <option value="">Todas las zonas AE</option>
              {zonas.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          )}
          {hayFiltro && (
            <button onClick={limpiar} className="flex items-center gap-1 px-3 py-2.5 text-xs font-bold text-stone-500 hover:text-stone-800">
              <X size={13} /> Limpiar
            </button>
          )}
        </div>

        <p className="text-xs text-stone-400">
          {visibles.length === rows.length
            ? `${rows.length} predios · primero los que ya tienen cartografía o están en campo`
            : `${visibles.length} de ${rows.length} predios`}
        </p>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-stone-300" size={36} /></div>
        ) : visibles.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <Layers size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">{rows.length === 0 ? 'Aún no hay predios en SIG' : 'Ningún predio coincide con el filtro'}</p>
            {hayFiltro && <button onClick={limpiar} className="text-sm text-teal-600 font-bold mt-2 hover:underline">Quitar filtros</button>}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-100 divide-y divide-stone-50">
            {mostrados.map(r => {
              const f = faseDe(r.fase)
              return (
                <Link key={r.predio_id} href={`/intranet/sig/${r.predio_id}`}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-stone-50/70 transition-colors group">

                  {/* Identidad */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-stone-900 truncate">{r.nombre_predio || <span className="text-stone-300 font-normal">(predio sin nombre)</span>}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${f.cls}`}>{f.label}</span>
                    </div>
                    <p className="text-xs text-stone-500 truncate">{r.nombre_completo}</p>
                    <p className="text-xs text-stone-400 truncate flex items-center gap-1">
                      <MapPin size={10} />{r.municipio}{r.vereda && ` · ${r.vereda}`}
                      {r.matricula_inmobiliaria && ` · Mat. ${r.matricula_inmobiliaria}`}
                    </p>
                  </div>

                  {/* Qué cartografía tiene */}
                  <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                    <span title={r.tiene_finca ? 'Polígono del predio cargado' : 'Falta el polígono del predio'}
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${r.tiene_finca ? 'bg-teal-50 text-teal-700' : 'bg-stone-100 text-stone-400'}`}>
                      <Hexagon size={11} /> Predio
                    </span>
                    <span title={`${r.n_zonas_siembra} zona(s) de siembra`}
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${r.n_zonas_siembra > 0 ? 'bg-teal-50 text-teal-700' : 'bg-stone-100 text-stone-400'}`}>
                      <Sprout size={11} /> {r.n_zonas_siembra > 0 ? `${r.n_zonas_siembra} zona${r.n_zonas_siembra > 1 ? 's' : ''}` : 'Sin zonas'}
                    </span>
                    {r.n_descartadas > 0 && (
                      <span title="Zonas que campo marcó como no aptas"
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-rose-50 text-rose-600">
                        {r.n_descartadas} desc.
                      </span>
                    )}
                    {(r.tiene_eval_campo || r.tiene_encuesta || r.n_revisiones > 0) && (
                      <span title="Campo ya devolvió información"
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                        <ClipboardCheck size={11} /> Campo
                      </span>
                    )}
                  </div>

                  {/* Áreas */}
                  <div className="hidden md:block text-right shrink-0 w-28">
                    {r.ha_finca != null
                      ? <p className="text-sm font-bold text-stone-800">{fmt(r.ha_finca)} ha</p>
                      : <p className="text-sm text-stone-300">sin medir</p>}
                    <p className="text-[11px] text-stone-400">
                      {r.area_registral != null ? `${fmt(Number(r.area_registral))} ha registral` : 'sin área registral'}
                    </p>
                  </div>

                  <ChevronRight size={16} className="text-stone-300 group-hover:text-teal-600 transition-colors shrink-0" />
                </Link>
              )
            })}

            {visibles.length > mostrados.length && (
              <button onClick={() => setTope(t => t + 60)}
                className="w-full py-3 text-sm font-bold text-teal-600 hover:bg-stone-50 transition-colors">
                Ver {Math.min(60, visibles.length - mostrados.length)} predios más
                <span className="text-stone-400 font-normal"> ({visibles.length - mostrados.length} restantes)</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-start gap-2 text-[11px] text-stone-400 px-1">
          <Info size={13} className="shrink-0 mt-0.5" />
          <p>
            La cifra grande es el <strong>área medida</strong> sobre el shapefile; la pequeña es el <strong>área registral</strong>
            que Jurídica captura de la escritura. Son dos fuentes distintas y no tienen por qué coincidir.
          </p>
        </div>
      </div>
    </div>
  )
}
