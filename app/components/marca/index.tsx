'use client'

/**
 * PIEZAS DE MARCA
 * ───────────────
 * El lenguaje visual de la intranet, hecho componentes. Desde el 2026-10-15:
 * Poppins para la interfaz, como los documentos de la organización, Fraunces
 * para los títulos, y superficies de vidrio —translúcidas, con desenfoque y un filo de luz— sobre el fondo hueso
 * con manchas de la paleta (app/globals.css). La cabecera es un panel en verde
 * bosque, redondeado, con un brillo ámbar y los anillos de la huella.
 *
 * Regla de uso: antes de poner un color, pregúntate si el vidrio, un filete o
 * un peso tipográfico no lo resuelven. El color es para decir algo —un estado,
 * una alerta—, no para decorar.
 *
 * Los colores con nombre (bg-tinta, text-taupe, border-linea…) y las
 * utilidades `vidrio` / `vidrio-oscuro` están en app/globals.css.
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

/** El fondo de la cabecera: verde bosque con un brillo ámbar arriba y salvia abajo. */
const FONDO_CABECERA = [
  'radial-gradient(55% 120% at 100% 0%, rgb(225 166 68 / 0.30), transparent 62%)',
  'radial-gradient(45% 90% at 0% 100%, rgb(175 189 178 / 0.22), transparent 60%)',
  'linear-gradient(135deg, rgb(38 52 40) 0%, rgb(47 63 50) 48%, rgb(30 41 32) 100%)',
].join(', ')

/** Los anillos de la huella, el motivo de la marca. */
const ANILLOS = 'repeating-radial-gradient(circle, rgb(228 222 210 / 0.9) 0 1px, transparent 1.5px 22px)'

// ─── Rótulo ───────────────────────────────────────────────────────────────────

