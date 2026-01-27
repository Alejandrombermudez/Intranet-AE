'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import VehicleCalendar from '../components/VehicleCalendar'
import ReservationModal from '../components/ReservationModal'

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

const VEHICLE_CONFIG: Record<string, { icon: string; color: string }> = {
  camioneta1: { icon: '🚙', color: '#3b82f6' },
  camioneta2: { icon: '🚐', color: '#10b981' },
  moto: { icon: '🏍️', color: '#f59e0b' }
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [myReservations, setMyReservations] = useState<Reservation[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const router = useRouter()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/') 
      } else {
        setUser(user)
        loadMyReservations(user.email!)
      }
    }
    getUser()
  }, [router, refreshKey])

  const loadMyReservations = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_reservations')
        .select('*')
        .eq('user_email', email)
        .order('start_date', { ascending: true })

      if (error) throw error
      setMyReservations(data || [])
    } catch (error) {
      console.error('Error cargando mis reservas:', error)
    }
  }

  const deleteReservation = async (reservationId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta reserva?')) return

    try {
      const { error } = await supabase
        .from('vehicle_reservations')
        .delete()
        .eq('id', reservationId)

      if (error) throw error
      
      // Actualizar lista
      setRefreshKey(prev => prev + 1)
    } catch (error) {
      console.error('Error eliminando reserva:', error)
      alert('Error al eliminar la reserva')
    }
  }

  if (!user) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="animate-pulse font-semibold text-slate-900">Cargando perfil...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header del Dashboard */}
      <header className="bg-white shadow-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-slate-900">
                Panel de Control
              </h1>
              <p className="text-slate-600 mt-1">
                Bienvenido, <span className="font-bold">{user.user_metadata.full_name}</span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg flex items-center gap-2"
              >
                <span className="text-xl">➕</span>
                Nueva Reserva
              </button>
              
              <button 
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.push('/')
                }}
                className="px-6 py-3 bg-white border-2 border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Información del usuario */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-slate-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-full flex items-center justify-center text-white text-2xl font-black">
              {user.user_metadata.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-slate-900">
                {user.user_metadata.full_name}
              </h2>
              <p className="text-slate-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                {user.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">
                Mis Reservas
              </p>
              <p className="text-3xl font-black text-blue-600">
                {myReservations.length}
              </p>
            </div>
          </div>
        </div>

        {/* Mis Reservas */}
        {myReservations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-slate-200">
            <h3 className="text-2xl font-black text-slate-900 mb-4">
              📋 Mis Reservas Activas
            </h3>
            
            <div className="space-y-3">
              {myReservations.map(reservation => {
                const vehicleConfig = VEHICLE_CONFIG[reservation.vehicle_id]
                const startDate = new Date(reservation.start_date).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })
                const endDate = new Date(reservation.end_date).toLocaleDateString('es-ES', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })
                const isPast = new Date(reservation.end_date) < new Date()

                return (
                  <div
                    key={reservation.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      isPast 
                        ? 'border-slate-200 bg-slate-50 opacity-60' 
                        : 'hover:shadow-lg'
                    }`}
                    style={{ 
                      borderColor: isPast ? undefined : vehicleConfig?.color 
                    }}
                  >
                    <span className="text-4xl">{vehicleConfig?.icon}</span>
                    
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">
                        {reservation.vehicle_name}
                        {isPast && (
                          <span className="ml-2 text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full">
                            Finalizada
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-slate-600">
                        {startDate} → {endDate}
                      </p>
                    </div>

                    {!isPast && (
                      <button
                        onClick={() => deleteReservation(reservation.id)}
                        className="px-4 py-2 bg-red-50 text-red-700 border-2 border-red-200 rounded-lg font-bold hover:bg-red-100 transition-all"
                      >
                        🗑️ Eliminar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Calendario completo */}
        <VehicleCalendar key={refreshKey} />
      </main>

      {/* Modal de nueva reserva */}
      <ReservationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userName={user.user_metadata.full_name || 'Usuario'}
        userEmail={user.email || ''}
        onSuccess={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  )
}