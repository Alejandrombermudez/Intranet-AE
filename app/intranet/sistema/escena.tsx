'use client'

/**
 * LA ESCENA — la vista Explorar del mapa
 * ──────────────────────────────────────
 * Una tarjeta a la vez. Al elegirla viaja al centro y a su alrededor se acomoda
 * todo lo que la toca: lo que viene antes a la izquierda, lo que sigue a la
 * derecha, las aplicaciones arriba y dónde guarda, abajo. Tocar una de las de
 * alrededor la trae al centro, y así se recorre el sistema de una en una.
 *
 * Las tarjetas son siempre los mismos elementos; solo cambian de puesto y el
 * navegador anima el viaje con transiciones de CSS, sin librerías. Los puestos
 * salen de `disposicionFoco()` en disposicion.ts.
 *
 * Si la persona tiene activado «reducir movimiento» en su equipo, todo cambia
 * de lugar sin animarse.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { MARCA } from '@/lib/expediente-formato'
import { NODOS, NODO_POR_ID } from '@/lib/sistema/relaciones'
import {
  CARRILES, COLOR_LINEA_OSCURO, LIENZO, TRAZOS, disposicionFoco, trazoDe,
} from './disposicion'
import { Tarjeta } from './lienzo'
import { Ficha } from './ficha'
import { Bloque } from './piezas'
import type { LectorDeCifras } from './mapa-vista'

const VIAJE = 'transform .8s cubic-bezier(.22,1,.36,1), opacity .5s ease, box-shadow .3s ease'
const MARGEN = { arriba: 48, abajo: 40 }
/** Aire alrededor del grupo cuando la cámara se acerca. */
const HOLGURA = 56

