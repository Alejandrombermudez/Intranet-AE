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

const FOTO_CATS = [
  { key: 'predio',   label: 'Predio',   min: 3 },
  { key: 'familia',  label: 'Familia',  min: 2 },
  { key: 'arboles',  label: 'Árboles',  min: 3 },
  { key: 'otras',    label: 'Otras',    min: 2 },
]

const STEPS = [
  { label: 'Identificación',    icon: <Users     size={14} /> },
  { label: 'Hogar & Economía',  icon: <Users     size={14} /> },
  { label: 'Predio',            icon: <Trees     size={14} /> },
  { label: 'Restauración',      icon: <Leaf      size={14} /> },
  { label: 'Archivos SHP',      icon: <MapPin    size={14} /> },
  { label: 'Fotos Predio',      icon: <ImageIcon size={14} /> },
  { label: 'Monitoreos',        icon: <Activity  size={14} /> },
  { label: 'Cámaras',           icon: <Camera    size={14} /> },
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

// ─── FotoCatCard — tarjeta por categoría (useRef propio, evita hook en map) ───

function FotoCatCard({
  catKey, label, min, files, onAdd, onRemove,
}: {
  catKey: string; label: string; min: number
  files: File[]; onAdd: (fs: File[]) => void; onRemove: (i: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const ok = files.length >= min
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-stone-100 bg-stone-50">
        <span className="font-black text-stone-700 text-sm">{label}</span>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
          {files.length}/{min}
        </span>
      </div>
      <div className="p-4 space-y-3">
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, fi) => (
              <PhotoPreview key={fi} file={f} onRemove={() => onRemove(fi)} />
            ))}
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => {
            const newFiles = Array.from(e.target.files ?? [])
            if (newFiles.length) onAdd(newFiles)
            e.target.value = ''
          }} />
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border-2 border-stone-200 text-stone-600 hover:border-primary hover:text-primary transition-all">
          <Plus size={13} /> Agregar fotos
        </button>
      </div>
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
  const [fotosWarning, setFotosWarning] = useState(false)

  // Archivos fuera de RHF (File no es serializable por Zod)
  const [shpFinca, setShpFinca] = useState<File | null>(null)
  const [shpRestauracion, setShpRestauracion] = useState<File | null>(null)
  const [shpArboles, setShpArboles] = useState<File | null>(null)
  const [docAcuerdo, setDocAcuerdo] = useState<File | null>(null)
  // Fotos por categoría de predio
  const [fotosPredioCat, setFotosPredioCat] = useState<Record<string, File[]>>({})
  // Fotos por cámara: Record<índice_cámara, File[]>
  const [fotosPorCamara, setFotosPorCamara] = useState<Record<number, File[]>>({})

  const form = useForm<FamiliaForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: standardSchemaResolver(familiaSchema) as any,
    defaultValues: {
      municipio: '', vereda: '', nombre_finca: '', nombre_propietario: '',
      tipo_documento: '', numero_documento: '', telefono: '',
      nucleo: '', departamento: '',
      adultos: 0, ninos: 0,
      cant_mujeres: 0, cant_hombres: 0,
      actividad_economica: '',
      tiene_espacio_vegetal: false,
      empleos_locales: 0,
      ha_potreros: 0, ha_bosque: 0, ha_otras: 0,
      bajo_conservacion: false,
      num_individuos: 0, num_especies_inventario: 0,
      area_bosque_recorrida: 0,
      distancia_florencia_km: 0, tiempo_florencia_min: 0,
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
        .schema('people').from('user_profiles').select('is_admin, department').eq('email', user.email).single()
      if (!profile?.is_admin && profile?.department !== 'RAS') { router.push('/'); return }
      setUserEmail(user.email ?? null)
      setAuthReady(true)
    })
  }, [router])

  // ── Avanzar paso con validación parcial ──
  const STEP_FIELDS: (keyof FamiliaForm)[][] = [
    ['nombre_propietario', 'municipio'],                                     // 0: Identificación
    ['adultos', 'ninos', 'cant_mujeres', 'cant_hombres', 'empleos_locales'], // 1: Hogar & Economía
    ['ha_bosque', 'ha_potreros', 'ha_otras'],                                // 2: Predio & Inventario
    ['ha_restauracion', 'parcelas_monitoreo', 'plantulas_sembradas', 'especies_sembradas'], // 3: Restauración
    [],  // 4: Archivos SHP
    [],  // 5: Fotos Predio
    ['monitoreos'],                                                           // 6: Monitoreos
    ['camaras'],                                                              // 7: Cámaras
  ]

  const nextStep = async () => {
    const fields = STEP_FIELDS[step]
    const valid = fields.length === 0 || await trigger(fields)
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const prevStep = () => setStep((s) => Math.max(s - 1, 0))

  // ── Fotos predio helpers ──
  const addFotosPredioCat = (cat: string, files: File[]) => {
    setFotosPredioCat((prev) => ({ ...prev, [cat]: [...(prev[cat] ?? []), ...files] }))
  }
  const removeFotoPredioCat = (cat: string, idx: number) => {
    setFotosPredioCat((prev) => ({ ...prev, [cat]: (prev[cat] ?? []).filter((_, i) => i !== idx) }))
  }

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

  // ── Verificar mínimos de fotos predio ──
  const underMinCats = FOTO_CATS.filter((c) => (fotosPredioCat[c.key] ?? []).length < c.min)

  // ── Submit interno ──
  const doSubmit = async (data: FamiliaForm) => {
    if (!userEmail) return
    setSubmitting(true)
    setFotosWarning(false)
    try {
      const formData = new FormData()
      formData.append('data', JSON.stringify({ ...data, created_by: userEmail }))
      if (shpFinca) formData.append('shp_finca', shpFinca)
      if (shpRestauracion) formData.append('shp_restauracion', shpRestauracion)
      if (shpArboles) formData.append('shp_arboles', shpArboles)
      if (docAcuerdo) formData.append('doc_acuerdo', docAcuerdo)

      FOTO_CATS.forEach(({ key }) => {
        (fotosPredioCat[key] ?? []).forEach((f, i) => formData.append(`foto_${key}_${i}`, f))
      })

      Object.entries(fotosPorCamara).forEach(([idx, files]) => {
        files.forEach((f) => formData.append(`camara_${idx}_foto`, f))
      })

      const res = await fetch('/api/ras/familias', { method: 'POST', body: formData })
      if (res.ok) {
        router.push('/intranet/ras/siembra')
      } else {
        const rawBody = await res.text().catch(() => '')
        let errMsg = `Error ${res.status}`
        try {
          const parsed = JSON.parse(rawBody)
          errMsg = parsed.error ?? parsed.message ?? rawBody.slice(0, 300) ?? errMsg
        } catch {
          errMsg = `Error ${res.status}: ${rawBody.slice(0, 300) || '(sin respuesta del servidor)'}`
        }
        alert(errMsg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit ──
  const onSubmit = async (data: FamiliaForm) => {
    if (underMinCats.length > 0) {
      setFotosWarning(true)
      // store data for confirmed submit via ref workaround — use closure
      pendingDataRef.current = data
      return
    }
    await doSubmit(data)
  }

  const pendingDataRef = useRef<FamiliaForm | null>(null)

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

          {/* ── PASO 1: Identificación ── */}
          {step === 0 && (
            <div className="space-y-6">
              <SectionTitle icon={<Users size={18} />} title="Identificación del propietario/a" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <Label required>Nombre completo del propietario/a</Label>
                  <input {...register('nombre_propietario')} className={errors.nombre_propietario ? inputErrCls : inputCls} placeholder="Nombre completo" />
                  <FieldError message={errors.nombre_propietario?.message} />
                </div>
                <div>
                  <Label>Tipo de documento</Label>
                  <select {...register('tipo_documento')} className={inputCls}>
                    <option value="">— Seleccionar —</option>
                    <option value="CC">CC – Cédula de Ciudadanía</option>
                    <option value="NUIP">NUIP – Número Único de Identificación Personal</option>
                    <option value="CE">CE – Cédula de Extranjería</option>
                    <option value="TI">TI – Tarjeta de Identidad</option>
                    <option value="PP">PP – Pasaporte</option>
                    <option value="NIT">NIT</option>
                  </select>
                </div>
                <div>
                  <Label>Número de identificación</Label>
                  <input {...register('numero_documento')} className={inputCls} placeholder="Ej: 17634957, Florencia" />
                </div>
                <div>
                  <Label>Teléfono de contacto</Label>
                  <input {...register('telefono')} className={inputCls} placeholder="Ej: 3101234567" />
                </div>
              </div>

              <Divider label="Ubicación del predio" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label>Núcleo</Label>
                  <input {...register('nucleo')} className={inputCls} placeholder="Ej: Piedemonte" />
                </div>
                <div>
                  <Label>Departamento</Label>
                  <input {...register('departamento')} className={inputCls} placeholder="Ej: Caquetá" />
                </div>
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
              </div>
            </div>
          )}

          {/* ── PASO 2: Hogar & Economía ── */}
          {step === 1 && (
            <div className="space-y-6">
              <SectionTitle icon={<Users size={18} />} title="Composición del hogar y actividad económica" />

              <Divider label="Personas en el predio" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                <div>
                  <Label># Mujeres</Label>
                  <input type="number" min={0} {...register('cant_mujeres')} className={inputCls} />
                  <FieldError message={errors.cant_mujeres?.message} />
                </div>
                <div>
                  <Label># Hombres</Label>
                  <input type="number" min={0} {...register('cant_hombres')} className={inputCls} />
                  <FieldError message={errors.cant_hombres?.message} />
                </div>
              </div>

              <Divider label="Economía" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <Label>Actividad económica principal</Label>
                  <input {...register('actividad_economica')} className={inputCls}
                    placeholder="Ej: Ganadería de leche, Forestal, Cultivos amazónicos…" />
                </div>
                <div>
                  <Label>Empleos locales generados</Label>
                  <input type="number" min={0} {...register('empleos_locales')} className={inputCls} />
                  <FieldError message={errors.empleos_locales?.message} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Controller control={control} name="tiene_espacio_vegetal" render={({ field }) => (
                    <div onClick={() => field.onChange(!field.value)}
                      className={`w-11 h-6 rounded-full flex items-center px-0.5 cursor-pointer transition-colors shrink-0 ${field.value ? 'bg-primary' : 'bg-stone-300'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${field.value ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  )} />
                  <span className="text-sm font-semibold text-stone-700">¿Tiene espacio para tratar material vegetal?</span>
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 3: Predio & Inventario ── */}
          {step === 2 && (
            <div className="space-y-6">
              <SectionTitle icon={<Trees size={18} />} title="Uso del suelo e inventario forestal" />

              <Divider label="Uso del suelo (hectáreas)" />
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Bosque</Label>
                  <input type="number" min={0} step="0.01" {...register('ha_bosque')} className={inputCls} />
                  <FieldError message={errors.ha_bosque?.message} />
                </div>
                <div>
                  <Label>Potreros</Label>
                  <input type="number" min={0} step="0.01" {...register('ha_potreros')} className={inputCls} />
                  <FieldError message={errors.ha_potreros?.message} />
                </div>
                <div>
                  <Label>Otras</Label>
                  <input type="number" min={0} step="0.01" {...register('ha_otras')} className={inputCls} />
                  <FieldError message={errors.ha_otras?.message} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Controller control={control} name="bajo_conservacion" render={({ field }) => (
                  <div onClick={() => field.onChange(!field.value)}
                    className={`w-11 h-6 rounded-full flex items-center px-0.5 cursor-pointer transition-colors shrink-0 ${field.value ? 'bg-primary' : 'bg-stone-300'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${field.value ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                )} />
                <span className="text-sm font-semibold text-stone-700">Bajo figura de conservación</span>
              </div>

              <Divider label="Inventario forestal" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>N.º de individuos (árboles)</Label>
                  <input type="number" min={0} {...register('num_individuos')} className={inputCls} placeholder="Ej: 82" />
                </div>
                <div>
                  <Label>N.º de especies (inventario)</Label>
                  <input type="number" min={0} {...register('num_especies_inventario')} className={inputCls} placeholder="Ej: 33" />
                </div>
                <div>
                  <Label>Área de bosque recorrida (ha)</Label>
                  <input type="number" min={0} step="0.1" {...register('area_bosque_recorrida')} className={inputCls} placeholder="Ej: 21" />
                </div>
              </div>

              <Divider label="Accesibilidad" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Distancia a Florencia / Morelia (km)</Label>
                  <input type="number" min={0} step="0.1" {...register('distancia_florencia_km')} className={inputCls} placeholder="Ej: 40" />
                </div>
                <div>
                  <Label>Tiempo de viaje (minutos)</Label>
                  <input type="number" min={0} {...register('tiempo_florencia_min')} className={inputCls} placeholder="Ej: 90" />
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 4: Restauración ── */}
          {step === 3 && (
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

          {/* ── PASO 5: Shapefiles ── */}
          {step === 4 && (
            <div className="space-y-6">
              <SectionTitle icon={<MapPin size={18} />} title="Archivos Espaciales (Shapefiles)" />
              <p className="text-sm text-stone-500">
                Sube los polígonos en formato .zip que contengan el shapefile (.shp) y sus archivos asociados (.dbf, .prj, .shx).
              </p>
              <Dropzone label="Polígono total de la finca" file={shpFinca} onFile={setShpFinca} />
              <Dropzone label="Polígono en restauración" file={shpRestauracion} onFile={setShpRestauracion} />
              <Dropzone label="Árboles — Shapefile de puntos (.zip)" file={shpArboles} onFile={setShpArboles} />
              <Dropzone label="Tratamiento de datos y acuerdo de conservación con AE (PDF, opcional)" file={docAcuerdo} onFile={setDocAcuerdo} accept=".pdf" />
            </div>
          )}

          {/* ── PASO 6: Fotos del Predio ── */}
          {step === 5 && (
            <div className="space-y-6">
              <SectionTitle icon={<ImageIcon size={18} />} title="Fotos del Predio" />
              <p className="text-sm text-stone-500">
                Sube fotos organizadas por categoría. Los mínimos recomendados se muestran en cada categoría.
              </p>

              {FOTO_CATS.map(({ key, label, min }) => (
                <FotoCatCard
                  key={key}
                  catKey={key}
                  label={label}
                  min={min}
                  files={fotosPredioCat[key] ?? []}
                  onAdd={(fs) => addFotosPredioCat(key, fs)}
                  onRemove={(i) => removeFotoPredioCat(key, i)}
                />
              ))}

            </div>
          )}

          {/* ── PASO 7: Monitoreos ── */}
          {step === 6 && (
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

          {/* ── PASO 8: Cámaras Trampa ── */}
          {step === 7 && (
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

          {/* Banner de advertencia fotos predio bajo mínimo */}
          {fotosWarning && underMinCats.length > 0 && (
            <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 space-y-3 mt-6">
              <p className="text-sm font-bold text-red-700">
                Las siguientes categorías están por debajo del mínimo recomendado:
              </p>
              <ul className="space-y-1">
                {underMinCats.map(({ key, label, min }) => (
                  <li key={key} className="text-xs text-red-600">
                    {label}: {(fotosPredioCat[key] ?? []).length}/{min}
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setFotosWarning(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border-2 border-red-300 text-red-700 hover:bg-red-100 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={async () => {
                    if (pendingDataRef.current) await doSubmit(pendingDataRef.current)
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin inline" /> : 'Subir de todas formas'}
                </button>
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
