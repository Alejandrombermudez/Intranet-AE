'use client'

/**
 * Las piezas visuales pequeñas del mapa del sistema: el punto de estado, la
 * cifra viva, los bloques plegables y lo que se repite en el panel de detalle.
 * Las tarjetas y las líneas del diagrama están en lienzo.tsx.
 */

import { useState } from 'react'
import Link from 'next/link'
import { MARCA } from '@/lib/expediente-formato'
import { ESTADO_LABEL, type Estado } from '@/lib/sistema/mapa'
import { fechaLarga, TIPO_LABEL, type Entrada, type Frente } from '@/lib/sistema/bitacora'
import { NODO_POR_ID } from '@/lib/sistema/relaciones'
import { colorDe } from './disposicion'

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

// ─── Piezas del panel ─────────────────────────────────────────────────────────

/** Un apartado del panel: rótulo en versalitas y lo que va debajo. */
export function Bloque({
  titulo,
  children,
  className = 'mt-7',
}: {
  titulo: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      <h3 className="mb-2.5 font-display text-[9.5px] font-semibold uppercase tracking-[.2em] text-tenue">
        {titulo}
      </h3>
      {children}
    </section>
  )
}

/**
 * El nombre de una tarjeta, con el cuadrito de su color. Si recibe `onClick`,
 * es un botón: en el panel sirve para sumar esa tarjeta a lo elegido.
 */
export function Chip({
  id,
  onClick,
  titulo,
}: {
  id: string
  onClick?: (id: string) => void
  titulo?: string
}) {
  const n = NODO_POR_ID.get(id)
  const contenido = (
    <>
      <i className="inline-block h-[7px] w-[7px] shrink-0" style={{ background: colorDe(id) }} />
      <span className="truncate">{n?.corto ?? id}</span>
    </>
  )
  const cls = 'inline-flex max-w-full items-center gap-1.5 border border-linea bg-papel px-1.5 py-[3px] text-[11px] text-tinta'
  return onClick ? (
    <button
      type="button"
      onClick={() => onClick(id)}
      title={titulo ?? `Elegir también ${n?.nombre ?? id}`}
      className={`${cls} transition-colors hover:border-bosque hover:bg-white`}
    >
      {contenido}
    </button>
  ) : (
    <span className={cls}>{contenido}</span>
  )
}

/** Entradas de la bitácora, en corto: fecha, clase, título y qué quedó. */
export function ListaBitacora({ entradas }: { entradas: Entrada[] }) {
  return (
    <div className="space-y-3.5">
      {entradas.map((e) => (
        <div key={e.id} className="border-l-2 border-linea pl-3">
          <p className="text-[10px] uppercase tracking-[.12em] text-tenue">
            {TIPO_LABEL[e.tipo]} · {fechaLarga(e.fecha)}
            {e.abierto && <span className="ml-1.5 normal-case tracking-normal text-marron">sigue abierto</span>}
          </p>
          <p className="mt-0.5 font-display text-[13px] font-semibold leading-snug text-tinta">{e.titulo}</p>
          <p className="mt-1 text-[12px] font-light leading-relaxed text-suave">{e.quedo}</p>
        </div>
      ))}
      <Link
        href="/intranet/sistema/documentacion"
        className="inline-block text-[11px] text-pizarra underline underline-offset-2 hover:opacity-70"
      >
        Ver la bitácora completa
      </Link>
    </div>
  )
}

/** Lo que hoy no funciona: qué pasa y qué cuesta mientras siga así. */
export function ListaFrentes({ frentes, pendiente }: { frentes: Frente[]; pendiente?: string }) {
  return (
    <div className="space-y-3 border-l-2 border-ambar pl-3">
      {pendiente && <p className="text-[12.5px] leading-relaxed text-tinta">{pendiente}</p>}
      {frentes.map((f) => (
        <div key={f.id}>
          <p className="text-[12.5px] leading-relaxed text-tinta">
            <b className="font-medium">{f.titulo}.</b> {f.cuerpo}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-marron">Mientras siga así: {f.costo}</p>
        </div>
      ))}
    </div>
  )
}
