'use client'

/**
 * Las piezas visuales del mapa del sistema.
 *
 * La caja de etapa está dibujada como una entidad de un diagrama entidad-relación:
 * una cabecera con el nombre, y debajo filas con etiqueta a la izquierda. La
 * diferencia es que aquí las filas no son columnas de una tabla sino lo que la
 * etapa recibe y lo que entrega — que es lo que le importa a quien trabaja en ella.
 */

import { useLayoutEffect, useRef, useState } from 'react'
import { MARCA } from '@/lib/expediente-formato'
import { ESTADO_LABEL, type Estado } from '@/lib/sistema/mapa'

/** Un color por estado. El ámbar dice «se está usando pero todavía no está firme». */
export const COLOR_ESTADO: Record<Estado, string> = {
  produccion: MARCA.bosque,
  en_curso: MARCA.ambar,
  por_construir: MARCA.taupe,
}

export const TIPOGRAFIA = {
  titulo: 'var(--font-josefin), ui-sans-serif, system-ui, sans-serif',
  cuerpo: 'var(--font-poppins), ui-sans-serif, system-ui, sans-serif',
}

// ─── Punto de estado ──────────────────────────────────────────────────────────

export function PuntoEstado({ estado, size = 8 }: { estado: Estado; size?: number }) {
  const color = COLOR_ESTADO[estado]
  const lleno = estado === 'produccion'
  return (
    <span
      aria-label={ESTADO_LABEL[estado]}
      title={ESTADO_LABEL[estado]}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-block',
        flexShrink: 0,
        background: lleno ? color : 'transparent',
        border: lleno ? 'none' : `1.6px solid ${color}`,
        boxShadow: lleno ? 'none' : `inset 0 0 0 1.6px transparent`,
      }}
    />
  )
}

export function EtiquetaEstado({ estado }: { estado: Estado }) {
  const color = COLOR_ESTADO[estado]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] uppercase"
      style={{
        letterSpacing: '.13em',
        fontFamily: TIPOGRAFIA.titulo,
        fontWeight: 600,
        color: estado === 'en_curso' ? '#8a5f14' : color,
        background: estado === 'produccion' ? '#e8ece7' : estado === 'en_curso' ? '#f4e7cd' : '#eae4da',
      }}
    >
      <PuntoEstado estado={estado} size={7} />
      {ESTADO_LABEL[estado]}
    </span>
  )
}

// ─── Rótulo de fila, al estilo de un campo de tabla ───────────────────────────

export function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[9px] uppercase mb-1"
      style={{
        letterSpacing: '.18em',
        fontFamily: TIPOGRAFIA.titulo,
        fontWeight: 600,
        color: '#8b8375',
      }}
    >
      {children}
    </div>
  )
}

// ─── Conector entre dos etapas ────────────────────────────────────────────────

/**
 * Entre dos etapas van dos cosas: lo que viaja (`que`) y, si la hay, la condición
 * que hay que cumplir para pasar (`compuerta`). La compuerta se dibuja sobre la
 * flecha porque vive en el paso, no dentro de ninguna de las dos etapas.
 */
export function Conector({
  que,
  firme,
  compuerta,
}: {
  que: string
  firme: boolean
  compuerta?: { titulo: string; bloquea: boolean }
}) {
  const color = firme ? MARCA.bosque : MARCA.ambar
  return (
    <div className="flex shrink-0 flex-col items-center justify-center self-stretch px-1" style={{ width: 104 }}>
      {compuerta && (
        <div
          className="mb-2 rounded-full px-2 py-1 text-center text-[8.5px] uppercase leading-tight"
          style={{
            letterSpacing: '.1em',
            fontFamily: TIPOGRAFIA.titulo,
            fontWeight: 600,
            color: compuerta.bloquea ? '#8a5f14' : '#6f675c',
            background: compuerta.bloquea ? '#f4e7cd' : '#eae4da',
            border: `1px solid ${compuerta.bloquea ? MARCA.ambar : '#d6cec0'}`,
          }}
          title={
            compuerta.bloquea
              ? 'El sistema impide avanzar si no se cumple'
              : 'Acuerdo del equipo: el sistema todavía no lo verifica'
          }
        >
          {compuerta.titulo}
        </div>
      )}
      <div
        className="text-center text-[9px] leading-tight mb-1.5"
        style={{ color: '#8b8375', fontFamily: TIPOGRAFIA.cuerpo }}
      >
        {que}
      </div>
      <svg width="72" height="10" viewBox="0 0 72 10" aria-hidden="true">
        <line
          x1="0" y1="5" x2="62" y2="5"
          stroke={color} strokeWidth="2"
          strokeDasharray={firme ? undefined : '6 4'}
        />
        <path d="M62,1 L70,5 L62,9 z" fill={color} />
      </svg>
    </div>
  )
}

// ─── La flecha de devolución ──────────────────────────────────────────────────

/**
 * El arco que va de campo de vuelta a la oficina. Se dibuja midiendo dónde
 * quedaron las dos cajas, porque su posición depende de cuánto mida la pantalla
 * y de cuánto texto tenga cada tarjeta.
 *
 * Es la única flecha que va hacia atrás en todo el mapa, y no es un adorno:
 * es la regla de que el terreno corrige a la oficina y no al revés.
 */
