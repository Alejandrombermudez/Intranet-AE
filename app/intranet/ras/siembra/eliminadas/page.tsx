'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Loader2, Trees, MapPin, CalendarDays,
  Trash2, AlertTriangle, RotateCcw, Archive,
} from 'lucide-react'

const PRIMARY = '#0d7377'

interface Familia {
  id: string
  nombre_propietario: string
  municipio: string
  vereda: string | null
  nombre_finca: string | null
  ha_restauracion: number | null
  created_at: string
  deleted_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export default function FamiliasEliminadasPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [familias, setFamilias] = useState<Familia[]>([])
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [confirmHardId, setConfirmHardId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

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
        .schema('siembra')
        .from('familias')
        .select('id, nombre_propietario, municipio, vereda, nombre_finca, ha_restauracion, created_at, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      setFamilias((data ?? []) as Familia[])
      setLoading(false)
    }
    init()
  }, [router])

  const handleRestore = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetch(`/api/ras/familias/${id}/restaurar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken ?? ''}` },
      })
      if (res.ok) {
        setFamilias((prev) => prev.filter((f) => f.id !== id))
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Error al restaurar la familia.')
      }
    } finally {
      setProcessingId(null)
    }
  }

  const handleHardDelete = async (id: string) => {
    setProcessingId(id)
    try {
      const res = await fetch(`/api/ras/familias/${id}?hard=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken ?? ''}` },
      })
      if (res.ok) {
        setFamilias((prev) => prev.filter((f) => f.id !== id))
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Error al eliminar definitivamente la familia.')
      }
    } finally {
      setProcessingId(null)
      setConfirmHardId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 size={36} className="animate-spin" style={{ color: PRIMARY }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-red-50/30 to-stone-100">

      {/* Header */}
      <header className="bg-white shadow-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/intranet/ras/siembra"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-stone-400 transition-all shrink-0">
              <ArrowLeft size={16} />
              <span className="hidden sm:block">Siembra</span>
            </Link>

            <div className="text-center flex-1">
              <div className="inline-flex items-center gap-2 mb-0.5">
                <Archive size={20} className="text-red-400" />
                <h1 className="text-2xl font-black text-stone-900 tracking-tight">Familias Eliminadas</h1>
              </div>
              <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">
                Pendientes de eliminación definitiva
              </p>
            </div>

            <div className="w-32 shrink-0" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* Banner */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-8 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800 text-sm mb-1">
              {familias.length} {familias.length === 1 ? 'familia eliminada' : 'familias eliminadas'}
            </p>
            <p className="text-xs text-red-600">
              Estas familias fueron movidas aquí. Puedes restaurarlas o eliminarlas definitivamente.
              La eliminación definitiva borra todos los datos y archivos asociados sin posibilidad de recuperación.
            </p>
          </div>
        </div>

        {familias.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-stone-400 gap-4">
            <div className="w-20 h-20 rounded-3xl bg-stone-100 flex items-center justify-center">
              <Archive size={40} className="text-stone-300" />
            </div>
            <p className="text-xl font-black text-stone-600">Sin familias eliminadas</p>
            <p className="text-sm text-center max-w-xs text-stone-500">
              No hay familias en la papelera. Las familias que elimines aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    {['Propietario / Finca', 'Municipio', 'Vereda', 'Eliminada el', 'Acciones'].map((h, i) => (
                      <th key={i} className="px-4 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {familias.map((f) => {
                    const isConfirming = confirmHardId === f.id
                    const isProcessing = processingId === f.id
                    return (
                      <tr key={f.id}
                        className={`border-b border-stone-100 transition-colors ${isConfirming ? 'bg-red-50' : 'hover:bg-stone-50'}`}>
                        <td className="px-4 py-3">
                          <p className="font-bold text-stone-700 text-sm">{f.nombre_propietario}</p>
                          {f.nombre_finca && (
                            <p className="text-xs text-stone-400 mt-0.5">{f.nombre_finca}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-sm text-stone-500">
                            <MapPin size={12} className="text-stone-400 shrink-0" /> {f.municipio}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-400">
                          {f.vereda ?? <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-red-400">
                            <CalendarDays size={11} /> {formatDate(f.deleted_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isConfirming ? (
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <AlertTriangle size={13} className="text-red-500 shrink-0" />
                              <span className="text-xs font-bold text-red-600">¿Eliminar definitivamente?</span>
                              <button onClick={() => setConfirmHardId(null)} disabled={isProcessing}
                                className="px-2 py-1 text-xs font-bold rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50">
                                No
                              </button>
                              <button onClick={() => handleHardDelete(f.id)} disabled={isProcessing}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                                {isProcessing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                                Sí, eliminar
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleRestore(f.id)} disabled={isProcessing}
                                className="flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-800 disabled:opacity-50 transition-colors"
                                title="Restaurar familia">
                                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={13} />}
                                Restaurar
                              </button>
                              <button onClick={() => setConfirmHardId(f.id)}
                                className="flex items-center gap-1 text-xs font-bold text-red-400 hover:text-red-600 transition-colors"
                                title="Eliminar definitivamente">
                                <Trash2 size={13} />
                                Eliminar
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
