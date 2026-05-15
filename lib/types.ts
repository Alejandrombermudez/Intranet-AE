export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: string | null
  department: string | null
  is_admin: boolean
  can_access_intranet: boolean
  last_login: string
  created_at: string
}

export interface Reservation {
  id: string
  vehicle_id: string
  vehicle_name: string
  user_name: string
  user_email: string
  start_date: string
  end_date: string
  purpose: string
  created_at: string
  validation_code?: string
}

// ─── Inspección vehicular ────────────────────────────────────────────────────

export interface VehicleInspection {
  id: string
  reservation_id: string
  inspection_type: 'recepcion' | 'devolucion'
  step_completed: number
  submitted_at: string | null
  cat1_status: string; cat1_issues: string[]; cat1_other: string | null
  cat2_status: string; cat2_issues: string[]; cat2_other: string | null
  cat3_status: string; cat3_issues: string[]; cat3_other: string | null
  cat4_status: string; cat4_issues: string[]; cat4_other: string | null
  cat5_status: string; cat5_issues: string[]; cat5_other: string | null
  cat6_status: string; cat6_issues: string[]; cat6_other: string | null
  photo_frontal: string | null
  photo_posterior: string | null
  photo_lateral_izq: string | null
  photo_lateral_der: string | null
  photo_tablero: string | null
  created_at: string
  updated_at: string
}

export const AUTH_TIMEOUT_MS = 10_000

/**
 * Parses the stored purpose string into project and activity.
 * Format: "[Project] Activity" or just "Activity"
 */
export function parsePurpose(purpose: string): { project: string; activity: string } {
  if (!purpose) return { project: '', activity: '' }
  const match = purpose.match(/^\[(.+?)\]\s*(.*)$/)
  if (match) {
    return { project: match[1], activity: match[2] }
  }
  return { project: '', activity: purpose }
}

/**
 * Combines project and activity into the stored purpose format.
 * If project is provided: "[Project] Activity"
 * If only activity: "Activity"
 */
export function formatPurpose(project: string, activity: string): string {
  const trimmedProject = project.trim()
  const trimmedActivity = activity.trim()
  if (trimmedProject) {
    return `[${trimmedProject}] ${trimmedActivity}`
  }
  return trimmedActivity
}

// ─── Ejecutivo — Sesiones e Indicaciones ─────────────────────────────────────

// Bloque ejecutivo: pendiente | hecho | cancelado
// Bloque colaborador: pendiente | marcado (colaborador hecho) | confirmado (ejecutivo confirma) | cancelado
export type EstadoIndicacion = 'pendiente' | 'hecho' | 'marcado' | 'confirmado' | 'cancelado'

export interface Indicacion {
  id: string
  sesion_id: string
  bloque: 'ejecutivo' | 'colaborador'
  descripcion: string
  plataforma: string | null
  estado: EstadoIndicacion
  orden: number
  created_at: string
  updated_at: string
}

export interface Sesion {
  id: string
  iniciado_por: string
  ejecutivo_id: string
  persona_id: string
  titulo: string
  fecha: string
  notas: string | null
  cerrada: boolean
  created_at: string
  updated_at: string
  indicaciones?: Indicacion[]
}

export interface SesionConPersona extends Sesion {
  persona: { id: string; full_name: string | null; email: string; department: string | null }
  ejecutivo: { id: string; full_name: string | null; email: string }
  indicaciones: Indicacion[]
}

export interface IntranetUser {
  id: string
  email: string
  full_name: string | null
  department: string | null
  role: string | null
}
