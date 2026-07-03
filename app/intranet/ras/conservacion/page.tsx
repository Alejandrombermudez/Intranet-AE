'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Plus, Loader2, ShieldCheck, MapPin, Eye,
  CalendarDays, Trash2, AlertTriangle, Trees, Pencil, ImageOff, TreePine,
} from 'lucide-react'
import { fetchEspecies, fotoAleatoriaCatalogo } from '@/lib/catalogo'
import { fetchIndicadoresDeFamilias, type IndicadoresPredio } from '@/lib/ras-arboles'

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
  const [fotos, setFotos] = useState<Record<string, string>>({})
  const [fotosReales, setFotosReales] = useState<Record<string, boolean>>({})
  const [indicadores, setIndicadores] = useState<Record<string, IndicadoresPredio>>({})

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

      const fams = (data ?? []) as FamiliaConservacion[]
      setFamilias(fams)
      setLoading(false)

      if (fams.length === 0) return
      const ids = fams.map((f) => f.id)

      // Foto de familia/predio — una consulta batch, prioriza categoría "familia" sobre "predio"
      const { data: fotosData } = await supabase
        .schema('ras').from('fotos_predio')
        .select('familia_id, url, categoria')
        .in('familia_id', ids)
        .in('categoria', ['familia', 'predio'])
      if (fotosData) {
        const porFamilia: Record<string, { familia?: string; predio?: string }> = {}
        for (const fp of fotosData) {
          porFamilia[fp.familia_id] ??= {}
          if (fp.categoria === 'familia' && !porFamilia[fp.familia_id].familia) porFamilia[fp.familia_id].familia = fp.url
          if (fp.categoria === 'predio' && !porFamilia[fp.familia_id].predio) porFamilia[fp.familia_id].predio = fp.url
        }
        const fotoPorFamilia: Record<string, string> = {}
        const esReal: Record<string, boolean> = {}
        for (const [fid, v] of Object.entries(porFamilia)) {
          const url = v.familia ?? v.predio
          if (url) { fotoPorFamilia[fid] = url; esReal[fid] = true }
        }
        // Relleno: familias sin foto propia todavía muestran una foto del catálogo
        // (determinística por id) para que la tarjeta no se vea vacía.
        const especies = await fetchEspecies()
        for (const f of fams) {
          if (!fotoPorFamilia[f.id]) {
            const url = fotoAleatoriaCatalogo(especies, f.id)
            if (url) { fotoPorFamilia[f.id] = url; esReal[f.id] = false }
          }
        }
        setFotos(fotoPorFamilia)
        setFotosReales(esReal)
      }

      // Indicadores por predio (total de árboles + diversidad) — una consulta batch
      const indicadoresPorFamilia = await fetchIndicadoresDeFamilias(ids)
      setIndicadores(indicadoresPorFamilia)
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {familias.map((f) => {
              const isConfirming = confirmId === f.id
              const isDeleting = deletingId === f.id
              const ind = indicadores[f.id]
              return (
                <div key={f.id}
                  className={`group bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
                    isConfirming ? 'border-red-300' : 'border-stone-200 hover:shadow-md hover:border-primary'
                  }`}>
                  <div className="relative flex aspect-[2/1]">
                    <div className="w-1/2 bg-stone-100 overflow-hidden relative">
                      {fotos[f.id] ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fotos[f.id]} alt={f.nombre_propietario} className="w-full h-full object-cover" />
                          {!fotosReales[f.id] && (
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/50 text-white">
                              Muestra
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300">
                          <ImageOff size={22} />
                        </div>
                      )}
                    </div>

                    {/* Índices del predio — total de árboles + diversidad */}
                    <div className="w-1/2 border-l border-stone-200 bg-stone-50 flex flex-col items-center justify-center text-center px-2">
                      {ind?.arboles_semilleros ? (
                        <>
                          <p className="text-2xl font-black leading-none" style={{ color: PRIMARY }}>
                            {ind.arboles_semilleros.toLocaleString('es-CO')}
                          </p>
                          <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider mt-0.5">
                            árboles semilleros
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 mt-1.5 text-[10px] text-stone-500">
                            {ind.especies_forestales != null && <span>{ind.especies_forestales} especies</span>}
                            {ind.shannon_h != null && <span>H&apos; {ind.shannon_h}</span>}
                          </div>
                        </>
                      ) : (
                        <div className="text-stone-300">
                          <TreePine size={20} className="mx-auto mb-1" />
                          <p className="text-[10px]">Sin árboles aún</p>
                        </div>
                      )}
                    </div>

                    {/* Overlay de acciones — aparece al pasar el mouse sobre la tarjeta */}
                    <div className={`absolute inset-0 flex flex-col justify-between p-2.5 bg-gradient-to-b from-black/55 via-black/5 to-black/60 transition-opacity ${
                      isConfirming ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
                    }`}>
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/intranet/ras/conservacion/${f.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/95 text-stone-700 text-xs font-bold hover:bg-white shadow-sm transition-colors">
                          <Eye size={12} /> Ver
                        </Link>
                        <Link href={`/intranet/ras/conservacion/${f.id}/editar`}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/95 text-stone-700 text-xs font-bold hover:bg-white shadow-sm transition-colors">
                          <Pencil size={12} /> Editar
                        </Link>
                      </div>

                      {isConfirming ? (
                        <div className="flex items-center justify-center gap-1.5 bg-white/95 rounded-lg p-1.5 shadow-sm">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 pl-1">
                            <AlertTriangle size={12} /> ¿Eliminar?
                          </span>
                          <button onClick={() => setConfirmId(null)} disabled={isDeleting}
                            className="px-2 py-1 text-[11px] font-bold rounded-md border border-stone-300 text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50">
                            No
                          </button>
                          <button onClick={() => handleDelete(f.id)} disabled={isDeleting}
                            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50">
                            {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                            Sí
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmId(f.id)}
                          className="flex items-center justify-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 shadow-sm transition-colors">
                          <Trash2 size={13} /> Eliminar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="font-bold text-stone-900 text-sm truncate">{f.nombre_propietario}</p>
                    {f.nombre_finca && <p className="text-xs text-stone-400 truncate">{f.nombre_finca}</p>}

                    <div className="flex items-center gap-1 text-xs text-stone-500 mt-2">
                      <MapPin size={11} className="text-stone-400 shrink-0" />
                      <span className="truncate">{f.municipio}{f.vereda ? ` · ${f.vereda}` : ''}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {f.ha_bosque != null && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
                          <Trees size={11} /> {f.ha_bosque} ha
                        </span>
                      )}
                      {f.acuerdo_conservacion != null && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${
                          f.acuerdo_conservacion ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'
                        }`}>
                          Acuerdo: {f.acuerdo_conservacion ? 'Sí' : 'No'}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-1 text-xs text-stone-400">
                      <CalendarDays size={11} /> {formatDate(f.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 text-center text-stone-500 text-sm">
        <p className="font-semibold">© {new Date().getFullYear()} Amazonia Emprende — Todos los derechos reservados</p>
      </footer>
    </div>
  )
}
