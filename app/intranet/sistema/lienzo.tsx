'use client'

/**
 * EL LIENZO DEL MAPA
 * ──────────────────
 * Las tarjetas y las líneas, dibujadas como un diagrama entidad-relación: cada
 * tarjeta tiene un encabezado con su nombre y debajo unas pocas filas, como las
 * columnas de una tabla. Las líneas son punteadas y cortas; en reposo solo se
 * ve el flujo del trabajo y qué app trabaja en cada etapa. Lo demás aparece al
 * elegir una tarjeta.
 *
 * Todo el dibujo está en coordenadas fijas (disposicion.ts) y se escala entero,
 * así que ajustarlo al ancho de la pantalla no obliga a recalcular nada.
 */

import {
  useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as EventoPuntero,
} from 'react'
import { MARCA } from '@/lib/expediente-formato'
import {
  APP_POR_ID, ETAPA_POR_ID, ESTADO_LABEL, etapasDe, etapasDeApp,
  type ClaseApp,
} from '@/lib/sistema/mapa'
import { NODOS, vecinosDe, type Nodo } from '@/lib/sistema/relaciones'
import {
  CAJAS, CARRILES, COLOR_APP, COLOR_LINEA, LIENZO, TARJETA, TRAZOS, altoDe, colorDe, trazoDe,
} from './disposicion'
import { PuntoEstado } from './piezas'
import type { LectorDeCifras } from './mapa-vista'
import { FileSpreadsheet, Globe, Maximize2, Minus, Monitor, Plus, Smartphone } from 'lucide-react'

const ICONO_CLASE: Record<ClaseApp, typeof Monitor> = {
  'En la oficina': Monitor,
  'En el celular, en campo': Smartphone,
  'Abierto al público': Globe,
  'Todavía fuera del sistema': FileSpreadsheet,
}

type Visual = 'normal' | 'elegida' | 'vecina' | 'apagada'

