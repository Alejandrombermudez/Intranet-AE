'use client'

/**
 * EL PANEL DEL MAPA
 * ─────────────────
 * Lo que se lee al lado del lienzo. Cambia según cuántas tarjetas estén elegidas:
 *   · ninguna — cómo leer el mapa, y tres combinaciones para empezar;
 *   · una — su ficha completa (ficha.tsx);
 *   · varias — cómo se comunican y qué tienen en común.
 *
 * Todo lo que dice sobre varias tarjetas lo calcula `analizar()` a partir de
 * las relaciones del mapa: aquí no hay ninguna frase escrita para una pareja
 * en particular.
 */

import type { ReactNode } from 'react'
import {
  APP_POR_ID, ESTADO_EXPLICACION, ESTADO_LABEL, ETAPA_POR_ID, PIEZAS,
  type Estado,
} from '@/lib/sistema/mapa'
import {
  analizar, enOrden, NODO_POR_ID,
  type Camino, type Relacion, type TipoRelacion,
} from '@/lib/sistema/relaciones'
import { COLOR_APP, COLOR_LINEA, colorDe, trazoDe } from './disposicion'
import { Bloque, Chip, ListaBitacora, ListaFrentes, Plegable, PuntoEstado } from './piezas'
import { Ficha } from './ficha'
import type { LectorDeCifras } from './mapa-vista'
import { MARCA } from '@/lib/expediente-formato'
import { X } from 'lucide-react'

type Elegir = (ids: string[]) => void
type Agregar = (id: string) => void

