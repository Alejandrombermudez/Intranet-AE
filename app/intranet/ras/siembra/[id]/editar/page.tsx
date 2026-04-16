'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Loader2, Save, Users, MapPin, Trees,
  FileArchive, ExternalLink, UploadCloud, Leaf, FileText,
} from 'lucide-react'

const PRIMARY = '#0d7377'

interface FamiliaEdit {
  municipio: string
  vereda: string
  nombre_finca: string
  nombre_propietario: string
  tipo_documento: string
  numero_documento: string
  telefono: string
  nucleo: string
  departamento: string
  adultos: string
  ninos: string
  cant_mujeres: string
  cant_hombres: string
  actividad_economica: string
  tiene_espacio_vegetal: boolean
  empleos_locales: string
  bajo_conservacion: boolean
  ha_potreros: string
  ha_bosque: string
  ha_otras: string
  num_individuos: string
  num_especies_inventario: string
  area_bosque_recorrida: string
  distancia_florencia_km: string
  tiempo_florencia_min: string
  ha_restauracion: string
  parcelas_monitoreo: string
  plantulas_sembradas: string
  especies_sembradas: string
  plan_restauracion: string
  shapefile_finca_url: string | null
  shapefile_restauracion_url: string | null
  shapefile_arboles_url: string | null
  documento_acuerdo_url: string | null
  nombre_propietario_display: string
}

const EMPTY: FamiliaEdit = {
  municipio: '', vereda: '', nombre_finca: '', nombre_propietario: '',
  tipo_documento: '', numero_documento: '', telefono: '',
  nucleo: '', departamento: '',
  adultos: '', ninos: '', cant_mujeres: '', cant_hombres: '',
  actividad_economica: '', tiene_espacio_vegetal: false, empleos_locales: '',
  bajo_conservacion: false,
  ha_potreros: '', ha_bosque: '', ha_otras: '',
  num_individuos: '', num_especies_inventario: '', area_bosque_recorrida: '',
  distancia_florencia_km: '', tiempo_florencia_min: '',
  ha_restauracion: '', parcelas_monitoreo: '', plantulas_sembradas: '', especies_sembradas: '',
  plan_restauracion: '',
  shapefile_finca_url: null, shapefile_restauracion_url: null,
  shapefile_arboles_url: null, documento_acuerdo_url: null,
  nombre_propietario_display: '',
}

const inputCls = 'w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'
const labelCls = 'block text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-1'

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
      <div className="flex items-center gap-2 mb-5">
        <span style={{ color: PRIMARY }}>{icon}</span>
        <h2 className="text-base font-black text-stone-900">{title}</h2>
      </div>
      {children}
    </section>
  )
}

