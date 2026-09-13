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
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MARCA } from '@/lib/expediente-formato'
import { TIPOGRAFIA } from '../piezas'
import { Boton, Cabecera, Cargando, Pestanas } from '@/app/components/marca'
import { Bitacora, Documentos } from './vista'
import { Map as MapIcon } from 'lucide-react'

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

  if (!autorizado) return <Cargando texto="Cargando la documentación…" />

  return (
    <div className="min-h-screen" style={{ background: MARCA.papel, fontFamily: TIPOGRAFIA.cuerpo }}>
      <Cabecera
        volver={{ href: '/intranet/sistema', label: 'El sistema' }}
        modulo="Tecnología"
        titulo="Documentación"
        acciones={<Boton variante="claro" href="/intranet/sistema" icono={<MapIcon size={14} />}>Ver el mapa</Boton>}
        pie={<Pestanas tono="oscuro" items={[
          { id: 'bitacora', label: 'Bitácora', activa: vista === 'bitacora', onClick: () => setVista('bitacora') },
          { id: 'documentos', label: 'Documentos', activa: vista === 'documentos', onClick: () => setVista('documentos') },
        ]} />}
      />

      <main className="mx-auto max-w-6xl px-6 sm:px-10 pb-24">
        {vista === 'bitacora' ? <Bitacora /> : <Documentos />}
      </main>
    </div>
  )
}
