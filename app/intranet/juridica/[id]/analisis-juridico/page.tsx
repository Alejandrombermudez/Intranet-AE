'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { type AnalisisJuridico, type Semaforo, SEMAFORO_CONFIG } from '@/lib/juridica-schema'
import { Shield, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'

const TEXTAREA = 'w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors resize-none'
const INPUT    = 'w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-stone-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

function BoolFlag({ label, value, onChange, children }: {
  label: string; value: boolean | null
  onChange: (v: boolean | null) => void
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-stone-700 font-medium">{label}</span>
        <div className="flex gap-2 shrink-0">
          {([null, false, true] as (boolean | null)[]).map((v) => {
            const active = value === v
            const labels = { null: '—', false: 'No', true: 'Sí' }
            const cls = active
              ? v === true ? 'bg-red-100 text-red-700 border-red-300'
                : v === false ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                : 'bg-stone-100 text-stone-600 border-stone-300'
              : 'border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600'
            return (
              <button key={String(v)} type="button" onClick={() => onChange(v)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${cls}`}>
                {labels[String(v) as keyof typeof labels]}
              </button>
            )
          })}
        </div>
      </div>
      {value === true && children}
    </div>
  )
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function AnalisisJuridicoPage() {
  const router   = useRouter()
  const { id }   = useParams<{ id: string }>()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [aliadoNombre, setAliadoNombre]   = useState('')
  const [bloqueado, setBloqueado]         = useState(false)

  // Campos del formulario
  const [estadoFolio, setEstadoFolio]   = useState<'ACTIVO' | 'CERRADO' | ''>('')
  const [veredaReg, setVeredaReg]       = useState('')
  const [fmiMatrices, setFmiMatrices]   = useState('')
  const [fmiDerivados, setFmiDerivados] = useState('')
  const [actoOrigen, setActoOrigen]     = useState('')
  const [descOrigen, setDescOrigen]     = useState('')
  const [actoActual, setActoActual]     = useState('')
  const [naturaleza, setNaturaleza]     = useState('')

  const [falsaTradicion, setFalsaTradicion]     = useState<boolean | null>(null)
  const [procJudiciales, setProcJudiciales]     = useState<boolean | null>(null)
  const [procJudicialesDesc, setProcJudicialesDesc] = useState('')
  const [medCautelares, setMedCautelares]       = useState<boolean | null>(null)
  const [medCautelaresDesc, setMedCautelaresDesc] = useState('')
  const [liquidaciones, setLiquidaciones]       = useState<boolean | null>(null)
  const [liquidacionesDesc, setLiquidacionesDesc] = useState('')
  const [sucesiones, setSucesiones]             = useState<boolean | null>(null)
  const [sucesionesDesc, setSucesionesDesc]     = useState('')

  const [conceptoAnt, setConceptoAnt] = useState('')
  const [conceptoUrt, setConceptoUrt] = useState('')
  const [conceptoPnn, setConceptoPnn] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [semaforo, setSemaforo]           = useState<Semaforo | null>(null)

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
        // Bloquear si HOJA 2 no está aprobada
        if (data.antecedentes?.aprobado !== true) {
          setBloqueado(true)
          setLoading(false)
          return
        }
        const a: AnalisisJuridico | null = data.analisis_juridico
        if (a) {
          setEstadoFolio((a.estado_folio as 'ACTIVO' | 'CERRADO' | '') ?? '')
          setVeredaReg(a.vereda_registral ?? '')
          setFmiMatrices(a.fmi_matrices ?? '')
          setFmiDerivados(a.fmi_derivados ?? '')
          setActoOrigen(a.acto_origen ?? '')
          setDescOrigen(a.descripcion_acto_origen ?? '')
          setActoActual(a.acto_adquisicion_actual ?? '')
          setNaturaleza(a.naturaleza_juridica ?? '')
          setFalsaTradicion(a.falsa_tradicion)
          setProcJudiciales(a.procesos_judiciales)
          setProcJudicialesDesc(a.procesos_judiciales_desc ?? '')
          setMedCautelares(a.medidas_cautelares)
          setMedCautelaresDesc(a.medidas_cautelares_desc ?? '')
          setLiquidaciones(a.liquidaciones)
          setLiquidacionesDesc(a.liquidaciones_desc ?? '')
          setSucesiones(a.sucesiones)
          setSucesionesDesc(a.sucesiones_desc ?? '')
          setConceptoAnt(a.concepto_ant ?? '')
          setConceptoUrt(a.concepto_urt ?? '')
          setConceptoPnn(a.concepto_pnn ?? '')
          setObservaciones(a.observaciones ?? '')
          setSemaforo(a.semaforo)
        }
        setLoading(false)
      })
      .catch(() => router.push('/intranet/juridica'))
  }, [authReady, userEmail, id, router])

  async function handleGuardar() {
    if (!userEmail || !semaforo) { setError('Debes seleccionar el semáforo antes de guardar'); return }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/juridica/aliados/${id}/analisis-juridico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          created_by:               userEmail,
          estado_folio:             estadoFolio || null,
          vereda_registral:         veredaReg || null,
          fmi_matrices:             fmiMatrices || null,
          fmi_derivados:            fmiDerivados || null,
          acto_origen:              actoOrigen || null,
          descripcion_acto_origen:  descOrigen || null,
          acto_adquisicion_actual:  actoActual || null,
          naturaleza_juridica:      naturaleza || null,
          falsa_tradicion:          falsaTradicion,
          procesos_judiciales:      procJudiciales,
          procesos_judiciales_desc: procJudicialesDesc || null,
          medidas_cautelares:       medCautelares,
          medidas_cautelares_desc:  medCautelaresDesc || null,
          liquidaciones,
          liquidaciones_desc:       liquidacionesDesc || null,
          sucesiones,
          sucesiones_desc:          sucesionesDesc || null,
          concepto_ant:             conceptoAnt || null,
          concepto_urt:             conceptoUrt || null,
          concepto_pnn:             conceptoPnn || null,
          observaciones:            observaciones || null,
          semaforo,
        }),
      })
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
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href={`/intranet/juridica/${id}`} className="text-stone-400 hover:text-stone-700 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <Shield size={18} className="text-teal-600" />
          <div>
            <h1 className="text-lg font-black text-stone-900">HOJA 3 — Análisis jurídico</h1>
            <p className="text-xs text-stone-400">{aliadoNombre}</p>
          </div>
        </div>
      </div>

      {bloqueado ? (
        <div className="max-w-3xl mx-auto px-6 py-10">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 mb-1">HOJA 2 pendiente</p>
              <p className="text-sm text-amber-700">Debes completar y aprobar la revisión de antecedentes antes de acceder al análisis jurídico del folio.</p>
              <Link href={`/intranet/juridica/${id}/antecedentes`}
                className="mt-3 inline-block text-sm font-bold text-amber-700 hover:underline">
                Ir a HOJA 2 →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

          {/* Estado del folio */}
          <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Estado del folio</h2>
            <Field label="Estado del folio (FMI)">
              <div className="flex gap-3">
                {(['ACTIVO', 'CERRADO', ''] as const).map((v) => (
                  <button key={v || 'nd'} type="button" onClick={() => setEstadoFolio(v)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${estadoFolio === v ? 'border-teal-400 bg-teal-50 text-teal-700' : 'border-stone-200 text-stone-500 hover:border-stone-300'}`}>
                    {v || '—'}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Vereda registral">
                <input value={veredaReg} onChange={(e) => setVeredaReg(e.target.value)} className={INPUT} placeholder="Según el folio" />
              </Field>
              <Field label="FMI matrices">
                <input value={fmiMatrices} onChange={(e) => setFmiMatrices(e.target.value)} className={INPUT} placeholder="Folios de origen" />
              </Field>
            </div>
            <Field label="FMI derivados">
              <input value={fmiDerivados} onChange={(e) => setFmiDerivados(e.target.value)} className={INPUT} placeholder="Folios derivados de éste" />
            </Field>
          </section>

          {/* Tradición */}
          <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Tradición</h2>
            <Field label="Acto de origen">
              <input value={actoOrigen} onChange={(e) => setActoOrigen(e.target.value)} className={INPUT} placeholder="Ej: adjudicación, compraventa…" />
            </Field>
            <Field label="Descripción del acto de origen">
              <textarea value={descOrigen} onChange={(e) => setDescOrigen(e.target.value)} rows={2} className={TEXTAREA} placeholder="Descripción libre…" />
            </Field>
            <Field label="Acto de adquisición actual">
              <input value={actoActual} onChange={(e) => setActoActual(e.target.value)} className={INPUT} placeholder="Cómo adquirió el propietario actual" />
            </Field>
            <Field label="Naturaleza jurídica">
              <input value={naturaleza} onChange={(e) => setNaturaleza(e.target.value)} className={INPUT} placeholder="Privado, baldío, reserva, etc." />
            </Field>
          </section>

          {/* Banderas jurídicas */}
          <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Banderas jurídicas</h2>
            <p className="text-xs text-stone-500">«Sí» indica un problema detectado en el folio.</p>
            <BoolFlag label="Falsa tradición" value={falsaTradicion} onChange={setFalsaTradicion} />
            <BoolFlag label="Procesos judiciales inscritos" value={procJudiciales} onChange={setProcJudiciales}>
              <textarea value={procJudicialesDesc} onChange={(e) => setProcJudicialesDesc(e.target.value)} rows={2} className={TEXTAREA} placeholder="Describir los procesos…" />
            </BoolFlag>
            <BoolFlag label="Medidas cautelares inscritas" value={medCautelares} onChange={setMedCautelares}>
              <textarea value={medCautelaresDesc} onChange={(e) => setMedCautelaresDesc(e.target.value)} rows={2} className={TEXTAREA} placeholder="Describir las medidas…" />
            </BoolFlag>
            <BoolFlag label="Liquidaciones" value={liquidaciones} onChange={setLiquidaciones}>
              <textarea value={liquidacionesDesc} onChange={(e) => setLiquidacionesDesc(e.target.value)} rows={2} className={TEXTAREA} placeholder="Describir las liquidaciones…" />
            </BoolFlag>
            <BoolFlag label="Sucesiones" value={sucesiones} onChange={setSucesiones}>
              <textarea value={sucesionesDesc} onChange={(e) => setSucesionesDesc(e.target.value)} rows={2} className={TEXTAREA} placeholder="Describir las sucesiones…" />
            </BoolFlag>
          </section>

          {/* Conceptos institucionales */}
          <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Conceptos institucionales</h2>
            <Field label="ANT — Agencia Nacional de Tierras">
              <textarea value={conceptoAnt} onChange={(e) => setConceptoAnt(e.target.value)} rows={3} className={TEXTAREA} placeholder="Concepto de la ANT…" />
            </Field>
            <Field label="URT — Unidad de Restitución de Tierras">
              <textarea value={conceptoUrt} onChange={(e) => setConceptoUrt(e.target.value)} rows={3} className={TEXTAREA} placeholder="Concepto de la URT…" />
            </Field>
            <Field label="PNN — Parques Nacionales Naturales">
              <textarea value={conceptoPnn} onChange={(e) => setConceptoPnn(e.target.value)} rows={3} className={TEXTAREA} placeholder="Concepto de PNN…" />
            </Field>
          </section>

          {/* Semáforo y conclusión */}
          <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Semáforo — Veredicto final *</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['verde', 'amarillo', 'naranja', 'rojo'] as Semaforo[]).map((s) => {
                const cfg = SEMAFORO_CONFIG[s]
                return (
                  <button key={s} type="button" onClick={() => setSemaforo(s)}
                    className={`py-3 rounded-xl text-sm font-bold border-2 transition-colors flex flex-col items-center gap-1.5 ${semaforo === s ? `border-current ${cfg.color} bg-stone-50` : 'border-stone-200 text-stone-400 hover:border-stone-300'}`}>
                    <div className={`w-4 h-4 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
            {semaforo && (
              <div className={`text-xs font-medium px-3 py-2 rounded-xl ${
                semaforo === 'verde'    ? 'bg-emerald-50 text-emerald-700' :
                semaforo === 'amarillo' ? 'bg-yellow-50 text-yellow-700'  :
                semaforo === 'naranja'  ? 'bg-orange-50 text-orange-700'  :
                                          'bg-red-50 text-red-700'
              }`}>
                {semaforo === 'verde'    && 'Sin observaciones — se autoriza visita de campo. El aliado pasará a estado Aprobado.'}
                {semaforo === 'amarillo' && 'Observaciones menores — se procede con seguimiento. El aliado pasará a estado Aprobado.'}
                {semaforo === 'naranja'  && 'Observaciones significativas — requiere revisión del comité. Quedará pendiente de aprobación manual.'}
                {semaforo === 'rojo'     && 'No procede. El aliado será marcado como Rechazado y no podrá avanzar a siembra.'}
              </div>
            )}
            <Field label="Observaciones generales">
              <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={4} className={TEXTAREA} placeholder="Conclusiones y notas del análisis jurídico…" />
            </Field>
          </section>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-bold px-4 py-3 rounded-xl">{error}</div>}

          <div className="flex gap-3 pb-8">
            <Link href={`/intranet/juridica/${id}`}
              className="flex-1 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 text-center transition-colors">
              Cancelar
            </Link>
            <button onClick={handleGuardar} disabled={saving || !semaforo}
              className="flex-1 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Guardar análisis
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
