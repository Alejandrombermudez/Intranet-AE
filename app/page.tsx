'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { CalendarRange, ScanLine, ArrowRight, LogOut, AlertCircle, Users } from 'lucide-react'

export default function LandingPage() {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [validarMsg, setValidarMsg] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [department, setDepartment] = useState<string | null>(null)

  //.

  // Verificar sesión al montar
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      setUser(u)
      if (u?.email) {
        const { data: profile } = await supabase
          .schema('people').from('user_profiles')
          .select('is_admin, department')
          .eq('email', u.email)
          .single()
        setIsAdmin(profile?.is_admin ?? false)
        setDepartment(profile?.department ?? null)
      }
      setAuthLoading(false)
    })
  }, [])

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
      setMsg('Error: ' + error.message)
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  // Iniciales del avatar
  const getInitials = (name: string) =>
    name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

  const displayName = user?.user_metadata?.full_name || user?.email || 'Usuario'
  const initials = getInitials(displayName)

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── LADO IZQUIERDO: Bienvenida ── */}
      <div className="relative flex-1 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 flex flex-col justify-center px-10 py-16 lg:px-16 lg:py-0 overflow-hidden">

        {/* Patrón de puntos decorativo */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1.5px 1.5px, white 1.5px, transparent 0)',
            backgroundSize: '36px 36px',
          }}
        />

        {/* Línea de acento vertical izquierda */}
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

        {/* Borde inferior en mobile */}
        <div className="absolute bottom-0 left-0 w-full h-1 bg-primary lg:hidden" />

        {/* Contenido principal */}
        <div className="relative z-10 max-w-lg">

          {/* Monograma AE */}
          <div className="mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30">
              <span className="text-2xl font-black text-primary tracking-tight">AE</span>
            </div>
          </div>

          {/* Título */}
          <div className="mb-6">
            <p className="text-primary uppercase tracking-[0.25em] text-xs font-bold mb-4">
              Amazonia Emprende
            </p>
            <h1 className="text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight">
              Intranet<br />
              <span className="text-stone-500">Corporativa</span>
            </h1>
          </div>

          {/* Divisor teal */}
          <div className="w-10 h-1 bg-primary rounded-full mb-7" />

          {/* Descripción */}
          <p className="text-stone-400 text-base leading-relaxed mb-10 max-w-sm">
            Tu plataforma centralizada de gestión interna. Administra reservas de
            vehículos corporativos y accede a los servicios del equipo desde un solo lugar.
          </p>

          {/* Bullets de servicios */}
          <div className="space-y-3">
            {[
              'Calendario de reservas en tiempo real',
              'Validación de reservas de vehículos',
              'Acceso exclusivo con Microsoft 365',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                </div>
                <span className="text-stone-400 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Copyright */}
        <p className="relative z-10 mt-auto pt-16 text-stone-700 text-xs lg:pt-12">
          © {new Date().getFullYear()} Amazonia Emprende
        </p>
      </div>

      {/* ── LADO DERECHO: Login / Bienvenida + Servicios ── */}
      <div className="flex-1 bg-stone-50 flex flex-col justify-center px-8 py-14 lg:px-16">
        <div className="max-w-sm mx-auto w-full">

          {/* ─── Card dinámica: Login ó Bienvenida ─── */}
          <div className="bg-white rounded-2xl shadow-xl border border-stone-200 p-8 mb-6 min-h-[180px] flex flex-col justify-center">

            {/* Cargando sesión */}
            {authLoading && (
              <div className="flex items-center justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* SIN SESIÓN */}
            {!authLoading && !user && (
              <>
                <div className="mb-7">
                  <h2 className="text-2xl font-black text-stone-900 mb-1.5">
                    Bienvenido de vuelta
                  </h2>
                  <p className="text-stone-500 text-sm">
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
                  <div className="mt-4 p-3 rounded-lg text-xs text-center bg-red-50 text-red-700 border border-red-200">
                    {msg}
                  </div>
                )}

                <p className="text-xs text-stone-400 text-center mt-5">
                  Solo para personal autorizado
                </p>
              </>
            )}

            {/* CON SESIÓN: tarjeta de bienvenida */}
            {!authLoading && user && (
              <>
                {/* Avatar + info */}
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-md">
                    <span className="text-xl font-black text-white tracking-tight">{initials}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-0.5">
                      Sesión activa
                    </p>
                    <p className="font-black text-stone-900 text-base leading-tight truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-stone-400 truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="w-full h-px bg-stone-100 mb-4" />

                <p className="text-sm text-stone-500 mb-4 leading-relaxed">
                  Selecciona un servicio para continuar.
                </p>

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-stone-200 text-stone-500 text-sm font-bold hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogOut size={15} />
                  Cerrar sesión
                </button>
              </>
            )}
          </div>

          {/* ─── Divisor Servicios ─── */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest whitespace-nowrap">
              Nuestros Servicios
            </span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          {/* ─── Botones de servicios ─── */}
          <div className="space-y-3">

            {/* Calendario — siempre funciona */}
            <Link
              href="/calendar"
              className="group flex items-center gap-4 w-full p-4 rounded-xl border-2 border-stone-200 bg-white hover:border-primary hover:bg-primary/5 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors shrink-0">
                <CalendarRange size={20} className="text-stone-500 group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-bold text-stone-800 text-sm leading-tight">
                  Calendario de Vehículos
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Disponibilidad en tiempo real
                </p>
              </div>
              <ArrowRight size={15} className="text-stone-300 group-hover:text-primary transition-colors shrink-0" />
            </Link>

            {/* Validar Reserva — solo navega si hay sesión */}
            {!authLoading && user ? (
              <Link
                href="/validar-reserva"
                className="group flex items-center gap-4 w-full p-4 rounded-xl border-2 border-stone-200 bg-white hover:border-primary hover:bg-primary/5 transition-all duration-200 shadow-sm hover:shadow-md"
              >
                <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors shrink-0">
                  <ScanLine size={20} className="text-stone-500 group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-bold text-stone-800 text-sm leading-tight">
                    Validar mi Reserva
                  </p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Inspección de recepción y devolución
                  </p>
                </div>
                <ArrowRight size={15} className="text-stone-300 group-hover:text-primary transition-colors shrink-0" />
              </Link>
            ) : (
              !authLoading && (
                <div>
                  <button
                    onClick={() => setValidarMsg((v) => !v)}
                    className="group flex items-center gap-4 w-full p-4 rounded-xl border-2 border-stone-200 bg-white hover:border-amber-300 hover:bg-amber-50/50 transition-all duration-200 shadow-sm"
                  >
                    <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-amber-100 flex items-center justify-center transition-colors shrink-0">
                      <ScanLine size={20} className="text-stone-400 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-bold text-stone-500 text-sm leading-tight">
                        Validar mi Reserva
                      </p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        Requiere inicio de sesión
                      </p>
                    </div>
                    <ArrowRight size={15} className="text-stone-200 shrink-0" />
                  </button>

                  {/* Mensaje inline */}
                  {validarMsg && (
                    <div className="mt-2 flex items-start gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-amber-700">
                        Debes iniciar sesión primero para acceder a este servicio.
                      </p>
                    </div>
                  )}
                </div>
              )
            )}

          {/* Intranet — admins y usuarios con departamento */}
          {!authLoading && user && (isAdmin || !!department) && (
            <Link
              href="/intranet"
              className="group flex items-center gap-4 w-full p-4 rounded-xl border-2 border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors shrink-0">
                <Users size={20} className="text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-bold text-stone-800 text-sm leading-tight">
                  Intranet
                </p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {isAdmin ? 'Panel de administración' : `Módulo ${department}`}
                </p>
              </div>
              <ArrowRight size={15} className="text-primary/50 group-hover:text-primary transition-colors shrink-0" />
            </Link>
          )}

          </div>
        </div>
      </div>

    </div>
  )
}
