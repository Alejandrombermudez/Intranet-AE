'use client'

/**
 * PIEZAS DE MARCA
 * ───────────────
 * El lenguaje visual del Manual de Identidad de Marca 2024, hecho componentes.
 * Nació en el módulo Reporte y de ahí se extiende a toda la intranet: cabecera
 * oscura en tinta, títulos en Josefin Sans, rótulos en versalitas con tracking
 * amplio, cuerpo en Poppins, filetes finos en vez de cajas de color.
 *
 * Regla de uso: antes de poner un color, pregúntate si un filete o un peso
 * tipográfico no lo resuelven. El color es para decir algo —un estado, una
 * alerta—, no para decorar.
 *
 * Los colores con nombre (bg-tinta, text-taupe, border-linea…) están definidos
 * en app/globals.css.
 */

import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Isotipo from '@/app/components/Isotipo'

const ANCHO = {
  formulario: 'max-w-2xl',
  ficha: 'max-w-3xl',
  medio: 'max-w-4xl',
  estrecho: 'max-w-5xl',
  normal: 'max-w-6xl',
  amplio: 'max-w-7xl',
  /** Para mesas de trabajo que necesitan toda la pantalla, como el mapa del sistema. */
  completo: 'max-w-[1760px]',
} as const
export type Ancho = keyof typeof ANCHO

// ─── Rótulo ───────────────────────────────────────────────────────────────────

/** Texto pequeño en versalitas con tracking amplio: el gesto del manual. */
export function Rotulo({
  children,
  tono = 'tenue',
  className = '',
}: {
  children: ReactNode
  tono?: 'tenue' | 'bosque' | 'taupe' | 'claro'
  className?: string
}) {
  const color = {
    tenue: 'text-tenue',
    bosque: 'text-bosque',
    taupe: 'text-taupe',
    claro: 'text-hueso',
  }[tono]
  return (
    <p className={`font-display text-[10px] font-semibold uppercase tracking-[.2em] ${color} ${className}`}>
      {children}
    </p>
  )
}

// ─── Firma ────────────────────────────────────────────────────────────────────

/** Isotipo y nombre, en la esquina de cada cabecera. */
export function Firma({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Isotipo className="w-[18px] h-[22px]" />
      <span className="font-display text-[10px] font-semibold uppercase tracking-[.26em]">
        Amazonía Emprende
      </span>
    </div>
  )
}

// ─── Cabecera ─────────────────────────────────────────────────────────────────

export interface Cifra {
  n: ReactNode
  l: string
}

/**
 * La cabecera oscura de cada módulo, la misma de Reporte.
 *
 * `compacta` es para pantallas de detalle y formularios: mantiene la banda en
 * tinta —para que se sepa dónde se está— pero sin robarle altura al trabajo.
 */
