'use client'
/**
 * CUENTA DE COBRO POR ENLACE — para quien no tiene correo de la organización.
 *
 * La persona llena sus datos, el cobro y la cuenta donde se le paga, firma con
 * el dedo y envía. Llega a la bandeja de talento humano (Administrativa →
 * Talento humano → Cuentas de cobro) y aquí mismo descarga o comparte el PDF.
 *
 * Recordar: sus datos (no el cobro) se guardan en ESTE celular, para que la
 * próxima vez solo cambie el valor, el concepto y firme. El servidor también
 * la registra por su cédula, pero nunca le devuelve a nadie los datos de otra
 * persona: lo que se precarga sale solo del propio celular.
 */
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Download, Share2 } from 'lucide-react'
import FirmaDedo from '@/app/components/talento/FirmaDedo'
import { pesosEnLetras } from '@/lib/numero-letras'
import { avisoValor, leerValor } from '@/lib/cuenta-cobro-valor'
import { AUTORIZACION_TEXTO, LISTAS, TIPO_CUENTA, TIPO_DOC_ID, mesDe, type CuentaCobro } from '@/lib/talento'
import { descargarBlob, nombreArchivoCuenta, pdfCuentaCobro } from '@/lib/talento-pdf'

const GUARDADO = 'ae-cuenta-cobro-v1'
const PERSONALES = ['tipo_documento', 'numero_documento', 'lugar_expedicion', 'nombres', 'apellidos', 'celular',
  'direccion', 'municipio', 'correo', 'banco', 'tipo_cuenta', 'numero_cuenta', 'proyecto'] as const
type Clave = typeof PERSONALES[number] | 'concepto' | 'periodo_desde' | 'periodo_hasta'
const OBLIGATORIOS: Clave[] = ['nombres', 'apellidos', 'numero_documento', 'lugar_expedicion', 'celular', 'direccion',
  'municipio', 'concepto', 'proyecto', 'banco', 'tipo_cuenta', 'numero_cuenta']

const CAMPO = 'w-full rounded-xl border border-linea bg-white px-3.5 py-3 text-[16px] text-tinta outline-none transition focus:border-bosque focus:ring-2 focus:ring-bosque/15'
const hoyISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

export default function Pagina() {
  return <Suspense fallback={null}><CuentaCobroEnlace /></Suspense>
}

function CuentaCobroEnlace() {
  const clave = useSearchParams().get('c')
  const [org, setOrg] = useState<{ razon_social: string | null; nit: string | null } | null>(null)
  const [proyectos, setProyectos] = useState<string[]>([])
  const [errorEnlace, setErrorEnlace] = useState<string | null>(null)

  useEffect(() => {
    if (!clave) return
    fetch(`/api/cuenta-cobro?c=${encodeURIComponent(clave)}`).then(async (r) => {
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setErrorEnlace(j.error ?? 'No se pudo abrir el formulario.'); return }
      setOrg(j.organizacion); setProyectos(j.proyectos ?? [])
    }).catch(() => setErrorEnlace('Sin conexión. Revise los datos o el wifi e intente de nuevo.'))
  }, [clave])

  return (
    <div className="min-h-screen bg-papel">
      <div className="mx-auto max-w-xl px-4 pb-32 pt-6">
        <header className="mb-5">
          <p className="text-[10.5px] font-medium uppercase tracking-[.2em] text-musgo">Amazonía Emprende</p>
          <h1 className="mt-1 font-titulo text-[1.9rem] font-semibold leading-tight text-bosque">Cuenta de cobro</h1>
          <p className="mt-1 text-[13.5px] text-suave">Llene sus datos, firme con el dedo y envíela. Le llega a talento humano y usted se queda con el PDF.</p>
        </header>
        {!clave || errorEnlace ? (
          <div className="rounded-2xl border border-red-600/40 bg-white px-4 py-4 text-[14px] text-red-700 sin-vidrio">
            {errorEnlace ?? 'Falta la clave en el enlace. Pida el enlace completo a talento humano.'}
          </div>
        ) : !org ? (
          <p className="py-10 text-center text-[13px] text-tenue">Cargando…</p>
        ) : (
          <Formulario clave={clave!} org={org} proyectos={proyectos} />
        )}
      </div>
    </div>
  )
}

