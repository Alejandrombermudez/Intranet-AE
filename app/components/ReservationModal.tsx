'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface Vehicle {
  id: string
  name: string
  icon: string
  color: string
}

interface ReservationModalProps {
  isOpen: boolean
  onClose: () => void
  userName: string
  userEmail: string
  onSuccess: () => void
}

const VEHICLES: Vehicle[] = [
  { id: 'camioneta1', name: 'Camioneta 1', icon: '🚙', color: '#3b82f6' },
  { id: 'camioneta2', name: 'Camioneta 2', icon: '🚐', color: '#10b981' },
  { id: 'moto', name: 'Moto', icon: '🏍️', color: '#f59e0b' }
]

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
  const [purpose, setPurpose] = useState<string>('')

  // Resetear formulario al abrir/cerrar
  useEffect(() => {
    if (!isOpen) {
      setSelectedVehicle('')
      setStartDate('')
      setEndDate('')
      setError('')
      setConflictDates([])
      setPurpose('')
    }
  }, [isOpen])

  // Verificar conflictos cuando cambian las fechas o el vehículo
  useEffect(() => {
    if (selectedVehicle && startDate && endDate) {
      checkConflicts()
    } else {
      setConflictDates([])
    }
  }, [selectedVehicle, startDate, endDate])

  const checkConflicts = async () => {
    if (!selectedVehicle || !startDate || !endDate) return

    try {
      // Buscar reservas que se solapan
      const { data, error } = await supabase
        .from('vehicle_reservations')
        .select('start_date, end_date')
        .eq('vehicle_id', selectedVehicle)
        .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`)

      if (error) throw error

      if (data && data.length > 0) {
        // Generar lista de fechas en conflicto
        const conflicts: string[] = []
        data.forEach(reservation => {
          const start = new Date(reservation.start_date)
          const end = new Date(reservation.end_date)
          
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            conflicts.push(d.toISOString().split('T')[0])
          }
        })
        
        setConflictDates([...new Set(conflicts)])
      } else {
        setConflictDates([])
      }
    } catch (error) {
      console.error('Error verificando conflictos:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validaciones
    if (!selectedVehicle || !startDate || !endDate || !purpose.trim()) {
      setError('Por favor completa todos los campos')
      setLoading(false)
      return
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError('La fecha de fin no puede ser anterior a la fecha de inicio')
      setLoading(false)
      return
    }

    // Verificar conflictos finales
    if (conflictDates.length > 0) {
      setError('Este vehículo ya está reservado en algunas de las fechas seleccionadas')
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
            purpose: purpose.trim()
          }
        ])

      if (insertError) throw insertError

      onSuccess()
      onClose()
    } catch (error: any) {
      setError(error.message || 'Error al crear la reserva')
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
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">Nueva Reserva</h2>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-all"
            >
              ×
            </button>
          </div>
          <p className="text-blue-100 text-sm mt-2">
            Reserva un vehículo para tus actividades
          </p>
        </div>

        {/* Form con texto NEGRO y negrita */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Selector de vehículo */}
          <div>
            <label className="block text-sm font-black text-black mb-3 uppercase tracking-wide">
              Selecciona un Vehículo *
            </label>
            <div className="grid grid-cols-1 gap-3">
              {VEHICLES.map(vehicle => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setSelectedVehicle(vehicle.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    selectedVehicle === vehicle.id
                      ? 'border-blue-600 bg-blue-50 shadow-lg scale-[1.02]'
                      : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{vehicle.icon}</span>
                    <div className="flex-1">
                      <p className="font-black text-black text-lg">{vehicle.name}</p>
                      <div 
                        className="w-20 h-1.5 rounded-full mt-1"
                        style={{ backgroundColor: vehicle.color }}
                      ></div>
                    </div>
                    {selectedVehicle === vehicle.id && (
                      <span className="text-blue-600 text-xl font-bold">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Propósito/Concepto */}
          <div>
            <label className="block text-sm font-black text-black mb-2 uppercase tracking-wide">
              Propósito / Concepto *
            </label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Ej: Campamento Biodiversidad, Proyecto FAO..."
              maxLength={100}
              required
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none transition-all font-bold text-black placeholder:text-slate-400"
            />
            <p className="text-xs text-slate-600 font-semibold mt-1">
              {purpose.length}/100 caracteres
            </p>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-black text-black mb-2 uppercase tracking-wide">
                Fecha de Inicio *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={today}
                required
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none transition-all font-bold text-black"
              />
            </div>

            <div>
              <label className="block text-sm font-black text-black mb-2 uppercase tracking-wide">
                Fecha de Fin *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || today}
                required
                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none transition-all font-bold text-black"
              />
            </div>
          </div>

          {/* Advertencia de conflicto */}
          {hasConflict && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <p className="font-bold text-red-900 mb-1">
                    Conflicto de Reserva
                  </p>
                  <p className="text-sm text-red-800 font-medium">
                    Este vehículo ya está reservado en {conflictDates.length} día(s) 
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
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-slate-300 text-black rounded-xl font-bold hover:bg-slate-100 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || hasConflict}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {loading ? 'Guardando...' : 'Crear Reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}