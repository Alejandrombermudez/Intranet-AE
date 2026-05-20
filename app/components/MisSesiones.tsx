'use client'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  CalendarDays, Loader2, Clock, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Briefcase, User, Plus, X,
  CheckCheck, Ticket, Lock,
} from 'lucide-react'
import type { SesionConPersona, Indicacion, EstadoIndicacion } from '@/lib/types'

const PRIMARY = '#0d7377'

const BORDE_EJECUTIVO: Record<string, string> = {
  pendiente: 'border-l-amber-300',
  hecho:     'border-l-teal-400',
  cancelado: 'border-l-stone-200',
}

const BORDE_COLABORADOR: Record<string, string> = {
  pendiente: 'border-l-stone-300',
  marcado:   'border-l-amber-300',
  confirmado:'border-l-violet-300',
  cancelado: 'border-l-stone-100',
}

// ─── Configuración de estados (read-only y colaborador) ──────────────────────

const ESTADO_EJECUTIVO_CONFIG: Record<string, { label: string; className: string; icon: ReactNode }> = {
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700', icon: <Clock size={11} /> },
  hecho: { label: 'Hecho', className: 'bg-teal-100 text-teal-700', icon: <CheckCircle2 size={11} /> },
  cancelado: { label: 'Cancelado', className: 'bg-stone-100 text-stone-400', icon: <XCircle size={11} /> },
}

const ESTADO_COLABORADOR_CONFIG: Record<string, { label: string; className: string; icon: ReactNode }> = {
  pendiente:  { label: 'Pendiente',   className: 'bg-stone-100 text-stone-500',  icon: <Clock size={11} /> },
  marcado:    { label: 'En revisión', className: 'bg-amber-100 text-amber-700',  icon: <CheckCircle2 size={11} /> },
  confirmado: { label: 'Confirmado',  className: 'bg-violet-100 text-violet-700',icon: <CheckCheck size={11} /> },
  cancelado:  { label: 'Cancelado',   className: 'bg-stone-100 text-stone-400',  icon: <XCircle size={11} /> },
  rechazado:  { label: 'Rechazado',   className: 'bg-red-100 text-red-500',      icon: <XCircle size={11} /> },
}

// ─── Indicación read-only (bloque ejecutivo) ──────────────────────────────────

