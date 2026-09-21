'use client'

/**
 * LA VISTA DEL MAPA
 * ─────────────────
 * Tres maneras de mirar el mismo mapa:
 *
 *   Resumen  — qué hay, en cuatro números. Es la entrada: no dibuja relaciones,
 *              lista las partes y lleva a cada una (resumen.tsx).
 *   Explorar — una tarjeta a la vez. Pasa al centro con todo lo que la toca
 *              alrededor, y se recorre el sistema de una en una (escena.tsx).
 *   Comparar — el lienzo completo; se eligen varias y el panel dice cómo se
 *              comunican y qué comparten (lienzo.tsx + panel.tsx).
 *
 * La página se encarga de quién puede entrar, de traer las cifras y de las
 * pestañas; este archivo guarda lo que se está mirando en cada vista y reparte.
 * Separarlo de la página deja la vista montable por sí sola —para revisarla
 * sin pasar por el login—.
 *
 *   disposicion.ts  dónde va cada tarjeta, en el lienzo y en la escena
 *   ficha.tsx       la ficha completa de una sola tarjeta (la usan las dos)
 */

import { useCallback, useEffect, useState } from 'react'
import type { Pulso } from '@/app/api/sistema/pulso/route'
import { ladosDeVecinas } from './disposicion'
import { Escena } from './escena'
import { Lienzo } from './lienzo'
import { Panel } from './panel'
import { Resumen } from './resumen'

export type Vista = 'resumen' | 'explorar' | 'comparar'

/** Una cifra ya resuelta, o null si esa métrica no se pudo leer. */
export type LectorDeCifras = (
  id: string,
) => { valor: number | null; etiqueta: string; de?: string; problema?: string } | null

/**
 * Cómo avanza el recorrido de Explorar. No es el historial de clics: es el
 * camino que se lee arriba de la escena, y tiene que decir algo.
 *
 *   · Volver a una tarjeta que ya está en el camino lo corta ahí.
 *   · Subir —ir a una tarjeta que en la escena está encima del centro: la
 *     aplicación de una etapa, o la etapa de una pieza del núcleo— empieza un
 *     camino nuevo desde ella. La intranet, por ejemplo, es un punto de
 *     partida, no un paso más de «Jurídica › SIG › Campo».
 *   · Seguir a los lados (el flujo del trabajo) o bajar lo alarga.
 *   · Lo que no es vecina del centro (los atajos de la hoja) también empieza de cero.
 *
 * Con estas reglas el camino no puede pasar de una app, una cadena de etapas y
 * una pieza del núcleo, así que no hace falta recortarlo.
 */
export function siguienteRecorrido(recorrido: string[], id: string): string[] {
  const i = recorrido.indexOf(id)
  if (i >= 0) return recorrido.slice(0, i + 1)
  const foco = recorrido[recorrido.length - 1]
  const lado = foco ? ladosDeVecinas(foco).get(id) : undefined
  if (!lado || lado === 'arriba') return [id]
  return [...recorrido, id]
}

/** El mapa completo. Recibe las cifras ya leídas; no sabe de dónde salieron. */
export function MapaSistema({
  pulso,
  vista,
  onVista,
}: {
  pulso: Pulso | null
  vista: Vista
  /** Cambiar de vista desde dentro: el Resumen manda tarjetas a Explorar. */
  onVista: (v: Vista) => void
}) {
  const [elegidas, setElegidas] = useState<string[]>([])
  const [recorrido, setRecorrido] = useState<string[]>([])

  // Al pasar entre Explorar y Comparar, lo que se estaba mirando sigue a la
  // vista: la tarjeta del centro queda elegida en Comparar, y la última elegida
  // pasa al centro en Explorar. Se ajusta durante el render, como recomienda
  // React para derivar estado de un cambio de props, y no en un efecto.
  //
  // Se mira de DÓNDE se viene, no solo a dónde se va: el Resumen deja puesta la
  // tarjeta antes de mandar a Explorar, y sin esa condición una elección vieja
  // de Comparar la pisaría al entrar.
  const [vistaAnterior, setVistaAnterior] = useState(vista)
  if (vista !== vistaAnterior) {
    const veniaDe = vistaAnterior
    setVistaAnterior(vista)
    const foco = recorrido[recorrido.length - 1]
    if (vista === 'comparar' && veniaDe === 'explorar' && foco && !elegidas.includes(foco)) {
      setElegidas([...elegidas, foco])
    }
    if (vista === 'explorar' && veniaDe === 'comparar' && elegidas.length) {
      setRecorrido([elegidas[elegidas.length - 1]])
    }
  }

  const cifra: LectorDeCifras = useCallback((id: string) => pulso?.metricas[id] ?? null, [pulso])

  const alternar = useCallback(
    (id: string) => setElegidas((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])),
    [],
  )
  const agregar = useCallback((id: string) => setElegidas((l) => (l.includes(id) ? l : [...l, id])), [])

  const ir = useCallback((id: string) => setRecorrido((r) => siguienteRecorrido(r, id)), [])
  const volverA = useCallback((i: number) => setRecorrido((r) => r.slice(0, i + 1)), [])

  // Llevar una tarjeta del Resumen al centro de Explorar. Deja el recorrido
  // puesto y cambia de vista; no alarga el camino anterior porque se viene de
  // una lista, no de un paso del recorrido.
  const irDesdeResumen = useCallback(
    (id: string) => {
      setRecorrido([id])
      onVista('explorar')
    },
    [onVista],
  )

  // Escape suelta todo: en Explorar vuelve al mapa completo. En Resumen no hay
  // nada suelto que soltar — el grupo abierto lo cierra la propia vista.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (vista === 'resumen') return
      if (vista === 'explorar') setRecorrido([])
      else setElegidas([])
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [vista])

  if (vista === 'resumen') {
    return <Resumen cifra={cifra} onIrATarjeta={irDesdeResumen} />
  }

  if (vista === 'explorar') {
    return (
      <Escena recorrido={recorrido} cifra={cifra} onIr={ir} onVolverA={volverA} onMapa={() => setRecorrido([])} />
    )
  }

  return (
    <div className="mx-auto max-w-[1760px] px-6 pb-16 pt-6 sm:px-10">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <Lienzo elegidas={elegidas} onAlternar={alternar} cifra={cifra} />
          <p className="mt-2.5 text-[11px] text-tenue">
            Toca una tarjeta para elegirla y varias para compararlas. Arrastra el fondo para moverte; Esc suelta todo.
          </p>
        </div>
        <Panel elegidas={elegidas} cifra={cifra} onAlternar={alternar} onAgregar={agregar} onElegir={setElegidas} />
      </div>
    </div>
  )
}
