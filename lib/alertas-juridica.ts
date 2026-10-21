/**
 * ALERTAS DE JURÍDICA — datos de un predio que alguien tiene que mirar.
 *
 * Tabla `juridica.alertas` (docs/sql/migration_alertas_juridica.sql), pantalla
 * /intranet/juridica/alertas, API /api/juridica/alertas. Nació el 2026-10-21 del
 * cruce del shapefile de Elegibilidad LDH con jurídica: fincas que el SIG llama
 * distinto, municipios «Por definir», veredas escritas con el nombre del
 * municipio, fincas del SIG que jurídica no ha registrado.
 *
 * Dos orígenes:
 *  · `regla` — las detecta `reglasDePredio` cada vez que se abre la pantalla, y
 *    `yaNoAplica` las cierra solas cuando la ficha se corrige. Nadie las carga.
 *  · cualquier otro (`elegibilidad_ldh`…) — se cargan por SQL, con sugerencia.
 * La `clave` junta las dos: una regla y una carga sobre el mismo problema del
 * mismo predio son una sola alerta (`municipio:<predio_id>`).
 *
 * Sin dependencias de servidor: lo usan la API y la pantalla.
 */
import {
  VEREDAS_POR_MUNICIPIO, normalizarMunicipio, normalizarVereda,
} from '@/lib/veredas-caqueta'

export type TipoAlerta   = 'nombre' | 'municipio' | 'vereda' | 'sin_predio' | 'duplicado'
export type EstadoAlerta = 'abierta' | 'resuelta' | 'descartada'
export type CampoAlerta  = 'nombre_predio' | 'municipio' | 'vereda'

export interface Alerta {
  id: string
  clave: string
  predio_id: string | null
  tipo: TipoAlerta
  titulo: string
  detalle: string | null
  campo: CampoAlerta | null
  valor_sugerido: string | null
  datos: Record<string, unknown>
  origen: string
  estado: EstadoAlerta
  nota: string | null
  resuelta_por: string | null
  resuelta_at: string | null
  created_at: string
}

export interface PredioResumen {
  id: string
  nombre_predio: string | null
  municipio: string | null
  vereda: string | null
  propietario: string | null
}

/** Lo que devuelve la API: la alerta con el predio (y el otro, en un duplicado) ya resueltos. */
export interface AlertaVista extends Alerta {
  predio: PredioResumen | null
  otro_predio: PredioResumen | null
}

/** Las acciones de la pantalla (PATCH /api/juridica/alertas/[id]). */
export type AccionAlerta = 'aplicar' | 'resolver' | 'descartar' | 'reabrir'

