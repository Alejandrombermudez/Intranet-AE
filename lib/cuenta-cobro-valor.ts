/**
 * ¿El valor de una cuenta de cobro cuadra con lo que debería cobrar?
 *
 * Talento humano pidió que se avise cuando alguien pueda estar digitando menos
 * dinero (un cero de menos, un mes cobrado como quincena) para que la cuenta
 * quede bien hecha antes de pagarla. La referencia es, en este orden:
 *   1. los honorarios mensuales del contrato, proporcionales al periodo
 *      cobrado (mes comercial de 30 días, como se liquidan los contratos);
 *   2. si no hay contrato, la última cuenta de la misma persona.
 * Lo usan el formulario (para avisar antes de enviar) y la bandeja.
 * Sin dependencias: corre en el navegador y en el servidor.
 */

const PESOS = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const pesos = (n: number) => PESOS.format(Math.round(n))

/** Días comerciales (30 por mes, el 31 no cuenta y fin de febrero vale 30) entre dos fechas, ambas incluidas. */
export function diasComerciales(desde: string, hasta: string): number {
  const f = (iso: string) => {
    const [a, m, d] = iso.split('-').map(Number)
    const ultimo = new Date(a, m, 0).getDate()
    return { a, m, d: d === ultimo ? 30 : Math.min(d, 30) }
  }
  const x = f(desde), y = f(hasta)
  const inicio = x.d === 30 ? 30 : x.d
  return (y.a - x.a) * 360 + (y.m - x.m) * 30 + (y.d - inicio) + 1
}

/** Lo que corresponde cobrar por un periodo con unos honorarios mensuales. */
export function valorDelPeriodo(mensual: number, desde: string | null, hasta: string | null): number {
  if (!desde || !hasta || hasta < desde) return mensual
  return Math.round((mensual * diasComerciales(desde, hasta)) / 30)
}

export interface Referencia {
  /** Honorarios mensuales del contrato. */
  mensual?: number | null
  /** Valor de la cuenta anterior de la misma persona. */
  anterior?: number | null
}

/** Tolerancia: diferencias menores al 1 % (redondeos) no se avisan. */
const TOLERANCIA = 0.01

/**
 * El aviso sobre el valor, o null si cuadra o no hay contra qué comparar.
 * `tipo` dice si cobra de menos (lo que más importa) o de más.
 */
export function avisoValor(valor: number, periodo: { desde: string | null; hasta: string | null }, ref: Referencia):
  { tipo: 'menos' | 'mas'; texto: string; esperado: number } | null {
  if (!(valor > 0)) return null
  let esperado: number, contra: string
  if (ref.mensual && ref.mensual > 0) {
    esperado = valorDelPeriodo(Number(ref.mensual), periodo.desde, periodo.hasta)
    const dias = periodo.desde && periodo.hasta ? diasComerciales(periodo.desde, periodo.hasta) : 30
    contra = dias === 30 ? `los honorarios del contrato (${pesos(esperado)} al mes)` : `lo que da el contrato por ${dias} días (${pesos(esperado)})`
  } else if (ref.anterior && ref.anterior > 0) {
    esperado = Number(ref.anterior)
    contra = `la cuenta anterior (${pesos(esperado)})`
  } else return null
  const dif = valor - esperado
  if (Math.abs(dif) <= esperado * TOLERANCIA) return null
  return dif < 0
    ? { tipo: 'menos', esperado, texto: `Cobra ${pesos(-dif)} menos que ${contra}.` }
    : { tipo: 'mas', esperado, texto: `Cobra ${pesos(dif)} más que ${contra}.` }
}

/** «1850000» → «1.850.000» mientras se escribe; devuelve también el número. */
export function leerValor(texto: string): { texto: string; numero: number } {
  const d = texto.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12)
  const numero = d ? Number(d) : 0
  return { texto: d ? numero.toLocaleString('es-CO') : '', numero }
}
