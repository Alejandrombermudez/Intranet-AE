'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchConSesion } from '@/lib/fetch-sesion'
import type { UserProfile } from '@/lib/types'
import type { User } from '@supabase/supabase-js'
import { MisSesiones } from '@/app/components/MisSesiones'
import { Cabecera, Cargando, Pestanas, Seccion, type Pestana } from '@/app/components/marca'
import { NOMBRES_DEPARTAMENTO, RUTA_MODULO } from '@/lib/departamentos'
import {
  ShieldCheck, Shield, Pencil, Check, X,
  Users, Loader2, AlertCircle, AlertTriangle, BarChart2, ImageOff, Construction,
  Leaf, ArrowRight, Filter, CalendarDays, ChevronDown,
  Link2, Copy, CheckCheck, FileSpreadsheet, FileDown, BarChart3, Trash2, Sprout,
  Map as MapIcon,
} from 'lucide-react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Consentimiento {
  id: string
  nombre: string
  apellido: string
  cedula: string
  celular: string
  correo: string
  acepta_tratamiento: boolean
  acepta_politicas: boolean
  acepta_cesion: boolean
  firma: string | null
  autoriza_menor: boolean
  menor_nombre: string | null
  menor_documento: string | null
  parentesco: string | null
  created_at: string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const PRIMARY = '#2f3f32'
