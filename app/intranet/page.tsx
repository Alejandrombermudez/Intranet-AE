'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/lib/types'
import type { User } from '@supabase/supabase-js'
import { MisSesiones } from '@/app/components/MisSesiones'
import { VEHICLES } from '@/lib/vehicles'
import {
  ArrowLeft, ShieldCheck, Shield, Pencil, Check, X,
  Users, Loader2, AlertCircle, AlertTriangle, BarChart2, ImageOff, Construction,
  Leaf, ArrowRight, Filter, CalendarDays, ChevronDown,
  Link2, Copy, CheckCheck, FileSpreadsheet, FileDown, BarChart3, Trash2,
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
  kilometraje: number | null
  vehicle_reservations: { vehicle_id: string; vehicle_name: string; user_name: string | null; user_email: string | null } | null
}

interface VehicleDoc {
  vehicle_id: string
  vehicle_name: string
  soat_expiry: string | null
  tecnomecanica_expiry: string | null
  updated_by: string | null
}

interface Consentimiento {
  id: string
  nombre: string
  apellido: string
  cedula: string
  celular: string
  correo: string
  acepta_tratamiento: boolean
  acepta_politicas: boolean
  created_at: string
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

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const exp = new Date(dateStr + 'T12:00:00').getTime()
  const now = new Date(); now.setHours(12, 0, 0, 0)
  return Math.ceil((exp - now.getTime()) / 86400000)
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function hasIssues(insp: InspectionStat): boolean {
  return [1, 2, 3, 4, 5, 6].some(
    (n) => insp[`cat${n}_status` as keyof InspectionStat] === 'issues'
  )
}

const DEPARTMENTS = ['Financiero', 'Ejecutivo', 'RAS', 'Siembra', 'Tecnología']

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
  const [canAccessIntranet, setCanAccessIntranet] = useState(profile.can_access_intranet)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(profile.email, { role: role || null, department: department || null, is_admin: isAdmin, can_access_intranet: canAccessIntranet })
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
        <select value={department} onChange={(e) => setDepartment(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border-2 border-primary/40 rounded-lg focus:outline-none focus:border-primary bg-white">
          <option value="">— Sin departamento —</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
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
      <td className="px-4 py-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <div onClick={() => setCanAccessIntranet((v) => !v)}
            className={`w-10 h-6 rounded-full flex items-center px-0.5 cursor-pointer transition-colors ${canAccessIntranet ? 'bg-emerald-500' : 'bg-stone-300'}`}>
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${canAccessIntranet ? 'translate-x-4' : 'translate-x-0'}`} />
          </div>
          <span className="text-xs font-bold text-stone-600">{canAccessIntranet ? 'Sí' : 'No'}</span>
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
      <td className="px-4 py-3">
        {profile.can_access_intranet ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold">
            <ArrowRight size={12} /> Sí
          </span>
        ) : (
          <span className="text-stone-300 text-xs">—</span>
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
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all')
  const [vehicleDocs, setVehicleDocs] = useState<VehicleDoc[]>([])
  const [editingDocs, setEditingDocs] = useState<Record<string, { soat: string; tecno: string; saving: boolean }>>({})

  useEffect(() => {
    fetch('/api/vehicle-documents')
      .then((r) => r.json())
      .then((d: VehicleDoc[]) => setVehicleDocs(Array.isArray(d) ? d : []))
      .catch(() => {/* no-op */})
  }, [])

  const saveDoc = async (vehicleId: string, vehicleName: string) => {
    const entry = editingDocs[vehicleId]
    if (!entry) return
    setEditingDocs((prev) => ({ ...prev, [vehicleId]: { ...entry, saving: true } }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const res = await fetch('/api/vehicle-documents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          vehicle_name: vehicleName,
          soat_expiry: entry.soat || null,
          tecnomecanica_expiry: entry.tecno || null,
        }),
      })
      if (res.ok) {
        const updated: VehicleDoc = await res.json()
        setVehicleDocs((prev) => {
          const idx = prev.findIndex((d) => d.vehicle_id === vehicleId)
          return idx >= 0
            ? prev.map((d) => d.vehicle_id === vehicleId ? updated : d)
            : [...prev, updated]
        })
        setEditingDocs((prev) => { const n = { ...prev }; delete n[vehicleId]; return n })
      }
    } catch {/* no-op */}
    setEditingDocs((prev) => ({ ...prev, [vehicleId]: { ...prev[vehicleId], saving: false } }))
  }

  const filtered = selectedVehicleId === 'all'
    ? inspections
    : inspections.filter((i) => i.vehicle_reservations?.vehicle_id === selectedVehicleId)

  const stats = useMemo(() => {
    if (!filtered.length) return null

    const total = filtered.length
    const withIssuesCount = filtered.filter(hasIssues).length
    const recepciones = filtered.filter((i) => i.inspection_type === 'recepcion').length
    const devoluciones = filtered.filter((i) => i.inspection_type === 'devolucion').length

    const pieData = [
      { name: 'Con problemas', value: withIssuesCount, color: '#ef4444' },
      { name: 'Sin problemas', value: total - withIssuesCount, color: '#22c55e' },
    ]

    const catBarData = CAT_NAMES.map((name, i) => ({
      name,
      Problemas: filtered.filter((ins) => ins[`cat${i + 1}_status` as keyof InspectionStat] === 'issues').length,
    }))

    // Top 10 issues frecuentes
    const issueCount: Record<string, number> = {}
    for (const insp of filtered)
      for (let c = 1; c <= 6; c++)
        for (const iss of ((insp[`cat${c}_issues` as keyof InspectionStat] as string[]) ?? []))
          issueCount[iss] = (issueCount[iss] ?? 0) + 1
    const topIssues = Object.entries(issueCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([issue, count]) => ({ issue, count }))

    // Última recepción / devolución por vehículo
    const latestByVehicle: Record<string, { recepcion?: InspectionStat; devolucion?: InspectionStat }> = {}
    for (const insp of filtered) {
      const vId = insp.vehicle_reservations?.vehicle_id
      if (!vId) continue
      if (!latestByVehicle[vId]) latestByVehicle[vId] = {}
      const key = insp.inspection_type as 'recepcion' | 'devolucion'
      if (!latestByVehicle[vId][key]) latestByVehicle[vId][key] = insp
    }

    return { total, withIssuesCount, recepciones, devoluciones, pieData, catBarData, topIssues, latestByVehicle }
  }, [filtered])

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

  const selectedVehicleName = VEHICLES.find((v) => v.id === selectedVehicleId)?.name ?? 'Todos los vehículos'

  if (!stats) return null

  const pct = stats.total > 0 ? Math.round((stats.withIssuesCount / stats.total) * 100) : 0

  // Compute alerts for docs expiring soon
  const docAlerts = VEHICLES.flatMap((v) => {
    const doc = vehicleDocs.find((d) => d.vehicle_id === v.id)
    const alerts: { vehicle: string; field: string; days: number | null }[] = []
    const soatDays = daysUntil(doc?.soat_expiry ?? null)
    const tecnoDays = daysUntil(doc?.tecnomecanica_expiry ?? null)
    if (soatDays !== null && soatDays <= 30) alerts.push({ vehicle: v.name, field: 'SOAT', days: soatDays })
    if (tecnoDays !== null && tecnoDays <= 30) alerts.push({ vehicle: v.name, field: 'Tecnomecánica', days: tecnoDays })
    return alerts
  })

  return (
    <div className="space-y-8">

      {/* ── Alerta documentación vehicular ── */}
      {docAlerts.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-bold text-amber-900 mb-1">Documentación vehicular próxima a vencer</p>
              <ul className="space-y-0.5">
                {docAlerts.map((a, i) => (
                  <li key={i} className={`text-sm font-semibold ${a.days !== null && a.days <= 7 ? 'text-red-700' : 'text-amber-800'}`}>
                    {a.vehicle} — {a.field}:{' '}
                    {a.days !== null && a.days <= 0 ? 'VENCIDO' : `vence en ${a.days} día(s)`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Documentación Vehicular ── */}
      <div>
        <h3 className="text-lg font-black text-stone-900 mb-4 flex items-center gap-2">
          Documentación Vehicular
          <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">SOAT y Tecnomecánica</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {VEHICLES.map((v) => {
            const doc = vehicleDocs.find((d) => d.vehicle_id === v.id)
            const VehicleIcon = v.icon
            const editing = editingDocs[v.id]
            const soatDays = daysUntil(doc?.soat_expiry ?? null)
            const tecnoDays = daysUntil(doc?.tecnomecanica_expiry ?? null)

            const colorClass = (days: number | null) =>
              days === null ? 'text-stone-400' :
              days <= 7 ? 'text-red-600 font-bold' :
              days <= 30 ? 'text-amber-600 font-bold' :
              'text-emerald-600 font-semibold'

            return (
              <div key={v.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                  <VehicleIcon size={20} style={{ color: v.color }} />
                  <p className="font-black text-stone-900">{v.name}</p>
                  {!editing && (
                    <button
                      onClick={() => setEditingDocs((prev) => ({ ...prev, [v.id]: { soat: doc?.soat_expiry ?? '', tecno: doc?.tecnomecanica_expiry ?? '', saving: false } }))}
                      className="ml-auto text-stone-400 hover:text-primary transition-colors"
                      title="Editar fechas"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">Vencimiento SOAT</label>
                      <input type="date" value={editing.soat}
                        onChange={(e) => setEditingDocs((p) => ({ ...p, [v.id]: { ...p[v.id], soat: e.target.value } }))}
                        className="w-full px-3 py-2 border-2 border-stone-200 rounded-lg text-sm font-medium focus:border-primary focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">Vencimiento Tecnomecánica</label>
                      <input type="date" value={editing.tecno}
                        onChange={(e) => setEditingDocs((p) => ({ ...p, [v.id]: { ...p[v.id], tecno: e.target.value } }))}
                        className="w-full px-3 py-2 border-2 border-stone-200 rounded-lg text-sm font-medium focus:border-primary focus:outline-none" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => saveDoc(v.id, v.name)} disabled={editing.saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-primary hover:bg-primary-dark disabled:opacity-50 transition-all">
                        {editing.saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Guardar
                      </button>
                      <button onClick={() => setEditingDocs((p) => { const n = { ...p }; delete n[v.id]; return n })}
                        className="px-4 py-2 rounded-lg text-xs font-bold border border-stone-200 text-stone-500 hover:bg-stone-50 transition-all">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-stone-50 rounded-xl p-3">
                      <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">SOAT</p>
                      <p className={`text-sm ${colorClass(soatDays)}`}>
                        {doc?.soat_expiry ? new Date(doc.soat_expiry + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : <span className="text-stone-300 font-normal">Sin fecha</span>}
                      </p>
                      {soatDays !== null && (
                        <p className={`text-xs mt-0.5 ${colorClass(soatDays)}`}>
                          {soatDays <= 0 ? 'VENCIDO' : `${soatDays}d restantes`}
                        </p>
                      )}
                    </div>
                    <div className="bg-stone-50 rounded-xl p-3">
                      <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">Tecnomecánica</p>
                      <p className={`text-sm ${colorClass(tecnoDays)}`}>
                        {doc?.tecnomecanica_expiry ? new Date(doc.tecnomecanica_expiry + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : <span className="text-stone-300 font-normal">Sin fecha</span>}
                      </p>
                      {tecnoDays !== null && (
                        <p className={`text-xs mt-0.5 ${colorClass(tecnoDays)}`}>
                          {tecnoDays <= 0 ? 'VENCIDO' : `${tecnoDays}d restantes`}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Selector de vehículo ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-stone-500">
          <Filter size={15} />
          <span className="text-sm font-bold">Filtrar por vehículo:</span>
        </div>
        <div className="relative">
          <select
            value={selectedVehicleId}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm font-semibold border-2 border-stone-200 rounded-xl focus:outline-none focus:border-primary bg-white text-stone-800 transition-colors cursor-pointer"
          >
            <option value="all">Todos los vehículos ({inspections.length})</option>
            {VEHICLES.map((v) => {
              const count = inspections.filter((i) => i.vehicle_reservations?.vehicle_id === v.id).length
              return (
                <option key={v.id} value={v.id}>{v.name} ({count})</option>
              )
            })}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        </div>
        {selectedVehicleId !== 'all' && (
          <button
            onClick={() => setSelectedVehicleId('all')}
            className="text-xs font-bold text-stone-400 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <X size={12} /> Quitar filtro
          </button>
        )}
      </div>

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

      {/* ── Historial de formularios ── */}
      <div>
        <h3 className="text-lg font-black text-stone-900 mb-4 flex items-center gap-2">
          <CalendarDays size={18} className="text-primary" />
          Historial de formularios
          <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
            {selectedVehicleId === 'all' ? `Todos · ${filtered.length}` : `${selectedVehicleName} · ${filtered.length}`}
          </span>
        </h3>

        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-400">
            <BarChart2 size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">Sin formularios para este vehículo.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    {['Vehículo', 'Usuario', 'Tipo', 'Fecha', 'Km', 'Categorías con problemas'].map((h) => (
                      <th key={h} className="px-4 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 50).map((insp) => {
                    const issuesCats = CAT_NAMES.filter((_, i) =>
                      insp[`cat${i + 1}_status` as keyof InspectionStat] === 'issues'
                    )
                    return (
                      <tr key={insp.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-stone-800 whitespace-nowrap">
                          {insp.vehicle_reservations?.vehicle_name ?? <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {insp.vehicle_reservations?.user_name ? (
                            <div>
                              <p className="text-xs font-semibold text-stone-800 whitespace-nowrap">
                                {insp.vehicle_reservations.user_name}
                              </p>
                              {insp.vehicle_reservations.user_email && (
                                <p className="text-[11px] text-stone-400 truncate max-w-[180px]">
                                  {insp.vehicle_reservations.user_email}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-stone-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                            insp.inspection_type === 'recepcion'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-blue-50 text-blue-700'
                          }`}>
                            {insp.inspection_type === 'recepcion' ? 'Recepción' : 'Devolución'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-500 whitespace-nowrap text-xs">
                          {new Date(insp.submitted_at).toLocaleDateString('es-CO', {
                            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3 text-stone-700 text-xs font-medium whitespace-nowrap">
                          {insp.kilometraje != null ? insp.kilometraje.toLocaleString('es-CO') + ' km' : <span className="text-stone-300">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {issuesCats.length === 0 ? (
                            <span className="text-xs text-emerald-600 font-semibold">Sin novedades</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {issuesCats.map((cat) => (
                                <span key={cat} className="inline-flex px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-[10px] font-bold whitespace-nowrap">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > 50 && (
              <p className="text-xs text-stone-400 text-center py-3 border-t border-stone-100">
                Mostrando los primeros 50 de {filtered.length} registros
              </p>
            )}
          </div>
        )}
      </div>

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

// ─── ModuloEnConstruccion ─────────────────────────────────────────────────────

// ─── ModuloRAS: acceso directo desde el tab de admin ──────────────────────────

function ModuloRAS() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-lg p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Leaf size={32} className="text-primary" />
        </div>
        <h2 className="text-2xl font-black text-stone-900 mb-2">Módulo RAS</h2>
        <p className="text-stone-500 text-sm mb-6">
          Gestión de <strong>Familias en Restauración</strong>. Carga y consulta los datos que alimentan el geovisor ambiental.
        </p>
        <Link href="/intranet/ras"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-md hover:shadow-lg transition-all"
          style={{ backgroundColor: PRIMARY }}>
          Abrir módulo <ArrowRight size={15} />
        </Link>
      </div>
    </div>
  )
}

// ─── ModuloEnConstruccion ─────────────────────────────────────────────────────

function ModuloEnConstruccion({ department }: { department: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-28 text-stone-400 gap-4">
      <div className="w-20 h-20 rounded-3xl bg-stone-100 flex items-center justify-center mb-2">
        <Construction size={40} className="text-stone-300" />
      </div>
      <p className="text-xl font-black text-stone-600">Módulo {department}</p>
      <p className="text-sm text-stone-400 text-center max-w-xs">
        Este módulo está en construcción. Pronto tendrás acceso a las herramientas de tu departamento.
      </p>
    </div>
  )
}

// ─── ConsentimientosTab ───────────────────────────────────────────────────────

function ConsentimientosTab() {
  const [registros, setRegistros] = useState<Consentimiento[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [copied, setCopied] = useState(false)
  const [filtro, setFiltro] = useState<'todos' | 'mes' | 'custom'>('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const formUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/consentimiento`
    : '/consentimiento'

  const buildParams = () => {
    const p = new URLSearchParams()
    if (filtro === 'mes') {
      const now = new Date()
      p.set('desde', new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
      p.set('hasta', now.toISOString().slice(0, 10))
    } else if (filtro === 'custom' && desde && hasta) {
      p.set('desde', desde)
      p.set('hasta', hasta)
    }
    return p.toString()
  }

  const loadData = async () => {
    setLoadingData(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const params = buildParams()
      const res = await fetch(`/api/consentimientos${params ? '?' + params : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      setRegistros(json.data ?? [])
    } catch {
      console.error('Error cargando consentimientos')
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilter = () => loadData()

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      const res = await fetch(`/api/consentimientos/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setRegistros((prev) => prev.filter((r) => r.id !== id))
      }
    } catch {
      console.error('Error eliminando consentimiento')
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const copyUrl = async () => {
    await navigator.clipboard.writeText(formUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const formatFecha = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

  const downloadExcel = async () => {
    setDownloading('excel')
    try {
      const { utils, writeFile } = await import('xlsx')
      const rows = registros.map((c) => ({
        'Nombre':   c.nombre,
        'Apellido': c.apellido,
        'Cédula':   c.cedula,
        'Celular':  c.celular,
        'Correo':   c.correo,
        'Fecha':    formatFecha(c.created_at),
        'Acepta tratamiento': c.acepta_tratamiento ? 'Sí' : 'No',
        'Acepta políticas':   c.acepta_politicas   ? 'Sí' : 'No',
      }))
      const ws = utils.json_to_sheet(rows)
      const wb = utils.book_new()
      utils.book_append_sheet(wb, ws, 'Consentimientos')
      writeFile(wb, `consentimientos_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setDownloading(null)
    }
  }

  const downloadPDF = async () => {
    setDownloading('pdf')
    try {
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape' })

      doc.setFontSize(14)
      doc.setTextColor(13, 115, 119)
      doc.text('Amazonia Emprende — Consentimientos de Tratamiento de Datos', 14, 14)
      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text(`Generado el ${new Date().toLocaleString('es-CO')} · ${registros.length} registros`, 14, 21)

      autoTable(doc, {
        startY: 27,
        head: [['Nombre', 'Apellido', 'Cédula', 'Celular', 'Correo', 'Fecha de registro']],
        body: registros.map((c) => [
          c.nombre,
          c.apellido,
          c.cedula,
          c.celular,
          c.correo,
          formatFecha(c.created_at),
        ]),
        headStyles: { fillColor: [13, 115, 119], fontSize: 9, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [248, 247, 246] },
      })

      doc.save(`consentimientos_${new Date().toISOString().slice(0, 10)}.pdf`)
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-6">

      {/* Banner con el link del formulario */}
      <div className="rounded-2xl border-2 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        style={{ backgroundColor: '#0d737710', borderColor: '#0d737730' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#0d737720' }}>
          <Link2 size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-stone-800 mb-0.5">Link del formulario para usuarios</p>
          <p className="text-xs text-stone-500 mb-2">
            Comparte este enlace para que las personas diligencien el formulario de consentimiento.
          </p>
          <code className="text-xs font-mono px-2 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 break-all">
            {formUrl}
          </code>
        </div>
        <button onClick={copyUrl}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shrink-0 ${
            copied
              ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200'
              : 'text-white shadow-sm hover:shadow-md border-2 border-transparent'
          }`}
          style={copied ? {} : { backgroundColor: PRIMARY }}>
          {copied ? <><CheckCheck size={15} /> Copiado</> : <><Copy size={15} /> Copiar link</>}
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Período</p>
            <div className="flex gap-1">
              {([
                { key: 'todos', label: 'Todos' },
                { key: 'mes',   label: 'Este mes' },
                { key: 'custom',label: 'Personalizado' },
              ] as const).map((opt) => (
                <button key={opt.key} onClick={() => setFiltro(opt.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filtro === opt.key
                      ? 'text-white shadow-sm'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                  style={filtro === opt.key ? { backgroundColor: PRIMARY } : {}}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filtro === 'custom' && (
            <>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Desde</label>
                <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                  className="px-3 py-1.5 text-sm border-2 border-stone-200 rounded-lg focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Hasta</label>
                <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                  className="px-3 py-1.5 text-sm border-2 border-stone-200 rounded-lg focus:outline-none focus:border-primary" />
              </div>
            </>
          )}

          <button onClick={applyFilter}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-bold text-white shadow-sm hover:shadow-md transition-all"
            style={{ backgroundColor: PRIMARY }}>
            <Filter size={13} /> Aplicar
          </button>

          <div className="ml-auto flex gap-2">
            <button onClick={downloadExcel} disabled={!!downloading || registros.length === 0}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold text-emerald-700 bg-emerald-50 border-2 border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-40">
              {downloading === 'excel'
                ? <Loader2 size={14} className="animate-spin" />
                : <FileSpreadsheet size={14} />}
              Excel
            </button>
            <button onClick={downloadPDF} disabled={!!downloading || registros.length === 0}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-bold text-red-700 bg-red-50 border-2 border-red-200 hover:bg-red-100 transition-all disabled:opacity-40">
              {downloading === 'pdf'
                ? <Loader2 size={14} className="animate-spin" />
                : <FileDown size={14} />}
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden">
        {/* Cabecera resumen */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <p className="text-sm font-black text-stone-800">Registros de consentimiento</p>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
            style={{ backgroundColor: PRIMARY }}>
            {registros.length} {registros.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: PRIMARY }} />
          </div>
        ) : registros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-stone-400 gap-3">
            <ShieldCheck size={36} className="text-stone-300" />
            <p className="text-sm font-bold text-stone-500">Sin registros en este período</p>
            <p className="text-xs text-stone-400">Comparte el link del formulario para recibir consentimientos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  {['Nombre completo', 'Cédula', 'Celular', 'Correo', 'Fecha de registro', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((c) => (
                  <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-stone-900 text-sm">{c.nombre} {c.apellido}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-600 font-mono">{c.cedula}</td>
                    <td className="px-4 py-3 text-sm text-stone-600">{c.celular}</td>
                    <td className="px-4 py-3 text-sm text-stone-600">{c.correo}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                        <CalendarDays size={11} /> {formatShortDate(c.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {confirmDeleteId === c.id ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="text-stone-500 font-semibold">¿Eliminar?</span>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={deletingId === c.id}
                            className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 font-bold hover:bg-red-200 transition-colors disabled:opacity-50">
                            {deletingId === c.id ? <Loader2 size={11} className="animate-spin" /> : 'Sí'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 font-bold hover:bg-stone-200 transition-colors">
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(c.id)}
                          className="p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Eliminar registro">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FinancieroModule: wrapper con sub-tabs ────────────────────────────────────

function FinancieroModule({ inspections, loading }: { inspections: InspectionStat[]; loading: boolean }) {
  const [subTab, setSubTab] = useState<'estadisticas' | 'consentimientos'>('estadisticas')

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-7 bg-white rounded-xl p-1 shadow-sm border border-stone-200 w-fit">
        <button
          onClick={() => setSubTab('estadisticas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            subTab === 'estadisticas'
              ? 'text-white shadow-sm'
              : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
          }`}
          style={subTab === 'estadisticas' ? { backgroundColor: PRIMARY } : {}}>
          <BarChart3 size={14} /> Estadísticas de Carros
        </button>
        <button
          onClick={() => setSubTab('consentimientos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            subTab === 'consentimientos'
              ? 'text-white shadow-sm'
              : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
          }`}
          style={subTab === 'consentimientos' ? { backgroundColor: PRIMARY } : {}}>
          <ShieldCheck size={14} /> Tratamiento de Datos
        </button>
      </div>

      {subTab === 'estadisticas' && (
        <EstadisticasTab inspections={inspections} loading={loading} />
      )}
      {subTab === 'consentimientos' && (
        <ConsentimientosTab />
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function IntranetPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [myProfile, setMyProfile] = useState<{ is_admin: boolean; department: string | null } | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'usuarios' | 'modulo' | 'mis-sesiones'>('usuarios')
  const [token, setToken] = useState<string | null>(null)
  const [inspections, setInspections] = useState<InspectionStat[]>([])
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsLoaded, setStatsLoaded] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      // Obtener el access_token para las API routes (no modifica el flujo de auth)
      const { data: { session } } = await supabase.auth.getSession()
      setToken(session?.access_token ?? null)

      // Usar /api/users/me (service_role) — evita restricciones de schemas expuestos en PostgREST
      let profile: { is_admin: boolean; department: string | null } | null = null
      if (session?.access_token) {
        const res = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) profile = await res.json()
      }

      if (!profile?.is_admin && !profile?.department) { router.push('/'); return }

      setMyProfile({ is_admin: profile.is_admin, department: profile.department ?? null })

      // No-admin: redirigir si tiene módulo propio con página dedicada
      if (!profile.is_admin) {
        if (profile.department === 'RAS') { router.push('/intranet/ras'); return }
        if (profile.department === 'Ejecutivo') { router.push('/intranet/ejecutivo'); return }
        setActiveTab('modulo')
      }

      setCurrentUser(user)
      if (profile.is_admin) await loadUsers()
      setLoading(false)
    }
    init()
  }, [router])

  // Carga perezosa de stats: solo para el módulo Financiero
  useEffect(() => {
    if (activeTab === 'modulo' && myProfile?.department === 'Financiero' && !statsLoaded && currentUser?.email) {
      loadStats()
    }
  }, [activeTab, currentUser, myProfile])

  const loadUsers = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const res = await fetch('/api/users', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setUsers(data ?? [])
    }
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
                {myProfile?.is_admin ? 'Panel de Administración' : `Módulo ${myProfile?.department ?? ''}`}
              </p>
            </div>

            <div className="shrink-0 w-[80px]" />
          </div>

          {/* Tabs — admins */}
          {myProfile?.is_admin && (
            <div className="flex items-center gap-1 mt-4 border-t border-stone-100 pt-4">
              {[
                { key: 'usuarios' as const, label: 'Usuarios', icon: <Users size={14} /> },
                ...(myProfile.department ? [{ key: 'modulo' as const, label: myProfile.department, icon: <BarChart2 size={14} /> }] : []),
              ].map((tab) => (
                <button key={tab.key} onClick={() => {
                  // Módulos con página dedicada: navegar directamente en vez de renderizar inline
                  if (tab.key === 'modulo' && myProfile?.department === 'Ejecutivo') {
                    router.push('/intranet/ejecutivo'); return
                  }
                  if (tab.key === 'modulo' && myProfile?.department === 'RAS') {
                    router.push('/intranet/ras'); return
                  }
                  setActiveTab(tab.key)
                }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    activeTab === tab.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                  }`}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Tabs — usuarios no-admin con módulo */}
          {!myProfile?.is_admin && myProfile?.department && (
            <div className="flex items-center gap-1 mt-4 border-t border-stone-100 pt-4">
              <button onClick={() => setActiveTab('modulo')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'modulo'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                }`}>
                <BarChart2 size={14} /> {myProfile.department}
              </button>
              <button onClick={() => setActiveTab('mis-sesiones')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === 'mis-sesiones'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                }`}>
                <CalendarDays size={14} /> Mis Sesiones
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Admin: Tab Usuarios ── */}
        {myProfile?.is_admin && activeTab === 'usuarios' && (
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
                      {['', 'Nombre / Email', 'Departamento', 'Rol', 'Admin', 'Ve Intranet', 'Último acceso', ''].map((h, i) => (
                        <th key={i} className="px-4 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-stone-400 font-semibold">No hay usuarios registrados aún.</td></tr>
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

        {/* ── Tab módulo: contenido según departamento ── */}
        {activeTab === 'modulo' && myProfile?.department === 'Financiero' && (
          <FinancieroModule inspections={inspections} loading={statsLoading} />
        )}
        {activeTab === 'modulo' && myProfile?.department === 'RAS' && (
          <ModuloRAS />
        )}
        {activeTab === 'modulo' && myProfile?.department &&
          myProfile.department !== 'Financiero' && myProfile.department !== 'RAS' && (
          <ModuloEnConstruccion department={myProfile.department} />
        )}

        {/* ── Tab Mis Sesiones (usuarios no-admin) ── */}
        {activeTab === 'mis-sesiones' && token && (
          <MisSesiones token={token} />
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