/** Texto pequeño en versalitas: nombra una sección o un dato. */
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
    <p className={`text-[11px] font-medium uppercase tracking-[.14em] ${color} ${className}`}>
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
      <span className="text-[11px] font-semibold uppercase tracking-[.22em]">
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
 * La cabecera de cada módulo: un panel en verde bosque, redondeado y separado
 * del borde, con las cifras y las pestañas en vidrio oscuro.
 *
 * `compacta` es para pantallas de detalle y formularios: mantiene el panel
 * —para que se sepa dónde se está— pero sin robarle altura al trabajo.
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
  /** Lo que va al pie del panel: normalmente unas `Pestanas` con tono oscuro. */
  pie?: ReactNode
  ancho?: Ancho
  compacta?: boolean
}) {
  return (
    <header className="px-2.5 pt-2.5 sm:px-4 sm:pt-4">
      <div
        className="relative overflow-hidden rounded-[22px] text-hueso shadow-xl sm:rounded-[28px]"
        style={{ background: FONDO_CABECERA }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-36 h-[460px] w-[460px] rounded-full opacity-[.09]"
          style={{ background: ANILLOS }}
        />
        <div className={`relative ${ANCHO[ancho]} mx-auto px-5 sm:px-10 ${compacta ? 'pt-5 pb-6' : 'pt-7 pb-8'}`}>
          <div className={`flex items-center justify-between gap-6 ${compacta ? 'mb-5' : 'mb-8'}`}>
            {volver ? (
              <Link
                href={volver.href}
                className="vidrio-oscuro flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] text-hueso/85 transition-colors hover:bg-white/15 hover:text-white"
              >
                <ArrowLeft size={14} /> {volver.label}
              </Link>
            ) : (
              <span />
            )}
            <Firma className="text-hueso/90" />
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              {modulo && (
                <p className={`text-[11px] font-medium uppercase tracking-[.18em] text-ambar ${compacta ? 'mb-2' : 'mb-3'}`}>
                  {modulo}
                </p>
              )}
              <h1
                className={`font-titulo font-medium tracking-[-0.015em] text-white text-balance ${
                  compacta ? 'text-[1.7rem] sm:text-[2.1rem] leading-tight' : 'text-[2.2rem] sm:text-[3.1rem] leading-[1.04]'
                }`}
              >
                {titulo}
              </h1>
              {descripcion && (
                <div className={`max-w-2xl text-[14px] font-light leading-relaxed text-hueso/80 ${compacta ? 'mt-2' : 'mt-3.5'}`}>
                  {descripcion}
                </div>
              )}
            </div>
            {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{acciones}</div>}
          </div>

          {cifras && cifras.length > 0 && (
            <dl className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] sm:gap-3">
              {cifras.map((c, i) => (
                <div key={i} className="vidrio-oscuro flex flex-col-reverse rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4">
                  <dt className="mt-1.5 text-[11.5px] leading-snug text-hueso/65">{c.l}</dt>
                  <dd className="text-[1.65rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-white sm:text-3xl">{c.n}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {pie && <div className={`relative ${ANCHO[ancho]} mx-auto px-5 pb-5 sm:px-10 sm:pb-6`}>{pie}</div>}
      </div>
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
  return <main className={`${ANCHO[ancho]} mx-auto px-5 sm:px-10 py-10 ${className}`}>{children}</main>
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
 * Una barra de vidrio con la pestaña activa como píldora. Sobre la cabecera
 * (`tono="oscuro"`) la activa va en hueso; sobre el fondo claro, en bosque.
 */
export function Pestanas({ items, tono = 'claro' }: { items: Pestana[]; tono?: 'claro' | 'oscuro' }) {
  const barra = tono === 'oscuro' ? 'vidrio-oscuro' : 'vidrio'
  return (
    <nav className={`${barra} inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
      {items.map((it) => {
        const color =
          tono === 'oscuro'
            ? it.activa
              ? 'bg-hueso text-tinta shadow-md'
              : 'text-hueso/75 hover:bg-white/10 hover:text-white'
            : it.activa
              ? 'bg-bosque text-hueso shadow-md'
              : 'text-suave hover:bg-white/70 hover:text-tinta'
        const cls = `flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${color}`
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

/** Encabezado de sección: número en una pastilla de vidrio, título y filete. */
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
      <header className="mb-5 flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b border-linea/70 pb-3">
        {n && (
          <span className="vidrio shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-bosque">{n}</span>
        )}
        <h2 className="font-titulo text-[1.5rem] font-medium leading-tight">{titulo}</h2>
        {acciones && <div className="ml-auto flex items-center gap-2">{acciones}</div>}
      </header>
      {sub && <p className="-mt-1.5 mb-5 max-w-[68ch] text-[13px] font-light text-suave">{sub}</p>}
      {children}
    </section>
  )
}

// ─── Botón ────────────────────────────────────────────────────────────────────

export type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'claro' | 'luz'

const VARIANTE: Record<VarianteBoton, string> = {
  primario:
    'bg-gradient-to-b from-emerald-600 to-bosque text-hueso shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_8px_18px_-8px_rgb(47_63_50/0.7)] hover:brightness-110',
  secundario: 'vidrio text-tinta hover:bg-white/85',
  fantasma: 'text-suave hover:bg-white/50 hover:text-tinta',
  peligro: 'border border-red-600/35 bg-red-50/60 text-red-700 hover:bg-red-50',
  /** Secundario sobre la cabecera en bosque. */
  claro: 'vidrio-oscuro text-hueso hover:bg-white/15',
  /** Principal sobre la cabecera: el bosque se perdería sobre el fondo oscuro. */
  luz: 'bg-hueso text-tinta shadow-md hover:bg-white',
}

/** Una píldora en Poppins. Con `href` se vuelve enlace. */
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
    'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium ' +
    `transition-all active:scale-[.98] disabled:pointer-events-none disabled:opacity-45 ${VARIANTE[variante]} ${className}`
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

/** Un punto de color y la palabra. Nada más: sin píldora, sin fondo. */
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
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-tinta ${className}`}>
      <i className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      {children}
    </span>
  )
}

// ─── Aviso ────────────────────────────────────────────────────────────────────

const TONO_AVISO = {
  ambar: 'bg-ambar',
  arcilla: 'bg-red-600',
  bosque: 'bg-bosque',
  pizarra: 'bg-pizarra',
} as const

/** Nota en vidrio con una barra de color a la izquierda. */
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
    <div className={`vidrio flex gap-3.5 rounded-2xl py-3 pl-3 pr-4 ${className}`}>
      <span aria-hidden className={`w-1 shrink-0 self-stretch rounded-full ${TONO_AVISO[tono]}`} />
      <div className="min-w-0">
        {titulo && <p className="mb-0.5 text-[13px] font-medium text-tinta">{titulo}</p>}
        <div className="text-[13px] font-light leading-relaxed text-suave">{children}</div>
      </div>
    </div>
  )
}

// ─── Estados de carga y vacío ─────────────────────────────────────────────────

/** Pantalla completa mientras se resuelve el acceso o se traen los datos. */
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="vidrio rounded-3xl px-10 py-8 text-center">
        <Loader2 className="mx-auto mb-3 animate-spin text-bosque" size={26} />
        <p className="text-[13px] text-suave">{texto}</p>
      </div>
    </div>
  )
}

export function Vacio({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`py-16 text-center text-[13px] text-tenue ${className}`}>{children}</p>
  )
}
