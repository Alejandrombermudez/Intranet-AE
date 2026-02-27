'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import VehicleCalendar from './components/VehicleCalendar'
import { Calendar, Lock } from 'lucide-react'

export default function HomePage() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const handleMicrosoftLogin = async () => {
    setLoading(true)
    setMsg('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile',
        queryParams: {
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      setMsg('Error: ' + error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">
      {/* Header */}
      <header className="bg-white shadow-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-black text-stone-900 tracking-tight">
                Intranet Corporativa
              </h1>
              <p className="text-sm text-stone-600 uppercase tracking-widest mt-1 font-semibold">
                Amazonia Emprende
              </p>
            </div>

            {/* Boton de login en el header */}
            <button
              onClick={handleMicrosoftLogin}
              disabled={loading}
              className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-stone-800 to-stone-900 hover:from-black hover:to-stone-800 transition-all shadow-lg hover:shadow-xl border border-stone-700"
            >
              {/* Logo de Microsoft */}
              <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill="#F25022" d="M1 1H10V10H1V1Z"/>
                <path fill="#00A4EF" d="M1 12H10V21H1V12Z"/>
                <path fill="#7FBA00" d="M12 1H21V10H12V1Z"/>
                <path fill="#FFB900" d="M12 12H21V21H12V12Z"/>
              </svg>
              {loading ? 'Redirigiendo...' : 'Iniciar Sesion'}
            </button>
          </div>

          {msg && (
            <div className="mt-4 p-4 rounded-lg text-sm text-center bg-red-50 text-red-700 border border-red-200">
              {msg}
            </div>
          )}
        </div>
      </header>

      {/* Seccion del Calendario */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Banner informativo */}
        <div className="bg-primary text-white rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex items-start gap-4">
            <Calendar size={36} className="text-white/80 shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-black mb-2">
                Sistema de Reserva de Vehiculos
              </h2>
              <p className="text-white/70 text-sm leading-relaxed">
                Consulta la disponibilidad de los vehiculos corporativos en tiempo real.
                <span className="font-bold text-white"> Inicia sesion con tu cuenta de Microsoft 365</span> para
                gestionar y crear nuevas reservas.
              </p>
            </div>
          </div>
        </div>

        {/* Calendario de vehiculos */}
        <VehicleCalendar />

        {/* Seccion de Login (complementaria) */}
        <div className="mt-12 bg-white rounded-2xl shadow-xl p-8 border border-stone-200">
          <div className="text-center max-w-md mx-auto">
            <div className="mb-4">
              <Lock size={48} className="text-primary mx-auto" />
            </div>
            <h3 className="text-2xl font-black text-stone-900 mb-3">
              Necesitas gestionar reservas?
            </h3>
            <p className="text-stone-600 mb-6">
              Accede con tu cuenta corporativa de Microsoft 365 para crear,
              modificar o eliminar reservas de vehiculos.
            </p>

            <button
              onClick={handleMicrosoftLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 p-4 rounded-xl font-bold text-white bg-gradient-to-r from-stone-800 to-stone-900 hover:from-black hover:to-stone-800 transition-all shadow-lg hover:shadow-xl border border-stone-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill="#F25022" d="M1 1H10V10H1V1Z"/>
                <path fill="#00A4EF" d="M1 12H10V21H1V12Z"/>
                <path fill="#7FBA00" d="M12 1H21V10H12V1Z"/>
                <path fill="#FFB900" d="M12 12H21V21H12V12Z"/>
              </svg>
              {loading ? 'Redirigiendo a Microsoft...' : 'Iniciar con Microsoft 365'}
            </button>

            <p className="text-xs text-stone-500 mt-4">
              Ingreso exclusivo para personal autorizado de Amazonia Emprende
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center text-stone-500 text-sm">
          <p className="font-semibold">
            &copy; {new Date().getFullYear()} Amazonia Emprende - Todos los derechos reservados
          </p>
        </div>
      </footer>
    </div>
  )
}
