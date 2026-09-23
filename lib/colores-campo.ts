/**
 * COLORES DE CAMPO
 * ────────────────
 * Los que usa el técnico en la app de campo sobre el mapa satelital, y los
 * mismos que pinta el SIG. La oficina y el terreno tienen que estar viendo
 * literalmente lo mismo.
 *
 * NO pasan por la paleta de marca, a propósito: tienen que leerse sobre una
 * imagen satelital, donde un verde bosque o un pizarra se pierden.
 *
 * Viven aquí, sin Leaflet, para que las leyendas puedan importarlos. Si una
 * leyenda los importara desde MapaCampo arrastraría Leaflet al render en
 * servidor —que no tiene `window`— y tumbaría la página. Y si los copiara,
 * tarde o temprano la leyenda y el mapa dirían colores distintos.
 */

export type TipoCapaCampo = 'finca' | 'antes' | 'confirmada' | 'modificada' | 'nueva' | 'descartada'

export const COLOR_CAMPO: Record<TipoCapaCampo, string> = {
  finca:      '#57534e',
  antes:      '#6b7280',
  confirmada: '#10b981',
  modificada: '#3b82f6',
  nueva:      '#14b8a6',
  descartada: '#ef4444',
}

/** Amarillo de selección: sobre el satelital se lee más que cualquier color de estado. */
export const COLOR_SELECCION = '#facc15'
