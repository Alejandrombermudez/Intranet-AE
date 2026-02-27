'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { VEHICLES, VEHICLE_MAP } from '@/lib/vehicles'
import type { Reservation } from '@/lib/types'
import { parsePurpose } from '@/lib/types'
import { ClipboardList, ChevronLeft, ChevronRight, Tag } from 'lucide-react'

export default function VehicleCalendar() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())

  // Cargar reservas desde Supabase
  useEffect(() => {
    loadReservations()

    // Suscripcion en tiempo real para actualizaciones
    const channel = supabase
      .channel('reservations_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'vehicle_reservations' },
        () => loadReservations()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const loadReservations = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicle_reservations')
        .select('*')
        .order('start_date', { ascending: true })

      if (error) throw error
      setReservations(data || [])
    } catch {
      // Error silencioso en produccion
    } finally {
      setLoading(false)
    }
  }

  // Generar dias del mes
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []

    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  // Verificar si un vehiculo esta reservado en una fecha
  const getReservationForDay = (vehicleId: string, date: Date | null) => {
    if (!date) return null

    const dateStr = date.toISOString().split('T')[0]

    return reservations.find(res => {
      const start = new Date(res.start_date).toISOString().split('T')[0]
      const end = new Date(res.end_date).toISOString().split('T')[0]

      return res.vehicle_id === vehicleId && dateStr >= start && dateStr <= end
    })
  }

  // Navegar meses
  const goToPreviousMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))
  }

  const goToNextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))
  }

  const goToToday = () => {
    setSelectedMonth(new Date())
  }

  // Formato de fecha sin "de": "febrero 2026" en vez de "febrero de 2026"
  const monthName = selectedMonth.toLocaleDateString('es-ES', { month: 'long' })
    + ' ' + selectedMonth.getFullYear()
  const days = getDaysInMonth(selectedMonth)
  const today = new Date().toISOString().split('T')[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header del Calendario */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 rounded-2xl shadow-2xl p-8 mb-6 border border-stone-700">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">
              Calendario de Vehiculos
            </h2>
            <p className="text-stone-400 text-sm">
              Reserva y gestiona el uso de los vehiculos corporativos
            </p>
          </div>

          {/* Controles de navegacion */}
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousMonth}
              className="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-white rounded-lg font-semibold transition-all shadow-md flex items-center gap-1"
            >
              <ChevronLeft size={18} />
              Anterior
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg font-semibold transition-all shadow-md"
            >
              Hoy
            </button>
            <button
              onClick={goToNextMonth}
              className="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-white rounded-lg font-semibold transition-all shadow-md flex items-center gap-1"
            >
              Siguiente
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Mes actual */}
        <div className="text-center">
          <h3 className="text-4xl font-black text-white capitalize tracking-wide">
            {monthName}
          </h3>
        </div>
      </div>

      {/* Leyenda de vehiculos */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        {VEHICLES.map(vehicle => {
          const IconComponent = vehicle.icon
          return (
            <div
              key={vehicle.id}
              className="flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-lg border-2"
              style={{ borderColor: vehicle.color }}
            >
              <IconComponent size={24} style={{ color: vehicle.color }} />
              <div>
                <p className="font-bold text-stone-900">{vehicle.name}</p>
                <div
                  className="w-16 h-2 rounded-full mt-1"
                  style={{ backgroundColor: vehicle.color }}
                ></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Grid del calendario */}
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-stone-200">
        {/* Dias de la semana */}
        <div className="grid grid-cols-7 bg-stone-800 text-white">
          {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map(day => (
            <div key={day} className="p-4 text-center font-bold text-sm">
              {day}
            </div>
          ))}
        </div>

        {/* Dias del mes con vehiculos */}
        <div className="grid grid-cols-7 gap-px bg-stone-200">
          {days.map((date, index) => {
            const dateStr = date?.toISOString().split('T')[0]
            const isToday = dateStr === today

            return (
              <div
                key={index}
                className={`min-h-[140px] bg-white p-2 ${
                  !date ? 'bg-stone-50' : ''
                } ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}
              >
                {date && (
                  <>
                    {/* Numero del dia */}
                    <div className={`text-right mb-2 ${
                      isToday
                        ? 'text-primary font-black text-lg'
                        : 'text-stone-700 font-semibold'
                    }`}>
                      {date.getDate()}
                    </div>

                    {/* Reservas de vehiculos */}
                    <div className="space-y-1">
                      {VEHICLES.map(vehicle => {
                        const reservation = getReservationForDay(vehicle.id, date)
                        const IconComponent = vehicle.icon

                        return (
                          <div
                            key={vehicle.id}
                            className={`text-xs p-1.5 rounded transition-all cursor-help ${
                              reservation
                                ? 'font-bold text-white shadow-md'
                                : 'bg-stone-100 text-stone-400'
                            }`}
                            style={{
                              backgroundColor: reservation ? vehicle.color : undefined,
                            }}
                            title={reservation
                              ? `${vehicle.name}\nUsuario: ${reservation.user_name}\nActividad: ${parsePurpose(reservation.purpose || '').activity || 'Sin detalle'}`
                              : `${vehicle.name} disponible`
                            }
                          >
                            <div className="flex items-center gap-1">
                              <IconComponent size={14} style={{ color: reservation ? '#fff' : vehicle.color }} />
                              {reservation && (
                                <span className="truncate flex-1">
                                  {reservation.user_name.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lista de reservas proximas */}
      <div className="mt-8 bg-white rounded-2xl shadow-xl p-6 border border-stone-200">
        <h3 className="text-2xl font-black text-stone-900 mb-4 flex items-center gap-2">
          <ClipboardList size={24} className="text-primary" />
          Proximas Reservas
        </h3>

        {reservations.length === 0 ? (
          <p className="text-stone-500 text-center py-8">
            No hay reservas programadas
          </p>
        ) : (
          <div className="space-y-3">
            {reservations
              .filter(res => new Date(res.end_date) >= new Date())
              .slice(0, 5)
              .map(reservation => {
                const vehicle = VEHICLE_MAP[reservation.vehicle_id]
                if (!vehicle) return null

                const IconComponent = vehicle.icon
                const { project, activity } = parsePurpose(reservation.purpose || '')

                const startDate = new Date(reservation.start_date).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short'
                })
                const endDate = new Date(reservation.end_date).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'short'
                })

                return (
                  <div
                    key={reservation.id}
                    className="flex items-center gap-4 p-4 rounded-xl border-2 hover:shadow-lg transition-all"
                    style={{ borderColor: vehicle.color }}
                  >
                    <IconComponent size={28} style={{ color: vehicle.color }} />
                    <div className="flex-1">
                      <p className="font-bold text-stone-900">{vehicle.name}</p>

                      <div className="flex items-center gap-1.5 my-1">
                        <Tag size={13} className="text-stone-500" />
                        <span className="text-xs font-bold text-stone-700">
                          {activity || 'Sin detalle'}
                        </span>
                        {project && (
                          <span className="text-xs bg-primary-100 text-primary-dark px-2 py-0.5 rounded-full font-medium">
                            {project}
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-stone-600">
                        {reservation.user_name} &middot; {startDate} - {endDate}
                      </p>
                    </div>
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: vehicle.color }}
                    ></div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
