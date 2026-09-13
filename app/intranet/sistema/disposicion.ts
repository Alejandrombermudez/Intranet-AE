/**
 * DÓNDE VA CADA TARJETA
 * ─────────────────────
 * La posición de cada tarjeta en el lienzo del mapa. Es un diagrama dibujado a
 * propósito, no uno que se acomoda solo: la app de campo va encima del SIG y
 * del Campo porque es la extensión de los dos; el núcleo va entre Siembra y
 * Conservación porque es lo único que tocan ambas.
 *
 * Las alturas no se miden en pantalla: salen de cuántas filas tiene cada
 * tarjeta, así que todo el dibujo —tarjetas y líneas— se conoce antes de
 * pintar. Por eso el lienzo puede escalarse sin recalcular nada.
 *
 * SI AGREGAS UNA ETAPA, UNA APP O UNA PIEZA EN `mapa.ts`, dale aquí su lugar
 * en POSICION. Sin él no aparece en el mapa (y la consola lo avisa).
 */

import { MARCA } from '@/lib/expediente-formato'
import type { DominioId } from '@/lib/sistema/mapa'
import {
  NODOS, NODO_POR_ID, RELACIONES, enOrden, otraPunta, relacionesDe,
  type Relacion, type TipoRelacion,
} from '@/lib/sistema/relaciones'

/**
 * El color de una tarjeta dice a qué parte del sistema pertenece: el filete de
 * arriba en el lienzo y el cuadrito de su nombre en el panel.
 */
const COLOR_DOMINIO: Record<DominioId, string> = {
  siembra: MARCA.bosque,
  conservacion: MARCA.musgo,
  nucleo: MARCA.pizarra,
  soporte: MARCA.taupe,
}
export const COLOR_APP = MARCA.marron

/**
 * Color de cada clase de línea: en reposo y cuando toca a una tarjeta elegida.
 * El avance usa la variable de la paleta, por eso el color se aplica con
 * `style` y no como atributo del SVG.
 */
export const COLOR_LINEA: Record<TipoRelacion, { normal: string; activa: string }> = {
  avance: { normal: 'var(--color-tenue)', activa: MARCA.bosque },
  devolucion: { normal: MARCA.cielo, activa: MARCA.pizarra },
  usa: { normal: MARCA.taupe, activa: MARCA.marron },
  guarda: { normal: MARCA.celeste, activa: MARCA.pizarra },
}

/** El punteado de cada clase: el de guardar es de guiones, para distinguirlo. */
export const trazoDe = (t: TipoRelacion) => (t === 'guarda' ? '5 4' : '1.5 4.5')

export function colorDe(id: string): string {
  const n = NODO_POR_ID.get(id)
  if (!n) return MARCA.taupe
  return n.tipo === 'app' ? COLOR_APP : COLOR_DOMINIO[n.dominio ?? 'soporte']
}

export const TARJETA = {
  ancho: 180,
  /** Cabe un nombre en dos líneas: «Red de árboles semilleros» no se corta. */
  cabeza: 62,
  fila: 21,
  relleno: 10,
  pie: 30,
  /** Filete de arriba (2 px, el color del dominio) más el de abajo. */
  bordes: 3,
} as const

/** Distancia entre columnas: el ancho de una tarjeta más el hueco de la línea. */
const PASO = 212
/** Deja libre la franja de la izquierda para el nombre de cada carril. */
const X0 = 52
const ENTRE_FILAS = 40
const MARGEN_CARRIL = 16
const ENTRE_CARRILES = 14

export function altoDe(id: string): number {
  const n = NODO_POR_ID.get(id)
  if (!n) return 0
  const { cabeza, fila, relleno, pie, bordes } = TARJETA
  if (n.tipo === 'etapa') return cabeza + relleno + 2 * fila + pie + bordes
  if (n.tipo === 'app') return cabeza + relleno + 2 * fila + bordes
  return cabeza + relleno + n.datos.length * fila + bordes
}

const ALTO_ETAPA = altoDe('juridica')
const ALTO_APP = altoDe('intranet')
const ALTO_PIEZA = Math.max(...NODOS.filter((n) => n.tipo === 'pieza').map((n) => altoDe(n.id)))

