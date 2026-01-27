'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Tipos de datos
interface Reservation {
  id: string
  vehicle_id: string
  vehicle_name: string
  user_name: string
  user_email: string
  start_date: string
  end_date: string
  created_at: string
}

interface Vehicle {
  id: string
  name: string
  type: 'camioneta1' | 'camioneta2' | 'moto'
  color: string
  icon: string
}

// Configuración de vehículos
const VEHICLES: Vehicle[] = [
  { id: 'camioneta1', name: 'Chevrolet - Samurai', type: 'camioneta1', color: '#3b82f6', icon: '🚙' },
  { id: 'camioneta2', name: 'Camioneta Fotón', type: 'camioneta2', color: '#10b981', icon: '🚐' },
  { id: 'moto', name: 'Susuki DR 150', type: 'moto', color: '#f59e0b', icon: '🏍️' }
]

export default function VehicleCalendar() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date())

  // Cargar reservas desde Supabase
  useEffect(() => {
    loadReservations()
    
    // Suscripción en tiempo real para actualizaciones
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
    } catch (error) {
      console.error('Error cargando reservas:', error)
    } finally {
      setLoading(false)
    }
  }

  // Generar días del mes
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startDayOfWeek = firstDay.getDay()

    const days: (Date | null)[] = []
    
    // Espacios vacíos al inicio
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null)
    }
    
    // Días del mes
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }

    return days
  }

  // Verificar si un vehículo está reservado en una fecha
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

  const monthName = selectedMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const days = getDaysInMonth(selectedMonth)
  const today = new Date().toISOString().split('T')[0]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header del Calendario */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl p-8 mb-6 border border-slate-700">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">
              Calendario de Vehículos
            </h2>
            <p className="text-slate-400 text-sm">
              Reserva y gestiona el uso de los vehículos corporativos
            </p>
          </div>

          {/* Controles de navegación */}
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousMonth}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all shadow-md"
            >
              ← Anterior
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-all shadow-md"
            >
              Hoy
            </button>
            <button
              onClick={goToNextMonth}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-all shadow-md"
            >
              Siguiente →
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

      {/* Leyenda de vehículos */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        {VEHICLES.map(vehicle => (
          <div 
            key={vehicle.id}
            className="flex items-center gap-3 bg-white px-6 py-3 rounded-full shadow-lg border-2"
            style={{ borderColor: vehicle.color }}
          >
            <span className="text-3xl">{vehicle.icon}</span>
            <div>
              <p className="font-bold text-slate-900">{vehicle.name}</p>
              <div 
                className="w-16 h-2 rounded-full mt-1"
                style={{ backgroundColor: vehicle.color }}
              ></div>
            </div>
          </div>
        ))}
      </div>

      {/* Grid del calendario */}
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Días de la semana */}
        <div className="grid grid-cols-7 bg-slate-800 text-white">
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} className="p-4 text-center font-bold text-sm">
              {day}
            </div>
          ))}
        </div>

        {/* Días del mes con vehículos */}
        <div className="grid grid-cols-7 gap-px bg-slate-200">
          {days.map((date, index) => {
            const dateStr = date?.toISOString().split('T')[0]
            const isToday = dateStr === today
            
            return (
              <div 
                key={index}
                className={`min-h-[140px] bg-white p-2 ${
                  !date ? 'bg-slate-50' : ''
                } ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
              >
                {date && (
                  <>
                    {/* Número del día */}
                    <div className={`text-right mb-2 ${
                      isToday 
                        ? 'text-blue-600 font-black text-lg' 
                        : 'text-slate-700 font-semibold'
                    }`}>
                      {date.getDate()}
                    </div>

                    {/* Reservas de vehículos */}
                    <div className="space-y-1">
                      {VEHICLES.map(vehicle => {
                        const reservation = getReservationForDay(vehicle.id, date)
                        
                        return (
                          <div
                            key={vehicle.id}
                            className={`text-xs p-1.5 rounded transition-all ${
                              reservation 
                                ? 'font-bold text-white shadow-md' 
                                : 'bg-slate-100 text-slate-400'
                            }`}
                            style={{
                              backgroundColor: reservation ? vehicle.color : undefined,
                            }}
                            title={reservation 
                              ? `${vehicle.name} - ${reservation.user_name}` 
                              : `${vehicle.name} disponible`
                            }
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-base">{vehicle.icon}</span>
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

      {/* Lista de reservas próximas */}
      <div className="mt-8 bg-white rounded-2xl shadow-xl p-6 border border-slate-200">
        <h3 className="text-2xl font-black text-slate-900 mb-4">
          📋 Próximas Reservas
        </h3>
        
        {reservations.length === 0 ? (
          <p className="text-slate-500 text-center py-8">
            No hay reservas programadas
          </p>
        ) : (
          <div className="space-y-3">
            {reservations
              .filter(res => new Date(res.end_date) >= new Date())
              .slice(0, 5)
              .map(reservation => {
                const vehicle = VEHICLES.find(v => v.id === reservation.vehicle_id)
                if (!vehicle) return null

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
                    <span className="text-4xl">{vehicle.icon}</span>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{vehicle.name}</p>
                      <p className="text-sm text-slate-600">
                        {reservation.user_name} • {startDate} - {endDate}
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