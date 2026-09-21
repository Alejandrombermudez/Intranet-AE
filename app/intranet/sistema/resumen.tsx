'use client'

/**
 * RESUMEN — la puerta de entrada al mapa del sistema
 * ──────────────────────────────────────────────────
 * Explorar y Comparar responden «cómo se conecta esto». Resumen responde algo
 * anterior: «¿qué hay?». Cinco tarjetas con un número grande cada una; al tocar
 * una, esa tarjeta pasa al centro y lo que contiene se abre en cuadros de
 * colores. Tocar un cuadro lleva a donde vive esa cosa.
 *
 * A dónde se va depende de qué sea: una aplicación abre su despliegue real, un
 * módulo abre su pantalla de la intranet, y una etapa o una pieza del núcleo
 * —que no son sitios sino partes del diagrama— pasan al centro de Explorar.
 *
 * Siembra y Conservación van en tarjetas SEPARADAS, no en una sola de «etapas».
 * Es la regla de oro del proyecto: son dos dominios que no comparten tablas ni
 * flujo, y juntarlos en un mismo conteo insinuaría lo contrario.
 *
 * REGLA, la misma del resto del módulo: aquí no se escribe ninguna cifra. Los
 * conteos de arriba se calculan de las listas del mapa (`.length`), y los de la
 * franja de abajo salen de `/api/sistema/pulso`, que los lee de Supabase al
 * abrir la página. Un número escrito a mano aquí mentiría en tres semanas.
 *
 * Sobre el aspecto: es la única pantalla de la intranet que se sale del papel y
 * la tinta, a propósito — es una portada, no una mesa de trabajo. Pero los
 * resplandores salen de la paleta de la marca (`var(--color-ambar)`, `cielo`,
 * `salvia`, `musgo`), no de neones de fantasía, así que sigue siendo la misma
 * casa. Todo el CSS del efecto vive en este archivo, con prefijo `res-`, para
 * no tocar `globals.css` ni arriesgar la caché de Turbopack.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  APLICACIONES,
  ESTADO_LABEL,
  PIEZAS,
  etapasDe,
  type Estado,
} from '@/lib/sistema/mapa'
import { DEPARTAMENTOS } from '@/lib/departamentos'
import type { LectorDeCifras } from './mapa-vista'
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowRight,
  Boxes,
  Building2,
  Crosshair,
  Smartphone,
  Trees,
} from 'lucide-react'

// ─── Qué pasa al tocar un cuadro ──────────────────────────────────────────────

type Destino =
  | { tipo: 'sitio'; url: string; externo: boolean }
  /** Etapas y piezas no son sitios: son tarjetas del diagrama. Van a Explorar. */
  | { tipo: 'tarjeta'; id: string }
  /** Lo que todavía no se puede abrir, y por qué. Mejor decirlo que mandar a un 404. */
  | { tipo: 'sin_enlace'; porque: string }

interface Elemento {
  id: string
  nombre: string
  /** Una línea. Qué es, sin tecnicismos. */
  detalle: string
  /** La etiqueta pequeña del pie: dónde se usa, quién responde. */
  nota?: string
  estado?: Estado
  destino: Destino
}

interface Grupo {
  id: string
  titulo: string
  /** La palabra que acompaña al número: «aplicaciones», «módulos»… */
  unidad: string
  /** Una línea bajo el título de la tarjeta. */
  que: string
  /** Color de la paleta que le da el resplandor. */
  color: string
  icono: React.ReactNode
  elementos: Elemento[]
}

/**
 * Los colores de los cuadros. Son los tonos CLAROS de la paleta: sobre tinta,
 * bosque y pizarra no levantan y se leerían como cuadros apagados.
 */
const RUEDA = [
  'var(--color-ambar)',
  'var(--color-cielo)',
  'var(--color-salvia)',
  'var(--color-musgo)',
  'var(--color-celeste)',
  'var(--color-primary-light)',
  'var(--color-taupe)',
]

