/**
 * Preregistro: una ficha que entró por una carga (un shapefile del SIG, un Excel)
 * antes de que alguien levantara sus datos. Existe para que el predio aparezca en
 * la intranet y en el geoportal, pero le falta lo que permite trabajar con él.
 *
 * No hay una columna «preregistro»: se deduce de lo que falta. Así el aviso se
 * apaga solo cuando alguien completa la ficha, y nadie tiene que acordarse de
 * desmarcarla.
 */

/** Documento del propietario marcador «Por completar» de core.aliados. */
export const DOCUMENTO_SIN_PROPIETARIO = 'S/D-SINPROP'

const vacio = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '')

/** Conservación (ras.familias): lo que una ficha completa siempre tiene. */
export interface FamiliaParaPreregistro {
  numero_documento?: string | null
  telefono?: string | null
  nombre_finca?: string | null
  vereda?: string | null
  acuerdo_conservacion?: boolean | null
}

export function faltantesFamilia(f: FamiliaParaPreregistro): string[] {
  const faltan: string[] = []
  if (vacio(f.numero_documento)) faltan.push('documento')
  if (vacio(f.telefono)) faltan.push('teléfono')
  if (vacio(f.nombre_finca)) faltan.push('nombre de la finca')
  if (vacio(f.vereda)) faltan.push('vereda')
  if (!f.acuerdo_conservacion) faltan.push('acuerdo de conservación')
  return faltan
}

/** Una familia es preregistro cuando no se sabe ni quién es ni cómo llamarla. */
export function esPreregistroFamilia(f: FamiliaParaPreregistro): boolean {
  return vacio(f.numero_documento) && vacio(f.telefono)
}

/** Restauración (core.predios vía jurídica): el predio sin propietario conocido. */
export interface PredioParaPreregistro {
  numero_documento: string
  nombre_predio?: string | null
  matricula_inmobiliaria?: string | null
}

export function esPreregistroPredio(p: PredioParaPreregistro): boolean {
  return p.numero_documento === DOCUMENTO_SIN_PROPIETARIO
}

export function faltantesPredio(p: PredioParaPreregistro): string[] {
  const faltan: string[] = []
  if (esPreregistroPredio(p)) faltan.push('propietario', 'documento')
  if (vacio(p.matricula_inmobiliaria)) faltan.push('matrícula')
  if (vacio(p.nombre_predio)) faltan.push('nombre del predio')
  return faltan
}
