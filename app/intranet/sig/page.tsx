'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ExpedienteRow } from '@/lib/expedientes'
import {
  Map as MapIcon, ArrowLeft, Search, Loader2, ChevronRight, MapPin, Layers, Info,
} from 'lucide-react'

export default function SigPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [rows, setRows] = useState<ExpedienteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

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
      .then((data: ExpedienteRow[]) => {
        // SIG I: predios cuyo expediente está en la etapa sig_i
        setRows((Array.isArray(data) ? data : []).filter((r) => r.etapa === 'sig_i'))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [authReady, userEmail])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      r.nombre_completo.toLowerCase().includes(q) ||
      (r.nombre_predio ?? '').toLowerCase().includes(q) ||
      (r.matricula_inmobiliaria ?? '').toLowerCase().includes(q) ||
      r.municipio.toLowerCase().includes(q)
    )
  }, [rows, busqueda])

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="animate-spin text-stone-400" size={32} /></div>
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/intranet/expedientes" className="text-stone-400 hover:text-stone-700 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <MapIcon size={18} className="text-teal-600" />
            <div>
              <h1 className="text-xl font-black text-stone-900">Módulo SIG</h1>
              <p className="text-sm text-stone-400">SIG I — Zonas potenciales</p>
            </div>
          </div>
          <span className="text-sm font-bold text-stone-500">{rows.length} predios por zonificar</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Nota: carga de zonas (siguiente paso) */}
        <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
          <Info size={18} className="text-sky-500 shrink-0 mt-0.5" />
          <p className="text-sm text-sky-800">
            Estos predios fueron aprobados en jurídica y enviados a SIG. El siguiente paso es
            <strong> cargar el shapefile</strong> de cada uno para generar las zonas potenciales
            (se habilita al activar PostGIS).
          </p>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por persona, predio, matrícula o municipio…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors"
          />
        </div>

        {/* Lista de trabajo */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-stone-300" size={36} /></div>
        ) : visibles.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <Layers size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">{rows.length === 0 ? 'Aún no hay predios en SIG' : 'Ningún predio coincide con la búsqueda'}</p>
            {rows.length === 0 && <p className="text-sm mt-1">Llegan cuando jurídica los aprueba y los envía a SIG.</p>}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    {['Persona', 'Predio', 'Ubicación', 'Área registral', 'Zonas', ''].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[11px] font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((r) => (
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
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">sin cargar</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/intranet/juridica/${r.predio_id}`} className="inline-flex items-center gap-0.5 text-[11px] font-bold text-stone-400 hover:text-teal-600 transition-colors whitespace-nowrap">
                          Ver caso <ChevronRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