// ─── Los grupos ───────────────────────────────────────────────────────────────

function grupos(): Grupo[] {
  return [
    {
      id: 'apps',
      titulo: 'Aplicaciones',
      unidad: 'aplicaciones',
      que: 'Todo lo que el equipo abre para trabajar, en la oficina y en el predio.',
      color: 'var(--color-ambar)',
      icono: <Smartphone size={15} />,
      elementos: APLICACIONES.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        detalle: a.para,
        nota: a.dondeCorto,
        estado: a.estado,
        destino: a.url
          ? { tipo: 'sitio' as const, url: a.url, externo: a.url.startsWith('http') }
          : {
              tipo: 'sin_enlace' as const,
              porque:
                a.estado === 'por_construir'
                  ? 'Todavía no existe'
                  : 'Falta su dirección',
            },
      })),
    },
    {
      id: 'modulos',
      titulo: 'Módulos',
      unidad: 'áreas de trabajo',
      que: 'Las áreas en que se reparte la intranet. Cada persona entra por la suya.',
      color: 'var(--color-cielo)',
      icono: <Building2 size={15} />,
      elementos: DEPARTAMENTOS.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        detalle: d.que,
        destino: d.ruta
          ? { tipo: 'sitio' as const, url: d.ruta, externo: false }
          : { tipo: 'sin_enlace' as const, porque: 'Sin pantalla propia' },
      })),
    },
    {
      id: 'siembra',
      titulo: 'Siembra',
      unidad: 'etapas del proceso',
      que: 'Por dónde pasa un predio, de la revisión jurídica al árbol sembrado.',
      color: 'var(--color-primary-light)',
      icono: <Crosshair size={15} />,
      elementos: etapasDe('siembra').map(etapaAElemento),
    },
    {
      id: 'conservacion',
      titulo: 'Conservación',
      unidad: 'frentes de la RAS',
      que: 'Familias que conservan bosque y la red de árboles semilleros. Aquí la entidad central es el árbol, no el predio.',
      color: 'var(--color-musgo)',
      icono: <Trees size={15} />,
      elementos: etapasDe('conservacion').map(etapaAElemento),
    },
    {
      id: 'nucleo',
      titulo: 'Piezas compartidas',
      unidad: 'piezas del núcleo',
      que: 'Lo que los dos dominios usan sin duplicar: persona, predio, mapa y especies.',
      color: 'var(--color-celeste)',
      icono: <Boxes size={15} />,
      elementos: PIEZAS.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        detalle: p.que,
        nota: p.dominio === 'nucleo' ? 'Núcleo' : 'Soporte',
        destino: { tipo: 'tarjeta' as const, id: p.id },
      })),
    },
  ]
}

function etapaAElemento(e: ReturnType<typeof etapasDe>[number]): Elemento {
  return {
    id: e.id,
    nombre: e.nombre,
    detalle: e.entrega,
    nota: e.responsable,
    estado: e.estado,
    destino: { tipo: 'tarjeta', id: e.id },
  }
}

/** Las cifras vivas que valen para una portada: las que cuentan trabajo real. */
const CIFRAS_PORTADA = [
  'predios_total',
  'aliados_total',
  'zonas_vigentes',
  'evaluaciones',
  'ras_arboles',
  'especies',
]

// ─── Componente ───────────────────────────────────────────────────────────────

