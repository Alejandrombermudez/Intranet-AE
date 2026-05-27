'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  type Aliado, type EstadoAliado, type Semaforo,
  ESTADO_CONFIG, SEMAFORO_CONFIG, H1_CAMPOS_CLAVE,
} from '@/lib/juridica-schema'
import {
  Plus, Search, Filter, ChevronRight, Loader2,
  FileText, Shield, BarChart3, CheckCircle2, Circle,
} from 'lucide-react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stepFromEstado(estado: EstadoAliado): number {
  if (estado === 'borrador') return 1
  if (estado === 'antecedentes_ok') return 2
  return 3
}

function h1Completitud(a: Aliado): { hechos: number; total: number } {
  const total = H1_CAMPOS_CLAVE.length
  const hechos = H1_CAMPOS_CLAVE.filter((k) => a[k] != null && a[k] !== '').length
  return { hechos, total }
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Stepper pequeño ──────────────────────────────────────────────────────────

function MiniStepper({ estado }: { estado: EstadoAliado }) {
  const step = stepFromEstado(estado)
  const rechazado = estado === 'rechazado'
  const labels = ['HOJA 1', 'HOJA 2', 'HOJA 3']

  return (
    <div className="flex items-center gap-1">
      {labels.map((label, i) => {
        const done   = i + 1 < step || (i + 1 === 3 && (estado === 'juridico_ok' || estado === 'aprobado' || estado === 'rechazado'))
        const active = i + 1 === step && !done
        const dotClass = rechazado && i + 1 === step
          ? 'bg-red-400'
          : done
            ? 'bg-teal-400'
            : active
              ? 'bg-amber-400'
              : 'bg-stone-200'
        return (
          <div key={label} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-2 h-2 rounded-full ${dotClass}`} />
              <span className="text-[9px] text-stone-400 font-medium">{label}</span>
            </div>
            {i < 2 && <div className="w-4 h-px bg-stone-200 mb-3" />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tarjeta de aliado ────────────────────────────────────────────────────────

function AliadoCard({ aliado, onCrearSiembra }: {
  aliado: Aliado
  onCrearSiembra: (id: string) => void
}) {
  const estadoCfg  = ESTADO_CONFIG[aliado.estado]
  const semaforo   = aliado.analisis_juridico?.semaforo as Semaforo | null
  const semCfg     = semaforo ? SEMAFORO_CONFIG[semaforo] : null
  const { hechos, total } = h1Completitud(aliado)
  const pct = Math.round((hechos / total) * 100)

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-bold text-stone-900 text-sm truncate">{aliado.nombre_completo}</p>
          <p className="text-xs text-stone-400 mt-0.5">
            {aliado.tipo_documento} {aliado.numero_documento} · {aliado.municipio}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estadoCfg.bg} ${estadoCfg.text}`}>
            {estadoCfg.label}
          </span>
          {semCfg && (
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${semCfg.dot}`} />
              <span className={`text-[10px] font-bold ${semCfg.color}`}>{semCfg.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progreso HOJA 1 */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-stone-400">Datos HOJA 1</span>
          <span className="text-[10px] text-stone-400 font-medium">{hechos}/{total}</span>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-400 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <MiniStepper estado={aliado.estado} />
        <div className="flex items-center gap-1.5">
          {aliado.estado === 'aprobado' && (
            <button
              onClick={() => onCrearSiembra(aliado.id)}
              className="text-[11px] font-bold px-2.5 py-1 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              + Siembra
            </button>
          )}
          <Link
            href={`/intranet/juridica/${aliado.id}`}
            className="flex items-center gap-0.5 text-[11px] font-bold text-stone-500 hover:text-stone-800 transition-colors"
          >
            Ver <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type FiltroEstado = 'todos' | EstadoAliado | 'pendiente_h1' | 'pendiente_h2' | 'pendiente_h3' | 'requiere_revision'

export default function JuridicaPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [aliados, setAliados] = useState<Aliado[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroEstado>('todos')
  const [modal, setModal] = useState<{ id: string; nombre: string } | null>(null)
  const [creando, setCreando] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department')
        .eq('email', user.email)
        .single()
      if (!profile?.is_admin && profile?.department !== 'Juridica') {
        router.push('/'); return
      }
      setUserEmail(user.email ?? null)
      setAuthReady(true)
    })
  }, [router])

  // Cargar aliados
  useEffect(() => {
    if (!authReady || !userEmail) return
    setLoading(true)
    fetch(`/api/juridica/aliados?email=${encodeURIComponent(userEmail)}`)
      .then((r) => r.json())
      .then((data) => { setAliados(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [authReady, userEmail])

  // Filtrado
  const visibles = useMemo(() => {
    let list = aliados
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      list = list.filter(
        (a) =>
          a.nombre_completo.toLowerCase().includes(q) ||
          a.numero_documento.toLowerCase().includes(q) ||
          a.municipio.toLowerCase().includes(q)
      )
    }
    if (filtro === 'pendiente_h1') {
      list = list.filter((a) => h1Completitud(a).hechos < H1_CAMPOS_CLAVE.length)
    } else if (filtro === 'pendiente_h2') {
      list = list.filter((a) => !a.antecedentes)
    } else if (filtro === 'pendiente_h3') {
      list = list.filter((a) => a.estado === 'antecedentes_ok' && !a.analisis_juridico)
    } else if (filtro === 'requiere_revision') {
      list = list.filter((a) => a.estado === 'juridico_ok')
    } else if (filtro !== 'todos') {
      list = list.filter((a) => a.estado === filtro)
    }
    return list
  }, [aliados, busqueda, filtro])

  // Estadísticas rápidas
  const stats = useMemo(() => ({
    total:     aliados.length,
    aprobados: aliados.filter((a) => a.estado === 'aprobado').length,
    pendientes: aliados.filter((a) => ['borrador', 'antecedentes_ok', 'juridico_ok'].includes(a.estado)).length,
    rechazados: aliados.filter((a) => a.estado === 'rechazado').length,
  }), [aliados])

  const showToast = (tipo: 'ok' | 'error', msg: string) => {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleCrearSiembra(id: string) {
    const aliado = aliados.find((a) => a.id === id)
    if (!aliado) return
    setModal({ id, nombre: aliado.nombre_completo })
  }

  async function confirmarCrearSiembra() {
    if (!modal || !userEmail) return
    setCreando(true)
    try {
      const res = await fetch(`/api/juridica/aliados/${modal.id}/crear-en-siembra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_by: userEmail }),
      })
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 409 && body.familia_id) {
          showToast('ok', 'Ya existe una familia vinculada — redirigiendo...')
          setTimeout(() => router.push(`/intranet/ras/siembra/${body.familia_id}`), 1200)
        } else {
          showToast('error', body.error ?? 'Error al crear en Siembra')
        }
      } else {
        showToast('ok', 'Familia creada en Siembra correctamente')
        setTimeout(() => router.push(`/intranet/ras/siembra/${body.familia_id}`), 1200)
      }
    } finally {
      setCreando(false)
      setModal(null)
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-stone-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={18} className="text-teal-600" />
              <h1 className="text-xl font-black text-stone-900">Módulo Jurídico</h1>
            </div>
            <p className="text-sm text-stone-400">Debida diligencia jurídica de aliados</p>
          </div>
          <Link
            href="/intranet/juridica/nuevo"
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition-colors"
          >
            <Plus size={16} /> Nuevo aliado
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Stats rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: <FileText size={16} />, color: 'text-stone-600' },
            { label: 'Pendientes', value: stats.pendientes, icon: <Circle size={16} />, color: 'text-amber-600' },
            { label: 'Aprobados', value: aliados.filter(a => a.estado === 'aprobado').length, icon: <CheckCircle2 size={16} />, color: 'text-teal-600' },
            { label: 'Rechazados', value: stats.rechazados, icon: <BarChart3 size={16} />, color: 'text-red-500' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-stone-100 p-4">
              <div className={`flex items-center gap-1.5 mb-1 ${s.color}`}>{s.icon}<span className="text-xs font-bold">{s.label}</span></div>
              <p className="text-2xl font-black text-stone-900">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, documento o municipio…"
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-stone-400 shrink-0" />
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroEstado)}
              className="text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-400 transition-colors"
            >
              <option value="todos">Todos</option>
              <optgroup label="Por estado">
                <option value="borrador">Borrador (HOJA 1)</option>
                <option value="antecedentes_ok">Antecedentes OK</option>
                <option value="juridico_ok">Requiere revisión (naranja)</option>
                <option value="aprobado">Aprobados</option>
                <option value="rechazado">Rechazados</option>
              </optgroup>
              <optgroup label="Por completitud">
                <option value="pendiente_h1">Faltan datos HOJA 1</option>
                <option value="pendiente_h2">Pendiente HOJA 2</option>
                <option value="pendiente_h3">Pendiente HOJA 3</option>
                <option value="requiere_revision">Requieren revisión comité</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-stone-300" size={36} />
          </div>
        ) : visibles.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <Shield size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">
              {aliados.length === 0 ? 'Aún no hay aliados registrados' : 'Ningún aliado coincide con el filtro'}
            </p>
            {aliados.length === 0 && (
              <Link href="/intranet/juridica/nuevo" className="mt-3 inline-block text-sm text-teal-600 font-bold hover:underline">
                Crear el primero →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibles.map((a) => (
              <AliadoCard key={a.id} aliado={a} onCrearSiembra={handleCrearSiembra} />
            ))}
          </div>
        )}
      </div>

      {/* Modal confirmar crear en Siembra */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-black text-stone-900 text-lg mb-2">Crear en Siembra</h3>
            <p className="text-sm text-stone-600 mb-5">
              Se creará un registro en <strong>Siembra</strong> para{' '}
              <strong>{modal.nombre}</strong> con los datos básicos prellenados.
              El equipo RAS completará la encuesta predial desde allí.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setModal(null)}
                disabled={creando}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCrearSiembra}
                disabled={creando}
                className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {creando ? <Loader2 size={14} className="animate-spin" /> : null}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-bold text-white transition-all ${toast.tipo === 'ok' ? 'bg-teal-600' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