/** Secciones de la pantalla, en el orden en que conviene trabajarlas. */
export const TIPOS_ALERTA: { tipo: TipoAlerta; titulo: string; sub: string }[] = [
  { tipo: 'sin_predio', titulo: 'Fincas del SIG sin predio en jurídica',
    sub: 'El SIG las tiene con límite y elegibilidad, pero nadie las ha registrado: sin predio no llegan a la app de campo. «Registrar predio» abre la ficha nueva con lo que trae el SIG.' },
  { tipo: 'duplicado', titulo: 'Posibles duplicados',
    sub: 'Dos fichas que parecen el mismo predio. Si lo son, hay que dejar una sola.' },
  { tipo: 'municipio', titulo: 'Municipio',
    sub: 'Sin municipio, o con uno distinto del que da el SIG. El municipio decide los filtros del tablero SIG y del Reporte.' },
  { tipo: 'vereda', titulo: 'Vereda',
    sub: 'La vereda falta o dice el nombre del municipio.' },
  { tipo: 'nombre', titulo: 'Nombre del predio',
    sub: 'Nombres de relleno («Lote», «Sin información») o fincas que el SIG llama de otra forma. Si el nombre de jurídica es el correcto, descártala con una nota.' },
]

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const comparable = (s: string | null | undefined) =>
  sinTildes(String(s ?? '')).toLowerCase().replace(/[.,;:#°"']/g, ' ').replace(/\s+/g, ' ').trim()

/** Nombres que no dicen cuál es la finca: el predio se registró sin saberlo. */
const NOMBRES_DE_RELLENO = new Set([
  '', 'sin nombre', 'sin informacion', 'sin nombre relacionado', 'sin direccion', 'por definir',
  'predio', 'lote', 'parcela', 'finca',
])
export const esNombreDeRelleno = (nombre: string | null) => NOMBRES_DE_RELLENO.has(comparable(nombre))

export interface PredioRegla { id: string; nombre_predio: string | null; municipio: string | null; vereda: string | null }
export interface AlertaDeRegla {
  clave: string; predio_id: string; tipo: TipoAlerta; campo: CampoAlerta; titulo: string; detalle: string
}

/**
 * Lo que la intranet detecta sola en un predio. Función pura: la API la usa
 * para crear las que falten y para cerrar las que ya no aplican.
 */
export function reglasDePredio(p: PredioRegla): AlertaDeRegla[] {
  const out: AlertaDeRegla[] = []
  const mun = normalizarMunicipio(p.municipio)
  if (!mun) {
    out.push({
      clave: `municipio:${p.id}`, predio_id: p.id, tipo: 'municipio', campo: 'municipio',
      titulo: p.municipio ? `El municipio dice «${p.municipio}»` : 'El predio no tiene municipio',
      detalle: 'Sin municipio, el predio no sale en los filtros del tablero SIG ni del Reporte, y la vereda no se puede elegir de la lista.',
    })
  }
  // La vereda con el nombre de su propio municipio, salvo donde la vereda de
  // verdad se llama así (Albania, en Albania).
  if (mun && p.vereda && normalizarMunicipio(p.vereda) === mun
      && !VEREDAS_POR_MUNICIPIO[mun].includes(normalizarVereda(mun, p.vereda))) {
    out.push({
      clave: `vereda:${p.id}`, predio_id: p.id, tipo: 'vereda', campo: 'vereda',
      titulo: `La vereda dice «${p.vereda}», que es el municipio`,
      detalle: 'Falta la vereda real. Si no se sabe, déjala vacía: el nombre del municipio en la vereda parte los filtros.',
    })
  }
  if (esNombreDeRelleno(p.nombre_predio)) {
    out.push({
      clave: `nombre:${p.id}`, predio_id: p.id, tipo: 'nombre', campo: 'nombre_predio',
      titulo: p.nombre_predio?.trim() ? `El predio se llama «${p.nombre_predio.trim()}»` : 'El predio no tiene nombre',
      detalle: 'Así no se distingue en las listas ni en la app de campo. Pregunta el nombre de la finca al propietario o al SIG.',
    })
  }
  return out
}

/** El valor que se escribe en core.predios al aplicar: nombre limpio, municipio y vereda canónicos. */
export function valorAplicable(campo: CampoAlerta, valor: string, municipioDelPredio: string | null): string {
  if (campo === 'municipio') return normalizarMunicipio(valor)
  if (campo === 'vereda') return normalizarVereda(municipioDelPredio, valor)
  return valor.replace(/\s+/g, ' ').trim()
}

function yaTieneElValor(campo: CampoAlerta, p: PredioRegla, valor: string): boolean {
  const actual = p[campo]
  if (!actual) return false
  if (campo === 'municipio') return normalizarMunicipio(actual) !== '' && normalizarMunicipio(actual) === normalizarMunicipio(valor)
  if (campo === 'vereda') return normalizarVereda(p.municipio, actual) === normalizarVereda(p.municipio, valor)
  return comparable(actual) === comparable(valor)
}

/**
 * ¿Una alerta abierta ya no aplica? Si el predio ya tiene el valor sugerido, o
 * si es de regla y la regla ya no la encuentra (alguien corrigió la ficha), o
 * si es de regla y el predio salió de los activos. Las cargadas sin sugerencia
 * (duplicados, fincas sin predio) las cierra una persona.
 */
export function yaNoAplica(a: Alerta, p: PredioRegla | undefined, activo: boolean): boolean {
  if (a.estado !== 'abierta' || !a.predio_id || !p) return false
  if (a.campo && a.valor_sugerido && yaTieneElValor(a.campo, p, a.valor_sugerido)) return true
  if (a.origen === 'regla') return !activo || !reglasDePredio(p).some((r) => r.clave === a.clave)
  return false
}
