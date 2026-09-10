'use client'

/**
 * LA VISTA DEL MAPA
 * ─────────────────
 * Todo lo que se dibuja del mapa vive aquí, separado de la página. La página se
 * encarga de quién puede entrar y de traer las cifras; este archivo solo sabe
 * pintar. Separarlos deja la vista montable por sí sola —para revisarla sin
 * pasar por el login— y evita que `page.tsx` crezca hasta ser ilegible.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { MARCA } from '@/lib/expediente-formato'
import {
  APLICACIONES, APP_POR_ID, DOMINIOS, ENLACES, ETAPA_POR_ID, PIEZAS,
  REGLA_DEL_TERRENO, ESTADO_LABEL, ESTADO_EXPLICACION,
  etapasDe, etapasDeApp, enlacesDe,
  type Etapa, type Estado, type Aplicacion,
} from '@/lib/sistema/mapa'
import { entradasDeEtapa, entradasDeApp, frentesDeEtapa, fechaLarga, TIPO_LABEL } from '@/lib/sistema/bitacora'
import type { Pulso } from '@/app/api/sistema/pulso/route'
import {
  COLOR_ESTADO, TIPOGRAFIA, Cifra, Conector, EtiquetaEstado, FlechaDevolucion,
  Plegable, PuntoEstado, Rotulo,
} from './piezas'
import { X } from 'lucide-react'

export type Seleccion = { tipo: 'etapa' | 'app'; id: string } | null

/** Una cifra ya resuelta, o null si esa métrica no se pudo leer. */
export type LectorDeCifras = (
  id: string,
) => { valor: number | null; etiqueta: string; de?: string; problema?: string } | null

/** El mapa completo. Recibe las cifras ya leídas; no sabe de dónde salieron. */
export function MapaSistema({ pulso }: { pulso: Pulso | null }) {
  const [seleccion, setSeleccion] = useState<Seleccion>(null)

  const cifra: LectorDeCifras = useCallback(
    (id: string) => pulso?.metricas[id] ?? null,
    [pulso],
  )

  return (
    <>
      <Presentacion />
      <Carril dominio="siembra" seleccion={seleccion} onSeleccionar={setSeleccion} cifra={cifra} conDevolucion />
      <Carril dominio="conservacion" seleccion={seleccion} onSeleccionar={setSeleccion} cifra={cifra} />
      <Transversales cifra={cifra} />
      <LasAplicaciones seleccion={seleccion} onSeleccionar={setSeleccion} />
    </>
  )
}

