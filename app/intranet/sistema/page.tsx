'use client'

/**
 * EL SISTEMA — mapa del ecosistema
 *
 * Reemplaza al diagrama en PDF. La diferencia de fondo no es que sea interactivo:
 * es que las cifras se leen de la base cada vez que alguien abre la página, así
 * que no puede quedarse viejo por el lado de los números.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Pulso } from '@/app/api/sistema/pulso/route'
import { Boton, Cabecera, Cargando, Pestanas } from '@/app/components/marca'
import { MapaSistema, type Vista } from './mapa-vista'
import { BookOpen, Crosshair, LayoutGrid, RotateCcw, Sparkles } from 'lucide-react'

export default function SistemaPage() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState(false)
  const [pulso, setPulso] = useState<Pulso | null>(null)
  const [errorPulso, setErrorPulso] = useState<string | null>(null)
  // Se entra por el Resumen: responde «qué hay» antes que «cómo se conecta»,
  // que es lo que pregunta quien abre esta página por primera vez.
  const [vista, setVista] = useState<Vista>('resumen')

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

  if (!autorizado) return <Cargando texto="Cargando el mapa del sistema…" />

  const hora = pulso
    ? new Date(pulso.medido).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className={`min-h-screen ${vista === 'comparar' ? 'bg-papel' : 'bg-tinta'}`}>
      <Cabecera
        ancho="completo"
        compacta
        volver={{ href: '/intranet', label: 'Intranet' }}
        modulo="Tecnología"
        titulo="El sistema"
        descripcion={
          vista === 'resumen'
            ? 'Qué hay en el sistema: las aplicaciones, los módulos, las etapas y las piezas compartidas.'
            : 'Cada tarjeta es una parte del sistema. Explora una a la vez o compara varias para ver qué comparten.'
        }
        pie={<Pestanas tono="oscuro" items={[
          {
            id: 'resumen', label: 'Resumen', icono: <Sparkles size={13} />,
            activa: vista === 'resumen', onClick: () => setVista('resumen'),
          },
          {
            id: 'explorar', label: 'Explorar', icono: <Crosshair size={13} />,
            activa: vista === 'explorar', onClick: () => setVista('explorar'),
          },
          {
            id: 'comparar', label: 'Comparar', icono: <LayoutGrid size={13} />,
            activa: vista === 'comparar', onClick: () => setVista('comparar'),
          },
        ]} />}
        acciones={<>
          {errorPulso ? (
            <span className="text-[11px] text-red-300">{errorPulso}</span>
          ) : (
            <Boton variante="claro" onClick={() => void medir()} icono={<RotateCcw size={13} />}
              title="Volver a leer las cifras de la base">
              {hora ? `Cifras de las ${hora}` : 'Leyendo cifras…'}
            </Boton>
          )}
          <Boton variante="luz" href="/intranet/sistema/documentacion" icono={<BookOpen size={14} />}>
            Documentación
          </Boton>
        </>}
      />

      <main>
        <MapaSistema pulso={pulso} vista={vista} onVista={setVista} />
      </main>
    </div>
  )
}
