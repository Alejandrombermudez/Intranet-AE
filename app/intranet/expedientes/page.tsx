'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ExpedienteRow } from '@/lib/expedientes'
import {
  ESTADO_CONFIG, SEMAFORO_CONFIG, type EstadoAliado, type Semaforo,
} from '@/lib/juridica-schema'
import {
  LayoutGrid, ArrowLeft, Search, Loader2, ChevronRight, X, MapPin, FileText,
} from 'lucide-react'

// ─── Configuración de etapas del proceso ──────────────────────────────────────

const ETAPA_ORDER = ['juridica', 'sig_i', 'campo', 'sig_ii', 'plan', 'juridica_ii', 'ejecucion', 'archivado'] as const
const ETAPA_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  juridica:    { label: 'Jurídica',    bg: 'bg-teal-50',    text: 'text-teal-700',    dot: 'bg-teal-500' },
  sig_i:       { label: 'SIG I',       bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-500' },
  campo:       { label: 'Campo',       bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  sig_ii:      { label: 'SIG II',      bg: 'bg-indigo-50',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  plan:        { label: 'Plan',        bg: 'bg-violet-50',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  juridica_ii: { label: 'Jurídica II', bg: 'bg-cyan-50',    text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  ejecucion:   { label: 'Ejecución',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  archivado:   { label: 'Archivado',   bg: 'bg-stone-100',  text: 'text-stone-500',   dot: 'bg-stone-400' },
}
const etapaLabel = (e: string | null) => (e && ETAPA_CONFIG[e]?.label) || '— sin expediente'

type GroupBy = 'etapa' | 'dd_estado' | 'municipio' | 'ninguno'
const GROUP_LABELS: Record<GroupBy, string> = {
  etapa: 'Etapa del proceso', dd_estado: 'Estado jurídico', municipio: 'Municipio', ninguno: 'Sin agrupar',
}

const SELECT = 'text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-400 transition-colors'

// ─── Página ────────────────────────────────────────────────────────────────────

export default function ExpedientesPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [rows, setRows] = useState<ExpedienteRow[]>([])
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda] = useState('')
  const [fEtapa, setFEtapa] = useState('')
  const [fDD, setFDD] = useState('')
  const [fSemaforo, setFSemaforo] = useState('')
  const [fMunicipio, setFMunicipio] = useState('')
  const [fLinea, setFLinea] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('etapa')

  // Auth (admin, acceso a intranet o con departamento)
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
    fetch(`/api/expedientes?email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((data) => { setRows(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [authReady, userEmail])

  const municipios = useMemo(
    () => [...new Set(rows.map((r) => r.municipio).filter(Boolean))].sort(),
    [rows]
  )

  // Conteo por etapa (sobre el total, sirve de navegación)
  const conteoEtapa = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) { const k = r.etapa ?? 'sin'; m[k] = (m[k] ?? 0) + 1 }
    return m
  }, [rows])

  const visibles = useMemo(() => {
    let list = rows
    const q = busqueda.trim().toLowerCase()
    if (q) {
      list = list.filter((r) =>
        r.nombre_completo.toLowerCase().includes(q) ||
        r.numero_documento.toLowerCase().includes(q) ||
        (r.nombre_predio ?? '').toLowerCase().includes(q) ||
        (r.matricula_inmobiliaria ?? '').toLowerCase().includes(q) ||
        r.municipio.toLowerCase().includes(q)
      )
    }
    if (fEtapa)     list = list.filter((r) => (r.etapa ?? '') === fEtapa)
    if (fDD)        list = list.filter((r) => r.dd_estado === fDD)
    if (fSemaforo)  list = list.filter((r) => (r.semaforo ?? '') === fSemaforo)
    if (fMunicipio) list = list.filter((r) => r.municipio === fMunicipio)
    if (fLinea)     list = list.filter((r) => (r.linea ?? '') === fLinea)
    return list
  }, [rows, busqueda, fEtapa, fDD, fSemaforo, fMunicipio, fLinea])

  // Agrupación
  const grupos = useMemo(() => {
    if (groupBy === 'ninguno') return [{ key: 'todos', label: `${visibles.length} predios`, items: visibles }]
    const map = new Map<string, ExpedienteRow[]>()
    for (const r of visibles) {
      const key = groupBy === 'etapa' ? (r.etapa ?? 'sin')
        : groupBy === 'dd_estado' ? r.dd_estado
        : r.municipio
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    }
    const entries = [...map.entries()]
    if (groupBy === 'etapa') {
      entries.sort((a, b) => ETAPA_ORDER.indexOf(a[0] as never) - ETAPA_ORDER.indexOf(b[0] as never))
    } else {
      entries.sort((a, b) => b[1].length - a[1].length)
    }
    return entries.map(([key, items]) => ({
      key,
      label: groupBy === 'etapa' ? etapaLabel(key === 'sin' ? null : key)
        : groupBy === 'dd_estado' ? (ESTADO_CONFIG[key as EstadoAliado]?.label ?? key)
        : key,
      items,
    }))
  }, [visibles, groupBy])

  const hayFiltros = busqueda || fEtapa || fDD || fSemaforo || fMunicipio || fLinea
  const limpiar = () => { setBusqueda(''); setFEtapa(''); setFDD(''); setFSemaforo(''); setFMunicipio(''); setFLinea('') }

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="animate-spin text-stone-400" size={32} /></div>
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/intranet/juridica" className="text-stone-400 hover:text-stone-700 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <LayoutGrid size={18} className="text-teal-600" />
            <div>
              <h1 className="text-xl font-black text-stone-900">Tablero de predios</h1>
              <p className="text-sm text-stone-400">¿En qué etapa va cada predio?</p>
            </div>
          </div>
          <span className="text-sm font-bold text-stone-500">{rows.length} predios</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Resumen por etapa (clic para filtrar) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {ETAPA_ORDER.map((e) => {
            const cfg = ETAPA_CONFIG[e]
            const n = conteoEtapa[e] ?? 0
            const activo = fEtapa === e
            return (
              <button key={e}
                onClick={() => setFEtapa(activo ? '' : e)}
                className={`text-left rounded-xl border p-3 transition-all ${activo ? 'border-teal-400 ring-1 ring-teal-200' : 'border-stone-100 hover:border-stone-300'} bg-white`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-[11px] font-bold text-stone-500 truncate">{cfg.label}</span>
                </div>
                <p className="text-2xl font-black text-stone-900">{n}</p>
              </button>
            )
          })}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-stone-100 p-4 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por persona, documento, predio, matrícula o municipio…"
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-400 shrink-0">Agrupar por</span>
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className={SELECT}>
                {(Object.keys(GROUP_LABELS) as GroupBy[]).map((g) => <option key={g} value={g}>{GROUP_LABELS[g]}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <select value={fEtapa} onChange={(e) => setFEtapa(e.target.value)} className={SELECT}>
              <option value="">Etapa: todas</option>
              {ETAPA_ORDER.map((e) => <option key={e} value={e}>{ETAPA_CONFIG[e].label}</option>)}
            </select>
            <select value={fDD} onChange={(e) => setFDD(e.target.value)} className={SELECT}>
              <option value="">Estado jurídico: todos</option>
              {(['borrador', 'antecedentes_ok', 'juridico_ok', 'aprobado', 'rechazado'] as EstadoAliado[]).map((s) =>
                <option key={s} value={s}>{ESTADO_CONFIG[s].label}</option>)}
            </select>
            <select value={fSemaforo} onChange={(e) => setFSemaforo(e.target.value)} className={SELECT}>
              <option value="">Semáforo: todos</option>
              {(['verde', 'amarillo', 'naranja', 'rojo'] as Semaforo[]).map((s) =>
                <option key={s} value={s}>{SEMAFORO_CONFIG[s].label}</option>)}
            </select>
            <select value={fMunicipio} onChange={(e) => setFMunicipio(e.target.value)} className={SELECT}>
              <option value="">Municipio: todos</option>
              {municipios.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={fLinea} onChange={(e) => setFLinea(e.target.value)} className={SELECT}>
              <option value="">Línea: todas</option>
              <option value="restauracion">Restauración</option>
              <option value="conservacion">Conservación</option>
              <option value="ambas">Ambas</option>
            </select>
            {hayFiltros && (
              <button onClick={limpiar} className="flex items-center gap-1 text-xs font-bold text-stone-400 hover:text-red-500 transition-colors px-2">
                <X size={13} /> Limpiar
              </button>
            )}
          </div>
        </div>

        {/* Resultados */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-stone-300" size={36} /></div>
        ) : visibles.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <FileText size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">{rows.length === 0 ? 'Aún no hay predios registrados' : 'Ningún predio coincide con el filtro'}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grupos.map((g) => (
              <div key={g.key}>
                {groupBy !== 'ninguno' && (
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <h2 className="text-sm font-black text-stone-700">{g.label}</h2>
                    <span className="text-xs font-bold text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{g.items.length}</span>
                  </div>
                )}
                <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-100">
                          {['Persona', 'Predio', 'Ubicación', 'Área', 'Etapa', 'Estado jurídico', 'Semáforo', ''].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-[11px] font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((r) => {
                          const ddCfg = ESTADO_CONFIG[r.dd_estado as EstadoAliado]
                          const semCfg = r.semaforo ? SEMAFORO_CONFIG[r.semaforo as Semaforo] : null
                          const etCfg = r.etapa ? ETAPA_CONFIG[r.etapa] : null
                          return (
                            <tr key={r.predio_id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/60 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-bold text-stone-900">{r.nombre_completo}</p>
                                <p className="text-xs text-stone-400">{r.tipo_documento} {r.numero_documento}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-stone-700">{r.nombre_predio ?? <span className="text-stone-300">—</span>}</p>
                                {r.matricula_inmobiliaria && <p className="text-xs text-stone-400">Mat. {r.matricula_inmobiliaria}</p>}
                              </td>
                              <td className="px-4 py-3 text-stone-600 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1"><MapPin size={11} className="text-stone-400" />{r.municipio}</span>
                                {r.vereda && <p className="text-xs text-stone-400 ml-4">{r.vereda}</p>}
                              </td>
                              <td className="px-4 py-3 text-stone-600 whitespace-nowrap">{r.area_registral != null ? `${r.area_registral} ha` : <span className="text-stone-300">—</span>}</td>
                              <td className="px-4 py-3">
                                {etCfg ? (
                                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${etCfg.bg} ${etCfg.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${etCfg.dot}`} />{etCfg.label}
                                  </span>
                                ) : <span className="text-stone-300 text-xs">sin expediente</span>}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ddCfg?.bg ?? 'bg-stone-100'} ${ddCfg?.text ?? 'text-stone-500'}`}>{ddCfg?.label ?? r.dd_estado}</span>
                              </td>
                              <td className="px-4 py-3">
                                {semCfg ? (
                                  <span className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${semCfg.dot}`} /><span className={`text-xs font-bold ${semCfg.color}`}>{semCfg.label}</span></span>
                                ) : <span className="text-stone-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Link href={`/intranet/juridica/${r.predio_id}`} className="inline-flex items-center gap-0.5 text-[11px] font-bold text-stone-400 hover:text-teal-600 transition-colors whitespace-nowrap">
                                  Ver <ChevronRight size={12} />
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
