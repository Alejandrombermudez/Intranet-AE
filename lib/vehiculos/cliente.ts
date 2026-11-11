// Tipos y llamadas que usa la pantalla /vehiculos en el navegador.

export interface Yo {
  id: string
  nombre: string
  esAdmin: boolean
}

export interface Persona {
  id: string
  nombre: string
}

export interface Vehiculo {
  id: string
  nombre: string
  corto: string
  placa: string | null
  tipo: 'carro' | 'camioneta' | 'moto'
  color: string
  foto: string | null      // enlace firmado, vence en 1 hora
  tarjeta: string | null   // enlace firmado, vence en 1 hora
  soat_vence: string | null
  tecnomecanica_vence: string | null
}

export interface Reserva {
  id: string
  vehicle_id: string
  nombre: string
  conductor_id: string | null
  start_at: string
  end_at: string
  motivo: string | null
}

export interface MiReserva {
  id: string
  vehicle_id: string
  start_at: string
  end_at: string
  motivo: string | null
  tomado_at: string | null
  devuelto_at: string | null
  checkInHecho: boolean
  checkOutHecho: boolean
}

export const FOTON_ID = 'camioneta2'

export async function llamar<T = unknown>(url: string, opciones?: RequestInit): Promise<T> {
  const res = await fetch(url, opciones)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Algo salió mal. Intenta de nuevo.')
  return json as T
}

export function enviar<T = unknown>(url: string, metodo: 'POST' | 'PATCH' | 'DELETE', cuerpo?: unknown): Promise<T> {
  return llamar<T>(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
}

export function separarMotivo(motivo: string | null | undefined): { proyecto: string; actividad: string } {
  const m = (motivo ?? '').match(/^\[(.+?)\]\s*(.*)$/)
  return m ? { proyecto: m[1], actividad: m[2] } : { proyecto: '', actividad: motivo ?? '' }
}

export function unirMotivo(proyecto: string, actividad: string): string {
  const p = proyecto.trim()
  return p ? `[${p}] ${actividad.trim()}` : actividad.trim()
}

/** Días que faltan para una fecha (AAAA-MM-DD); negativo si ya pasó. */
export function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null
  const hoy = new Date(new Date().getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10)
  return Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`)) / 86400000)
}