export function Cabecera({
  volver,
  modulo,
  titulo,
  descripcion,
  cifras,
  acciones,
  pie,
  ancho = 'normal',
  compacta = false,
}: {
  volver?: { href: string; label: string }
  /** Rótulo sobre el título: el nombre del módulo o de la sección. */
  modulo?: string
  titulo: ReactNode
  descripcion?: ReactNode
  cifras?: Cifra[]
  /** Botones a la derecha del título. Usa `Boton` con variante `luz` (principal) o `claro`. */
  acciones?: ReactNode
  /** Lo que va pegado al borde inferior: normalmente unas `Pestanas`. */
  pie?: ReactNode
  ancho?: Ancho
  compacta?: boolean
}) {
  return (
    <header className="bg-tinta text-hueso">
      <div className={`${ANCHO[ancho]} mx-auto px-6 sm:px-10 ${compacta ? 'pt-5 pb-6' : 'pt-8 pb-9'}`}>
        <div className={`flex items-center justify-between gap-6 ${compacta ? 'mb-5' : 'mb-9'}`}>
          {volver ? (
            <Link
              href={volver.href}
              className="flex items-center gap-2 text-[10px] uppercase tracking-[.2em] text-taupe transition-opacity hover:opacity-70"
            >
              <ArrowLeft size={13} /> {volver.label}
            </Link>
          ) : (
            <span />
          )}
          <Firma />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            {modulo && (
              <p className={`text-[10.5px] uppercase tracking-[.28em] text-taupe ${compacta ? 'mb-2' : 'mb-3.5'}`}>
                {modulo}
              </p>
            )}
            <h1
              className={`font-display font-bold text-white text-balance ${
                compacta ? 'text-2xl sm:text-[1.9rem] leading-tight' : 'text-[2.1rem] sm:text-5xl leading-[1.02]'
              }`}
            >
              {titulo}
            </h1>
            {descripcion && (
              <div className={`max-w-2xl text-sm font-light leading-relaxed text-hueso/90 ${compacta ? 'mt-2.5' : 'mt-4'}`}>
                {descripcion}
              </div>
            )}
          </div>
          {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{acciones}</div>}
        </div>

        {cifras && cifras.length > 0 && (
          <dl className="mt-9 flex flex-wrap border-t border-hueso/20 pt-7">
            {cifras.map((c, i) => (
              <div
                key={i}
                className="flex min-w-[8rem] flex-1 flex-col-reverse border-l border-hueso/20 px-5 first:border-l-0 first:pl-0"
              >
                <dt className="mt-2 text-[9.5px] uppercase tracking-[.14em] text-taupe">{c.l}</dt>
                <dd className="font-display text-3xl font-bold leading-none tabular-nums text-white">{c.n}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {pie && <div className={`${ANCHO[ancho]} mx-auto px-6 sm:px-10`}>{pie}</div>}
    </header>
  )
}

// ─── Contenido ────────────────────────────────────────────────────────────────

/** El cuerpo de la página, alineado con la cabecera. */
export function Contenido({
  children,
  ancho = 'normal',
  className = '',
}: {
  children: ReactNode
  ancho?: Ancho
  className?: string
}) {
  return <main className={`${ANCHO[ancho]} mx-auto px-6 sm:px-10 py-10 ${className}`}>{children}</main>
}

// ─── Pestañas ─────────────────────────────────────────────────────────────────

export interface Pestana {
  id: string
  label: string
  icono?: ReactNode
  activa?: boolean
  onClick?: () => void
  href?: string
}

/**
 * Subrayado, no píldoras. Sobre la cabecera oscura (`tono="oscuro"`) la activa
 * se marca en ámbar; sobre papel, en verde bosque.
 */
export function Pestanas({ items, tono = 'claro' }: { items: Pestana[]; tono?: 'claro' | 'oscuro' }) {
  return (
    <nav className="-mb-px flex gap-7 overflow-x-auto">
      {items.map((it) => {
        const color =
          tono === 'oscuro'
            ? it.activa
              ? 'border-ambar text-white'
              : 'border-transparent text-hueso/60 hover:text-hueso'
            : it.activa
              ? 'border-bosque text-tinta'
              : 'border-transparent text-tenue hover:text-tinta'
        const cls = `flex items-center gap-2 whitespace-nowrap border-b-2 pb-3 pt-1 text-[10.5px] uppercase tracking-[.16em] transition-colors ${color}`
        const contenido = (
          <>
            {it.icono}
            {it.label}
          </>
        )
        return it.href ? (
          <Link key={it.id} href={it.href} className={cls}>
            {contenido}
          </Link>
        ) : (
          <button key={it.id} type="button" onClick={it.onClick} className={cls}>
            {contenido}
          </button>
        )
      })}
    </nav>
  )
}

// ─── Sección ──────────────────────────────────────────────────────────────────

/** Encabezado de sección con número y filete, como en el informe. */
export function Seccion({
  n,
  titulo,
  sub,
  acciones,
  children,
  className = '',
}: {
  n?: string
  titulo: ReactNode
  sub?: ReactNode
  acciones?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <section className={`mb-12 ${className}`}>
      <header className="mb-5 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-linea pb-2.5">
        {n && <span className="shrink-0 font-display text-[13px] font-bold tracking-[.18em] text-bosque">{n}</span>}
        <h2 className="font-display text-[1.4rem] font-semibold leading-tight tracking-[.02em]">{titulo}</h2>
        {acciones && <div className="ml-auto flex items-center gap-2">{acciones}</div>}
      </header>
      {sub && <p className="-mt-2 mb-5 max-w-[68ch] text-[12.5px] font-light text-suave">{sub}</p>}
      {children}
    </section>
  )
}

// ─── Botón ────────────────────────────────────────────────────────────────────

export type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'claro' | 'luz'

const VARIANTE: Record<VarianteBoton, string> = {
  primario: 'bg-bosque text-papel hover:bg-primary-dark',
  secundario: 'border border-taupe text-suave hover:bg-hueso/60',
  fantasma: 'text-tenue hover:text-tinta',
  peligro: 'border border-red-600/50 text-red-700 hover:bg-red-50',
  /** Secundario sobre la cabecera en tinta. */
  claro: 'border border-hueso/35 text-hueso hover:bg-hueso/10',
  /** Principal sobre la cabecera en tinta: el bosque se perdería sobre el fondo oscuro. */
  luz: 'bg-hueso text-tinta hover:bg-white',
}

/** Rectangular y en versalitas, como en Reporte. Con `href` se vuelve enlace. */
export function Boton({
  variante = 'primario',
  icono,
  href,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton
  icono?: ReactNode
  href?: string
}) {
  const cls =
    'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[10.5px] font-medium uppercase ' +
    `tracking-[.16em] transition-colors disabled:pointer-events-none disabled:opacity-45 ${VARIANTE[variante]} ${className}`
  if (href) {
    return (
      <Link href={href} className={cls}>
        {icono}
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} {...rest}>
      {icono}
      {children}
    </button>
  )
}

// ─── Marca de estado ──────────────────────────────────────────────────────────

/** Un cuadro de color y la palabra. Nada más: sin píldora, sin fondo. */
export function MarcaEstado({
  color,
  children,
  className = '',
}: {
  color: string
  children: ReactNode
  className?: string
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] text-tinta ${className}`}>
      <i className="inline-block h-[7px] w-[7px] shrink-0" style={{ background: color }} />
      {children}
    </span>
  )
}

// ─── Aviso ────────────────────────────────────────────────────────────────────

const TONO_AVISO = {
  ambar: 'border-ambar',
  arcilla: 'border-red-600',
  bosque: 'border-bosque',
  pizarra: 'border-pizarra',
} as const

/** Nota al margen: un filete de color a la izquierda y texto ligero. */
export function Aviso({
  tono = 'ambar',
  titulo,
  children,
  className = '',
}: {
  tono?: keyof typeof TONO_AVISO
  titulo?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`border-l-2 py-0.5 pl-4 ${TONO_AVISO[tono]} ${className}`}>
      {titulo && <p className="mb-1 text-[12.5px] font-medium text-tinta">{titulo}</p>}
      <div className="text-[12.5px] font-light leading-relaxed text-suave">{children}</div>
    </div>
  )
}

// ─── Estados de carga y vacío ─────────────────────────────────────────────────

/** Pantalla completa mientras se resuelve el acceso o se traen los datos. */
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-papel">
      <div className="text-center">
        <Loader2 className="mx-auto mb-3 animate-spin text-bosque" size={26} />
        <p className="text-[11px] uppercase tracking-[.16em] text-tenue">{texto}</p>
      </div>
    </div>
  )
}

export function Vacio({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`py-16 text-center text-[11px] uppercase tracking-[.16em] text-tenue ${className}`}>{children}</p>
  )
}
