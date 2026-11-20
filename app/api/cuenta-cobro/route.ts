import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { BUCKET_TALENTO, sello, subirArchivo } from '@/lib/talento-api'

/**
 * EL ENLACE PÚBLICO DE CUENTAS DE COBRO — /cuenta-cobro?c=<clave>
 * ─────────────────────────────────────────────────────────────────
 * Para operarios y contratistas sin correo corporativo: no hay sesión. Lo que
 * protege es la clave del enlace (people.config_talento.clave_enlace), que
 * talento humano comparte y puede cambiar en Administrativa → Configuración.
 *
 *   GET  ?c=       → si la clave sirve: a quién se le cobra. Nada más: ni datos de
 *                    personas ni la lista de proyectos (el proyecto se escribe libre y es
 *                    opcional: si viene vacío, talento humano lo pone en la bandeja).
 *   POST multipart: c, datos (JSON), planilla? → people.radicar_cuenta_enlace.
 *                    La persona se busca o se crea por su cédula; lo guardado
 *                    no se sobrescribe (las diferencias las ve la bandeja).
 */

const AVISO_MIGRACION = 'El enlace todavía no está habilitado: falta correr docs/sql/migration_cuentas_cobro_enlace.sql.'

async function claveValida(supabase: ReturnType<typeof createServerSupabaseClient>, c: string | null) {
  const { data, error } = await supabase.schema('people').from('config_talento')
    .select('razon_social, nit, ciudad, clave_enlace').eq('id', 1).maybeSingle()
  if (error) return { error: /clave_enlace/.test(error.message) ? AVISO_MIGRACION : 'No se pudo abrir el formulario.', status: 503 }
  if (!data?.clave_enlace || !c || c !== data.clave_enlace) {
    return { error: 'Este enlace no es válido o ya cambió. Pida el enlace nuevo a talento humano.', status: 403 }
  }
  return { org: data }
}

// Freno simple por IP (por instancia): un formulario honesto no manda más de unas pocas.
const envios = new Map<string, number[]>()
function demasiados(ip: string): boolean {
  const ahora = Date.now(), ventana = 10 * 60 * 1000
  const lista = (envios.get(ip) ?? []).filter((t) => ahora - t < ventana)
  lista.push(ahora); envios.set(ip, lista)
  return lista.length > 8
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const v = await claveValida(supabase, req.nextUrl.searchParams.get('c'))
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: v.status })
  return NextResponse.json({
    organizacion: { razon_social: v.org.razon_social, nit: v.org.nit, ciudad: v.org.ciudad },
  })
}

const TEXTOS = ['tipo_documento', 'numero_documento', 'lugar_expedicion', 'nombres', 'apellidos', 'celular', 'direccion',
  'municipio', 'correo', 'banco', 'tipo_cuenta', 'numero_cuenta', 'concepto', 'proyecto', 'periodo_desde', 'periodo_hasta'] as const

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip'
  if (demasiados(ip)) return NextResponse.json({ error: 'Demasiados envíos seguidos. Espere unos minutos.' }, { status: 429 })

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  const supabase = createServerSupabaseClient()
  const v = await claveValida(supabase, String(form.get('c') ?? ''))
  if ('error' in v) return NextResponse.json({ error: v.error }, { status: v.status })

  let b: Record<string, unknown>
  try { b = JSON.parse(String(form.get('datos') ?? '')) } catch { return NextResponse.json({ error: 'Datos dañados.' }, { status: 400 }) }
  if (typeof b.sitio_web === 'string' && b.sitio_web) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 }) // trampa para robots

  const p: Record<string, unknown> = {}
  for (const k of TEXTOS) p[k] = typeof b[k] === 'string' ? (b[k] as string).trim().slice(0, k === 'concepto' ? 1500 : 200) : null
  for (const k of ['periodo_desde', 'periodo_hasta'] as const) if (p[k] && !/^\d{4}-\d{2}-\d{2}$/.test(String(p[k]))) p[k] = null
  if (!p.correo || !/^\S+@\S+\.\S+$/.test(String(p.correo))) return NextResponse.json({ error: p.correo ? 'El correo no es válido.' : 'Escriba su correo.' }, { status: 400 })
  const valor = Number(b.valor)
  if (!Number.isFinite(valor) || valor <= 0 || valor > 1e10) return NextResponse.json({ error: 'El valor no es válido.' }, { status: 400 })
  const firma = typeof b.firma === 'string' ? b.firma : ''
  if (!/^data:image\/png;base64,/.test(firma)) return NextResponse.json({ error: 'Falta la firma.' }, { status: 400 })
  if (firma.length > 200000) return NextResponse.json({ error: 'La firma quedó muy pesada. Bórrela y firme de nuevo.' }, { status: 400 })
  if (b.autoriza !== true) return NextResponse.json({ error: 'Debe aceptar el tratamiento de datos.' }, { status: 400 })

  let planilla: string | null = null
  const f = form.get('planilla')
  if (f instanceof File && f.size) {
    const doc = String(p.numero_documento ?? '').replace(/[^0-9A-Za-z]/g, '') || 'sin-doc'
    try { planilla = await subirArchivo(supabase, `enlace/${doc}/${sello()}_planilla`, f) }
    catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }) }
  }

  const { data, error } = await supabase.schema('people').rpc('radicar_cuenta_enlace', {
    p: { ...p, valor, firma, soporte_planilla: planilla, ip },
  })
  if (error) {
    if (planilla) await supabase.storage.from(BUCKET_TALENTO).remove([planilla])
    if (/radicar_cuenta_enlace/.test(error.message) || error.code === 'PGRST202') return NextResponse.json({ error: AVISO_MIGRACION }, { status: 503 })
    return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'No se pudo enviar la cuenta. Intente de nuevo.' }, { status: error.code === 'P0001' ? 400 : 500 })
  }
  const { data: cuenta } = await supabase.schema('people').from('cuentas_cobro')
    .select('id, consecutivo, fecha, periodo_desde, periodo_hasta, concepto, valor, datos, proyecto, municipio, origen')
    .eq('id', (data as { id: string }).id).single()
  // Lo que vuelve es lo mismo que la persona escribió: con eso arma su PDF.
  // Se quitan las diferencias con la ficha (eso es para talento humano).
  if (cuenta?.datos) { delete cuenta.datos.diferencias; delete cuenta.datos.ip }
  return NextResponse.json({ cuenta }, { status: 201 })
}
