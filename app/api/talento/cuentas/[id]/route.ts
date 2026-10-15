import { NextRequest, NextResponse } from 'next/server'
import { errorTalento, esDeLaSesion, sesionTalento, urlFirmada } from '@/lib/talento-api'
import type { CuentaCobro, EstadoCuenta } from '@/lib/talento'

/**
 * Una cuenta de cobro.
 *
 *   GET   → la cuenta y la URL firmada (10 min) de su planilla
 *   PATCH { accion, ... }
 *     La persona (la suya):
 *       anular   — si está radicada o devuelta
 *       corregir — si está devuelta: {concepto, valor, periodo_desde, periodo_hasta};
 *                  vuelve a radicada y toma de nuevo sus datos de la ficha (por si
 *                  la devolvieron por una cuenta bancaria equivocada)
 *     Talento humano:
 *       aprobar  — radicada → aprobada
 *       devolver — radicada/aprobada → devuelta, con observación
 *       pagar    — aprobada → pagada, con fecha
 *       anular   — cualquiera menos pagada, con observación
 */
type Contexto = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Contexto) {
  const r = await sesionTalento(req)
  if (!r.ok) return r.respuesta
  const { id } = await params
  const { data, error } = await r.s.supabase.schema('people').from('cuentas_cobro').select('*').eq('id', id).maybeSingle()
  if (error) return errorTalento(error)
  if (!data || !(await esDeLaSesion(r.s, data.persona_id))) return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 })
  return NextResponse.json({ cuenta: data, url_planilla: await urlFirmada(r.s.supabase, data.soporte_planilla) })
}

const PASOS_RRHH: Record<string, { desde: EstadoCuenta[]; a: EstadoCuenta }> = {
  aprobar: { desde: ['radicada'], a: 'aprobada' },
  devolver: { desde: ['radicada', 'aprobada'], a: 'devuelta' },
  pagar: { desde: ['aprobada'], a: 'pagada' },
  anular: { desde: ['radicada', 'aprobada', 'devuelta'], a: 'anulada' },
}

export async function PATCH(req: NextRequest, { params }: Contexto) {
  const r = await sesionTalento(req)
  if (!r.ok) return r.respuesta
  const { id } = await params
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const accion = String(b?.accion ?? '')
  const db = r.s.supabase.schema('people')

  const { data: c, error } = await db.from('cuentas_cobro').select('*').eq('id', id).maybeSingle()
  if (error) return errorTalento(error)
  if (!c) return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 })
  const cuenta = c as CuentaCobro
  const { data: duena } = await db.from('personas').select('*').eq('id', cuenta.persona_id).single()
  const esDuena = duena?.email === r.s.email
  if (!esDuena && !r.s.rrhh) return NextResponse.json({ error: 'Cuenta no encontrada.' }, { status: 404 })

  const observacion = typeof b?.observacion === 'string' && b.observacion.trim() ? b.observacion.trim().slice(0, 1000) : null
  let cambios: Record<string, unknown>

  if (accion === 'corregir') {
    if (!esDuena) return NextResponse.json({ error: 'Solo quien la radicó la corrige.' }, { status: 403 })
    if (cuenta.estado !== 'devuelta') return NextResponse.json({ error: 'Solo se corrige una cuenta devuelta.' }, { status: 409 })
    const concepto = typeof b?.concepto === 'string' ? b.concepto.trim() : ''
    const valor = Number(b?.valor)
    if (!concepto) return NextResponse.json({ error: 'Escribe el concepto.' }, { status: 400 })
    if (!(valor > 0)) return NextResponse.json({ error: 'El valor debe ser mayor que cero.' }, { status: 400 })
    if (!duena.banco || !duena.numero_cuenta || !duena.numero_documento) {
      return NextResponse.json({ error: 'Completa en tu ficha el documento, el banco y el número de cuenta.' }, { status: 400 })
    }
    const fecha = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
    cambios = {
      concepto, valor, periodo_desde: fecha(b?.periodo_desde), periodo_hasta: fecha(b?.periodo_hasta),
      estado: 'radicada', fecha: new Date().toISOString().slice(0, 10),
      datos: {
        ...cuenta.datos,
        persona: {
          nombres: duena.nombres, apellidos: duena.apellidos, tipo_documento: duena.tipo_documento,
          numero_documento: duena.numero_documento, lugar_expedicion: duena.lugar_expedicion, direccion: duena.direccion,
          municipio: duena.municipio, celular: duena.celular, email: duena.email, banco: duena.banco,
          tipo_cuenta: duena.tipo_cuenta, numero_cuenta: duena.numero_cuenta, responsable_iva: duena.responsable_iva,
          firma: duena.firma,
        },
        radicada: new Date().toISOString(),
      },
    }
  } else if (accion === 'anular' && esDuena && !r.s.rrhh) {
    if (!['radicada', 'devuelta'].includes(cuenta.estado)) return NextResponse.json({ error: 'Ya fue aprobada: pídele a talento humano que la anule.' }, { status: 409 })
    cambios = { estado: 'anulada', observacion: observacion ?? 'Anulada por quien la radicó.' }
  } else if (r.s.rrhh && accion in PASOS_RRHH) {
    const paso = PASOS_RRHH[accion]
    if (!paso.desde.includes(cuenta.estado)) return NextResponse.json({ error: `No se puede ${accion} una cuenta ${cuenta.estado}.` }, { status: 409 })
    if ((accion === 'devolver' || accion === 'anular') && !observacion) return NextResponse.json({ error: 'Escribe el motivo: lo ve la persona.' }, { status: 400 })
    cambios = { estado: paso.a, revisada_por: r.s.email, revisada_at: new Date().toISOString() }
    if (observacion) cambios.observacion = observacion
    if (accion === 'pagar') cambios.pagada_at = typeof b?.pagada_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.pagada_at) ? b.pagada_at : new Date().toISOString().slice(0, 10)
  } else {
    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 })
  }

  // La condición de estado va también en el UPDATE: si dos personas actúan a la vez, gana una.
  const { data, error: e2 } = await db.from('cuentas_cobro').update(cambios).eq('id', id).eq('estado', cuenta.estado).select('*').maybeSingle()
  if (e2) return errorTalento(e2)
  if (!data) return NextResponse.json({ error: 'La cuenta cambió mientras tanto. Recarga la página.' }, { status: 409 })
  return NextResponse.json({ cuenta: data })
}
