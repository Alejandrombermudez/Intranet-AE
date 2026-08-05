'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { type Antecedente } from '@/lib/juridica-schema'
import { parsearRespuestaGuardado, mensajeDocumentosFallidos } from '@/lib/fetch-guardar'
import { Shield, ArrowLeft, Loader2, Upload, X, ExternalLink, CheckCircle2, XCircle, HelpCircle } from 'lucide-react'

// ─── Listas restrictivas ──────────────────────────────────────────────────────

const LISTAS_NACIONALES = [
  { key: 'rama_judicial',   label: 'Rama Judicial' },
  { key: 'procuraduria',    label: 'Procuraduría General de la Nación' },
  { key: 'contraloria',     label: 'Contraloría General de la República' },
  { key: 'policia_nacional',label: 'Policía Nacional' },
  { key: 'rnmc',            label: 'RNMC (Registro Nacional Medidas Correctivas)' },
] as const

const LISTAS_INTERNACIONALES = [
  { key: 'onu',            label: 'ONU — Sanciones' },
  { key: 'ofac',           label: 'OFAC (EE.UU.)' },
  { key: 'bid',            label: 'BID — Banco Interamericano' },
  { key: 'banco_mundial',  label: 'Banco Mundial' },
  { key: 'hm_treasury',    label: 'HM Treasury (UK)' },
  { key: 'fbi',            label: 'FBI' },
  { key: 'interpol',       label: 'INTERPOL' },
  { key: 'ue_terroristas', label: 'UE — Organizaciones Terroristas' },
  { key: 'dea',            label: 'DEA' },
] as const

type ListaKey = typeof LISTAS_NACIONALES[number]['key'] | typeof LISTAS_INTERNACIONALES[number]['key']
type ListaValue = boolean | null  // null = no consultada, false = limpia, true = bandera roja

// ─── Componente de fila de lista ──────────────────────────────────────────────

