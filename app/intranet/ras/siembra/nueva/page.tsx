'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { supabase } from '@/lib/supabase'
import { familiaSchema, type FamiliaForm } from '@/lib/ras-schema'
import {
  ArrowLeft, ArrowRight, Check, Plus, Trash2,
  Upload, FileArchive, X, Loader2, Camera, Image as ImageIcon,
  Leaf, Users, Trees, MapPin, Activity, AlertCircle,
} from 'lucide-react'

// ─── Constantes ───────────────────────────────────────────────────────────────

const PRIMARY = '#0d7377'

const STEPS = [
  { label: 'Info Base',    icon: <Users    size={14} /> },
  { label: 'Restauración', icon: <Trees    size={14} /> },
  { label: 'Archivos SHP', icon: <MapPin   size={14} /> },
  { label: 'Monitoreos',   icon: <Activity size={14} /> },
  { label: 'Cámaras',      icon: <Camera   size={14} /> },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
      <AlertCircle size={11} /> {message}
    </p>
  )
}

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-bold text-stone-700 mb-1.5">
      {children}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
}

const inputCls    = 'w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-xl focus:outline-none focus:border-primary bg-white transition-colors'
const inputErrCls = 'w-full px-3 py-2 text-sm border-2 border-red-300 rounded-xl focus:outline-none focus:border-red-500 bg-white transition-colors'

// ─── PhotoPreview — revoca la URL al desmontar (evita memory leak) ─────────────

function PhotoPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  if (!url) return null
  return (
    <div className="relative group">
      <img src={url} alt={file.name} className="w-16 h-16 object-cover rounded-lg border border-stone-200" />
      <button type="button" onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <X size={10} />
      </button>
    </div>
  )
}

// ─── Dropzone ─────────────────────────────────────────────────────────────────

