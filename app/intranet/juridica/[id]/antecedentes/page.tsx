'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { type Antecedente, hoja3Habilitada } from '@/lib/juridica-schema'
import { parsearRespuestaGuardado, mensajeDocumentosFallidos } from '@/lib/fetch-guardar'
import { comprimirAdjuntos, avisoPeso, formatearBytes } from '@/lib/comprimir-imagen'
import {
  Loader2, Upload, X, ExternalLink, CheckCircle2, XCircle, HelpCircle, AlertCircle,
} from 'lucide-react'
import { Cabecera, Cargando } from '@/app/components/marca'

// Los soportes de antecedentes son casi siempre pantallazos de la consulta, pero
// varias entidades (Rama Judicial, RNMC) entregan el resultado como descarga de
// planilla: se aceptan también CSV/Excel.
const ACEPTA = 'image/*,application/pdf,.doc,.docx,.csv,text/csv,.xls,.xlsx'

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
              <input type="file" accept={ACEPTA} className="hidden"
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
  const [comprimiendo, setComprimiendo] = useState(false)
  const [notaCompresion, setNotaCompresion] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [aliadoNombre, setAliadoNombre] = useState('')
  // HOJA 3: se abre cuando el análisis del folio (HOJA 2) tiene semáforo que no
  // sea rojo. 'pendiente' = aún sin semáforo; 'rojo' = el predio no procede.
  const [bloqueo, setBloqueo] = useState<null | 'pendiente' | 'rojo'>(null)

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
        const semaforo: string | null = data.analisis_juridico?.semaforo ?? null
        if (!hoja3Habilitada(semaforo, !!ant)) {
          setBloqueo(semaforo === 'rojo' ? 'rojo' : 'pendiente')
          setLoading(false)
          return
        }
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

      // Los 14 soportes viajan en una sola petición: sin comprimir, tres
      // pantallazos de celular ya la revientan (413 de Vercel).
      setComprimiendo(true)
      const comprimidos = await comprimirAdjuntos(pdfs)
      setComprimiendo(false)
      const etiquetas = Object.fromEntries(allListas.map(({ key, label }) => [key, label]))
      const avisoTamano = avisoPeso(comprimidos, etiquetas)
      if (avisoTamano) { setError(avisoTamano); return }
      if (comprimidos.bytesAntes > comprimidos.bytesDespues) {
        setNotaCompresion(`Soportes comprimidos: ${formatearBytes(comprimidos.bytesAntes)} → ${formatearBytes(comprimidos.bytesDespues)}`)
      }

      const fd = new FormData()
      fd.append('data', JSON.stringify(payload))
      for (const [key, file] of Object.entries(comprimidos.archivos)) {
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
      setComprimiendo(false)
      setSaving(false)
    }
  }

  // Cuenta banderas activas (true = aparece en lista)
  const banderas = [...LISTAS_NACIONALES, ...LISTAS_INTERNACIONALES].filter(
    ({ key }) => listas[key] === true
  ).length + (pep === true ? 1 : 0) + (prensa === true ? 1 : 0)

  if (!authReady || loading) {
    return <Cargando texto="Cargando los antecedentes…" />
  }

  const cabecera = (
    <Cabecera
      compacta
      ancho="ficha"
      volver={{ href: `/intranet/juridica/${id}`, label: 'Aliado' }}
      modulo="Módulo jurídico · HOJA 3"
      titulo="Antecedentes"
      descripcion={aliadoNombre}
      acciones={banderas > 0 ? (
        <span className="bg-red-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[.14em] text-red-700">
          {banderas} {banderas === 1 ? 'bandera' : 'banderas'}
        </span>
      ) : undefined}
    />
  )

  if (bloqueo) {
    return (
      <div className="min-h-screen bg-papel">
        {cabecera}
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              {bloqueo === 'rojo' ? (<>
                <p className="font-bold text-amber-800 mb-1">El folio quedó en rojo</p>
                <p className="text-sm text-amber-700">
                  El análisis jurídico (HOJA 2) dice que el predio no procede, así que no hace falta revisar los
                  antecedentes del propietario. Si el semáforo cambia, esta hoja se abre sola.
                </p>
              </>) : (<>
                <p className="font-bold text-amber-800 mb-1">Primero el análisis jurídico (HOJA 2)</p>
                <p className="text-sm text-amber-700">
                  Los antecedentes se revisan cuando el folio tiene semáforo verde, amarillo o naranja: si el
                  predio no tiene títulos sanos, no vale la pena consultar las 14 listas.
                </p>
              </>)}
              <Link href={`/intranet/juridica/${id}/analisis-juridico`}
                className="mt-3 inline-block text-sm font-bold text-amber-700 hover:underline">
                Ir a HOJA 2 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-papel">
      {cabecera}

      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10 space-y-6">
        {/* Leyenda */}
        <div className="flex items-center gap-4 text-xs text-stone-500">
          <div className="flex items-center gap-1"><HelpCircle size={12} className="text-stone-400" /> Pendiente</div>
          <div className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> Consulta limpia</div>
          <div className="flex items-center gap-1"><XCircle size={12} className="text-red-500" /> Aparece en lista</div>
        </div>

        {/* Listas nacionales */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider mb-1">Listas nacionales — Colombia</h2>
          <p className="text-[11px] text-stone-400 mb-3">
            El soporte puede ser pantallazo, PDF o el <strong>CSV/Excel</strong> que descarga la consulta
            (es como entrega el resultado la Rama Judicial). Las imágenes se comprimen solas al guardar.
          </p>
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
            ¿El propietario pasa la revisión de antecedentes? Es el último paso de la debida diligencia: con el
            folio en verde o amarillo, aprobarlo deja el caso Aprobado. Los antecedentes son de la persona, así
            que el veredicto aplica a todos sus predios.
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
              El aliado quedará en estado <strong>Rechazado</strong> —en todos sus predios— y no podrá continuar al módulo de siembra.
            </p>
          )}
        </section>

        {notaCompresion && !error && (
          <div className="bg-stone-50 border border-stone-200 text-stone-500 text-xs px-4 py-2.5 rounded-xl">{notaCompresion}</div>
        )}
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold px-4 py-3 rounded-xl">{error}</div>}

        <div className="flex gap-3 pb-8">
          <Link href={`/intranet/juridica/${id}`}
            className="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 text-center transition-colors">
            Cancelar
          </Link>
          <button onClick={handleGuardar} disabled={saving}
            className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {comprimiendo ? 'Comprimiendo soportes…' : 'Guardar antecedentes'}
          </button>
        </div>
      </div>
    </div>
  )
}
