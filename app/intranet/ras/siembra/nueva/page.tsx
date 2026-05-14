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
  Home, TrendingUp, Sprout, BookOpen, Handshake, Settings, Mountain,
} from 'lucide-react'

// ─── Constantes ───────────────────────────────────────────────────────────────

const PRIMARY = '#0d7377'

const STEPS = [
  { label: 'Datos Generales',  icon: <BookOpen   size={14} /> },  // 0
  { label: 'Predio',           icon: <MapPin      size={14} /> },  // 1
  { label: 'Vivienda',         icon: <Home        size={14} /> },  // 2
  { label: 'Familia',          icon: <Users       size={14} /> },  // 3
  { label: 'Economía',         icon: <TrendingUp  size={14} /> },  // 4
  { label: 'Uso del Suelo',    icon: <Trees       size={14} /> },  // 5
  { label: 'Cultivos',         icon: <Sprout      size={14} /> },  // 6
  { label: 'Ganadería',        icon: <Mountain    size={14} /> },  // 7
  { label: 'Tecnología',       icon: <Settings    size={14} /> },  // 8
  { label: 'Bosque & Clima',   icon: <Leaf        size={14} /> },  // 9
  { label: 'Relaciones',       icon: <Handshake   size={14} /> },  // 10
  { label: 'Restauración',     icon: <Sprout      size={14} /> },  // 11
  { label: 'Archivos',         icon: <FileArchive size={14} /> },  // 12
  { label: 'Fotos',            icon: <ImageIcon   size={14} /> },  // 13
  { label: 'Monitoreo',        icon: <Activity    size={14} /> },  // 14
  { label: 'Cámaras',          icon: <Camera      size={14} /> },  // 15
]

const FOTO_CATS = [
  { key: 'predio',  label: 'Predio',  min: 3 },
  { key: 'familia', label: 'Familia', min: 2 },
  { key: 'arboles', label: 'Árboles', min: 3 },
  { key: 'otras',   label: 'Otras',   min: 2 },
]

// Opciones de listas
const OPT = {
  tipoEncuestado:    ['Propietario', 'Arrendatario', 'Mayordomo', 'Trabajador'],
  tipoDoc:           ['CC', 'NUIP', 'CE', 'TI', 'PP', 'NIT'],
  estrato:           ['Sabana', 'Vega', 'Tierra firme intervención alta', 'Tierra firme intervención media', 'Tierra firme intervención baja'],
  tipoVia:           ['Pavimentada', 'Sin pavimentar', 'Río', 'Camino de herradura'],
  tipoAcceso:        ['Carro', 'Moto', 'Caballo', 'Pie', 'Canoa'],
  serviciosEnergia:  ['Energía eléctrica', 'Planta solar', 'Planta gasolina', 'No tiene'],
  fuenteAgua:        ['Acueducto veredal', 'Reservorios', 'Cuerpos de agua', 'Perforado/pozo', 'No tiene'],
  matTecho:          ['Zinc', 'Madera', 'Paja', 'Eternit', 'Otro'],
  matParedes:        ['Bahareque', 'Guadua', 'Madera', 'Ladrillo/Bloque', 'Otro'],
  matPiso:           ['Tierra', 'Cemento', 'Baldosa', 'Madera', 'Otro'],
  tipoCocina:        ['Fogón de leña', 'Estufa de carbón', 'Estufa a gasolina', 'Estufa de gas', 'Otro'],
  tipoBano:          ['Unidad sanitaria', 'Baño con taza', 'Ducha', 'Tanque de agua', 'Otro'],
  excretas:          ['Pozo séptico', 'Caño o río', 'Campo abierto', 'Alcantarillado'],
  basuras:           ['Quema', 'Hueco', 'Campo abierto', 'Clasifica/compost/reciclaje', 'Servicio de recolección'],
  tendencia:         ['Incrementado', 'Disminuido'],
  regimen:           ['Contributivo', 'Subsidiado'],
  causasVenta:       ['Orden público', 'Baja rentabilidad', 'Oferta de compra', 'Compra de otra finca'],
  ingresos:          ['< 1 SMLV', '> 1 SMLV', '< 5 SMLV', '> 5 SMLV'],
  destinoProd:       ['Consumo familiar', 'Venta local', 'Venta a intermediarios', 'Exportación'],
  cultivosBase:      ['Café', 'Cacao', 'Caña de azúcar', 'Plátano', 'Yuca', 'Frutales', 'Madera'],
  tenenciaGanado:    ['Propio', 'Arriendo de tierras', 'Pastoreo de terceros'],
  orientGanaderia:   ['Producción de leche', 'Doble propósito (carne y leche)', 'Cría y levante', 'Ceba'],
  tiposPasto:        ['Grama (criadero)', 'Mejorados', 'Corte', 'Silvopastoriles', 'Rastrojos'],
  destinoLeche:      ['Autoconsumo', 'Venta local', 'Venta a intermediarios', 'Venta a industria procesadora', 'Otro'],
  sistAlimentacion:  ['Pastoreo tradicional', 'Pastoreo rotacional', 'Pastoreo Voisin', 'Estabulado', 'Mixto'],
  fertGanado:        ['Química', 'Orgánica', 'Ninguna'],
  manejoPraderas:    ['Resiembra', 'Rotación de potreros', 'Control de malezas'],
  infraestructura:   ['Sala de ordeño', 'Corrales', 'Bebederos y comederos', 'Tanque de agua', 'Caminos adecuados'],
  matPostes:         ['Postes muertos', 'Madera', 'Concreto', 'Plástico', 'Otro'],
  origenPastos:      ['Bosque', 'Gramas'],
  manejoSuelo:       ['Orgánico', 'Convencional', 'Mixto'],
  tipoFert:          ['Química', 'Orgánica', 'Ninguna'],
  controlMalezas:    ['Manual', 'Químico', 'Mecánico'],
  problemasManejo:   ['Plagas', 'Enfermedades', 'Clima', 'Comercialización', 'Otro'],
  manejoAgua:        ['Riego', 'Secano', 'Otro'],
  causaCobertura:    ['Establecimiento de pasturas', 'Establecimiento de cultivos', 'Otros'],
  problemasAgrop:    ['Calidad de suelos', 'Inundación/exceso de lluvia', 'Sequía', 'Incendios', 'Plagas', 'Cambio climático', 'Carencia de vías', 'Falta de incentivos', 'Problemas de seguridad', 'Otros'],
  impacto:           ['Positivo', 'Negativo', 'No causó ningún cambio'],
  calGremios:        ['Suficiente', 'Insuficiente', 'No existe'],
  nivelEstudio:      ['Ninguno', 'Primaria', 'Secundaria', 'Técnico', 'Universitario', 'Posgrado'],
  tanqueEnfr:        ['Propio', 'Comunitario', 'Arrendado', 'No tiene'],
}

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

interface MiembroFamilia {
  parentesco: string; edad: string; sexo: string
  procedencia: string; residencia: string
  nivel_estudio: string; dias_finca: string; dias_fuera: string
}

interface CultivoRow {
  cultivo: string; area_ha: string; anio_siembra: string
  densidad: string; rendimiento: string; destino: string
}

interface EspeciePecuaria {
  tiene: boolean; cantidad: string; uso_propio: boolean; comercializacion: boolean
}

const emptyMiembro = (): MiembroFamilia =>
  ({ parentesco: '', edad: '', sexo: '', procedencia: '', residencia: '', nivel_estudio: '', dias_finca: '', dias_fuera: '' })

const emptyCultivo = (nombre = ''): CultivoRow =>
  ({ cultivo: nombre, area_ha: '', anio_siembra: '', densidad: '', rendimiento: '', destino: '' })

const emptyEspecie = (): EspeciePecuaria =>
  ({ tiene: false, cantidad: '', uso_propio: false, comercializacion: false })

