'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Reservation } from '@/lib/types'
import { parsePurpose } from '@/lib/types'
import { VEHICLE_MAP } from '@/lib/vehicles'
import VehicleCalendar from '../components/VehicleCalendar'
import ReservationModal from '../components/ReservationModal'
import {
  Calendar, ScanLine, ArrowLeft, LogOut,
  Plus, Trash2, ClipboardList, Tag, Users,
} from 'lucide-react'

export default function CalendarPage() {
  // ── Auth ────────────────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [canAccessIntranet, setCanAccessIntranet] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  // ── Gestión de reservas (solo cuando hay sesión) ─────────────────────────
  const [myReservations, setMyReservations] = useState<Reservation[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [reservasTab, setReservasTab] = useState<'activas' | 'finalizadas'>('activas')

  // Verificar sesión al montar
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      setUser(u)
      if (u?.email) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('is_admin, can_access_intranet')
          .eq('email', u.email)
          .single()
        setIsAdmin(profile?.is_admin ?? false)
        setCanAccessIntranet(profile?.can_access_intranet ?? false)
      }
      setAuthLoading(false)
    })
  }, [])

  // Cargar mis reservas cuando hay usuario o se actualiza refreshKey
  useEffect(() => {
    if (user?.email) loadMyReservations(user.email)
  }, [user, refreshKey])

  const loadMyReservations = async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('vehicle_reservations')
        .select('*')
        .eq('user_email', email)
        .order('start_date', { ascending: true })
      if (error) throw error
      setMyReservations(data || [])
    } catch {
      // Error silencioso
    }
  }

  const confirmDelete = async (reservationId: string) => {
    setDeleteError('')
    try {
      const { error } = await supabase
        .from('vehicle_reservations')
        .delete()
        .eq('id', reservationId)
      if (error) throw error
      setDeleteTarget(null)
      setRefreshKey((k) => k + 1)
    } catch {
      setDeleteError('No se pudo eliminar la reserva. Intenta de nuevo.')
    }
  }

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
    setMyReservations([])
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailLoading(true)
    setEmailError('')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailInput,
      password: passwordInput,
    })
    if (error) {
      setEmailError('Correo o contraseña incorrectos')
      setEmailLoading(false)
      return
    }
    setUser(data.user)
    setShowEmailLogin(false)
    setEmailInput('')
    setPasswordInput('')
    // Cargar perfil del nuevo usuario
    if (data.user?.email) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('is_admin, can_access_intranet')
        .eq('email', data.user.email)
        .single()
      setIsAdmin(profile?.is_admin ?? false)
      setCanAccessIntranet(profile?.can_access_intranet ?? false)
    }
    setEmailLoading(false)
  }

  // Azure AD puede enviar el nombre en 'full_name' o en 'name'
  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || 'Usuario'
  const firstName = displayName.split(' ')[0]
  const initials = displayName
    .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">

      {/* ── Header ── */}
      <header className="bg-white shadow-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">

            {/* ← Inicio + Intranet (admin) */}
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:block">Inicio</span>
              </Link>

              {!authLoading && (isAdmin || canAccessIntranet) && (
                <Link
                  href="/intranet"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-primary border border-primary/30 bg-primary/5 hover:bg-primary/15 transition-all"
                >
                  <Users size={13} />
                  <span className="hidden sm:block">Intranet</span>
                </Link>
              )}
            </div>

            {/* Título */}
            <div className="text-center flex-1">
              <h1 className="text-2xl font-black text-stone-900 tracking-tight">
                Intranet Corporativa
              </h1>
              <p className="text-xs text-stone-500 uppercase tracking-widest mt-0.5 font-semibold">
                Amazonia Emprende
              </p>
            </div>

            {/* Auth area */}
            <div className="shrink-0 flex items-center gap-2">
              {authLoading && (
                <div className="w-8 h-8 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!authLoading && !user && (
                <div className="relative flex flex-col items-end gap-1">
                  {/* Microsoft SSO */}
                  <button
                    onClick={handleMicrosoftLogin}
                    disabled={loading}
                    className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-stone-800 to-stone-900 hover:from-black hover:to-stone-800 transition-all shadow-md border border-stone-700 disabled:opacity-60 text-sm"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23" fill="none">
                      <path fill="#F25022" d="M1 1H10V10H1V1Z"/>
                      <path fill="#00A4EF" d="M1 12H10V21H1V12Z"/>
                      <path fill="#7FBA00" d="M12 1H21V10H12V1Z"/>
                      <path fill="#FFB900" d="M12 12H21V21H12V12Z"/>
                    </svg>
                    <span className="hidden sm:block">
                      {loading ? 'Redirigiendo...' : 'Iniciar Sesión'}
                    </span>
                  </button>

                  {/* Acceso externo (email/contraseña) */}
                  <button
                    onClick={() => setShowEmailLogin((v) => !v)}
                    className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors underline-offset-2 hover:underline"
                  >
                    Acceso externo
                  </button>

                  {showEmailLogin && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-2xl shadow-2xl border border-stone-200 p-4 w-72 z-50">
                      <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Acceso con correo</p>
                      <form onSubmit={handleEmailLogin} className="space-y-2.5">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="correo@ejemplo.com"
                          required
                          className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-primary transition-colors"
                        />
                        <input
                          type="password"
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          placeholder="Contraseña"
                          required
                          className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:border-primary transition-colors"
                        />
                        {emailError && (
                          <p className="text-xs text-red-600 font-medium">{emailError}</p>
                        )}
                        <button
                          type="submit"
                          disabled={emailLoading}
                          className="w-full py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-all disabled:opacity-60"
                        >
                          {emailLoading ? 'Ingresando...' : 'Ingresar'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {!authLoading && user && (
                <>
                  {/* + Nueva Reserva */}
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark transition-all shadow-md text-sm"
                  >
                    <Plus size={16} />
                    <span className="hidden sm:block">Nueva Reserva</span>
                  </button>

                  {/* Nombre + Cerrar sesión */}
                  <div className="flex items-center gap-2">
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-stone-400 leading-none">Hola,</p>
                      <p className="text-sm font-black text-stone-900 leading-tight">{firstName}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      title="Cerrar sesión"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-stone-200 text-stone-500 text-xs font-bold hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      <LogOut size={14} />
                      <span className="hidden sm:block">Salir</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {msg && (
            <div className="mt-3 p-3 rounded-lg text-sm text-center bg-red-50 text-red-700 border border-red-200">
              {msg}
            </div>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* Banner informativo */}
        <div className="bg-primary text-white rounded-2xl p-6 mb-8 shadow-xl">
          <div className="flex items-start gap-4">
            <Calendar size={36} className="text-white/80 shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-black mb-2">
                Sistema de Reserva de Vehículos
              </h2>
              <p className="text-white/70 text-sm leading-relaxed">
                Consulta la disponibilidad de los vehículos corporativos en tiempo real.
                <span className="font-bold text-white"> Inicia sesión con tu cuenta de Microsoft 365</span> para
                gestionar y crear nuevas reservas.
              </p>
            </div>
          </div>
        </div>

        {/* ── Sección personal (solo con sesión) ── */}
        {!authLoading && user && (
          <>
            {/* Card de perfil */}
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-stone-200">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white text-xl font-black shrink-0 shadow-md">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-black text-stone-900 truncate">{displayName}</h2>
                  <p className="text-stone-500 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">Reservas activas</p>
                  <p className="text-3xl font-black text-primary">
                    {myReservations.filter((r) => new Date(r.end_date + 'T23:59:59') >= new Date()).length}
                  </p>
                </div>
              </div>
            </div>

            {/* Error de eliminación */}
            {deleteError && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 text-center">
                <p className="text-red-700 font-bold text-sm">{deleteError}</p>
              </div>
            )}

            {/* Mis Reservas — pestañas Activas / Finalizadas */}
            {myReservations.length > 0 && (() => {
              const activas = myReservations.filter(
                (r) => new Date(r.end_date + 'T23:59:59') >= new Date()
              )
              const finalizadas = myReservations.filter(
                (r) => new Date(r.end_date + 'T23:59:59') < new Date()
              )
              const lista = reservasTab === 'activas' ? activas : finalizadas

              return (
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-stone-200">
                  {/* Header con tabs */}
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h3 className="text-xl font-black text-stone-900 flex items-center gap-2">
                      <ClipboardList size={20} className="text-primary" />
                      Mis Reservas
                    </h3>
                    <div className="flex rounded-xl border-2 border-stone-200 overflow-hidden">
                      <button
                        onClick={() => setReservasTab('activas')}
                        className={`px-4 py-1.5 text-sm font-bold transition-colors ${
                          reservasTab === 'activas'
                            ? 'bg-primary text-white'
                            : 'text-stone-500 hover:bg-stone-50'
                        }`}
                      >
                        Activas
                        {activas.length > 0 && (
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                            reservasTab === 'activas' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-600'
                          }`}>{activas.length}</span>
                        )}
                      </button>
                      <button
                        onClick={() => setReservasTab('finalizadas')}
                        className={`px-4 py-1.5 text-sm font-bold transition-colors border-l-2 border-stone-200 ${
                          reservasTab === 'finalizadas'
                            ? 'bg-stone-700 text-white'
                            : 'text-stone-500 hover:bg-stone-50'
                        }`}
                      >
                        Finalizadas
                        {finalizadas.length > 0 && (
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                            reservasTab === 'finalizadas' ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-600'
                          }`}>{finalizadas.length}</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Lista */}
                  {lista.length === 0 ? (
                    <div className="py-8 text-center text-stone-400">
                      <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-semibold">
                        {reservasTab === 'activas'
                          ? 'No tienes reservas activas.'
                          : 'No hay reservas finalizadas.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {lista.map((reservation) => {
                        const vehicle = VEHICLE_MAP[reservation.vehicle_id]
                        const { project, activity } = parsePurpose(reservation.purpose || '')
                        const startDate = new Date(reservation.start_date + 'T12:00:00').toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })
                        const endDate = new Date(reservation.end_date + 'T12:00:00').toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })
                        const IconComponent = vehicle?.icon
                        const isPast = reservasTab === 'finalizadas'

                        return (
                          <div
                            key={reservation.id}
                            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                              isPast
                                ? 'border-stone-200 bg-stone-50'
                                : 'hover:shadow-md'
                            }`}
                            style={{ borderColor: isPast ? undefined : vehicle?.color }}
                          >
                            {IconComponent && (
                              <IconComponent
                                size={26}
                                style={{ color: isPast ? '#a8a29e' : vehicle?.color }}
                                className="shrink-0"
                              />
                            )}

                            <div className="flex-1 min-w-0">
                              <p className={`font-bold ${isPast ? 'text-stone-500' : 'text-stone-900'}`}>
                                {reservation.vehicle_name}
                              </p>
                              {(activity || project) && (
                                <div className="flex items-center gap-1.5 my-0.5 flex-wrap">
                                  <Tag size={12} className="text-stone-400" />
                                  <span className="text-xs font-medium text-stone-600">
                                    {activity || 'Sin detalle'}
                                  </span>
                                  {project && (
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                                      {project}
                                    </span>
                                  )}
                                </div>
                              )}
                              <p className={`text-sm ${isPast ? 'text-stone-400' : 'text-stone-500'}`}>
                                {startDate} → {endDate}
                              </p>
                            </div>

                            {!isPast && (
                              <>
                                {deleteTarget === reservation.id ? (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs text-stone-500 font-medium">¿Eliminar?</span>
                                    <button
                                      onClick={() => confirmDelete(reservation.id)}
                                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-all"
                                    >
                                      Sí
                                    </button>
                                    <button
                                      onClick={() => setDeleteTarget(null)}
                                      className="px-3 py-1.5 border border-stone-300 text-stone-600 rounded-lg font-bold text-sm hover:bg-stone-100 transition-all"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteTarget(reservation.id)}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border-2 border-red-200 rounded-lg font-bold text-sm hover:bg-red-100 transition-all shrink-0"
                                  >
                                    <Trash2 size={14} />
                                    <span className="hidden sm:block">Eliminar</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
          </>
        )}

        {/* Calendario */}
        <VehicleCalendar key={refreshKey} />

        {/* ── Sección inferior — dinámica según sesión ── */}
        <div className="mt-12 bg-white rounded-2xl shadow-xl p-8 border border-stone-200">

          {authLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Sin sesión */}
          {!authLoading && !user && (
            <div className="text-center max-w-md mx-auto">
              <h3 className="text-xl font-black text-stone-900 mb-2">
                ¿Necesitas gestionar reservas?
              </h3>
              <p className="text-stone-500 text-sm mb-6">
                Accede con tu cuenta corporativa para crear, modificar o eliminar reservas de vehículos.
              </p>

              <button
                onClick={handleMicrosoftLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 p-4 rounded-xl font-bold text-white bg-gradient-to-r from-stone-800 to-stone-900 hover:from-black hover:to-stone-800 transition-all shadow-lg border border-stone-700 mb-4"
              >
                <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none">
                  <path fill="#F25022" d="M1 1H10V10H1V1Z"/>
                  <path fill="#00A4EF" d="M1 12H10V21H1V12Z"/>
                  <path fill="#7FBA00" d="M12 1H21V10H12V1Z"/>
                  <path fill="#FFB900" d="M12 12H21V21H12V12Z"/>
                </svg>
                {loading ? 'Redirigiendo a Microsoft...' : 'Iniciar con Microsoft 365'}
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-stone-200" />
                <span className="text-xs text-stone-400 font-bold uppercase tracking-widest">o</span>
                <div className="flex-1 h-px bg-stone-200" />
              </div>

              <Link
                href="/validar-reserva"
                className="group flex items-center gap-4 w-full p-4 rounded-xl border-2 border-stone-200 hover:border-primary hover:bg-primary/5 transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-primary/10 flex items-center justify-center transition-colors shrink-0">
                  <ScanLine size={20} className="text-stone-500 group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-stone-800 text-sm leading-tight">Validar mi Reserva</p>
                  <p className="text-xs text-stone-400 mt-0.5">Inspección de recepción y devolución</p>
                </div>
              </Link>

              <p className="text-xs text-stone-400 mt-4">
                Ingreso exclusivo para personal autorizado de Amazonia Emprende
              </p>
            </div>
          )}

          {/* Con sesión */}
          {!authLoading && user && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <ScanLine size={26} className="text-primary" />
              </div>
              <h3 className="text-xl font-black text-stone-900 mb-2">
                ¿Tienes un vehículo para recibir o entregar hoy?
              </h3>
              <p className="text-stone-500 text-sm mb-6">
                Completa la inspección vehicular de recepción o devolución desde aquí.
              </p>
              <Link
                href="/validar-reserva"
                className="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark transition-all shadow-md"
              >
                <ScanLine size={18} />
                Validar mi Reserva
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center text-stone-500 text-sm">
          <p className="font-semibold">
            &copy; {new Date().getFullYear()} Amazonia Emprende — Todos los derechos reservados
          </p>
        </div>
      </footer>

      {/* ── Modal de nueva reserva (solo con sesión) ── */}
      {user && (
        <ReservationModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          userName={displayName}
          userEmail={user.email || ''}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  )
  
}
