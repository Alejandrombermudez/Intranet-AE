'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const handleMicrosoftLogin = async () => {
    setLoading(true)
    setMsg('')
    
    // Inicia la autenticación con Azure (Microsoft)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        // Al terminar, Microsoft te devuelve a esta ruta
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile',
        // ESTA ES LA CLAVE: Forzamos a que siempre pregunte la cuenta
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-lg shadow-2xl p-8 border-t-4 border-blue-600">
        
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Intranet Corporativa</h1>
          <p className="text-sm text-slate-500 uppercase tracking-widest mt-1">Amazonia Emprende</p>
        </div>

        <div className="space-y-6">
          <p className="text-center text-slate-600">
             Ingreso exclusivo para personal autorizado.
          </p>

          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 p-3 rounded-lg font-bold text-white bg-[#2F2F2F] hover:bg-black transition-all border border-transparent shadow-lg"
          >
            {/* Logo de Microsoft */}
            <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill="#F25022" d="M1 1H10V10H1V1Z"/>
              <path fill="#00A4EF" d="M1 12H10V21H1V12Z"/>
              <path fill="#7FBA00" d="M12 1H21V10H12V1Z"/>
              <path fill="#FFB900" d="M12 12H21V21H12V12Z"/>
            </svg>
            {loading ? 'Redirigiendo...' : 'Iniciar con Microsoft 365'}
          </button>
        </div>

        {msg && (
          <div className="mt-6 p-4 rounded text-sm text-center bg-red-50 text-red-700 border border-red-200">
            {msg}
          </div>
        )}
      </div>
    </div>
  )
}