'use client'
import { useEffect, useState, Suspense } from 'react' // 1. Importar Suspense
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// 2. Componente interno con la lógica (extraído del original)
function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Verificar si hay errores REALES en la URL
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    const errorCode = searchParams.get('error_code')

    // SOLO mostrar error si realmente hay un mensaje de error
    if (errorParam && errorParam.trim() !== '') {
      console.error('❌ Error de OAuth:', {
        error: errorParam,
        description: errorDescription,
        code: errorCode
      })

      let errorMessage = 'Error al iniciar sesión con Microsoft'
      
      if (errorDescription?.includes('Database error saving new user')) {
        errorMessage = 'Error de configuración en el servidor. Por favor contacta al administrador del sistema.'
      } else if (errorDescription?.includes('Email not confirmed')) {
        errorMessage = 'Tu email no ha sido confirmado. Por favor verifica tu correo.'
      } else if (errorDescription?.includes('Invalid login credentials')) {
        errorMessage = 'Credenciales inválidas. Intenta de nuevo.'
      } else if (errorDescription && errorDescription.trim() !== '') {
        errorMessage = errorDescription.replace(/\+/g, ' ')
      }

      setError(errorMessage)
      return
    }

    // Escuchar cambios en el estado de autenticación
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth Event:', event)
        
        if (event === 'SIGNED_IN' && session) {
          console.log('✅ Redirigiendo al dashboard...')
          setTimeout(() => {
            router.push('/dashboard')
          }, 500)
        } else if (event === 'SIGNED_OUT') {
          console.log('⚠️ Usuario deslogueado')
          setError('La sesión ha expirado')
        }
      }
    )

    // Timeout de seguridad
    const timeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          console.error('⏱️ Timeout: No se pudo establecer la sesión')
          setError('La autenticación tardó demasiado. Por favor intenta de nuevo.')
        }
      })
    }, 10000)

    return () => {
      authListener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router, searchParams])

  // --- Renderizado del Componente Interno ---

  // Pantalla de error
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-red-50 to-red-100 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border-t-4 border-red-600">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-black text-slate-900 mb-3">
              Error de Autenticación
            </h1>
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
              <p className="text-red-700 font-semibold text-sm">
                {error}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full text-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg"
            >
              🏠 Volver al Inicio
            </Link>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              🔄 Intentar de Nuevo
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Pantalla de carga (Predeterminada del componente interno)
  return <LoadingUI />
}

// 3. UI de Carga Reutilizable (para evitar duplicar código)
function LoadingUI() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="text-center max-w-md px-4">
        <div className="relative mb-8">
          <div className="w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200 opacity-25"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
          </div>
        </div>
        <h2 className="text-2xl font-black text-white mb-3">
          Validando Credenciales
        </h2>
        <p className="text-blue-200 mb-6">
          Estamos confirmando tu acceso con Microsoft 365
        </p>
        <div className="bg-slate-800/50 rounded-full p-1 backdrop-blur-sm">
          <div className="bg-gradient-to-r from-blue-500 to-green-500 rounded-full h-2 animate-pulse"></div>
        </div>
        <p className="text-slate-400 text-xs mt-6">
          Este proceso puede tardar unos segundos...
        </p>
      </div>
    </div>
  )
}

// 4. Componente Principal (Page) que envuelve con Suspense
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingUI />}>
      <AuthCallbackContent />
    </Suspense>
  )
}

// Cambio para forzar deploy en Vercel