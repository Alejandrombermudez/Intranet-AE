/**
 * Piezas comunes de las rutas /api/talento/* (solo servidor).
 *
 * Dos tipos de quien llama, ambos identificados por el token de la sesión:
 *   · cualquier persona con correo @amazoniaemprende.com → lo suyo (su ficha,
 *     sus contratos, sus cuentas de cobro);
 *   · talento humano (PUEDE.talentoHumano) → todo.
 * Lo que llegue en el cuerpo o en la URL nunca dice quién es la persona.
 */
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PUEDE, type PerfilSesion } from '@/lib/auth-api'
import { CAMPOS_FICHA, esCorreoInterno, type Persona } from '@/lib/talento'

export type SB = ReturnType<typeof createServerSupabaseClient>

export const BUCKET_TALENTO = 'talento-humano'
export const AVISO_MIGRACION_TALENTO = 'Falta correr docs/sql/migration_talento_humano.sql en Supabase.'

export interface SesionTalento {
  supabase: SB
  user: User
  email: string
  perfil: PerfilSesion | null
  /** Ve y edita a todas las personas. */
  rrhh: boolean
}

const rechazo = (status: number, error: string) => ({ ok: false as const, respuesta: NextResponse.json({ error }, { status }) })

/**
 * Exige sesión. `soloRRHH` = solo talento humano. Si no, entra cualquier correo
 * de la organización (para lo suyo) o talento humano.
 */
export async function sesionTalento(req: Request, { soloRRHH = false } = {}):
  Promise<{ ok: true; s: SesionTalento } | { ok: false; respuesta: NextResponse }> {
  const supabase = createServerSupabaseClient()
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || null
  if (!token) return rechazo(401, 'La sesión no llegó al servidor. Recarga la página e intenta de nuevo.')
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user?.email) return rechazo(401, 'Tu sesión venció. Recarga la página; si sigue, cierra sesión y vuelve a entrar.')

  const email = user.email.toLowerCase()
  const { data: p } = await supabase.schema('people').from('user_profiles')
    .select('email, is_admin, department, can_access_intranet').eq('email', user.email).maybeSingle()
  const perfil: PerfilSesion | null = p ? {
    email, is_admin: p.is_admin === true, department: p.department ?? null, can_access_intranet: p.can_access_intranet === true,
  } : null
  const rrhh = !!perfil && PUEDE.talentoHumano(perfil)

  if (soloRRHH && !rrhh) return rechazo(403, 'Esto es solo para talento humano.')
  if (!rrhh && !esCorreoInterno(email)) return rechazo(403, 'Mi perfil es para cuentas @amazoniaemprende.com.')
  return { ok: true, s: { supabase, user, email, perfil, rrhh } }
}

/** La tabla todavía no existe: falta correr la migración. */
export function faltaMigracionTalento(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false
  return ['PGRST205', 'PGRST202', '42P01', '42883'].includes(e.code ?? '')
    || /(personas|contratos|cuentas_cobro|certificados|documentos_persona|config_talento|v_personas|radicar_cuenta_cobro).*(schema cache|does not exist|not find)/i.test(e.message ?? '')
}

export function errorTalento(e: { code?: string; message?: string }, status = 500) {
  if (faltaMigracionTalento(e)) return NextResponse.json({ error: AVISO_MIGRACION_TALENTO, faltaMigracion: true }, { status: 503 })
  return NextResponse.json({ error: e.message ?? 'Error de la base de datos.' },
    { status: e.code === '23505' ? 409 : e.code === 'P0001' ? 400 : status })
}

/**
 * La ficha de quien entra. Si no existe, se crea con lo que trae el inicio de
 * sesión de Microsoft 365: nombres, apellidos y su identificador (oid).
 */
export async function asegurarFicha(s: SesionTalento): Promise<{ persona: Persona | null; error?: { code?: string; message?: string } }> {
  const db = s.supabase.schema('people')
  const { data: ya, error } = await db.from('personas').select('*').eq('email', s.email).maybeSingle()
  if (error) return { persona: null, error }
  if (ya) return { persona: ya as Persona }

  const meta = (s.user.user_metadata ?? {}) as Record<string, unknown>
  const cc = (meta.custom_claims ?? {}) as Record<string, string | undefined>
  const completo = String(meta.full_name ?? meta.name ?? '').trim()
  const partes = completo.split(/\s+/)
  const nombres = cc.given_name || (partes.length > 2 ? partes.slice(0, 2).join(' ') : partes[0]) || null
  const apellidos = cc.family_name || (partes.length > 2 ? partes.slice(2).join(' ') : partes.slice(1).join(' ')) || null

  const { data: nueva, error: e2 } = await db.from('personas')
    .upsert({ email: s.email, nombres, apellidos, m365_oid: cc.oid || null, created_by: s.email },
      { onConflict: 'email', ignoreDuplicates: true })
    .select('*').maybeSingle()
  if (e2) {
    // Otro identificador de Microsoft ya registrado: se crea sin él.
    if (e2.code === '23505') {
      const { data: sinOid, error: e3 } = await db.from('personas')
        .upsert({ email: s.email, nombres, apellidos, created_by: s.email }, { onConflict: 'email', ignoreDuplicates: true })
        .select('*').maybeSingle()
      if (e3) return { persona: null, error: e3 }
      return { persona: (sinOid as Persona) ?? null }
    }
    return { persona: null, error: e2 }
  }
  if (nueva) return { persona: nueva as Persona }
  const { data: otra } = await db.from('personas').select('*').eq('email', s.email).maybeSingle()
  return { persona: (otra as Persona) ?? null }
}

