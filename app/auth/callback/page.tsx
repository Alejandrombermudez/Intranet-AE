'use client'
import { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { registrarAcceso } from '@/lib/registro-acceso'
import { AUTH_TIMEOUT_MS } from '@/lib/types'
import { XCircle, Home, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react'
import { Boton, Firma, Rotulo } from '@/app/components/marca'
import Isotipo from '@/app/components/Isotipo'

/**
 * La pantalla que se ve al volver de Microsoft 365.
 *
 * Antes era un «Validando credenciales» sobre fondo oscuro: una sala de espera.
 * Ahora es la misma BIENVENIDA que da el geoportal —el isotipo apareciendo y el
 * nombre escribiéndose letra a letra— y debajo, una sola línea que dice cómo
 * fue: conexión correcta, o qué falló. El gesto es el del geovisor; los colores
 * y la tipografía son los del Manual de Identidad, no los hex del otro repo.
 *
 * La animación y la autenticación corren EN PARALELO: se entra cuando las dos
 * terminaron. Así el saludo nunca corta un login rápido ni un login lento se
 * queda sin saludo.
 */

const NOMBRE = 'AMAZONÍA EMPRENDE'
const MS_POR_LETRA = 70
const MS_ANTES_DE_ENTRAR = 900   // lo que dura «Conexión correcta» en pantalla

function parseUrlError(searchParams: URLSearchParams): string | null {
  const errorParam = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (!errorParam || errorParam.trim() === '') return null

  if (errorDescription?.includes('Database error saving new user')) {
    return 'Error de configuración en el servidor. Contacta al administrador del sistema.'
  }
  if (errorDescription?.includes('Email not confirmed')) {
    return 'Tu correo no está confirmado. Revísalo y vuelve a intentar.'
  }
  if (errorDescription?.includes('Invalid login credentials')) {
    return 'Credenciales inválidas. Intenta de nuevo.'
  }
  if (errorDescription && errorDescription.trim() !== '') {
    return errorDescription.replace(/\+/g, ' ')
  }
  return 'No se pudo iniciar sesión con Microsoft 365'
}

type Estado = 'validando' | 'ok' | 'error'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const urlError = useMemo(() => parseUrlError(searchParams), [searchParams])
  const [error, setError] = useState<string | null>(urlError)
  const [nombre, setNombre] = useState<string | null>(null)
  const [entro, setEntro] = useState(false)          // la sesión quedó confirmada
  const [saludoListo, setSaludoListo] = useState(false)  // terminó la animación

  const estado: Estado = error ? 'error' : entro ? 'ok' : 'validando'

  // ── Autenticación ──
  useEffect(() => {
    if (urlError) return

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Un inicio de sesión siempre cuenta como acceso, aunque haya habido
          // otro hace menos de 30 min (respaldo del trigger de auth.users).
          registrarAcceso({ forzar: true }).catch(() => {/* el trigger de BD también lo registra */})
          const meta = session.user.user_metadata as { full_name?: string; name?: string } | undefined
          const nom = meta?.full_name ?? meta?.name ?? session.user.email ?? null
          // Solo el primer nombre: el saludo es un saludo, no una credencial.
          setNombre(nom ? String(nom).trim().split(/[\s@]/)[0] : null)
          setEntro(true)
        } else if (event === 'SIGNED_OUT') {
          setError('La sesión expiró antes de poder entrar.')
        }
      }
    )

    const timeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) setError('La autenticación tardó demasiado. Intenta de nuevo.')
      })
    }, AUTH_TIMEOUT_MS)

    return () => {
      authListener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [urlError])

  // ── Entrar: cuando la sesión está lista Y el saludo terminó ──
  useEffect(() => {
    if (!entro || !saludoListo) return
    const t = setTimeout(() => router.push('/'), MS_ANTES_DE_ENTRAR)
    return () => clearTimeout(t)
  }, [entro, saludoListo, router])

  return (
    <Bienvenida
      estado={estado}
      nombre={nombre}
      error={error}
      onSaludoListo={useCallback(() => setSaludoListo(true), [])}
    />
  )
}

/** El isotipo entrando y el nombre escribiéndose, como en el geoportal. */
function Bienvenida({
  estado, nombre, error, onSaludoListo,
}: {
  estado: Estado
  nombre?: string | null
  error?: string | null
  onSaludoListo?: () => void
}) {
  const [visible, setVisible] = useState(false)
  const [escrito, setEscrito] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!visible) return
    let i = 0
    const id = setInterval(() => {
      i += 1
      setEscrito(NOMBRE.slice(0, i))
      if (i >= NOMBRE.length) {
        clearInterval(id)
        onSaludoListo?.()
      }
    }, MS_POR_LETRA)
    return () => clearInterval(id)
  }, [visible, onSaludoListo])

  return (
    <div className="flex min-h-screen flex-col bg-papel">
      <div className="px-8 pt-8 sm:px-12">
        <Firma className="text-bosque" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {/* Isotipo + nombre escribiéndose.
            En teléfono el isotipo va ENCIMA: en una sola línea, «Amazonía
            Emprende» no cabe al lado del isotipo a 375 px y se corta. */}
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-[clamp(20px,4vw,56px)]">
          <Isotipo
            className={`w-[clamp(44px,8vw,104px)] text-bosque transition-all duration-700 ease-out
              ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
          />
          <h1 className="m-0 flex items-center whitespace-nowrap font-display text-[clamp(20px,5vw,58px)] font-light leading-none tracking-[.06em] text-bosque">
            <span>{escrito}</span>
            <span aria-hidden className="ml-[.12em] inline-block h-[.85em] w-[.06em] animate-pulse bg-salvia" />
          </h1>
        </div>

        {/* Filete, el gesto del manual */}
        <div
          className={`mt-10 h-[2px] w-[clamp(140px,22vw,280px)] bg-gradient-to-r from-transparent via-salvia to-transparent transition-opacity duration-1000
            ${visible ? 'opacity-80' : 'opacity-0'}`}
        />

        {/* Debajo: cómo fue */}
        <div className="mt-8 w-full max-w-md text-center">
          {estado === 'validando' && (
            <p className="flex items-center justify-center gap-2 text-sm text-tenue">
              <Loader2 size={14} className="animate-spin" />
              Confirmando tu acceso con Microsoft 365
            </p>
          )}

          {estado === 'ok' && (
            <>
              <p className="flex items-center justify-center gap-2 text-sm font-bold text-bosque">
                <CheckCircle2 size={15} />
                Conexión correcta
              </p>
              <p className="mt-1.5 text-sm text-tenue">
                {nombre ? `Bienvenido, ${nombre}. Entrando…` : 'Entrando…'}
              </p>
            </>
          )}

          {estado === 'error' && (
            <>
              <Rotulo className="mb-2">No se pudo entrar</Rotulo>
              <p className="mb-6 flex items-start gap-2 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
                <XCircle size={16} className="mt-0.5 shrink-0" />
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
            </>
          )}
        </div>
      </div>

      <div className="px-8 pb-8 sm:px-12">
        <p className="text-[10px] uppercase tracking-[.2em] text-tenue">Inspirar · Nutrir · Actuar</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Bienvenida estado="validando" />}>
      <AuthCallbackContent />
    </Suspense>
  )
}
