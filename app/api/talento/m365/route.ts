import { NextRequest, NextResponse } from 'next/server'
import { asegurarFicha, errorTalento, sesionTalento } from '@/lib/talento-api'
import type { M365, Persona } from '@/lib/talento'

/**
 * POST /api/talento/m365   { provider_token }
 *
 * Trae de Microsoft 365 (Graph /me) el cargo, el área, los teléfonos, la
 * oficina y la foto de quien acaba de iniciar sesión, y los pone en su ficha.
 * Lo llama la pantalla de vuelta de Microsoft (/auth/callback) cuando la
 * sesión trae el token de Microsoft. Nunca bloquea la entrada: si Microsoft no
 * da permiso (falta User.Read), responde ok:false y la ficha queda con lo que
 * trajo el inicio de sesión (nombres, apellidos, correo).
 *
 * El token de Microsoft se usa una vez aquí y no se guarda. La persona que
 * devuelve Graph tiene que ser la misma de la sesión.
 */
const CAMPOS = 'displayName,givenName,surname,jobTitle,department,mail,userPrincipalName,mobilePhone,businessPhones,officeLocation,city,employeeId'

export async function POST(req: NextRequest) {
  const r = await sesionTalento(req)
  if (!r.ok) return r.respuesta
  const b = (await req.json().catch(() => null)) as { provider_token?: string } | null
  const token = typeof b?.provider_token === 'string' ? b.provider_token : ''
  if (!token) return NextResponse.json({ ok: false, motivo: 'sin_token' })

  const g = await fetch(`https://graph.microsoft.com/v1.0/me?$select=${CAMPOS}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
  if (!g?.ok) return NextResponse.json({ ok: false, motivo: g ? `graph_${g.status}` : 'graph_red' })
  const yo = await g.json() as Record<string, unknown>
  const correo = String(yo.mail || yo.userPrincipalName || '').toLowerCase()
  if (correo !== r.s.email) return NextResponse.json({ ok: false, motivo: 'otra_cuenta' }, { status: 403 })

  // Foto pequeña (96 px): lo justo para la ficha y el tablero.
  let foto: string | null = null
  const f = await fetch('https://graph.microsoft.com/v1.0/me/photos/96x96/$value', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
  if (f?.ok) {
    const buf = Buffer.from(await f.arrayBuffer())
    const b64 = `data:${f.headers.get('content-type') || 'image/jpeg'};base64,${buf.toString('base64')}`
    if (b64.length <= 250000) foto = b64
  }

  const { persona, error } = await asegurarFicha(r.s)
  if (error || !persona) return errorTalento(error ?? { message: 'No se pudo abrir la ficha.' })

  const m365: M365 = {
    nombre: (yo.displayName as string) ?? null,
    cargo: (yo.jobTitle as string) ?? null,
    departamento: (yo.department as string) ?? null,
    celular: (yo.mobilePhone as string) ?? null,
    telefonos: (yo.businessPhones as string[]) ?? null,
    oficina: (yo.officeLocation as string) ?? null,
    ciudad: (yo.city as string) ?? null,
    id_empleado: (yo.employeeId as string) ?? null,
  }
  // Lo que la persona ya escribió en su ficha manda: de Microsoft solo se llena lo vacío.
  const cambios: Partial<Persona> & Record<string, unknown> = { m365, m365_sincronizado_at: new Date().toISOString() }
  if (persona.m365?.foto_propia) m365.foto_propia = true    // la que subió la persona no se toca
  else if (foto) cambios.foto = foto
  if (!persona.nombres && yo.givenName) cambios.nombres = yo.givenName as string
  if (!persona.apellidos && yo.surname) cambios.apellidos = yo.surname as string
  if (!persona.celular && yo.mobilePhone) cambios.celular = yo.mobilePhone as string
  if (!persona.municipio && yo.city) cambios.municipio = yo.city as string

  const { error: e2 } = await r.s.supabase.schema('people').from('personas').update(cambios).eq('id', persona.id)
  if (e2) return errorTalento(e2)
  return NextResponse.json({ ok: true, foto: !!foto, cargo: m365.cargo })
}