const PRIMARY_DARK = '#222e25'

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
          {NOMBRES_DEPARTAMENTO.map((d) => <option key={d} value={d}>{d}</option>)}
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
        'Acepta cesión de imagen': c.acepta_cesion ? 'Sí' : 'No',
        'Firma': c.firma ? 'Sí' : 'No',
        'Autoriza por un menor': c.autoriza_menor ? 'Sí' : 'No',
        'Nombre del menor': c.menor_nombre ?? '',
        'Documento del menor': c.menor_documento ?? '',
        'Parentesco': c.parentesco ?? '',
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
      const doc = new jsPDF({ orientation: 'landscape', compress: true })

      doc.setFontSize(14)
      doc.setTextColor(13, 115, 119)
      doc.text('Amazonia Emprende — Consentimientos de Tratamiento de Datos', 14, 14)
      doc.setFontSize(9)
      doc.setTextColor(100)
      doc.text(`Generado el ${new Date().toLocaleString('es-CO')} · ${registros.length} registros`, 14, 21)

      autoTable(doc, {
        startY: 27,
        head: [['Nombre', 'Apellido', 'Cédula', 'Celular', 'Correo', 'Fecha de registro', 'Cesión de imagen', 'Menor a cargo', 'Firma']],
        body: registros.map((c) => [
          c.nombre,
          c.apellido,
          c.cedula,
          c.celular,
          c.correo,
          formatFecha(c.created_at),
          c.acepta_cesion ? 'Sí' : 'No',
          c.autoriza_menor ? `${c.menor_nombre} (${c.menor_documento}) · ${c.parentesco}` : '—',
          c.firma ? '' : 'Sin firma',
        ]),
        headStyles: { fillColor: [13, 115, 119], fontSize: 9, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3, minCellHeight: 16 },
        columnStyles: { 8: { cellWidth: 34 } },
        alternateRowStyles: { fillColor: [248, 247, 246] },
        // La firma va dibujada dentro de su celda, no como texto.
        didDrawCell: (data) => {
          if (data.section !== 'body' || data.column.index !== 8) return
          const firma = registros[data.row.index]?.firma
          if (firma) doc.addImage(firma, 'PNG', data.cell.x + 1.5, data.cell.y + 1, 30, 11)
        },
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
        style={{ backgroundColor: '#2f3f3210', borderColor: '#2f3f3230' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: '#2f3f3220' }}>
          <Link2 size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-stone-800 mb-0.5">Enlace del formulario</p>
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
          {copied ? <><CheckCheck size={15} /> Copiado</> : <><Copy size={15} /> Copiar enlace</>}
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
            <p className="text-xs text-stone-400">Comparte el enlace del formulario para recibir consentimientos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  {['Nombre completo', 'Cédula', 'Celular', 'Correo', 'Fecha de registro', 'Cesión de imagen', 'Firma', ''].map((h) => (
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
                      {c.autoriza_menor && (
                        <p className="mt-0.5 text-xs text-stone-500">
                          Autoriza por un menor: <span className="font-semibold text-stone-700">{c.menor_nombre}</span>
                          {' '}({c.menor_documento}) · {c.parentesco}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-600 font-mono">{c.cedula}</td>
                    <td className="px-4 py-3 text-sm text-stone-600">{c.celular}</td>
                    <td className="px-4 py-3 text-sm text-stone-600">{c.correo}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                        <CalendarDays size={11} /> {formatShortDate(c.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-stone-600">{c.acepta_cesion ? 'Sí' : 'No'}</td>
                    <td className="px-4 py-3">
                      {c.firma
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={c.firma} alt={`Firma de ${c.nombre} ${c.apellido}`} className="h-9 w-auto max-w-[120px]" />
                        : <span className="text-xs text-stone-400">Sin firma</span>}
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

// ─── Página principal ─────────────────────────────────────────────────────────

export default function IntranetPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [myProfile, setMyProfile] = useState<{ id: string; is_admin: boolean; department: string | null } | null>(null)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [editingEmail, setEditingEmail] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'usuarios' | 'modulo' | 'mis-sesiones'>('usuarios')
  const [token, setToken] = useState<string | null>(null)
  /** Se abrió con ?modulo=financiero (desde «Tratamiento de datos» del módulo administrativo). */
  const [verFinanciero, setVerFinanciero] = useState(false)

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

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      // Obtener el access_token para las API routes (no modifica el flujo de auth)
      const { data: { session } } = await supabase.auth.getSession()
      setToken(session?.access_token ?? null)

      // Usar /api/users/me (service_role) — evita restricciones de schemas expuestos en PostgREST
      let profile: { id: string; is_admin: boolean; department: string | null } | null = null
      if (session?.access_token) {
        const res = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) profile = await res.json()
      }

      if (!profile?.is_admin && !profile?.department) { router.push('/'); return }

      setMyProfile({ id: profile.id, is_admin: profile.is_admin, department: profile.department ?? null })

      // ?modulo=financiero: lo que Financiero tenía aquí antes de tener módulo
      // propio (el tratamiento de datos). Se llega desde la pestaña
      // «Tratamiento de datos» de /intranet/administrativa.
      const verModuloAqui = new URLSearchParams(window.location.search).get('modulo') === 'financiero'
        && (profile.department === 'Financiero' || profile.is_admin)
      if (verModuloAqui) { setActiveTab('modulo'); setVerFinanciero(true) }

      // No-admin: redirigir si tiene módulo propio con página dedicada
      if (!profile.is_admin && !verModuloAqui) {
        const ruta = profile.department ? RUTA_MODULO[profile.department] : undefined
        if (ruta) { router.push(ruta); return }
        setActiveTab('modulo')
      }

      setCurrentUser(user)
      if (profile.is_admin) await loadUsers()
      setLoading(false)
    }
    init()
  }, [router])

  const showToast = (type: 'ok' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSave = async (targetEmail: string, updates: Partial<UserProfile>) => {
    const res = await fetchConSesion('/api/users/update-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail, ...updates }),
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

  if (loading) return <Cargando texto="Verificando acceso…" />

  // Pestañas de la cabecera. Las que tienen `href` llevan a un módulo con
  // página propia; las demás cambian la vista aquí mismo.
  const dept = myProfile?.department ?? null
  const pestanas: Pestana[] = myProfile?.is_admin
    ? [
        { id: 'usuarios', label: 'Usuarios', icono: <Users size={13} />,
          activa: activeTab === 'usuarios', onClick: () => setActiveTab('usuarios') },
        ...(dept
          ? [RUTA_MODULO[dept]
              ? { id: 'modulo', label: dept, icono: <BarChart2 size={13} />, href: RUTA_MODULO[dept] }
              : { id: 'modulo', label: dept, icono: <BarChart2 size={13} />,
                  activa: activeTab === 'modulo', onClick: () => setActiveTab('modulo') }]
          : []),
        // Reporte y Tecnología son transversales: cruzan varias áreas, así que
        // se ofrecen a cualquier admin. Quien tiene ese departamento asignado
        // ya entra por su propia pestaña. Tecnología: hoy nadie tiene ese
        // departamento, y sin esta pestaña nadie llegaría al mapa del sistema.
        ...(dept !== 'Reporte'
          ? [{ id: 'reporte', label: 'Reporte', icono: <Sprout size={13} />, href: RUTA_MODULO.Reporte }]
          : []),
        ...(dept !== 'Tecnología'
          ? [{ id: 'tecnologia', label: 'Tecnología', icono: <MapIcon size={13} />, href: RUTA_MODULO['Tecnología'] }]
          : []),
      ]
    : dept
      ? [
          { id: 'modulo', label: dept, icono: <BarChart2 size={13} />,
            activa: activeTab === 'modulo', onClick: () => setActiveTab('modulo') },
          { id: 'mis-sesiones', label: 'Mis sesiones', icono: <CalendarDays size={13} />,
            activa: activeTab === 'mis-sesiones', onClick: () => setActiveTab('mis-sesiones') },
        ]
      : []

  return (
    <div className="min-h-screen bg-papel">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 border-l-2 bg-white px-5 py-3.5 text-sm shadow-lg ${
          toast.type === 'ok' ? 'border-bosque text-stone-800' : 'border-red-600 text-red-700'
        }`}>
          {toast.type === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* ── Cabecera ── */}
      <Cabecera
        ancho="amplio"
        volver={{ href: '/', label: 'Inicio' }}
        modulo={myProfile?.is_admin ? 'Panel de administración' : `Módulo ${dept ?? ''}`}
        titulo="Intranet"
        pie={pestanas.length > 0 ? <Pestanas tono="oscuro" items={pestanas} /> : undefined}
      />

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-6 sm:px-10 py-10">

        {/* ── Admin: Tab Usuarios ── */}
        {myProfile?.is_admin && activeTab === 'usuarios' && (
          <>
            <Seccion
              titulo="Usuarios registrados"
              sub={<><span className="font-medium text-stone-900">{users.length}</span>{' '}
                {users.length === 1 ? 'persona ha accedido' : 'personas han accedido'} a la intranet.</>}
            >
            <div className="bg-white border border-stone-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      {['', 'Nombre / Email', 'Departamento', 'Rol', 'Admin', 'Ve Intranet', 'Último acceso', ''].map((h, i) => (
                        <th key={i} className="px-4 py-3 text-[10px] font-medium text-stone-500 uppercase tracking-[.14em]">{h}</th>
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
            </Seccion>
          </>
        )}

        {/* ── Tab módulo: contenido según departamento ── */}
        {activeTab === 'modulo' && (myProfile?.department === 'Financiero' || verFinanciero) && (
          <ConsentimientosTab />
        )}
        {activeTab === 'modulo' && !verFinanciero && myProfile?.department === 'RAS' && (
          <ModuloRAS />
        )}
        {activeTab === 'modulo' && !verFinanciero && myProfile?.department &&
          myProfile.department !== 'Financiero' && myProfile.department !== 'RAS' && (
          <ModuloEnConstruccion department={myProfile.department} />
        )}

        {/* ── Tab Mis Sesiones (usuarios no-admin) ── */}
        {activeTab === 'mis-sesiones' && token && myProfile?.id && (
          <MisSesiones token={token} myProfileId={myProfile.id} />
        )}

      </main>

      {/* ── Pie ── */}
      <footer className="max-w-7xl mx-auto px-6 sm:px-10 pb-10">
        <div className="flex items-center justify-between gap-4 border-t border-stone-200 pt-6 text-[10px] uppercase tracking-[.2em] text-stone-500">
          <span className="font-display">Inspirar · Nutrir · Actuar</span>
          <span>&copy; {new Date().getFullYear()} Amazonia Emprende</span>
        </div>
      </footer>

    </div>
  )
}
