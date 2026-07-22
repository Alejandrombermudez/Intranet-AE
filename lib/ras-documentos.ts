/**
 * Cliente de documentos legales por familia (conservación).
 * Habla con /api/ras/conservacion/[id]/documentos (bucket privado + URL firmada).
 * Requiere sesión: pasa el access token como Bearer.
 */
import { supabase } from '@/lib/supabase'

export type TipoDocumentoFamilia = 'cesion_imagen' | 'acuerdo_conservacion' | 'otro'

export interface DocumentoFamilia {
  id: string
  tipo: TipoDocumentoFamilia
  titular_nombre: string | null
  titular_documento: string | null
  fecha: string | null
  nombre_archivo: string | null
  observaciones: string | null
  created_at: string
  /** URL firmada temporal (caduca ~1h); null si no se pudo firmar */
  url: string | null
}

export const TIPO_DOC_LABEL: Record<TipoDocumentoFamilia, string> = {
  cesion_imagen: 'Cesión de derechos de imagen',
  acuerdo_conservacion: 'Acuerdo de conservación',
  otro: 'Otro documento',
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchDocumentosFamilia(familiaId: string): Promise<DocumentoFamilia[]> {
  const res = await fetch(`/api/ras/conservacion/${familiaId}/documentos`, { headers: await authHeader() })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Error al cargar documentos')
  return res.json()
}

export async function subirDocumentoFamilia(
  familiaId: string,
  file: File,
  meta: {
    tipo: TipoDocumentoFamilia
    titular_nombre?: string
    titular_documento?: string
    fecha?: string
    observaciones?: string
  },
): Promise<{ id: string; url: string | null }> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('meta', JSON.stringify(meta))
  const res = await fetch(`/api/ras/conservacion/${familiaId}/documentos`, {
    method: 'POST',
    headers: await authHeader(),
    body: fd,
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Error al subir el documento')
  return res.json()
}

export async function eliminarDocumentoFamilia(familiaId: string, docId: string): Promise<void> {
  const res = await fetch(`/api/ras/conservacion/${familiaId}/documentos/${docId}`, {
    method: 'DELETE',
    headers: await authHeader(),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Error al eliminar el documento')
}
