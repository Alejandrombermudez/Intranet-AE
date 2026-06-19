'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  type Aliado, type EstadoAliado, type Semaforo,
  ESTADO_CONFIG, SEMAFORO_CONFIG,
} from '@/lib/juridica-schema'
import {
  Shield, ArrowLeft, Pencil, ChevronRight, Loader2,
  CheckCircle2, Circle, Lock, ExternalLink, AlertCircle,
} from 'lucide-react'

function label(v: unknown) {
  if (v === null || v === undefined || v === '') return <span className="text-stone-300">—</span>
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  return String(v)
}

function DataRow({ k, v }: { k: string; v: unknown }) {
  return (
    <div className="flex gap-3 py-2 border-b border-stone-50 last:border-0">
      <span className="text-xs text-stone-400 w-44 shrink-0 font-medium">{k}</span>
      <span className="text-sm text-stone-700">{label(v)}</span>
    </div>
  )
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ aliado }: { aliado: Aliado }) {
  const { estado } = aliado
  const rechazado  = estado === 'rechazado'
  const h2Habilitada = true // siempre accesible una vez existe el aliado
  const h3Habilitada = aliado.antecedentes?.aprobado === true

  const steps = [
    {
      num: 1, label: 'Datos básicos', sub: 'HOJA 1',
      done: true, active: false,
      href: `/intranet/juridica/${aliado.id}/editar`,
      locked: false,
    },
    {
      num: 2, label: 'Antecedentes', sub: 'HOJA 2',
      done: ['antecedentes_ok', 'juridico_ok', 'aprobado', 'rechazado'].includes(estado),
      active: estado === 'borrador',
      href: `/intranet/juridica/${aliado.id}/antecedentes`,
      locked: !h2Habilitada,
    },
    {
      num: 3, label: 'Análisis jurídico', sub: 'HOJA 3',
      done: ['juridico_ok', 'aprobado', 'rechazado'].includes(estado),
      active: estado === 'antecedentes_ok',
      href: `/intranet/juridica/${aliado.id}/analisis-juridico`,
      locked: !h3Habilitada,
    },
  ]

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => {
        const dotClass = rechazado && step.num === steps.length
          ? 'bg-red-400'
          : step.done
            ? 'bg-teal-500 text-white'
            : step.active
              ? 'bg-amber-400 text-white'
              : 'bg-stone-200 text-stone-400'

        const content = step.locked ? (
          <div className="flex flex-col items-center gap-1 opacity-40 cursor-not-allowed">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${dotClass}`}>
              <Lock size={14} />
            </div>
            <div className="text-center">
              <p className="text-[10px] font-bold text-stone-500">{step.label}</p>
              <p className="text-[9px] text-stone-400">{step.sub}</p>
            </div>
          </div>
        ) : (
          <Link href={step.href} className="flex flex-col items-center gap-1 group">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-all ${dotClass} group-hover:scale-110`}>
              {step.done ? <CheckCircle2 size={16} /> : <span>{step.num}</span>}
            </div>
            <div className="text-center">
              <p className={`text-[10px] font-bold ${step.done ? 'text-teal-600' : step.active ? 'text-amber-600' : 'text-stone-500'}`}>{step.label}</p>
              <p className="text-[9px] text-stone-400">{step.sub}</p>
            </div>
          </Link>
        )

        return (
          <div key={step.num} className="flex items-center gap-2">
            {content}
            {i < steps.length - 1 && (
              <div className={`w-10 h-px ${step.done ? 'bg-teal-300' : 'bg-stone-200'} mb-5`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function AliadoDetailPage() {
  const router   = useRouter()
  const { id }   = useParams<{ id: string }>()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [aliado, setAliado]       = useState<Aliado | null>(null)
  const [loading, setLoading]     = useState(true)
  const [creando, setCreando]     = useState(false)
  const [toast, setToast]         = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)
  const [confirmar, setConfirmar] = useState(false)

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

  useEffect(() => {
    if (!authReady || !userEmail || !id) return
    fetch(`/api/juridica/aliados/${id}?email=${encodeURIComponent(userEmail)}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => { setAliado(data); setLoading(false) })
      .catch(() => { router.push('/intranet/juridica') })
  }, [authReady, userEmail, id, router])

  const showToast = (tipo: 'ok' | 'error', msg: string) => {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function crearEnSiembra() {
    if (!userEmail || !aliado) return
    setCreando(true)
    try {
      const res = await fetch(`/api/juridica/aliados/${aliado.id}/crear-en-siembra`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_by: userEmail }),
      })
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 409 && body.familia_id) {
          showToast('ok', 'Ya existe — redirigiendo…')
          setTimeout(() => router.push(`/intranet/ras/siembra/${body.familia_id}`), 1200)
        } else {
          showToast('error', body.error ?? 'Error')
        }
      } else {
        showToast('ok', 'Familia creada en Siembra')
        setTimeout(() => router.push(`/intranet/ras/siembra/${body.familia_id}`), 1200)
      }
    } finally {
      setCreando(false)
      setConfirmar(false)
    }
  }

  if (!authReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-stone-400" size={32} />
      </div>
    )
  }

  if (!aliado) return null

  const estadoCfg = ESTADO_CONFIG[aliado.estado as EstadoAliado]
  const semaforo  = aliado.analisis_juridico?.semaforo as Semaforo | null
  const semCfg    = semaforo ? SEMAFORO_CONFIG[semaforo] : null

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/intranet/juridica" className="text-stone-400 hover:text-stone-700 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <Shield size={18} className="text-teal-600" />
            <h1 className="text-lg font-black text-stone-900 truncate">{aliado.nombre_completo}</h1>
            <span className={`ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full ${estadoCfg.bg} ${estadoCfg.text}`}>
              {estadoCfg.label}
            </span>
            {semCfg && (
              <div className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${semCfg.dot}`} />
                <span className={`text-xs font-bold ${semCfg.color}`}>{semCfg.label}</span>
              </div>
            )}
          </div>
          {/* Stepper */}
          <Stepper aliado={aliado} />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">

        {/* Alertas de estado */}
        {aliado.estado === 'rechazado' && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700 font-medium">Este aliado fue rechazado y no puede proceder al proceso de siembra.</p>
          </div>
        )}
        {aliado.estado === 'juridico_ok' && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle size={18} className="text-amber-500 shrink-0" />
            <p className="text-sm text-amber-700 font-medium">Semáforo naranja — requiere revisión del comité antes de ser aprobado.</p>
          </div>
        )}
        {aliado.estado === 'aprobado' && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-teal-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-teal-800">Aliado aprobado</p>
                <p className="text-xs text-teal-600">Listo para crear la familia en Siembra y avanzar a la encuesta de campo.</p>
              </div>
            </div>
            <button
              onClick={() => setConfirmar(true)}
              className="shrink-0 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors"
            >
              Crear en Siembra →
            </button>
          </div>
        )}

        {/* HOJA 1 */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-stone-800">HOJA 1 — Datos básicos</h2>
            <Link href={`/intranet/juridica/${aliado.id}/editar`}
              className="flex items-center gap-1 text-xs font-bold text-stone-400 hover:text-stone-700 transition-colors">
              <Pencil size={12} /> Editar
            </Link>
          </div>
          <DataRow k="Nombre completo"       v={aliado.nombre_completo} />
          <DataRow k="Tipo / Nº documento"   v={`${aliado.tipo_documento} ${aliado.numero_documento}`} />
          <DataRow k="Departamento"          v={aliado.departamento} />
          <DataRow k="Municipio"             v={aliado.municipio} />
          <DataRow k="Vereda"                v={aliado.vereda} />
          <DataRow k="Zona AE"               v={aliado.zona_ae} />
          <DataRow k="Nombre predio"         v={aliado.nombre_predio} />
          <DataRow k="Matrícula inmobiliaria" v={aliado.matricula_inmobiliaria} />
          <DataRow k="Área registral (ha)"   v={aliado.area_registral} />
          <DataRow k="Código catastral"      v={aliado.codigo_catastral} />
          <DataRow k="Último pago predial"   v={aliado.anio_ultimo_pago_predial} />
          <DataRow k="Manifestó interés"     v={aliado.manifestacion_interes} />
          <DataRow k="Obs. manifestación"    v={aliado.manifestacion_observaciones} />
          {/* PDFs */}
          {aliado.cedula_url && (
            <div className="flex gap-3 py-2">
              <span className="text-xs text-stone-400 w-44 shrink-0 font-medium">Cédula / documento</span>
              <a href={aliado.cedula_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-sm text-teal-600 font-bold hover:underline">
                Ver documento <ExternalLink size={12} />
              </a>
            </div>
          )}
          {aliado.certificado_tradicion_url && (
            <div className="flex gap-3 py-2">
              <span className="text-xs text-stone-400 w-44 shrink-0 font-medium">Certificado tradición</span>
              <a href={aliado.certificado_tradicion_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-sm text-teal-600 font-bold hover:underline">
                Ver documento <ExternalLink size={12} />
              </a>
            </div>
          )}
          {aliado.recibo_predial_url && (
            <div className="flex gap-3 py-2">
              <span className="text-xs text-stone-400 w-44 shrink-0 font-medium">Recibo predial</span>
              <a href={aliado.recibo_predial_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-sm text-teal-600 font-bold hover:underline">
                Ver documento <ExternalLink size={12} />
              </a>
            </div>
          )}
          {aliado.manifestacion_url && (
            <div className="flex gap-3 py-2">
              <span className="text-xs text-stone-400 w-44 shrink-0 font-medium">Manifestación firmada</span>
              <a href={aliado.manifestacion_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-sm text-teal-600 font-bold hover:underline">
                Ver documento <ExternalLink size={12} />
              </a>
            </div>
          )}
        </section>

        {/* HOJA 2 */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-stone-800">HOJA 2 — Antecedentes</h2>
            <Link href={`/intranet/juridica/${aliado.id}/antecedentes`}
              className="flex items-center gap-1 text-xs font-bold text-teal-600 hover:underline">
              {aliado.antecedentes ? <><Pencil size={12} /> Editar</> : <>Completar <ChevronRight size={12} /></>}
            </Link>
          </div>
          {aliado.antecedentes ? (
            <div className="space-y-1">
              <DataRow k="Veredicto final" v={aliado.antecedentes.aprobado === true ? '✅ Aprobado' : aliado.antecedentes.aprobado === false ? '❌ Rechazado' : 'Pendiente'} />
              <DataRow k="Observaciones"   v={aliado.antecedentes.observaciones} />
            </div>
          ) : (
            <p className="text-sm text-stone-400 italic">Pendiente de completar</p>
          )}
        </section>

        {/* HOJA 3 */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-stone-800">HOJA 3 — Análisis jurídico</h2>
            {aliado.antecedentes?.aprobado === true && (
              <Link href={`/intranet/juridica/${aliado.id}/analisis-juridico`}
                className="flex items-center gap-1 text-xs font-bold text-teal-600 hover:underline">
                {aliado.analisis_juridico ? <><Pencil size={12} /> Editar</> : <>Completar <ChevronRight size={12} /></>}
              </Link>
            )}
          </div>
          {!aliado.antecedentes?.aprobado ? (
            <div className="flex items-center gap-2 text-sm text-stone-400">
              <Lock size={14} /> Disponible cuando HOJA 2 esté aprobada
            </div>
          ) : aliado.analisis_juridico ? (
            <div className="space-y-1">
              {semCfg && (
                <div className="flex gap-3 py-2 border-b border-stone-50">
                  <span className="text-xs text-stone-400 w-44 shrink-0 font-medium">Semáforo</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${semCfg.dot}`} />
                    <span className={`text-sm font-bold ${semCfg.color}`}>{semCfg.label}</span>
                  </div>
                </div>
              )}
              <DataRow k="Estado del folio"   v={aliado.analisis_juridico.estado_folio} />
              <DataRow k="Naturaleza jurídica" v={aliado.analisis_juridico.naturaleza_juridica} />
              <DataRow k="Observaciones"       v={aliado.analisis_juridico.observaciones} />
            </div>
          ) : (
            <p className="text-sm text-stone-400 italic">Pendiente de completar</p>
          )}
        </section>
      </div>

      {/* Modal confirmar crear en Siembra */}
      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <h3 className="font-black text-stone-900 text-lg mb-2">Crear en Siembra</h3>
            <p className="text-sm text-stone-600 mb-5">
              Se creará un registro para <strong>{aliado.nombre_completo}</strong> en el módulo Siembra
              con los datos básicos prellenados. El equipo RAS completará la encuesta predial desde allí.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmar(false)} disabled={creando}
                className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors">
                Cancelar
              </button>
              <button onClick={crearEnSiembra} disabled={creando}
                className="flex-1 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {creando ? <Loader2 size={14} className="animate-spin" /> : null}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-bold text-white ${toast.tipo === 'ok' ? 'bg-teal-600' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
