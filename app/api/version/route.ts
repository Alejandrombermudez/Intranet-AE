import { NextResponse } from 'next/server'

// Siempre se calcula en el momento: lo usa el botón «Actualizar» para saber si hay una versión más nueva.
export const dynamic = 'force-dynamic'

/**
 * GET /api/version
 * Commit con el que está desplegada la intranet ahora. Público y sin datos sensibles.
 */
export function GET() {
  return NextResponse.json(
    { version: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local' },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
