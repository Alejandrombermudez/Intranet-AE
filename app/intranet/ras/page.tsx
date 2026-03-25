'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Leaf, Trees, ShieldCheck, ChevronRight, Loader2 } from 'lucide-react'

const PRIMARY = '#0d7377'

export default function RASHubPage() {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase
        .from('user_profiles').select('is_admin, department').eq('email', user.email).single()
      if (!profile?.is_admin && profile?.department !== 'RAS') { router.push('/'); return }
      setAuthReady(true)
    })
  }, [router])

  if (!authReady) {
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
        <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/intranet"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-primary hover:text-primary hover:bg-primary/5 transition-all shrink-0">
              <ArrowLeft size={16} />
              <span className="hidden sm:block">Intranet</span>
            </Link>
            <div className="text-center flex-1">
              <div className="inline-flex items-center gap-2 mb-0.5">
                <Leaf size={20} className="text-primary" />
                <h1 className="text-2xl font-black text-stone-900 tracking-tight">Módulo RAS</h1>
              </div>
              <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">
                Restauración Ambiental y Social
              </p>
            </div>
            <div className="w-[92px]" />
          </div>
        </div>
      </header>

      {/* ── Cards ── */}
      <main className="max-w-4xl mx-auto px-4 py-12 sm:px-6">
        <p className="text-center text-stone-500 text-sm font-semibold mb-8 uppercase tracking-widest">
          Selecciona un módulo
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Siembra */}
          <Link href="/intranet/ras/siembra"
            className="group bg-white rounded-2xl border-2 border-stone-200 shadow-md hover:border-primary hover:shadow-xl transition-all p-8 flex flex-col gap-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: '#0d737715' }}>
              <Trees size={28} style={{ color: PRIMARY }} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-stone-900 mb-1">Restauración / Siembra</h2>
              <p className="text-sm text-stone-500 leading-relaxed">
                Familias vinculadas a procesos de restauración activa: siembra de plántulas, monitoreos de supervivencia y cámaras trampa.
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm font-bold transition-colors text-stone-400 group-hover:text-primary">
              Ver familias <ChevronRight size={15} />
            </div>
          </Link>

          {/* Conservación */}
          <Link href="/intranet/ras/conservacion"
            className="group bg-white rounded-2xl border-2 border-stone-200 shadow-md hover:border-primary hover:shadow-xl transition-all p-8 flex flex-col gap-5">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: '#0d737715' }}>
              <ShieldCheck size={28} style={{ color: PRIMARY }} />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-black text-stone-900 mb-1">Conservación</h2>
              <p className="text-sm text-stone-500 leading-relaxed">
                Familias bajo acuerdos y figuras de conservación: polígonos protegidos, árboles semilleros, especies nativas y cámaras trampa.
              </p>
            </div>
            <div className="flex items-center gap-1 text-sm font-bold transition-colors text-stone-400 group-hover:text-primary">
              Ver familias <ChevronRight size={15} />
            </div>
          </Link>

        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-4 py-8 sm:px-6 text-center text-stone-500 text-sm">
        <p className="font-semibold">© {new Date().getFullYear()} Amazonia Emprende — Todos los derechos reservados</p>
      </footer>
    </div>
  )
}
