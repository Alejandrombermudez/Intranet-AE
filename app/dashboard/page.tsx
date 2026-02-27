'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { VEHICLE_MAP } from '@/lib/vehicles'
import type { Reservation } from '@/lib/types'
import { parsePurpose } from '@/lib/types'
import type { User } from '@supabase/supabase-js'
import VehicleCalendar from '../components/VehicleCalendar'
import ReservationModal from '../components/ReservationModal'
import { Plus, Trash2, ClipboardList, LogOut, Tag } from 'lucide-react'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [myReservations, setMyReservations] = useState<Reservation[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string>('')
  const router = useRouter()

  // Obtener usuario una sola vez
  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
      } else {
        setUser(user)
      }
    }
    getUser()
  }, [router])

  // Cargar reservas cuando el usuario esta disponible o se refresca
  useEffect(() => {
    if (user?.email) {
      loadMyReservations(user.email)
    }
  }, [user, refreshKey])

  const loadMyReservations = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_reservations')
        .select('*')
        .eq('user_email', email)
        .order('start_date', { ascending: true })

      if (error) throw error
      setMyReservations(data || [])
    } catch {
      // Error silencioso en produccion
    }
  }

  const confirmDelete = async (reservationId: string) => {
    setDeleteError('')
    try {
      const { error } = await supabase
        .from('vehicle_reservations')
        .delete()
        .eq('id', reservationId)

      if (error) throw error

      setDeleteTarget(null)
      setRefreshKey(prev => prev + 1)
    } catch {
      setDeleteError('No se pudo eliminar la reserva. Intenta de nuevo.')
    }
  }

  if (!user) return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100">
      <div className="animate-pulse font-semibold text-stone-700">Cargando perfil...</div>
    </div>
  )

  const displayName = user.user_metadata?.full_name || 'Usuario'
  const displayInitial = displayName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">
      {/* Header del Dashboard */}
      <header className="bg-white shadow-lg border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-stone-900">
                Panel de Control
              </h1>
              <p className="text-stone-600 mt-1">
                Bienvenido, <span className="font-bold">{displayName}</span>
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all shadow-lg flex items-center gap-2"
              >
                <Plus size={20} />
                Nueva Reserva
              </button>

              <button
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.push('/')
                }}
                className="px-6 py-3 bg-white border-2 border-stone-300 text-stone-700 rounded-xl font-bold hover:bg-stone-50 transition-all flex items-center gap-2"
              >
                <LogOut size={18} />
                Cerrar Sesion
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Informacion del usuario */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-stone-200">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center text-white text-2xl font-black">
              {displayInitial}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-stone-900">
                {displayName}
              </h2>
              <p className="text-stone-600 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                {user.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500 uppercase tracking-wider font-bold">
                Mis Reservas
              </p>
              <p className="text-3xl font-black text-primary">
                {myReservations.length}
              </p>
            </div>
          </div>
        </div>

        {/* Error de eliminacion */}
        {deleteError && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6 text-center">
            <p className="text-red-700 font-bold text-sm">{deleteError}</p>
          </div>
        )}

        {/* Mis Reservas */}
        {myReservations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8 border border-stone-200">
            <h3 className="text-2xl font-black text-stone-900 mb-4 flex items-center gap-2">
              <ClipboardList size={22} className="text-primary" />
              Mis Reservas Activas
            </h3>

            <div className="space-y-3">
              {myReservations.map(reservation => {
                const vehicle = VEHICLE_MAP[reservation.vehicle_id]
                const { project, activity } = parsePurpose(reservation.purpose || '')
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
                const IconComponent = vehicle?.icon

                return (
                  <div
                    key={reservation.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                      isPast
                        ? 'border-stone-200 bg-stone-50 opacity-60'
                        : 'hover:shadow-lg'
                    }`}
                    style={{
                      borderColor: isPast ? undefined : vehicle?.color
                    }}
                  >
                    {IconComponent && (
                      <IconComponent size={28} style={{ color: vehicle?.color }} />
                    )}

                    <div className="flex-1">
                      <p className="font-bold text-stone-900">
                        {reservation.vehicle_name}
                        {isPast && (
                          <span className="ml-2 text-xs bg-stone-200 text-stone-600 px-2 py-1 rounded-full">
                            Finalizada
                          </span>
                        )}
                      </p>
                      {(activity || project) && (
                        <div className="flex items-center gap-1.5 my-0.5">
                          <Tag size={13} className="text-stone-500" />
                          <span className="text-xs font-medium text-stone-700">
                            {activity || 'Sin detalle'}
                          </span>
                          {project && (
                            <span className="text-xs bg-primary-100 text-primary-dark px-2 py-0.5 rounded-full font-medium">
                              {project}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-stone-600">
                        {startDate} &rarr; {endDate}
                      </p>
                    </div>

                    {!isPast && (
                      <>
                        {deleteTarget === reservation.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-stone-600">Eliminar?</span>
                            <button
                              onClick={() => confirmDelete(reservation.id)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-all"
                            >
                              Si
                            </button>
                            <button
                              onClick={() => setDeleteTarget(null)}
                              className="px-3 py-1.5 border border-stone-300 text-stone-600 rounded-lg font-bold text-sm hover:bg-stone-100 transition-all"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteTarget(reservation.id)}
                            className="px-4 py-2 bg-red-50 text-red-700 border-2 border-red-200 rounded-lg font-bold hover:bg-red-100 transition-all flex items-center gap-1.5"
                          >
                            <Trash2 size={16} />
                            Eliminar
                          </button>
                        )}
                      </>
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
        userName={displayName}
        userEmail={user.email || ''}
        onSuccess={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  )
}
