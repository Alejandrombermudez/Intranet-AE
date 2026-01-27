'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * COMPONENTE DE DIAGNÓSTICO
 * 
 * Agrega este componente temporalmente a tu dashboard para verificar
 * que la sesión esté funcionando correctamente.
 * 
 * INSTALACIÓN:
 * 1. Importa este componente en tu dashboard/page.tsx
 * 2. Agrégalo al final del JSX: <SessionDebug />
 * 3. Verás información detallada de la sesión
 * 4. Elimínalo cuando todo funcione
 */

export default function SessionDebug() {
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkSession()

    // Escuchar cambios
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 Auth State Change:', event)
        setSession(session)
        setUser(session?.user || null)
      }
    )

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) throw error
      
      setSession(session)
      setUser(session?.user || null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 bg-yellow-100 border-2 border-yellow-400 rounded-lg p-4 shadow-lg max-w-sm">
        <p className="text-yellow-800 font-bold text-sm">
          🔍 Verificando sesión...
        </p>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-slate-300 rounded-xl p-4 shadow-2xl max-w-md max-h-96 overflow-y-auto z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-black text-slate-900">🔍 Session Debug</h3>
        <button
          onClick={() => document.querySelector('[data-session-debug]')?.remove()}
          className="text-slate-400 hover:text-slate-600 text-xl"
        >
          ×
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-3">
          <p className="text-red-700 text-xs font-bold">Error: {error}</p>
        </div>
      )}

      {session ? (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="text-green-700 font-bold text-sm mb-1">
              ✅ Sesión Activa
            </p>
            <p className="text-green-600 text-xs">
              Expira: {new Date(session.expires_at * 1000).toLocaleString()}
            </p>
          </div>

          <div className="bg-slate-50 rounded p-3">
            <p className="font-bold text-xs text-slate-700 mb-2">Usuario:</p>
            <div className="space-y-1 text-xs">
              <p className="text-slate-600">
                <strong>ID:</strong> {user?.id?.slice(0, 8)}...
              </p>
              <p className="text-slate-600">
                <strong>Email:</strong> {user?.email}
              </p>
              <p className="text-slate-600">
                <strong>Nombre:</strong> {user?.user_metadata?.full_name}
              </p>
              <p className="text-slate-600">
                <strong>Provider:</strong> {user?.app_metadata?.provider}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 rounded p-3">
            <p className="font-bold text-xs text-slate-700 mb-2">Tokens:</p>
            <div className="space-y-1 text-xs">
              <p className="text-slate-600 truncate">
                <strong>Access:</strong> {session.access_token?.slice(0, 20)}...
              </p>
              <p className="text-slate-600 truncate">
                <strong>Refresh:</strong> {session.refresh_token?.slice(0, 20)}...
              </p>
            </div>
          </div>

          <button
            onClick={async () => {
              await supabase.auth.refreshSession()
              checkSession()
            }}
            className="w-full px-3 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700 transition-all"
          >
            🔄 Refrescar Sesión
          </button>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-red-700 font-bold text-sm">
            ❌ No hay sesión activa
          </p>
        </div>
      )}
    </div>
  )
}