'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Reservation } from '@/lib/types'
import {
  INSPECTION_CATEGORIES,
  PHOTO_SLOTS,
  getDefaultCategories,
  type InspectionType,
  type CategoryKey,
  type InspectionCategories,
} from '@/lib/inspection-data'
import {
  ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle,
  Camera, Loader2, Car, Sparkles, Droplets,
  Gauge, ShieldAlert, CircleDashed, FolderCheck, X,
  ClipboardCheck, RotateCcw, CalendarX, LogIn, Shield, ShieldCheck,
} from 'lucide-react'
import { VEHICLE_MAP } from '@/lib/vehicles'

// ─── Compresión de imagen (Canvas API, sin dependencias externas) ─────────────
async function compressImage(file: File, maxWidth = 1280, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url)
          resolve(
            blob
              ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
              : file
          )
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ─── Íconos por categoría ────────────────────────────────────────────────────
const CAT_ICONS = {
  Sparkles, Droplets, Gauge, ShieldAlert, CircleDashed, FolderCheck,
} as const
type IconName = keyof typeof CAT_ICONS

// ─── Tipos internos ──────────────────────────────────────────────────────────
interface TodayOption {
  reservation: Reservation
  type: InspectionType
  alreadyDone: boolean
}

// ─── Barra de progreso (pasos 1–7) ──────────────────────────────────────────
function ProgressBar({ step, total = 7 }: { step: number; total?: number }) {
  if (step < 1 || step > total) return null
  const pct = Math.round((step / total) * 100)
  return (
    <div className="w-full bg-stone-200 rounded-full h-1.5 mb-2">
      <div
        className="bg-primary h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ─── Badge de tipo de inspección ─────────────────────────────────────────────
function InspectionBadge({ type }: { type: InspectionType }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
      type === 'recepcion'
        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
        : 'bg-amber-100 text-amber-700 border border-amber-200'
    }`}>
      {type === 'recepcion' ? '↓ Recepción' : '↑ Devolución'}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA 0 — Selección (reservas disponibles hoy)
// ═══════════════════════════════════════════════════════════════════════════
function ScreenSelection({
  user,
  options,
  onSelect,
}: {
  user: User
  options: TodayOption[]
  onSelect: (reservation: Reservation, type: InspectionType) => void
}) {
  const displayName = user.user_metadata?.full_name || user.email || 'Usuario'
  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  if (options.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center">
        <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
          <CalendarX size={36} className="text-stone-400" />
        </div>
        <h2 className="text-xl font-black text-stone-900 mb-2">Sin vehículos para hoy</h2>
        <p className="text-stone-500 text-sm mb-1">
          Hola <strong>{displayName}</strong>, hoy no tienes vehículos para recibir o entregar.
        </p>
        <p className="text-stone-400 text-xs mb-8 capitalize">{today}</p>
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <Link
            href="/calendar"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-all shadow-md"
          >
            Ir al Calendario
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-stone-200 text-stone-600 font-bold hover:bg-stone-50 transition-all"
          >
            <ArrowLeft size={16} />
            Volver al inicio
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
          <ClipboardCheck size={26} className="text-primary" />
        </div>
        <h1 className="text-2xl font-black text-stone-900 mb-1">Inspección Vehicular</h1>
        <p className="text-stone-500 text-sm capitalize">{today}</p>
      </div>

      <p className="text-xs font-bold text-stone-500 uppercase tracking-widest mb-3 text-center">
        Hola {displayName} — selecciona la inspección a completar:
      </p>

      <div className="space-y-3">
        {options.map((opt) => {
          const vehicle = VEHICLE_MAP[opt.reservation.vehicle_id]
          const IconComp = vehicle?.icon ?? Car
          return (
            <div
              key={`${opt.reservation.id}-${opt.type}`}
              className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden ${
                opt.alreadyDone ? 'border-stone-200 opacity-60' : 'border-stone-200'
              }`}
            >
              {/* Cabecera del vehículo */}
              <div
                className="flex items-center gap-3 px-5 py-3 border-b border-stone-100"
                style={{ borderLeftWidth: 4, borderLeftColor: vehicle?.color ?? '#0d7377' }}
              >
                <IconComp size={20} style={{ color: vehicle?.color ?? '#0d7377' }} />
                <span className="font-bold text-stone-900">{opt.reservation.vehicle_name}</span>
                <InspectionBadge type={opt.type} />
              </div>

              {/* Cuerpo */}
              <div className="px-5 py-4 flex items-center justify-between gap-4">
                <p className="text-sm text-stone-500">
                  {new Date(opt.reservation.start_date + 'T12:00:00').toLocaleDateString('es-CO', {
                    day: 'numeric', month: 'short',
                  })} → {new Date(opt.reservation.end_date + 'T12:00:00').toLocaleDateString('es-CO', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </p>

                {opt.alreadyDone ? (
                  <span className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                    <CheckCircle2 size={18} className="text-emerald-500" />
                    Completada
                  </span>
                ) : (
                  <button
                    onClick={() => onSelect(opt.reservation, opt.type)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary-dark transition-all shadow-sm"
                  >
                    Iniciar
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 text-center">
        <Link href="/calendar" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-700 transition-colors">
          <ArrowLeft size={14} />
          Volver al Calendario
        </Link>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PASOS 1–6 — Categoría de inspección
// ═══════════════════════════════════════════════════════════════════════════
function StepCategory({
  catIndex,
  displayStep,
  displayTotal,
  categories,
  onChange,
  onNext,
  onBack,
  saving,
  inspectionType,
}: {
  catIndex: number
  displayStep: number
  displayTotal: number
  categories: InspectionCategories
  onChange: (key: CategoryKey, data: Partial<InspectionCategories[CategoryKey]>) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
  inspectionType: InspectionType
}) {
  const config = INSPECTION_CATEGORIES[catIndex - 1]
  const catKey = config.key
  const data = categories[catKey]
  const IconComp = CAT_ICONS[config.icon as IconName] ?? Sparkles

  const toggleIssue = (issue: string) => {
    const already = data.issues.includes(issue)
    onChange(catKey, {
      issues: already ? data.issues.filter((i) => i !== issue) : [...data.issues, issue],
    })
  }

  const canAdvance =
    data.status === 'ok' ||
    (data.status === 'issues' && (data.issues.length > 0 || data.other.trim().length > 0))

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <InspectionBadge type={inspectionType} />
        <span className="text-xs text-stone-400 font-medium">Paso {displayStep} de {displayTotal - 1}</span>
      </div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <IconComp size={20} className="text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{config.mainCategory}</p>
          <h2 className="text-xl font-black text-stone-900 leading-tight">{config.title}</h2>
        </div>
      </div>

      {/* Opciones principales */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => onChange(catKey, { status: 'ok', issues: [], other: '' })}
          className={`p-4 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 ${
            data.status === 'ok'
              ? 'border-emerald-400 bg-emerald-50 text-emerald-800 shadow-md'
              : 'border-stone-200 text-stone-600 hover:border-emerald-300 hover:bg-emerald-50/50'
          }`}
        >
          <CheckCircle2 size={24} className={data.status === 'ok' ? 'text-emerald-500' : 'text-stone-400'} />
          Todo en buen estado
        </button>

        <button
          onClick={() => onChange(catKey, { status: 'issues' })}
          className={`p-4 rounded-xl border-2 font-bold text-sm transition-all flex flex-col items-center gap-2 ${
            data.status === 'issues'
              ? 'border-amber-400 bg-amber-50 text-amber-800 shadow-md'
              : 'border-stone-200 text-stone-600 hover:border-amber-300 hover:bg-amber-50/50'
          }`}
        >
          <AlertTriangle size={24} className={data.status === 'issues' ? 'text-amber-500' : 'text-stone-400'} />
          Reportar novedad
        </button>
      </div>

      {/* Panel de novedades */}
      {data.status === 'issues' && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-4 space-y-2">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3">
            Selecciona los problemas encontrados:
          </p>
          {config.issues.map((issue) => (
            <label
              key={issue}
              className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-all ${
                data.issues.includes(issue)
                  ? 'border-amber-400 bg-amber-100'
                  : 'border-transparent bg-white hover:bg-amber-50'
              }`}
            >
              <input
                type="checkbox"
                checked={data.issues.includes(issue)}
                onChange={() => toggleIssue(issue)}
                className="mt-0.5 accent-amber-600 shrink-0"
              />
              <span className="text-sm font-medium text-stone-800">{issue}</span>
            </label>
          ))}

          <div className="mt-3">
            <label className="block text-xs font-bold text-amber-700 mb-1">
              Otro (descripción libre):
            </label>
            <textarea
              value={data.other}
              onChange={(e) => onChange(catKey, { other: e.target.value })}
              rows={2}
              placeholder="Describe cualquier otro problema no listado..."
              className="w-full px-3 py-2 border-2 border-amber-200 rounded-lg text-sm focus:border-amber-400 focus:outline-none resize-none bg-white"
            />
          </div>

          {!canAdvance && (
            <p className="text-xs text-amber-700 font-medium">
              ⚠ Selecciona al menos un problema o describe en &quot;Otro&quot; para continuar.
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-stone-200 text-stone-600 font-bold hover:bg-stone-50 transition-all"
        >
          <ArrowLeft size={16} />
          Anterior
        </button>
        <button
          onClick={onNext}
          disabled={saving || !canAdvance}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 size={18} className="animate-spin" />}
          {saving ? 'Guardando...' : 'Siguiente'}
          {!saving && <ArrowRight size={16} />}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 7 — Fotos
// ═══════════════════════════════════════════════════════════════════════════
function Step7Photos({
  reservation,
  inspectionType,
  onFinish,
  onBack,
  saving,
}: {
  reservation: Reservation
  inspectionType: InspectionType
  onFinish: (urls: Record<string, string>, kilometraje: number | null) => void
  onBack: () => void
  saving: boolean
}) {
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
  const [kilometraje, setKilometraje] = useState('')
  const [kmError, setKmError] = useState('')
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handleFile = (key: string, file: File | null) => {
    if (!file) return
    setFiles((f) => ({ ...f, [key]: file }))
    const reader = new FileReader()
    reader.onload = (e) => setPreviews((p) => ({ ...p, [key]: e.target?.result as string }))
    reader.readAsDataURL(file)
    setUploadErrors((e) => ({ ...e, [key]: '' }))
  }

  const removeFile = (key: string) => {
    setFiles((f) => { const n = { ...f }; delete n[key]; return n })
    setPreviews((p) => { const n = { ...p }; delete n[key]; return n })
  }

  const handleFinish = async () => {
    const km = kilometraje.trim()
    if (!km) { setKmError('El kilometraje es obligatorio'); return }
    const kmNum = parseInt(km, 10)
    if (isNaN(kmNum) || kmNum < 0) { setKmError('Ingresa un kilometraje válido'); return }
    setKmError('')
    setUploading(true)
    const urls: Record<string, string> = {}
    const errors: Record<string, string> = {}

    const slots = PHOTO_SLOTS.filter((s) => files[s.key])

    // Slug del vehículo para nombres de archivo identificables en Supabase Storage
    const vehicle = VEHICLE_MAP[reservation.vehicle_id]
    const vehicleSlug = (vehicle?.name ?? 'vehiculo')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    await Promise.allSettled(
      slots.map(async (slot) => {
        const raw = files[slot.key]!
        const path = `${reservation.id}/${inspectionType}/${vehicleSlug}_${slot.key}.jpg`
        try {
          const compressed = await compressImage(raw)
          const { error } = await supabase.storage
            .from('inspection-photos')
            .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
          if (error) throw error
          const { data } = supabase.storage.from('inspection-photos').getPublicUrl(path)
          urls[`photo_${slot.key}`] = data.publicUrl
        } catch (err) {
          errors[slot.key] = err instanceof Error ? err.message : 'Error al subir'
        }
      })
    )

    setUploadErrors(errors)
    setUploading(false)
    onFinish(urls, parseInt(kilometraje.trim(), 10))
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <InspectionBadge type={inspectionType} />
        <span className="text-xs text-stone-400 font-medium">Último paso</span>
      </div>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Camera size={20} className="text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Evidencia fotográfica</p>
          <h2 className="text-xl font-black text-stone-900">Fotos del Vehículo</h2>
        </div>
      </div>

      <p className="text-sm text-stone-500 mb-4">
        Toma o adjunta las fotos del estado del vehículo. Puedes subir las que tengas disponibles.
      </p>

      {/* Kilometraje */}
      <div className="mb-5">
        <label className="block text-xs font-bold text-stone-700 uppercase tracking-widest mb-1.5">
          Kilometraje actual del vehículo *
        </label>
        <input
          type="number"
          min={0}
          value={kilometraje}
          onChange={(e) => { setKilometraje(e.target.value); setKmError('') }}
          placeholder="Ej: 45230"
          className={`w-full px-4 py-3 border-2 rounded-xl font-medium text-stone-900 placeholder:text-stone-400 focus:outline-none transition-all ${
            kmError ? 'border-red-400 focus:border-red-500' : 'border-stone-300 focus:border-primary'
          }`}
        />
        {kmError && <p className="text-xs text-red-500 font-medium mt-1">{kmError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {PHOTO_SLOTS.map((slot) => {
          const preview = previews[slot.key]
          const err = uploadErrors[slot.key]
          return (
            <div key={slot.key} className="relative">
              <input
                ref={(el) => { inputRefs.current[slot.key] = el }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(slot.key, e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => inputRefs.current[slot.key]?.click()}
                className={`w-full aspect-square rounded-xl border-2 overflow-hidden flex flex-col items-center justify-center transition-all ${
                  preview
                    ? 'border-primary p-0'
                    : err
                    ? 'border-red-300 bg-red-50'
                    : 'border-dashed border-stone-300 bg-stone-50 hover:border-primary hover:bg-primary/5'
                }`}
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt={slot.label} className="w-full h-full object-cover" />
                ) : (
                  <>
                    <Camera size={24} className={err ? 'text-red-400' : 'text-stone-400'} />
                    <span className={`text-xs font-bold mt-1 text-center px-1 ${err ? 'text-red-500' : 'text-stone-500'}`}>
                      {slot.label}
                    </span>
                  </>
                )}
              </button>
              {preview && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(slot.key) }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80 transition-all"
                >
                  <X size={12} className="text-white" />
                </button>
              )}
              {!preview && (
                <p className="text-[10px] text-stone-400 text-center mt-1 px-1">{slot.hint}</p>
              )}
              {err && (
                <p className="text-xs text-red-500 font-medium mt-1 text-center px-1">{err}</p>
              )}
            </div>
          )
        })}
      </div>

      {Object.keys(files).length === 0 && (
        <p className="text-xs text-stone-400 text-center mb-4">
          Puedes finalizar sin fotos si no tienes cámara disponible.
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-stone-200 text-stone-600 font-bold hover:bg-stone-50 transition-all"
        >
          <ArrowLeft size={16} />
          Anterior
        </button>
        <button
          onClick={handleFinish}
          disabled={saving || uploading}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(saving || uploading) && <Loader2 size={18} className="animate-spin" />}
          {(saving || uploading) ? 'Finalizando...' : 'Finalizar Inspección'}
          {!(saving || uploading) && <CheckCircle2 size={16} />}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PASO 8 — Confirmación final
// ═══════════════════════════════════════════════════════════════════════════
function StepConfirmation({
  reservation,
  inspectionType,
  categories,
  onReset,
}: {
  reservation: Reservation
  inspectionType: InspectionType
  categories: InspectionCategories
  onReset: () => void
}) {
  const totalIssues = INSPECTION_CATEGORIES.reduce((acc, cat) => {
    const d = categories[cat.key]
    if (d.status === 'issues') return acc + d.issues.length + (d.other.trim() ? 1 : 0)
    return acc
  }, 0)

  return (
    <div className="max-w-lg mx-auto text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 size={42} className="text-emerald-500" />
      </div>
      <h2 className="text-2xl font-black text-stone-900 mb-2">¡Inspección Completada!</h2>
      <div className="flex justify-center mb-4">
        <InspectionBadge type={inspectionType} />
      </div>
      <p className="text-stone-500 text-sm mb-6">
        La inspección de <strong>{inspectionType === 'recepcion' ? 'recepción' : 'devolución'}</strong> del{' '}
        <strong>{reservation.vehicle_name}</strong> fue registrada.
      </p>

      {/* Resumen */}
      <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-5 text-left mb-6">
        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Resumen</p>
        <div className="space-y-2">
          {INSPECTION_CATEGORIES.map((cat) => {
            const d = categories[cat.key]
            const IconComp = CAT_ICONS[cat.icon as IconName] ?? Sparkles
            const count = d.status === 'issues'
              ? d.issues.length + (d.other.trim() ? 1 : 0)
              : 0
            return (
              <div key={cat.key} className="flex items-center gap-3">
                <IconComp size={14} className={d.status === 'ok' ? 'text-emerald-500' : 'text-amber-500'} />
                <span className="text-sm text-stone-700 flex-1">{cat.mainCategory}</span>
                {d.status === 'ok' ? (
                  <span className="text-xs text-emerald-600 font-bold">OK</span>
                ) : (
                  <span className="text-xs text-amber-600 font-bold">
                    {count} novedad{count !== 1 ? 'es' : ''}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-stone-100">
          {totalIssues === 0 ? (
            <p className="text-sm font-bold text-emerald-700">Vehículo en buen estado ✓</p>
          ) : (
            <p className="text-sm font-bold text-amber-700">
              Total de novedades reportadas: <span className="text-lg">{totalIssues}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onReset}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-stone-200 text-stone-700 font-bold hover:bg-stone-50 transition-all"
        >
          <RotateCcw size={16} />
          Nueva inspección
        </button>
        <Link
          href="/calendar"
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-all shadow-md"
        >
          Ir al Calendario
        </Link>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PANTALLA DE TÉRMINOS (solo Recepción)
// ═══════════════════════════════════════════════════════════════════════════
const TERMINOS_VEHICULO = [
  'Acepto respetar todas las normas de tránsito, señales viales y límites de velocidad vigentes durante el uso del vehículo.',
  'Acepto mantener las distancias de seguridad, conducir de forma prudente y no operar el vehículo bajo efectos de ninguna sustancia.',
  'Acepto ser responsable de la integridad del vehículo, su combustible y su documentación durante todo el período de uso.',
  'Acepto notificar inmediatamente a la empresa sobre cualquier novedad, daño, incidente o accidente que ocurra.',
]

const TERMINOS_MOTO = [
  'Acepto utilizar el casco certificado durante toda la operación, sin excepción.',
  'Acepto respetar todas las normas de tránsito, señales viales y velocidades reglamentarias para circulación en motocicleta.',
  'Acepto no realizar maniobras peligrosas, mantener distancias seguras y no operar la motocicleta bajo efectos de ninguna sustancia.',
  'Acepto ser responsable de la integridad de la motocicleta y notificar inmediatamente a la empresa sobre cualquier novedad, daño o incidente.',
]

function StepTerms({
  isMoto,
  reservation,
  onAccept,
  onBack,
}: {
  isMoto: boolean
  reservation: Reservation
  onAccept: () => void
  onBack: () => void
}) {
  const terminos = isMoto ? TERMINOS_MOTO : TERMINOS_VEHICULO
  const [checked, setChecked] = useState<boolean[]>(terminos.map(() => false))
  const allChecked = checked.every(Boolean)
  const countChecked = checked.filter(Boolean).length

  const toggle = (i: number) => {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Cabecera */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Shield size={20} className="text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">
            {isMoto ? 'Motocicleta · Recepción' : 'Vehículo · Recepción'}
          </p>
          <h2 className="text-xl font-black text-stone-900 leading-tight">
            Compromiso de Uso Seguro
          </h2>
        </div>
      </div>

      <p className="text-sm text-stone-500 mb-5 leading-relaxed">
        Antes de recibir <strong>{reservation.vehicle_name}</strong>, lee y acepta
        cada punto individualmente. Debes marcar <strong>todos</strong> para continuar.
      </p>

      {/* Lista de términos */}
      <div className="space-y-3 mb-5">
        {terminos.map((texto, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              checked[i]
                ? 'border-emerald-400 bg-emerald-50'
                : 'border-stone-200 bg-white hover:border-primary/40 hover:bg-primary/5'
            }`}
          >
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
              checked[i]
                ? 'border-emerald-500 bg-emerald-500'
                : 'border-stone-300'
            }`}>
              {checked[i] && (
                <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white">
                  <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                </svg>
              )}
            </div>
            <span className={`text-sm leading-relaxed font-medium ${
              checked[i] ? 'text-emerald-800' : 'text-stone-700'
            }`}>
              {texto}
            </span>
          </button>
        ))}
      </div>

      {/* Contador de aceptadas */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex-1 bg-stone-200 rounded-full h-1.5">
          <div
            className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(countChecked / terminos.length) * 100}%` }}
          />
        </div>
        <span className={`text-xs font-bold whitespace-nowrap ${
          allChecked ? 'text-emerald-600' : 'text-stone-400'
        }`}>
          {allChecked
            ? '¡Todas aceptadas!'
            : `${countChecked} de ${terminos.length} aceptadas`}
        </span>
      </div>

      {/* Botones */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-stone-200 text-stone-600 font-bold hover:bg-stone-50 transition-all"
        >
          <ArrowLeft size={16} />
          Cancelar
        </button>
        <button
          onClick={onAccept}
          disabled={!allChecked}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-dark transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ShieldCheck size={18} />
          Continuar con la inspección
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════
export default function ValidarReservaPage() {
  // ── Auth & datos ─────────────────────────────────────────────────────────
  const [user, setUser] = useState<User | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [todayOptions, setTodayOptions] = useState<TodayOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  // ── Wizard ───────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0)           // 0=selección, 1-6=categorías, 7=fotos, 8=confirmación
  const [showTerms, setShowTerms] = useState(false) // términos entre selección y paso 1 (solo recepción)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [inspectionType, setInspectionType] = useState<InspectionType | null>(null)
  const [inspectionId, setInspectionId] = useState<string | null>(null)
  const [categories, setCategories] = useState<InspectionCategories>(getDefaultCategories())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // ── Verificar sesión al montar ────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoadingAuth(false) // detiene el spinner → muestra fallback "Sesión requerida"
        return
      }
      setUser(user)
      setLoadingAuth(false)
    }
    checkAuth()
  }, [])

  // ── Cargar opciones del día cuando el usuario esté disponible ─────────────
  useEffect(() => {
    if (!user?.email) return
    loadTodayOptions(user.email)
  }, [user])

  const loadTodayOptions = async (email: string) => {
    setLoadingOptions(true)
    const today = new Date().toISOString().split('T')[0]

    try {
      // 1. Reservas del usuario que inician o terminan hoy
      const { data: reservations, error: rErr } = await supabase
        .schema('fleet').from('vehicle_reservations')
        .select('*')
        .eq('user_email', email)
        .or(`start_date.eq.${today},end_date.eq.${today}`)

      if (rErr || !reservations?.length) {
        setTodayOptions([])
        setLoadingOptions(false)
        return
      }

      // 2. Inspecciones ya completadas para esas reservas
      const resIds = reservations.map((r: Reservation) => r.id)
      const { data: inspections } = await supabase
        .schema('fleet').from('vehicle_inspections')
        .select('reservation_id, inspection_type, submitted_at')
        .in('reservation_id', resIds)

      const doneSet = new Set(
        (inspections || [])
          .filter((i: { submitted_at: string | null }) => i.submitted_at !== null)
          .map((i: { reservation_id: string; inspection_type: string }) => `${i.reservation_id}-${i.inspection_type}`)
      )

      // 3. Construir opciones
      const opts: TodayOption[] = []
      for (const res of reservations as Reservation[]) {
        if (res.start_date === today) {
          opts.push({
            reservation: res,
            type: 'recepcion',
            alreadyDone: doneSet.has(`${res.id}-recepcion`),
          })
        }
        if (res.end_date === today) {
          opts.push({
            reservation: res,
            type: 'devolucion',
            alreadyDone: doneSet.has(`${res.id}-devolucion`),
          })
        }
      }
      setTodayOptions(opts)
    } catch {
      setTodayOptions([])
    } finally {
      setLoadingOptions(false)
    }
  }

  // ── Actualizar categoría ──────────────────────────────────────────────────
  const updateCategory = (key: CategoryKey, data: Partial<InspectionCategories[CategoryKey]>) => {
    setCategories((prev) => ({ ...prev, [key]: { ...prev[key], ...data } }))
  }

  // ── Guardar paso ──────────────────────────────────────────────────────────
  const saveStep = async (
    stepNumber: number,
    extraData: Record<string, unknown> = {}
  ): Promise<boolean> => {
    if (!reservation || !inspectionType) return false
    setSaving(true)
    setError('')
    try {
      const catPayload: Record<string, unknown> = {}
      const catKeys: CategoryKey[] = ['cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'cat6']
      catKeys.forEach((k) => {
        catPayload[`${k}_status`] = categories[k].status
        catPayload[`${k}_issues`] = categories[k].issues
        catPayload[`${k}_other`] = categories[k].other || null
      })

      const body: Record<string, unknown> = {
        reservation_id: reservation.id,
        inspection_type: inspectionType,
        step_completed: stepNumber,
        ...catPayload,
        ...extraData,
      }
      if (inspectionId) body.inspection_id = inspectionId

      const res = await fetch('/api/inspections/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al guardar')
      if (json.id && !inspectionId) {
        setInspectionId(json.id)
        sessionStorage.setItem('insp_id', json.id)
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar. Intenta de nuevo.')
      return false
    } finally {
      setSaving(false)
    }
  }

  // ── Iniciar inspección ────────────────────────────────────────────────────
  const handleSelect = (res: Reservation, type: InspectionType) => {
    setReservation(res)
    setInspectionType(type)
    setCategories(getDefaultCategories())
    setInspectionId(null)
    if (type === 'recepcion') {
      setShowTerms(true)  // mostrar términos antes de las categorías
      setStep(0)
    } else {
      setShowTerms(false)
      setStep(1)          // devolución va directo a categorías
    }
  }

  // Mapea el step real → step de display y total según tipo de inspección
  // Recepción muestra cat1, cat3, cat5, cat6, fotos (5 pasos); devolución muestra todos (7 pasos)
  const RECEPCION_MAP: Record<number, number> = { 1: 1, 3: 2, 5: 3, 6: 4, 7: 5 }
  const getDisplayStep = (s: number) => {
    if (inspectionType === 'recepcion') return { display: RECEPCION_MAP[s] ?? s, total: 5 }
    return { display: s, total: 7 }
  }

  const handleCategoryNext = async (catIndex: number) => {
    const ok = await saveStep(catIndex)
    if (!ok) return
    if (inspectionType === 'recepcion') {
      if (catIndex === 1) setStep(3)       // saltar cat2
      else if (catIndex === 3) setStep(5)  // saltar cat4
      else setStep(catIndex + 1)
    } else {
      setStep(catIndex + 1)
    }
  }

  const handleCategoryBack = (catIndex: number) => {
    if (inspectionType === 'recepcion') {
      if (catIndex === 1) setShowTerms(true)  // volver a términos
      else if (catIndex === 3) setStep(1)     // saltar cat2 hacia atrás
      else if (catIndex === 5) setStep(3)     // saltar cat4 hacia atrás
      else setStep(catIndex - 1)
    } else {
      // devolución: cat1 vuelve a la selección
      setStep(catIndex - 1)
    }
  }

  const handlePhotosFinish = async (photoUrls: Record<string, string>, km: number | null) => {
    const ok = await saveStep(7, {
      ...photoUrls,
      submitted_at: new Date().toISOString(),
      ...(km !== null ? { kilometraje: km } : {}),
    })
    if (ok) setStep(8)
  }

  const handleReset = () => {
    setStep(0)
    setShowTerms(false)
    setReservation(null)
    setInspectionType(null)
    setInspectionId(null)
    setCategories(getDefaultCategories())
    setError('')
    sessionStorage.removeItem('insp_id')
    if (user?.email) loadTodayOptions(user.email)
  }

  // ── Pantalla de carga ─────────────────────────────────────────────────────
  if (loadingAuth || loadingOptions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="text-primary animate-spin mx-auto mb-3" />
          <p className="text-stone-500 font-medium text-sm">
            {loadingAuth ? 'Verificando sesión...' : 'Cargando tus reservas de hoy...'}
          </p>
        </div>
      </div>
    )
  }

  // ── Sin sesión (fallback — normalmente ya redirigió) ──────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <LogIn size={40} className="text-primary mx-auto mb-3" />
          <h2 className="text-xl font-black text-stone-900 mb-2">Sesión requerida</h2>
          <p className="text-stone-500 text-sm mb-6">
            Debes iniciar sesión con tu cuenta Microsoft para acceder a esta sección.
          </p>
          <Link href="/" className="px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all">
            Iniciar Sesión
          </Link>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">
      {/* Header */}
      <header className="bg-white shadow-md border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href={(step > 0 || showTerms) ? '#' : '/calendar'}
            onClick={(step > 0 || showTerms) ? (e) => { e.preventDefault(); handleReset() } : undefined}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium hidden sm:block">
              {(step > 0 || showTerms) ? 'Cancelar inspección' : 'Calendario'}
            </span>
          </Link>
          <div className="text-center">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Amazonia Emprende</p>
            <p className="text-base font-black text-stone-900 leading-tight">Inspección Vehicular</p>
          </div>
          <div className="w-28 sm:w-36" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Barra de progreso */}
        {step >= 1 && step <= 7 && (() => {
          const { display, total } = getDisplayStep(step)
          return (
            <div className="mb-4">
              <ProgressBar step={display} total={total} />
              <p className="text-xs text-stone-400 text-right">{display} de {total} pasos</p>
            </div>
          )
        })()}

        {/* Error global */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-3">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 font-medium flex-1">{error}</p>
            <button onClick={() => setError('')}>
              <X size={14} className="text-red-400 hover:text-red-600" />
            </button>
          </div>
        )}

        {/* Pasos */}
        {step === 0 && !showTerms && user && (
          <ScreenSelection
            user={user}
            options={todayOptions}
            onSelect={handleSelect}
          />
        )}

        {step === 0 && showTerms && reservation && inspectionType && (
          <StepTerms
            isMoto={VEHICLE_MAP[reservation.vehicle_id]?.type === 'moto'}
            reservation={reservation}
            onAccept={() => { setShowTerms(false); setStep(1) }}
            onBack={() => { setShowTerms(false); setReservation(null); setInspectionType(null) }}
          />
        )}

        {step >= 1 && step <= 6 && reservation && inspectionType && (() => {
          const { display, total } = getDisplayStep(step)
          return (
            <StepCategory
              catIndex={step}
              displayStep={display}
              displayTotal={total}
              categories={categories}
              onChange={updateCategory}
              onNext={() => handleCategoryNext(step)}
              onBack={() => handleCategoryBack(step)}
              saving={saving}
              inspectionType={inspectionType}
            />
          )
        })()}

        {step === 7 && reservation && inspectionType && (
          <Step7Photos
            reservation={reservation}
            inspectionType={inspectionType}
            onFinish={handlePhotosFinish}
            onBack={() => setStep(6)}
            saving={saving}
          />
        )}

        {step === 8 && reservation && inspectionType && (
          <StepConfirmation
            reservation={reservation}
            inspectionType={inspectionType}
            categories={categories}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  )
}