export function Lienzo({
  elegidas,
  onAlternar,
  cifra,
}: {
  elegidas: string[]
  onAlternar: (id: string) => void
  cifra: LectorDeCifras
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [anchoVisible, setAnchoVisible] = useState(0)
  const [modo, setModo] = useState<'ajustar' | number>('ajustar')
  const [encima, setEncima] = useState<string | null>(null)
  const arrastre = useRef<{ x: number; sl: number } | null>(null)

  // El lienzo se ajusta al ancho disponible; por debajo del 70 % ya no se lee
  // bien, así que a partir de ahí se desplaza en vez de encogerse más.
  useEffect(() => {
    const el = panel.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setAnchoVisible(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const ajuste = anchoVisible ? Math.min(1, Math.max(0.7, anchoVisible / LIENZO.ancho)) : 1
  const escala = modo === 'ajustar' ? ajuste : modo
  const zoom = (d: number) =>
    setModo((m) => {
      const actual = m === 'ajustar' ? ajuste : m
      return Math.min(1.4, Math.max(0.5, Math.round((actual + d) * 10) / 10))
    })

  const sel = useMemo(() => new Set(elegidas), [elegidas])
  const vecinas = useMemo(() => {
    const v = new Set<string>()
    for (const id of sel) for (const x of vecinosDe(id)) if (!sel.has(x)) v.add(x)
    return v
  }, [sel])

  const visualDe = (id: string): Visual =>
    sel.has(id) ? 'elegida' : sel.size === 0 ? 'normal' : vecinas.has(id) ? 'vecina' : 'apagada'

  // Arrastrar el fondo desplaza el lienzo, como en un diagrama de base de datos.
  const alPresionar = (e: EventoPuntero<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-tarjeta], button')) return
    arrastre.current = { x: e.clientX, sl: e.currentTarget.scrollLeft }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const alMover = (e: EventoPuntero<HTMLDivElement>) => {
    const a = arrastre.current
    if (a) e.currentTarget.scrollLeft = a.sl - (e.clientX - a.x)
  }
  const alSoltar = () => { arrastre.current = null }

  return (
    <div className="relative border border-linea bg-white">
      {/* Zoom, abajo a la derecha: es la esquina que el diagrama deja libre. */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center border border-linea bg-white/95 text-tenue shadow-sm">
        <button type="button" onClick={() => zoom(-0.1)} className="p-1.5 hover:text-tinta" aria-label="Alejar">
          <Minus size={13} />
        </button>
        <span className="w-11 text-center text-[10.5px] tabular-nums">{Math.round(escala * 100)} %</span>
        <button type="button" onClick={() => zoom(0.1)} className="p-1.5 hover:text-tinta" aria-label="Acercar">
          <Plus size={13} />
        </button>
        <button
          type="button"
          onClick={() => setModo('ajustar')}
          className={`border-l border-linea p-1.5 hover:text-tinta ${modo === 'ajustar' ? 'text-bosque' : ''}`}
          aria-label="Ajustar al ancho"
          title="Ajustar al ancho"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      <div
        ref={panel}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        className="cursor-grab overflow-x-auto overflow-y-hidden active:cursor-grabbing"
        style={{
          // La trama de puntos del fondo, como la de un editor de diagramas.
          backgroundImage: 'radial-gradient(circle, rgba(125,118,105,.22) 1px, transparent 1.2px)',
          backgroundSize: `${16 * escala}px ${16 * escala}px`,
        }}
      >
        <div style={{ width: LIENZO.ancho * escala, height: LIENZO.alto * escala, position: 'relative' }}>
          <div
            style={{
              width: LIENZO.ancho,
              height: LIENZO.alto,
              transform: `scale(${escala})`,
              transformOrigin: '0 0',
              position: 'absolute',
              inset: 0,
            }}
          >
            {CARRILES.map((c) => (
              <div
                key={c.id}
                className="absolute"
                style={{ left: 8, right: 8, top: c.y, height: c.h, background: `${c.color}0a`, borderLeft: `2px solid ${c.color}40` }}
              >
                <span
                  className="absolute left-0 top-0 flex h-full w-8 items-center justify-center font-display text-[9px] font-semibold uppercase tracking-[.22em]"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: c.color }}
                >
                  {c.nombre}
                </span>
              </div>
            ))}

            <Lineas sel={sel} encima={encima} />

            {NODOS.map((n) => {
              const caja = CAJAS.get(n.id)
              if (!caja) return null
              return (
                <Tarjeta
                  key={n.id}
                  nodo={n}
                  estilo={{ left: caja.x, top: caja.y }}
                  visual={visualDe(n.id)}
                  cifra={cifra}
                  onClick={() => onAlternar(n.id)}
                  onEncima={(dentro) => setEncima(dentro ? n.id : null)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Las líneas ───────────────────────────────────────────────────────────────

function Lineas({ sel, encima }: { sel: Set<string>; encima: string | null }) {
  const foco = sel.size ? sel : encima ? new Set([encima]) : null

  return (
    <svg
      width={LIENZO.ancho}
      height={LIENZO.alto}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <defs>
        {Object.entries(COLOR_LINEA).flatMap(([tipo, c]) =>
          (['normal', 'activa'] as const).map((v) => (
            <marker
              key={`${tipo}-${v}`}
              id={`punta-${tipo}-${v}`}
              viewBox="0 0 8 8"
              refX={tipo === 'avance' || tipo === 'devolucion' ? 7 : 4}
              refY="4"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              {/* El color va en `style` y no como atributo: así acepta las
                  variables de la paleta (var(--color-tenue)). */}
              {tipo === 'avance' || tipo === 'devolucion'
                ? <path d="M1,1 L7,4 L1,7" fill="none" style={{ stroke: c[v] }} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                : <circle cx="4" cy="4" r="2.2" style={{ fill: c[v] }} />}
            </marker>
          )),
        )}
      </defs>

      {TRAZOS.map(({ r, d, enReposo }) => {
        const toca = !!foco && (foco.has(r.de) || foco.has(r.a))
        const entreElegidas = sel.has(r.de) && sel.has(r.a)
        if (!enReposo && !toca) return null
        const apagada = sel.size > 0 && !toca
        const v = toca ? 'activa' : 'normal'
        const flecha = r.tipo === 'avance' || r.tipo === 'devolucion'
        return (
          <path
            key={r.id}
            d={d}
            fill="none"
            style={{ stroke: COLOR_LINEA[r.tipo][v] }}
            strokeWidth={entreElegidas ? 2.2 : toca ? 1.8 : 1.4}
            strokeDasharray={trazoDe(r.tipo)}
            strokeLinecap="round"
            opacity={apagada ? 0.3 : 1}
            markerStart={flecha ? undefined : `url(#punta-${r.tipo}-${v})`}
            markerEnd={`url(#punta-${r.tipo}-${v})`}
          />
        )
      })}
    </svg>
  )
}

// ─── Una tarjeta ──────────────────────────────────────────────────────────────

/**
 * La tarjeta no sabe dónde está: su posición llega en `estilo`. El lienzo la
 * pone con `left`/`top`; la escena de la vista Explorar la mueve con
 * `transform` para poder animar el viaje de un puesto a otro.
 */
export function Tarjeta({
  nodo, visual, cifra, onClick, onEncima, estilo, inerte = false,
}: {
  nodo: Nodo
  visual: Visual
  cifra: LectorDeCifras
  onClick: () => void
  onEncima?: (dentro: boolean) => void
  estilo?: CSSProperties
  /** Está en pantalla pero no se puede tocar (la escena la tiene escondida). */
  inerte?: boolean
}) {
  const app = nodo.tipo === 'app' ? APP_POR_ID.get(nodo.id) : null
  const etapa = nodo.tipo === 'etapa' ? ETAPA_POR_ID.get(nodo.id) : null
  const porConstruir = nodo.estado === 'por_construir'
  const color = colorDe(nodo.id)
  const Icono = app ? ICONO_CLASE[app.clase] : null
  const colorBorde = visual === 'elegida' ? MARCA.bosque : visual === 'vecina' ? MARCA.taupe : 'var(--color-linea)'
  const borde = `1px ${porConstruir ? 'dashed' : 'solid'} ${colorBorde}`

  let rotulo = 'Núcleo compartido'
  if (etapa) {
    const n = etapasDe(etapa.dominio).findIndex((e) => e.id === etapa.id) + 1
    rotulo = `Etapa ${String(n).padStart(2, '0')}`
  } else if (app) rotulo = 'Aplicación'
  else if (nodo.dominio === 'soporte') rotulo = 'Soporte'

  const filas: [string, string][] = etapa
    ? [['Quién', etapa.enBreve.quien], ['Entrega', etapa.enBreve.entrega]]
    : app
      ? [
          ['Dónde', app.dondeCorto],
          ['Trabaja', etapasDeApp(app.id).map((e) => e.enBreve.nombre).join(', ') || 'Todavía en nada'],
        ]
      : []

  const principal = etapa?.pulso[0] ? cifra(etapa.pulso[0]) : null

  return (
    <div
      data-tarjeta
      role="button"
      tabIndex={inerte ? -1 : 0}
      aria-hidden={inerte || undefined}
      aria-pressed={visual === 'elegida'}
      aria-label={`${nodo.nombre}${nodo.estado ? ` — ${ESTADO_LABEL[nodo.estado]}` : ''}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      onPointerEnter={() => onEncima?.(true)}
      onPointerLeave={() => onEncima?.(false)}
      className="absolute flex cursor-pointer flex-col overflow-hidden bg-white outline-none transition-[opacity,box-shadow,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-bosque/50"
      style={{
        width: TARJETA.ancho,
        height: altoDe(nodo.id),
        // Un lado por propiedad: mezclar `borderColor` con `borderTopColor` hace
        // que React avise de estilos que se pisan al volver a pintar.
        borderTop: `2px solid ${color}`,
        borderRight: borde,
        borderBottom: borde,
        borderLeft: borde,
        boxShadow:
          visual === 'elegida'
            ? `0 0 0 1px ${MARCA.bosque}, 0 8px 22px rgba(47,63,50,.16)`
            : '0 1px 2px rgba(30,26,24,.05)',
        opacity: visual === 'apagada' ? 0.38 : 1,
        pointerEvents: inerte ? 'none' : undefined,
        ...estilo,
      }}
    >
      {/* Encabezado, como el nombre de una tabla */}
      <div
        className={`flex shrink-0 flex-col border-b border-fina px-3 pb-1.5 pt-2 ${app ? 'bg-hueso/40' : visual === 'elegida' ? 'bg-papel' : ''}`}
        style={{ height: TARJETA.cabeza }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-[8.5px] font-semibold uppercase tracking-[.2em] text-tenue">{rotulo}</span>
          {nodo.estado && <PuntoEstado estado={nodo.estado} size={7} />}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {Icono && <Icono size={12} className="shrink-0" style={{ color: COLOR_APP }} />}
          <span
            className={`line-clamp-2 font-display text-[14px] font-semibold leading-[1.15] ${porConstruir ? 'text-suave' : 'text-tinta'}`}
          >
            {nodo.nombre}
          </span>
        </div>
      </div>

      {/* Filas, como las columnas de una tabla */}
      <div className="flex-1" style={{ paddingTop: TARJETA.relleno / 2, paddingBottom: TARJETA.relleno / 2 }}>
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex items-center gap-2 px-3" style={{ height: TARJETA.fila }}>
            <span className="w-[46px] shrink-0 text-[8.5px] uppercase tracking-[.14em] text-tenue">{etiqueta}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-suave" title={valor}>{valor}</span>
          </div>
        ))}
        {nodo.tipo === 'pieza' && nodo.datos.map((d) => {
          const m = d.pulso ? cifra(d.pulso) : null
          return (
            <div key={d.nombre} className="flex items-center gap-2 px-3" style={{ height: TARJETA.fila }}>
              <i className="h-[5px] w-[5px] shrink-0" style={{ background: color, opacity: 0.55 }} />
              <span className="min-w-0 flex-1 truncate text-[11px] text-suave">{d.etiqueta ?? d.nombre}</span>
              <span className="shrink-0 text-[11px] font-medium tabular-nums text-tinta">
                {m?.valor != null ? m.valor.toLocaleString('es-CO') : ''}
              </span>
            </div>
          )
        })}
      </div>

      {/* Pie: la cifra viva de la etapa */}
      {etapa && (
        <div className="flex shrink-0 items-baseline gap-1.5 border-t border-fina px-3 pt-[7px]" style={{ height: TARJETA.pie }}>
          {principal && principal.valor !== null ? (
            <>
              <span className="font-display text-[15px] font-bold leading-none tabular-nums text-bosque">
                {principal.valor.toLocaleString('es-CO')}
              </span>
              <span className="truncate text-[10px] text-tenue">{principal.etiqueta}</span>
            </>
          ) : (
            <span className="text-[10px] text-tenue">
              {porConstruir ? 'todavía no produce datos' : principal ? 'sin datos' : 'no escribe en la base'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