/** Todo lo de una persona: ficha, contratos, documentos, cuentas de cobro y certificados. */
export async function expedientePersona(supabase: SB, personaId: string, { rrhh }: { rrhh: boolean }) {
  const db = supabase.schema('people')
  const [persona, contratos, documentos, cuentas, certificados] = await Promise.all([
    db.from('personas').select('*').eq('id', personaId).maybeSingle(),
    db.from('contratos').select('*').eq('persona_id', personaId).order('fecha_inicio', { ascending: false }),
    db.from('documentos_persona').select('*').eq('persona_id', personaId).order('created_at', { ascending: false }),
    db.from('cuentas_cobro').select('*').eq('persona_id', personaId).order('consecutivo', { ascending: false }),
    db.from('certificados').select('id, persona_id, tipo, incluye_salario, dirigido_a, codigo, datos, generado_por, created_at')
      .eq('persona_id', personaId).order('created_at', { ascending: false }).limit(50),
  ])
  const error = [persona, contratos, documentos, cuentas, certificados].find((r) => r.error)?.error
  if (error) return { error }
  if (!persona.data) return { error: { code: '404', message: 'Persona no encontrada.' } }
  const p = { ...persona.data } as Persona
  if (!rrhh) delete p.notas_rrhh
  return {
    persona: p,
    contratos: contratos.data ?? [],
    documentos: documentos.data ?? [],
    cuentas: cuentas.data ?? [],
    certificados: certificados.data ?? [],
  }
}

/** ¿Este registro es de quien llama (o es talento humano)? */
export async function esDeLaSesion(s: SesionTalento, personaId: string): Promise<boolean> {
  if (s.rrhh) return true
  const { data } = await s.supabase.schema('people').from('personas').select('email').eq('id', personaId).maybeSingle()
  return data?.email === s.email
}

/** Sube un archivo del formulario al bucket privado. Devuelve la ruta. */
export async function subirArchivo(supabase: SB, ruta: string, f: File): Promise<string> {
  if (f.size > 4 * 1024 * 1024) throw new Error(`«${f.name}» pesa más de 4 MB. Comprímelo o escanéalo con menos resolución.`)
  if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(f.type)) throw new Error(`«${f.name}» no es PDF ni imagen.`)
  const ext = f.type === 'application/pdf' ? 'pdf' : f.type.split('/')[1].replace('jpeg', 'jpg')
  const destino = `${ruta}.${ext}`
  const { error } = await supabase.storage.from(BUCKET_TALENTO)
    .upload(destino, Buffer.from(await f.arrayBuffer()), { contentType: f.type, upsert: false })
  if (error) throw new Error(`No se pudo guardar «${f.name}»: ${error.message}`)
  return destino
}

export async function urlFirmada(supabase: SB, ruta: string | null, segundos = 600): Promise<string | null> {
  if (!ruta) return null
  const { data } = await supabase.storage.from(BUCKET_TALENTO).createSignedUrl(ruta, segundos)
  return data?.signedUrl ?? null
}

export const sello = () => new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)

/**
 * Deja solo las columnas permitidas y normaliza: textos recortados (vacío → null),
 * fechas válidas, sí/no como booleano, número de documento sin puntos.
 */
export function limpiarFicha(b: Record<string, unknown>, permitidas: readonly string[]):
  { datos: Record<string, unknown> } | { error: string } {
  const datos: Record<string, unknown> = {}
  const tipos = new Map(CAMPOS_FICHA.map((c) => [c.clave as string, c]))
  for (const k of permitidas) {
    if (!(k in b)) continue
    const v = b[k]
    const campo = tipos.get(k)
    if (campo?.tipo === 'si_no' || k === 'activo') { datos[k] = v === true; continue }
    if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) { datos[k] = null; continue }
    if (typeof v !== 'string') return { error: `Valor no válido en ${campo?.etiqueta ?? k}.` }
    let t = v.trim()
    if (campo?.tipo === 'fecha' && !/^\d{4}-\d{2}-\d{2}$/.test(t)) return { error: `Fecha no válida en ${campo.etiqueta}.` }
    if (campo?.tipo === 'opciones' && campo.opciones && !(t in campo.opciones)) return { error: `Opción no válida en ${campo.etiqueta}.` }
    if (campo?.tipo === 'email' && !/^\S+@\S+\.\S+$/.test(t)) return { error: `Correo no válido en ${campo.etiqueta}.` }
    if (k === 'numero_documento') t = t.replace(/[.\s]/g, '')
    if (k === 'email') { t = t.toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(t)) return { error: 'Correo no válido.' } }
    if (k === 'firma' && !/^data:image\/(png|jpe?g);base64,/.test(t)) return { error: 'La firma debe ser una imagen PNG o JPG.' }
    if (k === 'foto' && !/^data:image\/(png|jpe?g|webp);base64,/.test(t)) return { error: 'La foto debe ser una imagen.' }
    if (k === 'foto' && t.length > 250000) return { error: 'La foto pesa demasiado.' }
    datos[k] = t.slice(0, k === 'firma' ? 200000 : k === 'foto' ? 250000 : 2000)
  }
  return { datos }
}
