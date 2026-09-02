'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, type FieldErrors } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { supabase } from '@/lib/supabase'
import { aliadoSchema, ETIQUETAS_ALIADO, type AliadoForm } from '@/lib/juridica-schema'
import { Shield, ArrowLeft, Loader2, Upload, X, Users } from 'lucide-react'
import Link from 'next/link'
import { MUNICIPIOS_CAQUETA, VEREDAS_POR_MUNICIPIO, type MunicipioCaqueta } from '@/lib/veredas-caqueta'
import { parsearRespuestaGuardado } from '@/lib/fetch-guardar'
import { comprimirAdjuntos, avisoPeso } from '@/lib/comprimir-imagen'

const ETIQUETAS_DOC: Record<string, string> = {
  cedula:                'Documento de identidad',
  certificado_tradicion: 'Certificado de tradición',
  recibo_predial:        'Recibo predial',
  manifestacion:         'Manifestación firmada',
}

/** Normaliza para comparar nombres: sin tildes, sin puntuación, sin dobles espacios. */
function normalizarNombre(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

const TIPOS_DOC = ['CC', 'NUIP', 'CE', 'TI', 'PP', 'NIT'] as const

function FileInput({ label, name, file, onChange, onClear }: {
  label: string; name: string
  file: File | null; onChange: (f: File) => void; onClear: () => void
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-stone-500 mb-1">{label}</label>
      {file ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-xl text-sm">
          <span className="truncate flex-1 text-teal-700 font-medium">{file.name}</span>
          <button type="button" onClick={onClear} className="text-teal-500 hover:text-red-500">
            <X size={14} />
          </button>
        </div>
      ) : (
        <label className="flex items-center gap-2 px-3 py-2 border-2 border-dashed border-stone-200 rounded-xl cursor-pointer hover:border-teal-400 transition-colors text-sm text-stone-400">
          <Upload size={14} />
          <span>Seleccionar archivo…</span>
          <input type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden"
            onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
        </label>
      )}
    </div>
  )
}

function Field({ label, error, children, hint }: {
  label: string; error?: string; children: React.ReactNode; hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-stone-500 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="text-[11px] text-stone-400 mt-0.5">{hint}</p>}
      {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
    </div>
  )
}

const INPUT = 'w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors bg-white'
const INPUT_ERR = 'w-full px-3 py-2.5 text-sm border border-red-300 rounded-xl focus:outline-none focus:border-red-400 transition-colors bg-white'