export function Escena({
  recorrido, cifra, onIr, onVolverA, onMapa,
}: {
  /** Lo que se ha visitado, en orden. La última es la que está en el centro. */
  recorrido: string[]
  cifra: LectorDeCifras
  onIr: (id: string) => void
  onVolverA: (indice: number) => void
  onMapa: () => void
}) {
  const foco = recorrido.length ? recorrido[recorrido.length - 1] : null
  const { puestos, trazos, marco } = useMemo(() => disposicionFoco(foco), [foco])
  const caja = useRef<HTMLDivElement>(null)
  const [tam, setTam] = useState({ w: 0, h: 0 })
  const [encima, setEncima] = useState<string | null>(null)

  // El mapa entero cabe en el escenario, sin desplazarse: se escala al espacio
  // que haya y queda centrado. Se mide una vez al montar y luego con cada
  // cambio de tamaño; solo con el observador, una pestaña abierta en segundo
  // plano no medía hasta que alguien la mirara.
  useEffect(() => {
    const el = caja.current
    if (!el) return
    const medir = () => setTam({ w: el.clientWidth, h: el.clientHeight })
    const primera = setTimeout(medir, 0)
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => {
      clearTimeout(primera)
      ro.disconnect()
    }
  }, [])
  // Arriba queda el recorrido y abajo la pista: el mapa no se mete debajo.
  const libre = tam.h - MARGEN.arriba - MARGEN.abajo
  const s = tam.w ? Math.min(tam.w / LIENZO.ancho, libre / LIENZO.alto) : 0
  // La cámara: con el mapa completo se ve todo; con una tarjeta en el centro,
  // se acerca hasta que su grupo llena el escenario. No pasa de 1,2×: más
  // grande ya no ayuda a leer y la tarjeta del centro ya va ampliada.
  const camara =
    foco && tam.w
      ? (() => {
          const k = Math.min(1.2, tam.w / (marco.w + 2 * HOLGURA), libre / (marco.h + 2 * HOLGURA))
          return {
            k,
            x: tam.w / 2 - (marco.x + marco.w / 2) * k,
            y: MARGEN.arriba + libre / 2 - (marco.y + marco.h / 2) * k,
          }
        })()
      : { k: s, x: (tam.w - LIENZO.ancho * s) / 2, y: MARGEN.arriba + (libre - LIENZO.alto * s) / 2 }

  return (
    <div className="bg-tinta text-hueso">
      <div className="grid xl:grid-cols-[minmax(0,1fr)_400px]">
        <div ref={caja} className="relative h-[72vh] min-h-[520px] overflow-hidden xl:h-[calc(100vh-5rem)]">
          {/* Fondo: trama de puntos y un halo verde que se aviva al entrar */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(228,222,210,.10) 1px, transparent 1.3px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div
            aria-hidden="true"
            className="escena-mov absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse 55% 50% at 50% 50%, rgba(88,112,92,.42), transparent 70%)',
              opacity: foco ? 1 : 0.35,
              transition: 'opacity .8s ease',
            }}
          />

          {s > 0 && (
            <div
              className="escena-mov"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: LIENZO.ancho,
                height: LIENZO.alto,
                transform: `translate(${camara.x}px, ${camara.y}px) scale(${camara.k})`,
                transformOrigin: '0 0',
                transition: 'transform .8s cubic-bezier(.22,1,.36,1)',
              }}
            >
              {CARRILES.map((c) => (
                <div
                  key={c.id}
                  aria-hidden="true"
                  className="escena-mov absolute"
                  style={{
                    left: 8,
                    right: 8,
                    top: c.y,
                    height: c.h,
                    background: 'rgba(228,222,210,.035)',
                    borderLeft: `2px solid ${c.color === MARCA.bosque ? MARCA.salvia : c.color}`,
                    opacity: foco ? 0 : 1,
                    transition: 'opacity .5s ease',
                  }}
                >
                  <span
                    className="absolute left-0 top-0 flex h-full w-8 items-center justify-center font-display text-[9px] font-semibold uppercase tracking-[.22em] text-taupe"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    {c.nombre}
                  </span>
                </div>
              ))}

              <Lineas foco={foco} trazos={trazos} encima={encima} />

              {NODOS.map((n) => {
                const p = puestos.get(n.id)
                if (!p) return null
                const fuera = p.lado === 'fuera'
                const centro = p.lado === 'centro'
                return (
                  <Tarjeta
                    key={n.id}
                    nodo={n}
                    visual={centro ? 'elegida' : 'normal'}
                    cifra={cifra}
                    inerte={fuera}
                    onClick={() => { if (!centro) onIr(n.id) }}
                    onEncima={(dentro) => setEncima(dentro ? n.id : null)}
                    estilo={{
                      left: 0,
                      top: 0,
                      transform: `translate(${p.x}px, ${p.y}px) scale(${p.escala})`,
                      transformOrigin: 'center',
                      transition: VIAJE,
                      transitionDelay: `${p.retraso}ms`,
                      opacity: fuera ? 0 : 1,
                      zIndex: centro ? 3 : fuera ? 0 : 2,
                      cursor: centro ? 'default' : 'pointer',
                      boxShadow: centro
                        ? `0 0 0 2px ${MARCA.ambar}, 0 30px 80px rgba(0,0,0,.6)`
                        : encima === n.id && foco
                          ? `0 0 0 2px ${MARCA.hueso}, 0 16px 40px rgba(0,0,0,.45)`
                          : '0 12px 34px rgba(0,0,0,.38)',
                    }}
                  />
                )
              })}

              {/* Lo que viaja por cada línea, escrito sobre ella */}
              {trazos.map((t) =>
                t.rotulo ? (
                  <div
                    key={`${foco}-${t.r.id}`}
                    className="aparece absolute z-[4] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap border border-hueso/25 bg-tinta px-2 py-0.5 text-[10.5px] text-hueso"
                    style={{ left: t.rotulo.x, top: t.rotulo.y }}
                  >
                    {t.rotulo.texto}
                  </div>
                ) : null,
              )}
            </div>
          )}

          {/* El recorrido: por dónde se ha pasado, para volver */}
          <nav className="absolute left-6 top-5 z-10 flex max-w-[80%] flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] uppercase tracking-[.16em]">
            <button
              type="button"
              onClick={onMapa}
              className={`transition-colors ${foco ? 'text-taupe hover:text-hueso' : 'text-hueso'}`}
            >
              Mapa completo
            </button>
            {recorrido.map((id, i) => (
              <span key={`${id}-${i}`} className="flex items-center gap-2">
                <span className="text-taupe/50" aria-hidden="true">›</span>
                <button
                  type="button"
                  onClick={() => onVolverA(i)}
                  className={`transition-colors ${i === recorrido.length - 1 ? 'text-ambar' : 'text-taupe hover:text-hueso'}`}
                >
                  {NODO_POR_ID.get(id)?.corto ?? id}
                </button>
              </span>
            ))}
          </nav>

          <p className="absolute bottom-5 left-6 z-10 text-[11px] text-taupe">
            {foco
              ? 'Toca una de alrededor para seguir el recorrido · Esc vuelve al mapa completo'
              : 'Elige una tarjeta para llevarla al centro'}
          </p>
        </div>

        <aside
          key={foco ?? 'mapa'}
          className="bg-papel text-tinta xl:h-[calc(100vh-5rem)] xl:overflow-y-auto"
        >
          <div className="entrar px-6 pb-10 pt-6">
            {foco
              ? <Ficha id={foco} cifra={cifra} onAgregar={onIr} accion="ir" />
              : <Bienvenida onIr={onIr} />}
          </div>
        </aside>
      </div>

      <style>{ESTILOS}</style>
    </div>
  )
}

// ─── Las líneas ───────────────────────────────────────────────────────────────

/**
 * En el mapa completo, las mismas líneas en reposo del lienzo. Con una tarjeta
 * en el centro, las suyas: aparecen cuando las tarjetas ya llegaron, y los
 * puntos del flujo avanzan en el sentido en que viaja el trabajo.
 */
