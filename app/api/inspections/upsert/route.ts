import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const BUCKET = 'inspection-photos'
const MAX_PER_TYPE = 2   // máximo de formularios completos por vehículo y tipo

interface UpsertBody {
  inspection_id?: string      // Si ya existe, para UPDATE
  reservation_id: string
  inspection_type: 'recepcion' | 'devolucion'
  step_completed: number
  // Categorías (opcionales, se van completando por paso)
  cat1_status?: string; cat1_issues?: string[]; cat1_other?: string
  cat2_status?: string; cat2_issues?: string[]; cat2_other?: string
  cat3_status?: string; cat3_issues?: string[]; cat3_other?: string
  cat4_status?: string; cat4_issues?: string[]; cat4_other?: string
  cat5_status?: string; cat5_issues?: string[]; cat5_other?: string
  cat6_status?: string; cat6_issues?: string[]; cat6_other?: string
  // Fotos (URLs de storage)
  photo_frontal?: string
  photo_posterior?: string
  photo_lateral_izq?: string
  photo_lateral_der?: string
  photo_tablero?: string
  // Cierre final
  submitted_at?: string
}

// Extrae el path dentro del bucket a partir de una URL pública de Supabase Storage
function extractStoragePath(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/${BUCKET}/`
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as UpsertBody

    if (!body.reservation_id || !body.inspection_type) {
      return NextResponse.json(
        { error: 'reservation_id e inspection_type son requeridos' },
        { status: 400 }
      )
    }

    const supabase = createServerSupabaseClient()

    // Construir payload limpio (sin campos undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {
      reservation_id: body.reservation_id,
      inspection_type: body.inspection_type,
      step_completed: body.step_completed ?? 0,
    }

    const fields = [
      'cat1_status', 'cat1_issues', 'cat1_other',
      'cat2_status', 'cat2_issues', 'cat2_other',
      'cat3_status', 'cat3_issues', 'cat3_other',
      'cat4_status', 'cat4_issues', 'cat4_other',
      'cat5_status', 'cat5_issues', 'cat5_other',
      'cat6_status', 'cat6_issues', 'cat6_other',
      'photo_frontal', 'photo_posterior', 'photo_lateral_izq',
      'photo_lateral_der', 'photo_tablero',
      'submitted_at',
    ] as const

    for (const f of fields) {
      if (body[f] !== undefined) payload[f] = body[f]
    }

    // Upsert: INSERT si no existe, UPDATE si ya existe (por reservation_id + inspection_type)
    const { data, error } = await supabase
      .from('vehicle_inspections')
      .upsert(payload, { onConflict: 'reservation_id,inspection_type' })
      .select('id')
      .single()

    if (error) {
      console.error('[inspections/upsert]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ── Limpieza FIFO de evidencia fotográfica ──────────────────────────────
    // Solo al cerrar el formulario (submitted_at presente en este request)
    if (body.submitted_at) {
      try {
        // 1. Obtener el vehicle_id de la reserva
        const { data: reservation } = await supabase
          .from('vehicle_reservations')
          .select('vehicle_id')
          .eq('id', body.reservation_id)
          .single()

        if (reservation?.vehicle_id) {
          const vehicleId = reservation.vehicle_id

          // 2. Todos los formularios completos de este vehículo y tipo,
          //    ordenados del más antiguo al más reciente
          const { data: completed } = await supabase
            .from('vehicle_inspections')
            .select(`
              id,
              submitted_at,
              photo_frontal, photo_posterior,
              photo_lateral_izq, photo_lateral_der, photo_tablero,
              vehicle_reservations!inner ( vehicle_id )
            `)
            .eq('vehicle_reservations.vehicle_id', vehicleId)
            .eq('inspection_type', body.inspection_type)
            .not('submitted_at', 'is', null)
            .order('submitted_at', { ascending: true })

          // 3. Si hay más de MAX_PER_TYPE, eliminar los excedentes más antiguos
          if (completed && completed.length > MAX_PER_TYPE) {
            const toDelete = completed.slice(0, completed.length - MAX_PER_TYPE)

            for (const old of toDelete) {
              // Eliminar fotos del bucket
              const photoPaths = [
                old.photo_frontal,
                old.photo_posterior,
                old.photo_lateral_izq,
                old.photo_lateral_der,
                old.photo_tablero,
              ]
                .map(extractStoragePath)
                .filter((p): p is string => p !== null)

              if (photoPaths.length > 0) {
                const { error: storageErr } = await supabase.storage
                  .from(BUCKET)
                  .remove(photoPaths)
                if (storageErr) {
                  console.error('[inspections/upsert] storage cleanup error:', storageErr.message)
                }
              }

              // Eliminar registro de BD
              await supabase
                .from('vehicle_inspections')
                .delete()
                .eq('id', old.id)
            }
          }
        }
      } catch (cleanupErr) {
        // La limpieza no debe bloquear la respuesta al cliente
        console.error('[inspections/upsert] cleanup error:', cleanupErr)
      }
    }
    // ───────────────────────────────────────────────────────────────────────

    return NextResponse.json({ id: data.id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
