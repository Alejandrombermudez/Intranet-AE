'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { CalendarRange, ScanLine, ArrowRight, LogOut, AlertCircle, Users, Sparkles, ChevronDown } from 'lucide-react'

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
    <div className="relative min-h-screen flex flex-col lg:flex-row overflow-hidden">

      {/* ── Fondo fotográfico con crossfade ── */}
      {BG_IMAGES.map((src, i) => (
        <div
          key={src}
          className="absolute inset-0"
          style={{
            opacity: i === bgIndex ? 1 : 0,
            transition: 'opacity 2s ease-in-out',
            zIndex: 0,
          }}
        >
          <Image
            src={src}
            alt=""
            fill
            className="object-cover object-center"
            priority={i === 0}
          />
        </div>
      ))}

      {/* ── Overlay oscuro direccional ── */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/30" style={{ zIndex: 1 }} />

      {/* ── ZONA IZQUIERDA: Identidad ── */}
      <div className="relative flex-1 flex flex-col justify-center items-center px-8 py-14 sm:px-12 lg:px-12 xl:px-20 lg:py-12 min-h-[55vh] lg:min-h-screen" style={{ zIndex: 2 }}>

        {/* Línea de acento */}
        <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-70" />

        {/* Borde inferior mobile */}
        <div className="absolute bottom-0 left-0 w-full h-px bg-white/10 lg:hidden" />

        <div className="relative w-full max-w-md xl:max-w-lg">

          {/* Label + Título */}
          <div className="mb-5">
            <p className="text-primary uppercase tracking-[0.25em] text-xs font-bold mb-4">
              Amazonia Emprende
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-black text-white leading-[1.02] tracking-tight">
              Intranet<br />
              <span className="text-white/45">Corporativa</span>
            </h1>
          </div>

          {/* Divisor */}
          <div className="w-12 h-1 bg-primary rounded-full mb-6" />

          {/* Descripción ampliada */}
          <p className="text-white/60 text-base lg:text-base xl:text-lg leading-relaxed mb-10">
            Sistema de gestión interna para el equipo de Amazonia Emprende.
            Reserva vehículos corporativos, registra inspecciones de recepción
            y devolución, monitorea el avance de familias en procesos de
            restauración y conservación ambiental, y coordina el seguimiento
            ejecutivo del trabajo de campo — todo con acceso Microsoft 365.
          </p>

          {/* Logo centrado */}
          <div className="w-full flex justify-center">
            <Image
              src="/icon-512.png"
              alt="Amazonia Emprende"
              width={84}
              height={84}
              className="rounded-2xl shadow-xl opacity-85"
            />
          </div>
        </div>

        {/* Copyright */}
        <div className="relative w-full max-w-md xl:max-w-lg mt-auto pt-10">
          <p className="text-white/30 text-sm">
            © {new Date().getFullYear()} Amazonia Emprende
          </p>
        </div>
      </div>

      {/* ── ZONA DERECHA: Card Glassmorphism ── */}
      <div
        className="relative flex-1 flex items-center justify-center px-8 py-10 sm:px-12 lg:px-12 xl:px-20 lg:py-12 min-h-[50vh] lg:min-h-screen"
        style={{ zIndex: 2 }}
      >
        <div className="w-full max-w-md xl:max-w-lg backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl p-8 xl:p-10">

          {/* Cargando sesión */}
          {authLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* SIN SESIÓN */}
          {!authLoading && !user && (
            <>
              <div className="mb-7">
                <h2 className="text-2xl font-black text-white mb-1.5">
                  Bienvenido de vuelta
                </h2>
                <p className="text-white/55 text-sm">
                  Accede con tu cuenta corporativa de Microsoft 365
                </p>
              </div>

              <button
                onClick={handleMicrosoftLogin}
                disabled={loading}
                className="w-full flex items-center gap-3 px-5 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-stone-800 to-stone-900 hover:from-black hover:to-stone-800 transition-all shadow-lg hover:shadow-xl border border-stone-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 23 23" fill="none">
                  <path fill="#F25022" d="M1 1H10V10H1V1Z"/>
                  <path fill="#00A4EF" d="M1 12H10V21H1V12Z"/>
                  <path fill="#7FBA00" d="M12 1H21V10H12V1Z"/>
                  <path fill="#FFB900" d="M12 12H21V21H12V12Z"/>
                </svg>
                <span className="flex-1 text-left">
                  {loading ? 'Redirigiendo...' : 'Iniciar con Microsoft 365'}
                </span>
                {!loading && <ArrowRight size={16} className="shrink-0 opacity-60" />}
              </button>

              {msg && (
                <div className="mt-4 p-3 rounded-lg text-xs text-center bg-red-500/20 text-red-200 border border-red-400/30">
                  {msg}
                </div>
              )}

              <p className="text-xs text-white/30 text-center mt-5">
                Solo para personal autorizado
              </p>
            </>
          )}

          {/* CON SESIÓN: bienvenida */}
          {!authLoading && user && (
            <>
              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-md">
                  <span className="text-xl font-black text-white tracking-tight">{initials}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-0.5">
                    Sesión activa
                  </p>
                  <p className="font-black text-white text-base leading-tight truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-white/40 truncate mt-0.5">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="w-full h-px bg-white/15 mb-4" />

              <p className="text-sm text-white/50 mb-4 leading-relaxed">
                Selecciona un servicio para continuar.
              </p>

              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 text-white/55 text-sm font-bold hover:border-red-400/40 hover:text-red-300 hover:bg-red-500/10 transition-all"
              >
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </>
          )}

          {/* ── Divisor Servicios ── */}
          {!authLoading && (
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-white/15" />
              <span className="text-[10px] font-bold text-white/35 uppercase tracking-widest whitespace-nowrap">
                Nuestros Servicios
              </span>
              <div className="flex-1 h-px bg-white/15" />
            </div>
          )}

          {/* ── Servicios ── */}
          {!authLoading && (
            <div className="space-y-3">

              {/* Calendario — siempre visible */}
              <Link
                href="/calendar"
                className="group flex items-center gap-4 w-full p-4 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 hover:border-primary/50 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors shrink-0">
                  <CalendarRange size={20} className="text-white/55 group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-bold text-white text-sm leading-tight">
                    Calendario de Vehículos
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    Disponibilidad en tiempo real
                  </p>
                </div>
                <ArrowRight size={15} className="text-white/25 group-hover:text-primary transition-colors shrink-0" />
              </Link>

              {/* Validar Reserva */}
              {user ? (
                <Link
                  href="/validar-reserva"
                  className="group flex items-center gap-4 w-full p-4 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 hover:border-primary/50 transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors shrink-0">
                    <ScanLine size={20} className="text-white/55 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-bold text-white text-sm leading-tight">
                      Validar mi Reserva
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      Inspección de recepción y devolución
                    </p>
                  </div>
                  <ArrowRight size={15} className="text-white/25 group-hover:text-primary transition-colors shrink-0" />
                </Link>
              ) : (
                <div>
                  <button
                    onClick={() => setValidarMsg(v => !v)}
                    className="group flex items-center gap-4 w-full p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-amber-500/10 hover:border-amber-400/30 transition-all duration-200"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center shrink-0">
                      <ScanLine size={20} className="text-white/30" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-bold text-white/45 text-sm leading-tight">
                        Validar mi Reserva
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">
                        Requiere inicio de sesión
                      </p>
                    </div>
                    <ArrowRight size={15} className="text-white/15 shrink-0" />
                  </button>
                  {validarMsg && (
                    <div className="mt-2 flex items-start gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/25">
                      <AlertCircle size={14} className="text-amber-300 shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-amber-200">
                        Debes iniciar sesión primero para acceder a este servicio.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Intranet — admins y usuarios con departamento */}
              {user && (isAdmin || !!department) && (
                <Link
                  href="/intranet"
                  className="group flex items-center gap-4 w-full p-4 rounded-xl border border-primary/40 bg-primary/15 hover:bg-primary/25 hover:border-primary/60 transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/25 group-hover:bg-primary/35 flex items-center justify-center transition-colors shrink-0">
                    <Users size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-bold text-white text-sm leading-tight">
                      Intranet
                    </p>
                    <p className="text-xs text-white/40 mt-0.5">
                      {isAdmin ? 'Panel de administración' : `Módulo ${department}`}
                    </p>
                  </div>
                  <ArrowRight size={15} className="text-primary/50 group-hover:text-primary transition-colors shrink-0" />
                </Link>
              )}
            </div>
          )}

          {/* ── Novedades del sistema ── */}
          <button
            onClick={() => setShowChangelog(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 mt-5 rounded-xl bg-white/[0.07] hover:bg-white/10 border border-white/10 transition-all"
          >
            <span className="flex items-center gap-2 text-xs font-bold text-white/65">
              <Sparkles size={12} className="text-white/70" />
              Novedades del sistema
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/85 bg-white/15 px-2 py-0.5 rounded-full border border-white/20">
                v1.1
              </span>
              <ChevronDown
                size={13}
                className={`text-white/50 transition-transform duration-200 ${showChangelog ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {showChangelog && (
            <div className="mt-3 space-y-4 max-h-56 overflow-y-auto pr-1">
              {CHANGELOG.map((entry, ei) => (
                <div key={entry.version} className={ei > 0 ? 'pt-3 border-t border-white/10' : ''}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-black text-white/85">{entry.version}</span>
                    <span className="text-[10px] text-white/40">{entry.date}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      entry.tipo === 'launch'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {entry.tipo === 'launch' ? '🚀 Lanzamiento' : 'Mejoras'}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {entry.cambios.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-white/55">
                        <span className="text-white/50 mt-px shrink-0">›</span>
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
  )
}
