import { NextRequest, NextResponse } from 'next/server'
import { sesionTalento } from '@/lib/talento-api'

/**
 * GET /api/talento/saludo
 * Lo mínimo para saludar: el primer nombre y el sexo que la persona puso en su
 * ficha («Bienvenido» o «Bienvenida») para la pantalla de bienvenida, y la foto
 * para la tarjeta de la página de inicio. No crea la ficha. Sin ficha, o si
 * falla, responde vacío y la pantalla usa lo que trae Microsoft.
 */
export async function GET(req: NextRequest) {
  const r = await sesionTalento(req)
  if (!r.ok) return NextResponse.json({})
  const { data } = await r.s.supabase.schema('people').from('personas')
    .select('nombres, sexo, foto').eq('email', r.s.email).maybeSingle()
  return NextResponse.json({
    nombre: data?.nombres ? String(data.nombres).trim().split(/\s+/)[0] : null,
    sexo: data?.sexo ?? null,
    foto: data?.foto ?? null,
  })
}
