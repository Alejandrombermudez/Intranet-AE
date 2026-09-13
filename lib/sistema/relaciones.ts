/**
 * LAS RELACIONES DEL MAPA
 * ───────────────────────
 * Qué tarjeta se conecta con cuál y por qué. Nada de esto se escribe a mano:
 * sale de lo que `mapa.ts` ya dice —quién le pasa trabajo a quién, qué
 * aplicación trabaja en qué etapa, en qué tablas guarda cada una—. Si mañana
 * una etapa empieza a guardar en `geo`, su línea a Geografía aparece sola.
 *
 * También es lo que responde el panel al elegir varias tarjetas: cómo se
 * comunican, por dónde pasa el trabajo de una a otra y qué tienen en común.
 */

import {
  APLICACIONES, ENLACES, ETAPAS, PIEZAS, esquemaDe,
  type Dato, type DominioId, type Estado,
} from './mapa'
import { BITACORA, FRENTES_ABIERTOS, type Entrada, type Frente } from './bitacora'

// ─── Las tarjetas ─────────────────────────────────────────────────────────────

export type TipoNodo = 'etapa' | 'app' | 'pieza'

/** Cualquier tarjeta del mapa, sin importar de qué clase sea. */
export interface Nodo {
  id: string
  tipo: TipoNodo
  nombre: string
  /** El nombre que cabe en una lista corta. */
  corto: string
  /** Las apps no pertenecen a ningún dominio: los cruzan. */
  dominio: DominioId | null
  /** Las piezas del núcleo no tienen estado propio: son tablas que ya existen. */
  estado: Estado | null
  datos: Dato[]
}

export const NODOS: Nodo[] = [
  ...ETAPAS.map((e): Nodo => ({
    id: e.id, tipo: 'etapa', nombre: e.nombre, corto: e.enBreve.nombre,
    dominio: e.dominio, estado: e.estado, datos: e.datos,
  })),
  ...APLICACIONES.map((a): Nodo => ({
    id: a.id, tipo: 'app', nombre: a.nombre, corto: a.nombreCorto ?? a.nombre,
    dominio: null, estado: a.estado, datos: [],
  })),
  ...PIEZAS.map((p): Nodo => ({
    id: p.id, tipo: 'pieza', nombre: p.nombre, corto: p.nombre,
    dominio: p.dominio, estado: null, datos: p.datos,
  })),
]

export const NODO_POR_ID = new Map(NODOS.map((n) => [n.id, n]))

/** El orden del proceso: sirve para que las listas se lean en el sentido del trabajo. */
const ORDEN = new Map(NODOS.map((n, i) => [n.id, i]))
export const enOrden = (ids: Iterable<string>) => [...ids].sort((a, b) => (ORDEN.get(a) ?? 0) - (ORDEN.get(b) ?? 0))

// ─── Las líneas ───────────────────────────────────────────────────────────────

export type TipoRelacion =
  | 'avance'     // el trabajo pasa a la etapa siguiente
  | 'devolucion' // el terreno corrige a la oficina
  | 'usa'        // una aplicación trabaja en una etapa
  | 'guarda'     // una etapa guarda en una pieza del núcleo compartido

export interface Relacion {
  id: string
  de: string
  a: string
  tipo: TipoRelacion
  /** Qué viaja por aquí, o qué papel cumple la app en esa etapa. */
  que: string
  /** Rótulo para escribir sobre la línea. Solo lo tienen el avance y la devolución. */
  corto?: string
  /** Para `guarda`: las tablas de la etapa que viven en esa pieza. */
  tablas?: Dato[]
}

/** Los esquemas que cubre cada pieza del núcleo, deducidos de sus tablas. */
const ESQUEMAS_DE_PIEZA = new Map(
  PIEZAS.map((p) => [p.id, new Set(p.datos.map(esquemaDe).filter((x): x is string => !!x))]),
)

export const RELACIONES: Relacion[] = [
  ...ENLACES.map((l): Relacion => ({
    id: `${l.tipo}:${l.de}:${l.a}`,
    de: l.de,
    a: l.a,
    tipo: l.tipo === 'devolucion' ? 'devolucion' : 'avance',
    que: l.que,
    corto: l.corto ?? l.que,
  })),
  ...ETAPAS.flatMap((e) =>
    e.apps.map((a): Relacion => ({ id: `usa:${a.app}:${e.id}`, de: a.app, a: e.id, tipo: 'usa', que: a.rol })),
  ),
  ...ETAPAS.flatMap((e) =>
    PIEZAS.flatMap((p): Relacion[] => {
      const esquemas = ESQUEMAS_DE_PIEZA.get(p.id)!
      const tablas = e.datos.filter((d) => {
        const esq = esquemaDe(d)
        return !!esq && esquemas.has(esq)
      })
      return tablas.length
        ? [{ id: `guarda:${e.id}:${p.id}`, de: e.id, a: p.id, tipo: 'guarda', que: p.nombre, tablas }]
        : []
    }),
  ),
]