function Dropzone({ label, file, onFile, accept = '.zip' }: {
  label: string; file: File | null; onFile: (f: File | null) => void; accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.zip')) onFile(f)
  }

  return (
    <div>
      <Label>{label}</Label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          dragging ? 'border-primary bg-primary/5' : 'border-stone-300 hover:border-primary hover:bg-stone-50'
        }`}
      >
        <input ref={inputRef} type="file" accept={accept} className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <div className="flex items-center gap-3 w-full">
            <FileArchive size={28} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-stone-800 text-sm truncate">{file.name}</p>
              <p className="text-xs text-stone-400">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onFile(null) }}
              className="text-stone-400 hover:text-red-500 transition-colors">
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={28} className="text-stone-300" />
            <p className="text-sm font-semibold text-stone-500">Arrastra el archivo .zip aquí o haz clic</p>
            <p className="text-xs text-stone-400">Solo archivos .zip con shapefile incluido</p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Barra de progreso ────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border-2 transition-all ${
              i < step ? 'bg-primary border-primary text-white' : i === step ? 'border-primary text-primary bg-white' : 'border-stone-200 text-stone-300 bg-white'
            }`}>
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:block ${
              i === step ? 'text-primary' : i < step ? 'text-stone-600' : 'text-stone-300'
            }`}>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(step / (total - 1)) * 100}%`, backgroundColor: PRIMARY }} />
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function NuevaSiembraPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Archivos fuera de RHF (File no es serializable por Zod)
  const [shpFinca, setShpFinca] = useState<File | null>(null)
  const [shpRestauracion, setShpRestauracion] = useState<File | null>(null)
  // Fotos por cámara: Record<índice_cámara, File[]>
  const [fotosPorCamara, setFotosPorCamara] = useState<Record<number, File[]>>({})

  const form = useForm<FamiliaForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: standardSchemaResolver(familiaSchema) as any,
    defaultValues: {
      municipio: '', vereda: '', nombre_finca: '', nombre_propietario: '',
      adultos: 0, ninos: 0,
      ha_potreros: 0, ha_bosque: 0, ha_otras: 0,
      bajo_conservacion: false, empleos_locales: 0,
      plan_restauracion: '',
      ha_restauracion: 0, parcelas_monitoreo: 0,
      plantulas_sembradas: 0, especies_sembradas: 0,
      monitoreos: [], camaras: [],
    },
  })

  const { fields: monitoreoFields, append: appendMonitoreo, remove: removeMonitoreo } =
    useFieldArray({ control: form.control, name: 'monitoreos' })

  const { fields: camaraFields, append: appendCamara, remove: removeCamara } =
    useFieldArray({ control: form.control, name: 'camaras' })

  const { register, control, formState: { errors }, trigger, handleSubmit } = form

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase
        .from('user_profiles').select('is_admin, department').eq('email', user.email).single()
      if (!profile?.is_admin && profile?.department !== 'RAS') { router.push('/'); return }
      setUserEmail(user.email ?? null)
      setAuthReady(true)
    })
  }, [router])

  // ── Avanzar paso con validación parcial ──
  const STEP_FIELDS: (keyof FamiliaForm)[][] = [
    ['municipio', 'nombre_propietario', 'adultos', 'ninos', 'ha_potreros', 'ha_bosque', 'ha_otras', 'empleos_locales'],
    ['ha_restauracion', 'parcelas_monitoreo', 'plantulas_sembradas', 'especies_sembradas'],
    [], // archivos no se validan con RHF
    ['monitoreos'],
    ['camaras'],
  ]

  const nextStep = async () => {
    const fields = STEP_FIELDS[step]
    const valid = fields.length === 0 || await trigger(fields)
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const prevStep = () => setStep((s) => Math.max(s - 1, 0))

  // ── Eliminar cámara re-indexando fotosPorCamara ──────────────────────────
  const removeCamera = (i: number) => {
    removeCamara(i)
    setFotosPorCamara((prev) => {
      const next: Record<number, File[]> = {}
      Object.entries(prev).forEach(([key, files]) => {
        const k = Number(key)
        if (k < i) next[k] = files
        else if (k > i) next[k - 1] = files
        // k === i → se elimina
      })
      return next
    })
  }

  // ── Submit ──
  const onSubmit = async (data: FamiliaForm) => {
    if (!userEmail) return
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('data', JSON.stringify({ ...data, created_by: userEmail }))
      if (shpFinca) formData.append('shp_finca', shpFinca)
      if (shpRestauracion) formData.append('shp_restauracion', shpRestauracion)

      Object.entries(fotosPorCamara).forEach(([idx, files]) => {
        files.forEach((f) => formData.append(`camara_${idx}_foto`, f))
      })

      const res = await fetch('/api/ras/familias', { method: 'POST', body: formData })
      if (res.ok) {
        router.push('/intranet/ras/siembra')
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Error al guardar. Intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 size={36} className="text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">

      {/* ── Header ── */}
      <header className="bg-white shadow-md border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <Link href="/intranet/ras/siembra"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-primary hover:text-primary hover:bg-primary/5 transition-all shrink-0">
              <ArrowLeft size={16} />
              <span className="hidden sm:block">Volver</span>
            </Link>
            <div className="text-center flex-1">
              <div className="inline-flex items-center gap-2">
                <Leaf size={18} className="text-primary" />
                <h1 className="text-xl font-black text-stone-900">Nueva Familia en Restauración</h1>
              </div>
            </div>
            <div className="w-[80px]" />
          </div>
          <ProgressBar step={step} total={STEPS.length} />
        </div>
      </header>

      {/* ── Formulario ── */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6">
        <form onSubmit={handleSubmit(onSubmit)}>

          {/* ── PASO 1: Info Base ── */}
          {step === 0 && (
            <div className="space-y-6">
              <SectionTitle icon={<Users size={18} />} title="Información Base y Socioeconomía" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label required>Municipio</Label>
                  <input {...register('municipio')} className={errors.municipio ? inputErrCls : inputCls} placeholder="Ej: Florencia" />
                  <FieldError message={errors.municipio?.message} />
                </div>
                <div>
                  <Label>Vereda</Label>
                  <input {...register('vereda')} className={inputCls} placeholder="Ej: El Paraíso" />
                </div>
                <div>
                  <Label>Nombre de la finca</Label>
                  <input {...register('nombre_finca')} className={inputCls} placeholder="Ej: La Esperanza" />
                </div>
                <div>
                  <Label required>Nombre del propietario/a</Label>
                  <input {...register('nombre_propietario')} className={errors.nombre_propietario ? inputErrCls : inputCls} placeholder="Nombre completo" />
                  <FieldError message={errors.nombre_propietario?.message} />
                </div>
              </div>

              <Divider label="Composición familiar" />
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <Label># Adultos</Label>
                  <input type="number" min={0} {...register('adultos')} className={inputCls} />
                  <FieldError message={errors.adultos?.message} />
                </div>
                <div>
                  <Label># Niños</Label>
                  <input type="number" min={0} {...register('ninos')} className={inputCls} />
                  <FieldError message={errors.ninos?.message} />
                </div>
              </div>

              <Divider label="Uso del suelo (hectáreas)" />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Potreros</Label>
                  <input type="number" min={0} step="0.01" {...register('ha_potreros')} className={inputCls} />
                  <FieldError message={errors.ha_potreros?.message} />
                </div>
                <div>
                  <Label>Bosque</Label>
                  <input type="number" min={0} step="0.01" {...register('ha_bosque')} className={inputCls} />
                  <FieldError message={errors.ha_bosque?.message} />
                </div>
                <div>
                  <Label>Otras</Label>
                  <input type="number" min={0} step="0.01" {...register('ha_otras')} className={inputCls} />
                  <FieldError message={errors.ha_otras?.message} />
                </div>
              </div>

              <Divider label="Otros datos" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label>Empleos locales generados</Label>
                  <input type="number" min={0} {...register('empleos_locales')} className={inputCls} />
                  <FieldError message={errors.empleos_locales?.message} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Controller control={control} name="bajo_conservacion" render={({ field }) => (
                    <div onClick={() => field.onChange(!field.value)}
                      className={`w-11 h-6 rounded-full flex items-center px-0.5 cursor-pointer transition-colors shrink-0 ${field.value ? 'bg-primary' : 'bg-stone-300'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${field.value ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  )} />
                  <span className="text-sm font-semibold text-stone-700">Bajo figura de conservación</span>
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 2: Restauración ── */}
          {step === 1 && (
            <div className="space-y-6">
              <SectionTitle icon={<Trees size={18} />} title="Datos de Restauración" />

              <div>
                <Label>Plan de restauración</Label>
                <textarea {...register('plan_restauracion')} rows={3} className={inputCls}
                  placeholder="Descripción del plan o enlace al documento..." />
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <Label required>Ha. en restauración</Label>
                  <input type="number" min={0} step="0.01" {...register('ha_restauracion')}
                    className={errors.ha_restauracion ? inputErrCls : inputCls} />
                  <FieldError message={errors.ha_restauracion?.message} />
                </div>
                <div>
                  <Label>Parcelas de monitoreo</Label>
                  <input type="number" min={0} {...register('parcelas_monitoreo')} className={inputCls} />
                </div>
                <div>
                  <Label>Plántulas sembradas</Label>
                  <input type="number" min={0} {...register('plantulas_sembradas')} className={inputCls} />
                </div>
                <div>
                  <Label>Especies sembradas</Label>
                  <input type="number" min={0} {...register('especies_sembradas')} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 3: Shapefiles ── */}
          {step === 2 && (
            <div className="space-y-6">
              <SectionTitle icon={<MapPin size={18} />} title="Archivos Espaciales (Shapefiles)" />
              <p className="text-sm text-stone-500">
                Sube los polígonos en formato .zip que contengan el shapefile (.shp) y sus archivos asociados (.dbf, .prj, .shx).
              </p>
              <Dropzone label="Polígono total de la finca" file={shpFinca} onFile={setShpFinca} />
              <Dropzone label="Polígono en restauración" file={shpRestauracion} onFile={setShpRestauracion} />
            </div>
          )}

          {/* ── PASO 4: Monitoreos ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <SectionTitle icon={<Activity size={18} />} title="Monitoreos" />
                <button type="button" onClick={() => appendMonitoreo({ fecha: '', supervivencia_pct: 0 })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: PRIMARY }}>
                  <Plus size={14} /> Agregar
                </button>
              </div>

              {monitoreoFields.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-stone-400 gap-3 border-2 border-dashed border-stone-200 rounded-2xl">
                  <Activity size={32} className="text-stone-300" />
                  <p className="text-sm font-semibold">Sin monitoreos registrados</p>
                  <p className="text-xs">Usa el botón <strong>Agregar</strong> para añadir eventos.</p>
                </div>
              )}

              <div className="space-y-3">
                {monitoreoFields.map((field, i) => (
                  <div key={field.id} className="flex items-start gap-3 p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
                    <span className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center text-white shrink-0 mt-1"
                      style={{ backgroundColor: PRIMARY }}>{i + 1}</span>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <Label>Fecha</Label>
                        <input type="date" {...register(`monitoreos.${i}.fecha`)}
                          className={errors.monitoreos?.[i]?.fecha ? inputErrCls : inputCls} />
                        <FieldError message={errors.monitoreos?.[i]?.fecha?.message} />
                      </div>
                      <div>
                        <Label>% Supervivencia</Label>
                        <input type="number" min={0} max={100} step={0.1}
                          {...register(`monitoreos.${i}.supervivencia_pct`)}
                          className={errors.monitoreos?.[i]?.supervivencia_pct ? inputErrCls : inputCls} />
                        <FieldError message={errors.monitoreos?.[i]?.supervivencia_pct?.message} />
                      </div>
                    </div>
                    <button type="button" onClick={() => removeMonitoreo(i)}
                      className="text-stone-400 hover:text-red-500 transition-colors mt-1 shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PASO 5: Cámaras Trampa ── */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <SectionTitle icon={<Camera size={18} />} title="Biodiversidad / Cámaras Trampa" />
                <button type="button" onClick={() => appendCamara({ nombre: '', latitud: 0, longitud: 0 })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: PRIMARY }}>
                  <Plus size={14} /> Agregar cámara
                </button>
              </div>

              {camaraFields.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-stone-400 gap-3 border-2 border-dashed border-stone-200 rounded-2xl">
                  <Camera size={32} className="text-stone-300" />
                  <p className="text-sm font-semibold">Sin cámaras trampa</p>
                  <p className="text-xs">Agrega cámaras para registrar capturas de biodiversidad.</p>
                </div>
              )}

              <div className="space-y-4">
                {camaraFields.map((field, i) => (
                  <div key={field.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-stone-100 bg-stone-50">
                      <Camera size={16} className="text-primary" />
                      <span className="font-black text-stone-700 text-sm">Cámara {i + 1}</span>
                      <button type="button" onClick={() => removeCamera(i)}
                        className="ml-auto text-stone-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="sm:col-span-1">
                          <Label required>Nombre / ID</Label>
                          <input {...register(`camaras.${i}.nombre`)}
                            className={errors.camaras?.[i]?.nombre ? inputErrCls : inputCls}
                            placeholder="Ej: CT-001" />
                          <FieldError message={errors.camaras?.[i]?.nombre?.message} />
                        </div>
                        <div>
                          <Label>Latitud</Label>
                          <input type="number" step="any" {...register(`camaras.${i}.latitud`)}
                            className={inputCls} placeholder="Ej: 1.2345" />
                        </div>
                        <div>
                          <Label>Longitud</Label>
                          <input type="number" step="any" {...register(`camaras.${i}.longitud`)}
                            className={inputCls} placeholder="Ej: -75.4321" />
                        </div>
                      </div>

                      {/* Upload de fotos */}
                      <div>
                        <Label>Fotografías de captura</Label>
                        <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-stone-300 hover:border-primary hover:bg-stone-50 cursor-pointer transition-all">
                          <input type="file" multiple accept="image/jpeg,image/png,image/jpg" className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? [])
                              setFotosPorCamara((prev) => ({
                                ...prev,
                                [i]: [...(prev[i] ?? []), ...files],
                              }))
                              e.target.value = ''
                            }} />
                          <ImageIcon size={22} className="text-stone-300" />
                          <p className="text-xs font-semibold text-stone-500">Haz clic para seleccionar imágenes (jpg/png)</p>
                        </label>

                        {(fotosPorCamara[i] ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {(fotosPorCamara[i] ?? []).map((f, fi) => (
                              <PhotoPreview key={fi} file={f}
                                onRemove={() => setFotosPorCamara((prev) => ({
                                  ...prev,
                                  [i]: prev[i].filter((_, idx) => idx !== fi),
                                }))} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Navegación ── */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-stone-200">
            <button type="button" onClick={prevStep} disabled={step === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-stone-400 hover:text-stone-800 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <ArrowLeft size={15} /> Anterior
            </button>

            {step < STEPS.length - 1 ? (
              <button type="button" onClick={nextStep}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:shadow-md transition-all"
                style={{ backgroundColor: PRIMARY }}>
                Siguiente <ArrowRight size={15} />
              </button>
            ) : (
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60"
                style={{ backgroundColor: PRIMARY }}>
                {submitting ? <><Loader2 size={15} className="animate-spin" /> Guardando…</> : <><Check size={15} /> Guardar Familia</>}
              </button>
            )}
          </div>

        </form>
      </main>
    </div>
  )
}

// ─── Sub-componentes de layout ────────────────────────────────────────────────

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <span className="text-primary">{icon}</span>
      <h2 className="text-lg font-black text-stone-900">{title}</h2>
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="flex-1 h-px bg-stone-200" />
      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-stone-200" />
    </div>
  )
}
