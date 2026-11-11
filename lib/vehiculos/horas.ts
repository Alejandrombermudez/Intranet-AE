// Colombia no cambia de hora: UTC-5 todo el año. Todo se guarda como instante (timestamptz)
// y se muestra/entra en hora de Bogotá, sin importar la zona del dispositivo.

const DESFASE_MS = 5 * 3600 * 1000

/** «2026-11-03» + «08:30» → instante. */
export function aInstante(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00-05:00`)
}

/** Fecha (YYYY-MM-DD) de un instante, en Bogotá. */
export function fechaBogota(d: Date | string): string {
  const t = typeof d === 'string' ? new Date(d) : d
  return new Date(t.getTime() - DESFASE_MS).toISOString().slice(0, 10)
}

/** Hora (HH:MM) de un instante, en Bogotá. */
export function horaBogota(d: Date | string): string {
  const t = typeof d === 'string' ? new Date(d) : d
  return new Date(t.getTime() - DESFASE_MS).toISOString().slice(11, 16)
}

/** Minutos desde la medianoche de Bogotá. */
export function minutosDelDia(d: Date | string): number {
  const [h, m] = horaBogota(d).split(':').map(Number)
  return h * 60 + m
}

/** 0 = domingo … 6 = sábado, del día de Bogotá. */
export function diaSemanaBogota(d: Date | string): number {
  const t = typeof d === 'string' ? new Date(d) : d
  return new Date(t.getTime() - DESFASE_MS).getUTCDay()
}

export function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Lunes de la semana de una fecha. */
export function lunesDe(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  const dow = d.getUTCDay() // 0 = domingo
  return sumarDias(fecha, dow === 0 ? -6 : 1 - dow)
}

export function hoyBogota(): string {
  return fechaBogota(new Date())
}

/** Todas las fechas (Bogotá) que toca el rango [inicio, fin). */
export function diasDelRango(inicio: Date, fin: Date): string[] {
  const dias: string[] = []
  let f = fechaBogota(inicio)
  const ultimo = fechaBogota(new Date(fin.getTime() - 1))
  while (f <= ultimo) {
    dias.push(f)
    f = sumarDias(f, 1)
  }
  return dias
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function nombreDia(fecha: string): string {
  return DIAS[new Date(`${fecha}T12:00:00Z`).getUTCDay()]
}

export function fechaLarga(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  return `${nombreDia(fecha)} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

export function fechaCorta(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`
}

export function mesYAnio(fecha: string): string {
  const d = new Date(`${fecha}T12:00:00Z`)
  return `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** «3:30 p. m.» */
export function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const suf = h >= 12 ? 'p. m.' : 'a. m.'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suf}`
}
