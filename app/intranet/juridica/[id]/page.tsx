'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { fetchConSesion } from '@/lib/fetch-sesion'
import {
  type Aliado, type EstadoAliado, type Semaforo,
  ESTADO_CONFIG, SEMAFORO_CONFIG, hoja3Habilitada,
} from '@/lib/juridica-schema'
import {
  Pencil, ChevronRight, CheckCircle2, XCircle, Lock, ExternalLink, AlertCircle, Plus,
} from 'lucide-react'
import { Cabecera, Cargando } from '@/app/components/marca'
import { fetchParametrosHoja1, nombreParametro, type Parametro } from '@/lib/parametros'

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

// El avance se lee de las hojas mismas, no del estado de la DD: el estado es
// derivado y no dice cuál de las dos hojas falta (un 'rechazado' puede venir del
// folio en rojo o de los antecedentes).
function Stepper({ aliado }: { aliado: Aliado }) {
  const semaforo    = aliado.analisis_juridico?.semaforo ?? null
  const veredicto   = aliado.antecedentes?.aprobado ?? null
  const h2Hecha     = semaforo !== null
  const h3Hecha     = veredicto !== null
  const h3Abierta   = hoja3Habilitada(semaforo, !!aliado.antecedentes)

  const steps = [
    {
      num: 1, label: 'Datos básicos', sub: 'HOJA 1',
      done: true, active: false, rojo: false,
      href: `/intranet/juridica/${aliado.id}/editar`,
      locked: false,
    },
    {
      num: 2, label: 'Análisis jurídico', sub: 'HOJA 2',
      done: h2Hecha, active: !h2Hecha, rojo: semaforo === 'rojo',
      href: `/intranet/juridica/${aliado.id}/analisis-juridico`,
      locked: false,
    },
    {
      num: 3, label: 'Antecedentes', sub: 'HOJA 3',
      done: h3Hecha, active: h2Hecha && !h3Hecha && h3Abierta, rojo: veredicto === false,
      href: `/intranet/juridica/${aliado.id}/antecedentes`,
      locked: !h3Abierta,
    },
  ]

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => {
        // En rojo solo la hoja que rechazó, para que se vea de dónde salió el rechazo.
        const dotClass = step.rojo
          ? 'bg-red-400 text-white'
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
              {step.rojo ? <XCircle size={16} /> : step.done ? <CheckCircle2 size={16} /> : <span>{step.num}</span>}
            </div>
            <div className="text-center">
              <p className={`text-[10px] font-bold ${step.rojo ? 'text-red-600' : step.done ? 'text-teal-600' : step.active ? 'text-amber-600' : 'text-stone-500'}`}>{step.label}</p>
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
  const [proyectos, setProyectos] = useState<Parametro[]>([])
  const [fuentes, setFuentes]     = useState<Parametro[]>([])

  // En el predio se guarda el código; los catálogos traen el nombre que se lee.
  useEffect(() => {
    fetchParametrosHoja1().then(({ proyectos, fuentes }) => {
      setProyectos(proyectos); setFuentes(fuentes)
    })
  }, [])

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
    fetchConSesion(`/api/juridica/aliados/${id}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data) => { setAliado(data); setLoading(false) })
      .catch(() => { router.push('/intranet/juridica') })
  }, [authReady, userEmail, id, router])

  if (!authReady || loading) {
    return (
      <Cargando texto="Cargando el aliado…" />
    )
  }

  if (!aliado) return null

  const estadoCfg = ESTADO_CONFIG[aliado.estado as EstadoAliado]
  const semaforo  = aliado.analisis_juridico?.semaforo as Semaforo | null
  const semCfg    = semaforo ? SEMAFORO_CONFIG[semaforo] : null

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        compacta
        ancho="ficha"
        volver={{ href: '/intranet/juridica', label: 'Jurídica' }}
        modulo="Aliado · debida diligencia"
        titulo={aliado.nombre_completo}
        acciones={<>
          <span className={`px-2.5 py-1 text-[10px] font-medium uppercase tracking-[.14em] ${estadoCfg.bg} ${estadoCfg.text}`}>
            {estadoCfg.label}
          </span>
          {semCfg && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-hueso">
              <i className={`inline-block h-2 w-2 ${semCfg.dot}`} />
              Semáforo {semCfg.label.toLowerCase()}
            </span>
          )}
        </>}
      />

      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10 space-y-5">
        <div className="border border-stone-200 bg-white px-5 py-4">
          <Stepper aliado={aliado} />
        </div>

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
            <p className="text-sm text-amber-700 font-medium">Semáforo naranja — conviene revisión del comité.</p>
          </div>
        )}
        {/* SIG ve el predio desde que se crea en Jurídica; la zonificación avanza en
            paralelo a la debida diligencia. No hay acción de "Enviar a SIG". */}
        {aliado.estado !== 'rechazado' && (
          <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
            <CheckCircle2 size={20} className="text-sky-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-sky-800">Visible para SIG</p>
              <p className="text-xs text-sky-600">
                SIG ya puede zonificar este predio. Completa la debida diligencia (análisis, antecedentes, documentos) en paralelo.
              </p>
            </div>
          </div>
        )}

        {/* HOJA 1 */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-stone-800">HOJA 1 — Datos básicos</h2>
            <div className="flex items-center gap-3">
              {aliado.aliado_id && (
                <Link href={`/intranet/juridica/nuevo?aliado=${aliado.aliado_id}`}
                  className="flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors">
                  <Plus size={12} /> Otro predio del propietario
                </Link>
              )}
              <Link href={`/intranet/juridica/${aliado.id}/editar`}
                className="flex items-center gap-1 text-xs font-bold text-stone-400 hover:text-stone-700 transition-colors">
                <Pencil size={12} /> Editar
              </Link>
            </div>
          </div>
          {/* Clasificación primero: es la que decide bajo qué programa se lee
              el resto del expediente en SIG, campo y vivero. */}
          <div className="flex gap-3 py-2 border-b border-stone-50">
            <span className="text-xs text-stone-400 w-44 shrink-0 font-medium">Tipo de proyecto</span>
            {aliado.tipo_proyecto
              ? <span className="text-sm text-stone-700">{nombreParametro(proyectos, aliado.tipo_proyecto)}</span>
              : <span className="text-sm text-amber-600 font-medium">Sin asignar</span>}
          </div>
          <DataRow k="Fuente de información" v={nombreParametro(fuentes, aliado.fuente_informacion)} />
          <DataRow k="Nombre completo"       v={aliado.nombre_completo} />
          <DataRow k="Tipo / Nº documento"   v={`${aliado.tipo_documento} ${aliado.numero_documento}`} />
          <DataRow k="Departamento"          v={aliado.departamento} />
          <DataRow k="Municipio"             v={aliado.municipio} />
          <DataRow k="Vereda"                v={aliado.vereda} />
          <DataRow k="Zona AE"               v={aliado.zona_ae} />
          <DataRow k="Nombre predio"         v={aliado.nombre_predio} />
          <DataRow
            k={aliado.matriculas && aliado.matriculas.length > 1 ? 'Matrículas' : 'Matrícula inmobiliaria'}
            v={aliado.matriculas && aliado.matriculas.length ? aliado.matriculas.join(', ') : aliado.matricula_inmobiliaria}
          />
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

        {/* HOJA 2 — el folio va primero: es el filtro barato. */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-stone-800">HOJA 2 — Análisis jurídico</h2>
            <Link href={`/intranet/juridica/${aliado.id}/analisis-juridico`}
              className="flex items-center gap-1 text-xs font-bold text-teal-600 hover:underline">
              {aliado.analisis_juridico ? <><Pencil size={12} /> Editar</> : <>Completar <ChevronRight size={12} /></>}
            </Link>
          </div>
          {aliado.analisis_juridico ? (
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

        {/* HOJA 3 — antecedentes de la persona, cuando el folio no salió en rojo. */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-black text-stone-800">HOJA 3 — Antecedentes</h2>
            {hoja3Habilitada(semaforo, !!aliado.antecedentes) && (
              <Link href={`/intranet/juridica/${aliado.id}/antecedentes`}
                className="flex items-center gap-1 text-xs font-bold text-teal-600 hover:underline">
                {aliado.antecedentes ? <><Pencil size={12} /> Editar</> : <>Completar <ChevronRight size={12} /></>}
              </Link>
            )}
          </div>
          {aliado.antecedentes ? (
            <div className="space-y-1">
              <DataRow k="Veredicto final" v={aliado.antecedentes.aprobado === true ? '✅ Aprobado' : aliado.antecedentes.aprobado === false ? '❌ Rechazado' : 'Pendiente'} />
              <DataRow k="Observaciones"   v={aliado.antecedentes.observaciones} />
            </div>
          ) : !hoja3Habilitada(semaforo, false) ? (
            <div className="flex items-center gap-2 text-sm text-stone-400">
              <Lock size={14} />
              {semaforo === 'rojo'
                ? 'El folio quedó en rojo: el predio no procede y no hace falta revisar antecedentes'
                : 'Disponible cuando el análisis jurídico (HOJA 2) tenga semáforo verde, amarillo o naranja'}
            </div>
          ) : (
            <p className="text-sm text-stone-400 italic">Pendiente de completar</p>
          )}
        </section>
      </div>
    </div>
  )
}
