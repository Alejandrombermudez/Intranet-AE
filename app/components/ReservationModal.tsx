'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { VEHICLES } from '@/lib/vehicles'
import { formatPurpose } from '@/lib/types'
import { AlertTriangle, Check } from 'lucide-react'

interface ReservationModalProps {
  isOpen: boolean
  onClose: () => void
  userName: string
  userEmail: string
  onSuccess: () => void
}

export default function ReservationModal({
  isOpen,
  onClose,
  userName,
  userEmail,
  onSuccess
}: ReservationModalProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [conflictDates, setConflictDates] = useState<string[]>([])
  const [project, setProject] = useState<string>('')
  const [activity, setActivity] = useState<string>('')

  // Resetear formulario al abrir/cerrar
  useEffect(() => {
    if (!isOpen) {
      setSelectedVehicle('')
      setStartDate('')
      setEndDate('')
      setError('')
      setConflictDates([])
      setProject('')
      setActivity('')
    }
  }, [isOpen])

  // Verificar conflictos cuando cambian las fechas o el vehiculo
  useEffect(() => {
    if (selectedVehicle && startDate && endDate) {
      checkConflicts()
    } else {
      setConflictDates([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVehicle, startDate, endDate])

  const checkConflicts = async () => {
    if (!selectedVehicle || !startDate || !endDate) return

    try {
      const { data, error } = await supabase
        .from('vehicle_reservations')
        .select('start_date, end_date')
        .eq('vehicle_id', selectedVehicle)
        .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`)

      if (error) throw error

      if (data && data.length > 0) {
        const conflicts: string[] = []
        data.forEach(reservation => {
          const start = new Date(reservation.start_date)
          const end = new Date(reservation.end_date)
          const current = new Date(start)
          while (current <= end) {
            conflicts.push(current.toISOString().split('T')[0])
            current.setDate(current.getDate() + 1)
          }
        })

        setConflictDates([...new Set(conflicts)])
      } else {
        setConflictDates([])
      }
    } catch {
      // Error silencioso en produccion
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!selectedVehicle || !startDate || !endDate || !activity.trim()) {
      setError('Por favor completa todos los campos obligatorios')
      setLoading(false)
      return
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError('La fecha de fin no puede ser anterior a la fecha de inicio')
      setLoading(false)
      return
    }

    if (conflictDates.length > 0) {
      setError('Este vehiculo ya esta reservado en algunas de las fechas seleccionadas')
      setLoading(false)
      return
    }

    try {
      const vehicle = VEHICLES.find(v => v.id === selectedVehicle)

      const { error: insertError } = await supabase
        .from('vehicle_reservations')
        .insert([
          {
            vehicle_id: selectedVehicle,
            vehicle_name: vehicle?.name || '',
            user_name: userName,
            user_email: userEmail,
            start_date: startDate,
            end_date: endDate,
            purpose: formatPurpose(project, activity)
          }
        ])

      if (insertError) throw insertError

      onSuccess()
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al crear la reserva'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const today = new Date().toISOString().split('T')[0]
  const hasConflict = conflictDates.length > 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-primary text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">Nueva Reserva</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-all"
            >
              &times;
            </button>
          </div>
          <p className="text-white/70 text-sm mt-2">
            Reserva un vehiculo para tus actividades
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Selector de vehiculo */}
          <div>
            <label className="block text-sm font-bold text-stone-800 mb-3 uppercase tracking-wide">
              Selecciona un Vehiculo *
            </label>
            <div className="grid grid-cols-1 gap-3">
              {VEHICLES.map(vehicle => {
                const IconComponent = vehicle.icon
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => setSelectedVehicle(vehicle.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      selectedVehicle === vehicle.id
                        ? 'border-primary bg-primary-50 shadow-lg scale-[1.02]'
                        : 'border-stone-200 hover:border-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent size={24} style={{ color: vehicle.color }} />
                      <div className="flex-1">
                        <p className="font-bold text-stone-900 text-lg">{vehicle.name}</p>
                        <div
                          className="w-20 h-1.5 rounded-full mt-1"
                          style={{ backgroundColor: vehicle.color }}
                        ></div>
                      </div>
                      {selectedVehicle === vehicle.id && (
                        <Check className="text-primary" size={20} />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Proyecto (opcional) */}
          <div>
            <label className="block text-sm font-bold text-stone-800 mb-2 uppercase tracking-wide">
              Proyecto <span className="text-stone-400 normal-case font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="Ej: Proyecto FAO, PNUD, Conservacion..."
              maxLength={50}
              className="w-full px-4 py-3 border-2 border-stone-300 rounded-xl focus:border-primary focus:outline-none transition-all font-medium text-stone-900 placeholder:text-stone-400"
            />
            <p className="text-xs text-stone-500 mt-1">
              {project.length}/50 caracteres
            </p>
          </div>

          {/* Actividad (obligatoria) */}
          <div>
            <label className="block text-sm font-bold text-stone-800 mb-2 uppercase tracking-wide">
              Actividad *
            </label>
            <input
              type="text"
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              placeholder="Ej: Campamento Biodiversidad, Entrega de insumos..."
              maxLength={100}
              required
              className="w-full px-4 py-3 border-2 border-stone-300 rounded-xl focus:border-primary focus:outline-none transition-all font-medium text-stone-900 placeholder:text-stone-400"
            />
            <p className="text-xs text-stone-500 mt-1">
              {activity.length}/100 caracteres
            </p>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-stone-800 mb-2 uppercase tracking-wide">
                Fecha de Inicio *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={today}
                required
                className="w-full px-4 py-3 border-2 border-stone-300 rounded-xl focus:border-primary focus:outline-none transition-all font-medium text-stone-900"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-stone-800 mb-2 uppercase tracking-wide">
                Fecha de Fin *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || today}
                required
                className="w-full px-4 py-3 border-2 border-stone-300 rounded-xl focus:border-primary focus:outline-none transition-all font-medium text-stone-900"
              />
            </div>
          </div>

          {/* Advertencia de conflicto */}
          {hasConflict && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={22} />
                <div>
                  <p className="font-bold text-amber-900 mb-1">
                    Conflicto de Reserva
                  </p>
                  <p className="text-sm text-amber-800 font-medium">
                    Este vehiculo ya esta reservado en {conflictDates.length} dia(s)
                    del rango seleccionado.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error general */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700 font-bold">{error}</p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-stone-300 text-stone-700 rounded-xl font-bold hover:bg-stone-100 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || hasConflict}
              className="flex-1 px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark disabled:bg-stone-300 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {loading ? 'Guardando...' : 'Crear Reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
