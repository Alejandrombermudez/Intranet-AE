'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, LogOut, ChevronDown, Loader2 } from 'lucide-react'
import { Firma } from '@/app/components/marca'

// ─── Fotos de portada (slideshow automático) ──────────────────────────────────

const BG_IMAGES = [
  '/portada/DJI_0055.jpg',
  '/portada/DSC06314.jpg',
  '/portada/DSC01817.jpg',
  '/portada/DSC02224.jpg',
]

// ─── Notas de versión ─────────────────────────────────────────────────────────

const CHANGELOG = [
  {
    version: 'v1.1',
    date: 'Mayo 2026',
    tipo: 'fix' as const,
    cambios: [
      'Fix crítico de autenticación — botón Intranet ya visible correctamente',
      'Módulo Ejecutivo: dashboard de seguimiento de reuniones',
      'Tab "Mis Sesiones" para todos los departamentos',
      'Rediseño visual de la landing page',
    ],
  },
  {
    version: 'v1.0',
    date: 'Abril 2026',
    tipo: 'launch' as const,
    cambios: [
      'Lanzamiento oficial de la Intranet Corporativa',
      'Calendario de vehículos corporativos en tiempo real',
      'Formulario de inspección de vehículos (8 pasos)',
      'Panel de administración de usuarios',
    ],
  },
]

// ─── Componente ───────────────────────────────────────────────────────────────

/**
 * Portada de la intranet. Sigue la composición de las páginas del Manual de
 * Marca: un panel en tinta con la identidad y el acceso, y la fotografía del
 * terreno a toda altura. Nada de tarjetas de vidrio ni cajas redondeadas: los
 * servicios son filas separadas por filetes, como el listado de Reporte.
 */
