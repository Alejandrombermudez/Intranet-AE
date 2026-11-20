'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, Check, FileText, Plus, Search, UserPlus } from 'lucide-react'
import { Aviso, Boton, MarcaEstado, Pestanas, Seccion, Vacio } from '@/app/components/marca'
import { fetchConSesion } from '@/lib/fetch-sesion'
import {
  ESTADO_CUENTA, TIPO_CUENTA, VINCULACION, diasHasta, fechaLarga, pesos,
  type ConfigTalento, type CuentaCobro, type EstadoCuenta, type Vinculacion,
} from '@/lib/talento'
import { nombreArchivoCuenta, pdfCertificadoLaboral, pdfCuentaCobro, descargarBlob } from '@/lib/talento-pdf'
import FirmaDedo from '@/app/components/talento/FirmaDedo'
import { abrirFirmadaCuenta } from '@/app/components/talento/secciones'
import { achicar } from '@/app/components/talento/ficha'
import { FotoPersona } from '@/app/components/talento/espacio'
import { DEPARTAMENTOS } from '@/lib/departamentos'
import { CAMPO, Campo, Mensaje, TD, TH, Ventana, enviar, useCarga } from './comun'

/**
 * TALENTO HUMANO — lo de todas las personas.
 *   Personas        la ficha de cada quien, su contrato vigente y lo que tiene pendiente
 *   Cuentas de cobro  la bandeja: aprobar, devolver, marcar pagadas y descargar juntas
 * Solo departamentos Financiero y Ejecutivo (PUEDE.talentoHumano).
 *
 * La configuración (razón social, NIT, quién firma y su firma, el enlace de
 * cuentas de cobro) era la subpestaña «Plantillas» y nadie la encontraba: desde
 * el 2026-11-20 es el botón «Configuración» del módulo (`Configuracion`).
 */
type Sub = 'personas' | 'cuentas'

export interface FilaPersona {
  id: string; email: string; nombres: string | null; apellidos: string | null; foto: string | null
  cargo: string | null; cargo_m365: string | null; vinculacion: Vinculacion | null; fecha_fin: string | null
  valor_mensual: number | null; activo: boolean; autoriza_datos: boolean; cuentas_por_revisar: number; n_documentos: number
  departamento?: string | null
}

export default function Talento() {
  const [sub, setSub] = useState<Sub>('personas')
  return (
    <>
      <div className="mb-8">
        <Pestanas items={[
          { id: 'personas', label: 'Personas', activa: sub === 'personas', onClick: () => setSub('personas') },
          { id: 'cuentas', label: 'Cuentas de cobro', activa: sub === 'cuentas', onClick: () => setSub('cuentas') },
        ]} />
      </div>
      {sub === 'personas' && <Personas />}
      {sub === 'cuentas' && <Bandeja />}
    </>
  )
}

// ─── Personas ─────────────────────────────────────────────────────────────────

function Personas() {
  const { data, error, recargar } = useCarga<{ personas: FilaPersona[]; aviso?: string } | null>(
    '/api/talento/personas', (j) => j as unknown as { personas: FilaPersona[]; aviso?: string }, 'No se pudo leer la lista de personas.')
  const [buscar, setBuscar] = useState('')
  const [vin, setVin] = useState<'todas' | Vinculacion | 'sin'>('todas')
  const [nueva, setNueva] = useState(false)

  const filas = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return (data?.personas ?? []).filter((p) =>
      (vin === 'todas' || (vin === 'sin' ? !p.vinculacion : p.vinculacion === vin))
      && (!q || `${p.nombres ?? ''} ${p.apellidos ?? ''} ${p.email} ${p.cargo ?? ''}`.toLowerCase().includes(q)))
  }, [data, buscar, vin])

  if (data?.aviso) return <Aviso tono="ambar">{data.aviso}</Aviso>
  const todas = data?.personas ?? []

  return (
    <>
      {error && <Aviso tono="arcilla" className="mb-6">{error}</Aviso>}
      <div className="mb-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {[
          { n: todas.filter((p) => p.activo).length, l: 'Personas activas' },
          { n: todas.filter((p) => p.vinculacion === 'planta').length, l: 'De planta' },
          { n: todas.filter((p) => p.vinculacion === 'contratista').length, l: 'Contratistas' },
          { n: todas.reduce((s, p) => s + Number(p.cuentas_por_revisar), 0), l: 'Cuentas por revisar' },
        ].map((c) => (
          <div key={c.l}><p className="font-display text-3xl font-bold tabular-nums text-tinta">{c.n}</p><p className="text-[10px] uppercase tracking-[.14em] text-tenue">{c.l}</p></div>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-3 text-tenue" />
          <input className={`${CAMPO} pl-9`} placeholder="Buscar por nombre, correo o cargo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
        </div>
        <select className={`${CAMPO} w-52`} value={vin} onChange={(e) => setVin(e.target.value as typeof vin)}>
          <option value="todas">Todas las vinculaciones</option>
          {(Object.keys(VINCULACION) as Vinculacion[]).map((k) => <option key={k} value={k}>{VINCULACION[k]}</option>)}
          <option value="sin">Sin contrato vigente</option>
        </select>
        <Boton className="ml-auto" icono={<UserPlus size={13} />} onClick={() => setNueva(true)}>Nueva persona</Boton>
      </div>
      <p className="mb-4 max-w-[80ch] text-[12px] text-tenue">
        Cada quien aparece aquí la primera vez que entra a «Mi perfil» con su correo de la organización. Con «Nueva persona» se
        crea la ficha antes, para cargarle el contrato desde el primer día.
      </p>
      {data === null ? <Vacio>Cargando…</Vacio> : filas.length === 0 ? <Vacio>Nadie con ese filtro</Vacio> : <TarjetasPersonas filas={filas} />}
      {nueva && <NuevaPersona onCerrar={() => setNueva(false)} onListo={recargar} />}
    </>
  )
}

