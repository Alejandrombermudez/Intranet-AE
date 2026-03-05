'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/lib/types'
import type { User } from '@supabase/supabase-js'
import { VEHICLES } from '@/lib/vehicles'
import {
  ArrowLeft, ShieldCheck, Shield, Pencil, Check, X,
  Users, Loader2, AlertCircle, BarChart2, ImageOff,
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface InspectionStat {
  id: string
  inspection_type: 'recepcion' | 'devolucion'
  submitted_at: string
  cat1_status: string; cat1_issues: string[]
  cat2_status: string; cat2_issues: string[]
  cat3_status: string; cat3_issues: string[]
  cat4_status: string; cat4_issues: string[]
  cat5_status: string; cat5_issues: string[]
  cat6_status: string; cat6_issues: string[]
  photo_frontal: string | null
  photo_posterior: string | null
  photo_lateral_izq: string | null
  photo_lateral_der: string | null
  photo_tablero: string | null
  vehicle_reservations: { vehicle_id: string; vehicle_name: string } | null
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CAT_NAMES = [
  'Presentación', 'Niveles y Líquidos',
  'Tablero y Eléctrico', 'Seguridad Activa', 'Llantas', 'Kit & Docs',
]

const PHOTO_KEYS: (keyof InspectionStat)[] = [
  'photo_frontal', 'photo_posterior', 'photo_lateral_izq', 'photo_lateral_der', 'photo_tablero',
]
const PHOTO_LABELS = ['Frontal', 'Posterior', 'Lat. Izq.', 'Lat. Der.', 'Tablero']

const PRIMARY = '#0d7377'
const PRIMARY_DARK = '#0f766e'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  )
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function hasIssues(insp: InspectionStat): boolean {
  return [1, 2, 3, 4, 5, 6].some(
    (n) => insp[`cat${n}_status` as keyof InspectionStat] === 'issues'
  )
}

// ─── EditRow (tabla usuarios) ─────────────────────────────────────────────────

interface EditRowProps {
  profile: UserProfile
  onSave: (email: string, updates: Partial<UserProfile>) => Promise<void>
  onCancel: () => void
}

function EditRow({ profile, onSave, onCancel }: EditRowProps) {
  const [role, setRole] = useState(profile.role ?? '')
  const [department, setDepartment] = useState(profile.department ?? '')
  const [isAdmin, setIsAdmin] = useState(profile.is_admin)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(profile.email, { role: role || null, department: department || null, is_admin: isAdmin })
    setSaving(false)
  }

  return (
    <tr className="bg-primary/5 border-b border-primary/20">
      <td className="px-4 py-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black" style={{ backgroundColor: PRIMARY }}>
          {getInitials(profile.full_name)}
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="font-bold text-stone-900 text-sm">{profile.full_name ?? '—'}</p>
        <p className="text-xs text-stone-400 truncate max-w-[200px]">{profile.email}</p>
      </td>
      <td className="px-4 py-3">
        <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Departamento"
          className="w-full px-2 py-1.5 text-sm border-2 border-primary/40 rounded-lg focus:outline-none focus:border-primary bg-white" />
      </td>
      <td className="px-4 py-3">
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Rol"
          className="w-full px-2 py-1.5 text-sm border-2 border-primary/40 rounded-lg focus:outline-none focus:border-primary bg-white" />
      </td>
      <td className="px-4 py-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div onClick={() => setIsAdmin((v) => !v)}
            className={`w-10 h-6 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${isAdmin ? 'bg-primary' : 'bg-stone-300'}`}>
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${isAdmin ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <span className="text-xs font-bold text-stone-600">{isAdmin ? 'Sí' : 'No'}</span>
        </label>
      </td>
      <td className="px-4 py-3 text-xs text-stone-400">{formatDate(profile.last_login)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary-dark transition-all disabled:opacity-60">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Guardar
          </button>
          <button onClick={onCancel} disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 border border-stone-300 text-stone-600 rounded-lg text-xs font-bold hover:bg-stone-100 transition-all">
            <X size={12} /> Cancelar
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── UserRow ──────────────────────────────────────────────────────────────────

interface UserRowProps {
  profile: UserProfile
  isSelf: boolean
  onEdit: () => void
}

function UserRow({ profile, isSelf, onEdit }: UserRowProps) {
  return (
    <tr className={`border-b border-stone-100 hover:bg-stone-50 transition-colors ${isSelf ? 'ring-1 ring-inset ring-primary/30 bg-primary/[0.03]' : ''}`}>
      <td className="px-4 py-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black"
          style={{ backgroundColor: isSelf ? PRIMARY : '#78716c' }}>
          {getInitials(profile.full_name)}
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="font-bold text-stone-900 text-sm">
          {profile.full_name ?? '—'}
          {isSelf && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Tú</span>}
        </p>
        <p className="text-xs text-stone-400 truncate max-w-[220px]">{profile.email}</p>
      </td>
      <td className="px-4 py-3 text-sm text-stone-600">{profile.department ?? <span className="text-stone-300">—</span>}</td>
      <td className="px-4 py-3 text-sm text-stone-600">{profile.role ?? <span className="text-stone-300">—</span>}</td>
      <td className="px-4 py-3">
        {profile.is_admin ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-bold">
            <ShieldCheck size={12} /> Admin
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-stone-100 text-stone-400 rounded-lg text-xs font-medium">
            <Shield size={12} /> Usuario
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">{formatDate(profile.last_login)}</td>
      <td className="px-4 py-3">
        <button onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-stone-200 text-stone-500 rounded-lg text-xs font-bold hover:border-primary hover:text-primary hover:bg-primary/5 transition-all">
          <Pencil size={12} /> Editar
        </button>
      </td>
    </tr>
  )
}

// ─── PhotoGrid: miniaturas de una inspección ──────────────────────────────────

function PhotoGrid({ insp }: { insp: InspectionStat | undefined }) {
  if (!insp) {
    return (
      <div className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-stone-200 bg-stone-50 text-stone-400 gap-2">
        <ImageOff size={22} />
        <p className="text-xs font-semibold">Sin registro</p>
      </div>
    )
  }

  const issues = [1, 2, 3, 4, 5, 6]
    .filter((n) => insp[`cat${n}_status` as keyof InspectionStat] === 'issues')
    .flatMap((n) => insp[`cat${n}_issues` as keyof InspectionStat] as string[])

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mb-1">
        {formatShortDate(insp.submitted_at)}
      </p>
      <div className="grid grid-cols-5 gap-1">
        {PHOTO_KEYS.map((key, i) => {
          const url = insp[key] as string | null
          return url ? (
            <div key={key} className="relative group">
              <img src={url} alt={PHOTO_LABELS[i]}
                className="w-full h-16 object-cover rounded-lg border border-stone-200 group-hover:border-primary transition-colors cursor-zoom-in"
                onClick={() => window.open(url, '_blank')}
              />
              <p className="text-[9px] text-center text-stone-400 mt-0.5 truncate">{PHOTO_LABELS[i]}</p>
            </div>
          ) : (
            <div key={key} className="w-full h-16 bg-stone-100 rounded-lg border border-dashed border-stone-200 flex items-center justify-center">
              <ImageOff size={12} className="text-stone-300" />
            </div>
          )
        })}
      </div>
      {issues.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-1">
          {issues.slice(0, 4).map((iss, i) => (
            <span key={i} className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">{iss}</span>
          ))}
          {issues.length > 4 && (
            <span className="text-[10px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded font-medium">+{issues.length - 4} más</span>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-emerald-600 font-semibold mt-1">✓ Sin problemas reportados</p>
      )}
    </div>
  )
}

// ─── Tab Estadísticas ─────────────────────────────────────────────────────────

function EstadisticasTab({ inspections, loading }: { inspections: InspectionStat[]; loading: boolean }) {
  const stats = useMemo(() => {
    if (!inspections.length) return null

    const total = inspections.length
    const withIssuesCount = inspections.filter(hasIssues).length
    const recepciones = inspections.filter((i) => i.inspection_type === 'recepcion').length
    const devoluciones = inspections.filter((i) => i.inspection_type === 'devolucion').length

    const pieData = [
      { name: 'Con problemas', value: withIssuesCount, color: '#ef4444' },
      { name: 'Sin problemas', value: total - withIssuesCount, color: '#22c55e' },
    ]

    const catBarData = CAT_NAMES.map((name, i) => ({
      name,
      Problemas: inspections.filter((ins) => ins[`cat${i + 1}_status` as keyof InspectionStat] === 'issues').length,
    }))

    // Top 10 issues frecuentes
    const issueCount: Record<string, number> = {}
    for (const insp of inspections)
      for (let c = 1; c <= 6; c++)
        for (const iss of ((insp[`cat${c}_issues` as keyof InspectionStat] as string[]) ?? []))
          issueCount[iss] = (issueCount[iss] ?? 0) + 1
    const topIssues = Object.entries(issueCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([issue, count]) => ({ issue, count }))

    // Última recepción / devolución por vehículo
    const latestByVehicle: Record<string, { recepcion?: InspectionStat; devolucion?: InspectionStat }> = {}
    for (const insp of inspections) {
      const vId = insp.vehicle_reservations?.vehicle_id
      if (!vId) continue
      if (!latestByVehicle[vId]) latestByVehicle[vId] = {}
      const key = insp.inspection_type as 'recepcion' | 'devolucion'
      if (!latestByVehicle[vId][key]) latestByVehicle[vId][key] = insp
    }

    return { total, withIssuesCount, recepciones, devoluciones, pieData, catBarData, topIssues, latestByVehicle }
  }, [inspections])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 size={36} className="text-primary animate-spin mx-auto mb-3" />
          <p className="text-stone-500 font-semibold text-sm">Cargando estadísticas…</p>
        </div>
      </div>
    )
  }

  if (!inspections.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-stone-400">
        <BarChart2 size={48} className="mb-4 opacity-40" />
        <p className="font-bold text-stone-500">No hay inspecciones completadas aún.</p>
        <p className="text-sm mt-1">Las estadísticas aparecerán cuando se completen formularios.</p>
      </div>
    )
  }

  if (!stats) return null

  const pct = stats.total > 0 ? Math.round((stats.withIssuesCount / stats.total) * 100) : 0

  return (
    <div className="space-y-8">

      {/* ── Cards resumen ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Inspecciones totales', value: stats.total, color: 'text-stone-900' },
          { label: 'Con problemas', value: `${stats.withIssuesCount} (${pct}%)`, color: 'text-red-600' },
          { label: 'Recepciones', value: stats.recepciones, color: 'text-primary' },
          { label: 'Devoluciones', value: stats.devoluciones, color: 'text-emerald-600' },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
            <p className="text-xs text-stone-400 font-bold uppercase tracking-wider mb-1">{card.label}</p>
            <p className={`text-3xl font-black ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Gráficos fila 1: Pie + BarChart categorías ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PieChart */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-base font-black text-stone-900 mb-4">Inspecciones con/sin problemas</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={stats.pieData} dataKey="value" nameKey="name"
                cx="50%" cy="50%" outerRadius={80} innerRadius={40}
                label={({ name, percent }) => `${name}: ${Math.round((percent ?? 0) * 100)}%`}
                labelLine={false}>
                {stats.pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => [`${v ?? 0} inspecciones`, '']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* BarChart categorías */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-base font-black text-stone-900 mb-4">Problemas por categoría</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.catBarData} margin={{ top: 0, right: 8, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v ?? 0} inspecciones`, 'Problemas']} />
              <Bar dataKey="Problemas" fill={PRIMARY} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── BarChart horizontal: Top 10 problemas ── */}
      {stats.topIssues.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-base font-black text-stone-900 mb-4">Top {stats.topIssues.length} problemas más frecuentes</h3>
          <ResponsiveContainer width="100%" height={Math.max(240, stats.topIssues.length * 36)}>
            <BarChart data={stats.topIssues} layout="vertical" margin={{ top: 0, right: 30, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis dataKey="issue" type="category" width={260} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`${v ?? 0} veces`, 'Frecuencia']} />
              <Bar dataKey="count" fill={PRIMARY_DARK} radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#78716c' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Comparación fotográfica por vehículo ── */}
      <div>
        <h3 className="text-lg font-black text-stone-900 mb-4 flex items-center gap-2">
          Comparación fotográfica por vehículo
          <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
            Última recepción vs. última devolución
          </span>
        </h3>

        <div className="space-y-4">
          {VEHICLES.map((vehicle) => {
            const VehicleIcon = vehicle.icon
            const vehicleData = stats.latestByVehicle[vehicle.id]

            return (
              <div key={vehicle.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {/* Header vehículo */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-stone-100"
                  style={{ backgroundColor: `${vehicle.color}10` }}>
                  <VehicleIcon size={20} style={{ color: vehicle.color }} />
                  <span className="font-black text-stone-800">{vehicle.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-0 divide-x divide-stone-100">
                  {/* Última recepción */}
                  <div className="p-5">
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                      Última Recepción
                    </p>
                    <PhotoGrid insp={vehicleData?.recepcion} />
                  </div>

                  {/* Última devolución */}
                  <div className="p-5">
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                      Última Devolución
                    </p>
                    <PhotoGrid insp={vehicleData?.devolucion} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function IntranetPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'usuarios' | 'estadisticas'>('usuarios')
  const [inspections, setInspections] = useState<InspectionStat[]>([])
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsLoaded, setStatsLoaded] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase
        .from('user_profiles').select('is_admin').eq('email', user.email).single()
      if (!profile?.is_admin) { router.push('/'); return }

      setCurrentUser(user)
      await loadUsers()
      setLoading(false)
    }
    init()
  }, [router])

  // Carga perezosa: solo cuando se activa el tab de estadísticas
  useEffect(() => {
    if (activeTab === 'estadisticas' && !statsLoaded && currentUser?.email) {
      loadStats()
    }
  }, [activeTab, currentUser])

  const loadUsers = async () => {
    const { data } = await supabase.from('user_profiles').select('*').order('last_login', { ascending: false })
    setUsers(data ?? [])
  }

  const loadStats = async () => {
    if (statsLoaded || !currentUser?.email) return
    setStatsLoading(true)
    try {
      const res = await fetch(`/api/intranet/stats?email=${encodeURIComponent(currentUser.email)}`)
      if (res.ok) {
        const body = await res.json()
        setInspections(body.inspections ?? [])
      }
    } finally {
      setStatsLoaded(true)
      setStatsLoading(false)
    }
  }

  const showToast = (type: 'ok' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSave = async (targetEmail: string, updates: Partial<UserProfile>) => {
    const res = await fetch('/api/users/update-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterEmail: currentUser?.email, targetEmail, ...updates }),
    })
    if (res.ok) {
      setEditingEmail(null)
      await loadUsers()
      showToast('ok', 'Perfil actualizado correctamente.')
    } else {
      const err = await res.json().catch(() => ({}))
      showToast('error', err.error ?? 'Error al actualizar el perfil.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 size={40} className="text-primary animate-spin mx-auto mb-4" />
          <p className="text-stone-500 font-semibold">Verificando acceso…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-5 py-3.5 rounded-xl shadow-xl text-sm font-bold border ${
          toast.type === 'ok'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {toast.type === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white shadow-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <Link href="/"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-primary hover:text-primary hover:bg-primary/5 transition-all shrink-0">
              <ArrowLeft size={16} />
              <span className="hidden sm:block">Inicio</span>
            </Link>

            <div className="text-center flex-1">
              <div className="inline-flex items-center gap-2 mb-0.5">
                <ShieldCheck size={20} className="text-primary" />
                <h1 className="text-2xl font-black text-stone-900 tracking-tight">Intranet</h1>
              </div>
              <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">
                Panel de Administración
              </p>
            </div>

            <div className="shrink-0 w-[80px]" />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-4 border-t border-stone-100 pt-4">
            {([
              { key: 'usuarios', label: 'Usuarios', icon: <Users size={14} /> },
              { key: 'estadisticas', label: 'Estadísticas', icon: <BarChart2 size={14} /> },
            ] as const).map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === tab.key
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                }`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Tab: Usuarios ── */}
        {activeTab === 'usuarios' && (
          <>
            <div className="bg-primary text-white rounded-2xl p-6 mb-8 shadow-xl">
              <div className="flex items-start gap-4">
                <Users size={36} className="text-white/80 shrink-0 mt-1" />
                <div>
                  <h2 className="text-2xl font-black mb-1">Usuarios Registrados</h2>
                  <p className="text-white/70 text-sm">
                    <span className="font-black text-white text-lg">{users.length}</span>{' '}
                    {users.length === 1 ? 'persona ha accedido' : 'personas han accedido'} a la intranet.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      {['', 'Nombre / Email', 'Departamento', 'Rol', 'Admin', 'Último acceso', ''].map((h, i) => (
                        <th key={i} className="px-4 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-stone-400 font-semibold">No hay usuarios registrados aún.</td></tr>
                    )}
                    {users.map((profile) =>
                      editingEmail === profile.email ? (
                        <EditRow key={profile.email} profile={profile} onSave={handleSave} onCancel={() => setEditingEmail(null)} />
                      ) : (
                        <UserRow key={profile.email} profile={profile} isSelf={profile.email === currentUser?.email} onEdit={() => setEditingEmail(profile.email)} />
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── Tab: Estadísticas ── */}
        {activeTab === 'estadisticas' && (
          <EstadisticasTab inspections={inspections} loading={statsLoading} />
        )}

      </main>

      {/* ── Footer ── */}
      <footer className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center text-stone-500 text-sm">
          <p className="font-semibold">
            &copy; {new Date().getFullYear()} Amazonia Emprende — Todos los derechos reservados
          </p>
        </div>
      </footer>

    </div>
  )
}