export function Panel({
  elegidas, cifra, onAlternar, onAgregar, onElegir,
}: {
  elegidas: string[]
  cifra: LectorDeCifras
  onAlternar: Agregar
  onAgregar: Agregar
  onElegir: Elegir
}) {
  const n = elegidas.length
  return (
    <aside className="border border-linea bg-white xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-linea bg-white px-5 py-3">
        <div className="flex min-h-[22px] items-center justify-between gap-3">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[.2em] text-tenue">
            {n === 0 ? 'Cómo leer el mapa' : n === 1 ? 'Una tarjeta elegida' : `${n} tarjetas elegidas`}
          </p>
          {n > 0 && (
            <button
              type="button"
              onClick={() => onElegir([])}
              className="text-[10px] uppercase tracking-[.16em] text-tenue transition-colors hover:text-tinta"
            >
              Limpiar
            </button>
          )}
        </div>
        {n > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {enOrden(elegidas).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onAlternar(id)}
                title={`Quitar ${NODO_POR_ID.get(id)?.nombre ?? id}`}
                className="inline-flex items-center gap-1.5 border border-bosque/35 bg-papel px-1.5 py-[3px] text-[11px] text-tinta transition-colors hover:border-bosque"
              >
                <i className="inline-block h-[7px] w-[7px]" style={{ background: colorDe(id) }} />
                {NODO_POR_ID.get(id)?.corto ?? id}
                <X size={11} className="text-tenue" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 pb-8 pt-5">
        {n === 0 && <Guia onElegir={onElegir} />}
        {n === 1 && <Ficha id={elegidas[0]} cifra={cifra} onAgregar={onAgregar} />}
        {n > 1 && <Varias ids={elegidas} onAgregar={onAgregar} onElegir={onElegir} />}
      </div>
    </aside>
  )
}

// ─── Nada elegido: cómo leer el mapa ──────────────────────────────────────────

const PARA_EMPEZAR: { titulo: string; nota: string; ids: string[] }[] = [
  {
    titulo: 'El ciclo entre la oficina y el terreno',
    nota: 'Cómo va y vuelve la cartografía, y la app que la lleva al predio.',
    ids: ['sig_i', 'campo', 'app_campo'],
  },
  {
    titulo: 'Lo único que tocan Siembra y Conservación',
    nota: 'Los dos dominios no se mezclan: se encuentran en el maestro de especies.',
    ids: ['plan', 'catalogo', 'ras_arboles'],
  },
  {
    titulo: 'Lo que todavía no llega a la base',
    nota: 'Apps que se usan en campo pero guardan solo en el teléfono.',
    ids: ['app_actividades', 'app_semilleros', 'app_aves'],
  },
]

function Guia({ onElegir }: { onElegir: Elegir }) {
  return (
    <>
      <p className="text-[13px] leading-relaxed text-tinta">
        Cada tarjeta es una parte del sistema: una etapa del trabajo, una aplicación o algo que las dos
        cadenas comparten. Las líneas punteadas son el camino que sigue el trabajo.
      </p>
      <p className="mt-3 text-[12.5px] font-light leading-relaxed text-suave">
        Elige una tarjeta para ver qué hace, con quién se conecta y qué se ha decidido sobre ella. Elige
        varias para ver cómo se comunican y qué tienen en común. Las cifras se leen de la base al abrir la
        página.
      </p>

      <Bloque titulo="Para empezar">
        <div className="space-y-2">
          {PARA_EMPEZAR.map((p) => (
            <button
              key={p.titulo}
              type="button"
              onClick={() => onElegir(p.ids)}
              className="block w-full border border-linea px-3 py-2.5 text-left transition-colors hover:border-bosque hover:bg-papel"
            >
              <span className="block font-display text-[13px] font-semibold text-tinta">{p.titulo}</span>
              <span className="mt-0.5 block text-[11.5px] font-light leading-snug text-suave">{p.nota}</span>
            </button>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Las líneas">
        <ul className="space-y-2">
          <MuestraLinea tipo="avance">El trabajo pasa a la etapa siguiente.</MuestraLinea>
          <MuestraLinea tipo="devolucion">El terreno le devuelve a la oficina lo que corrigió.</MuestraLinea>
          <MuestraLinea tipo="usa">La aplicación con que se hace esa etapa.</MuestraLinea>
          <MuestraLinea tipo="guarda">Dónde guarda cada etapa. Aparece al elegirla.</MuestraLinea>
        </ul>
      </Bloque>

      <Bloque titulo="El filete de arriba de cada tarjeta">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] text-suave">
          {[
            [MARCA.bosque, 'Siembra'],
            [MARCA.musgo, 'Conservación'],
            [MARCA.pizarra, 'Núcleo compartido'],
            [COLOR_APP, 'Aplicación'],
            [MARCA.taupe, 'Soporte'],
          ].map(([c, t]) => (
            <li key={t} className="flex items-center gap-2">
              <i className="inline-block h-[3px] w-4" style={{ background: c }} />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11.5px] font-light text-suave">Con el borde punteado: todavía por construir.</p>
      </Bloque>

      <Bloque titulo="El punto de cada tarjeta">
        <ul className="space-y-2">
          {(['produccion', 'en_curso', 'por_construir'] as Estado[]).map((e) => (
            <li key={e} className="flex gap-2.5">
              <span className="pt-[5px]"><PuntoEstado estado={e} size={7} /></span>
              <span className="text-[12px] leading-snug text-suave">
                <b className="font-medium text-tinta">{ESTADO_LABEL[e]}.</b> {ESTADO_EXPLICACION[e]}
              </span>
            </li>
          ))}
        </ul>
      </Bloque>
    </>
  )
}

function MuestraLinea({ tipo, children }: { tipo: TipoRelacion; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <svg width="34" height="8" className="shrink-0" aria-hidden="true">
        <path
          d="M 2 4 L 32 4"
          style={{ stroke: COLOR_LINEA[tipo].activa }}
          strokeWidth="1.8"
          strokeDasharray={trazoDe(tipo)}
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[12px] leading-snug text-suave">{children}</span>
    </li>
  )
}

// ─── Varias elegidas: lo que las une ──────────────────────────────────────────

function Varias({ ids, onAgregar, onElegir }: { ids: string[]; onAgregar: Agregar; onElegir: Elegir }) {
  const a = analizar(ids)
  const comunes =
    (a.mismoEstado ? 1 : 0) + a.appsCompartidas.length + a.etapasCompartidas.length + a.lugares.length + a.tablas.length

  return (
    <>
      <header>
        <p className="font-display text-[9.5px] font-semibold uppercase tracking-[.2em] text-tenue">Varias tarjetas</p>
        <h2 className="mt-1.5 font-display text-[1.45rem] font-semibold leading-tight text-tinta">Lo que las une</h2>
      </header>

      <Bloque titulo="Cómo se comunican" className="mt-5">
        <div className="space-y-4">
          {a.directas.map((r) => <FraseRelacion key={r.id} r={r} />)}
          {a.caminos.map((c) => <VistaCamino key={c.nodos.join('>')} c={c} onAgregar={onAgregar} />)}
          {a.aisladas.length > 0 && (
            <p className="text-[12.5px] leading-relaxed text-suave">
              {a.aisladas.map((id) => NODO_POR_ID.get(id)?.nombre).join(' y ')}{' '}
              {a.aisladas.length === 1 ? 'no se conecta' : 'no se conectan'} con las demás por ningún camino
              del mapa.
            </p>
          )}
          {a.cruzaDominios && (
            <div className="border-l-2 border-musgo pl-3">
              <p className="text-[12.5px] font-medium text-tinta">Siembra y Conservación no se mezclan</p>
              <p className="mt-1 text-[12px] font-light leading-relaxed text-suave">
                No comparten tablas ni flujo: se decidió así el 27 de junio de 2026 y no se vuelve a plantear.
                Solo se tocan en el núcleo compartido.
              </p>
            </div>
          )}
        </div>
      </Bloque>

      <Bloque titulo="Lo que tienen en común">
        {comunes === 0 ? (
          <p className="text-[12.5px] font-light text-suave">No comparten aplicación, lugar de guardado ni tablas.</p>
        ) : (
          <ul className="space-y-3.5">
            {a.mismoEstado && (
              <li className="flex gap-2.5 text-[12.5px] leading-snug text-suave">
                <span className="pt-[5px]"><PuntoEstado estado={a.mismoEstado} size={7} /></span>
                <span>
                  Todas están <b className="font-medium text-tinta">{ESTADO_LABEL[a.mismoEstado].toLowerCase()}</b>:{' '}
                  {ESTADO_EXPLICACION[a.mismoEstado].charAt(0).toLowerCase() + ESTADO_EXPLICACION[a.mismoEstado].slice(1)}
                </span>
              </li>
            )}
            {a.appsCompartidas.map(({ app, etapas }) => (
              <Comun key={app} texto="Se trabajan en la misma aplicación" eje={app} ids={etapas} onAgregar={onAgregar} />
            ))}
            {a.etapasCompartidas.map(({ etapa, apps }) => (
              <Comun key={etapa} texto="Trabajan en la misma etapa" eje={etapa} ids={apps} onAgregar={onAgregar} />
            ))}
            {a.lugares.map(({ pieza, etapas }) => (
              <Comun key={pieza} texto="Guardan en el mismo lugar" eje={pieza} ids={etapas} onAgregar={onAgregar} />
            ))}
            {a.tablas.map(({ nombre, nodos }) => (
              <li key={nombre}>
                <p className="text-[12px] text-tenue">Usan la misma tabla</p>
                <code className="mt-1 block font-mono text-[11.5px] text-pizarra">{nombre}</code>
                <p className="mt-1 text-[11.5px] text-suave">{nodos.map((id) => NODO_POR_ID.get(id)?.corto).join(' · ')}</p>
              </li>
            ))}
          </ul>
        )}
      </Bloque>

      {a.frentes.length > 0 && (
        <Bloque titulo="Un mismo problema abierto">
          <ListaFrentes frentes={a.frentes.map((f) => f.frente)} />
        </Bloque>
      )}

      {a.entradas.length > 0 && (
        <Bloque titulo={`Decisiones y cambios que las tocan juntas · ${a.entradas.length}`}>
          <ListaBitacora entradas={a.entradas.map((e) => e.entrada)} />
        </Bloque>
      )}

      <Bloque titulo="Cada una, en breve">
        <ul className="divide-y divide-fina border-y border-fina">
          {enOrden(ids).map((id) => <Resumen key={id} id={id} onSolo={() => onElegir([id])} />)}
        </ul>
      </Bloque>
    </>
  )
}

/** Una línea entre dos tarjetas elegidas, dicha como frase. */
function FraseRelacion({ r }: { r: Relacion }) {
  const verbo: Record<TipoRelacion, string> = {
    avance: 'pasa a',
    devolucion: 'le devuelve a',
    usa: 'trabaja en',
    guarda: 'guarda en',
  }
  const detalle = r.tipo === 'guarda' ? (r.tablas ?? []).map((t) => t.nombre).join(', ') : r.que
  return (
    <div>
      <p className="flex flex-wrap items-center gap-1.5 text-[12px] text-tenue">
        <Chip id={r.de} /> {verbo[r.tipo]} <Chip id={r.a} />
      </p>
      <p className={`mt-1 leading-snug text-suave ${r.tipo === 'guarda' ? 'font-mono text-[11px] text-pizarra' : 'text-[12px] font-light'}`}>
        {detalle}
      </p>
    </div>
  )
}

/**
 * Dos tarjetas que no se tocan directamente: el camino más corto entre ellas.
 * Si es largo, se dice que están lejos y el camino queda plegado.
 */
function VistaCamino({ c, onAgregar }: { c: Camino; onAgregar: Agregar }) {
  const desde = NODO_POR_ID.get(c.nodos[0])!
  const hasta = NODO_POR_ID.get(c.nodos[c.nodos.length - 1])!
  const medio = c.nodos.slice(1, -1).map((id) => NODO_POR_ID.get(id)!)
  const soloFlujo = c.relaciones.every((r) => r.tipo === 'avance' || r.tipo === 'devolucion')

  let explicacion = `Entre ${desde.corto} y ${hasta.corto} no hay línea directa. Este es el camino más corto:`
  if (medio.length === 1 && medio[0].tipo === 'pieza') {
    explicacion = `${desde.corto} y ${hasta.corto} se tocan a través de ${medio[0].nombre.toLowerCase()}: las dos guardan ahí.`
  } else if (medio.length === 1 && medio[0].tipo === 'app') {
    explicacion = `${desde.corto} y ${hasta.corto} se trabajan en la misma aplicación: ${medio[0].nombre}.`
  } else if (medio.length === 1 && c.relaciones.every((r) => r.tipo === 'usa')) {
    explicacion = `${desde.corto} y ${hasta.corto} se encuentran en la misma etapa: ${medio[0].nombre}.`
  } else if (soloFlujo) {
    explicacion = `De ${desde.corto} a ${hasta.corto} el trabajo pasa por ${medio.length} ${medio.length === 1 ? 'etapa' : 'etapas'} en medio.`
  }

  const cadena = (
    <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-tenue">
      {c.nodos.map((id, i) => {
        const r = c.relaciones[i]
        const flecha = !r ? null : r.tipo === 'avance' ? (r.de === id ? '→' : '←') : r.tipo === 'devolucion' ? '⇢' : '·'
        return (
          <span key={id} className="inline-flex items-center gap-1">
            <Chip id={id} onClick={i === 0 || i === c.nodos.length - 1 ? undefined : onAgregar} />
            {flecha && <span aria-hidden="true">{flecha}</span>}
          </span>
        )
      })}
    </p>
  )

  if (c.relaciones.length > 4) {
    return (
      <div>
        <p className="text-[12.5px] leading-relaxed text-suave">
          {desde.corto} y {hasta.corto} están en recorridos distintos: el camino más corto entre las dos pasa
          por {medio.length} tarjetas.
        </p>
        <Plegable titulo="Ver el camino">{cadena}</Plegable>
      </div>
    )
  }
  return (
    <div>
      <p className="text-[12.5px] leading-relaxed text-suave">{explicacion}</p>
      {cadena}
    </div>
  )
}

function Comun({ texto, eje, ids, onAgregar }: { texto: string; eje: string; ids: string[]; onAgregar: Agregar }) {
  return (
    <li>
      <p className="text-[12px] text-tenue">{texto}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <Chip id={eje} onClick={onAgregar} />
        <span className="text-[11.5px] text-suave">
          {ids.map((id) => NODO_POR_ID.get(id)?.corto).join(' · ')}
        </span>
      </div>
    </li>
  )
}

function Resumen({ id, onSolo }: { id: string; onSolo: () => void }) {
  const n = NODO_POR_ID.get(id)
  if (!n) return null
  const etapa = ETAPA_POR_ID.get(id)
  const app = APP_POR_ID.get(id)
  const pieza = PIEZAS.find((p) => p.id === id)
  const linea = etapa
    ? `${etapa.enBreve.quien}. Entrega: ${etapa.enBreve.entrega.toLowerCase()}.`
    : app?.para ?? pieza?.que ?? ''
  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <Chip id={id} />
        <button
          type="button"
          onClick={onSolo}
          className="shrink-0 text-[10px] uppercase tracking-[.14em] text-tenue transition-colors hover:text-bosque"
        >
          Ver solo esta
        </button>
      </div>
      {n.estado && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-tenue">
          <PuntoEstado estado={n.estado} size={6} /> {ESTADO_LABEL[n.estado]}
        </p>
      )}
      <p className="mt-1 text-[12px] font-light leading-snug text-suave">{linea}</p>
    </li>
  )
}
