import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con privilegios de SERVICE_ROLE.
 * SOLO usar en API routes del servidor — NUNCA en componentes 'use client'.
 */
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}
