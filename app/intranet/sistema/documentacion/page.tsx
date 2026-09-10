'use client'

/**
 * DOCUMENTACIÓN — la bitácora del sistema y los documentos de fondo
 *
 * Tres cosas en una página:
 *   · La línea de tiempo: qué se decidió y qué cambió, en orden.
 *   · Los frentes abiertos: lo que hoy no funciona, dicho sin adornos.
 *   · Los documentos maestros, leídos del repositorio y mostrados aquí.
 *
 * Los documentos NO se copian a esta página: se leen de `docs/*.md` cada vez.
 * Corregir el archivo en el repositorio corrige lo que se ve aquí.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MARCA } from '@/lib/expediente-formato'
import { TIPOGRAFIA } from '../piezas'
import { Bitacora, Documentos } from './vista'
import { ArrowLeft, Loader2, Map as MapIcon } from 'lucide-react'

type Vista = 'bitacora' | 'documentos'

export default function DocumentacionPage() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState(false)
  const [vista, setVista] = useState<Vista>('bitacora')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: p } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department, can_access_intranet')
        .eq('email', user.email).single()
      if (!p?.is_admin && !p?.can_access_intranet && !p?.department) { router.push('/'); return }
      setAutorizado(true)
    })
  }, [router])

  if (!autorizado) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: MARCA.papel }}>
        <Loader2 className="animate-spin" size={24} style={{ color: MARCA.bosque }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: MARCA.papel, fontFamily: TIPOGRAFIA.cuerpo }}>
      <header
        className="sticky top-0 z-30 border-b backdrop-blur"
        style={{ borderColor: '#ddd5c7', background: 'rgba(244,241,234,.92)' }}
      >
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3">
          <Link
            href="/intranet/sistema"
            className="flex items-center gap-1.5 text-[12px] transition-opacity hover:opacity-60"
            style={{ color: '#6f675c' }}
          >
            <ArrowLeft size={15} /> El sistema
          </Link>
          <h1 className="text-[19px]" style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}>
            Documentación
          </h1>

          <div className="ml-auto flex items-center gap-1">
            {([['bitacora', 'Bitácora'], ['documentos', 'Documentos']] as [Vista, string][]).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className="rounded-full px-3.5 py-1.5 text-[12px] transition-colors"
                style={{
                  fontFamily: TIPOGRAFIA.titulo,
                  fontWeight: 600,
                  background: vista === v ? MARCA.bosque : 'transparent',
                  color: vista === v ? MARCA.papel : '#6f675c',
                }}
              >
                {l}
              </button>
            ))}
            <Link
              href="/intranet/sistema"
              className="ml-2 flex items-center gap-1.5 text-[12px] transition-opacity hover:opacity-60"
              style={{ color: MARCA.pizarra }}
            >
              <MapIcon size={14} /> Ver el mapa
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 pb-24">
        {vista === 'bitacora' ? <Bitacora /> : <Documentos />}
      </main>
    </div>
  )
}