export function FlechaDevolucion({
  desde,
  hasta,
  texto,
}: {
  /** Identificadores de las dos etapas que une la flecha. */
  desde: string
  hasta: string
  texto: string
}) {
  const propio = useRef<HTMLDivElement>(null)
  const [caja, setCaja] = useState<{ x1: number; x2: number; ancho: number } | null>(null)
  const alto = 78

  useLayoutEffect(() => {
    const medir = () => {
      // La flecha se ubica desde su PROPIO nodo, no desde una referencia al
      // carril: React adjunta la referencia de un elemento padre despues de
      // correr los efectos de sus hijos, asi que pedirsela al padre daba null
      // en el primer pintado y no se volvia a medir nunca.
      const c = propio.current?.parentElement
      if (!c) return
      // Los extremos se buscan por su atributo `data-etapa`.
      const a = c.querySelector<HTMLElement>(`[data-etapa="${desde}"]`)
      const b = c.querySelector<HTMLElement>(`[data-etapa="${hasta}"]`)
      if (!a || !b) return

      const base = c.getBoundingClientRect()
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      // Se mide en coordenadas del CONTENIDO, no de lo que se ve: el carril se
      // desplaza en horizontal y el arco viaja dentro de ese contenido. Sin
      // sumar el desplazamiento, la flecha solo quedaba bien con el carril al
      // principio y se despegaba de las cajas al correrlo.
      setCaja({
        x1: ra.left + ra.width / 2 - base.left + c.scrollLeft,
        x2: rb.left + rb.width / 2 - base.left + c.scrollLeft,
        ancho: Math.max(c.scrollWidth, base.width),
      })
    }

    medir()
    const padre = propio.current?.parentElement
    const ro = new ResizeObserver(medir)
    if (padre) ro.observe(padre)
    window.addEventListener('resize', medir)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [desde, hasta])

  const anchoRotulo = caja ? Math.max(Math.abs(caja.x2 - caja.x1), 300) : 0
  // Sale del borde inferior de la etapa de campo, baja, cruza y sube al SIG.
  const trazo = caja
    ? `M ${caja.x1} 0 C ${caja.x1} ${alto * 0.62}, ${caja.x2} ${alto * 0.62}, ${caja.x2} 6`
    : ''

  return (
    <div ref={propio} style={{ position: 'relative', height: alto }}>
      {caja && (
        <>
          <svg
            width={caja.ancho}
            height={alto}
            viewBox={`0 0 ${caja.ancho} ${alto}`}
            style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="punta-devolucion"
                viewBox="0 0 9 7" refX="8" refY="3.5"
                markerWidth="9" markerHeight="7" orient="auto"
              >
                <path d="M0,0 L9,3.5 L0,7 z" fill={MARCA.pizarra} />
              </marker>
            </defs>
            <path
              d={trazo}
              fill="none"
              stroke={MARCA.pizarra}
              strokeWidth="1.7"
              strokeDasharray="7 5"
              markerEnd="url(#punta-devolucion)"
            />
          </svg>
          <div
            className="absolute text-center text-[11px] leading-snug"
            style={{
              left: (caja.x1 + caja.x2) / 2 - anchoRotulo / 2,
              width: anchoRotulo,
              top: alto - 26,
              color: MARCA.pizarra,
              fontFamily: TIPOGRAFIA.cuerpo,
            }}
          >
            {texto}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Cifra viva ───────────────────────────────────────────────────────────────

export function Cifra({
  valor,
  etiqueta,
  de,
  problema,
  destacada,
}: {
  valor: number | null
  etiqueta: string
  de?: number | null
  problema?: string
  destacada?: boolean
}) {
  if (valor === null) {
    return (
      <div>
        <div
          className="text-[13px]"
          style={{ color: '#a39a8b', fontFamily: TIPOGRAFIA.titulo, fontWeight: 600 }}
          title={problema}
        >
          sin datos
        </div>
        <div className="text-[10.5px] leading-tight" style={{ color: '#8b8375' }}>
          {etiqueta}
        </div>
      </div>
    )
  }
  return (
    <div>
      <div
        style={{
          fontFamily: TIPOGRAFIA.titulo,
          fontWeight: 700,
          fontSize: destacada ? 26 : 18,
          lineHeight: 1.05,
          color: MARCA.bosque,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valor.toLocaleString('es-CO')}
        {typeof de === 'number' && de > 0 && (
          <span className="ml-1 text-[11px]" style={{ color: '#8b8375', fontWeight: 400 }}>
            de {de.toLocaleString('es-CO')}
          </span>
        )}
      </div>
      <div className="text-[10.5px] leading-tight mt-0.5" style={{ color: '#8b8375' }}>
        {etiqueta}
      </div>
    </div>
  )
}

// ─── Bloque plegable para el detalle técnico ──────────────────────────────────

export function Plegable({
  titulo,
  children,
  abiertoPorDefecto = false,
}: {
  titulo: string
  children: React.ReactNode
  abiertoPorDefecto?: boolean
}) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto)
  return (
    <div>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 py-2 text-left text-[10px] uppercase transition-colors"
        style={{
          letterSpacing: '.15em',
          fontFamily: TIPOGRAFIA.titulo,
          fontWeight: 600,
          color: abierto ? MARCA.bosque : '#8b8375',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            transition: 'transform .15s',
            transform: abierto ? 'rotate(90deg)' : 'none',
          }}
        >
          ›
        </span>
        {titulo}
      </button>
      {abierto && <div className="pb-1">{children}</div>}
    </div>
  )
}