export default function NuevoAliadoPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [comprimiendo, setComprimiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [similares, setSimilares] = useState<{ id: string; nombre_completo: string; numero_documento: string }[]>([])

  const [pdfCedula, setPdfCedula] = useState<File | null>(null)
  const [pdfCert, setPdfCert]    = useState<File | null>(null)
  const [pdfRecibo, setPdfRecibo] = useState<File | null>(null)
  const [pdfManif, setPdfManif]  = useState<File | null>(null)
  const [selectedMunicipio, setSelectedMunicipio] = useState<MunicipioCaqueta | ''>('')
  const [matriculas, setMatriculas] = useState<string[]>([''])
  const [aliadoLock, setAliadoLock] = useState(false)
  const [prefillNombre, setPrefillNombre] = useState('')

  const { register, handleSubmit, watch, setValue, formState: { errors } } =
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
      if (!profile?.is_admin && profile?.department !== 'Juridica') {
        router.push('/'); return
      }
      setUserEmail(user.email ?? null)
      setAuthReady(true)
    })
  }, [router])

  // Caso "otro predio del propietario": prellenar y bloquear los datos de la persona
  useEffect(() => {
    const aliadoId = new URLSearchParams(window.location.search).get('aliado')
    if (!aliadoId) return
    supabase.schema('core').from('aliados')
      .select('nombre_completo, tipo_documento, numero_documento')
      .eq('id', aliadoId).single()
      .then(({ data }) => {
        if (!data) return
        setValue('nombre_completo', data.nombre_completo)
        setValue('tipo_documento', data.tipo_documento as AliadoForm['tipo_documento'])
        setValue('numero_documento', data.numero_documento)
        setPrefillNombre(data.nombre_completo)
        setAliadoLock(true)
      })
  }, [setValue])

  // Aviso de posible duplicado: la misma persona ya registrada con otro predio.
  // Sin esto se termina creando "Fulano" y "Fulano 2" como propietarios distintos.
  async function buscarSimilares(nombre: string) {
    const clave = normalizarNombre(nombre)
    if (aliadoLock || clave.length < 5) { setSimilares([]); return }
    const { data } = await supabase.schema('core').from('aliados')
      .select('id, nombre_completo, numero_documento')
      .limit(400)
    const apellidos = new Set(clave.split(' ').filter((t) => t.length > 2))
    setSimilares(
      (data ?? []).filter((a) => {
        const otro = normalizarNombre(a.nombre_completo)
        if (otro.includes(clave) || clave.includes(otro)) return true
        const comunes = otro.split(' ').filter((t) => t.length > 2 && apellidos.has(t))
        return comunes.length >= 2
      }).slice(0, 4),
    )
  }

  // Red de seguridad: si la validación falla, react-hook-form no llama a onSubmit
  // y el botón parece no hacer nada. Se nombra el campo — un genérico "revisa lo
  // marcado en rojo" obliga a recorrer un formulario largo a ojo.
  function onInvalid(errs: FieldErrors<AliadoForm>) {
    const detalle = Object.entries(errs)
      .map(([campo, e]) => {
        const msg = (e as { message?: string } | undefined)?.message
        return `${ETIQUETAS_ALIADO[campo] ?? campo}${msg ? `: ${msg}` : ''}`
      })
      .join(' · ')
    setError(`No se pudo guardar por estos campos → ${detalle}. Todo lo demás es opcional: puedes dejarlo vacío.`)
    const primero = Object.keys(errs)[0]
    document.querySelector<HTMLElement>(`[name="${primero}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function onSubmit(values: AliadoForm) {
    if (!userEmail) return
    setSaving(true)
    setError(null)
    try {
      // Comprimir las imágenes ANTES de armar el multipart: sin esto, dos fotos
      // de cédula tomadas con el celular ya superan el tope de Vercel (413).
      setComprimiendo(true)
      const comprimidos = await comprimirAdjuntos({
        cedula: pdfCedula,
        certificado_tradicion: pdfCert,
        recibo_predial: pdfRecibo,
        manifestacion: pdfManif,
      })
      setComprimiendo(false)
      const avisoTamano = avisoPeso(comprimidos, ETIQUETAS_DOC)
      if (avisoTamano) { setError(avisoTamano); return }

      const fd = new FormData()
      fd.append('data', JSON.stringify({
        ...values,
        matriculas: matriculas.map((m) => m.trim()).filter(Boolean),
        departamento: 'Caquetá', created_by: userEmail,
      }))
      for (const [campo, file] of Object.entries(comprimidos.archivos)) fd.append(campo, file)

      const res = await fetch('/api/juridica/aliados', { method: 'POST', body: fd })
      const result = await parsearRespuestaGuardado(res)
      if (!result.ok) { setError(result.error); return }
      // El caso ya quedó creado: no se puede reintentar aquí sin duplicarlo. Si algún
      // archivo falló, llevar a la edición (con el aviso) para re-adjuntarlo ahí.
      const nuevoId = result.body?.id
      if (!nuevoId) { setError('El caso se creó pero el servidor no devolvió su identificador. Búscalo en el listado.'); return }
      const fallidos = result.body?.documentos_fallidos ?? []
      router.push(fallidos.length
        ? `/intranet/juridica/${nuevoId}/editar?docs=${encodeURIComponent(fallidos.join(','))}`
        : `/intranet/juridica/${nuevoId}`)
    } finally {
      setComprimiendo(false)
      setSaving(false)
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
      <div className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/intranet/juridica" className="text-stone-400 hover:text-stone-700 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-teal-600" />
            <h1 className="text-lg font-black text-stone-900">Nuevo aliado — HOJA 1</h1>
          </div>
        </div>
      </div>

      {/* noValidate: la validación es solo la de zod. Con la del navegador activa,
          un número mal escrito ("2.024", "25,5") bloquea el envío con un globo
          nativo y el formulario parece no responder. */}
      <form noValidate onSubmit={handleSubmit(onSubmit, onInvalid)} className="max-w-2xl mx-auto px-6 py-8 space-y-8">

        {aliadoLock && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-800">
            Agregando <strong>otro predio</strong> del propietario <strong>{prefillNombre}</strong>. Los datos de la persona vienen del aliado existente; completa solo el nuevo predio.
          </div>
        )}

        <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm text-teal-800">
          Solo el <strong>nombre del predio</strong> es obligatorio. Puedes crear el caso ahora, enviarlo a SIG y
          completar propietario, documento, municipio, <strong>impuesto predial</strong> y archivos después — todo
          en paralelo. Los campos vacíos se guardan como &laquo;sin dato&raquo;, no bloquean.
        </div>

        {/* Sección 1: Identificación */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Identificación</h2>
          <Field label="Nombre completo" error={errors.nombre_completo?.message} hint="Opcional — se puede completar después">
            <input {...register('nombre_completo', { onBlur: (e) => buscarSimilares(e.target.value) })}
              readOnly={aliadoLock}
              className={`${errors.nombre_completo ? INPUT_ERR : INPUT}${aliadoLock ? ' bg-stone-50 text-stone-500' : ''}`}
              placeholder="Juan Pérez García" />
          </Field>
          {similares.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 space-y-2">
              <p className="flex items-center gap-2 font-bold"><Users size={14} /> ¿Es alguna de estas personas?</p>
              <p className="text-xs">
                Si es la misma, entra por aquí para <strong>colgar el nuevo predio del propietario que ya existe</strong>
                {' '}en vez de crear una ficha repetida.
              </p>
              <ul className="space-y-1">
                {similares.map((s) => (
                  <li key={s.id}>
                    {/* Recarga completa a propósito: el prellenado lee ?aliado= al montar,
                        y una navegación de cliente a esta misma ruta no vuelve a montarla. */}
                    <button type="button"
                      onClick={() => window.location.assign(`/intranet/juridica/nuevo?aliado=${s.id}`)}
                      className="text-xs font-bold text-amber-800 underline underline-offset-2 hover:text-amber-950 text-left">
                      {s.nombre_completo}
                      {!s.numero_documento.startsWith('S/D-') && ` — ${s.numero_documento}`}
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setSimilares([])}
                className="text-xs font-bold text-amber-700 hover:underline">
                No, es otra persona — seguir
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de documento">
              <select {...register('tipo_documento')} disabled={aliadoLock} className={INPUT}>
                {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Número de documento" error={errors.numero_documento?.message} hint="Opcional">
              <input {...register('numero_documento')} readOnly={aliadoLock} className={`${errors.numero_documento ? INPUT_ERR : INPUT}${aliadoLock ? ' bg-stone-50 text-stone-500' : ''}`} placeholder="1234567890" />
            </Field>
          </div>
          <FileInput
            label="Documento de identidad / cédula (PDF)"
            name="cedula"
            file={pdfCedula}
            onChange={setPdfCedula}
            onClear={() => setPdfCedula(null)}
          />
        </section>

        {/* Sección 2: Ubicación */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Ubicación del predio</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Departamento">
              <div className={`${INPUT} bg-stone-50 text-stone-500 cursor-not-allowed`}>Caquetá</div>
            </Field>
            <Field label="Municipio" error={errors.municipio?.message} hint="Opcional">
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
                {selectedMunicipio && VEREDAS_POR_MUNICIPIO[selectedMunicipio]?.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Zona AE">
              <input {...register('zona_ae')} className={INPUT} placeholder="Ej: Piedemonte" />
            </Field>
          </div>
          <Field label="Nombre del predio *" error={errors.nombre_predio?.message} hint="Único campo obligatorio">
            <input {...register('nombre_predio')} className={errors.nombre_predio ? INPUT_ERR : INPUT} placeholder="Finca La Esperanza" />
          </Field>
        </section>

        {/* Sección 3: Registro catastral */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Registro y catastro</h2>
          <Field label="Matrículas inmobiliarias" hint="Un predio puede tener varias (englobe). La primera es la principal.">
            <div className="space-y-2">
              {matriculas.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={m}
                    onChange={(e) => setMatriculas((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                    className={INPUT} placeholder="420-3478" />
                  {matriculas.length > 1 && (
                    <button type="button" onClick={() => setMatriculas((arr) => arr.filter((_, j) => j !== i))}
                      className="text-stone-400 hover:text-red-500 shrink-0"><X size={16} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setMatriculas((arr) => [...arr, ''])}
                className="text-xs font-bold text-teal-600 hover:underline">+ Agregar matrícula</button>
            </div>
          </Field>
          {/* type="text": con type="number" el navegador vacía el campo al escribir
              "25,5" y bloquea el envío por su cuenta. El schema ya acepta coma o punto. */}
          <Field label="Área registral (ha)" error={errors.area_registral?.message} hint="Opcional — acepta coma o punto (25,5)">
            <input {...register('area_registral')} type="text" inputMode="decimal" className={errors.area_registral ? INPUT_ERR : INPUT} placeholder="25,5" />
          </Field>
          <Field label="Código catastral" hint="Se preservan ceros a la izquierda">
            <input {...register('codigo_catastral')} className={INPUT} placeholder="18001000400..." />
          </Field>
          <FileInput
            label="Certificado de tradición y libertad (PDF)"
            name="cert"
            file={pdfCert}
            onChange={setPdfCert}
            onClear={() => setPdfCert(null)}
          />
        </section>

        {/* Sección 4: Predial */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Impuesto predial</h2>
          <Field label="Año último pago predial" error={errors.anio_ultimo_pago_predial?.message}
            hint="Opcional — déjalo vacío si el predio todavía no tiene esta información">
            <input {...register('anio_ultimo_pago_predial')} type="text" inputMode="numeric" className={errors.anio_ultimo_pago_predial ? INPUT_ERR : INPUT} placeholder="2024" />
          </Field>
          <FileInput
            label="Recibo del último pago predial (PDF)"
            name="recibo"
            file={pdfRecibo}
            onChange={setPdfRecibo}
            onClear={() => setPdfRecibo(null)}
          />
        </section>

        {/* Sección 5: Manifestación de interés */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Manifestación de interés</h2>
          <Field label="¿Manifestó interés?">
            <div className="flex gap-3">
              {[{ v: true, l: 'Sí' }, { v: false, l: 'No' }].map(({ v, l }) => (
                <button
                  key={l} type="button"
                  onClick={() => setValue('manifestacion_interes', v)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                    manifestacion === v
                      ? 'border-teal-400 bg-teal-50 text-teal-700'
                      : 'border-stone-200 text-stone-500 hover:border-stone-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </Field>
          {manifestacion !== undefined && (
            <Field label="Observaciones">
              <textarea {...register('manifestacion_observaciones')} rows={3} className={INPUT} placeholder="Observaciones sobre la manifestación…" />
            </Field>
          )}
          <FileInput
            label="Manifestación firmada (PDF)"
            name="manif"
            file={pdfManif}
            onChange={setPdfManif}
            onClear={() => setPdfManif(null)}
          />
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="flex gap-3 pb-8">
          <Link href="/intranet/juridica"
            className="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 text-center transition-colors">
            Cancelar
          </Link>
          <button
            type="submit" disabled={saving}
            className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {comprimiendo ? 'Comprimiendo imágenes…' : 'Guardar aliado'}
          </button>
        </div>
      </form>
    </div>
  )
}