/**
 * Una tarjeta por persona: foto, nombre, cargo, área y vinculación, y lo que
 * tiene pendiente (ficha sin diligenciar, cuentas por revisar, contrato por
 * vencer). Toda la tarjeta lleva a su ficha.
 */
export function TarjetasPersonas({ filas }: { filas: FilaPersona[] }) {
  const nombreArea = (id: string | null | undefined) => DEPARTAMENTOS.find((d) => d.id === id)?.nombre ?? null
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {filas.map((p) => {
        const dias = p.fecha_fin ? diasHasta(p.fecha_fin) : null
        const porVencer = dias !== null && dias >= 0 && dias <= 30
        return (
          <Link key={p.id} href={`/intranet/administrativa/personas/${p.id}`}
            className={`group relative flex gap-4 vidrio rounded-2xl px-5 py-5 transition-colors hover:border-bosque ${p.activo ? '' : 'opacity-50'}`}>
            <FotoPersona persona={p} tam={64} claro />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[1.05rem] font-semibold leading-tight text-tinta">{[p.nombres, p.apellidos].filter(Boolean).join(' ') || p.email}</p>
              <p className="truncate text-[12px] text-suave">{p.cargo ?? p.cargo_m365 ?? 'Sin cargo registrado'}</p>
              <p className="mt-0.5 truncate text-[11px] uppercase tracking-[.12em] text-tenue">
                {[nombreArea(p.departamento), p.vinculacion ? VINCULACION[p.vinculacion] : 'Sin contrato vigente'].filter(Boolean).join(' · ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                <MarcaEstado color={p.autoriza_datos ? 'var(--color-bosque)' : 'var(--color-ambar)'}>{p.autoriza_datos ? 'Ficha diligenciada' : 'Ficha sin diligenciar'}</MarcaEstado>
                {Number(p.cuentas_por_revisar) > 0 && <MarcaEstado color="var(--color-ambar)">{p.cuentas_por_revisar} cuenta{Number(p.cuentas_por_revisar) === 1 ? '' : 's'} por revisar</MarcaEstado>}
                {porVencer && <MarcaEstado color="var(--color-red-600)">Contrato vence en {dias} d</MarcaEstado>}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

function NuevaPersona({ onCerrar, onListo }: { onCerrar: () => void; onListo: () => Promise<void> }) {
  const [v, setV] = useState({ email: '', nombres: '', apellidos: '' })
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  async function crear() {
    setOcupado(true); setError(null)
    try {
      const j = await enviar<{ persona: { id: string }; aviso?: string | null }>('/api/talento/personas', 'POST', v)
      if (j.aviso) alert(j.aviso)
      await onListo()
      window.location.href = `/intranet/administrativa/personas/${j.persona.id}`
    } catch (e) { setError((e as Error).message); setOcupado(false) }
  }
  return (
    <Ventana titulo="Nueva persona" onCerrar={onCerrar}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Correo de la organización" className="sm:col-span-2"><input className={CAMPO} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} placeholder="nombre@amazoniaemprende.com" /></Campo>
        <Campo etiqueta="Nombres"><input className={CAMPO} value={v.nombres} onChange={(e) => setV({ ...v, nombres: e.target.value })} /></Campo>
        <Campo etiqueta="Apellidos"><input className={CAMPO} value={v.apellidos} onChange={(e) => setV({ ...v, apellidos: e.target.value })} /></Campo>
      </div>
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || !v.email.trim()} icono={<Plus size={13} />} onClick={crear}>Crear y abrir la ficha</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}

// ─── Bandeja de cuentas de cobro ──────────────────────────────────────────────

function mesActual() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

function Bandeja() {
  const [mes, setMes] = useState(mesActual())
  const [estado, setEstado] = useState<EstadoCuenta | ''>('')
  const url = useMemo(() => {
    const qs = new URLSearchParams()
    if (mes) {
      const [a, m] = mes.split('-').map(Number)
      qs.set('desde', `${mes}-01`); qs.set('hasta', `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`)
    }
    if (estado) qs.set('estado', estado)
    return `/api/talento/cuentas?${qs}`
  }, [mes, estado])
  const { data, error, recargar } = useCarga<CuentaCobro[]>(url, (j) => (j.cuentas as CuentaCobro[]) ?? [], 'No se pudieron leer las cuentas.')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({})
  const [ocupado, setOcupado] = useState(false)

  const [soloAvisos, setSoloAvisos] = useState(false)
  const todas = data ?? []
  const cuentas = soloAvisos ? todas.filter((c) => c.avisos?.length && c.estado !== 'anulada') : todas
  const elegidas = cuentas.filter((c) => sel.has(c.id))
  const total = cuentas.filter((c) => c.estado !== 'anulada').reduce((s, c) => s + Number(c.valor), 0)
  const suma = (est: EstadoCuenta[]) => {
    const l = todas.filter((c) => est.includes(c.estado))
    return { n: l.length, v: l.reduce((s, c) => s + Number(c.valor), 0) }
  }
  const resumen = [
    { ...suma(['radicada', 'aprobada']), l: 'Total por pagar', fuerte: true },
    { ...suma(['radicada']), l: 'Por revisar', fuerte: false },
    { ...suma(['aprobada']), l: 'Aprobadas, sin pagar', fuerte: false },
    { ...suma(['pagada']), l: 'Pagadas', fuerte: false },
  ]
  const conAvisos = todas.filter((c) => c.avisos?.length && !['anulada', 'pagada'].includes(c.estado)).length
  // Por el enlace el proyecto es opcional: lo pone talento humano antes de aprobar.
  const sinProyecto = todas.filter((c) => !c.proyecto?.trim() && !['anulada', 'pagada'].includes(c.estado)).length
  // Los que ya se usaron, para escribirlos igual («ISA piloto», no «ISA PILOTO»).
  const proyectos = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of todas) if (c.proyecto?.trim()) m.set(c.proyecto.trim().toLowerCase(), m.get(c.proyecto.trim().toLowerCase()) ?? c.proyecto.trim())
    return [...m.values()].sort((a, b) => a.localeCompare(b, 'es'))
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps -- `todas` es `data ?? []`
  const alternar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function enLote(accion: 'aprobar' | 'pagar') {
    const aptas = elegidas.filter((c) => (accion === 'aprobar' ? c.estado === 'radicada' : c.estado === 'aprobada'))
    if (!aptas.length) { setMsg({ error: accion === 'aprobar' ? 'Ninguna de las elegidas está radicada.' : 'Ninguna de las elegidas está aprobada.' }); return }
    setOcupado(true); setMsg({})
    const fallas: string[] = []
    for (const c of aptas) {
      try { await enviar(`/api/talento/cuentas/${c.id}`, 'PATCH', { accion }) }
      catch (e) { fallas.push(`N.º ${c.consecutivo} de ${c.datos.persona.nombres}: ${(e as Error).message}`) }
    }
    setOcupado(false); setSel(new Set()); await recargar()
    setMsg(fallas.length ? { error: fallas.join(' · ') } : { ok: `${aptas.length} cuenta(s) ${accion === 'aprobar' ? 'aprobadas' : 'marcadas como pagadas'}.` })
  }

  async function una(c: CuentaCobro, accion: string) {
    let observacion: string | null = null
    if (accion === 'devolver' || accion === 'anular') {
      observacion = prompt(accion === 'devolver' ? '¿Qué hay que corregir? (lo ve la persona)' : '¿Por qué se anula?')
      if (!observacion?.trim()) return
    }
    try { await enviar(`/api/talento/cuentas/${c.id}`, 'PATCH', { accion, observacion }); await recargar(); setMsg({}) }
    catch (e) { setMsg({ error: (e as Error).message }) }
  }

  /** Un .zip con el PDF de cada cuenta elegida, su planilla y una relación para el banco. */
  async function descargarZip() {
    const lista = elegidas.length ? elegidas : cuentas.filter((c) => c.estado !== 'anulada')
    if (!lista.length) return
    setOcupado(true); setMsg({})
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const filas = [['N.º', 'Fecha', 'Nombre', 'Documento', 'Celular', 'Banco', 'Tipo de cuenta', 'Número de cuenta', 'Proyecto', 'Concepto', 'Valor', 'Estado', 'Llegó por', 'Avisos']]
      for (const c of lista) {
        const nombre = nombreArchivoCuenta(c)
        zip.file(nombre, await pdfCuentaCobro(c))
        if (c.soporte_planilla) {
          const r = await fetchConSesion(`/api/talento/cuentas/${c.id}`)
          const j = await r.json().catch(() => ({}))
          if (j.url_planilla) {
            const b = await fetch(j.url_planilla).then((x) => x.blob()).catch(() => null)
            if (b) zip.file(nombre.replace(/\.pdf$/, `_planilla.${b.type.includes('pdf') ? 'pdf' : 'jpg'}`), b)
          }
        }
        const p = c.datos.persona
        filas.push([String(c.consecutivo), c.fecha, `${p.nombres} ${p.apellidos}`, p.numero_documento, p.celular ?? '', p.banco,
          TIPO_CUENTA[p.tipo_cuenta ?? ''] ?? '', p.numero_cuenta, c.proyecto ?? '', c.concepto, String(c.valor), ESTADO_CUENTA[c.estado].nombre,
          c.origen === 'enlace' ? 'Enlace' : 'Intranet', (c.avisos ?? []).join(' ')])
      }
      filas.push(['', '', 'TOTAL', '', '', '', '', '', '', '', String(lista.filter((c) => c.estado !== 'anulada').reduce((s, c) => s + Number(c.valor), 0)), '', '', ''])
      const csv = filas.map((f) => f.map((x) => /[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x).join(';')).join('\n')
      zip.file(`relacion-cuentas-de-cobro_${mes || 'todas'}.csv`, '﻿' + csv)
      descargarBlob(await zip.generateAsync({ type: 'blob' }), `cuentas-de-cobro_${mes || 'todas'}.zip`)
    } catch (e) { setMsg({ error: 'No se pudo armar el .zip: ' + (e as Error).message }) }
    setOcupado(false)
  }

  return (
    <>
      <div className="mb-7 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {resumen.map((x) => (
          <div key={x.l}>
            <p className={`font-display text-2xl font-bold tabular-nums ${x.fuerte ? 'text-bosque' : 'text-tinta'}`}>{pesos(x.v)}</p>
            <p className="text-[10px] uppercase tracking-[.14em] text-tenue">{x.l} · {x.n} cuenta{x.n === 1 ? '' : 's'}</p>
          </div>
        ))}
      </div>
      {sinProyecto > 0 && (
        <Aviso tono="ambar" className="mb-4">
          {sinProyecto === 1 ? 'Una cuenta llegó' : `${sinProyecto} cuentas llegaron`} sin proyecto. Póngaselo con «Poner proyecto»: sin proyecto no se puede aprobar.
        </Aviso>
      )}
      {conAvisos > 0 && (
        <Aviso tono="ambar" className="mb-6">
          {conAvisos === 1 ? 'Una cuenta tiene' : `${conAvisos} cuentas tienen`} algo que revisar antes de pagar (valor distinto al pactado,
          datos de pago distintos a los de la ficha o persona nueva).{' '}
          <button type="button" className="underline" onClick={() => { setSoloAvisos(!soloAvisos); setSel(new Set()) }}>{soloAvisos ? 'Ver todas' : 'Ver solo esas'}</button>
        </Aviso>
      )}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Mes" className="w-44"><input type="month" className={CAMPO} value={mes} onChange={(e) => { setMes(e.target.value); setSel(new Set()) }} /></Campo>
        <Campo etiqueta="Estado" className="w-44">
          <select className={CAMPO} value={estado} onChange={(e) => { setEstado(e.target.value as EstadoCuenta | ''); setSel(new Set()) }}>
            <option value="">Todas</option>
            {(Object.keys(ESTADO_CUENTA) as EstadoCuenta[]).map((k) => <option key={k} value={k}>{ESTADO_CUENTA[k].nombre}</option>)}
          </select>
        </Campo>
        <div className="ml-auto flex flex-wrap gap-2">
          <Boton variante="secundario" icono={<Check size={13} />} disabled={ocupado || !elegidas.length} onClick={() => enLote('aprobar')}>Aprobar</Boton>
          <Boton variante="secundario" disabled={ocupado || !elegidas.length} onClick={() => enLote('pagar')}>Marcar pagadas</Boton>
          <Boton icono={<Archive size={13} />} disabled={ocupado || !cuentas.length} onClick={descargarZip}>
            {ocupado ? 'Preparando…' : elegidas.length ? `Descargar ${elegidas.length} (.zip)` : 'Descargar todas (.zip)'}
          </Boton>
        </div>
      </div>
      {error && <Aviso tono="arcilla" className="mb-4">{error}</Aviso>}
      <Mensaje error={msg.error} ok={msg.ok} />
      <Seccion titulo={`${cuentas.length} cuenta${cuentas.length === 1 ? '' : 's'} · ${pesos(total)}`} sub="«PDF» descarga una sola. El .zip lleva el PDF de cada cuenta (las marcadas, o todas las del mes), su planilla de seguridad social si la adjuntaron y una relación en CSV con los datos bancarios, los avisos y el total.">
        {data === null ? <Vacio>Cargando…</Vacio> : cuentas.length === 0 ? <Vacio>No hay cuentas de cobro en este mes</Vacio> : (
          <div className="overflow-x-auto vidrio rounded-2xl">
            <table className="w-full">
              <thead className="border-b border-linea/70 bg-white/40">
                <tr>
                  <th className={TH}><input type="checkbox" checked={sel.size === cuentas.length && cuentas.length > 0}
                    onChange={(e) => setSel(e.target.checked ? new Set(cuentas.map((c) => c.id)) : new Set())} /></th>
                  <th className={TH}>Persona</th><th className={TH}>N.º</th><th className={TH}>Concepto</th>
                  <th className={`${TH} text-right`}>Valor</th><th className={TH}>Estado</th><th className={TH}></th>
                </tr>
              </thead>
              <tbody>
                {cuentas.map((c) => {
                  const p = c.datos.persona
                  const b = 'ml-3 text-[10.5px] uppercase tracking-[.14em] text-tenue hover:text-tinta'
                  return (
                    <tr key={c.id} className={`border-b border-fina ${c.estado === 'anulada' ? 'opacity-50' : ''}`}>
                      <td className={TD}><input type="checkbox" checked={sel.has(c.id)} onChange={() => alternar(c.id)} /></td>
                      <td className={TD}>
                        <Link href={`/intranet/administrativa/personas/${c.persona_id}?tab=cuentas`} className="hover:underline">{p.nombres} {p.apellidos}</Link>
                        <span className="block text-[11px] text-tenue">{p.banco} · {p.numero_cuenta}</span>
                        {c.origen === 'enlace' && <span className="block text-[11px] text-tenue">Por el enlace{p.celular ? ` · ${p.celular}` : ''}</span>}
                      </td>
                      <td className={`${TD} tabular-nums`}>{String(c.consecutivo).padStart(3, '0')}<span className="block text-[11px] text-tenue">{fechaLarga(c.fecha)}</span></td>
                      <td className={`${TD} text-[12px]`}>{c.concepto}
                        <ProyectoCuenta cuenta={c} proyectos={proyectos} onCambio={async (proyecto) => {
                          try { await enviar(`/api/talento/cuentas/${c.id}`, 'PATCH', { accion: 'proyecto', proyecto }); await recargar(); setMsg({}) }
                          catch (e) { setMsg({ error: (e as Error).message }) }
                        }} />
                        {c.observacion && c.estado === 'devuelta' && <span className="block text-red-700">{c.observacion}</span>}
                        {!['anulada', 'pagada'].includes(c.estado) && c.avisos?.map((a) => <span key={a} className="mt-1 block rounded-lg bg-ambar/20 px-2 py-1 text-[11.5px] text-tinta">{a}</span>)}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{pesos(c.valor)}</td>
                      <td className={`${TD} whitespace-nowrap`}><MarcaEstado color={ESTADO_CUENTA[c.estado].color}>{ESTADO_CUENTA[c.estado].nombre}</MarcaEstado></td>
                      <td className={`${TD} whitespace-nowrap text-right`}>
                        <button type="button" className={b} onClick={async () => descargarBlob(await pdfCuentaCobro(c), nombreArchivoCuenta(c))}>PDF</button>
                        {c.soporte_planilla && <button type="button" className={b} onClick={() => abrirFirmadaCuenta(c.id)}>Planilla</button>}
                        {c.estado === 'radicada' && <button type="button" className={b} onClick={() => una(c, 'aprobar')}>Aprobar</button>}
                        {/* Por el enlace no hay a dónde devolverla: se anula con el motivo y se le avisa por teléfono. */}
                        {['radicada', 'aprobada'].includes(c.estado) && c.origen !== 'enlace' && <button type="button" className={b} onClick={() => una(c, 'devolver')}>Devolver</button>}
                        {c.estado === 'aprobada' && <button type="button" className={b} onClick={() => una(c, 'pagar')}>Pagada</button>}
                        {['radicada', 'aprobada', 'devuelta'].includes(c.estado) && <button type="button" className={b} onClick={() => una(c, 'anular')}>Anular</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>
    </>
  )
}

/** El proyecto de la cuenta: se ve, y mientras no esté pagada ni anulada se pone o se corrige ahí mismo. */
function ProyectoCuenta({ cuenta: c, proyectos, onCambio }: { cuenta: CuentaCobro; proyectos: string[]; onCambio: (p: string) => Promise<void> }) {
  const [editando, setEditando] = useState(false)
  const [v, setV] = useState(c.proyecto ?? '')
  const [ocupado, setOcupado] = useState(false)
  const abierta = !['pagada', 'anulada'].includes(c.estado)
  const falta = !c.proyecto?.trim()
  if (editando) {
    return (
      <span className="mt-1.5 flex items-center gap-2">
        <input autoFocus className={`${CAMPO} !py-1.5 text-[12px]`} list={`proyectos-${c.id}`} value={v} placeholder="Proyecto"
          onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setEditando(false) }} />
        <datalist id={`proyectos-${c.id}`}>{proyectos.map((p) => <option key={p} value={p} />)}</datalist>
        <button type="button" disabled={ocupado || !v.trim()} className="text-[10.5px] font-medium uppercase tracking-[.12em] text-bosque disabled:opacity-40"
          onClick={async () => { setOcupado(true); await onCambio(v.trim()); setOcupado(false); setEditando(false) }}>Guardar</button>
        <button type="button" className="text-[10.5px] uppercase tracking-[.12em] text-tenue" onClick={() => setEditando(false)}>Cancelar</button>
      </span>
    )
  }
  if (falta) {
    return abierta
      ? <button type="button" className="mt-1 block rounded-lg bg-ambar/25 px-2 py-1 text-left text-[11.5px] font-medium text-tinta hover:bg-ambar/40"
          onClick={() => { setV(''); setEditando(true) }}>Sin proyecto · Poner proyecto</button>
      : <span className="block text-[11px] text-tenue">Sin proyecto</span>
  }
  return (
    <span className="block text-[11px] text-tenue">{c.proyecto}
      {abierta && <button type="button" className="ml-2 uppercase tracking-[.12em] hover:text-tinta" onClick={() => { setV(c.proyecto ?? ''); setEditando(true) }}>Cambiar</button>}
    </span>
  )
}

// ─── Plantillas ───────────────────────────────────────────────────────────────

export function Configuracion() {
  const { data, error } = useCarga<ConfigTalento | null>('/api/talento/config', (j) => (j.config as ConfigTalento) ?? null, 'No se pudo leer la configuración.')
  if (error) return <Aviso tono="arcilla">{error}</Aviso>
  if (!data) return <Vacio>Cargando…</Vacio>
  return <FormPlantillas inicial={data} />
}

function FormPlantillas({ inicial }: { inicial: ConfigTalento }) {
  const [v, setV] = useState<ConfigTalento>(inicial)
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({})
  const [ocupado, setOcupado] = useState(false)
  const pon = (k: keyof ConfigTalento, x: string | null) => { setV((o) => ({ ...o, [k]: x })); setMsg({}) }

  async function guardar() {
    setOcupado(true)
    try { await enviar('/api/talento/config', 'PATCH', v); setMsg({ ok: 'Guardado. Los certificados y las cuentas nuevas salen con estos datos.' }) }
    catch (e) { setMsg({ error: (e as Error).message }) }
    setOcupado(false)
  }
  const [dibujar, setDibujar] = useState(false)
  async function firma(f: File | undefined) {
    if (!f) return
    let url: string
    try { url = await firmaSinFondo(f) } catch { url = await achicar(f, 600, 240) }
    if (url.length > 190000) { setMsg({ error: 'La imagen de la firma es muy pesada: recórtela.' }); return }
    pon('firmante_firma', url)
  }
  async function ejemplo() {
    const hoy = new Date().toISOString().slice(0, 10)
    descargarBlob(await pdfCertificadoLaboral({
      codigo: 'EJEMPLO', incluye_salario: false, dirigido_a: null,
      datos: {
        persona: { nombres: 'Nombre', apellidos: 'De Ejemplo', tipo_documento: 'CC', numero_documento: '1.000.000.000', lugar_expedicion: 'Florencia' },
        contratos: [{ vinculacion: 'planta', modalidad: 'termino_indefinido', numero: null, cargo: 'Cargo de ejemplo', objeto: null,
          fecha_inicio: '2025-01-01', fecha_fin: null, valor_mensual: null, estado: 'vigente', fecha_terminacion: null }],
        organizacion: v, expedido: hoy,
      },
    }), 'Ejemplo-certificado.pdf')
  }

  const enlace = v.clave_enlace && typeof window !== 'undefined' ? `${window.location.origin}/cuenta-cobro?c=${v.clave_enlace}` : null
  async function nuevaClave() {
    if (!confirm('El enlace actual deja de funcionar y hay que mandar el nuevo a todos. ¿Cambiar la clave?')) return
    try { const j = await enviar<{ config: ConfigTalento }>('/api/talento/config', 'PATCH', { nueva_clave: true }); setV((o) => ({ ...o, clave_enlace: j.config.clave_enlace })); setMsg({ ok: 'Clave cambiada. Comparta el enlace nuevo.' }) }
    catch (e) { setMsg({ error: (e as Error).message }) }
  }

  return (
    <div className="max-w-3xl">
      {(!v.nit || !v.firmante_nombre) && <Aviso tono="ambar" className="mb-6">Faltan el NIT y quién firma: sin ellos los certificados y las cuentas de cobro salen incompletos.</Aviso>}
      <Seccion titulo="Enlace para pasar cuentas de cobro" sub="Para operarios y contratistas sin correo de la organización: llenan sus datos, firman con el dedo y la cuenta llega a la bandeja. Compártalo por WhatsApp; quien no tenga el enlace no puede enviar.">
        {enlace ? (
          <div className="flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-xl bg-white/60 px-3 py-2.5 text-[12.5px] text-tinta">{enlace}</code>
            <Boton variante="secundario" onClick={async () => { await navigator.clipboard.writeText(enlace); setMsg({ ok: 'Enlace copiado.' }) }}>Copiar</Boton>
            <Boton variante="fantasma" onClick={nuevaClave}>Cambiar clave</Boton>
          </div>
        ) : (
          <Aviso tono="ambar">Falta correr <code>docs/sql/migration_cuentas_cobro_enlace.sql</code> en Supabase para habilitar el enlace.</Aviso>
        )}
      </Seccion>
      <Seccion titulo="La organización" sub="Encabezan los certificados y las cuentas de cobro.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Razón social"><input className={CAMPO} value={v.razon_social ?? ''} onChange={(e) => pon('razon_social', e.target.value)} /></Campo>
          <Campo etiqueta="NIT (con dígito de verificación)"><input className={CAMPO} value={v.nit ?? ''} onChange={(e) => pon('nit', e.target.value)} placeholder="901.234.567-8" /></Campo>
          <Campo etiqueta="Dirección"><input className={CAMPO} value={v.direccion ?? ''} onChange={(e) => pon('direccion', e.target.value)} /></Campo>
          <Campo etiqueta="Ciudad"><input className={CAMPO} value={v.ciudad ?? ''} onChange={(e) => pon('ciudad', e.target.value)} /></Campo>
          <Campo etiqueta="Teléfono"><input className={CAMPO} value={v.telefono ?? ''} onChange={(e) => pon('telefono', e.target.value)} /></Campo>
          <Campo etiqueta="Correo de talento humano"><input className={CAMPO} value={v.correo ?? ''} onChange={(e) => pon('correo', e.target.value)} /></Campo>
        </div>
      </Seccion>
      <Seccion titulo="Quién firma por la organización" sub="Su nombre, cargo y firma salen en los certificados laborales. Todos los documentos van en la hoja membrete de Amazonía Emprende.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre"><input className={CAMPO} value={v.firmante_nombre ?? ''} onChange={(e) => pon('firmante_nombre', e.target.value)} /></Campo>
          <Campo etiqueta="Cargo"><input className={CAMPO} value={v.firmante_cargo ?? ''} onChange={(e) => pon('firmante_cargo', e.target.value)} placeholder="Dirección administrativa y financiera" /></Campo>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <div className="grid h-24 w-64 place-items-center rounded-2xl border border-dashed border-taupe bg-white/45">
            {v.firmante_firma ? <img src={v.firmante_firma} alt="Firma" className="max-h-20 max-w-60 object-contain" /> : <span className="text-[11px] text-tenue">Sin firma</span>}
          </div>
          <div className="grid gap-2">
            <label className="text-[12px] text-suave">
              <span className="mb-1 block font-medium text-tinta">Subir la firma escaneada o en foto</span>
              <input type="file" accept="image/png,image/jpeg" className="text-[12px]" onChange={(e) => { firma(e.target.files?.[0]); e.target.value = '' }} />
              <span className="mt-1 block text-[11px] text-tenue">Firma en tinta oscura sobre papel blanco; el fondo blanco se quita solo.</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Boton variante="secundario" onClick={() => setDibujar(!dibujar)}>{dibujar ? 'Cerrar' : 'Firmar con el dedo o el mouse'}</Boton>
              {v.firmante_firma && <Boton variante="fantasma" onClick={() => pon('firmante_firma', null)}>Quitar la firma</Boton>}
            </div>
          </div>
        </div>
        {dibujar && <div className="mt-4 max-w-xl"><FirmaDedo onCambio={(f) => { if (f) pon('firmante_firma', f) }} /></div>}
      </Seccion>
      <Seccion titulo="Pie de las cuentas de cobro" sub="Las declaraciones que hace el contratista al radicar. Van en todas las cuentas nuevas.">
        <textarea className={`${CAMPO} min-h-28`} value={v.texto_cuenta_cobro ?? ''} onChange={(e) => pon('texto_cuenta_cobro', e.target.value)} />
      </Seccion>
      <div className="flex flex-wrap gap-2">
        <Boton disabled={ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : 'Guardar'}</Boton>
        <Boton variante="secundario" icono={<FileText size={13} />} onClick={ejemplo}>Ver un ejemplo en PDF</Boton>
      </div>
      <Mensaje error={msg.error} ok={msg.ok} />
    </div>
  )
}

/**
 * La firma escaneada o en foto, lista para ir sobre la hoja membrete: el fondo
 * claro se vuelve transparente, se recorta al trazo y se achica a 600 × 240.
 */
async function firmaSinFondo(f: File): Promise<string> {
  const img = new Image()
  img.src = URL.createObjectURL(f)
  await img.decode()
  const esc = Math.min(1, 1200 / img.width, 600 / img.height)
  const w = Math.round(img.width * esc), h = Math.round(img.height * esc)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')!
  x.drawImage(img, 0, 0, w, h)
  URL.revokeObjectURL(img.src)
  const d = x.getImageData(0, 0, w, h), p = d.data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let i = 0; i < p.length; i += 4) {
    const luz = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]
    // Blanco y gris del papel → transparente; lo oscuro queda, con borde suave.
    const a = luz > 200 ? 0 : luz < 140 ? 255 : Math.round(255 * (200 - luz) / 60)
    p[i + 3] = Math.min(p[i + 3], a)
    if (p[i + 3] > 40) {
      const k = i / 4, px = k % w, py = (k - px) / w
      if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py
    }
  }
  if (x1 < 0) throw new Error('No se ve trazo en la imagen.')
  x.putImageData(d, 0, 0)
  const m = 6
  x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w - 1, x1 + m); y1 = Math.min(h - 1, y1 + m)
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, e2 = Math.min(1, 600 / cw, 240 / ch)
  const out = document.createElement('canvas'); out.width = Math.round(cw * e2); out.height = Math.round(ch * e2)
  out.getContext('2d')!.drawImage(c, x0, y0, cw, ch, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}
