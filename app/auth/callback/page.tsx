'use client'
import { useEffect, useState, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { registrarAcceso } from '@/lib/registro-acceso'
import { AUTH_TIMEOUT_MS } from '@/lib/types'
import { XCircle, Home, RefreshCw, Loader2 } from 'lucide-react'
import { Boton, Firma, Rotulo } from '@/app/components/marca'

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
          // Un inicio de sesión siempre cuenta como acceso, aunque haya habido
          // otro hace menos de 30 min (respaldo del trigger de auth.users).
          registrarAcceso({ forzar: true }).catch(() => {/* el trigger de BD también lo registra */})
          setTimeout(() => {
            router.push('/')
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
      <div className="grid min-h-screen place-items-center bg-papel px-6">
        <div className="w-full max-w-md">
          <XCircle size={34} strokeWidth={1.5} className="mb-5 text-red-600" />
          <Rotulo className="mb-3">Inicio de sesión</Rotulo>
          <h1 className="mb-5 font-display text-3xl font-bold leading-tight text-stone-900">
            Error de autenticación
          </h1>
          <p className="mb-8 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Boton href="/" icono={<Home size={15} />} className="flex-1">
              Volver al inicio
            </Boton>
            <Boton
              variante="secundario"
              onClick={() => window.location.reload()}
              icono={<RefreshCw size={15} />}
              className="flex-1"
            >
              Intentar de nuevo
            </Boton>
          </div>

          <Firma className="mt-14 text-stone-500" />
        </div>
      </div>
    )
  }

  return <LoadingUI />
}

function LoadingUI() {
  return (
    <div className="flex min-h-screen flex-col bg-tinta text-hueso">
      <div className="px-8 pt-8 sm:px-12">
        <Firma />
      </div>
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <Loader2 size={30} className="mx-auto mb-7 animate-spin text-ambar" />
          <Rotulo tono="taupe" className="mb-3">Microsoft 365</Rotulo>
          <h2 className="mb-3 font-display text-3xl font-bold text-white">Validando credenciales</h2>
          <p className="mb-8 text-sm font-light text-hueso/75">
            Estamos confirmando tu acceso con Microsoft 365
          </p>
          <div className="h-[2px] w-full bg-hueso/15">
            <div className="h-full w-full animate-pulse bg-ambar" />
          </div>
          <p className="mt-6 text-[10px] uppercase tracking-[.16em] text-hueso/40">
            Este proceso puede tardar unos segundos
          </p>
        </div>
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
