'use client'

/**
 * EL SISTEMA — mapa del ecosistema
 *
 * Reemplaza al diagrama en PDF. La diferencia de fondo no es que sea interactivo:
 * es que las cifras se leen de la base cada vez que alguien abre la página, así
 * que no puede quedarse viejo por el lado de los números.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MARCA } from '@/lib/expediente-formato'
import type { Pulso } from '@/app/api/sistema/pulso/route'
import { TIPOGRAFIA } from './piezas'
import { MapaSistema } from './mapa-vista'
import { ArrowLeft, BookOpen, Loader2, RotateCcw } from 'lucide-react'

export default function SistemaPage() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState(false)
  const [pulso, setPulso] = useState<Pulso | null>(null)
  const [errorPulso, setErrorPulso] = useState<string | null>(null)

  const medir = useCallback(async () => {
    try {
      const r = await fetch('/api/sistema/pulso')
      setPulso((await r.json()) as Pulso)
      setErrorPulso(null)
    } catch {
      setErrorPulso('No se pudieron leer las cifras de la base.')
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: p } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department, can_access_intranet')
        .eq('email', user.email).single()
      if (!p?.is_admin && !p?.can_access_intranet && !p?.department) { router.push('/'); return }
      setAutorizado(true)
      await medir()
    })
  }, [router, medir])

  if (!autorizado) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: MARCA.papel }}>
        <Loader2 className="animate-spin" size={24} style={{ color: MARCA.bosque }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: MARCA.papel, fontFamily: TIPOGRAFIA.cuerpo }}>
      <Encabezado pulso={pulso} error={errorPulso} onRemedir={() => void medir()} />

      <main className="mx-auto max-w-[1500px] px-6 pb-24">
        <MapaSistema pulso={pulso} />
      </main>
    </div>
  )
}

// ─── Encabezado ───────────────────────────────────────────────────────────────

function Encabezado({
  pulso, error, onRemedir,
}: { pulso: Pulso | null; error: string | null; onRemedir: () => void }) {
  const hora = pulso
    ? new Date(pulso.medido).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur"
      style={{ borderColor: '#ddd5c7', background: 'rgba(244,241,234,.92)' }}
    >
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3">
        <Link
          href="/intranet"
          className="flex items-center gap-1.5 text-[12px] transition-opacity hover:opacity-60"
          style={{ color: '#6f675c' }}
        >
          <ArrowLeft size={15} /> Intranet
        </Link>

        <h1
          className="text-[19px]"
          style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}
        >
          El sistema
        </h1>

        <div className="ml-auto flex items-center gap-4">
          {error ? (
            <span className="text-[11px]" style={{ color: MARCA.marron }}>{error}</span>
          ) : (
            <button
              onClick={onRemedir}
              className="flex items-center gap-1.5 text-[11px] transition-opacity hover:opacity-60"
              style={{ color: '#8b8375' }}
              title="Volver a leer las cifras de la base"
            >
              <RotateCcw size={12} />
              {hora ? `cifras leídas a las ${hora}` : 'leyendo cifras…'}
            </button>
          )}

          <Link
            href="/intranet/sistema/documentacion"
            className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] transition-opacity hover:opacity-85"
            style={{ background: MARCA.bosque, color: MARCA.papel, fontFamily: TIPOGRAFIA.titulo, fontWeight: 600 }}
          >
            <BookOpen size={14} /> Documentación
          </Link>
        </div>
      </div>
    </header>
  )
}
