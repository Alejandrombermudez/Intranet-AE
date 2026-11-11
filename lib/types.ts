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

export const AUTH_TIMEOUT_MS = 10_000

// ─── Ejecutivo — Sesiones e Indicaciones ─────────────────────────────────────

// Bloque ejecutivo: pendiente | hecho | cancelado
// Bloque colaborador: pendiente | marcado | confirmado | rechazado | cancelado
export type EstadoIndicacion = 'pendiente' | 'hecho' | 'marcado' | 'confirmado' | 'cancelado' | 'rechazado'

export interface Indicacion {
  id: string
  sesion_id: string
  bloque: 'ejecutivo' | 'colaborador'
  descripcion: string
  plataforma: string | null
  estado: EstadoIndicacion
  nota: string | null
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