// Las cinco filas, de arriba abajo: apps de siembra, siembra, núcleo,
// conservación y apps de conservación.
const Y = (() => {
  const appsSiembra = ENTRE_CARRILES + MARGEN_CARRIL
  const siembra = appsSiembra + ALTO_APP + ENTRE_FILAS
  const nucleo = siembra + ALTO_ETAPA + 2 * MARGEN_CARRIL + ENTRE_CARRILES
  const conservacion = nucleo + ALTO_PIEZA + 2 * MARGEN_CARRIL + ENTRE_CARRILES
  const appsConservacion = conservacion + ALTO_ETAPA + ENTRE_FILAS
  return { appsSiembra, siembra, nucleo, conservacion, appsConservacion }
})()
type Fila = keyof typeof Y

/** [columna, fila]. Las columnas con medio (1.5) quedan entre dos etapas. */
const POSICION: Record<string, [number, Fila]> = {
  intranet:        [0.5, 'appsSiembra'],
  app_campo:       [1.5, 'appsSiembra'],
  app_vivero:      [4, 'appsSiembra'],
  app_actividades: [5, 'appsSiembra'],

  juridica:  [0, 'siembra'],
  sig_i:     [1, 'siembra'],
  campo:     [2, 'siembra'],
  plan:      [3, 'siembra'],
  vivero:    [4, 'siembra'],
  ejecucion: [5, 'siembra'],

  core:     [0, 'nucleo'],
  geo:      [1, 'nucleo'],
  catalogo: [2.5, 'nucleo'],
  soporte:  [5, 'nucleo'],

  ras_familias:  [0, 'conservacion'],
  ras_arboles:   [1, 'conservacion'],
  ras_monitoreo: [2, 'conservacion'],

  geoae:          [0.5, 'appsConservacion'],
  app_semilleros: [1.5, 'appsConservacion'],
  app_aves:       [2.5, 'appsConservacion'],
}

