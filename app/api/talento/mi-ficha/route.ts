import { NextRequest, NextResponse } from 'next/server'
import { asegurarFicha, errorTalento, expedientePersona, faltaMigracionTalento, limpiarFicha, sesionTalento, AVISO_MIGRACION_TALENTO } from '@/lib/talento-api'
import { AUTORIZACION_VERSION, CAMPOS_FICHA, EDITABLES_PERSONA, type Persona } from '@/lib/talento'

/**
 * La ficha de quien entra («Mi perfil»).
 *
 *   GET   → su ficha (se crea la primera vez con lo que trae Microsoft 365),
 *           sus contratos, documentos, cuentas de cobro y certificados
 *   PATCH { ...campos, autoriza_datos, autoriza_sensibles } → guarda su ficha
 *
 * Solo lo propio: el correo sale del token. Las notas de talento humano no
 * salen de aquí.
 */
export async function GET(req: NextRequest) {
  const r = await sesionTalento(req)
  if (!r.ok) return r.respuesta
  const { persona, error } = await asegurarFicha(r.s)
  if (error) {
    if (faltaMigracionTalento(error)) return NextResponse.json({ faltaMigracion: true, aviso: AVISO_MIGRACION_TALENTO })
    return errorTalento(error)
  }
  if (!persona) return NextResponse.json({ error: 'No se pudo crear tu ficha.' }, { status: 500 })
  const exp = await expedientePersona(r.s.supabase, persona.id, { rrhh: false })
  if ('error' in exp && exp.error) return errorTalento(exp.error)
  return NextResponse.json({ ...exp, rrhh: r.s.rrhh })
}

export async function PATCH(req: NextRequest) {
  const r = await sesionTalento(req)
  if (!r.ok) return r.respuesta
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })

  const { persona, error } = await asegurarFicha(r.s)
  if (error || !persona) return errorTalento(error ?? { message: 'No se pudo abrir tu ficha.' })

  const cambios = limpiarFicha(b, EDITABLES_PERSONA as readonly string[])
  if ('error' in cambios) return NextResponse.json({ error: cambios.error }, { status: 400 })

  // Sin autorización de tratamiento de datos no se guarda nada; sin la de datos
  // sensibles no se guardan el tipo de sangre ni la información médica.
  const autoriza = b.autoriza_datos === true || (persona.autoriza_datos && b.autoriza_datos !== false)
  if (!autoriza) return NextResponse.json({ error: 'Para guardar tu ficha tienes que aceptar la autorización de tratamiento de datos.' }, { status: 400 })
  const sensibles = b.autoriza_sensibles === true || (persona.autoriza_sensibles && b.autoriza_sensibles !== false)
  if (!sensibles) {
    for (const c of CAMPOS_FICHA.filter((x) => x.sensible)) cambios.datos[c.clave] = null
  }
  // Una foto subida a mano manda: desde ahí la de Microsoft 365 ya no la reemplaza.
  // Quitarla (foto: null) devuelve el turno a la de Microsoft.
  if ('foto' in cambios.datos) cambios.datos.m365 = { ...(persona.m365 ?? {}), foto_propia: !!cambios.datos.foto }
  const nuevaAutorizacion = autoriza !== persona.autoriza_datos || sensibles !== persona.autoriza_sensibles
  const datos: Record<string, unknown> = {
    ...cambios.datos,
    autoriza_datos: autoriza,
    autoriza_sensibles: sensibles,
    updated_by: r.s.email,
    ...(nuevaAutorizacion || !persona.autoriza_at ? { autoriza_at: new Date().toISOString(), autoriza_version: AUTORIZACION_VERSION } : {}),
  }

  const { data, error: e2 } = await r.s.supabase.schema('people').from('personas')
    .update(datos).eq('id', persona.id).select('*').single()
  if (e2) {
    if (e2.code === '23505') return NextResponse.json({ error: 'Ese número de documento ya está registrado a otra persona. Escríbele a talento humano.' }, { status: 409 })
    return errorTalento(e2)
  }
  const p = { ...data } as Persona
  delete p.notas_rrhh
  return NextResponse.json({ persona: p })
}
