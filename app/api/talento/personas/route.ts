import { NextRequest, NextResponse } from 'next/server'
import { errorTalento, faltaMigracionTalento, sesionTalento, AVISO_MIGRACION_TALENTO } from '@/lib/talento-api'
import { esCorreoInterno } from '@/lib/talento'

/**
 * Personas (solo talento humano).
 *   GET  → todas, con su contrato vigente más reciente (people.v_personas)
 *   POST { email, nombres?, apellidos? } → pre-registrar a alguien que todavía
 *        no ha entrado a la intranet (por ejemplo, para cargarle el contrato antes
 *        de su primer día). Cuando entre con ese correo, encuentra su ficha.
 */
export async function GET(req: NextRequest) {
  const r = await sesionTalento(req, { soloRRHH: true })
  if (!r.ok) return r.respuesta
  const db = r.s.supabase.schema('people')
  const [{ data, error }, perfiles] = await Promise.all([
    db.from('v_personas').select('*').order('apellidos', { nullsFirst: false }),
    db.from('user_profiles').select('email, department'),
  ])
  if (error) {
    if (faltaMigracionTalento(error)) return NextResponse.json({ personas: [], faltaMigracion: true, aviso: AVISO_MIGRACION_TALENTO })
    return errorTalento(error)
  }
  // El área (departamento de la intranet) de cada persona, por su correo.
  const area = new Map((perfiles.data ?? []).map((p) => [String(p.email).toLowerCase(), p.department as string | null]))
  return NextResponse.json({ personas: (data ?? []).map((p) => ({ ...p, departamento: area.get(p.email) ?? null })) })
}

export async function POST(req: NextRequest) {
  const r = await sesionTalento(req, { soloRRHH: true })
  if (!r.ok) return r.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const email = typeof b?.email === 'string' ? b.email.trim().toLowerCase() : ''
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Escribe un correo válido.' }, { status: 400 })
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const { data, error } = await r.s.supabase.schema('people').from('personas')
    .insert({ email, nombres: texto(b?.nombres), apellidos: texto(b?.apellidos), created_by: r.s.email })
    .select('id, email').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Ya existe una ficha con ${email}.` }, { status: 409 })
    return errorTalento(error)
  }
  return NextResponse.json({
    persona: data,
    aviso: esCorreoInterno(email) ? null : 'Ese correo no es @amazoniaemprende.com: la persona no podrá entrar a «Mi perfil»; talento humano llena su ficha.',
  }, { status: 201 })
}