export interface Caja {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export const CAJAS = new Map<string, Caja>()
for (const n of NODOS) {
  const p = POSICION[n.id]
  if (!p) {
    console.warn(`[mapa del sistema] «${n.id}» no tiene lugar en disposicion.ts: no se dibuja.`)
    continue
  }
  CAJAS.set(n.id, { id: n.id, x: X0 + p[0] * PASO, y: Y[p[1]], w: TARJETA.ancho, h: altoDe(n.id) })
}

export const LIENZO = {
  ancho: X0 + 5 * PASO + TARJETA.ancho + 24,
  alto: Y.appsConservacion + ALTO_APP + MARGEN_CARRIL + ENTRE_CARRILES,
}

/** Las tres franjas de fondo, con su nombre escrito de canto a la izquierda. */
export const CARRILES = [
  {
    id: 'siembra',
    nombre: 'Siembra · Restauración',
    y: ENTRE_CARRILES,
    h: Y.siembra + ALTO_ETAPA + MARGEN_CARRIL - ENTRE_CARRILES,
    color: MARCA.bosque,
  },
  {
    id: 'nucleo',
    nombre: 'Núcleo compartido',
    y: Y.nucleo - MARGEN_CARRIL,
    h: ALTO_PIEZA + 2 * MARGEN_CARRIL,
    color: MARCA.pizarra,
  },
  {
    id: 'conservacion',
    nombre: 'Conservación · RAS',
    y: Y.conservacion - MARGEN_CARRIL,
    h: Y.appsConservacion + ALTO_APP - Y.conservacion + 2 * MARGEN_CARRIL,
    color: MARCA.musgo,
  },
]

// ─── Las líneas ───────────────────────────────────────────────────────────────

export interface Trazo {
  r: Relacion
  /** El trazado SVG, en coordenadas del lienzo. */
  d: string
  /**
   * Si se ve sin elegir nada. El flujo y las apps vecinas, sí; lo que cruzaría
   * medio mapa (la intranet hacia conservación, el núcleo hacia sus etapas) solo
   * aparece al elegir una de sus puntas. Así el mapa en reposo tiene las líneas
   * justas para seguir el trabajo.
   */
  enReposo: boolean
}

const centro = (c: Caja) => c.x + c.w / 2

/**
 * Las líneas verticales salen repartidas a lo ancho del borde, ordenadas por
 * dónde está la otra punta, para que dos líneas de la misma tarjeta no se
 * crucen al salir.
 */
function puntosDeAnclaje(): Map<string, number> {
  const lados = new Map<string, { r: Relacion; otroX: number }[]>()
  for (const r of RELACIONES) {
    const a = CAJAS.get(r.de)
    const b = CAJAS.get(r.a)
    if (!a || !b || a.y === b.y) continue
    const [arriba, abajo] = a.y < b.y ? [a, b] : [b, a]
    for (const [caja, lado, otra] of [[arriba, 'abajo', abajo], [abajo, 'arriba', arriba]] as const) {
      const k = `${caja.id}:${lado}`
      const l = lados.get(k) ?? []
      l.push({ r, otroX: centro(otra) })
      lados.set(k, l)
    }
  }
  const x = new Map<string, number>()
  for (const [k, l] of lados) {
    const caja = CAJAS.get(k.split(':')[0])!
    l.sort((p, q) => p.otroX - q.otroX)
    l.forEach(({ r }, i) => x.set(`${k}:${r.id}`, caja.x + (caja.w * (i + 1)) / (l.length + 1)))
  }
  return x
}

export const TRAZOS: Trazo[] = (() => {
  const anclaje = puntosDeAnclaje()
  // Entre SIG y Campo van dos líneas (el avance y la devolución): se separan.
  const porPareja = new Map<string, number>()
  const trazos: Trazo[] = []

  for (const r of RELACIONES) {
    const a = CAJAS.get(r.de)
    const b = CAJAS.get(r.a)
    if (!a || !b) continue

    if (a.y === b.y) {
      const pareja = [r.de, r.a].sort().join('|')
      const n = porPareja.get(pareja) ?? 0
      porPareja.set(pareja, n + 1)
      const hayDos = RELACIONES.filter((o) => [o.de, o.a].sort().join('|') === pareja).length > 1
      const y = a.y + a.h / 2 + (hayDos ? (n === 0 ? -6 : 6) : 0)
      const x1 = a.x < b.x ? a.x + a.w : a.x
      const x2 = a.x < b.x ? b.x : b.x + b.w
      trazos.push({ r, d: `M ${x1} ${y} L ${x2} ${y}`, enReposo: true })
      continue
    }

    const [arriba, abajo] = a.y < b.y ? [a, b] : [b, a]
    const x1 = anclaje.get(`${arriba.id}:abajo:${r.id}`) ?? centro(arriba)
    const x2 = anclaje.get(`${abajo.id}:arriba:${r.id}`) ?? centro(abajo)
    const y1 = arriba.y + arriba.h
    const y2 = abajo.y
    const ym = (y1 + y2) / 2
    const vecinas = Math.abs(centro(a) - centro(b)) <= PASO && y2 - y1 <= ENTRE_FILAS + 2 * MARGEN_CARRIL
    trazos.push({
      r,
      d: `M ${x1} ${y1} C ${x1} ${ym}, ${x2} ${ym}, ${x2} ${y2}`,
      enReposo: r.tipo === 'usa' && vecinas,
    })
  }
  return trazos
})()

// ─── La escena: una tarjeta en el centro (vista Explorar) ─────────────────────

/**
 * Dónde queda cada tarjeta cuando una pasa al centro. Se usa el mismo espacio
 * del lienzo para que cada tarjeta viaje de su lugar en el mapa a su puesto:
 * lo que viene antes, a la izquierda; lo que sigue, a la derecha; las apps,
 * arriba; dónde guarda, abajo. Si el centro es una app o una pieza del núcleo,
 * sus etapas van en la fila de abajo o de arriba.
 *
 * Lo que no toca al centro no desaparece de golpe: se aleja del centro mientras
 * se desvanece, y vuelve desde ahí cuando le toca entrar.
 */
export type Lado = 'mapa' | 'centro' | 'izquierda' | 'derecha' | 'arriba' | 'abajo' | 'fuera'

export interface Puesto {
  /** Esquina superior izquierda de la tarjeta sin escalar, en coordenadas del lienzo. */
  x: number
  y: number
  escala: number
  lado: Lado
  /** Milisegundos antes de empezar a moverse: primero el centro, luego sus lados. */
  retraso: number
}

export interface TrazoFoco {
  r: Relacion
  d: string
  rotulo?: { x: number; y: number; texto: string }
}

export const ESCALA_CENTRO = 1.3
const CX = LIENZO.ancho / 2
const CY = LIENZO.alto / 2
const SEPARACION_LADO = 400
const HUECO_FILA = 70
const HUECO_PILA = 22
const HUECO_HILERA = 24

/** Un color por clase de línea, para leerse sobre la tinta. */
export const COLOR_LINEA_OSCURO: Record<TipoRelacion, string> = {
  avance: MARCA.hueso,
  devolucion: MARCA.cielo,
  usa: MARCA.taupe,
  guarda: MARCA.celeste,
}

function alejada(c: Caja): Puesto {
  const dx = c.x + c.w / 2 - CX
  const dy = c.y + c.h / 2 - CY
  return { x: CX + dx * 1.45 - c.w / 2, y: CY + dy * 1.45 - c.h / 2, escala: 0.8, lado: 'fuera', retraso: 0 }
}

type LadoVecino = 'izquierda' | 'derecha' | 'arriba' | 'abajo'

function ladoDeRelacion(r: Relacion, foco: string): LadoVecino {
  const tipoFoco = NODO_POR_ID.get(foco)?.tipo
  if (r.tipo === 'avance') return r.a === foco ? 'izquierda' : 'derecha'
  if (r.tipo === 'devolucion') return r.de === foco ? 'izquierda' : 'derecha'
  if (r.tipo === 'usa') return tipoFoco === 'etapa' ? 'arriba' : 'abajo'
  return tipoFoco === 'etapa' ? 'abajo' : 'arriba'
}

/** El rectángulo que ocupa lo visible: la cámara de la escena se ajusta a él. */
export interface Marco {
  x: number
  y: number
  w: number
  h: number
}

export function disposicionFoco(
  foco: string | null,
): { puestos: Map<string, Puesto>; trazos: TrazoFoco[]; marco: Marco } {
  const puestos = new Map<string, Puesto>()
  if (!foco || !CAJAS.has(foco)) {
    for (const c of CAJAS.values()) puestos.set(c.id, { x: c.x, y: c.y, escala: 1, lado: 'mapa', retraso: 0 })
    return { puestos, trazos: [], marco: { x: 0, y: 0, w: LIENZO.ancho, h: LIENZO.alto } }
  }

  // A cada vecina, un lado. Si la une más de una línea (SIG y Campo: el avance
  // y la devolución), manda la primera, que es la del avance.
  const rels = relacionesDe(foco).filter((r) => CAJAS.has(otraPunta(r, foco)))
  const ladoDe = new Map<string, LadoVecino>()
  for (const r of rels) {
    const otra = otraPunta(r, foco)
    if (!ladoDe.has(otra)) ladoDe.set(otra, ladoDeRelacion(r, foco))
  }
  const grupo = (l: LadoVecino) => enOrden([...ladoDe].filter(([, x]) => x === l).map(([id]) => id))

  const w = TARJETA.ancho
  const hc = altoDe(foco)
  const mitadW = (w * ESCALA_CENTRO) / 2
  const mitadH = (hc * ESCALA_CENTRO) / 2

  // Se centra el conjunto —la del medio y sus vecinas—, no solo la del medio:
  // si todo lo que la toca está debajo (la intranet y sus cinco etapas), el
  // centro sube para que el grupo no quede cargado hacia un lado.
  const altoPila = (ids: string[]) =>
    ids.reduce((t, id) => t + altoDe(id), 0) + HUECO_PILA * Math.max(0, ids.length - 1)
  const anchoHilera = (ids: string[]) => ids.length * w + HUECO_HILERA * Math.max(0, ids.length - 1)
  const [izq, der, arr, aba] = (['izquierda', 'derecha', 'arriba', 'abajo'] as const).map(grupo)
  const mitadPilas = Math.max(altoPila(izq), altoPila(der)) / 2
  const mitadHileras = Math.max(anchoHilera(arr), anchoHilera(aba)) / 2
  const hasta = (ids: string[]) => (ids.length ? mitadH + HUECO_FILA + Math.max(...ids.map(altoDe)) : 0)
  const arribaDe = Math.max(mitadH, mitadPilas, hasta(arr))
  const abajoDe = Math.max(mitadH, mitadPilas, hasta(aba))
  const lateral = (ids: string[]) => (ids.length ? SEPARACION_LADO + w / 2 : 0)
  const izquierdaDe = Math.max(mitadW, mitadHileras, lateral(izq))
  const derechaDe = Math.max(mitadW, mitadHileras, lateral(der))
  const cx = CX + (izquierdaDe - derechaDe) / 2
  const cy = CY + (arribaDe - abajoDe) / 2

  puestos.set(foco, { x: cx - w / 2, y: cy - hc / 2, escala: ESCALA_CENTRO, lado: 'centro', retraso: 0 })

  // A los costados, una pila centrada en la altura del centro.
  for (const [lado, signo] of [['izquierda', -1], ['derecha', 1]] as const) {
    const ids = grupo(lado)
    const total = ids.reduce((t, id) => t + altoDe(id), 0) + HUECO_PILA * Math.max(0, ids.length - 1)
    let y = cy - total / 2
    for (const id of ids) {
      puestos.set(id, { x: cx + signo * SEPARACION_LADO - w / 2, y, escala: 1, lado, retraso: 90 })
      y += altoDe(id) + HUECO_PILA
    }
  }
  // Arriba y abajo, una hilera centrada en el ancho del centro.
  for (const lado of ['arriba', 'abajo'] as const) {
    const ids = grupo(lado)
    let x = cx - (ids.length * w + HUECO_HILERA * Math.max(0, ids.length - 1)) / 2
    for (const id of ids) {
      const h = altoDe(id)
      const y = lado === 'arriba' ? cy - mitadH - HUECO_FILA - h : cy + mitadH + HUECO_FILA
      puestos.set(id, { x, y, escala: 1, lado, retraso: 160 })
      x += w + HUECO_HILERA
    }
  }
  for (const c of CAJAS.values()) if (!puestos.has(c.id)) puestos.set(c.id, alejada(c))

  // Las líneas van del borde del centro al de cada vecina, en el sentido de la
  // relación (de quien entrega a quien recibe). Las que salen por el mismo lado
  // se reparten a lo largo del borde del centro; las dos que unen SIG con Campo
  // se separan también en la otra punta, para que sus rótulos no se pisen.
  const trazos: TrazoFoco[] = []
  for (const lado of ['izquierda', 'derecha', 'arriba', 'abajo'] as const) {
    const lista = rels.filter((r) => ladoDe.get(otraPunta(r, foco)) === lado)
    lista.forEach((r, i) => {
      const otra = otraPunta(r, foco)
      const p = puestos.get(otra)!
      const h = altoDe(otra)
      const hermanas = lista.filter((o) => otraPunta(o, foco) === otra)
      const j = hermanas.indexOf(r) - (hermanas.length - 1) / 2
      const k = i - (lista.length - 1) / 2
      const horizontal = lado === 'izquierda' || lado === 'derecha'

      let exterior: [number, number]
      let interior: [number, number]
      if (lado === 'izquierda') {
        exterior = [p.x + w, p.y + h / 2 + j * 36]
        interior = [cx - mitadW, cy + k * 18]
      } else if (lado === 'derecha') {
        exterior = [p.x, p.y + h / 2 + j * 36]
        interior = [cx + mitadW, cy + k * 18]
      } else if (lado === 'arriba') {
        exterior = [p.x + w / 2, p.y + h]
        interior = [cx + k * 40, cy - mitadH]
      } else {
        exterior = [p.x + w / 2, p.y]
        interior = [cx + k * 40, cy + mitadH]
      }
      const [a, b] = r.de === foco ? [interior, exterior] : [exterior, interior]
      const mx = (a[0] + b[0]) / 2
      const my = (a[1] + b[1]) / 2
      const d = horizontal
        ? `M ${a[0]} ${a[1]} C ${mx} ${a[1]}, ${mx} ${b[1]}, ${b[0]} ${b[1]}`
        : `M ${a[0]} ${a[1]} C ${a[0]} ${my}, ${b[0]} ${my}, ${b[0]} ${b[1]}`
      trazos.push({ r, d, rotulo: r.corto ? { x: mx, y: my, texto: r.corto } : undefined })
    })
  }
  return {
    puestos,
    trazos,
    marco: {
      x: cx - izquierdaDe,
      y: cy - arribaDe,
      w: izquierdaDe + derechaDe,
      h: arribaDe + abajoDe,
    },
  }
}
