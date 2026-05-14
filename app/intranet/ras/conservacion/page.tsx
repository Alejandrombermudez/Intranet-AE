'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Plus, Loader2, ShieldCheck, MapPin,
  CalendarDays, ChevronRight, Trash2, AlertTriangle, Trees, Pencil,
} from 'lucide-react'

const PRIMARY = '#0d7377'

interface FamiliaConservacion {
  id: string
  nombre_propietario: string
  municipio: string
  vereda: string | null
  nombre_finca: string | null
  ha_bosque: number | null
  acuerdo_conservacion: boolean | null
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function ConservacionListPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [familias, setFamilias] = useState<FamiliaConservacion[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/ras/conservacion/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken ?? ''}` },
      })
      if (res.ok) {
        setFamilias((prev) => prev.filter((f) => f.id !== id))
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Error al eliminar el registro.')
      }
    } finally {
      setDeletingId(null)
      setConfirmId(null)
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department')
        .eq('email', user.email)
        .single()

      if (!profile?.is_admin && profile?.department !== 'RAS') {
        router.push('/'); return
      }

      const { data: { session } } = await supabase.auth.getSession()
      setAccessToken(session?.access_token ?? null)

      const { data } = await supabase
        .schema('ras')
        .from('familias')
        .select('id, nombre_propietario, municipio, vereda, nombre_finca, ha_bosque, acuerdo_conservacion, created_at')
        .order('created_at', { ascending: false })

      setFamilias(data ?? [])
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 size={36} className="text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">

      {/* ── Header ── */}
      <header className="bg-white shadow-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/intranet/ras"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-primary hover:text-primary hover:bg-primary/5 transition-all shrink-0">
              <ArrowLeft size={16} />
              <span className="hidden sm:block">Módulo RAS</span>
            </Link>

            <div className="text-center flex-1">
              <div className="inline-flex items-center gap-2 mb-0.5">
                <ShieldCheck size={20} className="text-primary" />
                <h1 className="text-2xl font-black text-stone-900 tracking-tight">Conservación</h1>
              </div>
              <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">
                Familias en Conservación
              </p>
            </div>

            <Link href="/intranet/ras/conservacion/nueva"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all shrink-0 shadow-sm hover:shadow-md"
              style={{ backgroundColor: PRIMARY }}>
              <Plus size={16} />
              <span className="hidden sm:block">Nueva Familia</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* Banner resumen */}
        <div className="bg-primary text-white rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex items-start gap-4">
            <ShieldCheck size={36} className="text-white/80 shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-black mb-1">Familias Registradas</h2>
              <p className="text-white/70 text-sm">
                <span className="font-black text-white text-lg">{familias.length}</span>{' '}
                {familias.length === 1 ? 'familia vinculada' : 'familias vinculadas'} a acuerdos de conservación.
              </p>
            </div>
          </div>
        </div>

        {/* Lista / Estado vacío */}
        {familias.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-stone-400 gap-4">
            <div className="w-20 h-20 rounded-3xl bg-stone-100 flex items-center justify-center">
              <ShieldCheck size={40} className="text-stone-300" />
            </div>
            <p className="text-xl font-black text-stone-600">Sin familias registradas</p>
            <p className="text-sm text-center max-w-xs">
              Aún no hay familias en el sistema. Crea el primer registro usando el botón{' '}
              <strong>Nueva Familia</strong>.
            </p>
            <Link href="/intranet/ras/conservacion/nueva"
              className="mt-2 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all"
              style={{ backgroundColor: PRIMARY }}>
              <Plus size={16} /> Nueva Familia
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    {['Propietario / Finca', 'Municipio', 'Vereda', 'Ha. Bosque', 'Acuerdo', 'Registrado', 'Acciones'].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {familias.map((f) => {
                    const isConfirming = confirmId === f.id
                    const isDeleting = deletingId === f.id
                    return (
                      <tr key={f.id}
                        className={`border-b border-stone-100 transition-colors ${isConfirming ? 'bg-red-50' : 'hover:bg-stone-50'}`}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-stone-900 text-sm">{f.nombre_propietario}</p>
                          {f.nombre_finca && (
                            <p className="text-xs text-stone-400 mt-0.5">{f.nombre_finca}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-sm text-stone-600">
                            <MapPin size={12} className="text-stone-400 shrink-0" /> {f.municipio}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-500">
                          {f.vereda ?? <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {f.ha_bosque != null ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                              <Trees size={11} /> {f.ha_bosque} ha
                            </span>
                          ) : <span className="text-stone-300 text-sm">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {f.acuerdo_conservacion != null ? (
                            <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${
                              f.acuerdo_conservacion
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-stone-100 text-stone-500'
                            }`}>
                              {f.acuerdo_conservacion ? 'Sí' : 'No'}
                            </span>
                          ) : <span className="text-stone-300 text-sm">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                            <CalendarDays size={11} /> {formatDate(f.created_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isConfirming ? (
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <AlertTriangle size={13} className="text-red-500 shrink-0" />
                              <span className="text-xs font-bold text-red-600">¿Eliminar?</span>
                              <button onClick={() => setConfirmId(null)} disabled={isDeleting}
                                className="px-2 py-1 text-xs font-bold rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50">
                                No
                              </button>
                              <button onClick={() => handleDelete(f.id)} disabled={isDeleting}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                                {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                Sí
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <Link href={`/intranet/ras/conservacion/${f.id}`}
                                className="flex items-center gap-1 text-xs font-bold text-stone-400 hover:text-primary transition-colors">
                                Ver <ChevronRight size={13} />
                              </Link>
                              <Link href={`/intranet/ras/conservacion/${f.id}/editar`}
                                className="text-stone-300 hover:text-primary transition-colors"
                                title="Editar registro">
                                <Pencil size={14} />
                              </Link>
                              <button onClick={() => setConfirmId(f.id)}
                                className="text-stone-300 hover:text-red-500 transition-colors"
                                title="Eliminar registro">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 text-center text-stone-500 text-sm">
        <p className="font-semibold">© {new Date().getFullYear()} Amazonia Emprende — Todos los derechos reservados</p>
      </footer>
    </div>
  )
}