function IndicacionEjecutivoRO({ ind }: { ind: Indicacion }) {
  const cfg = ESTADO_EJECUTIVO_CONFIG[ind.estado] ?? ESTADO_EJECUTIVO_CONFIG.pendiente
  const borde = BORDE_EJECUTIVO[ind.estado] ?? 'border-l-stone-200'
  const terminada = ind.estado === 'cancelado'
  return (
    <div className={`rounded-lg border border-stone-100 border-l-2 ${borde} p-2.5 bg-white`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cfg.className}`}>
          {cfg.icon} {cfg.label}
        </span>
        {ind.plataforma && (
          <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-mono">
            {ind.plataforma}
          </span>
        )}
      </div>
      <p className={`text-sm leading-snug ${terminada ? 'line-through text-stone-400' : 'text-stone-700'}`}>
        {ind.descripcion}
      </p>
      {ind.nota && (
        <p className="text-[11px] text-stone-400 mt-1.5 italic border-l-2 border-stone-200 pl-2 leading-relaxed">
          {ind.nota}
        </p>
      )}
    </div>
  )
}

// ─── Indicación interactiva (bloque colaborador) ──────────────────────────────

function IndicacionColaboradorInteractiva({
  ind, token, onUpdate,
}: {
  ind: Indicacion; token: string; onUpdate: (u: Indicacion) => void
}) {
  const [saving, setSaving] = useState(false)

  const marcarHecho = async () => {
    if (ind.estado !== 'pendiente' || saving) return
    const prev = ind.estado
    onUpdate({ ...ind, estado: 'marcado' })
    setSaving(true)
    try {
      const res = await fetch(`/api/ejecutivo/indicaciones/${ind.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado: 'marcado' }),
      })
      if (!res.ok) onUpdate({ ...ind, estado: prev })
    } catch {
      onUpdate({ ...ind, estado: prev })
    } finally {
      setSaving(false)
    }
  }

  const cfg = ESTADO_COLABORADOR_CONFIG[ind.estado] ?? ESTADO_COLABORADOR_CONFIG.pendiente
  const borde = BORDE_COLABORADOR[ind.estado] ?? 'border-l-stone-200'
  const clickable = ind.estado === 'pendiente' || ind.estado === 'rechazado'
  const terminada = ind.estado === 'cancelado' || ind.estado === 'confirmado'

  return (
    <div className={`rounded-lg border border-stone-100 border-l-2 ${borde} p-2.5 bg-white transition-all`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <button
          onClick={clickable ? marcarHecho : undefined}
          disabled={saving || !clickable}
          title={clickable ? (ind.estado === 'rechazado' ? 'Volver a enviar' : 'Marcar como realizado') : undefined}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${cfg.className} ${clickable ? 'cursor-pointer hover:opacity-80 active:scale-95 shadow-sm' : 'cursor-default'}`}
        >
          {saving ? <Loader2 size={11} className="animate-spin" /> : cfg.icon}
          {ind.estado === 'pendiente' ? '¡Listo! Marcar ✓'
           : ind.estado === 'rechazado' ? 'Rechazado — Reenviar ↩'
           : cfg.label}
        </button>
        {ind.plataforma && (
          <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-mono">
            {ind.plataforma}
          </span>
        )}
      </div>
      <p className={`text-sm leading-snug ${
        terminada ? 'line-through text-stone-400'
        : ind.estado === 'rechazado' ? 'text-stone-600'
        : 'text-stone-700'
      }`}>
        {ind.descripcion}
      </p>
      {ind.nota && (
        <p className={`text-[11px] mt-1.5 italic border-l-2 pl-2 leading-relaxed ${ind.estado === 'rechazado' ? 'text-red-400 border-red-200' : 'text-stone-400 border-stone-200'}`}>
          {ind.nota}
        </p>
      )}
    </div>
  )
}

// ─── SesionCard read-only con dos bloques ─────────────────────────────────────

function SesionCardColaborador({
  sesion, token, myProfileId, onUpdate,
}: {
  sesion: SesionConPersona
  token: string
  myProfileId: string
  onUpdate: (updated: SesionConPersona) => void
}) {
  const [expanded, setExpanded] = useState(true)

  const fecha = new Date(sesion.fecha + 'T12:00:00').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const indsEjecutivo = sesion.indicaciones.filter(i => i.bloque === 'ejecutivo')
  const indsColaborador = sesion.indicaciones.filter(i => i.bloque === 'colaborador')

  const hechos = [
    ...indsEjecutivo.filter(i => i.estado === 'hecho'),
    ...indsColaborador.filter(i => i.estado === 'confirmado'),
  ].length
  const total = sesion.indicaciones.length

  const esTicket = sesion.iniciado_por === myProfileId

  const handleUpdateInd = (updated: Indicacion) => {
    onUpdate({
      ...sesion,
      indicaciones: sesion.indicaciones.map(i => i.id === updated.id ? updated : i),
    })
  }

  return (
    <div className={`rounded-xl border border-stone-200 shadow-sm overflow-hidden ${sesion.cerrada ? 'bg-stone-50' : 'bg-white'}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-stone-50 transition-colors"
      >
        <CalendarDays size={16} className="mt-0.5 shrink-0" style={{ color: PRIMARY }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-stone-900 text-sm leading-snug">{sesion.titulo}</p>
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
          <p className="text-xs text-stone-400 mt-0.5">{fecha}</p>
          <p className="text-xs text-stone-400 mt-0.5">
            Con: <span className="font-medium">{sesion.ejecutivo.full_name ?? sesion.ejecutivo.email}</span>
          </p>
          {total > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((hechos / total) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] text-stone-400 font-medium shrink-0">{hechos}/{total}</span>
            </div>
          )}
        </div>
        <span className="text-stone-400 shrink-0 mt-0.5">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-stone-100">
          {sesion.notas && (
            <p className="text-xs text-stone-500 italic px-4 pt-3 pb-1 leading-relaxed">{sesion.notas}</p>
          )}

          {/* Bloques Ejecutivo + Mis tareas — dos columnas */}
          <div className="flex divide-x divide-stone-100">

            {/* Columna Ejecutivo: read-only */}
            <div className="flex-1 min-w-0 px-4 pt-3 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-teal-400 rounded-full" />
                <Briefcase size={12} className="text-teal-600" />
                <span className="text-[11px] font-bold text-teal-700 uppercase tracking-widest">Ejecutivo</span>
              </div>
              {indsEjecutivo.length === 0 ? (
                <p className="text-xs text-stone-300">Sin tareas.</p>
              ) : (
                <div className="space-y-2">
                  {indsEjecutivo.map(ind => (
                    <IndicacionEjecutivoRO key={ind.id} ind={ind} />
                  ))}
                </div>
              )}
            </div>

            {/* Columna Mis tareas: interactivo */}
            <div className="flex-1 min-w-0 px-4 pt-3 pb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-violet-400 rounded-full" />
                <User size={12} className="text-violet-600" />
                <span className="text-[11px] font-bold text-violet-700 uppercase tracking-widest">Mis tareas</span>
              </div>
              {indsColaborador.length === 0 ? (
                <p className="text-xs text-stone-300">Sin tareas asignadas.</p>
              ) : (
                <div className="space-y-2">
                  {indsColaborador.map(ind => (
                    <IndicacionColaboradorInteractiva
                      key={ind.id}
                      ind={ind}
                      token={token}
                      onUpdate={handleUpdateInd}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
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

// ─── Componente principal ─────────────────────────────────────────────────────

interface MisSesionesProps {
  token: string
  myProfileId: string
}

export function MisSesiones({ token, myProfileId }: MisSesionesProps) {
  const [sesiones, setSesiones] = useState<SesionConPersona[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showTicketModal, setShowTicketModal] = useState(false)
  const [ticketForm, setTicketForm] = useState({ titulo: '', fecha: new Date().toISOString().split('T')[0], notas: '' })
  const [savingTicket, setSavingTicket] = useState(false)
  const [ticketError, setTicketError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ejecutivo/mis-sesiones', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSesiones(data)
        else setError(data.error ?? 'Error al cargar sesiones')
      })
      .catch(() => setError('Error de conexión'))
      .finally(() => setLoading(false))
  }, [token])

  const handleCreateTicket = async () => {
    if (!ticketForm.titulo || !ticketForm.fecha) return
    setSavingTicket(true)
    setTicketError(null)
    try {
      const res = await fetch('/api/ejecutivo/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          as_ticket: true,
          titulo: ticketForm.titulo,
          fecha: ticketForm.fecha,
          notas: ticketForm.notas || null,
        }),
      })
      if (!res.ok) {
        const { error: e } = await res.json()
        setTicketError(e ?? 'Error al crear solicitud')
        return
      }
      // Recargar sesiones para incluir la nueva
      const listRes = await fetch('/api/ejecutivo/mis-sesiones', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await listRes.json()
      if (Array.isArray(data)) setSesiones(data)
      setShowTicketModal(false)
      setTicketForm({ titulo: '', fecha: new Date().toISOString().split('T')[0], notas: '' })
    } finally {
      setSavingTicket(false)
    }
  }

  const handleUpdateSesion = (updated: SesionConPersona) => {
    setSesiones(prev => prev.map(s => s.id === updated.id ? updated : s))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-stone-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Cargando sesiones...</span>
      </div>
    )
  }

  if (error) {
    return <div className="text-center py-12 text-red-500 text-sm">{error}</div>
  }

  return (
    <div>
      {/* Cabecera con botón para abrir ticket */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-stone-400">
          {sesiones.length} {sesiones.length === 1 ? 'sesión' : 'sesiones'} registradas
        </p>
        <button
          onClick={() => {
            setTicketForm({ titulo: '', fecha: new Date().toISOString().split('T')[0], notas: '' })
            setTicketError(null)
            setShowTicketModal(true)
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
          style={{ backgroundColor: PRIMARY }}
        >
          <Plus size={13} /> Nueva Solicitud
        </button>
      </div>

      {sesiones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
          <CalendarDays size={40} strokeWidth={1.2} />
          <p className="text-sm font-medium">No tienes sesiones registradas aún.</p>
          <p className="text-xs text-stone-300">Puedes abrir una nueva solicitud o esperar a que el ejecutivo cree una sesión contigo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sesiones.map(s => (
            <SesionCardColaborador
              key={s.id}
              sesion={s}
              token={token}
              myProfileId={myProfileId}
              onUpdate={handleUpdateSesion}
            />
          ))}
        </div>
      )}

      {/* Modal: Nueva Solicitud (ticket) */}
      {showTicketModal && (
        <Modal title="Nueva Solicitud al Ejecutivo" onClose={() => setShowTicketModal(false)}>
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 rounded-lg text-xs font-bold text-violet-700">
              <Ticket size={13} /> Esta solicitud será enviada al ejecutivo de la organización
            </div>
            <div>
              <label className={labelCls()}>Título <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={ticketForm.titulo}
                onChange={e => setTicketForm(p => ({ ...p, titulo: e.target.value }))}
                placeholder="ej: Solicitud de ajuste en plataforma RAS"
                className={inputCls()}
                autoFocus
              />
            </div>
            <div>
              <label className={labelCls()}>Fecha <span className="text-red-400">*</span></label>
              <input
                type="date"
                value={ticketForm.fecha}
                onChange={e => setTicketForm(p => ({ ...p, fecha: e.target.value }))}
                className={inputCls()}
              />
            </div>
            <div>
              <label className={labelCls()}>Descripción (opcional)</label>
              <textarea
                value={ticketForm.notas}
                onChange={e => setTicketForm(p => ({ ...p, notas: e.target.value }))}
                placeholder="Explica brevemente el motivo de la solicitud..."
                rows={3}
                className={`${inputCls()} resize-none`}
              />
            </div>
            {ticketError && (
              <p className="text-xs text-red-500">{ticketError}</p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowTicketModal(false)}
                className="flex-1 py-2 rounded-lg border border-stone-200 text-sm font-semibold text-stone-500 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={savingTicket || !ticketForm.titulo || !ticketForm.fecha}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                style={{ backgroundColor: PRIMARY }}
              >
                {savingTicket ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Enviar Solicitud
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
