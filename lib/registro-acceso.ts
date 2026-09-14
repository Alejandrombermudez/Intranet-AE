import { supabase } from '@/lib/supabase'

/**
 * Registra en `people.user_profiles.last_login` que la persona entró.
 *
 * «Último acceso» tiene que decir cuándo abrió la intranet por última vez, no
 * cuándo pasó por la pantalla de Microsoft: la sesión se renueva sola en el
 * navegador y alguien puede trabajar a diario meses sin volver a iniciar sesión.
 *
 * Para no escribir en la base con cada clic se registra como mucho una vez cada
 * 30 minutos por persona y navegador. La marca vive en localStorage, así que
 * varias pestañas abiertas cuentan como una.
 */

const CADA_MS = 30 * 60 * 1000
const clave = (userId: string) => `ae:ultimo-acceso:${userId}`

export async function registrarAcceso({ forzar = false }: { forzar?: boolean } = {}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const k = clave(session.user.id)
  if (!forzar) {
    let previo = 0
    try { previo = Number(localStorage.getItem(k)) || 0 } catch { /* storage bloqueado: registrar igual */ }
    if (Date.now() - previo < CADA_MS) return
  }
  // Se marca ANTES de llamar: si dos pestañas se abren a la vez, registra una.
  try { localStorage.setItem(k, String(Date.now())) } catch { /* sin storage no hay límite, no pasa nada */ }

  const res = await fetch('/api/users/sync-profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => null)

  // Si no quedó registrado, quitar la marca para reintentar en la próxima visita
  // en vez de esperar media hora con la fecha vieja.
  if (!res?.ok) {
    try { localStorage.removeItem(k) } catch { /* nada que limpiar */ }
  }
}