function Lineas({
  foco, trazos, encima,
}: {
  foco: string | null
  trazos: ReturnType<typeof disposicionFoco>['trazos']
  encima: string | null
}) {
  return (
    <svg width={LIENZO.ancho} height={LIENZO.alto} className="pointer-events-none absolute inset-0" aria-hidden="true">
      <defs>
        {Object.entries(COLOR_LINEA_OSCURO).map(([tipo, color]) => (
          <marker
            key={tipo}
            id={`escena-punta-${tipo}`}
            viewBox="0 0 8 8"
            refX={tipo === 'avance' || tipo === 'devolucion' ? 7 : 4}
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            {tipo === 'avance' || tipo === 'devolucion'
              ? <path d="M1,1 L7,4 L1,7" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              : <circle cx="4" cy="4" r="2.2" fill={color} />}
          </marker>
        ))}
      </defs>

      <g className="escena-mov" style={{ opacity: foco ? 0 : 1, transition: 'opacity .35s ease' }}>
        {TRAZOS.filter((t) => t.enReposo).map(({ r, d }) => {
          const toca = encima === r.de || encima === r.a
          const flujo = r.tipo === 'avance' || r.tipo === 'devolucion'
          return (
            <path
              key={r.id}
              d={d}
              fill="none"
              stroke={COLOR_LINEA_OSCURO[r.tipo]}
              strokeWidth={toca ? 2 : 1.5}
              strokeDasharray={trazoDe(r.tipo)}
              strokeLinecap="round"
              opacity={toca ? 1 : 0.55}
              className={flujo ? 'fluye' : undefined}
              markerStart={flujo ? undefined : `url(#escena-punta-${r.tipo})`}
              markerEnd={`url(#escena-punta-${r.tipo})`}
            />
          )
        })}
      </g>

      {foco && (
        <g key={foco} className="aparece">
          {trazos.map(({ r, d }) => {
            const flujo = r.tipo === 'avance' || r.tipo === 'devolucion'
            return (
              <path
                key={r.id}
                d={d}
                fill="none"
                stroke={COLOR_LINEA_OSCURO[r.tipo]}
                strokeWidth={2}
                strokeDasharray={trazoDe(r.tipo)}
                strokeLinecap="round"
                className={flujo ? 'fluye' : undefined}
                markerStart={flujo ? undefined : `url(#escena-punta-${r.tipo})`}
                markerEnd={`url(#escena-punta-${r.tipo})`}
              />
            )
          })}
        </g>
      )}
    </svg>
  )
}

// ─── La hoja, sin nada en el centro ───────────────────────────────────────────

const PARA_EMPEZAR: { id: string; nota: string }[] = [
  { id: 'juridica', nota: 'La puerta de entrada: todo predio empieza aquí.' },
  { id: 'app_campo', nota: 'La extensión del SIG en el terreno.' },
  { id: 'ras_arboles', nota: 'El centro de la conservación: el árbol.' },
  { id: 'catalogo', nota: 'Lo único que tocan Siembra y Conservación.' },
]

function Bienvenida({ onIr }: { onIr: (id: string) => void }) {
  return (
    <>
      <p className="font-display text-[9.5px] font-semibold uppercase tracking-[.2em] text-tenue">Explorar</p>
      <h2 className="mt-1.5 font-display text-[1.45rem] font-semibold leading-tight text-tinta">Una tarjeta a la vez</h2>
      <p className="mt-4 text-[13px] leading-relaxed text-tinta">
        Elige cualquier tarjeta: viaja al centro y a su alrededor aparece todo lo que la toca. A la
        izquierda, lo que le llega; a la derecha, a quién le entrega; arriba, con qué aplicación se hace;
        abajo, dónde guarda. Toca una de alrededor para seguir el recorrido.
      </p>
      <p className="mt-3 text-[12.5px] font-light leading-relaxed text-suave">
        Para ver varias a la vez y saber qué comparten, cambia a la vista Comparar.
      </p>

      <Bloque titulo="Por dónde empezar">
        <div className="space-y-2">
          {PARA_EMPEZAR.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onIr(p.id)}
              className="block w-full border border-linea bg-white px-3 py-2.5 text-left transition-colors hover:border-bosque"
            >
              <span className="block font-display text-[13px] font-semibold text-tinta">
                {NODO_POR_ID.get(p.id)?.nombre}
              </span>
              <span className="mt-0.5 block text-[11.5px] font-light leading-snug text-suave">{p.nota}</span>
            </button>
          ))}
        </div>
      </Bloque>
    </>
  )
}

/**
 * Las animaciones van aquí y no en globals.css: solo existen en esta vista.
 * `fluye` mueve los puntos de la línea un período del punteado (1.5 + 4.5).
 */
const ESTILOS = `
  @keyframes escena-fluir { to { stroke-dashoffset: -12; } }
  .fluye { animation: escena-fluir 1.1s linear infinite; }
  @keyframes escena-aparecer { from { opacity: 0; } to { opacity: 1; } }
  .aparece { animation: escena-aparecer .45s ease .55s both; }
  @keyframes escena-entrar { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  .entrar { animation: escena-entrar .5s cubic-bezier(.22,1,.36,1) both; }
  @media (prefers-reduced-motion: reduce) {
    .escena-mov, [data-tarjeta] { transition: none !important; }
    .fluye, .aparece, .entrar { animation: none !important; }
  }
`
