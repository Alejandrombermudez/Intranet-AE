import type { Conductor } from './sesion'
import { fleet } from './sesion'
import { aInstante, diaSemanaBogota, diasDelRango, fechaBogota } from './horas'
import { FOTON_ID, unirMotivo } from './cliente'

type Resultado = { ok: true; id: string } | { ok: false; status: number; error: string }

/**
 * Crea una reserva con todas las reglas: horario válido y futuro, Foton libre lunes y martes
 * para uso interno, sin cruce con otra reserva y sin que alguien lo tenga tomado sin devolver.
 * La usan el calendario (/api/vehiculos/reservas) y «Recepción» sin reserva (/api/vehiculos/tomar).
 */
export async function crearReserva(
  yo: Conductor,
  datos: { vehicleId: string; ini: Date; fin: Date; actividad: string; proyecto?: string },
): Promise<Resultado> {
  const { ini, fin } = datos
  const actividad = datos.actividad.trim().slice(0, 100)
  if (!actividad) return { ok: false, status: 400, error: 'Cuéntanos para qué lo usas.' }
  if (isNaN(ini.getTime()) || isNaN(fin.getTime())) return { ok: false, status: 400, error: 'Fecha u hora inválida.' }
  if (fin <= ini) return { ok: false, status: 400, error: 'La hora de regreso tiene que ser después de la de salida.' }
  if (fin <= new Date()) return { ok: false, status: 400, error: 'Ese horario ya pasó.' }

  const db = fleet()
  const { data: vehiculo } = await db.from('vehiculos').select('id, nombre').eq('id', datos.vehicleId).eq('activo', true).maybeSingle()
  if (!vehiculo) return { ok: false, status: 400, error: 'Elige un vehículo.' }

  if (vehiculo.id === FOTON_ID && diasDelRango(ini, fin).some((d) => [1, 2].includes(diaSemanaBogota(aInstante(d, '12:00'))))) {
    return { ok: false, status: 409, error: 'La Foton no se reserva los lunes ni los martes (uso interno).' }
  }

  const { data: choques, error: eChoque } = await db
    .from('vehicle_reservations')
    .select('user_name')
    .eq('vehicle_id', vehiculo.id)
    .lt('start_at', fin.toISOString())
    .gt('end_at', ini.toISOString())
    .limit(1)
  if (eChoque) return { ok: false, status: 500, error: eChoque.message }
  if (choques?.length) return { ok: false, status: 409, error: `Ese horario se cruza con una reserva de ${choques[0].user_name}.` }

  const { data, error } = await db
    .from('vehicle_reservations')
    .insert({
      vehicle_id: vehiculo.id,
      vehicle_name: vehiculo.nombre,
      user_name: yo.nombre,
      user_email: yo.email ?? '',
      conductor_id: yo.id,
      start_date: fechaBogota(ini),
      end_date: fechaBogota(new Date(fin.getTime() - 1)),
      start_at: ini.toISOString(),
      end_at: fin.toISOString(),
      purpose: unirMotivo(datos.proyecto ?? '', actividad),
    })
    .select('id')
    .single()
  if (error) return { ok: false, status: 500, error: error.message }
  return { ok: true, id: data.id }
}

/** ¿Alguien más lo tiene tomado y no lo ha devuelto? Devuelve su nombre. */
export async function enManosDeOtro(vehiculoId: string, yoId: string): Promise<string | null> {
  const { data } = await fleet()
    .from('vehicle_reservations')
    .select('user_name, conductor_id')
    .eq('vehicle_id', vehiculoId)
    .not('tomado_at', 'is', null)
    .is('devuelto_at', null)
    .neq('conductor_id', yoId)
    .limit(1)
  return data?.[0]?.user_name ?? null
}
