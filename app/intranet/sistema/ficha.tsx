'use client'

/**
 * LA FICHA DE UNA TARJETA
 * ───────────────────────
 * Lo que muestra el panel al elegir una sola tarjeta: todo lo que el sistema
 * sabe de ella, en el orden en que se lee un proceso —qué recibe, qué hace, qué
 * entrega—; después con quién se conecta, cómo va hoy y qué le falta. Lo
 * técnico (tablas, carpeta del código) va plegado al final.
 *
 * Cada nombre de otra tarjeta es un botón que la suma a lo elegido: así se pasa
 * de «qué es esto» a «cómo se comunica con aquello» sin volver al lienzo.
 */

import type { ReactNode } from 'react'
import {
  APP_POR_ID, DOMINIOS, ETAPA_POR_ID, PIEZAS, REGLA_DEL_TERRENO, etapasDe,
  ESTADO_LABEL, type Dato,
} from '@/lib/sistema/mapa'
import { entradasDe, frentesDe } from '@/lib/sistema/bitacora'
import { NODO_POR_ID, otraPunta, relacionesDe, type Relacion } from '@/lib/sistema/relaciones'
import { Bloque, Chip, Cifra, EtiquetaEstado, ListaBitacora, ListaFrentes, Plegable } from './piezas'
import type { LectorDeCifras } from './mapa-vista'

type Agregar = (id: string) => void

/**
 * Qué pasa al tocar el nombre de otra tarjeta: en Comparar se suma a lo
 * elegido; en Explorar, esa tarjeta pasa al centro.
 */
export type Accion = 'agregar' | 'ir'

export function Ficha({
  id, cifra, onAgregar, accion = 'agregar',
}: {
  id: string
  cifra: LectorDeCifras
  onAgregar: Agregar
  accion?: Accion
}) {
  const n = NODO_POR_ID.get(id)
  const conexiones = <Conexiones id={id} onAgregar={onAgregar} accion={accion} />
  if (n?.tipo === 'etapa') return <FichaEtapa id={id} cifra={cifra} conexiones={conexiones} />
  if (n?.tipo === 'app') return <FichaApp id={id} conexiones={conexiones} />
  if (n?.tipo === 'pieza') return <FichaPieza id={id} cifra={cifra} conexiones={conexiones} />
  return null
}

// ─── Etapa ────────────────────────────────────────────────────────────────────