function ListaRow({ label, value, url, onChange, onPdf, onClearPdf, sinArchivo }: {
  label: string
  value: ListaValue
  url?: string | null
  onChange: (v: ListaValue) => void
  onPdf?: (f: File) => void
  onClearPdf?: () => void
  sinArchivo?: boolean          // flags reputacionales: no llevan soporte adjunto
}) {
  const [file, setFile] = useState<File | null>(null)

  function handleFile(f: File) {
    setFile(f)
    onPdf?.(f)
  }

  // Quitar el archivo debe descartarlo también en el estado del formulario,
  // si no se subía igual aunque la UI mostrara que se había quitado.
  function handleClear() {
    setFile(null)
    onClearPdf?.()
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-stone-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-700 font-medium truncate">{label}</p>
      </div>
      {/* Toggle: null / false / true */}
      <div className="flex items-center gap-1 shrink-0">
        {([null, false, true] as ListaValue[]).map((v) => {
          const active = value === v
          const cfg = v === null
            ? { icon: <HelpCircle size={14} />, cls: active ? 'bg-stone-200 text-stone-600' : 'text-stone-300 hover:text-stone-500' }
            : v === false
              ? { icon: <CheckCircle2 size={14} />, cls: active ? 'bg-emerald-100 text-emerald-600' : 'text-stone-300 hover:text-emerald-400' }
              : { icon: <XCircle size={14} />, cls: active ? 'bg-red-100 text-red-600' : 'text-stone-300 hover:text-red-400' }
          return (
            <button key={String(v)} type="button"
              onClick={() => onChange(v)}
              title={v === null ? 'Pendiente' : v === false ? 'Limpia' : 'Aparece en lista'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${cfg.cls}`}>
              {cfg.icon}
            </button>
          )
        })}
      </div>
      {/* PDF */}
      <div className="shrink-0">
        {sinArchivo ? null : file ? (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-teal-600 font-medium max-w-[80px] truncate">{file.name}</span>
            <button type="button" onClick={handleClear} className="text-stone-400 hover:text-red-400">
              <X size={12} />
            </button>
          </div>
        ) : (
          // Con documento ya guardado se ofrecen ambas cosas: verlo y reemplazarlo.
          // Antes solo se mostraba "Ver" y el soporte quedaba imposible de corregir.
          <div className="flex items-center gap-2">
            {url && (
              <a href={url} target="_blank" rel="noreferrer"
                className="flex items-center gap-0.5 text-[11px] text-teal-600 font-bold hover:underline">
                Ver <ExternalLink size={10} />
              </a>
            )}
            <label className="flex items-center gap-1 cursor-pointer text-[11px] text-stone-400 hover:text-stone-600">
              <Upload size={12} /> {url ? 'Reemplazar' : 'Archivo'}
              <input type="file" accept="image/*,application/pdf,.doc,.docx" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Página ────────────────────────────────────────────────────────────────────

type BooleanState = Record<string, ListaValue>

export default function AntecedentesPage() {
  const router   = useRouter()
  const { id }   = useParams<{ id: string }>()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [aliadoNombre, setAliadoNombre] = useState('')

  // Valores de cada lista
  const [listas, setListas]   = useState<BooleanState>({})
  const [pdfs, setPdfs]       = useState<Record<string, File>>({})
  const [urlsExistentes, setUrlsExistentes] = useState<Record<string, string>>({})
  const [pep, setPep]         = useState<ListaValue>(null)
  const [prensa, setPrensa]   = useState<ListaValue>(null)
  const [observaciones, setObservaciones] = useState('')
  const [aprobado, setAprobado] = useState<boolean | null>(null)

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
      .then((data) => {
        setAliadoNombre(data.nombre_completo)
        const ant: Antecedente | null = data.antecedentes
        if (ant) {
          const initialListas: BooleanState = {}
          const allListas = [...LISTAS_NACIONALES, ...LISTAS_INTERNACIONALES]
          for (const { key } of allListas) {
            initialListas[key] = ant[key] as ListaValue
          }
          setListas(initialListas)
          setPep(ant.pep)
          setPrensa(ant.prensa_negativa)
          setObservaciones(ant.observaciones ?? '')
          setAprobado(ant.aprobado)
          // URLs existentes
          const urls: Record<string, string> = {}
          for (const { key } of allListas) {
            const u = ant[`${key}_url`] as string | null
            if (u) urls[key] = u
          }
          setUrlsExistentes(urls)
        }
        setLoading(false)
      })
      .catch(() => router.push('/intranet/juridica'))
  }, [authReady, userEmail, id, router])

  function setLista(key: string, val: ListaValue) {
    setListas((prev) => ({ ...prev, [key]: val }))
  }
  function setPdf(key: string, file: File) {
    setPdfs((prev) => ({ ...prev, [key]: file }))
  }
  function clearPdf(key: string) {
    setPdfs((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function handleGuardar() {
    if (!userEmail) return
    setSaving(true); setError(null)
    try {
      const allListas = [...LISTAS_NACIONALES, ...LISTAS_INTERNACIONALES]
      const payload: Record<string, unknown> = {
        created_by:      userEmail,
        pep,
        prensa_negativa: prensa,
        observaciones,
        aprobado,
      }
      for (const { key } of allListas) {
        payload[key] = listas[key] ?? null
      }

      const fd = new FormData()
      fd.append('data', JSON.stringify(payload))
      for (const [key, file] of Object.entries(pdfs)) {
        fd.append(key, file)
      }

      const res = await fetch(`/api/juridica/aliados/${id}/antecedentes`, { method: 'POST', body: fd })
      const result = await parsearRespuestaGuardado(res)
      if (!result.ok) { setError(result.error); return }
      // Los datos se guardaron; si algún archivo falló, quedarse aquí para reintentarlo.
      const aviso = mensajeDocumentosFallidos(result.body?.documentos_fallidos)
      if (aviso) { setError(aviso); return }
      router.push(`/intranet/juridica/${id}`)
    } finally {
      setSaving(false)
    }
  }

  // Cuenta banderas activas (true = aparece en lista)
  const banderas = [...LISTAS_NACIONALES, ...LISTAS_INTERNACIONALES].filter(
    ({ key }) => listas[key] === true
  ).length + (pep === true ? 1 : 0) + (prensa === true ? 1 : 0)

  if (!authReady || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="animate-spin text-stone-400" size={32} /></div>
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href={`/intranet/juridica/${id}`} className="text-stone-400 hover:text-stone-700 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <Shield size={18} className="text-teal-600" />
          <div>
            <h1 className="text-lg font-black text-stone-900">HOJA 2 — Antecedentes</h1>
            <p className="text-xs text-stone-400">{aliadoNombre}</p>
          </div>
          {banderas > 0 && (
            <span className="ml-auto text-[11px] font-bold px-2.5 py-1 bg-red-50 text-red-600 rounded-full">
              {banderas} {banderas === 1 ? 'bandera' : 'banderas'}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Leyenda */}
        <div className="flex items-center gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-1"><HelpCircle size={12} className="text-stone-400" /> Pendiente</div>
          <div className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Consulta limpia</div>
          <div className="flex items-center gap-1"><XCircle size={12} className="text-red-500" /> Aparece en lista</div>
        </div>

        {/* Listas nacionales */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider mb-3">Listas nacionales — Colombia</h2>
          {LISTAS_NACIONALES.map(({ key, label }) => (
            <ListaRow key={key} label={label}
              value={listas[key] ?? null}
              url={urlsExistentes[key]}
              onChange={(v) => setLista(key, v)}
              onPdf={(f) => setPdf(key, f)}
              onClearPdf={() => clearPdf(key)}
            />
          ))}
        </section>

        {/* Listas internacionales */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider mb-3">Listas internacionales</h2>
          {LISTAS_INTERNACIONALES.map(({ key, label }) => (
            <ListaRow key={key} label={label}
              value={listas[key] ?? null}
              url={urlsExistentes[key]}
              onChange={(v) => setLista(key, v)}
              onPdf={(f) => setPdf(key, f)}
              onClearPdf={() => clearPdf(key)}
            />
          ))}
        </section>

        {/* Flags reputacionales */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-3">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Flags reputacionales</h2>
          <ListaRow label="PEP — Persona Expuesta Políticamente"
            value={pep} onChange={setPep} sinArchivo />
          <ListaRow label="Prensa negativa"
            value={prensa} onChange={setPrensa} sinArchivo />
        </section>

        {/* Observaciones */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-3">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Observaciones</h2>
          <textarea
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            rows={4}
            placeholder="Notas sobre la revisión de antecedentes…"
            className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors resize-none"
          />
        </section>

        {/* Veredicto final */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-3">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Veredicto final</h2>
          <p className="text-xs text-stone-500">
            ¿El aliado pasa la revisión de antecedentes y puede continuar al análisis jurídico del folio?
          </p>
          <div className="flex gap-3">
            {[
              { v: true,  l: '✅ Aprobado',  cls: aprobado === true  ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-stone-200 text-stone-500 hover:border-teal-300' },
              { v: false, l: '❌ Rechazado', cls: aprobado === false ? 'border-red-400 bg-red-50 text-red-700'   : 'border-stone-200 text-stone-500 hover:border-red-300' },
            ].map(({ v, l, cls }) => (
              <button key={String(v)} type="button" onClick={() => setAprobado(v)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-colors ${cls}`}>
                {l}
              </button>
            ))}
          </div>
          {aprobado === false && (
            <p className="text-xs text-red-600 font-medium">
              El aliado quedará en estado <strong>Rechazado</strong> y no podrá continuar al módulo de siembra.
            </p>
          )}
        </section>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold px-4 py-3 rounded-xl">{error}</div>}

        <div className="flex gap-3 pb-8">
          <Link href={`/intranet/juridica/${id}`}
            className="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 text-center transition-colors">
            Cancelar
          </Link>
          <button onClick={handleGuardar} disabled={saving}
            className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar antecedentes
          </button>
        </div>
      </div>
    </div>
  )
}
