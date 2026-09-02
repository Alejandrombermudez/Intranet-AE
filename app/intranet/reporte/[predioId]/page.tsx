'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Expediente } from '@/app/api/reporte/expediente/route'
import InformeExpediente from '@/app/components/InformeExpediente'
import { ArrowLeft, Printer, Loader2, AlertTriangle } from 'lucide-react'

/**
 * Expediente completo de un predio. Esta página sólo resuelve el acceso y
 * trae los datos; dibujar el informe es cosa de `InformeExpediente`.
 */
export default function ExpedientePage() {
  const router = useRouter()
  const { predioId } = useParams<{ predioId: string }>()
  const [email, setEmail] = useState<string | null>(null)
  const [exp, setExp] = useState<Expediente | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: p } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department, can_access_intranet')
        .eq('email', user.email).single()
      if (!p?.is_admin && !p?.can_access_intranet && !p?.department) { router.push('/'); return }
      setEmail(user.email ?? null)
    })
  }, [router])

  useEffect(() => {
    if (!email || !predioId) return
    fetch(`/api/reporte/expediente?predio_id=${predioId}&email=${encodeURIComponent(email)}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Error')
        return r.json()
      })
      .then((d: Expediente) => { setExp(d); setCargando(false) })
      .catch((e: Error) => { setError(e.message); setCargando(false) })
  }, [email, predioId])

  if (cargando) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: '#f4f1ea' }}>
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-3" size={26} style={{ color: '#2f3f32' }} />
          <p className="text-[11px] uppercase tracking-[.16em]" style={{ color: '#7d7669' }}>Armando el expediente…</p>
        </div>
      </div>
    )
  }

  if (error || !exp) {
    return (
      <div className="min-h-screen grid place-items-center p-6" style={{ background: '#f4f1ea' }}>
        <div className="text-center max-w-sm">
          <AlertTriangle className="mx-auto mb-3" size={26} style={{ color: '#7e5f3b' }} />
          <p className="font-bold text-stone-800 mb-1">No se pudo generar el informe</p>
          <p className="text-sm text-stone-500 mb-4">{error ?? 'Predio no encontrado'}</p>
          <Link href="/intranet/reporte" className="text-[11px] uppercase tracking-[.16em] hover:underline" style={{ color: '#2f3f32' }}>
            Volver al listado
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen print:bg-white" style={{ background: '#ddd6c8' }}>
      {/* ── Barra de acciones. Discreta a propósito: el protagonista es el
             documento, no la interfaz. No se imprime. ── */}
      <div className="print:hidden sticky top-0 z-20 border-b"
        style={{ background: '#f4f1ea', borderColor: '#d8d1c4' }}>
        <div className="max-w-[60rem] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link href="/intranet/reporte"
            className="flex items-center gap-2 text-[11px] uppercase tracking-[.16em] hover:opacity-70 transition-opacity"
            style={{ color: '#7d7669' }}>
            <ArrowLeft size={14} /> Predios
          </Link>
          <p className="text-[11px] uppercase tracking-[.16em] truncate" style={{ color: '#7d7669' }}>
            {exp.predio.nombre_predio ?? 'Predio'}
          </p>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-[11px] uppercase tracking-[.16em] transition-opacity hover:opacity-85"
            style={{ background: '#2f3f32', color: '#f4f1ea' }}>
            <Printer size={14} /> <span className="hidden sm:inline">Imprimir / PDF</span>
          </button>
        </div>
      </div>

      <InformeExpediente exp={exp} />
    </div>
  )
}