export function relacionesDe(id: string): Relacion[] {
  return RELACIONES.filter((r) => r.de === id || r.a === id)
}

export const otraPunta = (r: Relacion, id: string) => (r.de === id ? r.a : r.de)

export function vecinosDe(id: string): Set<string> {
  return new Set(relacionesDe(id).map((r) => otraPunta(r, id)))
}

// ─── El camino entre dos tarjetas ─────────────────────────────────────────────

/**
 * Cuánto «cuesta» cruzar cada clase de línea al buscar un camino. Se prefiere
 * el camino del proceso sobre el atajo por una aplicación: de Jurídica a Plan,
 * la respuesta útil es «pasa por SIG y por Campo», no «las dos están en la
 * intranet», aunque ese atajo tenga menos pasos.
 */
const PESO: Record<TipoRelacion, number> = { avance: 1, devolucion: 1, guarda: 1.5, usa: 2.5 }

export interface Camino {
  nodos: string[]
  relaciones: Relacion[]
  costo: number
}

/** El camino más corto entre dos tarjetas, o null si no hay ninguno. */
export function camino(desde: string, hasta: string): Camino | null {
  const dist = new Map<string, number>([[desde, 0]])
  const previo = new Map<string, Relacion>()
  const cerrados = new Set<string>()

  for (;;) {
    let actual: string | null = null
    for (const [id, d] of dist) {
      if (!cerrados.has(id) && (actual === null || d < dist.get(actual)!)) actual = id
    }
    if (actual === null) return null
    if (actual === hasta) break
    cerrados.add(actual)
    for (const r of relacionesDe(actual)) {
      const otro = otraPunta(r, actual)
      const d = dist.get(actual)! + PESO[r.tipo]
      if (d < (dist.get(otro) ?? Infinity)) {
        dist.set(otro, d)
        previo.set(otro, r)
      }
    }
  }

  const nodos = [hasta]
  const relaciones: Relacion[] = []
  for (let x = hasta; x !== desde; ) {
    const r = previo.get(x)!
    relaciones.unshift(r)
    x = otraPunta(r, x)
    nodos.unshift(x)
  }
  return { nodos, relaciones, costo: dist.get(hasta)! }
}

// ─── Lo que tienen en común varias tarjetas ───────────────────────────────────

export interface Analisis {
  /** Líneas cuyas dos puntas están elegidas. */
  directas: Relacion[]
  /** Los caminos que unen los grupos elegidos que no se tocan directamente. */
  caminos: Camino[]
  /** Elegidas que no llegan a ninguna otra por ningún camino. */
  aisladas: string[]
  /** Apps que trabajan en dos o más de las etapas elegidas. */
  appsCompartidas: { app: string; etapas: string[] }[]
  /** Etapas donde trabajan dos o más de las apps elegidas. */
  etapasCompartidas: { etapa: string; apps: string[] }[]
  /** Piezas del núcleo donde guardan dos o más de las etapas elegidas. */
  lugares: { pieza: string; etapas: string[] }[]
  /** Tablas que aparecen en dos o más de las elegidas. */
  tablas: { nombre: string; nodos: string[] }[]
  entradas: { entrada: Entrada; nodos: string[] }[]
  frentes: { frente: Frente; nodos: string[] }[]
  /** Hay a la vez algo de Siembra y algo de Conservación. */
  cruzaDominios: boolean
  /** Si todas las elegidas que tienen estado están en el mismo. */
  mismoEstado: Estado | null
}

const tocaA = (x: { etapas?: string[]; apps?: string[]; piezas?: string[] }, id: string) =>
  !!(x.etapas?.includes(id) || x.apps?.includes(id) || x.piezas?.includes(id))

/** Agrupa `valor → ids` y se queda con lo que junta a dos o más. */
function compartido(pares: [string, string][]): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const [valor, id] of pares) {
    const l = m.get(valor)
    if (!l) m.set(valor, [id])
    else if (!l.includes(id)) l.push(id)
  }
  return new Map([...m].filter(([, l]) => l.length > 1))
}

