'use client'
import { useEffect, useRef, useState, Suspense, useMemo, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { registrarAcceso } from '@/lib/registro-acceso'
import { AUTH_TIMEOUT_MS } from '@/lib/types'
import { XCircle, Home, RefreshCw, Loader2 } from 'lucide-react'
import { Boton, Rotulo } from '@/app/components/marca'

/**
 * La pantalla que se ve al volver de Microsoft 365: la BIENVENIDA.
 *
 * Un video de 3 s (public/bienvenida/bienvenida.mp4: el isotipo entre hojas
 * verdes que un remolino dorado vuelve corona de otoño, recortado de los 10 s
 * del original), y debajo «Amazonía Emprende ® 2026» y el saludo con el nombre.
 * Si algo falla, el mismo lugar dice qué y cómo seguir.
 *
 * El video y la autenticación corren EN PARALELO: se entra cuando las dos
 * terminaron. Así el saludo nunca corta un login rápido ni un login lento se
 * queda sin saludo. Si el video no carga o el navegador no lo deja arrancar
 * solo, a los 3,2 s se sigue igual: el video adorna, no detiene la entrada.
 */

const MARCA = 'Amazonía Emprende ® 2026'
const MS_ANTES_DE_ENTRAR = 500    // el saludo quieto sobre la corona antes de entrar
const MS_MAXIMO_VIDEO = 3200      // si el video no termina (no cargó, sin autoplay), se sigue

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
  const [sexo, setSexo] = useState<string | null>(null)
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
          // Microsoft entrega su token solo en este momento: con él se traen a la
          // ficha de talento humano el cargo, los teléfonos y la foto. Va aparte y
          // sin esperar: si Microsoft no da el permiso, la entrada sigue igual.
          if (session.provider_token) {
            fetch('/api/talento/m365', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
              body: JSON.stringify({ provider_token: session.provider_token }),
              keepalive: true,
            }).catch(() => {/* sin datos de Microsoft la ficha queda con lo del inicio de sesión */})
          }
          const meta = session.user.user_metadata as { full_name?: string; name?: string } | undefined
          const nom = meta?.full_name ?? meta?.name ?? session.user.email ?? null
          // Solo el primer nombre: el saludo es un saludo, no una credencial.
          setNombre(nom ? String(nom).trim().split(/[\s@]/)[0] : null)
          // Si la persona ya llenó su ficha, el saludo usa su nombre y su sexo
          // («Bienvenida» / «Bienvenido»). Mientras llega, queda el de Microsoft.
          fetch('/api/talento/saludo', { headers: { Authorization: `Bearer ${session.access_token}` } })
            .then((r) => (r.ok ? r.json() : {}))
            .then((j: { nombre?: string | null; sexo?: string | null }) => {
              if (j.nombre) setNombre(j.nombre)
              if (j.sexo) setSexo(j.sexo)
            })
            .catch(() => {/* sin ficha: saludo con el nombre de Microsoft */})
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
    // Si se salió a Microsoft desde una página de la intranet (por ejemplo «Traer
    // de Microsoft 365» en Mi perfil), se vuelve a ella; si no, al inicio.
    let destino = '/'
    try {
      const s = sessionStorage.getItem('ae:siguiente')
      sessionStorage.removeItem('ae:siguiente')
      if (s && /^\/intranet\/[\w\-/?=&]*$/.test(s)) destino = s
    } catch { /* sin storage: al inicio */ }
    const t = setTimeout(() => router.push(destino), MS_ANTES_DE_ENTRAR)
    return () => clearTimeout(t)
  }, [entro, saludoListo, router])

  return (
    <Bienvenida
      estado={estado}
      nombre={nombre}
      sexo={sexo}
      error={error}
      onSaludoListo={useCallback(() => setSaludoListo(true), [])}
    />
  )
}

/**
 * El saludo según la ficha: «Bienvenida» o «Bienvenido». Sin el dato, la forma
 * que no presume: «Te damos la bienvenida».
 */
function saludo(nombre: string | null | undefined, sexo: string | null | undefined): string | null {
  if (!nombre) return null
  if (sexo === 'F') return `Bienvenida, ${nombre}`
  if (sexo === 'M') return `Bienvenido, ${nombre}`
  return `Te damos la bienvenida, ${nombre}`
}

/** El video de 3 s y, debajo, la marca y el saludo. */
function Bienvenida({
  estado, nombre, sexo, error, onSaludoListo,
}: {
  estado: Estado
  nombre?: string | null
  sexo?: string | null
  error?: string | null
  onSaludoListo?: () => void
}) {
  const [visible, setVisible] = useState(false)
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Quien pidió menos movimiento en su sistema ve el primer cuadro quieto.
    const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (quieto && video.current) { video.current.autoplay = false; video.current.pause() }
    const t1 = setTimeout(() => setVisible(true), 350)
    // Respaldo: si el video no avisa que terminó, el saludo se da por listo igual.
    const t2 = setTimeout(() => onSaludoListo?.(), quieto ? 1200 : MS_MAXIMO_VIDEO)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onSaludoListo])

  const texto = saludo(nombre, sexo)

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4"
      // El crema del video, más oscuro hacia los bordes como el video mismo: así no se nota su rectángulo.
      style={{ background: 'radial-gradient(ellipse at 50% 42%, #f2ecdc 0%, #ece3d0 45%, #ddd0b6 100%)' }}
    >
      <div
        className="relative aspect-video w-[min(100vw,118vh)] max-w-[1280px]"
        style={{
          WebkitMaskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)',
          maskImage: 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)',
        }}
      >
        <video
          ref={video}
          className="h-full w-full object-cover"
          src="/bienvenida/bienvenida.mp4"
          poster="/bienvenida/bienvenida-inicio.jpg"
          autoPlay
          muted
          playsInline
          preload="auto"
          onEnded={() => onSaludoListo?.()}
          aria-hidden
        />
      </div>

      {/* Debajo del isotipo: la marca y, más abajo, el saludo */}
      <div className={`-mt-[clamp(8px,4vh,48px)] w-full max-w-xl text-center transition-all duration-700 ease-out ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
        <p className="font-display text-[clamp(11px,1.6vw,15px)] font-semibold uppercase tracking-[.32em] text-bosque">
          {MARCA}
        </p>
        <div className="mx-auto mt-4 h-px w-[clamp(120px,18vw,220px)] bg-gradient-to-r from-transparent via-musgo/60 to-transparent" />

        {estado !== 'error' && (
          <p className={`mt-4 min-h-[1.3em] font-titulo text-[clamp(24px,4.4vw,44px)] font-light italic leading-tight text-tinta transition-opacity duration-500 ${texto ? 'opacity-100' : 'opacity-0'}`}>
            {texto ?? '·'}
          </p>
        )}

        {estado === 'validando' && (
          <p className="mt-3 flex items-center justify-center gap-2 text-[12px] text-tenue">
            <Loader2 size={13} className="animate-spin" />
            Confirmando tu acceso con Microsoft 365
          </p>
        )}

        {estado === 'error' && (
          <div className="mx-auto mt-6 max-w-md">
            <Rotulo className="mb-2">No se pudo entrar</Rotulo>
            <p className="mb-6 flex items-start gap-2 border-l-2 border-red-600 bg-white/70 px-4 py-3 text-left text-sm text-red-700">
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
          </div>
        )}
      </div>

      <p className="absolute bottom-6 text-[10px] uppercase tracking-[.2em] text-tenue">Inspirar · Nutrir · Actuar</p>
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