export default function LandingPage() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [validarMsg, setValidarMsg] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [department, setDepartment] = useState<string | null>(null)
  const [bgIndex, setBgIndex] = useState(0)
  const [showChangelog, setShowChangelog] = useState(false)

  // Slideshow automático — cambia foto cada 8 s con crossfade de 2 s
  useEffect(() => {
    const timer = setInterval(() => {
      setBgIndex(prev => (prev + 1) % BG_IMAGES.length)
    }, 8000)
    return () => clearInterval(timer)
  }, [])

  // Verificar sesión al montar
  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)
      if (u) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          try {
            const res = await fetch('/api/users/me', {
              headers: { Authorization: `Bearer ${session.access_token}` },
            })
            if (res.ok) {
              const profile = await res.json()
              setIsAdmin(profile?.is_admin ?? false)
              setDepartment(profile?.department ?? null)
            }
          } catch {
            // perfil no disponible — botón Intranet no aparece
          }
        }
      }
      setAuthLoading(false)
    }
    init()
  }, [])

  const handleMicrosoftLogin = async () => {
    setLoading(true)
    setMsg('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile',
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      setMsg('Error: ' + error.message)
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  const displayName = user?.user_metadata?.full_name || user?.email || 'Usuario'
  const initials = getInitials(displayName)

  return (
    <div className="flex min-h-screen flex-col bg-tinta text-hueso lg:flex-row">

      {/* ── Fotografía del terreno ── */}
      <section className="relative h-56 shrink-0 overflow-hidden sm:h-72 lg:order-2 lg:h-auto lg:min-h-screen lg:flex-1">
        {BG_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0"
            style={{ opacity: i === bgIndex ? 1 : 0, transition: 'opacity 2s ease-in-out' }}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover object-center"
              priority={i === 0}
            />
          </div>
        ))}

        {/* Velo en tinta: funde la foto con el panel y deja leer el pie. */}
        <div className="absolute inset-0 bg-gradient-to-t from-tinta/85 via-tinta/15 to-tinta/10" />
        <div className="absolute inset-y-0 left-0 hidden w-40 bg-gradient-to-r from-tinta/70 to-transparent lg:block" />

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 px-8 pb-7 sm:px-12 lg:pb-10">
          <p className="hidden max-w-md font-display text-xl font-semibold leading-snug text-white sm:block lg:text-2xl">
            Restauramos la biodiversidad de los ecosistemas con especies forestales nativas
          </p>
          <div className="flex shrink-0 gap-1.5">
            {BG_IMAGES.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setBgIndex(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={`h-[2px] w-7 transition-colors ${i === bgIndex ? 'bg-ambar' : 'bg-hueso/35 hover:bg-hueso/60'}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Panel de identidad y acceso ──
          El ritmo vertical va en `vh`, no en tallas fijas: este panel lleva
          título, descripción, acceso, servicios, novedades y pie, y con los
          valores fijos de antes medía 1057 px — en un portátil de 768 px de
          alto, «Novedades» y el pie quedaban fuera de pantalla y tocaba hacer
          scroll para entrar. Ahora cada espacio se encoge con la pantalla, así
          que cabe completo tanto en un portátil como en un monitor grande, y
          crece hasta el tope de siempre cuando hay sitio. */}
      <section className="flex flex-col px-8 py-[clamp(0.875rem,2vh,2.5rem)] sm:px-12 lg:order-1 lg:min-h-screen lg:w-[44%] lg:py-[clamp(0.875rem,2vh,3rem)] xl:w-[40%] xl:px-16">
        <Firma />

        <div className="flex flex-1 flex-col justify-center py-[clamp(0.25rem,1vh,4rem)]">
          <div className="w-full max-w-md">
            <p className="mb-[clamp(0.5rem,1.4vh,1rem)] text-[10.5px] uppercase tracking-[.28em] text-taupe">Uso interno del equipo</p>
            <h1 className="font-display text-[clamp(2rem,4.6vh,3.75rem)] leading-[1.02] text-white">
              <span className="font-bold">Intranet</span>
              <br />
              <span className="font-thin">corporativa</span>
            </h1>
            <p className="mt-[clamp(0.75rem,2vh,1.5rem)] text-[clamp(0.8125rem,1.7vh,0.875rem)] font-light leading-relaxed text-hueso/75">
              Sistema de gestión interna para el equipo de Amazonia Emprende. Reserva vehículos
              corporativos, registra inspecciones de recepción y devolución, monitorea el avance de
              familias en procesos de restauración y conservación ambiental, y coordina el seguimiento
              ejecutivo del trabajo de campo — todo con acceso Microsoft 365.
            </p>

            {/* ── Acceso ── */}
            <div className="mt-[clamp(1rem,2.5vh,2.5rem)] border-t border-hueso/15 pt-[clamp(0.875rem,1.9vh,2rem)]">
              {authLoading && (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-taupe" size={22} />
                </div>
              )}

              {!authLoading && !user && (
                <>
                  <p className="mb-4 text-sm font-light text-hueso/70">
                    Entra con tu cuenta de Microsoft 365 de la organización.
                  </p>
                  <button
                    onClick={handleMicrosoftLogin}
                    disabled={loading}
                    className="flex w-full items-center gap-3 bg-hueso px-5 py-3.5 text-tinta transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 23 23" fill="none" aria-hidden="true">
                      <path fill="#F25022" d="M1 1H10V10H1V1Z" />
                      <path fill="#00A4EF" d="M1 12H10V21H1V12Z" />
                      <path fill="#7FBA00" d="M12 1H21V10H12V1Z" />
                      <path fill="#FFB900" d="M12 12H21V21H12V12Z" />
                    </svg>
                    <span className="flex-1 text-left text-[11px] font-medium uppercase tracking-[.16em]">
                      {loading ? 'Redirigiendo…' : 'Iniciar con Microsoft 365'}
                    </span>
                    {!loading && <ArrowRight size={16} className="shrink-0 opacity-50" />}
                  </button>

                  {msg && <p className="mt-4 border-l-2 border-red-400 pl-3 text-xs text-red-200">{msg}</p>}

                  <p className="mt-4 text-[10px] uppercase tracking-[.16em] text-hueso/40">
                    Solo personal autorizado
                  </p>
                </>
              )}

              {!authLoading && user && (
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center bg-bosque font-display text-lg font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9.5px] uppercase tracking-[.2em] text-taupe">Sesión activa</p>
                    <p className="truncate font-display text-[17px] font-semibold leading-tight text-white">
                      {displayName}
                    </p>
                    <p className="truncate text-xs font-light text-hueso/55">{user.email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    title="Cerrar sesión"
                    className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-[.16em] text-hueso/50 transition-colors hover:text-red-300"
                  >
                    <LogOut size={14} /> Salir
                  </button>
                </div>
              )}
            </div>

            {/* ── Servicios ── */}
            {!authLoading && (
              <nav className="mt-[clamp(0.625rem,1.7vh,2.25rem)]" aria-label="Servicios">
                <p className="mb-1 text-[10px] uppercase tracking-[.2em] text-taupe">Servicios</p>
                <div className="border-t border-hueso/15">
                  {/* Intranet — admins y usuarios con departamento */}
                  {user && (isAdmin || !!department) && (
                    <Fila
                      href="/intranet"
                      titulo="Intranet"
                      sub={isAdmin ? 'Panel de administración' : `Módulo ${department}`}
                      destacada
                    />
                  )}

                  {/* Calendario — siempre visible */}
                  <Fila href="/calendar" titulo="Calendario de vehículos" sub="Disponibilidad en tiempo real" />

                  {/* Validar Reserva */}
                  {user ? (
                    <Fila
                      href="/validar-reserva"
                      titulo="Validar mi reserva"
                      sub="Inspección de recepción y devolución"
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setValidarMsg(v => !v)}
                        className="flex w-full items-center gap-4 border-b border-hueso/15 py-[clamp(0.375rem,0.85vh,0.875rem)] text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-[15px] font-semibold text-hueso/45">Validar mi reserva</p>
                          <p className="text-[11.5px] font-light leading-tight text-hueso/35">Requiere inicio de sesión</p>
                        </div>
                        <ArrowRight size={15} className="shrink-0 text-hueso/20" />
                      </button>
                      {validarMsg && (
                        <p className="mt-3 border-l-2 border-ambar pl-3 text-xs font-light text-hueso/75">
                          Debes iniciar sesión primero para acceder a este servicio.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </nav>
            )}

            {/* ── Novedades del sistema ── */}
            <div className="mt-[clamp(0.625rem,1.8vh,2rem)]">
              <button
                onClick={() => setShowChangelog(v => !v)}
                className="flex w-full items-center justify-between text-[10px] uppercase tracking-[.2em] text-hueso/50 transition-colors hover:text-hueso/80"
              >
                <span>Novedades del sistema</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono normal-case tracking-normal text-hueso/70">v1.1</span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${showChangelog ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>

              {showChangelog && (
                <div className="mt-4 max-h-56 space-y-4 overflow-y-auto pr-1">
                  {CHANGELOG.map((entry, ei) => (
                    <div key={entry.version} className={ei > 0 ? 'border-t border-hueso/10 pt-3' : ''}>
                      <div className="mb-2 flex items-center gap-3">
                        <span className="font-mono text-xs text-hueso/85">{entry.version}</span>
                        <span className="text-[10px] text-hueso/40">{entry.date}</span>
                        <span className="inline-flex items-center gap-1.5 text-[10px] text-hueso/60">
                          <i
                            className={`inline-block h-[6px] w-[6px] ${entry.tipo === 'launch' ? 'bg-ambar' : 'bg-salvia'}`}
                          />
                          {entry.tipo === 'launch' ? 'Lanzamiento' : 'Mejoras'}
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {entry.cambios.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11.5px] font-light text-hueso/60">
                            <span className="shrink-0 text-hueso/35">—</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-hueso/10 pt-[clamp(0.75rem,1.6vh,1.5rem)] text-[10px] uppercase tracking-[.2em] text-hueso/40">
          <span className="font-display">Inspirar · Nutrir · Actuar</span>
          <span>© {new Date().getFullYear()}</span>
        </footer>
      </section>
    </div>
  )
}

/** Un servicio: nombre, para qué sirve y una flecha. Separado por filete. */
function Fila({
  href,
  titulo,
  sub,
  destacada = false,
}: {
  href: string
  titulo: string
  sub: string
  destacada?: boolean
}) {
  return (
    <Link href={href} className="group flex items-center gap-4 border-b border-hueso/15 py-[clamp(0.375rem,0.85vh,0.875rem)]">
      {destacada && <i className="h-8 w-[2px] shrink-0 bg-ambar" />}
      <div className="min-w-0 flex-1">
        <p className="font-display text-[15px] font-semibold text-white">{titulo}</p>
        <p className="text-[11.5px] font-light leading-tight text-hueso/55">{sub}</p>
      </div>
      <ArrowRight
        size={15}
        className="shrink-0 text-hueso/30 transition-all group-hover:translate-x-0.5 group-hover:text-ambar"
      />
    </Link>
  )
}