export function analizar(elegidas: string[]): Analisis {
  const sel = new Set(elegidas)
  const nodos = enOrden(sel).map((id) => NODO_POR_ID.get(id)!).filter(Boolean)

  const directas = RELACIONES.filter((r) => sel.has(r.de) && sel.has(r.a))

  // Grupos: tarjetas elegidas que ya se tocan entre sí por líneas directas.
  const grupo = new Map(nodos.map((n) => [n.id, n.id]))
  const raiz = (x: string): string => (grupo.get(x) === x ? x : raiz(grupo.get(x)!))
  const unir = (a: string, b: string) => grupo.set(raiz(a), raiz(b))
  for (const r of directas) unir(r.de, r.a)

  // Los grupos sueltos se unen por el camino más barato, de a uno, hasta que
  // no quede nada por unir (como un árbol de expansión mínima): así el panel
  // explica cada salto una sola vez y no cada pareja posible.
  const candidatos: Camino[] = []
  for (let i = 0; i < nodos.length; i++) {
    for (let j = i + 1; j < nodos.length; j++) {
      if (raiz(nodos[i].id) === raiz(nodos[j].id)) continue
      const c = camino(nodos[i].id, nodos[j].id)
      if (c) candidatos.push(c)
    }
  }
  const caminos: Camino[] = []
  for (const c of candidatos.sort((a, b) => a.costo - b.costo)) {
    const a = c.nodos[0]
    const b = c.nodos[c.nodos.length - 1]
    if (raiz(a) === raiz(b)) continue
    unir(a, b)
    caminos.push(c)
  }
  const grupos = new Map<string, number>()
  for (const n of nodos) grupos.set(raiz(n.id), (grupos.get(raiz(n.id)) ?? 0) + 1)
  const aisladas = nodos.length > 1 ? nodos.filter((n) => grupos.get(raiz(n.id)) === 1).map((n) => n.id) : []

  const etapas = nodos.filter((n) => n.tipo === 'etapa').map((n) => n.id)
  const apps = nodos.filter((n) => n.tipo === 'app').map((n) => n.id)
  const usa = RELACIONES.filter((r) => r.tipo === 'usa')
  const guarda = RELACIONES.filter((r) => r.tipo === 'guarda')

  // Lo que ya está elegido no se cuenta como «en común»: si la app de campo
  // está elegida, que trabaje en SIG y en Campo ya lo dicen las directas.
  const appsCompartidas = [...compartido(
    usa.filter((r) => etapas.includes(r.a) && !sel.has(r.de)).map((r) => [r.de, r.a]),
  )].map(([app, ets]) => ({ app, etapas: enOrden(ets) }))

  const etapasCompartidas = [...compartido(
    usa.filter((r) => apps.includes(r.de) && !sel.has(r.a)).map((r) => [r.a, r.de]),
  )].map(([etapa, as]) => ({ etapa, apps: enOrden(as) }))

  const lugares = [...compartido(
    guarda.filter((r) => etapas.includes(r.de) && !sel.has(r.a)).map((r) => [r.a, r.de]),
  )].map(([pieza, ets]) => ({ pieza, etapas: enOrden(ets) }))

  // Solo las tablas que no son del núcleo: las del núcleo ya salen arriba, en
  // «guarda en» (si la pieza está elegida) o en «guardan en el mismo lugar».
  const delNucleo = new Set([...ESQUEMAS_DE_PIEZA.values()].flatMap((s) => [...s]))
  const tablas = [...compartido(
    nodos
      .filter((n) => n.tipo === 'etapa')
      .flatMap((n) => n.datos
        .filter((d) => { const e = esquemaDe(d); return !!e && !delNucleo.has(e) })
        .map((d): [string, string] => [d.nombre, n.id])),
  )].map(([nombre, ids]) => ({ nombre, nodos: enOrden(ids) }))

  const entradas = BITACORA
    .map((entrada) => ({ entrada, nodos: nodos.filter((n) => tocaA(entrada, n.id)).map((n) => n.id) }))
    .filter((x) => x.nodos.length > 1)

  const frentes = FRENTES_ABIERTOS
    .map((frente) => ({ frente, nodos: nodos.filter((n) => tocaA(frente, n.id)).map((n) => n.id) }))
    .filter((x) => x.nodos.length > 1)

  const dominios = new Set(nodos.map((n) => n.dominio))
  const estados = new Set(nodos.map((n) => n.estado).filter((e): e is Estado => !!e))

  return {
    directas,
    caminos,
    aisladas,
    appsCompartidas,
    etapasCompartidas,
    lugares,
    tablas,
    entradas,
    frentes,
    cruzaDominios: dominios.has('siembra') && dominios.has('conservacion'),
    mismoEstado: estados.size === 1 && nodos.every((n) => n.estado) ? [...estados][0] : null,
  }
}
