'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Loader2, Plus, Trash2, CalendarDays,
  Clock, CheckCircle2, XCircle, Search, ChevronRight,
  X, Users, BookOpen, Briefcase, User, Lock, CheckCheck,
  Ticket,
} from 'lucide-react'
import type { IntranetUser, SesionConPersona, Indicacion, EstadoIndicacion } from '@/lib/types'

const PRIMARY = '#0d7377'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(' ')
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

function formatFecha(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ─── Configuración de estados por bloque ──────────────────────────────────────

const ESTADO_EJECUTIVO_CONFIG: Record<string, { label: string; className: string; icon: ReactNode }> = {
  pendiente: {
    label: 'Pendiente',
    className: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    icon: <Clock size={11} />,
  },
  hecho: {
    label: 'Hecho',
    className: 'bg-teal-100 text-teal-700 hover:bg-teal-200',
    icon: <CheckCircle2 size={11} />,
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-stone-100 text-stone-400 hover:bg-stone-200',
    icon: <XCircle size={11} />,
  },
}

const NEXT_ESTADO_EJECUTIVO: Record<string, EstadoIndicacion> = {
  pendiente: 'hecho',
  hecho: 'cancelado',
  cancelado: 'pendiente',
}

const ESTADO_COLABORADOR_CONFIG: Record<string, { label: string; className: string; icon: ReactNode }> = {
  pendiente: {
    label: 'Pendiente',
    className: 'bg-stone-100 text-stone-500',
    icon: <Clock size={11} />,
  },
  marcado: {
    label: 'Realizado ✓',
    className: 'bg-amber-100 text-amber-700',
    icon: <CheckCircle2 size={11} />,
  },
  confirmado: {
    label: 'Confirmado',
    className: 'bg-violet-100 text-violet-700',
    icon: <CheckCheck size={11} />,
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-stone-100 text-stone-400',
    icon: <XCircle size={11} />,
  },
}

// ─── IndicacionItem Ejecutivo ──────────────────────────────────────────────────

function IndicacionItemEjecutivo({
  ind, token, onUpdate, onDelete,
}: {
  ind: Indicacion; token: string
  onUpdate: (u: Indicacion) => void; onDelete: (id: string) => void
}) {
  const [saving, setSaving] = useState(false)

  const cycleEstado = async () => {
    const next = NEXT_ESTADO_EJECUTIVO[ind.estado] ?? 'pendiente'
    const prev = ind.estado
    onUpdate({ ...ind, estado: next })
    setSaving(true)
    try {
      const res = await fetch(`/api/ejecutivo/indicaciones/${ind.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado: next }),
      })
      if (!res.ok) onUpdate({ ...ind, estado: prev })
    } catch {
      onUpdate({ ...ind, estado: prev })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    onDelete(ind.id)
    await fetch(`/api/ejecutivo/indicaciones/${ind.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  const cfg = ESTADO_EJECUTIVO_CONFIG[ind.estado] ?? ESTADO_EJECUTIVO_CONFIG.pendiente

  return (
    <div className="flex items-start gap-2 py-1.5 group/ind">
      <button
        onClick={cycleEstado}
        disabled={saving}
        title="Cambiar estado"
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 mt-0.5 ${cfg.className}`}
      >
        {saving ? <Loader2 size={11} className="animate-spin" /> : cfg.icon}
        {cfg.label}
      </button>
      <span className={`text-sm text-stone-700 flex-1 leading-snug ${ind.estado === 'cancelado' ? 'line-through text-stone-400' : ''}`}>
        {ind.descripcion}
      </span>
      {ind.plataforma && (
        <span className="text-[11px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-mono whitespace-nowrap shrink-0">
          {ind.plataforma}
        </span>
      )}
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover/ind:opacity-100 text-stone-300 hover:text-red-400 transition-all shrink-0"
        title="Eliminar"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── IndicacionItem Colaborador ────────────────────────────────────────────────

function IndicacionItemColaborador({
  ind, token, onUpdate, onDelete,
}: {
  ind: Indicacion; token: string
  onUpdate: (u: Indicacion) => void; onDelete: (id: string) => void
}) {
  const [saving, setSaving] = useState(false)

  const confirmar = async () => {
    if (ind.estado !== 'marcado' || saving) return
    const prev = ind.estado
    onUpdate({ ...ind, estado: 'confirmado' })
    setSaving(true)
    try {
      const res = await fetch(`/api/ejecutivo/indicaciones/${ind.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado: 'confirmado' }),
      })
      if (!res.ok) onUpdate({ ...ind, estado: prev })
    } catch {
      onUpdate({ ...ind, estado: prev })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    onDelete(ind.id)
    await fetch(`/api/ejecutivo/indicaciones/${ind.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  const cfg = ESTADO_COLABORADOR_CONFIG[ind.estado] ?? ESTADO_COLABORADOR_CONFIG.pendiente

  return (
    <div className="flex items-start gap-2 py-1.5 group/ind">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap shrink-0 mt-0.5 ${cfg.className}`}>
        {cfg.icon}
        {cfg.label}
      </span>
      <span className={`text-sm text-stone-700 flex-1 leading-snug ${ind.estado === 'cancelado' ? 'line-through text-stone-400' : ind.estado === 'confirmado' ? 'text-stone-400' : ''}`}>
        {ind.descripcion}
      </span>
      {ind.plataforma && (
        <span className="text-[11px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-mono whitespace-nowrap shrink-0">
          {ind.plataforma}
        </span>
      )}
      {/* Botón confirmar: solo visible cuando colaborador ya marcó como realizado */}
      {ind.estado === 'marcado' && (
        <button
          onClick={confirmar}
          disabled={saving}
          title="Confirmar como completado"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors shrink-0 whitespace-nowrap"
        >
          {saving ? <Loader2 size={10} className="animate-spin" /> : <CheckCheck size={10} />}
          Confirmar
        </button>
      )}
      <button
        onClick={handleDelete}
        className="opacity-0 group-hover/ind:opacity-100 text-stone-300 hover:text-red-400 transition-all shrink-0"
        title="Eliminar"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── SesionCard ───────────────────────────────────────────────────────────────

function SesionCard({
  sesion, token, myProfileId,
  onDelete, onClose,
  onAddIndicacion, onUpdateIndicacion, onDeleteIndicacion,
}: {
  sesion: SesionConPersona
  token: string
  myProfileId: string
  onDelete: (id: string) => void
  onClose: (id: string) => void
  onAddIndicacion: (sesionId: string, bloque: 'ejecutivo' | 'colaborador') => void
  onUpdateIndicacion: (ind: Indicacion) => void
  onDeleteIndicacion: (sesionId: string, indId: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const indsEjecutivo = sesion.indicaciones.filter(i => i.bloque === 'ejecutivo')
  const indsColaborador = sesion.indicaciones.filter(i => i.bloque === 'colaborador')

  const hechos = [
    ...indsEjecutivo.filter(i => i.estado === 'hecho'),
    ...indsColaborador.filter(i => i.estado === 'confirmado'),
  ].length
  const total = sesion.indicaciones.length

  const esTicket = sesion.iniciado_por !== sesion.ejecutivo_id

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    onDelete(sesion.id)
    await fetch(`/api/ejecutivo/sesiones/${sesion.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  const handleClose = async () => {
    if (!confirmClose) { setConfirmClose(true); return }
    onClose(sesion.id)
    await fetch(`/api/ejecutivo/sesiones/${sesion.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ cerrada: true }),
    })
  }

  const cardBg = sesion.cerrada ? 'bg-stone-50' : 'bg-white'

  return (
    <div className={`${cardBg} rounded-xl border border-stone-200 shadow-sm overflow-hidden`}>
      {/* Header sesión */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <CalendarDays size={16} className="mt-0.5 shrink-0" style={{ color: PRIMARY }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-start gap-2 flex-wrap">
                <p className="font-bold text-stone-900 text-sm leading-snug">{sesion.titulo}</p>
                {esTicket && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full shrink-0">
                    <Ticket size={9} /> TICKET
                  </span>
                )}
                {sesion.cerrada && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-stone-200 text-stone-500 px-1.5 py-0.5 rounded-full shrink-0">
                    <Lock size={9} /> CERRADA
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {total > 0 && (
                  <span className="text-xs text-stone-400 mr-1">{hechos}/{total}</span>
                )}
                {!sesion.cerrada && (
                  <button
                    onClick={handleClose}
                    onMouseLeave={() => setConfirmClose(false)}
                    className={`p-1.5 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 ${confirmClose ? 'bg-amber-100 text-amber-600' : 'text-stone-300 hover:text-amber-500 hover:bg-amber-50'}`}
                    title={confirmClose ? 'Confirmar cierre' : 'Cerrar sesión'}
                  >
                    <Lock size={13} />
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  onMouseLeave={() => setConfirmDelete(false)}
                  className={`p-1.5 rounded-lg transition-colors ${confirmDelete ? 'bg-red-100 text-red-500' : 'text-stone-300 hover:text-red-400 hover:bg-red-50'}`}
                  title={confirmDelete ? 'Confirmar eliminación' : 'Eliminar sesión'}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">{formatFecha(sesion.fecha)}</p>
            {sesion.notas && (
              <p className="text-xs text-stone-500 italic mt-1.5 leading-relaxed">{sesion.notas}</p>
            )}
          </div>
        </div>
      </div>

      {/* Bloque Ejecutivo */}
      <div className="border-t border-stone-100 mx-4" />
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-teal-50 rounded-md">
            <Briefcase size={11} className="text-teal-600" />
            <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wide">Ejecutivo</span>
          </div>
        </div>
        {indsEjecutivo.length > 0 ? (
          <div className="space-y-0.5 mb-2">
            {indsEjecutivo.map(ind => (
              <IndicacionItemEjecutivo
                key={ind.id}
                ind={ind}
                token={token}
                onUpdate={onUpdateIndicacion}
                onDelete={(id) => onDeleteIndicacion(sesion.id, id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-300 mb-2">Sin tareas para el ejecutivo.</p>
        )}
        {!sesion.cerrada && (
          <button
            onClick={() => onAddIndicacion(sesion.id, 'ejecutivo')}
            className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-800 transition-colors"
          >
            <Plus size={12} /> Agregar tarea ejecutivo
          </button>
        )}
      </div>

      {/* Bloque Colaborador */}
      <div className="border-t border-stone-100 mx-4 mt-1" />
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-violet-50 rounded-md">
            <User size={11} className="text-violet-600" />
            <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">Colaborador</span>
          </div>
        </div>
        {indsColaborador.length > 0 ? (
          <div className="space-y-0.5 mb-2">
            {indsColaborador.map(ind => (
              <IndicacionItemColaborador
                key={ind.id}
                ind={ind}
                token={token}
                onUpdate={onUpdateIndicacion}
                onDelete={(id) => onDeleteIndicacion(sesion.id, id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-300 mb-2">Sin tareas para el colaborador.</p>
        )}
        {!sesion.cerrada && (
          <button
            onClick={() => onAddIndicacion(sesion.id, 'colaborador')}
            className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-800 transition-colors"
          >
            <Plus size={12} /> Agregar tarea colaborador
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-stone-900 text-base">{title}</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function inputCls() {
  return 'w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0d7377]/40 focus:border-[#0d7377] transition-colors'
}

function labelCls() {
  return 'block text-xs font-semibold text-stone-500 mb-1'
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function EjecutivoPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [myProfileId, setMyProfileId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const [users, setUsers] = useState<IntranetUser[]>([])
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<IntranetUser | null>(null)

  const [sessions, setSessions] = useState<SesionConPersona[]>([])
  const [activeTab, setActiveTab] = useState<'activas' | 'historico'>('activas')
  const [loadingSessions, setLoadingSessions] = useState(false)

  const [showSessionModal, setShowSessionModal] = useState(false)
  const [sesionForm, setSesionForm] = useState({ titulo: '', fecha: new Date().toISOString().split('T')[0], notas: '' })
  const [savingSession, setSavingSession] = useState(false)

  // indicacionModal: { sesionId, bloque }
  const [indicacionModal, setIndicacionModal] = useState<{ sesionId: string; bloque: 'ejecutivo' | 'colaborador' } | null>(null)
  const [indForm, setIndForm] = useState({ descripcion: '', plataforma: '' })
  const [savingInd, setSavingInd] = useState(false)

  // ── Auth ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/'); return }
      setToken(session.access_token)

      const res = await fetch('/api/users/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) { router.push('/intranet'); return }
      const profile = await res.json()

      if (!profile?.is_admin && profile?.department !== 'Ejecutivo') {
        router.push('/intranet'); return
      }
      setMyProfileId(profile.id)
      setReady(true)
    }
    init()
  }, [router])

  // ── Carga de usuarios ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!token || !ready) return
    fetch('/api/ejecutivo/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setUsers(data) })
  }, [token, ready])

  // ── Carga de sesiones ───────────────────────────────────────────────────────

  const loadSessions = useCallback(async (personaId: string) => {
    if (!token) return
    setLoadingSessions(true)
    try {
      const res = await fetch(`/api/ejecutivo/sesiones?persona_id=${personaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setSessions(Array.isArray(data) ? data : [])
    } finally {
      setLoadingSessions(false)
    }
  }, [token])

  const handleSelectUser = (user: IntranetUser) => {
    setSelectedUser(user)
    setSessions([])
    setActiveTab('activas')
    loadSessions(user.id)
  }

  // ── Filtro de tabs ──────────────────────────────────────────────────────────

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const filteredSessions = sessions.filter(s => {
    if (activeTab === 'activas') return !s.cerrada && s.fecha >= cutoffStr
    return s.cerrada || s.fecha < cutoffStr
  })

  // ── Crear sesión ────────────────────────────────────────────────────────────

  const handleCreateSession = async () => {
    if (!selectedUser || !sesionForm.titulo || !sesionForm.fecha || !token) return
    setSavingSession(true)
    try {
      const res = await fetch('/api/ejecutivo/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          persona_id: selectedUser.id,
          titulo: sesionForm.titulo,
          fecha: sesionForm.fecha,
          notas: sesionForm.notas || null,
        }),
      })
      if (res.ok) {
        setShowSessionModal(false)
        setSesionForm({ titulo: '', fecha: new Date().toISOString().split('T')[0], notas: '' })
        await loadSessions(selectedUser.id)
      }
    } finally {
      setSavingSession(false)
    }
  }

  // ── Crear indicación ────────────────────────────────────────────────────────

  const handleCreateIndicacion = async () => {
    if (!indicacionModal || !indForm.descripcion || !token) return
    setSavingInd(true)
    try {
      const res = await fetch(`/api/ejecutivo/sesiones/${indicacionModal.sesionId}/indicaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          descripcion: indForm.descripcion,
          plataforma: indForm.plataforma || null,
          bloque: indicacionModal.bloque,
        }),
      })
      if (res.ok) {
        const newInd = await res.json()
        setSessions(prev => prev.map(s =>
          s.id === indicacionModal.sesionId
            ? { ...s, indicaciones: [...s.indicaciones, newInd] }
            : s
        ))
        setIndicacionModal(null)
        setIndForm({ descripcion: '', plataforma: '' })
      }
    } finally {
      setSavingInd(false)
    }
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleUpdateIndicacion = (updated: Indicacion) => {
    setSessions(prev => prev.map(s => ({
      ...s,
      indicaciones: s.indicaciones.map(i => i.id === updated.id ? updated : i),
    })))
  }

  const handleDeleteIndicacion = (sesionId: string, indId: string) => {
    setSessions(prev => prev.map(s =>
      s.id === sesionId
        ? { ...s, indicaciones: s.indicaciones.filter(i => i.id !== indId) }
        : s
    ))
  }

  const handleDeleteSession = (sesionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sesionId))
  }

  const handleCloseSession = (sesionId: string) => {
    setSessions(prev => prev.map(s => s.id === sesionId ? { ...s, cerrada: true } : s))
  }

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase()
    return (
      (u.full_name?.toLowerCase().includes(q) ?? false) ||
      u.email.toLowerCase().includes(q)
    )
  })

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-stone-400" />
      </div>
    )
  }

  const indicacionModalTitle = indicacionModal?.bloque === 'colaborador'
    ? 'Agregar tarea — Colaborador'
    : 'Agregar tarea — Ejecutivo'

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col">

      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push('/intranet')}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-px h-5 bg-stone-200" />
          <BookOpen size={16} style={{ color: PRIMARY }} />
          <span className="font-bold text-stone-900 text-sm">Panel Ejecutivo</span>
          <span className="text-stone-300 text-xs ml-1">— Seguimiento de Sesiones</span>
        </div>
      </header>

      {/* Layout principal */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">

        {/* Panel izquierdo: lista de usuarios */}
        <aside className="hidden lg:flex flex-col w-72 border-r border-stone-200 bg-white sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-4 border-b border-stone-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">
              <Users size={13} /> Personas
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#0d7377]/40 focus:border-[#0d7377] transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 py-2">
            {filteredUsers.map(user => {
              const isMe = user.id === myProfileId
              const isSelected = selectedUser?.id === user.id
              return (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2 ${
                    isSelected
                      ? 'border-l-[#0d7377] bg-[#0d7377]/5'
                      : 'border-l-transparent hover:bg-stone-50'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {getInitials(user.full_name, user.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-stone-800 truncate">
                        {user.full_name ?? user.email}
                      </p>
                      {isMe && (
                        <span className="text-[10px] bg-[#0d7377]/10 text-[#0d7377] px-1.5 py-0.5 rounded-full font-bold shrink-0">
                          Yo
                        </span>
                      )}
                    </div>
                    {user.department && (
                      <p className="text-xs text-stone-400 truncate">{user.department}</p>
                    )}
                  </div>
                  {isSelected && <ChevronRight size={14} style={{ color: PRIMARY }} className="shrink-0" />}
                </button>
              )
            })}
          </div>
        </aside>

        {/* Panel derecho: sesiones */}
        <main className="flex-1 p-6 min-w-0">

          {/* Selector móvil */}
          <div className="lg:hidden mb-4">
            <select
              className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#0d7377]/40"
              value={selectedUser?.id ?? ''}
              onChange={e => {
                const user = users.find(u => u.id === e.target.value)
                if (user) handleSelectUser(user)
              }}
            >
              <option value="">— Seleccionar persona —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name ?? u.email}{u.id === myProfileId ? ' (Yo)' : ''}
                </option>
              ))}
            </select>
          </div>

          {!selectedUser ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-stone-300">
              <Users size={48} strokeWidth={1.2} />
              <p className="text-sm font-medium text-stone-400">Selecciona una persona para ver sus sesiones</p>
            </div>
          ) : (
            <>
              {/* Cabecera de persona seleccionada */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {getInitials(selectedUser.full_name, selectedUser.email)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-stone-900">
                        {selectedUser.full_name ?? selectedUser.email}
                      </h2>
                      {selectedUser.id === myProfileId && (
                        <span className="text-[11px] bg-[#0d7377]/10 text-[#0d7377] px-2 py-0.5 rounded-full font-bold">
                          Yo
                        </span>
                      )}
                    </div>
                    {selectedUser.department && (
                      <p className="text-xs text-stone-400">{selectedUser.department}</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSesionForm({ titulo: '', fecha: new Date().toISOString().split('T')[0], notas: '' })
                    setShowSessionModal(true)
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Plus size={15} /> Nueva Sesión
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-stone-200 mb-6">
                {(['activas', 'historico'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 px-3 text-sm font-bold border-b-2 transition-colors capitalize ${
                      activeTab === tab
                        ? 'border-[#0d7377] text-[#0d7377]'
                        : 'border-transparent text-stone-400 hover:text-stone-700'
                    }`}
                  >
                    {tab === 'activas' ? 'Activas' : 'Histórico'}
                  </button>
                ))}
              </div>

              {/* Sesiones */}
              {loadingSessions ? (
                <div className="flex items-center justify-center py-16 gap-2 text-stone-400">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Cargando sesiones...</span>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-300">
                  <CalendarDays size={40} strokeWidth={1.2} />
                  <p className="text-sm font-medium text-stone-400">
                    {activeTab === 'activas' ? 'No hay sesiones activas.' : 'No hay sesiones en el histórico.'}
                  </p>
                  {activeTab === 'activas' && (
                    <button
                      onClick={() => {
                        setSesionForm({ titulo: '', fecha: new Date().toISOString().split('T')[0], notas: '' })
                        setShowSessionModal(true)
                      }}
                      className="text-sm font-semibold transition-colors"
                      style={{ color: PRIMARY }}
                    >
                      + Crear primera sesión
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSessions.map(s => (
                    <SesionCard
                      key={s.id}
                      sesion={s}
                      token={token!}
                      myProfileId={myProfileId!}
                      onDelete={handleDeleteSession}
                      onClose={handleCloseSession}
                      onAddIndicacion={(sesionId, bloque) => {
                        setIndicacionModal({ sesionId, bloque })
                        setIndForm({ descripcion: '', plataforma: '' })
                      }}
                      onUpdateIndicacion={handleUpdateIndicacion}
                      onDeleteIndicacion={handleDeleteIndicacion}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal: Nueva Sesión */}
      {showSessionModal && selectedUser && (
        <Modal title="Nueva Sesión" onClose={() => setShowSessionModal(false)}>
          <div className="space-y-4">
            <div>
              <label className={labelCls()}>Persona</label>
              <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 rounded-lg border border-stone-200 text-sm text-stone-600">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {getInitials(selectedUser.full_name, selectedUser.email)}
                </div>
                {selectedUser.full_name ?? selectedUser.email}
                {selectedUser.id === myProfileId && (
                  <span className="text-[10px] bg-[#0d7377]/10 text-[#0d7377] px-1.5 py-0.5 rounded-full font-bold ml-1">Yo</span>
                )}
              </div>
            </div>
            <div>
              <label className={labelCls()}>Título <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={sesionForm.titulo}
                onChange={e => setSesionForm(p => ({ ...p, titulo: e.target.value }))}
                placeholder="ej: Reunión de seguimiento — ajustes plataformas"
                className={inputCls()}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls()}>Fecha <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={sesionForm.fecha}
                onChange={e => setSesionForm(p => ({ ...p, fecha: e.target.value }))}
                className={inputCls()}
              />
            </div>
            <div>
              <label className={labelCls()}>Notas (opcional)</label>
              <textarea
                value={sesionForm.notas}
                onChange={e => setSesionForm(p => ({ ...p, notas: e.target.value }))}
                placeholder="Contexto general de la sesión..."
                rows={3}
                className={`${inputCls()} resize-none`}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowSessionModal(false)}
                className="flex-1 py-2 rounded-lg border border-stone-200 text-sm font-semibold text-stone-500 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateSession}
                disabled={savingSession || !sesionForm.titulo || !sesionForm.fecha}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ backgroundColor: PRIMARY }}
              >
                {savingSession ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Crear Sesión
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Nueva Indicación */}
      {indicacionModal && (
        <Modal title={indicacionModalTitle} onClose={() => setIndicacionModal(null)}>
          <div className="space-y-4">
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold ${
              indicacionModal.bloque === 'colaborador'
                ? 'bg-violet-50 text-violet-700'
                : 'bg-teal-50 text-teal-700'
            }`}>
              {indicacionModal.bloque === 'colaborador'
                ? <><User size={12} /> Tarea para el colaborador</>
                : <><Briefcase size={12} /> Tarea para el ejecutivo</>
              }
            </div>
            <div>
              <label className={labelCls()}>Descripción <span className="text-red-400">*</span></label>
              <textarea
                value={indForm.descripcion}
                onChange={e => setIndForm(p => ({ ...p, descripcion: e.target.value }))}
                placeholder="ej: Actualizar el manual de usuario en Notion con los nuevos flujos..."
                rows={3}
                className={`${inputCls()} resize-none`}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls()}>Plataforma (opcional)</label>
              <input
                type="text"
                value={indForm.plataforma}
                onChange={e => setIndForm(p => ({ ...p, plataforma: e.target.value }))}
                placeholder="ej: Notion, Slack, WhatsApp, Drive..."
                className={inputCls()}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setIndicacionModal(null)}
                className="flex-1 py-2 rounded-lg border border-stone-200 text-sm font-semibold text-stone-500 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateIndicacion}
                disabled={savingInd || !indForm.descripcion}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                  indicacionModal.bloque === 'colaborador' ? 'bg-violet-600 hover:bg-violet-700' : ''
                }`}
                style={indicacionModal.bloque !== 'colaborador' ? { backgroundColor: PRIMARY } : {}}
              >
                {savingInd ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Agregar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
