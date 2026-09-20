/**
 * Quién puede abrir cada módulo, del lado del navegador.
 *
 * El control que MANDA está en el servidor (`lib/auth-api.ts`, `PUEDE.*`): esto
 * es solo para no pintarle a alguien una pantalla que el API le va a negar.
 * Nunca al revés — una comprobación de cliente no autoriza nada.
 */

/**
 * Módulo de Siembra (`/intranet/siembra`): la encuesta predial y la evaluación
 * de campo sobre `siembra.*`.
 *
 * Vivía en `/intranet/ras/siembra` y solo lo abría el departamento `RAS`, que
 * es el de Conservación. Resultado: existía un departamento `Siembra` al que la
 * intranet le mostraba "módulo en construcción" aunque el módulo estaba hecho,
 * y al que además no se llegaba por ningún enlace — solo escribiendo la URL.
 *
 * `RAS` se conserva a propósito: hoy son quienes lo usan y quitarles el acceso
 * de un día para otro sería romperles el trabajo. Cuando el equipo de Siembra
 * tenga su gente asignada, se puede dejar solo `Siembra`.
 */
export const PUEDE_SIEMBRA: readonly string[] = ['Siembra', 'RAS']

/** Módulo de Conservación (`/intranet/ras/*`, schema `ras.*`). */
export const PUEDE_CONSERVACION: readonly string[] = ['RAS']
