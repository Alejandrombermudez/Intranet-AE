/**
 * Tipo de proyecto que campo le da a cada sitio de siembra (app de campo,
 * 2026-10-21): queda en geo.zona_revision.proyecto y en
 * geo.zonas.propiedades->>'proyecto' (migration_sitios_proyecto.sql). Las
 * mismas tres opciones que en app_campo/src/lib/proyectos.ts.
 */
export const PROYECTO_CAMPO: Record<string, string> = {
  ley_arbol: 'Ley del Árbol',
  conexion:  'Conexión',
  pastoreo:  'Pastoreo',
}

export const nombreProyectoCampo = (p: string | null | undefined) => (p ? PROYECTO_CAMPO[p] ?? p : '')