export default function SiembraEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FamiliaEdit>(EMPTY)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [shpFinca, setShpFinca] = useState<File | null>(null)
  const [shpRestauracion, setShpRestauracion] = useState<File | null>(null)
  const [shpArboles, setShpArboles] = useState<File | null>(null)
  const [docAcuerdo, setDocAcuerdo] = useState<File | null>(null)
  const shpFincaRef = useRef<HTMLInputElement>(null)
  const shpRestauracionRef = useRef<HTMLInputElement>(null)
  const shpArbolesRef = useRef<HTMLInputElement>(null)
  const docAcuerdoRef = useRef<HTMLInputElement>(null)

  const set = (key: keyof FamiliaEdit, val: string | boolean | null) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: profile } = await supabase
        .from('user_profiles').select('is_admin, department').eq('email', user.email).single()
      if (!profile?.is_admin && profile?.department !== 'RAS') { router.push('/'); return }

      const { data: { session } } = await supabase.auth.getSession()
      setAccessToken(session?.access_token ?? null)

      const { data: fam, error } = await supabase
        .schema('siembra').from('familias').select('*').eq('id', id).single()

      if (error || !fam) { router.push('/intranet/ras/siembra'); return }

      setForm({
        municipio: fam.municipio ?? '',
        vereda: fam.vereda ?? '',
        nombre_finca: fam.nombre_finca ?? '',
        nombre_propietario: fam.nombre_propietario ?? '',
        tipo_documento: fam.tipo_documento ?? '',
        numero_documento: fam.numero_documento ?? '',
        telefono: fam.telefono ?? '',
        nucleo: fam.nucleo ?? '',
        departamento: fam.departamento ?? '',
        adultos: fam.adultos != null ? String(fam.adultos) : '',
        ninos: fam.ninos != null ? String(fam.ninos) : '',
        cant_mujeres: fam.cant_mujeres != null ? String(fam.cant_mujeres) : '',
        cant_hombres: fam.cant_hombres != null ? String(fam.cant_hombres) : '',
        actividad_economica: fam.actividad_economica ?? '',
        tiene_espacio_vegetal: fam.tiene_espacio_vegetal ?? false,
        empleos_locales: fam.empleos_locales != null ? String(fam.empleos_locales) : '',
        bajo_conservacion: fam.bajo_conservacion ?? false,
        ha_potreros: fam.ha_potreros != null ? String(fam.ha_potreros) : '',
        ha_bosque: fam.ha_bosque != null ? String(fam.ha_bosque) : '',
        ha_otras: fam.ha_otras != null ? String(fam.ha_otras) : '',
        num_individuos: fam.num_individuos != null ? String(fam.num_individuos) : '',
        num_especies_inventario: fam.num_especies_inventario != null ? String(fam.num_especies_inventario) : '',
        area_bosque_recorrida: fam.area_bosque_recorrida != null ? String(fam.area_bosque_recorrida) : '',
        distancia_florencia_km: fam.distancia_florencia_km != null ? String(fam.distancia_florencia_km) : '',
        tiempo_florencia_min: fam.tiempo_florencia_min != null ? String(fam.tiempo_florencia_min) : '',
        ha_restauracion: fam.ha_restauracion != null ? String(fam.ha_restauracion) : '',
        parcelas_monitoreo: fam.parcelas_monitoreo != null ? String(fam.parcelas_monitoreo) : '',
        plantulas_sembradas: fam.plantulas_sembradas != null ? String(fam.plantulas_sembradas) : '',
        especies_sembradas: fam.especies_sembradas != null ? String(fam.especies_sembradas) : '',
        plan_restauracion: fam.plan_restauracion ?? '',
        shapefile_finca_url: fam.shapefile_finca_url ?? null,
        shapefile_restauracion_url: fam.shapefile_restauracion_url ?? null,
        shapefile_arboles_url: fam.shapefile_arboles_url ?? null,
        documento_acuerdo_url: fam.documento_acuerdo_url ?? null,
        nombre_propietario_display: fam.nombre_propietario ?? '',
      })
      setLoading(false)
    }
    init()
  }, [id, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.municipio.trim() || !form.nombre_propietario.trim()) {
      alert('Municipio y nombre del propietario son obligatorios.')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('fields', JSON.stringify({
        municipio: form.municipio.trim(),
        vereda: form.vereda.trim() || null,
        nombre_finca: form.nombre_finca.trim() || null,
        nombre_propietario: form.nombre_propietario.trim(),
        tipo_documento: form.tipo_documento.trim() || null,
        numero_documento: form.numero_documento.trim() || null,
        telefono: form.telefono.trim() || null,
        nucleo: form.nucleo.trim() || null,
        departamento: form.departamento.trim() || null,
        adultos: form.adultos !== '' ? Number(form.adultos) : null,
        ninos: form.ninos !== '' ? Number(form.ninos) : null,
        cant_mujeres: form.cant_mujeres !== '' ? Number(form.cant_mujeres) : null,
        cant_hombres: form.cant_hombres !== '' ? Number(form.cant_hombres) : null,
        actividad_economica: form.actividad_economica.trim() || null,
        tiene_espacio_vegetal: form.tiene_espacio_vegetal,
        empleos_locales: form.empleos_locales !== '' ? Number(form.empleos_locales) : null,
        bajo_conservacion: form.bajo_conservacion,
        ha_potreros: form.ha_potreros !== '' ? Number(form.ha_potreros) : null,
        ha_bosque: form.ha_bosque !== '' ? Number(form.ha_bosque) : null,
        ha_otras: form.ha_otras !== '' ? Number(form.ha_otras) : null,
        num_individuos: form.num_individuos !== '' ? Number(form.num_individuos) : null,
        num_especies_inventario: form.num_especies_inventario !== '' ? Number(form.num_especies_inventario) : null,
        area_bosque_recorrida: form.area_bosque_recorrida !== '' ? Number(form.area_bosque_recorrida) : null,
        distancia_florencia_km: form.distancia_florencia_km !== '' ? Number(form.distancia_florencia_km) : null,
        tiempo_florencia_min: form.tiempo_florencia_min !== '' ? Number(form.tiempo_florencia_min) : null,
        ha_restauracion: form.ha_restauracion !== '' ? Number(form.ha_restauracion) : null,
        parcelas_monitoreo: form.parcelas_monitoreo !== '' ? Number(form.parcelas_monitoreo) : null,
        plantulas_sembradas: form.plantulas_sembradas !== '' ? Number(form.plantulas_sembradas) : null,
        especies_sembradas: form.especies_sembradas !== '' ? Number(form.especies_sembradas) : null,
        plan_restauracion: form.plan_restauracion.trim() || null,
      }))
      if (shpFinca) fd.append('shp_finca', shpFinca)
      if (shpRestauracion) fd.append('shp_restauracion', shpRestauracion)
      if (shpArboles) fd.append('shp_arboles', shpArboles)
      if (docAcuerdo) fd.append('doc_acuerdo', docAcuerdo)

      const res = await fetch(`/api/ras/familias/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken ?? ''}` },
        body: fd,
      })

      if (res.ok) {
        router.push(`/intranet/ras/siembra/${id}`)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? 'Error al guardar los cambios.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 size={36} className="animate-spin" style={{ color: PRIMARY }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">

      {/* Header */}
      <header className="bg-white shadow-md border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link href={`/intranet/ras/siembra/${id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-primary hover:text-primary hover:bg-primary/5 transition-all shrink-0">
              <ArrowLeft size={16} />
              <span className="hidden sm:block">Volver</span>
            </Link>
            <div className="text-center flex-1">
              <div className="inline-flex items-center gap-2">
                <Leaf size={18} style={{ color: PRIMARY }} />
                <h1 className="text-xl font-black text-stone-900 truncate max-w-xs">
                  Editar — {form.nombre_propietario_display}
                </h1>
              </div>
              <p className="text-xs text-stone-500 mt-0.5 uppercase tracking-widest font-semibold">
                Restauración / Siembra
              </p>
            </div>
            <button
              type="submit" form="edit-form" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0 shadow-sm hover:shadow-md transition-all disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span className="hidden sm:block">Guardar</span>
            </button>
          </div>
        </div>
      </header>

      <form id="edit-form" onSubmit={handleSubmit}>
        <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 space-y-6">

          {/* ── Identificación ── */}
          <SectionCard icon={<Users size={16} />} title="Identificación y Contacto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Nombre del Propietario *</label>
                <input value={form.nombre_propietario} onChange={(e) => set('nombre_propietario', e.target.value)}
                  className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}>Tipo de Documento</label>
                <select value={form.tipo_documento} onChange={(e) => set('tipo_documento', e.target.value)} className={inputCls}>
                  <option value="">— Seleccionar —</option>
                  <option value="CC">CC – Cédula de Ciudadanía</option>
                  <option value="NUIP">NUIP</option>
                  <option value="CE">CE – Cédula de Extranjería</option>
                  <option value="TI">TI – Tarjeta de Identidad</option>
                  <option value="PP">PP – Pasaporte</option>
                  <option value="NIT">NIT</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>N.º de Identificación</label>
                <input value={form.numero_documento} onChange={(e) => set('numero_documento', e.target.value)}
                  className={inputCls} placeholder="Ej. 17634957, Florencia" />
              </div>
              <div>
                <label className={labelCls}>Teléfono de Contacto</label>
                <input value={form.telefono} onChange={(e) => set('telefono', e.target.value)}
                  className={inputCls} placeholder="Ej. 3101234567" />
              </div>
              <div>
                <label className={labelCls}>Núcleo</label>
                <input value={form.nucleo} onChange={(e) => set('nucleo', e.target.value)}
                  className={inputCls} placeholder="Ej. Piedemonte" />
              </div>
              <div>
                <label className={labelCls}>Departamento</label>
                <input value={form.departamento} onChange={(e) => set('departamento', e.target.value)}
                  className={inputCls} placeholder="Ej. Caquetá" />
              </div>
              <div>
                <label className={labelCls}>Municipio *</label>
                <input value={form.municipio} onChange={(e) => set('municipio', e.target.value)}
                  className={inputCls} placeholder="Ej. Florencia" required />
              </div>
              <div>
                <label className={labelCls}>Vereda</label>
                <input value={form.vereda} onChange={(e) => set('vereda', e.target.value)}
                  className={inputCls} placeholder="Ej. La Esperanza" />
              </div>
              <div>
                <label className={labelCls}>Nombre de la Finca</label>
                <input value={form.nombre_finca} onChange={(e) => set('nombre_finca', e.target.value)}
                  className={inputCls} placeholder="Ej. El Paraíso" />
              </div>
            </div>
          </SectionCard>

          {/* ── Hogar & Economía ── */}
          <SectionCard icon={<Users size={16} />} title="Composición del Hogar y Economía">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <label className={labelCls}>Adultos</label>
                <input type="number" min="0" value={form.adultos} onChange={(e) => set('adultos', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>Niños</label>
                <input type="number" min="0" value={form.ninos} onChange={(e) => set('ninos', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>Mujeres</label>
                <input type="number" min="0" value={form.cant_mujeres} onChange={(e) => set('cant_mujeres', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>Hombres</label>
                <input type="number" min="0" value={form.cant_hombres} onChange={(e) => set('cant_hombres', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={labelCls}>Actividad Económica Principal</label>
                <input value={form.actividad_economica} onChange={(e) => set('actividad_economica', e.target.value)}
                  className={inputCls} placeholder="Ej. Ganadería de leche, Forestal…" />
              </div>
              <div>
                <label className={labelCls}>Empleos Locales Generados</label>
                <input type="number" min="0" value={form.empleos_locales} onChange={(e) => set('empleos_locales', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
              <div className="flex flex-col justify-end">
                <label className={labelCls}>Espacio para Material Vegetal</label>
                <div className="flex gap-3 mt-1">
                  {[true, false].map((val) => (
                    <button key={String(val)} type="button"
                      onClick={() => set('tiene_espacio_vegetal', val)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                        form.tiene_espacio_vegetal === val
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-stone-200 text-stone-400 hover:border-stone-300'
                      }`}>
                      {val ? 'Sí' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ── Predio & Inventario ── */}
          <SectionCard icon={<MapPin size={16} />} title="Predio e Inventario Forestal">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelCls}>Bosque (ha)</label>
                <input type="number" min="0" step="0.01" value={form.ha_bosque}
                  onChange={(e) => set('ha_bosque', e.target.value)}
                  className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className={labelCls}>Potreros (ha)</label>
                <input type="number" min="0" step="0.01" value={form.ha_potreros}
                  onChange={(e) => set('ha_potreros', e.target.value)}
                  className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className={labelCls}>Otras (ha)</label>
                <input type="number" min="0" step="0.01" value={form.ha_otras}
                  onChange={(e) => set('ha_otras', e.target.value)}
                  className={inputCls} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={labelCls}>N.º Individuos (árboles)</label>
                <input type="number" min="0" value={form.num_individuos}
                  onChange={(e) => set('num_individuos', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>N.º Especies (inventario)</label>
                <input type="number" min="0" value={form.num_especies_inventario}
                  onChange={(e) => set('num_especies_inventario', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>Bosque Recorrido (ha)</label>
                <input type="number" min="0" step="0.1" value={form.area_bosque_recorrida}
                  onChange={(e) => set('area_bosque_recorrida', e.target.value)}
                  className={inputCls} placeholder="0.0" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>Distancia a Florencia/Morelia (km)</label>
                <input type="number" min="0" step="0.1" value={form.distancia_florencia_km}
                  onChange={(e) => set('distancia_florencia_km', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>Tiempo de Viaje (min)</label>
                <input type="number" min="0" value={form.tiempo_florencia_min}
                  onChange={(e) => set('tiempo_florencia_min', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
            </div>
            <div className="flex flex-col">
              <label className={labelCls}>Bajo Figura de Conservación</label>
              <div className="flex gap-3 mt-1">
                {[true, false].map((val) => (
                  <button key={String(val)} type="button"
                    onClick={() => set('bajo_conservacion', val)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                      form.bajo_conservacion === val
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-stone-200 text-stone-400 hover:border-stone-300'
                    }`}>
                    {val ? 'Sí' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* ── Restauración ── */}
          <SectionCard icon={<Trees size={16} />} title="Datos de Restauración">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className={labelCls}>Ha. en Restauración</label>
                <input type="number" min="0" step="0.01" value={form.ha_restauracion}
                  onChange={(e) => set('ha_restauracion', e.target.value)}
                  className={inputCls} placeholder="0.00" />
              </div>
              <div>
                <label className={labelCls}>Parcelas de Monitoreo</label>
                <input type="number" min="0" value={form.parcelas_monitoreo}
                  onChange={(e) => set('parcelas_monitoreo', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>Plántulas Sembradas</label>
                <input type="number" min="0" value={form.plantulas_sembradas}
                  onChange={(e) => set('plantulas_sembradas', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
              <div>
                <label className={labelCls}>Especies Sembradas</label>
                <input type="number" min="0" value={form.especies_sembradas}
                  onChange={(e) => set('especies_sembradas', e.target.value)}
                  className={inputCls} placeholder="0" />
              </div>
            </div>
            <div>
              <label className={labelCls}>Plan de Restauración</label>
              <textarea value={form.plan_restauracion}
                onChange={(e) => set('plan_restauracion', e.target.value)}
                rows={4} className={`${inputCls} resize-none`}
                placeholder="Descripción del plan de restauración..." />
            </div>
          </SectionCard>

          {/* ── Archivos Espaciales ── */}
          <SectionCard icon={<FileArchive size={16} />} title="Archivos Espaciales">
            <div className="space-y-4">

              {/* Shapefile finca */}
              <div>
                <label className={labelCls}>Polígono de la Finca (.zip)</label>
                {form.shapefile_finca_url && !shpFinca && (
                  <a href={form.shapefile_finca_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 mb-2 text-sm font-bold text-primary hover:underline">
                    <FileArchive size={14} /> Archivo actual
                    <ExternalLink size={11} className="text-stone-400" />
                  </a>
                )}
                <button type="button"
                  onClick={() => shpFincaRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 text-sm font-semibold hover:border-primary hover:text-primary transition-all w-full justify-center">
                  <UploadCloud size={16} />
                  {shpFinca ? shpFinca.name : (form.shapefile_finca_url ? 'Reemplazar archivo' : 'Subir archivo .zip')}
                </button>
                <input ref={shpFincaRef} type="file" accept=".zip" className="hidden"
                  onChange={(e) => setShpFinca(e.target.files?.[0] ?? null)} />
              </div>

              {/* Shapefile restauración */}
              <div>
                <label className={labelCls}>Polígono de Restauración (.zip)</label>
                {form.shapefile_restauracion_url && !shpRestauracion && (
                  <a href={form.shapefile_restauracion_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 mb-2 text-sm font-bold text-primary hover:underline">
                    <FileArchive size={14} /> Archivo actual
                    <ExternalLink size={11} className="text-stone-400" />
                  </a>
                )}
                <button type="button"
                  onClick={() => shpRestauracionRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 text-sm font-semibold hover:border-primary hover:text-primary transition-all w-full justify-center">
                  <UploadCloud size={16} />
                  {shpRestauracion ? shpRestauracion.name : (form.shapefile_restauracion_url ? 'Reemplazar archivo' : 'Subir archivo .zip')}
                </button>
                <input ref={shpRestauracionRef} type="file" accept=".zip" className="hidden"
                  onChange={(e) => setShpRestauracion(e.target.files?.[0] ?? null)} />
              </div>

              {/* Shapefile árboles */}
              <div>
                <label className={labelCls}>Árboles — Shapefile de puntos (.zip)</label>
                {form.shapefile_arboles_url && !shpArboles && (
                  <a href={form.shapefile_arboles_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 mb-2 text-sm font-bold text-primary hover:underline">
                    <FileArchive size={14} /> Archivo actual
                    <ExternalLink size={11} className="text-stone-400" />
                  </a>
                )}
                <button type="button"
                  onClick={() => shpArbolesRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 text-sm font-semibold hover:border-primary hover:text-primary transition-all w-full justify-center">
                  <UploadCloud size={16} />
                  {shpArboles ? shpArboles.name : (form.shapefile_arboles_url ? 'Reemplazar archivo' : 'Subir archivo .zip')}
                </button>
                <input ref={shpArbolesRef} type="file" accept=".zip" className="hidden"
                  onChange={(e) => setShpArboles(e.target.files?.[0] ?? null)} />
              </div>

              {/* Documento acuerdo PDF */}
              <div>
                <label className={labelCls}>Acuerdo / Tratamiento de Datos (PDF, opcional)</label>
                {form.documento_acuerdo_url && !docAcuerdo && (
                  <a href={form.documento_acuerdo_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 mb-2 text-sm font-bold text-primary hover:underline">
                    <FileText size={14} /> Ver documento actual
                    <ExternalLink size={11} className="text-stone-400" />
                  </a>
                )}
                <button type="button"
                  onClick={() => docAcuerdoRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-stone-300 text-stone-500 text-sm font-semibold hover:border-primary hover:text-primary transition-all w-full justify-center">
                  <UploadCloud size={16} />
                  {docAcuerdo ? docAcuerdo.name : (form.documento_acuerdo_url ? 'Reemplazar PDF' : 'Subir PDF')}
                </button>
                <input ref={docAcuerdoRef} type="file" accept=".pdf" className="hidden"
                  onChange={(e) => setDocAcuerdo(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          </SectionCard>

          {/* Botón guardar móvil */}
          <div className="pb-4">
            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-base font-black text-white shadow-md hover:shadow-lg transition-all disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>

        </main>
      </form>

      <footer className="max-w-4xl mx-auto px-4 py-6 sm:px-6 text-center text-stone-500 text-sm">
        <p className="font-semibold">© {new Date().getFullYear()} Amazonia Emprende — Todos los derechos reservados</p>
      </footer>
    </div>
  )
}