function Presentacion() {
  return (
    <section className="pt-9 pb-7">
      <p className="max-w-[74ch] text-[14px] leading-relaxed" style={{ color: '#453f37' }}>
        Dos recorridos que no se cruzan: un predio que va a ser <b>restaurado</b> avanza por una cadena
        de etapas hasta que el árbol queda sembrado; un predio en <b>conservación</b> no avanza por
        etapas — se inventaría y se monitorea en el tiempo. Abajo, lo que los dos comparten.
      </p>
      <p className="mt-3 max-w-[74ch] text-[13px] leading-relaxed" style={{ color: '#8b8375' }}>
        Haz clic en cualquier caja para ver qué recibe, qué hace y con qué aplicación.
        Las cifras no están escritas: se leen de la base al abrir la página.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        {(['produccion', 'en_curso', 'por_construir'] as Estado[]).map((e) => (
          <div key={e} className="flex items-center gap-2">
            <PuntoEstado estado={e} />
            <span className="text-[11.5px]" style={{ color: '#453f37' }}>
              <b style={{ fontWeight: 600 }}>{ESTADO_LABEL[e]}</b>
              <span style={{ color: '#8b8375' }}> — {ESTADO_EXPLICACION[e]}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Un carril del mapa ───────────────────────────────────────────────────────

function Carril({
  dominio, seleccion, onSeleccionar, cifra, conDevolucion,
}: {
  dominio: 'siembra' | 'conservacion'
  seleccion: Seleccion
  onSeleccionar: (s: Seleccion) => void
  cifra: (id: string) => { valor: number | null; etiqueta: string; de?: string; problema?: string } | null
  conDevolucion?: boolean
}) {
  const info = DOMINIOS.find((d) => d.id === dominio)!
  const etapas = etapasDe(dominio)
  const contenedor = useRef<HTMLDivElement>(null)

  // La app seleccionada, para resaltar las otras etapas donde también aparece.
  const appActiva = seleccion?.tipo === 'app' ? seleccion.id : null

  // Solo se abre el panel si lo seleccionado es una etapa DE ESTE carril. Una
  // aplicacion seleccionada resalta sus etapas aqui, pero su panel se dibuja una
  // sola vez, abajo, para no repetirlo en cada carril que toque.
  const seleccionadaAqui = seleccion?.tipo === 'etapa' && etapas.some((e) => e.id === seleccion.id)



  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline gap-3">
        <span style={{ width: 3, height: 17, background: info.color, display: 'inline-block', borderRadius: 2 }} />
        <h2 className="text-[16px]" style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}>
          {info.nombre}
        </h2>
        <p className="text-[12px]" style={{ color: '#8b8375' }}>{info.resumen}</p>
      </div>

      <div ref={contenedor} className="overflow-x-auto pb-3">
        <div className="flex items-stretch" style={{ minWidth: 'min-content' }}>
          {etapas.map((etapa) => {
            const sale = enlacesDe(etapa.id).sale.find((l) => l.tipo === 'avance')
            const siguiente = sale ? ETAPA_POR_ID.get(sale.a) : null
            return (
              <div key={etapa.id} className="flex items-stretch">
                <CajaEtapa
                  etapa={etapa}
                  activa={seleccion?.tipo === 'etapa' && seleccion.id === etapa.id}
                  resaltada={!!appActiva && etapa.apps.some((a) => a.app === appActiva)}
                  cifra={cifra}
                  onClick={() =>
                    onSeleccionar(
                      seleccion?.tipo === 'etapa' && seleccion.id === etapa.id
                        ? null
                        : { tipo: 'etapa', id: etapa.id },
                    )
                  }
                />
                {sale && siguiente && (
                  <Conector
                    que={sale.que}
                    firme={etapa.estado === 'produccion' && siguiente.estado === 'produccion'}
                    compuerta={
                      etapa.compuerta
                        ? { titulo: etapa.compuerta.titulo, bloquea: etapa.compuerta.bloquea }
                        : undefined
                    }
                  />
                )}
              </div>
            )
          })}
        </div>

        {conDevolucion && (
          <FlechaDevolucion
            desde="campo"
            hasta="sig_i"
            texto={REGLA_DEL_TERRENO.titulo.toLowerCase()}
          />
        )}
      </div>

      {seleccionadaAqui && (
        <Detalle seleccion={seleccion} onCerrar={() => onSeleccionar(null)} onSeleccionar={onSeleccionar} cifra={cifra} />
      )}
    </section>
  )
}

// ─── La caja de una etapa ─────────────────────────────────────────────────────

function CajaEtapa({
  etapa, activa, resaltada, cifra, onClick,
}: {
  etapa: Etapa
  activa: boolean
  resaltada: boolean
  cifra: (id: string) => { valor: number | null; etiqueta: string; de?: string } | null
  onClick: () => void
}) {
  const color = COLOR_ESTADO[etapa.estado]
  const principal = etapa.pulso[0] ? cifra(etapa.pulso[0]) : null
  const borde = activa ? MARCA.bosque : resaltada ? MARCA.pizarra : '#d6cec0'

  return (
    <div
      data-etapa={etapa.id}
      role="button"
      aria-label={`${etapa.nombre} — ${ESTADO_LABEL[etapa.estado]}`}
      aria-pressed={activa}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="flex shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl transition-all"
      style={{
        width: 232,
        background: '#faf8f3',
        border: `1px solid ${borde}`,
        boxShadow: activa ? '0 6px 20px rgba(47,63,50,.13)' : '0 1px 2px rgba(30,26,24,.04)',
        outline: activa ? `1px solid ${MARCA.bosque}` : 'none',
      }}
    >
      {/* Cabecera, como el encabezado de una entidad */}
      <div
        className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-3"
        style={{ borderBottom: '1px solid #e6dfd2', background: activa ? '#f2efe6' : 'transparent' }}
      >
        <div className="min-w-0">
          <h3
            className="text-[15.5px] leading-tight"
            style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}
          >
            {etapa.nombre}
          </h3>
          <p className="mt-1 text-[9.5px] uppercase" style={{ letterSpacing: '.11em', color: '#8b8375' }}>
            {etapa.responsable}
          </p>
        </div>
        <PuntoEstado estado={etapa.estado} />
      </div>

      {/* Filas: lo que recibe y lo que entrega */}
      <div className="flex-1 px-4 py-3">
        <Rotulo>Entrega</Rotulo>
        <p className="text-[12px] leading-snug" style={{ color: '#3b352e' }}>
          {etapa.entrega}
        </p>
      </div>

      {/* Pie: aplicaciones y la cifra viva */}
      <div className="px-4 pb-3.5">
        <div className="mb-2.5 flex flex-wrap gap-1">
          {etapa.apps.map(({ app }) => {
            const a = APP_POR_ID.get(app)
            if (!a) return null
            return (
              <span
                key={app}
                className="rounded px-1.5 py-0.5 text-[9.5px]"
                style={{ background: '#eee8dc', color: '#5d564b', fontFamily: TIPOGRAFIA.cuerpo }}
              >
                {a.nombre}
              </span>
            )
          })}
        </div>
        {principal ? (
          <div style={{ borderTop: '1px solid #e6dfd2', paddingTop: 9 }}>
            <Cifra valor={principal.valor} etiqueta={principal.etiqueta} />
          </div>
        ) : (
          <div
            className="text-[10.5px]"
            style={{ borderTop: '1px solid #e6dfd2', paddingTop: 9, color: '#a39a8b' }}
          >
            {etapa.estado === 'por_construir' ? 'todavía no produce datos' : '—'}
          </div>
        )}
      </div>

      <div style={{ height: 3, background: color, opacity: activa ? 1 : 0.45 }} />
    </div>
  )
}

// ─── El panel de detalle ──────────────────────────────────────────────────────

function Detalle({
  seleccion, onCerrar, onSeleccionar, cifra,
}: {
  seleccion: Seleccion
  onCerrar: () => void
  onSeleccionar: (s: Seleccion) => void
  cifra: (id: string) => { valor: number | null; etiqueta: string; de?: string; problema?: string } | null
}) {
  if (!seleccion) return null
  return (
    <div
      className="mt-5 rounded-xl"
      style={{ background: '#faf8f3', border: '1px solid #ddd5c7', boxShadow: '0 4px 18px rgba(30,26,24,.05)' }}
    >
      <div className="flex justify-end px-4 pt-3">
        <button
          onClick={onCerrar}
          className="rounded p-1 transition-opacity hover:opacity-60"
          style={{ color: '#8b8375' }}
          aria-label="Cerrar el detalle"
        >
          <X size={16} />
        </button>
      </div>
      {seleccion.tipo === 'etapa' ? (
        <DetalleEtapa
          etapa={ETAPA_POR_ID.get(seleccion.id)!}
          cifra={cifra}
          onSeleccionar={onSeleccionar}
        />
      ) : (
        <DetalleApp app={APP_POR_ID.get(seleccion.id)!} onSeleccionar={onSeleccionar} />
      )}
    </div>
  )
}

function DetalleEtapa({
  etapa, cifra, onSeleccionar,
}: {
  etapa: Etapa
  cifra: (id: string) => { valor: number | null; etiqueta: string; de?: string; problema?: string } | null
  onSeleccionar: (s: Seleccion) => void
}) {
  const { entra } = enlacesDe(etapa.id)
  // La devolucion se muestra en LOS DOS extremos: en el que la manda y en el
  // que la recibe. Es la unica flecha que va hacia atras y la regla de negocio
  // mas importante del sistema; verla solo desde un lado la deja a medias.
  const devoluciones = ENLACES.filter(
    (l) => l.tipo === 'devolucion' && (l.a === etapa.id || l.de === etapa.id),
  )
  const entradas = entradasDeEtapa(etapa.id)
  const frentes = frentesDeEtapa(etapa.id)

  return (
    <div className="px-6 pb-7 pt-1">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h3 className="text-[22px]" style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}>
          {etapa.nombre}
        </h3>
        <EtiquetaEstado estado={etapa.estado} />
        <span className="text-[12px]" style={{ color: '#8b8375' }}>{etapa.responsable}</span>
      </div>

      <div className="grid gap-x-9 gap-y-6 lg:grid-cols-3">
        <div>
          <Rotulo>Qué recibe</Rotulo>
          <p className="text-[13px] leading-relaxed" style={{ color: '#3b352e' }}>{etapa.recibe}</p>
          {entra.filter((l) => l.tipo === 'avance').map((l) => (
            <button
              key={l.de}
              onClick={() => onSeleccionar({ tipo: 'etapa', id: l.de })}
              className="mt-2 text-[11.5px] underline underline-offset-2 transition-opacity hover:opacity-60"
              style={{ color: MARCA.pizarra }}
            >
              viene de {ETAPA_POR_ID.get(l.de)?.nombre}
            </button>
          ))}
        </div>

        <div>
          <Rotulo>Qué hace</Rotulo>
          <ul className="space-y-1.5">
            {etapa.hace.map((h, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed" style={{ color: '#3b352e' }}>
                <span style={{ color: COLOR_ESTADO[etapa.estado], flexShrink: 0 }}>·</span>
                {h}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Rotulo>Qué entrega</Rotulo>
          <p className="text-[13px] leading-relaxed" style={{ color: '#3b352e' }}>{etapa.entrega}</p>

          {etapa.compuerta && (
            <div
              className="mt-4 rounded-lg p-3"
              style={{
                background: etapa.compuerta.bloquea ? '#f6ecd6' : '#efeade',
                border: `1px solid ${etapa.compuerta.bloquea ? '#e3caa0' : '#ded7c9'}`,
              }}
            >
              <div
                className="mb-1 text-[10px] uppercase"
                style={{ letterSpacing: '.13em', fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: '#8a5f14' }}
              >
                Para pasar: {etapa.compuerta.titulo}
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: '#5d564b' }}>
                {etapa.compuerta.explicacion}
              </p>
              <p className="mt-2 text-[10.5px]" style={{ color: '#8b8375' }}>
                {etapa.compuerta.bloquea
                  ? 'El sistema lo impide: no es solo un acuerdo.'
                  : 'Hoy es un acuerdo del equipo; el sistema todavía no lo verifica.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Devolución */}
      {devoluciones.length > 0 && (
        <div
          className="mt-6 rounded-lg p-4"
          style={{ background: '#eef2f4', border: `1px solid #cfdbe2` }}
        >
          <div
            className="mb-1.5 text-[10px] uppercase"
            style={{ letterSpacing: '.13em', fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.pizarra }}
          >
            {REGLA_DEL_TERRENO.titulo}
          </div>
          {devoluciones.map((l) => {
            const otra = ETAPA_POR_ID.get(l.de === etapa.id ? l.a : l.de)
            const laMando = l.de === etapa.id
            // Lo que viaja de vuelta lo levanta una aplicacion concreta; desde
            // aqui se puede abrir para ver que hace exactamente.
            const appOrigen = APP_POR_ID.get(ETAPA_POR_ID.get(l.de)?.apps[0]?.app ?? '')
            return (
              <div key={`${l.de}-${l.a}`}>
                <p className="text-[12.5px] leading-relaxed" style={{ color: '#3b352e' }}>
                  {laMando ? 'Vuelve a ' : 'Llega desde '}
                  <button
                    onClick={() => onSeleccionar({ tipo: 'etapa', id: otra?.id ?? '' })}
                    className="underline underline-offset-2 transition-opacity hover:opacity-60"
                    style={{ color: MARCA.pizarra, fontWeight: 600 }}
                  >
                    {otra?.nombre}
                  </button>
                  : {l.que}.
                </p>
                {appOrigen && (
                  <p className="mt-1.5 text-[12px]" style={{ color: '#5d564b' }}>
                    Lo levanta{' '}
                    <button
                      onClick={() => onSeleccionar({ tipo: 'app', id: appOrigen.id })}
                      className="underline underline-offset-2 transition-opacity hover:opacity-60"
                      style={{ color: MARCA.pizarra }}
                    >
                      {appOrigen.nombre.toLowerCase()}
                    </button>
                    , sobre el mapa satelital y sin necesidad de señal.
                  </p>
                )}
              </div>
            )
          })}
          <p className="mt-2 text-[12px] leading-relaxed" style={{ color: '#5d564b' }}>
            {REGLA_DEL_TERRENO.cuerpo}
          </p>
        </div>
      )}

      {/* Aplicaciones */}
      <div className="mt-7">
        <Rotulo>Con qué se hace</Rotulo>
        <div className="mt-2 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {etapa.apps.map(({ app, rol }) => {
            const a = APP_POR_ID.get(app)
            if (!a) return null
            const otras = etapasDeApp(app).filter((e) => e.id !== etapa.id)
            return (
              <button
                key={app}
                onClick={() => onSeleccionar({ tipo: 'app', id: app })}
                className="rounded-lg p-3.5 text-left transition-all hover:shadow-sm"
                style={{ background: '#f2efe6', border: '1px solid #e0d9cb' }}
              >
                <div className="flex items-center gap-2">
                  <PuntoEstado estado={a.estado} size={7} />
                  <span
                    className="text-[13.5px]"
                    style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}
                  >
                    {a.nombre}
                  </span>
                  {a.offline && (
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px]"
                      style={{ background: '#e2e8e3', color: MARCA.bosque }}
                    >
                      sin señal
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] leading-snug" style={{ color: '#5d564b' }}>{rol}</p>
                {otras.length > 0 && (
                  <p className="mt-2 text-[10.5px]" style={{ color: MARCA.pizarra }}>
                    también trabaja en {otras.map((e) => e.nombre).join(' y ')}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Cifras vivas */}
      {etapa.pulso.length > 0 && (
        <div className="mt-7">
          <Rotulo>Cómo va hoy</Rotulo>
          <div className="mt-2 flex flex-wrap gap-x-10 gap-y-4">
            {etapa.pulso.map((id) => {
              const m = cifra(id)
              if (!m) return null
              const total = m.de ? cifra(m.de)?.valor ?? null : null
              return (
                <Cifra key={id} valor={m.valor} etiqueta={m.etiqueta} de={total} problema={m.problema} destacada />
              )
            })}
          </div>
        </div>
      )}

      {/* Lo que falta */}
      {(etapa.pendiente || frentes.length > 0) && (
        <div className="mt-7 rounded-lg p-4" style={{ background: '#f5efe3', border: '1px solid #e4dac6' }}>
          <div
            className="mb-2 text-[10px] uppercase"
            style={{ letterSpacing: '.13em', fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: '#8a5f14' }}
          >
            Lo que falta aquí
          </div>
          {etapa.pendiente && (
            <p className="text-[12.5px] leading-relaxed" style={{ color: '#3b352e' }}>{etapa.pendiente}</p>
          )}
          {frentes.map((f) => (
            <div key={f.id} className="mt-3">
              <p className="text-[12.5px] leading-relaxed" style={{ color: '#3b352e' }}>
                <b style={{ fontWeight: 600 }}>{f.titulo}.</b> {f.cuerpo}
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: '#8a5f14' }}>
                Mientras siga así: {f.costo.charAt(0).toLowerCase() + f.costo.slice(1)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Detalle técnico, plegado */}
      <div className="mt-5" style={{ borderTop: '1px solid #e6dfd2' }}>
        <Plegable titulo="Dónde queda guardado">
          <div className="space-y-2 pb-2">
            {etapa.datos.map((d) => (
              <div key={d.nombre} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <code
                  className="text-[11.5px]"
                  style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', color: MARCA.pizarra }}
                >
                  {d.nombre}
                </code>
                <span className="text-[12px]" style={{ color: '#5d564b' }}>{d.que}</span>
                {d.estado && d.estado !== 'produccion' && (
                  <span className="text-[10px]" style={{ color: '#8a5f14' }}>({ESTADO_LABEL[d.estado]})</span>
                )}
              </div>
            ))}
          </div>
        </Plegable>

        {entradas.length > 0 && (
          <Plegable titulo={`En la bitácora · ${entradas.length}`}>
            <div className="space-y-3 pb-2">
              {entradas.map((e) => (
                <div key={e.id} className="flex gap-3">
                  <div className="shrink-0 pt-0.5" style={{ width: 120 }}>
                    <div className="text-[10.5px]" style={{ color: '#8b8375' }}>{fechaLarga(e.fecha)}</div>
                    <div className="text-[9.5px] uppercase" style={{ letterSpacing: '.1em', color: '#a39a8b' }}>
                      {TIPO_LABEL[e.tipo]}
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-[12.5px]"
                      style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}
                    >
                      {e.titulo}
                    </div>
                    <p className="text-[12px] leading-relaxed" style={{ color: '#5d564b' }}>{e.quedo}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/intranet/sistema/documentacion"
              className="text-[11.5px] underline underline-offset-2"
              style={{ color: MARCA.pizarra }}
            >
              ver la bitácora completa
            </Link>
          </Plegable>
        )}
      </div>
    </div>
  )
}

function DetalleApp({ app, onSeleccionar }: { app: Aplicacion; onSeleccionar: (s: Seleccion) => void }) {
  const etapas = etapasDeApp(app.id)
  const entradas = entradasDeApp(app.id)

  return (
    <div className="px-6 pb-7 pt-1">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h3 className="text-[22px]" style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}>
          {app.nombre}
        </h3>
        <EtiquetaEstado estado={app.estado} />
        <span className="text-[12px]" style={{ color: '#8b8375' }}>{app.clase.toLowerCase()}</span>
        {app.offline && (
          <span
            className="rounded px-2 py-0.5 text-[10px]"
            style={{ background: '#e2e8e3', color: MARCA.bosque }}
          >
            funciona sin señal
          </span>
        )}
      </div>

      <div className="grid gap-x-9 gap-y-6 lg:grid-cols-3">
        <div>
          <Rotulo>Para qué sirve</Rotulo>
          <p className="text-[13px] leading-relaxed" style={{ color: '#3b352e' }}>{app.para}</p>
        </div>
        <div>
          <Rotulo>Dónde se abre</Rotulo>
          <p className="text-[13px] leading-relaxed" style={{ color: '#3b352e' }}>{app.donde}</p>
        </div>
        <div>
          <Rotulo>En qué partes del proceso trabaja</Rotulo>
          <div className="flex flex-wrap gap-2">
            {etapas.length === 0 && (
              <span className="text-[12.5px]" style={{ color: '#8b8375' }}>
                Todavía en ninguna: está por construirse.
              </span>
            )}
            {etapas.map((e) => (
              <button
                key={e.id}
                onClick={() => onSeleccionar({ tipo: 'etapa', id: e.id })}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition-opacity hover:opacity-70"
                style={{ background: '#eee8dc', color: '#3b352e' }}
              >
                <PuntoEstado estado={e.estado} size={6} />
                {e.nombre}
              </button>
            ))}
          </div>
          {etapas.length > 1 && (
            <p className="mt-3 text-[11.5px] leading-relaxed" style={{ color: MARCA.pizarra }}>
              Una misma aplicación puede trabajar en varias partes del proceso. Por eso el mapa es una red
              y no una fila: {app.nombre.toLowerCase()} hace{' '}
              {etapas.map((e) => e.apps.find((a) => a.app === app.id)?.rol.toLowerCase()).filter(Boolean).join('; y ')}.
            </p>
          )}
        </div>
      </div>

      {entradas.length > 0 && (
        <div className="mt-6" style={{ borderTop: '1px solid #e6dfd2' }}>
          <Plegable titulo={`En la bitácora · ${entradas.length}`}>
            <div className="space-y-3 pb-2">
              {entradas.map((e) => (
                <div key={e.id}>
                  <div className="text-[10.5px]" style={{ color: '#8b8375' }}>{fechaLarga(e.fecha)}</div>
                  <div
                    className="text-[12.5px]"
                    style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}
                  >
                    {e.titulo}
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: '#5d564b' }}>{e.quedo}</p>
                </div>
              ))}
            </div>
          </Plegable>
        </div>
      )}

      {app.tecnica && (
        <div style={{ borderTop: '1px solid #e6dfd2' }}>
          <Plegable titulo="Detalle técnico">
            <p className="pb-2 text-[12px] leading-relaxed" style={{ color: '#5d564b' }}>{app.tecnica}</p>
            <code
              className="text-[11px]"
              style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', color: MARCA.pizarra }}
            >
              {app.carpeta}
            </code>
          </Plegable>
        </div>
      )}
    </div>
  )
}

// ─── Lo transversal ───────────────────────────────────────────────────────────

function Transversales({
  cifra,
}: {
  cifra: (id: string) => { valor: number | null; etiqueta: string } | null
}) {
  const nucleo = DOMINIOS.find((d) => d.id === 'nucleo')!
  return (
    <section className="mb-12">
      <div className="mb-4 flex items-baseline gap-3">
        <span style={{ width: 3, height: 17, background: nucleo.color, display: 'inline-block', borderRadius: 2 }} />
        <h2 className="text-[16px]" style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}>
          Lo que los dos comparten
        </h2>
        <p className="text-[12px]" style={{ color: '#8b8375' }}>{nucleo.resumen}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PIEZAS.map((p) => (
          <div
            key={p.id}
            className="rounded-xl p-4"
            style={{
              background: p.dominio === 'nucleo' ? '#f1f3f4' : '#f4f1ea',
              border: `1px solid ${p.dominio === 'nucleo' ? '#dbe2e6' : '#e2dbcd'}`,
            }}
          >
            <h3
              className="text-[14px]"
              style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}
            >
              {p.nombre}
            </h3>
            <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: '#5d564b' }}>{p.que}</p>

            {p.pulso.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2" style={{ borderTop: '1px solid #e0dbd0', paddingTop: 10 }}>
                {p.pulso.map((id) => {
                  const m = cifra(id)
                  return m ? <Cifra key={id} valor={m.valor} etiqueta={m.etiqueta} /> : null
                })}
              </div>
            )}

            <div className="mt-1">
              <Plegable titulo="Qué guarda">
                <div className="space-y-1.5 pb-1">
                  {p.datos.map((d) => (
                    <div key={d.nombre}>
                      <code
                        className="text-[11px]"
                        style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, monospace', color: MARCA.pizarra }}
                      >
                        {d.nombre}
                      </code>
                      <div className="text-[11.5px] leading-snug" style={{ color: '#5d564b' }}>{d.que}</div>
                    </div>
                  ))}
                </div>
              </Plegable>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── La vista invertida: por aplicación ───────────────────────────────────────

function LasAplicaciones({
  seleccion, onSeleccionar,
}: {
  seleccion: Seleccion
  onSeleccionar: (s: Seleccion) => void
}) {
  const porClase = useMemo(() => {
    const m = new Map<string, Aplicacion[]>()
    for (const a of APLICACIONES) {
      const l = m.get(a.clase)
      if (l) l.push(a)
      else m.set(a.clase, [a])
    }
    return [...m.entries()]
  }, [])

  return (
    <section>
      <div className="mb-2 flex items-baseline gap-3">
        <span style={{ width: 3, height: 17, background: MARCA.taupe, display: 'inline-block', borderRadius: 2 }} />
        <h2 className="text-[16px]" style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}>
          Las aplicaciones
        </h2>
      </div>
      <p className="mb-4 max-w-[74ch] text-[12px] leading-relaxed" style={{ color: '#8b8375' }}>
        El mismo mapa visto al revés. Arriba, el proceso manda y las aplicaciones son herramientas; aquí,
        cada aplicación con las partes del proceso que atiende. Sirve para ver que algunas cruzan varias
        etapas — la app de campo, por ejemplo, hace el trabajo de terreno y el de verificación
        cartográfica en la misma visita.
      </p>

      <div className="space-y-5">
        {porClase.map(([clase, apps]) => (
          <div key={clase}>
            <div
              className="mb-2 text-[10px] uppercase"
              style={{ letterSpacing: '.15em', fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: '#8b8375' }}
            >
              {clase}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {apps.map((a) => {
                const etapas = etapasDeApp(a.id)
                const activa = seleccion?.tipo === 'app' && seleccion.id === a.id
                return (
                  <button
                    key={a.id}
                    onClick={() => onSeleccionar(activa ? null : { tipo: 'app', id: a.id })}
                    className="rounded-xl p-4 text-left transition-all"
                    style={{
                      background: '#faf8f3',
                      border: `1px solid ${activa ? MARCA.bosque : '#e0d9cb'}`,
                      boxShadow: activa ? '0 4px 14px rgba(47,63,50,.10)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <PuntoEstado estado={a.estado} size={7} />
                      <span
                        className="text-[14px]"
                        style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}
                      >
                        {a.nombre}
                      </span>
                      {a.offline && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px]"
                          style={{ background: '#e2e8e3', color: MARCA.bosque }}
                        >
                          sin señal
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[12px] leading-snug" style={{ color: '#5d564b' }}>{a.para}</p>
                    {etapas.length > 0 && (
                      <p className="mt-2.5 text-[10.5px]" style={{ color: '#8b8375' }}>
                        {etapas.map((e) => e.nombre).join(' · ')}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {seleccion?.tipo === 'app' && (
        <div className="mt-5">
          <Detalle
            seleccion={seleccion}
            onCerrar={() => onSeleccionar(null)}
            onSeleccionar={onSeleccionar}
            cifra={() => null}
          />
        </div>
      )}
    </section>
  )
}
