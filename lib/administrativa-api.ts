/**
 * Piezas comunes de las rutas /api/administrativa/* (solo servidor).
 *
 * Todas exigen sesión con el departamento Financiero (o admin): `exigirFinanciero`.
 * Mientras no se corra docs/sql/migration_financiero_inventario.sql —o mientras
 * `financiero` e `inventario` no estén en Exposed schemas— las tablas no existen
 * para la API; `faltaMigracion` reconoce ese caso para que la pantalla lo diga
 * en vez de mostrar un error técnico.
 */
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirSesion, PUEDE, type ResultadoSesion } from '@/lib/auth-api'

export type SB = ReturnType<typeof createServerSupabaseClient>

export async function exigirFinanciero(req: Request): Promise<{ supabase: SB; sesion: ResultadoSesion }> {
  const supabase = createServerSupabaseClient()
  const sesion = await exigirSesion(req, supabase, PUEDE.financiero)
  return { supabase, sesion }
}

export const AVISO_MIGRACION =
  'Falta correr docs/sql/migration_financiero_inventario.sql en Supabase y agregar `financiero` e `inventario` en Settings → API → Exposed schemas.'

interface ErrorPg { code?: string; message?: string }

export function faltaMigracion(e: ErrorPg | null | undefined): boolean {
  if (!e) return false
  const m = e.message ?? ''
  return ['PGRST106', 'PGRST205', 'PGRST202', '42P01', '42883', '3F000'].includes(e.code ?? '')
    || /(schema cache|does not exist|Invalid schema|must be one of the following)/i.test(m)
}

/** Respuesta de error: si es por la migración, 503 con el aviso; si no, el mensaje de la base. */
export function errorBase(e: ErrorPg, status = 500) {
  if (faltaMigracion(e)) return NextResponse.json({ error: AVISO_MIGRACION, faltaMigracion: true }, { status: 503 })
  // Las excepciones de las funciones (RAISE) traen un mensaje pensado para la persona.
  const msg = e.message ?? 'Error de la base de datos.'
  return NextResponse.json({ error: msg }, { status: e.code === '23505' ? 409 : e.code === 'P0001' ? 400 : status })
}

export const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
export const numeroValido = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN
  return Number.isFinite(n) ? n : null
}
export const esUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

export const BUCKET_FACTURAS = 'financiero-facturas'
