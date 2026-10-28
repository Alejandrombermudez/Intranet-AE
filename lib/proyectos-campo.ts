/**
 * Tipo de proyecto que campo le da a cada sitio de siembra (app de campo,
 * 2026-10-21; nombres corregidos por el usuario el 2026-10-27): queda en
 * geo.zona_revision.proyecto y en geo.zonas.propiedades->>'proyecto'
 * (migration_sitios_proyecto.sql). Las mismas tres opciones que en
 * app_campo/src/lib/proyectos.ts.
 */
export const PROYECTO_CAMPO: Record<string, string> = {
  ley_arbol:            'Ley del Árbol',
  mercado_carbono:      'Mercado voluntario de carbono',
  ganaderia_sostenible: 'Ganadería sostenible',
  // Nombres de la primera versión de la app (21 al 27 de octubre); el servidor
  // ya los traduce al anotar, esto es por si alguno quedó escrito así.
  conexion:             'Mercado voluntario de carbono',
  pastoreo:             'Ganadería sostenible',
}

export const nombreProyectoCampo = (p: string | null | undefined) => (p ? PROYECTO_CAMPO[p] ?? p : '')