// ─── Componentes UI reutilizables ─────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={11} /> {message}</p>
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-bold text-stone-700 mb-1.5">{children}</label>
}

const iCls = 'w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#0d7377] bg-white transition-colors'
const sCls = 'w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#0d7377] bg-white transition-colors'
const tCls = 'w-full px-3 py-2 text-sm border-2 border-stone-200 rounded-xl focus:outline-none focus:border-[#0d7377] bg-white transition-colors resize-none'

/** Botones pill multi-selección */
function ChkGroup({ opts, val, onChange }: { opts: string[]; val: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => val.includes(o) ? onChange(val.filter(x => x !== o)) : onChange([...val, o])
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map(o => (
        <button key={o} type="button" onClick={() => toggle(o)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${val.includes(o) ? 'border-[#0d7377] bg-[#0d7377] text-white' : 'border-stone-200 text-stone-600 hover:border-[#0d7377]/50'}`}>
          {o}
        </button>
      ))}
    </div>
  )
}

/** Botones pill selección única */
function RadioGrp({ opts, val, onChange }: { opts: string[]; val: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map(o => (
        <button key={o} type="button" onClick={() => onChange(val === o ? '' : o)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${val === o ? 'border-[#0d7377] bg-[#0d7377] text-white' : 'border-stone-200 text-stone-600 hover:border-[#0d7377]/50'}`}>
          {o}
        </button>
      ))}
    </div>
  )
}

/** Toggle Sí/No → boolean */
function YesNo({ val, onChange, label }: { val?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div onClick={() => onChange(!val)}
        className={`w-11 h-6 rounded-full flex items-center px-0.5 cursor-pointer transition-colors shrink-0 ${val ? 'bg-[#0d7377]' : 'bg-stone-300'}`}>
        <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${val ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm font-semibold text-stone-700">{label}</span>
    </div>
  )
}

function PhotoPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
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

function FotoCatCard({ catKey, label, min, files, onAdd, onRemove }: {
  catKey: string; label: string; min: number
  files: File[]; onAdd: (fs: File[]) => void; onRemove: (i: number) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
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
            {files.map((f, fi) => <PhotoPreview key={fi} file={f} onRemove={() => onRemove(fi)} />)}
          </div>
        )}
        <input ref={ref} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) onAdd(fs); e.target.value = '' }} />
        <button type="button" onClick={() => ref.current?.click()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border-2 border-stone-200 text-stone-600 hover:border-[#0d7377] hover:text-[#0d7377] transition-all">
          <Plus size={13} /> Agregar fotos
        </button>
      </div>
    </div>
  )
}

