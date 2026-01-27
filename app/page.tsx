'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import VehicleCalendar from './components/VehicleCalendar'

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
      setMsg('❌ Error: ' + error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                Intranet Corporativa
              </h1>
              <p className="text-sm text-slate-600 uppercase tracking-widest mt-1 font-semibold">
                Amazonia Emprende
              </p>
            </div>

            {/* Botón de login en el header */}
            <button
              onClick={handleMicrosoftLogin}
              disabled={loading}
              className="flex items-center gap-3 px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-slate-800 to-slate-900 hover:from-black hover:to-slate-800 transition-all shadow-lg hover:shadow-xl border border-slate-700"
            >
              {/* Logo de Microsoft */}
              <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill="#F25022" d="M1 1H10V10H1V1Z"/>
                <path fill="#00A4EF" d="M1 12H10V21H1V12Z"/>
                <path fill="#7FBA00" d="M12 1H21V10H12V1Z"/>
                <path fill="#FFB900" d="M12 12H21V21H12V12Z"/>
              </svg>
              {loading ? 'Redirigiendo...' : 'Iniciar Sesión'}
            </button>
          </div>

          {msg && (
            <div className="mt-4 p-4 rounded-lg text-sm text-center bg-red-50 text-red-700 border border-red-200">
              {msg}
            </div>
          )}
        </div>
      </header>

      {/* Sección del Calendario */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Banner informativo */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex items-start gap-4">
            <span className="text-4xl">📅</span>
            <div>
              <h2 className="text-2xl font-black mb-2">
                Sistema de Reserva de Vehículos
              </h2>
              <p className="text-blue-100 text-sm leading-relaxed">
                Consulta la disponibilidad de los vehículos corporativos en tiempo real. 
                <span className="font-bold"> Inicia sesión con tu cuenta de Microsoft 365</span> para 
                gestionar y crear nuevas reservas.
              </p>
            </div>
          </div>
        </div>

        {/* Calendario de vehículos */}
        <VehicleCalendar />

        {/* Sección de Login (complementaria) */}
        <div className="mt-12 bg-white rounded-2xl shadow-xl p-8 border border-slate-200">
          <div className="text-center max-w-md mx-auto">
            <div className="text-6xl mb-4">🔐</div>
            <h3 className="text-2xl font-black text-slate-900 mb-3">
              ¿Necesitas gestionar reservas?
            </h3>
            <p className="text-slate-600 mb-6">
              Accede con tu cuenta corporativa de Microsoft 365 para crear, 
              modificar o eliminar reservas de vehículos.
            </p>

            <button
              onClick={handleMicrosoftLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 p-4 rounded-xl font-bold text-white bg-gradient-to-r from-slate-800 to-slate-900 hover:from-black hover:to-slate-800 transition-all shadow-lg hover:shadow-xl border border-slate-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill="#F25022" d="M1 1H10V10H1V1Z"/>
                <path fill="#00A4EF" d="M1 12H10V21H1V12Z"/>
                <path fill="#7FBA00" d="M12 1H21V10H12V1Z"/>
                <path fill="#FFB900" d="M12 12H21V21H12V12Z"/>
              </svg>
              {loading ? 'Redirigiendo a Microsoft...' : 'Iniciar con Microsoft 365'}
            </button>

            <p className="text-xs text-slate-500 mt-4">
              Ingreso exclusivo para personal autorizado de Amazonia Emprende
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center text-slate-500 text-sm">
          <p className="font-semibold">
            © {new Date().getFullYear()} Amazonia Emprende - Todos los derechos reservados
          </p>
        </div>
      </footer>
    </div>
  )
}