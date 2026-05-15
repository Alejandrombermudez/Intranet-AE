'use client'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { CalendarDays, Loader2, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { SesionConPersona, Indicacion, EstadoIndicacion } from '@/lib/types'

const PRIMARY = '#0d7377'

const ESTADO_CONFIG: Record<EstadoIndicacion, { label: string; className: string; icon: ReactNode }> = {
  pendiente: {
    label: 'Pendiente',
    className: 'bg-yellow-100 text-yellow-700',
    icon: <Clock size={11} />,
  },
  hecho: {
    label: 'Hecho',
    className: 'bg-green-100 text-green-700',
    icon: <CheckCircle2 size={11} />,
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-stone-100 text-stone-400 line-through',
    icon: <XCircle size={11} />,
  },
}

function EstadoBadge({ estado }: { estado: EstadoIndicacion }) {
  const cfg = ESTADO_CONFIG[estado]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${cfg.className}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function ReadOnlyIndicacion({ ind }: { ind: Indicacion }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <EstadoBadge estado={ind.estado} />
      <span className={`text-sm text-stone-700 flex-1 leading-snug ${ind.estado === 'cancelado' ? 'line-through text-stone-400' : ''}`}>
        {ind.descripcion}
      </span>
      {ind.plataforma && (
        <span className="text-[11px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
          {ind.plataforma}
        </span>
      )}
    </div>
  )
}

function ReadOnlySesionCard({ sesion }: { sesion: SesionConPersona }) {
  const [expanded, setExpanded] = useState(true)

  const fecha = new Date(sesion.fecha + 'T12:00:00').toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const totalInd = sesion.indicaciones.length
  const hechos = sesion.indicaciones.filter(i => i.estado === 'hecho').length

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-stone-50 transition-colors"
      >
        <CalendarDays size={16} className="mt-0.5 shrink-0" style={{ color: PRIMARY }} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-900 text-sm leading-snug">{sesion.titulo}</p>
          <p className="text-xs text-stone-400 mt-0.5">{fecha}</p>
          {totalInd > 0 && (
            <p className="text-xs text-stone-400 mt-1">
              {hechos}/{totalInd} completadas
            </p>
          )}
        </div>
        <span className="text-stone-400 shrink-0">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-stone-100">
          {sesion.notas && (
            <p className="text-xs text-stone-500 italic mt-3 mb-2 leading-relaxed">{sesion.notas}</p>
          )}
          {sesion.indicaciones.length === 0 ? (
            <p className="text-xs text-stone-400 mt-3">Sin indicaciones registradas.</p>
          ) : (
            <div className="mt-3 space-y-0.5">
              {sesion.indicaciones.map(ind => (
                <ReadOnlyIndicacion key={ind.id} ind={ind} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface MisSesionesProps {
  token: string
}

export function MisSesiones({ token }: MisSesionesProps) {
  const [sesiones, setSesiones] = useState<SesionConPersona[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-stone-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Cargando sesiones...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500 text-sm">{error}</div>
    )
  }

  if (sesiones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
        <CalendarDays size={40} strokeWidth={1.2} />
        <p className="text-sm font-medium">No tienes sesiones asignadas aún.</p>
        <p className="text-xs text-stone-300">Las sesiones que el ejecutivo cree contigo aparecerán aquí.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-stone-400 mb-4">
        {sesiones.length} {sesiones.length === 1 ? 'sesión' : 'sesiones'} registradas
      </p>
      <div className="space-y-3">
        {sesiones.map(s => (
          <ReadOnlySesionCard key={s.id} sesion={s} />
        ))}
      </div>
    </div>
  )
}
