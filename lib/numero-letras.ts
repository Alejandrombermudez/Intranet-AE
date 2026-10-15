/**
 * Números en letras, como se escriben en una cuenta de cobro o un certificado
 * en Colombia: «TRES MILLONES QUINIENTOS MIL PESOS M/CTE».
 *
 * Reglas que suelen salir mal y aquí se cuidan:
 *   · «UN MILLÓN», «VEINTIÚN MIL», «CIENTO UN MIL» (apócope delante de mil y millón)
 *   · «UN MILLÓN DE PESOS» y «DOS MILLONES DE PESOS» (con «de» solo cuando el
 *     número termina en millones exactos)
 *   · «CIEN» solo, «CIENTO» seguido
 * Los centavos se redondean: en pesos colombianos no se usan.
 */

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS',
  'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS',
  'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

/** 0–999. `apocope` = va delante de MIL o MILLÓN: «UN», «VEINTIÚN», «TREINTA Y UN». */
function hasta999(n: number, apocope: boolean): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'
  const c = Math.floor(n / 100), r = n % 100
  let resto = ''
  if (r < 30) {
    resto = UNIDADES[r]
    if (apocope && r === 1) resto = 'UN'
    if (apocope && r === 21) resto = 'VEINTIÚN'
  } else {
    const d = Math.floor(r / 10), u = r % 10
    resto = DECENAS[d] + (u ? ' Y ' + (apocope && u === 1 ? 'UN' : UNIDADES[u]) : '')
  }
  return [CENTENAS[c], resto].filter(Boolean).join(' ')
}

/** 0–999.999 */
function hasta999999(n: number, apocope: boolean): string {
  const miles = Math.floor(n / 1000), resto = n % 1000
  const partes: string[] = []
  if (miles === 1) partes.push('MIL')
  else if (miles > 1) partes.push(hasta999(miles, true) + ' MIL')
  if (resto) partes.push(hasta999(resto, apocope))
  return partes.join(' ')
}

/** Un entero en letras (mayúsculas). 0 → «CERO». Hasta 999.999.999.999. */
export function enteroEnLetras(n: number, apocope = false): string {
  n = Math.round(Math.abs(n))
  if (n === 0) return 'CERO'
  const millones = Math.floor(n / 1_000_000), resto = n % 1_000_000
  const partes: string[] = []
  if (millones === 1) partes.push('UN MILLÓN')
  else if (millones > 1) partes.push(hasta999999(millones, true) + ' MILLONES')
  if (resto) partes.push(hasta999999(resto, apocope))
  return partes.join(' ')
}

/** «TRES MILLONES QUINIENTOS MIL PESOS M/CTE» */
export function pesosEnLetras(valor: number): string {
  const n = Math.round(Math.abs(valor))
  const letras = enteroEnLetras(n, true)
  const exactoEnMillones = n >= 1_000_000 && n % 1_000_000 === 0
  return `${letras}${exactoEnMillones ? ' DE' : ''} ${n === 1 ? 'PESO' : 'PESOS'} M/CTE`
}

/** «catorce (14) días del mes de octubre de 2026» — para el pie de un certificado. */
export function fechaEnLetras(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + 'T12:00' : iso)
  const dia = d.getDate()
  const mes = d.toLocaleDateString('es-CO', { month: 'long' })
  const diaTxt = dia === 1 ? 'primer (1.er) día' : `${enteroEnLetras(dia).toLowerCase()} (${dia}) días`
  return `${diaTxt} del mes de ${mes} de ${d.getFullYear()}`
}
