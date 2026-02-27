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