function Dropzone({ label, file, onFile, accept = '.zip' }: {
  label: string; file: File | null; onFile: (f: File | null) => void; accept?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  return (
    <div>
      <Label>{label}</Label>
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f) }}
        onClick={() => ref.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${drag ? 'border-[#0d7377] bg-[#0d7377]/5' : 'border-stone-300 hover:border-[#0d7377] hover:bg-stone-50'}`}>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        {file ? (
          <div className="flex items-center gap-3 w-full">
            <FileArchive size={28} className="text-[#0d7377] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-stone-800 text-sm truncate">{file.name}</p>
              <p className="text-xs text-stone-400">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onFile(null) }} className="text-stone-400 hover:text-red-500">
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={28} className="text-stone-300" />
            <p className="text-sm font-semibold text-stone-500">Arrastra el archivo aquí o haz clic</p>
            <p className="text-xs text-stone-400">{accept === '.zip' ? 'Solo archivos .zip con shapefile' : 'Archivo PDF'}</p>
          </>
        )}
      </div>
    </div>
  )
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-stone-400">Paso {step + 1} de {total}</span>
        <span className="text-xs font-black text-[#0d7377]">{STEPS[step]?.label}</span>
      </div>
      <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${((step + 1) / total) * 100}%`, backgroundColor: PRIMARY }} />
      </div>
      <div className="flex gap-1 mt-2 justify-center">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="h-1.5 rounded-full transition-all duration-300"
            style={{ width: i === step ? 16 : 6, backgroundColor: i < step ? '#0d7377aa' : i === step ? PRIMARY : '#e7e5e4' }} />
        ))}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NuevaSiembraPage() {
  const router  = useRouter()
  const [step, setStep]         = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [authReady, setAuthReady]   = useState(false)
  const [userEmail, setUserEmail]   = useState<string | null>(null)
  const [fotosWarning, setFotosWarning] = useState(false)
  const pendingDataRef = useRef<FamiliaForm | null>(null)

  // ── Archivos (fuera de RHF) ──
  const [shpFinca, setShpFinca]               = useState<File | null>(null)
  const [shpRestauracion, setShpRestauracion] = useState<File | null>(null)
  const [shpArboles, setShpArboles]           = useState<File | null>(null)
  const [docAcuerdo, setDocAcuerdo]           = useState<File | null>(null)
  const [fotosPredioCat, setFotosPredioCat]   = useState<Record<string, File[]>>({})
  const [fotosPorCamara, setFotosPorCamara]   = useState<Record<number, File[]>>({})

  // ── Estado campos TEXT[] / JSONB (fuera de RHF) ──
  const [tipoVia, setTipoVia]                     = useState<string[]>([])
  const [tipoAcceso, setTipoAcceso]               = useState<string[]>([])
  const [serviciosEnergia, setServiciosEnergia]   = useState<string[]>([])
  const [fuenteAgua, setFuenteAgua]               = useState<string[]>([])
  const [tipoCocina, setTipoCocina]               = useState<string[]>([])
  const [tipoBano, setTipoBano]                   = useState<string[]>([])
  const [manejoBasuras, setManejoBasuras]         = useState<string[]>([])
  const [causasVenta, setCausasVenta]             = useState<string[]>([])
  const [orientGanaderia, setOrientGanaderia]     = useState<string[]>([])
  const [tiposPasto, setTiposPasto]               = useState<string[]>([])
  const [destinoLeche, setDestinoLeche]           = useState<string[]>([])
  const [fertGanado, setFertGanado]               = useState<string[]>([])
  const [manejoPraderas, setManejoPraderas]       = useState<string[]>([])
  const [infraGanadera, setInfraGanadera]         = useState<string[]>([])
  const [origenPastos, setOrigenPastos]           = useState<string[]>([])
  const [tipoFert, setTipoFert]                   = useState<string[]>([])
  const [controlMalezas, setControlMalezas]       = useState<string[]>([])
  const [problemasManejo, setProblemasManejo]     = useState<string[]>([])
  const [causaCobertura, setCausaCobertura]       = useState<string[]>([])
  const [problemasAgrop, setProblemasAgrop]       = useState<string[]>([])
  // JSONB
  const [miembros, setMiembros] = useState<MiembroFamilia[]>([])
  const [cultivos, setCultivos] = useState<CultivoRow[]>(OPT.cultivosBase.map(emptyCultivo))
  const [otras, setOtras] = useState<Record<string, EspeciePecuaria>>({
    Equinos: emptyEspecie(), Porcinos: emptyEspecie(), Aves: emptyEspecie(), Peces: emptyEspecie(),
  })

  // ── RHF ──
  const form = useForm<FamiliaForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: standardSchemaResolver(familiaSchema) as any,
    defaultValues: {
      monitoreos: [], camaras: [],
      adultos: 0, ninos: 0, cant_mujeres: 0, cant_hombres: 0,
      empleos_locales: 0, ha_potreros: 0, ha_bosque: 0, ha_otras: 0,
      num_individuos: 0, num_especies_inventario: 0, area_bosque_recorrida: 0,
      distancia_florencia_km: 0, tiempo_florencia_min: 0,
      ha_restauracion: 0, parcelas_monitoreo: 0, plantulas_sembradas: 0, especies_sembradas: 0,
    },
  })
  const { register, control, formState: { errors }, handleSubmit } = form

  const { fields: monitoreoFields, append: appendMonitoreo, remove: removeMonitoreo } =
    useFieldArray({ control, name: 'monitoreos' })
  const { fields: camaraFields, append: appendCamara, remove: removeCamara } =
    useFieldArray({ control, name: 'camaras' })

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

  // ── Navegación ──
  const nextStep = () => setStep(s => Math.min(s + 1, STEPS.length - 1))
  const prevStep = () => setStep(s => Math.max(s - 1, 0))

  // ── Fotos predio ──
  const addFotosPredioCat = (cat: string, files: File[]) =>
    setFotosPredioCat(p => ({ ...p, [cat]: [...(p[cat] ?? []), ...files] }))
  const removeFotoPredioCat = (cat: string, idx: number) =>
    setFotosPredioCat(p => ({ ...p, [cat]: (p[cat] ?? []).filter((_, i) => i !== idx) }))

  const removeCamera = (i: number) => {
    removeCamara(i)
    setFotosPorCamara(prev => {
      const next: Record<number, File[]> = {}
      Object.entries(prev).forEach(([k, fs]) => {
        const n = Number(k)
        if (n < i) next[n] = fs
        else if (n > i) next[n - 1] = fs
      })
      return next
    })
  }

  const underMinCats = FOTO_CATS.filter(c => (fotosPredioCat[c.key] ?? []).length < c.min)

  // ── Submit ──
  const buildArrayPayload = () => ({
    tipo_via:               tipoVia,
    tipo_acceso_predio:     tipoAcceso,
    servicios_domiciliarios: serviciosEnergia,
    fuente_agua:            fuenteAgua,
    tipo_cocina:            tipoCocina,
    tipo_bano:              tipoBano,
    manejo_basuras:         manejoBasuras,
    causas_venta:           causasVenta,
    orientacion_ganaderia:  orientGanaderia,
    tipos_pasto:            tiposPasto,
    destino_leche:          destinoLeche,
    uso_fertilizacion_ganado: fertGanado,
    manejo_praderas:        manejoPraderas,
    infraestructura_ganadera: infraGanadera,
    origen_nuevos_pastos:   origenPastos,
    tipo_fertilizacion:     tipoFert,
    control_malezas:        controlMalezas,
    problemas_manejo:       problemasManejo,
    causa_cambio_cobertura: causaCobertura,
    problemas_agropecuarios: problemasAgrop,
    miembros_familia:       miembros,
    cultivos:               cultivos.filter(c => c.cultivo.trim()),
    otras_especies_pecuarias: otras,
  })

  const doSubmit = async (data: FamiliaForm) => {
    if (!userEmail) return
    setSubmitting(true)
    setFotosWarning(false)
    try {
      const fd = new FormData()
      fd.append('data', JSON.stringify({ ...data, ...buildArrayPayload(), created_by: userEmail }))
      if (shpFinca)        fd.append('shp_finca',        shpFinca)
      if (shpRestauracion) fd.append('shp_restauracion', shpRestauracion)
      if (shpArboles)      fd.append('shp_arboles',      shpArboles)
      if (docAcuerdo)      fd.append('doc_acuerdo',      docAcuerdo)
      FOTO_CATS.forEach(({ key }) => {
        ;(fotosPredioCat[key] ?? []).forEach((f, i) => fd.append(`foto_${key}_${i}`, f))
      })
      Object.entries(fotosPorCamara).forEach(([idx, files]) => {
        files.forEach(f => fd.append(`camara_${idx}_foto`, f))
      })
      const res = await fetch('/api/ras/familias', { method: 'POST', body: fd })
      if (res.ok) {
        router.push('/intranet/ras/siembra')
      } else {
        const raw = await res.text().catch(() => '')
        let msg = `Error ${res.status}`
        try { msg = JSON.parse(raw).error ?? msg } catch { msg = raw.slice(0, 300) || msg }
        alert(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const onSubmit = async (data: FamiliaForm) => {
    if (underMinCats.length > 0) { setFotosWarning(true); pendingDataRef.current = data; return }
    await doSubmit(data)
  }

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 size={36} className="text-[#0d7377] animate-spin" /></div>
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">

      {/* Header */}
      <header className="bg-white shadow-md border-b border-stone-200">
        <div className="max-w-3xl mx-auto px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <Link href="/intranet/ras/siembra"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-[#0d7377] hover:text-[#0d7377] transition-all shrink-0">
              <ArrowLeft size={16} /><span className="hidden sm:block">Volver</span>
            </Link>
            <div className="text-center flex-1">
              <div className="inline-flex items-center gap-2">
                <Leaf size={18} className="text-[#0d7377]" />
                <h1 className="text-xl font-black text-stone-900">Nueva Familia en Restauración</h1>
              </div>
            </div>
            <div className="w-[80px]" />
          </div>
          <ProgressBar step={step} total={STEPS.length} />
        </div>
      </header>

      {/* Formulario */}
      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6">
        <form onSubmit={handleSubmit(onSubmit)}>

          {/* ══════════════════════════════════════════════════════
              PASO 0 — Datos Generales
          ══════════════════════════════════════════════════════ */}
          {step === 0 && (
            <div className="space-y-6">
              <ST icon={<BookOpen size={18} />} title="Datos Generales de la Encuesta" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label>N.° de encuesta</Label>
                  <input {...register('encuesta_no')} className={iCls} placeholder="Ej: ENC-001" />
                </div>
                <div>
                  <Label>Fecha de encuesta</Label>
                  <input type="date" {...register('fecha_encuesta')} className={iCls} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Encuestador/a</Label>
                  <input {...register('encuestador')} className={iCls} placeholder="Nombre completo del encuestador" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Tipo de encuestado</Label>
                  <Controller control={control} name="tipo_encuestado" render={({ field }) => (
                    <RadioGrp opts={OPT.tipoEncuestado} val={field.value ?? ''} onChange={field.onChange} />
                  )} />
                </div>
              </div>

              <Div label="Identificación del propietario/a" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <Label>Nombre completo del propietario/a</Label>
                  <input {...register('nombre_propietario')} className={iCls} placeholder="Nombre completo" />
                  <FieldError message={errors.nombre_propietario?.message} />
                </div>
                <div>
                  <Label>Tipo de documento</Label>
                  <select {...register('tipo_documento')} className={sCls}>
                    <option value="">— Seleccionar —</option>
                    {OPT.tipoDoc.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Número de identificación</Label>
                  <input {...register('numero_documento')} className={iCls} placeholder="Número" />
                </div>
                <div>
                  <Label>Teléfono de contacto</Label>
                  <input {...register('telefono')} className={iCls} placeholder="Ej: 3101234567" />
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 1 — Datos del Predio
          ══════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-6">
              <ST icon={<MapPin size={18} />} title="Datos del Predio" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label>Núcleo</Label>
                  <input {...register('nucleo')} className={iCls} placeholder="Ej: Piedemonte" />
                </div>
                <div>
                  <Label>Departamento</Label>
                  <input {...register('departamento')} className={iCls} placeholder="Ej: Caquetá" />
                </div>
                <div>
                  <Label>Municipio</Label>
                  <input {...register('municipio')} className={iCls} placeholder="Ej: Florencia" />
                </div>
                <div>
                  <Label>Vereda</Label>
                  <input {...register('vereda')} className={iCls} placeholder="Ej: El Paraíso" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Nombre de la finca</Label>
                  <input {...register('nombre_finca')} className={iCls} placeholder="Ej: La Esperanza" />
                </div>
              </div>

              <Div label="Estrato del paisaje" />
              <Controller control={control} name="estrato_paisaje" render={({ field }) => (
                <RadioGrp opts={OPT.estrato} val={field.value ?? ''} onChange={field.onChange} />
              )} />

              <Div label="Coordenadas y altitud" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>Latitud (N)</Label>
                  <input {...register('latitud')} className={iCls} placeholder="Ej: 1.6146" />
                </div>
                <div>
                  <Label>Longitud (W)</Label>
                  <input {...register('longitud')} className={iCls} placeholder="Ej: -75.6063" />
                </div>
                <div>
                  <Label>Altitud (msnm)</Label>
                  <input type="number" {...register('altitud_msnm')} className={iCls} placeholder="Ej: 300" />
                </div>
              </div>

              <Div label="Acceso y servicios" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Año de adquisición</Label>
                  <input type="number" {...register('anio_adquisicion')} className={iCls} placeholder="Ej: 2005" />
                </div>
                <div>
                  <Label>Distancia a cabecera municipal (km)</Label>
                  <input type="number" step="0.1" {...register('distancia_cabecera_km')} className={iCls} />
                </div>
              </div>
              <div>
                <Label>Tipo de vía</Label>
                <ChkGroup opts={OPT.tipoVia} val={tipoVia} onChange={setTipoVia} />
              </div>
              <div>
                <Label>Tipo de acceso al predio</Label>
                <ChkGroup opts={OPT.tipoAcceso} val={tipoAcceso} onChange={setTipoAcceso} />
              </div>
              <div>
                <Label>Servicios domiciliarios (energía)</Label>
                <ChkGroup opts={OPT.serviciosEnergia} val={serviciosEnergia} onChange={setServiciosEnergia} />
              </div>
              <div>
                <Label>Fuente de agua</Label>
                <ChkGroup opts={OPT.fuenteAgua} val={fuenteAgua} onChange={setFuenteAgua} />
              </div>
              <Controller control={control} name="senal_telefonica" render={({ field }) => (
                <YesNo val={field.value} onChange={field.onChange} label="¿Tiene señal de comunicación telefónica?" />
              )} />
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 2 — Vivienda
          ══════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-6">
              <ST icon={<Home size={18} />} title="Característica de la Vivienda" />

              <Div label="Materiales de construcción" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <Label>Techo</Label>
                  <Controller control={control} name="material_techo" render={({ field }) => (
                    <RadioGrp opts={OPT.matTecho} val={field.value ?? ''} onChange={field.onChange} />
                  )} />
                </div>
                <div>
                  <Label>Paredes</Label>
                  <Controller control={control} name="material_paredes" render={({ field }) => (
                    <RadioGrp opts={OPT.matParedes} val={field.value ?? ''} onChange={field.onChange} />
                  )} />
                </div>
                <div>
                  <Label>Piso</Label>
                  <Controller control={control} name="material_piso" render={({ field }) => (
                    <RadioGrp opts={OPT.matPiso} val={field.value ?? ''} onChange={field.onChange} />
                  )} />
                </div>
              </div>

              <Div label="Vivienda y servicios" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <Label>N.° habitaciones</Label>
                  <input type="number" min={0} {...register('num_habitaciones')} className={iCls} />
                </div>
                <div>
                  <Label>Personas en vivienda</Label>
                  <input type="number" min={0} {...register('personas_vivienda')} className={iCls} />
                </div>
              </div>
              <div>
                <Label>La cocina tiene</Label>
                <ChkGroup opts={OPT.tipoCocina} val={tipoCocina} onChange={setTipoCocina} />
              </div>
              <div>
                <Label>Baño</Label>
                <ChkGroup opts={OPT.tipoBano} val={tipoBano} onChange={setTipoBano} />
              </div>

              <Div label="Saneamiento" />
              <div>
                <Label>Sitio donde vierten las excretas</Label>
                <Controller control={control} name="disposicion_excretas" render={({ field }) => (
                  <RadioGrp opts={OPT.excretas} val={field.value ?? ''} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>Sitio donde vierten aguas servidas</Label>
                <Controller control={control} name="disposicion_aguas_servidas" render={({ field }) => (
                  <RadioGrp opts={OPT.excretas} val={field.value ?? ''} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>Manejo de basuras</Label>
                <ChkGroup opts={OPT.basuras} val={manejoBasuras} onChange={setManejoBasuras} />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 3 — Núcleo Familiar
          ══════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-6">
              <ST icon={<Users size={18} />} title="Información del Núcleo Familiar" />

              <Div label="Composición del hogar" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(['adultos', 'ninos', 'cant_mujeres', 'cant_hombres'] as const).map((f, i) => (
                  <div key={f}>
                    <Label>{['# Adultos', '# Niños', '# Mujeres', '# Hombres'][i]}</Label>
                    <input type="number" min={0} {...register(f)} className={iCls} />
                  </div>
                ))}
              </div>

              <Div label="Miembros del núcleo familiar" />
              <div className="space-y-3">
                {miembros.map((m, i) => (
                  <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-stone-500">Miembro {i + 1}</span>
                      <button type="button" onClick={() => setMiembros(prev => prev.filter((_, j) => j !== i))}
                        className="text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <Label>Parentesco</Label>
                        <input className={iCls} placeholder="Ej: Hijo/a" value={m.parentesco}
                          onChange={e => setMiembros(p => p.map((x, j) => j === i ? { ...x, parentesco: e.target.value } : x))} />
                      </div>
                      <div>
                        <Label>Edad</Label>
                        <input type="number" min={0} className={iCls} value={m.edad}
                          onChange={e => setMiembros(p => p.map((x, j) => j === i ? { ...x, edad: e.target.value } : x))} />
                      </div>
                      <div>
                        <Label>Sexo</Label>
                        <select className={sCls} value={m.sexo}
                          onChange={e => setMiembros(p => p.map((x, j) => j === i ? { ...x, sexo: e.target.value } : x))}>
                          <option value="">—</option>
                          <option value="M">M</option><option value="F">F</option><option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div>
                        <Label>Nivel de estudio</Label>
                        <select className={sCls} value={m.nivel_estudio}
                          onChange={e => setMiembros(p => p.map((x, j) => j === i ? { ...x, nivel_estudio: e.target.value } : x))}>
                          <option value="">—</option>
                          {OPT.nivelEstudio.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label>Depto. procedencia</Label>
                        <input className={iCls} value={m.procedencia}
                          onChange={e => setMiembros(p => p.map((x, j) => j === i ? { ...x, procedencia: e.target.value } : x))} />
                      </div>
                      <div>
                        <Label>Depto. residencia actual</Label>
                        <input className={iCls} value={m.residencia}
                          onChange={e => setMiembros(p => p.map((x, j) => j === i ? { ...x, residencia: e.target.value } : x))} />
                      </div>
                      <div>
                        <Label>Días/mes trabajo finca</Label>
                        <input type="number" min={0} max={31} className={iCls} value={m.dias_finca}
                          onChange={e => setMiembros(p => p.map((x, j) => j === i ? { ...x, dias_finca: e.target.value } : x))} />
                      </div>
                      <div>
                        <Label>Días/mes fuera finca</Label>
                        <input type="number" min={0} max={31} className={iCls} value={m.dias_fuera}
                          onChange={e => setMiembros(p => p.map((x, j) => j === i ? { ...x, dias_fuera: e.target.value } : x))} />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setMiembros(p => [...p, emptyMiembro()])}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 border-dashed border-stone-300 text-stone-500 hover:border-[#0d7377] hover:text-[#0d7377] transition-all w-full justify-center">
                  <Plus size={14} /> Agregar miembro
                </button>
              </div>

              <Div label="Salud, educación y permanencia" />
              <div className="space-y-4">
                <div>
                  <Label>Tendencia de la población (últimos 10 años)</Label>
                  <Controller control={control} name="poblacion_tendencia" render={({ field }) => (
                    <RadioGrp opts={OPT.tendencia} val={field.value ?? ''} onChange={field.onChange} />
                  )} />
                </div>
                <Controller control={control} name="acceso_salud" render={({ field }) => (
                  <YesNo val={field.value} onChange={field.onChange} label="¿Los miembros tienen acceso a salud?" />
                )} />
                <div>
                  <Label>Régimen de salud</Label>
                  <Controller control={control} name="regimen_salud" render={({ field }) => (
                    <RadioGrp opts={OPT.regimen} val={field.value ?? ''} onChange={field.onChange} />
                  )} />
                </div>
                <div>
                  <Label>Puesto de salud más cercano y distancia</Label>
                  <input {...register('puesto_salud')} className={iCls} placeholder="Ej: Puesto de salud San Luis, 5 km" />
                </div>
                <Controller control={control} name="acceso_educacion" render={({ field }) => (
                  <YesNo val={field.value} onChange={field.onChange} label="¿Tienen acceso a educación?" />
                )} />
                <div>
                  <Label>Distancia al centro educativo (km)</Label>
                  <input type="number" step="0.1" {...register('distancia_educacion_km')} className={iCls} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>¿Hace cuánto llegó a la región?</Label>
                    <input {...register('tiempo_llegada_region')} className={iCls} placeholder="Ej: 15 años" />
                  </div>
                  <div>
                    <Label>Razón de llegada</Label>
                    <input {...register('razon_llegada')} className={iCls} placeholder="Ej: Compra de tierra" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 4 — Economía & Valorización
          ══════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div className="space-y-6">
              <ST icon={<TrendingUp size={18} />} title="Economía y Valorización del Predio" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <Label>Actividad económica principal</Label>
                  <input {...register('actividad_economica')} className={iCls} placeholder="Ej: Ganadería de leche, cultivos amazónicos…" />
                </div>
                <div>
                  <Label>Empleos locales generados</Label>
                  <input type="number" min={0} {...register('empleos_locales')} className={iCls} />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Controller control={control} name="tiene_espacio_vegetal" render={({ field }) => (
                    <YesNo val={field.value} onChange={field.onChange} label="¿Espacio para tratar material vegetal?" />
                  )} />
                </div>
              </div>

              <Div label="Tamaño y valor del predio" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Tamaño total del predio (ha)</Label>
                  <input type="number" step="0.01" min={0} {...register('ha_total')} className={iCls} />
                </div>
                <div>
                  <Label>Valor comercial de la hectárea ($)</Label>
                  <input type="number" min={0} {...register('valor_comercial_ha')} className={iCls} />
                </div>
                <div>
                  <Label>¿En el último año el área ha…?</Label>
                  <Controller control={control} name="tendencia_area" render={({ field }) => (
                    <RadioGrp opts={OPT.tendencia} val={field.value ?? ''} onChange={field.onChange} />
                  )} />
                </div>
                <div>
                  <Label>¿En cuántas hectáreas?</Label>
                  <input type="number" step="0.01" {...register('cambio_area_ha')} className={iCls} />
                </div>
              </div>

              <Div label="Intención de venta" />
              <Controller control={control} name="intencion_vender" render={({ field }) => (
                <YesNo val={field.value} onChange={field.onChange} label="¿Ha pensado vender la finca?" />
              )} />
              <div>
                <Label>Causas de posible venta</Label>
                <ChkGroup opts={OPT.causasVenta} val={causasVenta} onChange={setCausasVenta} />
              </div>

              <Div label="Transporte e ingresos" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Medio de transporte de la producción</Label>
                  <input {...register('medio_transporte_produccion')} className={iCls} placeholder="Ej: Camión, moto, canoa…" />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Controller control={control} name="transporte_propio" render={({ field }) => (
                    <YesNo val={field.value} onChange={field.onChange} label="¿Transporte propio?" />
                  )} />
                </div>
                <div>
                  <Label>Valor del transporte finca–pueblo ($)</Label>
                  <input type="number" min={0} {...register('valor_transporte')} className={iCls} />
                </div>
                <div>
                  <Label>Problemas de acceso al mercado</Label>
                  <input {...register('problemas_mercado')} className={iCls} placeholder="Describe los problemas" />
                </div>
              </div>
              <div>
                <Label>Ingresos mensuales</Label>
                <Controller control={control} name="nivel_ingresos" render={({ field }) => (
                  <RadioGrp opts={OPT.ingresos} val={field.value ?? ''} onChange={field.onChange} />
                )} />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 5 — Uso del Suelo e Inventario
          ══════════════════════════════════════════════════════ */}
          {step === 5 && (
            <div className="space-y-6">
              <ST icon={<Trees size={18} />} title="Uso del Suelo e Inventario Forestal" />

              <Div label="Uso del suelo (hectáreas)" />
              <div className="grid grid-cols-3 gap-4">
                {(['ha_bosque', 'ha_potreros', 'ha_otras'] as const).map((f, i) => (
                  <div key={f}>
                    <Label>{['Bosque', 'Potreros', 'Otras'][i]}</Label>
                    <input type="number" min={0} step="0.01" {...register(f)} className={iCls} />
                  </div>
                ))}
              </div>
              <Controller control={control} name="bajo_conservacion" render={({ field }) => (
                <YesNo val={field.value} onChange={field.onChange} label="Bajo figura de conservación" />
              )} />

              <Div label="Inventario forestal" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label>N.° de individuos (árboles)</Label>
                  <input type="number" min={0} {...register('num_individuos')} className={iCls} placeholder="Ej: 82" />
                </div>
                <div>
                  <Label>N.° de especies</Label>
                  <input type="number" min={0} {...register('num_especies_inventario')} className={iCls} placeholder="Ej: 33" />
                </div>
                <div>
                  <Label>Área de bosque recorrida (ha)</Label>
                  <input type="number" min={0} step="0.1" {...register('area_bosque_recorrida')} className={iCls} />
                </div>
              </div>

              <Div label="Accesibilidad" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Distancia a Florencia / Morelia (km)</Label>
                  <input type="number" min={0} step="0.1" {...register('distancia_florencia_km')} className={iCls} />
                </div>
                <div>
                  <Label>Tiempo de viaje (min)</Label>
                  <input type="number" min={0} {...register('tiempo_florencia_min')} className={iCls} />
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 6 — Cultivos
          ══════════════════════════════════════════════════════ */}
          {step === 6 && (
            <div className="space-y-5">
              <ST icon={<Sprout size={18} />} title="Caracterización de Cultivos" />
              <p className="text-sm text-stone-500">Completa los datos de los cultivos presentes en la finca. Puedes agregar cultivos adicionales.</p>
              <div className="space-y-4">
                {cultivos.map((c, i) => (
                  <div key={i} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-black text-stone-700">{c.cultivo || `Cultivo ${i + 1}`}</span>
                      {i >= OPT.cultivosBase.length && (
                        <button type="button" onClick={() => setCultivos(p => p.filter((_, j) => j !== i))}
                          className="text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                      )}
                    </div>
                    {i >= OPT.cultivosBase.length && (
                      <div className="mb-3">
                        <Label>Nombre del cultivo</Label>
                        <input className={iCls} value={c.cultivo} placeholder="Ej: Aguacate"
                          onChange={e => setCultivos(p => p.map((x, j) => j === i ? { ...x, cultivo: e.target.value } : x))} />
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'area_ha', label: 'Área (ha)', type: 'number', ph: '0.0' },
                        { key: 'anio_siembra', label: 'Año siembra', type: 'number', ph: '2020' },
                        { key: 'densidad', label: 'Densidad (plantas/ha)', type: 'number', ph: '0' },
                        { key: 'rendimiento', label: 'Rendimiento (kg/ha)', type: 'number', ph: '0' },
                      ].map(({ key, label, type, ph }) => (
                        <div key={key}>
                          <Label>{label}</Label>
                          <input type={type} className={iCls} placeholder={ph} value={(c as unknown as Record<string, string>)[key]}
                            onChange={e => setCultivos(p => p.map((x, j) => j === i ? { ...x, [key]: e.target.value } : x))} />
                        </div>
                      ))}
                      <div>
                        <Label>Destino producción</Label>
                        <select className={sCls} value={c.destino}
                          onChange={e => setCultivos(p => p.map((x, j) => j === i ? { ...x, destino: e.target.value } : x))}>
                          <option value="">—</option>
                          {OPT.destinoProd.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setCultivos(p => [...p, emptyCultivo()])}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 border-dashed border-stone-300 text-stone-500 hover:border-[#0d7377] hover:text-[#0d7377] transition-all w-full justify-center">
                <Plus size={14} /> Agregar otro cultivo
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 7 — Ganadería
          ══════════════════════════════════════════════════════ */}
          {step === 7 && (
            <div className="space-y-6">
              <ST icon={<Mountain size={18} />} title="Ganadería y Especies Pecuarias" />

              <Controller control={control} name="tiene_ganaderia" render={({ field }) => (
                <YesNo val={field.value} onChange={field.onChange} label="¿Tiene ganadería en el predio?" />
              )} />

              <Div label="Información general" />
              <div>
                <Label>Tipo de tenencia del ganado</Label>
                <Controller control={control} name="tipo_tenencia_ganado" render={({ field }) => (
                  <RadioGrp opts={OPT.tenenciaGanado} val={field.value ?? ''} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>Orientación de la producción ganadera</Label>
                <ChkGroup opts={OPT.orientGanaderia} val={orientGanaderia} onChange={setOrientGanaderia} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <Label>N.° cabezas de ganado</Label>
                  <input type="number" min={0} {...register('num_cabezas_ganado')} className={iCls} />
                </div>
                <div>
                  <Label>Ha. ganadería</Label>
                  <input type="number" step="0.01" min={0} {...register('ha_ganaderia')} className={iCls} />
                </div>
                <div>
                  <Label>Litros leche/día</Label>
                  <input type="number" step="0.1" min={0} {...register('litros_leche_dia')} className={iCls} />
                </div>
                <div>
                  <Label>Precio leche ($/L)</Label>
                  <input type="number" min={0} {...register('precio_leche_litro')} className={iCls} />
                </div>
              </div>
              <div>
                <Label>Tanque de enfriamiento</Label>
                <Controller control={control} name="tanque_enfriamiento" render={({ field }) => (
                  <RadioGrp opts={OPT.tanqueEnfr} val={field.value ?? ''} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>Destino de la producción de leche</Label>
                <ChkGroup opts={OPT.destinoLeche} val={destinoLeche} onChange={setDestinoLeche} />
              </div>

              <Div label="Manejo" />
              <div>
                <Label>Sistema de alimentación</Label>
                <Controller control={control} name="sistema_alimentacion_ganado" render={({ field }) => (
                  <RadioGrp opts={OPT.sistAlimentacion} val={field.value ?? ''} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>Especies forrajeras utilizadas</Label>
                <input {...register('especies_forrajeras')} className={iCls} placeholder="Ej: Brachiaria, Kikuyo…" />
              </div>
              <div>
                <Label>Fertilización de praderas</Label>
                <ChkGroup opts={OPT.fertGanado} val={fertGanado} onChange={setFertGanado} />
              </div>
              <div>
                <Label>Manejo de praderas</Label>
                <ChkGroup opts={OPT.manejoPraderas} val={manejoPraderas} onChange={setManejoPraderas} />
              </div>
              <div>
                <Label>Infraestructura en la finca</Label>
                <ChkGroup opts={OPT.infraestructura} val={infraGanadera} onChange={setInfraGanadera} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Material de postes de cercas</Label>
                  <Controller control={control} name="material_postes" render={({ field }) => (
                    <RadioGrp opts={OPT.matPostes} val={field.value ?? ''} onChange={field.onChange} />
                  )} />
                </div>
                <div>
                  <Label>Ha. de pasto sembradas en el último año</Label>
                  <input type="number" step="0.01" min={0} {...register('ha_pasto_ultimo_anio')} className={iCls} />
                </div>
              </div>
              <div>
                <Label>Origen de los nuevos pastos</Label>
                <ChkGroup opts={OPT.origenPastos} val={origenPastos} onChange={setOrigenPastos} />
              </div>

              <Div label="Prácticas de ganadería regenerativa" />
              <div className="grid grid-cols-1 gap-3">
                {([
                  ['pastoreo_rotacional', 'Pastoreo rotacional con tiempos de descanso adecuados'],
                  ['diversificacion_forrajera', 'Diversificación de especies forrajeras'],
                  ['cercas_vivas', 'Cercas vivas o barreras naturales'],
                  ['sistemas_silvopastoriles', 'Sistemas silvopastoriles (árboles en pasturas)'],
                  ['captacion_agua_lluvia', 'Captación y almacenamiento de agua lluvia'],
                  ['manejo_residuos_organicos', 'Manejo de residuos orgánicos para fertilización'],
                  ['reduccion_antibioticos', 'Reducción del uso de antibióticos y químicos'],
                  ['espacios_sombra_agua', 'Espacios de sombra y acceso a agua limpia'],
                  ['reduccion_estres', 'Reducción del estrés por confinamiento'],
                  ['interes_ganaderia_regenerativa', '¿Le interesaría recibir asesoría sobre ganadería regenerativa?'],
                ] as [keyof FamiliaForm, string][]).map(([name, label]) => (
                  <Controller key={name} control={control} name={name} render={({ field }) => (
                    <YesNo val={field.value as boolean | undefined} onChange={field.onChange} label={label} />
                  )} />
                ))}
              </div>

              <Div label="Otras especies pecuarias" />
              {Object.keys(otras).map(esp => (
                <div key={esp} className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm space-y-3">
                  <YesNo val={otras[esp].tiene} onChange={v => setOtras(p => ({ ...p, [esp]: { ...p[esp], tiene: v } }))} label={esp} />
                  {otras[esp].tiene && (
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div>
                        <Label>Cantidad</Label>
                        <input type="number" min={0} className={iCls} value={otras[esp].cantidad}
                          onChange={e => setOtras(p => ({ ...p, [esp]: { ...p[esp], cantidad: e.target.value } }))} />
                      </div>
                      <div className="flex items-end pb-1">
                        <YesNo val={otras[esp].uso_propio} onChange={v => setOtras(p => ({ ...p, [esp]: { ...p[esp], uso_propio: v } }))} label="Uso propio" />
                      </div>
                      <div className="flex items-end pb-1">
                        <YesNo val={otras[esp].comercializacion} onChange={v => setOtras(p => ({ ...p, [esp]: { ...p[esp], comercializacion: v } }))} label="Comercialización" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 8 — Tecnología
          ══════════════════════════════════════════════════════ */}
          {step === 8 && (
            <div className="space-y-6">
              <ST icon={<Settings size={18} />} title="Nivel Tecnológico" />
              <div>
                <Label>Instalaciones, maquinaria y equipos</Label>
                <textarea {...register('instalaciones_maquinaria')} rows={3} className={tCls} placeholder="Describe las instalaciones y equipos disponibles…" />
              </div>
              <div className="flex flex-wrap gap-6">
                <Controller control={control} name="tiene_tractor" render={({ field }) => (
                  <YesNo val={field.value} onChange={field.onChange} label="¿Tiene tractor?" />
                )} />
                <Controller control={control} name="tiene_camion" render={({ field }) => (
                  <YesNo val={field.value} onChange={field.onChange} label="¿Tiene camión?" />
                )} />
              </div>

              <Div label="Manejo de la producción" />
              <div>
                <Label>Manejo del suelo y fertilización</Label>
                <Controller control={control} name="manejo_suelo_fertilizacion" render={({ field }) => (
                  <RadioGrp opts={OPT.manejoSuelo} val={field.value ?? ''} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>Tipo de fertilización utilizada</Label>
                <ChkGroup opts={OPT.tipoFert} val={tipoFert} onChange={setTipoFert} />
              </div>
              <div className="flex flex-wrap gap-6">
                <Controller control={control} name="cobertura_arborea" render={({ field }) => (
                  <YesNo val={field.value} onChange={field.onChange} label="¿Cobertura arbórea asociada?" />
                )} />
                <Controller control={control} name="practica_podas" render={({ field }) => (
                  <YesNo val={field.value} onChange={field.onChange} label="Podas" />
                )} />
                <Controller control={control} name="practica_raleo" render={({ field }) => (
                  <YesNo val={field.value} onChange={field.onChange} label="Raleo" />
                )} />
              </div>
              <div>
                <Label>Control de malezas</Label>
                <ChkGroup opts={OPT.controlMalezas} val={controlMalezas} onChange={setControlMalezas} />
              </div>
              <div>
                <Label>Manejo del agua</Label>
                <Controller control={control} name="manejo_agua_cultivo" render={({ field }) => (
                  <RadioGrp opts={OPT.manejoAgua} val={field.value ?? ''} onChange={field.onChange} />
                )} />
              </div>

              <Div label="Condiciones del sistema productivo" />
              <div>
                <Label>Principales problemas de manejo</Label>
                <ChkGroup opts={OPT.problemasManejo} val={problemasManejo} onChange={setProblemasManejo} />
              </div>
              <div>
                <Label>Especies o variedades cultivadas</Label>
                <input {...register('especies_variedades')} className={iCls} placeholder="Ej: Cacao CCN-51, Plátano Dominico Hartón…" />
              </div>
              <div className="flex flex-wrap gap-6">
                <Controller control={control} name="lleva_registros_productividad" render={({ field }) => (
                  <YesNo val={field.value} onChange={field.onChange} label="¿Lleva registros de productividad?" />
                )} />
                <Controller control={control} name="interes_capacitacion" render={({ field }) => (
                  <YesNo val={field.value} onChange={field.onChange} label="¿Interesado en capacitación técnica?" />
                )} />
              </div>
              <div>
                <Label>Temas de interés para capacitación</Label>
                <textarea {...register('temas_capacitacion')} rows={2} className={tCls} placeholder="Ej: Buenas prácticas agropecuarias, mercados verdes…" />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 9 — Bosque & Clima
          ══════════════════════════════════════════════════════ */}
          {step === 9 && (
            <div className="space-y-6">
              <ST icon={<Leaf size={18} />} title="Usos del Bosque y Cambio Climático" />

              <Controller control={control} name="aprovecha_bosque" render={({ field }) => (
                <YesNo val={field.value} onChange={field.onChange} label="¿Hace aprovechamiento de productos del bosque?" />
              )} />
              <div>
                <Label>¿Qué productos forestales aprovecha?</Label>
                <textarea {...register('productos_forestales')} rows={2} className={tCls} placeholder="Ej: Madera, leña, plantas medicinales…" />
              </div>
              <Controller control={control} name="capacitacion_ambiente" render={({ field }) => (
                <YesNo val={field.value} onChange={field.onChange} label="¿Ha recibido capacitaciones sobre medio ambiente?" />
              )} />
              <div>
                <Label>¿De parte de qué entidad?</Label>
                <input {...register('entidad_capacitacion')} className={iCls} placeholder="Ej: Corpoamazonia, SENA…" />
              </div>
              <div>
                <Label>¿Qué especies reconoce en su bosque?</Label>
                <textarea {...register('especies_bosque_predio')} rows={2} className={tCls} placeholder="Ej: Cedrillo, Caimito, Laurel…" />
              </div>
              <div>
                <Label>¿Qué especies de fauna reconoce en el predio?</Label>
                <textarea {...register('especies_fauna_predio')} rows={2} className={tCls} placeholder="Ej: Armadillo, Mico, Tigrillo…" />
              </div>
              <div className="flex flex-wrap gap-6">
                <Controller control={control} name="estudio_academico" render={({ field }) => (
                  <YesNo val={field.value} onChange={field.onChange} label="¿Se ha realizado estudio académico/científico en el predio?" />
                )} />
                <Controller control={control} name="disminucion_especies" render={({ field }) => (
                  <YesNo val={field.value} onChange={field.onChange} label="¿Ha disminuido la fauna/flora desde su llegada?" />
                )} />
              </div>
              <div>
                <Label>Especies más afectadas</Label>
                <input {...register('especies_afectadas')} className={iCls} placeholder="Ej: Lapa, Danta, Cedro…" />
              </div>
              <Controller control={control} name="cambios_caudal" render={({ field }) => (
                <YesNo val={field.value} onChange={field.onChange} label="¿Ha observado cambios en el caudal de quebradas o nacimientos?" />
              )} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Cambio de cobertura vegetal (ha)</Label>
                  <input type="number" step="0.1" {...register('cambio_cobertura_ha')} className={iCls} />
                </div>
              </div>
              <div>
                <Label>¿A qué se debe el cambio de cobertura?</Label>
                <ChkGroup opts={OPT.causaCobertura} val={causaCobertura} onChange={setCausaCobertura} />
              </div>
              <div>
                <Label>Problemas que afectan la producción agropecuaria</Label>
                <ChkGroup opts={OPT.problemasAgrop} val={problemasAgrop} onChange={setProblemasAgrop} />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 10 — Relaciones
          ══════════════════════════════════════════════════════ */}
          {step === 10 && (
            <div className="space-y-6">
              <ST icon={<Handshake size={18} />} title="Relaciones Internas y Externas" />
              <div>
                <Label>¿Reconoce algún programa u apoyo gubernamental en la región?</Label>
                <input {...register('programas_gubernamentales')} className={iCls} placeholder="Ej: Colombia Siembra, Más campo…" />
              </div>
              <div>
                <Label>Beneficio recibido (capacitación, económico, asesoría técnica…)</Label>
                <textarea {...register('beneficios_programas')} rows={2} className={tCls} />
              </div>
              <div>
                <Label>Impacto del programa</Label>
                <Controller control={control} name="impacto_programa" render={({ field }) => (
                  <RadioGrp opts={OPT.impacto} val={field.value ?? ''} onChange={field.onChange} />
                )} />
              </div>
              <Controller control={control} name="opinion_productores" render={({ field }) => (
                <YesNo val={field.value} onChange={field.onChange} label="¿Se toma en cuenta la opinión de los productores en la toma de decisiones?" />
              )} />
              <Controller control={control} name="aliado_cooperativa" render={({ field }) => (
                <YesNo val={field.value} onChange={field.onChange} label="¿Es aliado de alguna cooperativa o gremio?" />
              )} />
              <div>
                <Label>¿Cuál cooperativa/gremio?</Label>
                <input {...register('nombre_cooperativa')} className={iCls} placeholder="Nombre de la cooperativa o gremio" />
              </div>
              <div>
                <Label>¿Cómo se beneficia?</Label>
                <textarea {...register('beneficio_cooperativa')} rows={2} className={tCls} />
              </div>
              <div>
                <Label>Compromiso de los gremios productivos</Label>
                <Controller control={control} name="calificacion_gremios" render={({ field }) => (
                  <RadioGrp opts={OPT.calGremios} val={field.value ?? ''} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>Observaciones generales</Label>
                <textarea {...register('observaciones_generales')} rows={4} className={tCls} placeholder="Observaciones adicionales sobre el predio y la familia…" />
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 11 — Restauración
          ══════════════════════════════════════════════════════ */}
          {step === 11 && (
            <div className="space-y-6">
              <ST icon={<Sprout size={18} />} title="Datos de Restauración" />
              <div>
                <Label>Plan de restauración</Label>
                <textarea {...register('plan_restauracion')} rows={3} className={tCls} placeholder="Descripción del plan o enlace al documento…" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <Label>Ha. en restauración</Label>
                  <input type="number" min={0} step="0.01" {...register('ha_restauracion')} className={iCls} />
                </div>
                <div>
                  <Label>Parcelas de monitoreo</Label>
                  <input type="number" min={0} {...register('parcelas_monitoreo')} className={iCls} />
                </div>
                <div>
                  <Label>Plántulas sembradas</Label>
                  <input type="number" min={0} {...register('plantulas_sembradas')} className={iCls} />
                </div>
                <div>
                  <Label>Especies sembradas</Label>
                  <input type="number" min={0} {...register('especies_sembradas')} className={iCls} />
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 12 — Archivos SHP
          ══════════════════════════════════════════════════════ */}
          {step === 12 && (
            <div className="space-y-6">
              <ST icon={<FileArchive size={18} />} title="Archivos Espaciales (Shapefiles)" />
              <p className="text-sm text-stone-500">Sube los polígonos en formato .zip con el shapefile (.shp, .dbf, .prj, .shx).</p>
              <Dropzone label="Polígono total de la finca" file={shpFinca} onFile={setShpFinca} />
              <Dropzone label="Polígono en restauración" file={shpRestauracion} onFile={setShpRestauracion} />
              <Dropzone label="Árboles — Shapefile de puntos (.zip)" file={shpArboles} onFile={setShpArboles} />
              <Dropzone label="Tratamiento de datos y acuerdo de conservación (PDF, opcional)" file={docAcuerdo} onFile={setDocAcuerdo} accept=".pdf" />
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 13 — Fotos del Predio
          ══════════════════════════════════════════════════════ */}
          {step === 13 && (
            <div className="space-y-6">
              <ST icon={<ImageIcon size={18} />} title="Fotos del Predio" />
              <p className="text-sm text-stone-500">Sube fotos por categoría. Los mínimos recomendados se muestran en cada tarjeta.</p>
              {FOTO_CATS.map(({ key, label, min }) => (
                <FotoCatCard key={key} catKey={key} label={label} min={min}
                  files={fotosPredioCat[key] ?? []}
                  onAdd={fs => addFotosPredioCat(key, fs)}
                  onRemove={i => removeFotoPredioCat(key, i)} />
              ))}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 14 — Monitoreos
          ══════════════════════════════════════════════════════ */}
          {step === 14 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <ST icon={<Activity size={18} />} title="Monitoreos" />
                <button type="button" onClick={() => appendMonitoreo({ fecha: '', supervivencia_pct: 0 })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90"
                  style={{ backgroundColor: PRIMARY }}>
                  <Plus size={14} /> Agregar
                </button>
              </div>
              {monitoreoFields.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-stone-400 gap-3 border-2 border-dashed border-stone-200 rounded-2xl">
                  <Activity size={32} className="text-stone-300" />
                  <p className="text-sm font-semibold">Sin monitoreos registrados</p>
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
                        <input type="date" {...register(`monitoreos.${i}.fecha`)} className={iCls} />
                      </div>
                      <div>
                        <Label>% Supervivencia</Label>
                        <input type="number" min={0} max={100} step={0.1} {...register(`monitoreos.${i}.supervivencia_pct`)} className={iCls} />
                      </div>
                    </div>
                    <button type="button" onClick={() => removeMonitoreo(i)} className="text-stone-400 hover:text-red-500 mt-1 shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              PASO 15 — Cámaras Trampa
          ══════════════════════════════════════════════════════ */}
          {step === 15 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <ST icon={<Camera size={18} />} title="Biodiversidad / Cámaras Trampa" />
                <button type="button" onClick={() => appendCamara({ nombre: '', latitud: 0, longitud: 0 })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90"
                  style={{ backgroundColor: PRIMARY }}>
                  <Plus size={14} /> Agregar cámara
                </button>
              </div>
              {camaraFields.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-stone-400 gap-3 border-2 border-dashed border-stone-200 rounded-2xl">
                  <Camera size={32} className="text-stone-300" />
                  <p className="text-sm font-semibold">Sin cámaras trampa</p>
                </div>
              )}
              <div className="space-y-4">
                {camaraFields.map((field, i) => (
                  <div key={field.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-stone-100 bg-stone-50">
                      <Camera size={16} className="text-[#0d7377]" />
                      <span className="font-black text-stone-700 text-sm">Cámara {i + 1}</span>
                      <button type="button" onClick={() => removeCamera(i)} className="ml-auto text-stone-400 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <Label>Nombre / ID</Label>
                          <input {...register(`camaras.${i}.nombre`)} className={iCls} placeholder="Ej: CT-001" />
                          <FieldError message={errors.camaras?.[i]?.nombre?.message} />
                        </div>
                        <div>
                          <Label>Latitud</Label>
                          <input type="number" step="any" {...register(`camaras.${i}.latitud`)} className={iCls} placeholder="Ej: 1.2345" />
                        </div>
                        <div>
                          <Label>Longitud</Label>
                          <input type="number" step="any" {...register(`camaras.${i}.longitud`)} className={iCls} placeholder="Ej: -75.4321" />
                        </div>
                      </div>
                      <div>
                        <Label>Fotografías de captura</Label>
                        <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-stone-300 hover:border-[#0d7377] hover:bg-stone-50 cursor-pointer transition-all">
                          <input type="file" multiple accept="image/jpeg,image/png,image/jpg" className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? [])
                              setFotosPorCamara(p => ({ ...p, [i]: [...(p[i] ?? []), ...files] }))
                              e.target.value = ''
                            }} />
                          <ImageIcon size={22} className="text-stone-300" />
                          <p className="text-xs font-semibold text-stone-500">Haz clic para seleccionar imágenes</p>
                        </label>
                        {(fotosPorCamara[i] ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {(fotosPorCamara[i] ?? []).map((f, fi) => (
                              <PhotoPreview key={fi} file={f}
                                onRemove={() => setFotosPorCamara(p => ({ ...p, [i]: p[i].filter((_, idx) => idx !== fi) }))} />
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

          {/* Banner advertencia fotos */}
          {fotosWarning && underMinCats.length > 0 && (
            <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 space-y-3 mt-6">
              <p className="text-sm font-bold text-red-700">Las siguientes categorías están por debajo del mínimo recomendado:</p>
              <ul className="space-y-1">
                {underMinCats.map(({ key, label, min }) => (
                  <li key={key} className="text-xs text-red-600">{label}: {(fotosPredioCat[key] ?? []).length}/{min}</li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button type="button" onClick={() => setFotosWarning(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border-2 border-red-300 text-red-700 hover:bg-red-100 transition-all">
                  Cancelar
                </button>
                <button type="button" disabled={submitting}
                  onClick={async () => { if (pendingDataRef.current) await doSubmit(pendingDataRef.current) }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all disabled:opacity-60">
                  {submitting ? <Loader2 size={13} className="animate-spin inline" /> : 'Subir de todas formas'}
                </button>
              </div>
            </div>
          )}

          {/* Navegación */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-stone-200">
            <button type="button" onClick={prevStep} disabled={step === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-stone-400 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
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

// ─── Helpers de layout ────────────────────────────────────────────────────────

function ST({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-1">
      <span className="text-[#0d7377]">{icon}</span>
      <h2 className="text-lg font-black text-stone-900">{title}</h2>
    </div>
  )
}

function Div({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <div className="flex-1 h-px bg-stone-200" />
      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-stone-200" />
    </div>
  )
}