function FichaEtapa({ id, cifra, conexiones }: { id: string; cifra: LectorDeCifras; conexiones: ReactNode }) {
  const e = ETAPA_POR_ID.get(id)!
  const dominio = DOMINIOS.find((d) => d.id === e.dominio)!
  const cadena = etapasDe(e.dominio)
  const frentes = frentesDe(id)
  const entradas = entradasDe(id)

  return (
    <>
      <Encabezado
        rotulo={`Etapa ${cadena.findIndex((x) => x.id === id) + 1} de ${cadena.length} · ${dominio.nombre}`}
        titulo={e.nombre}
      >
        <EtiquetaEstado estado={e.estado} />
        <span className="text-[12px] text-tenue">{e.responsable}</span>
      </Encabezado>

      <Bloque titulo="Qué recibe"><Texto>{e.recibe}</Texto></Bloque>
      <Bloque titulo="Qué hace">
        <ul className="space-y-1.5">
          {e.hace.map((h, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-tinta">
              <span className="text-taupe">—</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </Bloque>
      <Bloque titulo="Qué entrega"><Texto>{e.entrega}</Texto></Bloque>

      {e.compuerta && (
        <Bloque titulo="Para pasar a la siguiente">
          <div className={`border-l-2 pl-3 ${e.compuerta.bloquea ? 'border-ambar' : 'border-linea'}`}>
            <p className="text-[13px] font-medium text-tinta">{e.compuerta.titulo}</p>
            <p className="mt-1 text-[12.5px] font-light leading-relaxed text-suave">{e.compuerta.explicacion}</p>
            <p className="mt-1.5 text-[11px] text-tenue">
              {e.compuerta.bloquea
                ? 'El sistema lo impide: no es solo un acuerdo.'
                : 'Hoy es un acuerdo del equipo; el sistema todavía no lo verifica.'}
            </p>
          </div>
        </Bloque>
      )}

      {conexiones}

      {e.pulso.length > 0 && (
        <Bloque titulo="Cómo va hoy">
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            {e.pulso.map((m) => {
              const c = cifra(m)
              if (!c) return null
              const total = c.de ? cifra(c.de)?.valor ?? null : null
              return <Cifra key={m} valor={c.valor} etiqueta={c.etiqueta} de={total} problema={c.problema} destacada />
            })}
          </div>
        </Bloque>
      )}

      {(e.pendiente || frentes.length > 0) && (
        <Bloque titulo="Lo que falta aquí"><ListaFrentes pendiente={e.pendiente} frentes={frentes} /></Bloque>
      )}

      <Pliegues>
        <Plegable titulo="Dónde queda guardado"><ListaDatos datos={e.datos} /></Plegable>
        {entradas.length > 0 && (
          <Plegable titulo={`En la bitácora · ${entradas.length}`}><ListaBitacora entradas={entradas} /></Plegable>
        )}
      </Pliegues>
    </>
  )
}

// ─── Aplicación ───────────────────────────────────────────────────────────────

function FichaApp({ id, conexiones }: { id: string; conexiones: ReactNode }) {
  const a = APP_POR_ID.get(id)!
  const frentes = frentesDe(id)
  const entradas = entradasDe(id)

  return (
    <>
      <Encabezado rotulo={`Aplicación · ${a.clase}`} titulo={a.nombre}>
        <EtiquetaEstado estado={a.estado} />
        {a.offline && <span className="text-[11px] text-bosque">funciona sin señal</span>}
      </Encabezado>

      <Bloque titulo="Para qué sirve"><Texto>{a.para}</Texto></Bloque>
      <Bloque titulo="Dónde se abre"><Texto>{a.donde}</Texto></Bloque>

      {conexiones}

      {frentes.length > 0 && <Bloque titulo="Lo que falta"><ListaFrentes frentes={frentes} /></Bloque>}

      <Pliegues>
        {entradas.length > 0 && (
          <Plegable titulo={`En la bitácora · ${entradas.length}`}><ListaBitacora entradas={entradas} /></Plegable>
        )}
        {a.tecnica && (
          <Plegable titulo="Detalle técnico">
            <p className="text-[12px] font-light leading-relaxed text-suave">{a.tecnica}</p>
            <code className="mt-1.5 block font-mono text-[11px] text-pizarra">{a.carpeta}</code>
          </Plegable>
        )}
      </Pliegues>
    </>
  )
}

// ─── Pieza del núcleo ─────────────────────────────────────────────────────────

function FichaPieza({ id, cifra, conexiones }: { id: string; cifra: LectorDeCifras; conexiones: ReactNode }) {
  const p = PIEZAS.find((x) => x.id === id)!
  const frentes = frentesDe(id)
  const entradas = entradasDe(id)

  return (
    <>
      <Encabezado rotulo={p.dominio === 'nucleo' ? 'Núcleo compartido' : 'Soporte · administración'} titulo={p.nombre} />
      <div className="mt-4"><Texto>{p.que}</Texto></div>

      <Bloque titulo="Qué guarda"><ListaDatos datos={p.datos} cifra={cifra} /></Bloque>

      {conexiones}

      {frentes.length > 0 && <Bloque titulo="Lo que falta"><ListaFrentes frentes={frentes} /></Bloque>}

      {entradas.length > 0 && (
        <Pliegues>
          <Plegable titulo={`En la bitácora · ${entradas.length}`}><ListaBitacora entradas={entradas} /></Plegable>
        </Pliegues>
      )}
    </>
  )
}

// ─── Con quién se conecta ─────────────────────────────────────────────────────

/**
 * Las líneas de la tarjeta, agrupadas por lo que significan. El título de cada
 * grupo se dice desde la tarjeta elegida: «viene de», «pasa a», «se hace con».
 */
function Conexiones({ id, onAgregar, accion }: { id: string; onAgregar: Agregar; accion: Accion }) {
  const rels = relacionesDe(id)
  const grupos: { titulo: string; rels: Relacion[] }[] = [
    { titulo: 'Viene de', rels: rels.filter((r) => r.tipo === 'avance' && r.a === id) },
    { titulo: 'Pasa a', rels: rels.filter((r) => r.tipo === 'avance' && r.de === id) },
    { titulo: 'La corrige el terreno', rels: rels.filter((r) => r.tipo === 'devolucion' && r.a === id) },
    { titulo: 'Le devuelve a la oficina', rels: rels.filter((r) => r.tipo === 'devolucion' && r.de === id) },
    { titulo: 'Se hace con', rels: rels.filter((r) => r.tipo === 'usa' && r.a === id) },
    { titulo: 'Trabaja en', rels: rels.filter((r) => r.tipo === 'usa' && r.de === id) },
    { titulo: 'Guarda en', rels: rels.filter((r) => r.tipo === 'guarda' && r.de === id) },
    { titulo: 'La usan', rels: rels.filter((r) => r.tipo === 'guarda' && r.a === id) },
  ].filter((g) => g.rels.length > 0)
  const devuelve = rels.some((r) => r.tipo === 'devolucion')

  if (grupos.length === 0) {
    return (
      <Bloque titulo="Con quién se conecta">
        <p className="text-[12.5px] font-light leading-relaxed text-suave">
          Con ninguna tarjeta del mapa: no es parte del proceso de siembra ni del de conservación, sino de
          lo que hace funcionar la operación.
        </p>
      </Bloque>
    )
  }

  return (
    <Bloque titulo="Con quién se conecta">
      <div className="space-y-4">
        {grupos.map((g) => (
          <div key={g.titulo}>
            <p className="mb-1.5 text-[11px] text-tenue">{g.titulo}</p>
            <ul className="space-y-2.5">
              {g.rels.map((r) => (
                <li key={r.id}>
                  <Chip
                    id={otraPunta(r, id)}
                    onClick={onAgregar}
                    titulo={accion === 'ir' ? `Llevar ${NODO_POR_ID.get(otraPunta(r, id))?.nombre} al centro` : undefined}
                  />
                  <p className="mt-1 text-[12px] font-light leading-snug text-suave">
                    {r.tipo === 'guarda' ? <Tablas datos={r.tablas ?? []} /> : r.que}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {devuelve && (
          <div className="border-l-2 border-pizarra pl-3">
            <p className="text-[12.5px] font-medium text-tinta">{REGLA_DEL_TERRENO.titulo}</p>
            <p className="mt-1 text-[12px] font-light leading-relaxed text-suave">{REGLA_DEL_TERRENO.cuerpo}</p>
          </div>
        )}
      </div>
      <p className="mt-3 text-[10.5px] text-tenue">
        {accion === 'ir'
          ? 'Toca un nombre para llevarlo al centro.'
          : 'Toca un nombre para elegirlo también y ver qué tienen en común.'}
      </p>
    </Bloque>
  )
}

// ─── Piezas de la ficha ───────────────────────────────────────────────────────

function Encabezado({ rotulo, titulo, children }: { rotulo: string; titulo: string; children?: ReactNode }) {
  return (
    <header>
      <p className="font-display text-[9.5px] font-semibold uppercase tracking-[.2em] text-tenue">{rotulo}</p>
      <h2 className="mt-1.5 font-display text-[1.45rem] font-semibold leading-tight text-tinta">{titulo}</h2>
      {children && <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">{children}</div>}
    </header>
  )
}

function Texto({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-relaxed text-tinta">{children}</p>
}

function Pliegues({ children }: { children: ReactNode }) {
  return <div className="mt-7 divide-y divide-fina border-y border-fina">{children}</div>
}

function Tablas({ datos }: { datos: Dato[] }) {
  return (
    <>
      {datos.map((d, i) => (
        <span key={d.nombre}>
          {i > 0 && ', '}
          <code className="font-mono text-[11px] text-pizarra">{d.nombre}</code>
        </span>
      ))}
    </>
  )
}

/** Las tablas, con su nombre sin código cuando lo tienen y su cifra viva. */
function ListaDatos({ datos, cifra }: { datos: Dato[]; cifra?: LectorDeCifras }) {
  return (
    <ul className="space-y-2.5 pb-1">
      {datos.map((d) => {
        const m = d.pulso && cifra ? cifra(d.pulso) : null
        return (
          <li key={d.nombre}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12.5px] font-medium text-tinta">{d.etiqueta ?? d.que}</span>
              {m?.valor != null && (
                <span className="font-display text-[14px] font-bold tabular-nums text-bosque">
                  {m.valor.toLocaleString('es-CO')}
                </span>
              )}
            </div>
            {d.etiqueta && <p className="text-[12px] font-light leading-snug text-suave">{d.que}</p>}
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <code className="font-mono text-[10.5px] text-pizarra">{d.nombre}</code>
              {d.estado && d.estado !== 'produccion' && (
                <span className="text-[10px] text-marron">{ESTADO_LABEL[d.estado].toLowerCase()}</span>
              )}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
