'use client'
import { useEffect, useState, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AUTH_TIMEOUT_MS } from '@/lib/types'
import Link from 'next/link'
import { XCircle, Home, RefreshCw, Loader2 } from 'lucide-react'

function parseUrlError(searchParams: URLSearchParams): string | null {
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (!errorParam || errorParam.trim() === '') return null

  if (errorDescription?.includes('Database error saving new user')) {
    return 'Error de configuracion en el servidor. Por favor contacta al administrador del sistema.'
  }
  if (errorDescription?.includes('Email not confirmed')) {
    return 'Tu email no ha sido confirmado. Por favor verifica tu correo.'
  }
  if (errorDescription?.includes('Invalid login credentials')) {
    return 'Credenciales invalidas. Intenta de nuevo.'
  }
  if (errorDescription && errorDescription.trim() !== '') {
    return errorDescription.replace(/\+/g, ' ')
  }
  return 'Error al iniciar sesion con Microsoft'
}

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const urlError = useMemo(() => parseUrlError(searchParams), [searchParams])
  const [error, setError] = useState<string | null>(urlError)

  useEffect(() => {
    if (urlError) return

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setTimeout(() => {
            router.push('/dashboard')
          }, 500)
        } else if (event === 'SIGNED_OUT') {
          setError('La sesion ha expirado')
        }
      }
    )

    const timeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setError('La autenticacion tardo demasiado. Por favor intenta de nuevo.')
        }
      })
    }, AUTH_TIMEOUT_MS)

    return () => {
      authListener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router, urlError])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border-t-4 border-red-500">
          <div className="text-center mb-6">
            <XCircle size={56} className="text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-stone-900 mb-3">
              Error de Autenticacion
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
              className="flex items-center justify-center gap-2 w-full text-center px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all shadow-lg"
            >
              <Home size={18} />
              Volver al Inicio
            </Link>

            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 border-2 border-stone-300 text-stone-700 rounded-xl font-bold hover:bg-stone-50 transition-all"
            >
              <RefreshCw size={18} />
              Intentar de Nuevo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return <LoadingUI />
}

function LoadingUI() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-stone-900 via-[#0a3d3f] to-stone-900">
      <div className="text-center max-w-md px-4">
        <div className="relative mb-8">
          <div className="w-20 h-20 mx-auto flex items-center justify-center">
            <Loader2 size={48} className="text-primary-light animate-spin" />
          </div>
        </div>
        <h2 className="text-2xl font-black text-white mb-3">
          Validando Credenciales
        </h2>
        <p className="text-stone-300 mb-6">
          Estamos confirmando tu acceso con Microsoft 365
        </p>
        <div className="bg-stone-800/50 rounded-full p-1 backdrop-blur-sm">
          <div className="bg-gradient-to-r from-primary-light to-emerald-500 rounded-full h-2 animate-pulse"></div>
        </div>
        <p className="text-stone-500 text-xs mt-6">
          Este proceso puede tardar unos segundos...
        </p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingUI />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