function Formulario({ clave, org, proyectos }: { clave: string; org: { razon_social: string | null; nit: string | null }; proyectos: string[] }) {
  const mes = mesDe(hoyISO())
  const [v, setV] = useState<Record<Clave, string>>(() => ({
    tipo_documento: 'CC', numero_documento: '', lugar_expedicion: '', nombres: '', apellidos: '', celular: '',
    direccion: '', municipio: '', correo: '', banco: '', tipo_cuenta: '', numero_cuenta: '', proyecto: '',
    concepto: '', periodo_desde: mes.desde, periodo_hasta: mes.hasta,
  }))
  const [valor, setValor] = useState({ texto: '', numero: 0 })
  const [anterior, setAnterior] = useState<number | null>(null)
  const [firma, setFirma] = useState<string | null>(null)
  const [planilla, setPlanilla] = useState<File | null>(null)
  const [autoriza, setAutoriza] = useState(false)
  const [recordar, setRecordar] = useState(true)
  const [recordado, setRecordado] = useState(false)
  const [malos, setMalos] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [lista, setLista] = useState<{ cuenta: CuentaCobro; pdf: Blob } | null>(null)

  // Lo que quedó guardado en este celular la vez pasada.
  useEffect(() => {
    try {
      const g = JSON.parse(localStorage.getItem(GUARDADO) ?? 'null')
      if (g) {
        setV((o) => { const n = { ...o }; for (const k of PERSONALES) if (typeof g[k] === 'string') n[k] = g[k]; return n })
        if (g.ultimo_valor > 0) setAnterior(Number(g.ultimo_valor))
        if (typeof g.ultimo_concepto === 'string') setV((o) => ({ ...o, concepto: g.ultimo_concepto }))
        setAutoriza(g.autoriza === true); setRecordado(true)
      }
    } catch { /* sin almacenamiento: se llena a mano */ }
  }, [])

  const pon = (k: Clave, x: string) => { setV((o) => ({ ...o, [k]: x })); setMalos((s) => { const n = new Set(s); n.delete(k); return n }) }
  const aviso = useMemo(() => avisoValor(valor.numero, { desde: v.periodo_desde, hasta: v.periodo_hasta }, { anterior }), [valor.numero, v.periodo_desde, v.periodo_hasta, anterior])

  function olvidar() {
    try { localStorage.removeItem(GUARDADO) } catch { /* nada */ }
    setV({ tipo_documento: 'CC', numero_documento: '', lugar_expedicion: '', nombres: '', apellidos: '', celular: '', direccion: '',
      municipio: '', correo: '', banco: '', tipo_cuenta: '', numero_cuenta: '', proyecto: '', concepto: '', periodo_desde: mes.desde, periodo_hasta: mes.hasta })
    setAnterior(null); setAutoriza(false); setRecordado(false); setValor({ texto: '', numero: 0 })
  }

  async function enviar() {
    const faltan = new Set<string>(OBLIGATORIOS.filter((k) => !v[k].trim()))
    if (!(valor.numero > 0)) faltan.add('valor')
    if (v.correo && !/^\S+@\S+\.\S+$/.test(v.correo)) faltan.add('correo')
    if (!firma) faltan.add('firma')
    if (!autoriza) faltan.add('autoriza')
    setMalos(faltan)
    if (faltan.size) {
      setError(faltan.has('firma') && faltan.size === 1 ? 'Falta la firma.' : faltan.has('autoriza') && faltan.size === 1
        ? 'Falta aceptar el tratamiento de datos.' : 'Complete lo que está marcado en rojo.')
      document.querySelector(`[data-campo="${[...faltan][0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (aviso?.tipo === 'menos' && !confirm(`${aviso.texto}\n\n¿El valor ${valor.texto} está bien escrito?`)) return
    setEnviando(true); setError(null)
    try {
      const form = new FormData()
      form.append('c', clave)
      form.append('datos', JSON.stringify({ ...v, valor: valor.numero, firma, autoriza: true, sitio_web: (document.getElementById('sitio_web') as HTMLInputElement)?.value ?? '' }))
      if (planilla) form.append('planilla', planilla)
      const r = await fetch('/api/cuenta-cobro', { method: 'POST', body: form })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'No se pudo enviar. Intente de nuevo.')
      try {
        if (recordar) {
          const g: Record<string, unknown> = { ultimo_valor: valor.numero, ultimo_concepto: v.concepto, autoriza: true }
          for (const k of PERSONALES) g[k] = v[k]
          localStorage.setItem(GUARDADO, JSON.stringify(g))
        } else localStorage.removeItem(GUARDADO)
      } catch { /* nada */ }
      const pdf = await pdfCuentaCobro(j.cuenta)
      setLista({ cuenta: j.cuenta, pdf })
      window.scrollTo({ top: 0 })
    } catch (e) { setError((e as Error).message) }
    setEnviando(false)
  }

  if (lista) return <Enviada cuenta={lista.cuenta} pdf={lista.pdf} onOtra={() => { setLista(null); setFirma(null); setValor({ texto: '', numero: 0 }); setAnterior(lista.cuenta.valor) }} />

  const mal = (k: string) => (malos.has(k) ? ' !border-red-600' : '')
  const campo = (k: Clave, etiqueta: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, opcional = false) => (
    <Etiqueta texto={etiqueta} opcional={opcional} campo={k}>
      <input className={CAMPO + mal(k)} value={v[k]} onChange={(e) => pon(k, e.target.value)} {...props} />
    </Etiqueta>
  )

  return (
    <>
      <div className="mb-4 rounded-2xl bg-hueso/80 px-4 py-3 text-[13px] text-tinta">
        Se cobra a <b>{(org.razon_social || 'Amazonía Emprende').toUpperCase()}</b>{org.nit ? ` · NIT ${org.nit}` : ''}
      </div>
      {recordado && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-bosque/30 bg-white px-4 py-3 text-[13px] sin-vidrio">
          <span className="text-suave">Sus datos quedaron guardados en este celular. Revise el valor y el concepto, y firme.</span>
          <button type="button" onClick={olvidar} className="shrink-0 text-[11.5px] font-medium uppercase tracking-[.1em] text-bosque">No soy yo</button>
        </div>
      )}

      <Bloque titulo="Quién cobra">
        <div className="grid grid-cols-2 gap-3">
          {campo('nombres', 'Nombres', { autoComplete: 'given-name' })}
          {campo('apellidos', 'Apellidos', { autoComplete: 'family-name' })}
        </div>
        <div className="grid grid-cols-[0.9fr_1.1fr] gap-3">
          <Etiqueta texto="Documento" campo="tipo_documento">
            <select className={CAMPO} value={v.tipo_documento} onChange={(e) => pon('tipo_documento', e.target.value)}>
              {Object.entries(TIPO_DOC_ID).map(([k, t]) => <option key={k} value={k}>{k === 'CC' ? 'Cédula' : t}</option>)}
            </select>
          </Etiqueta>
          {campo('numero_documento', 'Número', { inputMode: 'numeric', placeholder: 'Sin puntos' })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {campo('lugar_expedicion', 'Expedida en', { placeholder: 'Ciudad' })}
          {campo('celular', 'Celular', { type: 'tel', inputMode: 'tel', autoComplete: 'tel' })}
        </div>
        {campo('direccion', 'Dirección', { autoComplete: 'street-address' })}
        <div className="grid grid-cols-2 gap-3">
          {campo('municipio', 'Municipio', { placeholder: 'Florencia', autoComplete: 'address-level2' })}
          {campo('correo', 'Correo', { type: 'email', inputMode: 'email', autoComplete: 'email' }, true)}
        </div>
      </Bloque>

      <Bloque titulo="El cobro">
        <Etiqueta texto="La suma de ($)" campo="valor">
          <input className={`${CAMPO} text-[20px] font-semibold tabular-nums${mal('valor')}`} inputMode="numeric" placeholder="0"
            value={valor.texto} onChange={(e) => { setValor(leerValor(e.target.value)); setMalos((s) => { const n = new Set(s); n.delete('valor'); return n }) }} />
        </Etiqueta>
        {valor.numero > 0 && <p className="-mt-1 text-[12px] font-medium text-musgo">{pesosEnLetras(valor.numero)}</p>}
        {aviso && (
          <p className={`rounded-xl px-3 py-2 text-[13px] ${aviso.tipo === 'menos' ? 'bg-ambar/25 text-tinta' : 'bg-hueso text-suave'}`}>
            {aviso.texto} Revise que esté bien escrito.
          </p>
        )}
        <Etiqueta texto="Por concepto de" campo="concepto">
          <textarea className={`${CAMPO} min-h-24${mal('concepto')}`} value={v.concepto} onChange={(e) => pon('concepto', e.target.value)}
            placeholder="Ej. Prestación de servicios de apoyo en vivero durante el mes de noviembre de 2026" />
        </Etiqueta>
        <Etiqueta texto="Para el proyecto" campo="proyecto">
          {proyectos.length ? (
            <select className={CAMPO + mal('proyecto')} value={proyectos.includes(v.proyecto) || !v.proyecto ? v.proyecto : '__otro'}
              onChange={(e) => pon('proyecto', e.target.value === '__otro' ? ' ' : e.target.value)}>
              <option value="">Elija el proyecto</option>
              {proyectos.map((p) => <option key={p}>{p}</option>)}
              <option value="__otro">Otro</option>
            </select>
          ) : null}
          {(!proyectos.length || (v.proyecto && !proyectos.includes(v.proyecto))) && (
            <input className={`${CAMPO} mt-2${mal('proyecto')}`} placeholder="Nombre del proyecto" value={v.proyecto.trimStart()}
              onChange={(e) => pon('proyecto', e.target.value || ' ')} />
          )}
        </Etiqueta>
        <div className="grid grid-cols-2 gap-3">
          {campo('periodo_desde', 'Periodo desde', { type: 'date' })}
          {campo('periodo_hasta', 'Hasta', { type: 'date' })}
        </div>
      </Bloque>

      <Bloque titulo="Dónde se le paga">
        <Etiqueta texto="Banco" campo="banco">
          <input className={CAMPO + mal('banco')} list="bancos" value={v.banco} onChange={(e) => pon('banco', e.target.value)} placeholder="Ej. Bancolombia" />
          <datalist id="bancos">{LISTAS.banco.map((b) => <option key={b} value={b} />)}</datalist>
        </Etiqueta>
        <div className="grid grid-cols-2 gap-3">
          <Etiqueta texto="Tipo de cuenta" campo="tipo_cuenta">
            <select className={CAMPO + mal('tipo_cuenta')} value={v.tipo_cuenta} onChange={(e) => pon('tipo_cuenta', e.target.value)}>
              <option value="">—</option>
              {Object.entries(TIPO_CUENTA).map(([k, t]) => <option key={k} value={k}>{k === 'deposito_electronico' ? 'Nequi / Daviplata' : t}</option>)}
            </select>
          </Etiqueta>
          {campo('numero_cuenta', 'Número', { inputMode: 'numeric' })}
        </div>
        <Etiqueta texto="Planilla de seguridad social del periodo" opcional campo="planilla">
          <input type="file" accept="application/pdf,image/jpeg,image/png" className="block w-full text-[13px]" onChange={(e) => setPlanilla(e.target.files?.[0] ?? null)} />
        </Etiqueta>
      </Bloque>

      <Bloque titulo="Firma">
        <div data-campo="firma">
          <FirmaDedo invalida={malos.has('firma')}
            onCambio={(f) => { setFirma(f); if (f) setMalos((s) => { const n = new Set(s); n.delete('firma'); return n }) }} />
        </div>
        <label data-campo="autoriza" className={`mt-4 flex items-start gap-3 text-[12.5px] leading-snug ${malos.has('autoriza') ? 'text-red-700' : 'text-suave'}`}>
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-bosque" checked={autoriza} onChange={(e) => { setAutoriza(e.target.checked); setMalos((s) => { const n = new Set(s); n.delete('autoriza'); return n }) }} />
          <span>{AUTORIZACION_TEXTO}</span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-[12.5px] text-suave">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-bosque" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
          <span>Recordar mis datos en este celular para la próxima cuenta</span>
        </label>
        <input id="sitio_web" name="sitio_web" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      </Bloque>

      {error && <p className="mt-2 rounded-xl bg-white px-4 py-3 text-[13.5px] text-red-700 sin-vidrio">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-linea bg-papel/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <button type="button" disabled={enviando} onClick={enviar}
            className="w-full rounded-full bg-bosque py-3.5 text-[16px] font-semibold text-hueso transition disabled:opacity-60">
            {enviando ? 'Enviando…' : 'Enviar cuenta de cobro'}
          </button>
        </div>
      </div>
    </>
  )
}

function Enviada({ cuenta, pdf, onOtra }: { cuenta: CuentaCobro; pdf: Blob; onOtra: () => void }) {
  const nombre = nombreArchivoCuenta(cuenta)
  const archivo = typeof File !== 'undefined' ? new File([pdf], nombre, { type: 'application/pdf' }) : null
  const puedeCompartir = !!archivo && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [archivo] })
  return (
    <div className="rounded-2xl border border-linea bg-white px-5 py-6 sin-vidrio">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-bosque text-hueso"><Check size={24} /></span>
      <h2 className="mt-4 font-titulo text-[1.5rem] font-semibold text-tinta">Cuenta enviada</h2>
      <p className="mt-1 text-[14px] text-suave">
        La cuenta de cobro N.º {String(cuenta.consecutivo).padStart(3, '0')} llegó a talento humano. Guarde el PDF por si se lo piden.
      </p>
      <div className="mt-5 grid gap-3">
        {puedeCompartir && (
          <button type="button" onClick={() => navigator.share({ files: [archivo!], title: nombre }).catch(() => {})}
            className="flex items-center justify-center gap-2 rounded-full bg-bosque py-3.5 text-[15px] font-semibold text-hueso">
            <Share2 size={17} /> Compartir el PDF
          </button>
        )}
        <button type="button" onClick={() => descargarBlob(pdf, nombre)}
          className={`flex items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-semibold ${puedeCompartir ? 'border border-linea text-tinta' : 'bg-bosque text-hueso'}`}>
          <Download size={17} /> Descargar el PDF
        </button>
        <button type="button" onClick={onOtra} className="py-2 text-[12px] font-medium uppercase tracking-[.12em] text-tenue">Pasar otra cuenta</button>
      </div>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-linea bg-white px-4 py-4 sin-vidrio">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[.14em] text-musgo">{titulo}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  )
}

function Etiqueta({ texto, opcional, campo, children }: { texto: string; opcional?: boolean; campo: string; children: ReactNode }) {
  return (
    <label className="block" data-campo={campo}>
      <span className="mb-1 block text-[13px] font-medium text-tinta">{texto}{opcional && <span className="font-normal text-tenue"> (opcional)</span>}</span>
      {children}
    </label>
  )
}
