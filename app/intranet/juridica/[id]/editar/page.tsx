'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { supabase } from '@/lib/supabase'
import { aliadoSchema, type AliadoForm, type Aliado } from '@/lib/juridica-schema'
import { Shield, ArrowLeft, Loader2, Upload, X, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { MUNICIPIOS_CAQUETA, VEREDAS_POR_MUNICIPIO, type MunicipioCaqueta } from '@/lib/veredas-caqueta'

const TIPOS_DOC = ['CC', 'NUIP', 'CE', 'TI', 'PP', 'NIT'] as const
const INPUT     = 'w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors bg-white'
const INPUT_ERR = 'w-full px-3 py-2.5 text-sm border border-red-300 rounded-xl focus:outline-none focus:border-red-400 transition-colors bg-white'

function FileInput({ label, existingUrl, file, onChange, onClear }: {
  label: string; existingUrl?: string | null
  file: File | null; onChange: (f: File) => void; onClear: () => void
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-stone-500 mb-1">{label}</label>
      {existingUrl && !file && (
        <div className="flex items-center gap-2 mb-1">
          <a href={existingUrl} target="_blank" rel="noreferrer"
            className="text-xs text-teal-600 font-bold flex items-center gap-1 hover:underline">
            Ver PDF actual <ExternalLink size={10} />
          </a>
        </div>
      )}
      {file ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-xl text-sm">
          <span className="truncate flex-1 text-teal-700 font-medium">{file.name}</span>
          <button type="button" onClick={onClear} className="text-teal-500 hover:text-red-500"><X size={14} /></button>
        </div>
      ) : (
        <label className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-stone-200 rounded-xl cursor-pointer hover:border-teal-400 transition-colors text-sm text-stone-400">
          <Upload size={14} />
          <span>{existingUrl ? 'Reemplazar PDF…' : 'Seleccionar PDF…'}</span>
          <input type="file" accept="application/pdf" className="hidden"
            onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
        </label>
      )}
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-stone-500 mb-1">{label}</label>
      {children}
      {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

export default function EditarAliadoPage() {
  const router   = useRouter()
  const { id }   = useParams<{ id: string }>()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [aliado, setAliado]       = useState<Aliado | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [pdfCedula, setPdfCedula] = useState<File | null>(null)
  const [pdfCert, setPdfCert]     = useState<File | null>(null)
  const [pdfRecibo, setPdfRecibo] = useState<File | null>(null)
  const [pdfManif, setPdfManif]   = useState<File | null>(null)
  const [selectedMunicipio, setSelectedMunicipio] = useState<MunicipioCaqueta | ''>('')

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } =
    useForm<AliadoForm>({ resolver: standardSchemaResolver(aliadoSchema) as any })

  const manifestacion = watch('manifestacion_interes')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department')
        .eq('email', user.email)
        .single()
      if (!profile?.is_admin && profile?.department !== 'Juridica') { router.push('/'); return }
      setUserEmail(user.email ?? null)
      setAuthReady(true)
    })
  }, [router])

  useEffect(() => {
    if (!authReady || !userEmail || !id) return
    fetch(`/api/juridica/aliados/${id}?email=${encodeURIComponent(userEmail)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data: Aliado) => {
        setAliado(data)
        setSelectedMunicipio((data.municipio ?? '') as MunicipioCaqueta | '')
        reset({
          nombre_completo:             data.nombre_completo,
          tipo_documento:              data.tipo_documento as AliadoForm['tipo_documento'],
          numero_documento:            data.numero_documento,
          departamento:                'Caquetá',
          municipio:                   data.municipio,
          vereda:                      data.vereda ?? '',
          zona_ae:                     data.zona_ae ?? '',
          nombre_predio:               data.nombre_predio ?? '',
          matricula_inmobiliaria:      data.matricula_inmobiliaria ?? '',
          area_registral:              data.area_registral ?? undefined,
          codigo_catastral:            data.codigo_catastral ?? '',
          anio_ultimo_pago_predial:    data.anio_ultimo_pago_predial ?? undefined,
          manifestacion_interes:       data.manifestacion_interes ?? undefined,
          manifestacion_observaciones: data.manifestacion_observaciones ?? '',
        })
        setLoading(false)
      })
      .catch(() => router.push('/intranet/juridica'))
  }, [authReady, userEmail, id, reset, router])

  async function onSubmit(values: AliadoForm) {
    if (!userEmail) return
    setSaving(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('data', JSON.stringify({ ...values, departamento: 'Caquetá', updated_by: userEmail }))
      if (pdfCedula) fd.append('cedula', pdfCedula)
      if (pdfCert)   fd.append('certificado_tradicion', pdfCert)
      if (pdfRecibo) fd.append('recibo_predial', pdfRecibo)
      if (pdfManif)  fd.append('manifestacion', pdfManif)

      const res = await fetch(`/api/juridica/aliados/${id}`, { method: 'PATCH', body: fd })
      const body = await res.json()
      if (!res.ok) { setError(body.error ?? 'Error al guardar'); return }
      router.push(`/intranet/juridica/${id}`)
    } finally {
      setSaving(false)
    }
  }

  if (!authReady || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="animate-spin text-stone-400" size={32} /></div>
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href={`/intranet/juridica/${id}`} className="text-stone-400 hover:text-stone-700 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <Shield size={18} className="text-teal-600" />
          <div>
            <h1 className="text-lg font-black text-stone-900">Editar HOJA 1</h1>
            {aliado && <p className="text-xs text-stone-400">{aliado.nombre_completo}</p>}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Identificación</h2>
          <Field label="Nombre completo *" error={errors.nombre_completo?.message}>
            <input {...register('nombre_completo')} className={errors.nombre_completo ? INPUT_ERR : INPUT} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de documento">
              <select {...register('tipo_documento')} className={INPUT}>
                {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Número de documento *" error={errors.numero_documento?.message}>
              <input {...register('numero_documento')} className={errors.numero_documento ? INPUT_ERR : INPUT} />
            </Field>
          </div>
          <FileInput label="Documento de identidad / cédula (PDF)" existingUrl={aliado?.cedula_url}
            file={pdfCedula} onChange={setPdfCedula} onClear={() => setPdfCedula(null)} />
        </section>

        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Ubicación del predio</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Departamento">
              <div className={`${INPUT} bg-stone-50 text-stone-500 cursor-not-allowed`}>Caquetá</div>
            </Field>
            <Field label="Municipio *" error={errors.municipio?.message}>
              <select
                value={selectedMunicipio}
                onChange={(e) => {
                  const val = e.target.value as MunicipioCaqueta | ''
                  setSelectedMunicipio(val)
                  setValue('municipio', val, { shouldValidate: true })
                  setValue('vereda', '')
                }}
                className={errors.municipio ? INPUT_ERR : INPUT}
              >
                <option value="">— Seleccione municipio —</option>
                {MUNICIPIOS_CAQUETA.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vereda">
              <select
                {...register('vereda')}
                disabled={!selectedMunicipio}
                className={`${INPUT} ${!selectedMunicipio ? 'bg-stone-50 text-stone-400 cursor-not-allowed' : ''}`}
              >
                <option value="">— Seleccione vereda —</option>
                {selectedMunicipio && VEREDAS_POR_MUNICIPIO[selectedMunicipio].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Zona AE"><input {...register('zona_ae')} className={INPUT} /></Field>
          </div>
          <Field label="Nombre del predio"><input {...register('nombre_predio')} className={INPUT} /></Field>
        </section>

        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Registro y catastro</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Matrícula inmobiliaria"><input {...register('matricula_inmobiliaria')} className={INPUT} /></Field>
            <Field label="Área registral (ha)"><input {...register('area_registral')} type="number" step="0.0001" min="0" className={INPUT} /></Field>
          </div>
          <Field label="Código catastral"><input {...register('codigo_catastral')} className={INPUT} /></Field>
          <FileInput label="Certificado de tradición (PDF)" existingUrl={aliado?.certificado_tradicion_url}
            file={pdfCert} onChange={setPdfCert} onClear={() => setPdfCert(null)} />
        </section>

        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Impuesto predial</h2>
          <Field label="Año último pago">
            <input {...register('anio_ultimo_pago_predial')} type="number" min="1990" max="2100" className={INPUT} />
          </Field>
          <FileInput label="Recibo predial (PDF)" existingUrl={aliado?.recibo_predial_url}
            file={pdfRecibo} onChange={setPdfRecibo} onClear={() => setPdfRecibo(null)} />
        </section>

        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Manifestación de interés</h2>
          <div className="flex gap-3">
            {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(({ v, l }) => (
              <button key={l} type="button" onClick={() => setValue('manifestacion_interes', v)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${manifestacion === v ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
                {l}
              </button>
            ))}
          </div>
          <Field label="Observaciones">
            <textarea {...register('manifestacion_observaciones')} rows={3} className={INPUT} />
          </Field>
          <FileInput label="Manifestación firmada (PDF)" existingUrl={aliado?.manifestacion_url}
            file={pdfManif} onChange={setPdfManif} onClear={() => setPdfManif(null)} />
        </section>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold px-4 py-3 rounded-xl">{error}</div>}

        <div className="flex gap-3 pb-8">
          <Link href={`/intranet/juridica/${id}`}
            className="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 text-center transition-colors">
            Cancelar
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  )
}