export function Resumen({
  cifra,
  onIrATarjeta,
}: {
  cifra: LectorDeCifras
  /** Lleva una etapa o una pieza al centro de Explorar. */
  onIrATarjeta: (id: string) => void
}) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const gs = grupos()
  const centro = gs.find((g) => g.id === abierto) ?? null

  return (
    <div className="res-fondo relative min-h-[calc(100vh-132px)] overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Los resplandores. Van detrás de todo y no reciben el ratón. */}
      <div aria-hidden className="res-halos pointer-events-none absolute inset-0" />
      <div aria-hidden className="res-aurora pointer-events-none absolute inset-0" />
      <div aria-hidden className="res-rejilla pointer-events-none absolute inset-0" />

      <div className="relative mx-auto max-w-[1180px] px-6 pb-20 pt-10 sm:px-10">
        {centro ? (
          <VistaAbierta
            grupo={centro}
            otros={gs.filter((g) => g.id !== centro.id)}
            onCerrar={() => setAbierto(null)}
            onCambiar={setAbierto}
            onIrATarjeta={onIrATarjeta}
          />
        ) : (
          <VistaPortada grupos={gs} onAbrir={setAbierto} />
        )}

        {/* ── Las cifras vivas ── */}
        <div className="mt-12 border-t border-hueso/10 pt-6">
          <p className="text-[10px] uppercase tracking-[.2em] text-taupe">
            Lo que hay guardado ahora mismo
          </p>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
            {CIFRAS_PORTADA.map((id) => {
              const m = cifra(id)
              return (
                <div key={id}>
                  <p className="font-display text-[26px] font-bold leading-none text-white">
                    {m?.valor?.toLocaleString('es-CO') ?? '—'}
                  </p>
                  <p className="mt-1.5 text-[11px] font-light leading-tight text-hueso/50">
                    {m?.etiqueta ?? 'sin leer'}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Estado cerrado: las cinco tarjetas ───────────────────────────────────────

function VistaPortada({ grupos: gs, onAbrir }: { grupos: Grupo[]; onAbrir: (id: string) => void }) {
  return (
    <>
      <p className="text-[10px] uppercase tracking-[.28em] text-taupe">De un vistazo</p>
      <h2 className="mt-2 max-w-2xl font-display text-[clamp(1.75rem,3.4vw,2.6rem)] font-thin leading-[1.1] text-white">
        El sistema completo, <span className="font-bold">de un vistazo</span>
      </h2>
      <p className="mt-3 max-w-xl text-[13px] font-light leading-relaxed text-hueso/60">
        Toca una tarjeta y pasa al centro con lo que contiene. Desde ahí se va directo: las
        aplicaciones abren donde están publicadas, los módulos abren su pantalla, y las etapas pasan
        al centro del mapa.
      </p>

      <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gs.map((g, i) => (
          <Navcard key={g.id} grupo={g} orden={i} onClick={() => onAbrir(g.id)} />
        ))}
      </div>
    </>
  )
}

// ─── Estado abierto: la tarjeta al centro y sus cuadros ───────────────────────

function VistaAbierta({
  grupo,
  otros,
  onCerrar,
  onCambiar,
  onIrATarjeta,
}: {
  grupo: Grupo
  otros: Grupo[]
  onCerrar: () => void
  onCambiar: (id: string) => void
  onIrATarjeta: (id: string) => void
}) {
  // Los chips de «ver también» están al final, así que al saltar de categoría
  // el centro queda arriba, fuera de la pantalla, y parece que no pasó nada.
  // Cada vez que cambia el grupo se vuelve al principio.
  const tope = useRef<HTMLDivElement>(null)
  useEffect(() => {
    tope.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [grupo.id])

  return (
    <div ref={tope} className="scroll-mt-6" style={{ '--tono': grupo.color } as React.CSSProperties}>
      <button
        type="button"
        onClick={onCerrar}
        className="flex items-center gap-2 text-[10px] uppercase tracking-[.2em] text-hueso/45 transition-colors hover:text-hueso"
      >
        <ArrowLeft size={12} /> Todas las tarjetas
      </button>

      {/* La tarjeta elegida, al centro y en grande. */}
      <div className="res-centro mt-6 flex flex-col items-center text-center">
        <span className="res-icono-centro grid h-12 w-12 place-items-center border" style={{ color: grupo.color }}>
          {grupo.icono}
        </span>
        <span className="res-cifra-centro mt-4 block font-display text-[76px] font-bold leading-none">
          {grupo.elementos.length}
        </span>
        <h2 className="mt-1 font-display text-[22px] font-semibold text-white">{grupo.titulo}</h2>
        <p className="mt-1 text-[11px] uppercase tracking-[.18em] text-hueso/45">{grupo.unidad}</p>
        <p className="mt-3 max-w-lg text-[13px] font-light leading-relaxed text-hueso/60">{grupo.que}</p>
      </div>

      {/* Lo que contiene, en cuadros de colores. */}
      <div className="mt-9 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {grupo.elementos.map((el, i) => (
          <Cuadro key={el.id} elemento={el} color={RUEDA[i % RUEDA.length]} orden={i} onIrATarjeta={onIrATarjeta} />
        ))}
      </div>

      {/* Saltar a otra categoría sin volver atrás. */}
      <div className="mt-10 flex flex-wrap items-center gap-2.5 border-t border-hueso/10 pt-6">
        <span className="mr-1 text-[10px] uppercase tracking-[.2em] text-taupe">Ver también</span>
        {otros.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onCambiar(o.id)}
            className="res-chip flex items-center gap-2 border border-hueso/15 px-3 py-1.5 text-[11px] text-hueso/65 transition-colors"
            style={{ '--tono': o.color } as React.CSSProperties}
          >
            <i className="h-1.5 w-1.5 shrink-0" style={{ background: o.color }} />
            {o.titulo}
            <span className="font-display font-semibold text-hueso/40">{o.elementos.length}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Una navcard de categoría ─────────────────────────────────────────────────

function Navcard({ grupo, orden, onClick }: { grupo: Grupo; orden: number; onClick: () => void }) {
  // La unidad solo se escribe si dice algo que el título no diga ya: bajo
  // «Aplicaciones» sobra repetir «aplicaciones».
  const unidadVisible =
    grupo.unidad.toLowerCase() === grupo.titulo.toLowerCase() ? null : grupo.unidad

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseMove={seguirPuntero}
      className="res-card group relative overflow-hidden border border-hueso/10 px-5 pb-5 pt-4 text-left backdrop-blur-md transition-all duration-300 hover:-translate-y-1"
      style={{ '--tono': grupo.color, animationDelay: `${orden * 70}ms` } as React.CSSProperties}
    >
      <span aria-hidden className="res-foco pointer-events-none absolute inset-0" />
      <span aria-hidden className="res-brillo pointer-events-none absolute inset-0" />
      <span aria-hidden className="res-filete pointer-events-none absolute inset-x-0 top-0 h-px" />

      <span className="relative flex items-center gap-2 text-[10px] uppercase tracking-[.2em] text-hueso/55">
        <span className="res-icono" style={{ color: grupo.color }}>
          {grupo.icono}
        </span>
        {grupo.titulo}
      </span>

      <span className="res-cifra relative mt-3 block font-display text-[58px] font-bold leading-none">
        {grupo.elementos.length}
      </span>

      {unidadVisible && (
        <span className="relative mt-1 block text-[11px] uppercase tracking-[.16em] text-hueso/45">
          {unidadVisible}
        </span>
      )}

      <span className={`relative block text-[12px] font-light leading-relaxed text-hueso/65 ${unidadVisible ? 'mt-3' : 'mt-4'}`}>
        {grupo.que}
      </span>

      <span className="relative mt-3.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[.16em] text-hueso/40 transition-colors group-hover:text-hueso/80">
        Abrir
        <ArrowRight size={12} className="transition-transform duration-300 group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}

// ─── Un cuadro de elemento ────────────────────────────────────────────────────

function Cuadro({
  elemento,
  color: tono,
  orden,
  onIrATarjeta,
}: {
  elemento: Elemento
  color: string
  orden: number
  onIrATarjeta: (id: string) => void
}) {
  const cuerpo = (
    <>
      <span aria-hidden className="res-foco pointer-events-none absolute inset-0" />
      <span aria-hidden className="res-filete pointer-events-none absolute inset-x-0 top-0 h-px" />

      <span className="relative flex items-start justify-between gap-3">
        <span className="font-display text-[15px] font-semibold leading-tight text-white">
          {elemento.nombre}
        </span>
        <IconoDestino destino={elemento.destino} />
      </span>

      <span className="relative mt-2 block text-[12px] font-light leading-relaxed text-hueso/60">
        {elemento.detalle}
      </span>

      <span className="relative mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        {elemento.nota && (
          <span className="res-nota text-[9.5px] uppercase tracking-[.16em]">{elemento.nota}</span>
        )}
        {elemento.estado && elemento.estado !== 'produccion' && (
          <span className="border border-hueso/20 px-1.5 py-px text-[9px] uppercase tracking-[.14em] text-hueso/45">
            {ESTADO_LABEL[elemento.estado]}
          </span>
        )}
      </span>
    </>
  )

  const clase =
    'res-cuadro group relative block overflow-hidden border border-hueso/10 py-3.5 pl-[18px] pr-4 text-left backdrop-blur-md transition-all duration-300'
  const estilo = { '--tono': tono, animationDelay: `${orden * 45}ms` } as React.CSSProperties

  if (elemento.destino.tipo === 'sin_enlace') {
    return (
      <div className={`${clase} opacity-55`} style={estilo} title={elemento.destino.porque}>
        {cuerpo}
      </div>
    )
  }

  if (elemento.destino.tipo === 'tarjeta') {
    const id = elemento.destino.id
    return (
      <button type="button" onClick={() => onIrATarjeta(id)} className={`${clase} w-full hover:-translate-y-1`} style={estilo}>
        {cuerpo}
      </button>
    )
  }

  const { url, externo } = elemento.destino
  return externo ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className={`${clase} hover:-translate-y-1`}
      style={estilo}
      title={url}
    >
      {cuerpo}
    </a>
  ) : (
    <Link href={url} className={`${clase} hover:-translate-y-1`} style={estilo}>
      {cuerpo}
    </Link>
  )
}

/** La esquina dice a dónde lleva: fuera, dentro, al mapa, o a ninguna parte. */
function IconoDestino({ destino }: { destino: Destino }) {
  if (destino.tipo === 'sin_enlace') {
    return (
      <span className="shrink-0 text-[9px] uppercase tracking-[.14em] text-hueso/30">
        {destino.porque}
      </span>
    )
  }
  const Icono = destino.tipo === 'sitio' && destino.externo ? ArrowUpRight : ArrowRight
  return <Icono size={14} className="res-flecha mt-0.5 shrink-0" />
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/**
 * El foco de luz sigue al puntero. Se escribe como variables CSS sobre el propio
 * nodo en vez de guardarlo en estado: es un efecto de presentación y no tiene
 * por qué volver a renderizar la tarjeta en cada movimiento.
 */
function seguirPuntero(e: React.MouseEvent<HTMLElement>) {
  const c = e.currentTarget
  const r = c.getBoundingClientRect()
  c.style.setProperty('--mx', `${e.clientX - r.left}px`)
  c.style.setProperty('--my', `${e.clientY - r.top}px`)
}

// ─── El CSS del efecto ────────────────────────────────────────────────────────

const CSS = `
.res-fondo { background: var(--color-tinta); }

/* Cuatro resplandores, cada uno a su ritmo. Van en modo screen: sobre tinta la
   luz se SUMA en vez de taparse, que es lo que hace que se lean como brillo y
   no como manchas de pintura.
   Ojo con qué tonos de la paleta sirven aquí: bosque y pizarra son oscuros y
   sobre tinta casi no levantan. Los que brillan son los claros —ámbar, cielo,
   salvia, musgo, primary-light—, así que el resplandor sale de ellos y los
   oscuros se quedan de base. */
.res-halos {
  background:
    radial-gradient(40rem 40rem at 8% 2%,   color-mix(in srgb, var(--color-primary-light) 95%, transparent), transparent 62%),
    radial-gradient(34rem 34rem at 94% 10%, color-mix(in srgb, var(--color-cielo) 78%, transparent),         transparent 62%),
    radial-gradient(38rem 38rem at 78% 98%, color-mix(in srgb, var(--color-ambar) 72%, transparent),         transparent 64%),
    radial-gradient(28rem 28rem at 14% 86%, color-mix(in srgb, var(--color-musgo) 92%, transparent),         transparent 64%);
  filter: saturate(1.35);
  mix-blend-mode: screen;
  opacity: .62;
  animation: res-derivar 34s ease-in-out infinite alternate;
}

/* Un segundo cuerpo de luz más pequeño y más vivo, moviéndose en contra. Es el
   que hace que el fondo no parezca una imagen fija. */
.res-aurora {
  background:
    radial-gradient(24rem 18rem at 34% 24%, color-mix(in srgb, var(--color-salvia) 34%, transparent),  transparent 70%),
    radial-gradient(20rem 15rem at 68% 60%, color-mix(in srgb, var(--color-celeste) 30%, transparent), transparent 70%),
    radial-gradient(16rem 12rem at 52% 88%, color-mix(in srgb, var(--color-ambar) 26%, transparent),   transparent 70%);
  filter: blur(30px);
  mix-blend-mode: screen;
  opacity: .8;
  animation: res-ondear 26s ease-in-out infinite alternate;
}

@keyframes res-derivar {
  from { transform: translate3d(-3%, -2%, 0) scale(1.06); }
  to   { transform: translate3d(3%, 3%, 0) scale(1.16); }
}

@keyframes res-ondear {
  from { transform: translate3d(4%, 3%, 0) scale(1.1); }
  to   { transform: translate3d(-5%, -4%, 0) scale(1.3); }
}

/* Una rejilla finísima encima: le da textura y evita que los degradados se vean
   como una mancha. */
.res-rejilla {
  background-image:
    linear-gradient(to right,  color-mix(in srgb, var(--color-hueso) 5%, transparent) 1px, transparent 1px),
    linear-gradient(to bottom, color-mix(in srgb, var(--color-hueso) 5%, transparent) 1px, transparent 1px);
  background-size: 68px 68px;
  mask-image: radial-gradient(75% 60% at 50% 30%, #000, transparent 100%);
}

/* ── Tarjetas y cuadros: el mismo cuerpo, distinto tamaño ── */

.res-card, .res-cuadro {
  background: color-mix(in srgb, var(--color-tinta) 55%, transparent);
  animation: res-entrar .5s cubic-bezier(.2,.7,.3,1) backwards;
  box-shadow: 0 10px 30px -18px #000;
}
.res-card:hover, .res-cuadro:hover {
  border-color: color-mix(in srgb, var(--tono) 60%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--tono) 28%, transparent),
              0 18px 50px -18px color-mix(in srgb, var(--tono) 75%, transparent);
}

/* Los cuadros de dentro llevan su color puesto EN REPOSO, no solo al pasar por
   encima: son siete cosas distintas y el color es lo que las separa de un
   vistazo. El baño se queda arriba y se disuelve enseguida, para que el texto
   siga leyéndose sobre tinta. */
.res-cuadro {
  background:
    linear-gradient(to bottom,
      color-mix(in srgb, var(--tono) 16%, transparent) 0%,
      transparent 42%),
    color-mix(in srgb, var(--color-tinta) 58%, transparent);
  border-color: color-mix(in srgb, var(--tono) 30%, transparent);
}
.res-cuadro::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 2px;
  background: var(--tono);
  opacity: .7;
  transition: opacity .3s;
}
.res-cuadro:hover::before { opacity: 1; }

/* El filete de luz de arriba: tenue en las tarjetas grandes, encendido en los
   cuadros de color, y a tope en cuanto se toca cualquiera de los dos. */
.res-filete {
  background: linear-gradient(to right, transparent,
              color-mix(in srgb, var(--tono) 85%, transparent), transparent);
  opacity: .3;
  transition: opacity .35s;
}
.res-cuadro .res-filete { opacity: .8; }
.res-card:hover .res-filete, .res-cuadro:hover .res-filete { opacity: 1; }

/* El foco que sigue al puntero. Las variables las escribe React al moverse; en
   los cuadros no hay seguimiento, así que se queda centrado arriba. */
.res-foco {
  background: radial-gradient(16rem 16rem at var(--mx, 50%) var(--my, 0%),
              color-mix(in srgb, var(--tono) 26%, transparent), transparent 70%);
  opacity: 0;
  transition: opacity .3s;
}
.res-card:hover .res-foco, .res-cuadro:hover .res-foco { opacity: 1; }

/* El barrido diagonal. Vive en un pseudo-elemento para no añadir otro nodo. */
.res-brillo::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 35%,
              color-mix(in srgb, var(--tono) 20%, transparent) 50%, transparent 65%);
  transform: translateX(-100%);
  transition: transform .8s cubic-bezier(.2,.7,.3,1);
}
.res-card:hover .res-brillo::after { transform: translateX(100%); }

/* La cifra: el tono de la paleta aclarado en las dos puntas y puro en medio.
   El degradado NO baja hacia el negro en ningún tramo: musgo y los demás tonos
   terrosos son oscuros de por sí y sobre tinta se hundían hasta desaparecer —
   el 3 de Conservación no se leía. Aclarar en vez de oscurecer los salva a
   todos sin tener que cambiarle el color a ningún grupo. */
.res-cifra, .res-cifra-centro {
  background: linear-gradient(168deg,
              color-mix(in srgb, var(--tono) 30%, #fff) 0%,
              var(--tono) 55%,
              color-mix(in srgb, var(--tono) 65%, #fff) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 22px color-mix(in srgb, var(--tono) 75%, transparent));
  transition: filter .35s;
}
.res-card:hover .res-cifra { filter: drop-shadow(0 0 30px var(--tono)); }
.res-cifra-centro { filter: drop-shadow(0 0 34px color-mix(in srgb, var(--tono) 85%, transparent)); }

.res-icono { filter: drop-shadow(0 0 8px color-mix(in srgb, var(--tono) 70%, transparent)); }

/* ── La tarjeta que pasó al centro ── */

.res-centro { animation: res-al-centro .55s cubic-bezier(.2,.7,.3,1) backwards; }
.res-icono-centro {
  border-color: color-mix(in srgb, var(--tono) 45%, transparent);
  background: color-mix(in srgb, var(--tono) 10%, transparent);
  box-shadow: 0 0 26px -6px color-mix(in srgb, var(--tono) 70%, transparent);
}

@keyframes res-al-centro {
  from { opacity: 0; transform: scale(.88) translateY(16px); }
  to   { opacity: 1; transform: none; }
}

/* ── Los chips para saltar de categoría ── */

.res-chip:hover {
  border-color: color-mix(in srgb, var(--tono) 55%, transparent);
  background: color-mix(in srgb, var(--tono) 12%, transparent);
  color: #fff;
}

/* ── Flechas y notas del cuadro ── */

.res-flecha { color: color-mix(in srgb, var(--tono) 60%, transparent); transition: transform .25s, color .25s; }
.res-cuadro:hover .res-flecha { color: var(--tono); transform: translate(2px, -2px); }

.res-nota { color: color-mix(in srgb, var(--tono) 72%, transparent); }

@keyframes res-entrar {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: none; }
}

/* Quien pidió menos movimiento no ve ninguno: el fondo se queda quieto y las
   tarjetas aparecen sin desplazarse. Los colores y los halos se quedan — lo que
   molesta es el movimiento, no el brillo. */
@media (prefers-reduced-motion: reduce) {
  .res-halos, .res-aurora { animation: none; }
  .res-card, .res-cuadro, .res-centro { animation: none; }
  .res-brillo::after { display: none; }
  .res-card:hover, .res-cuadro:hover { transform: none; }
}
`
