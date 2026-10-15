'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, Check, Plus, Search, UserPlus } from 'lucide-react'
import { Aviso, Boton, MarcaEstado, Pestanas, Seccion, Vacio } from '@/app/components/marca'
import { fetchConSesion } from '@/lib/fetch-sesion'
import {
  ESTADO_CUENTA, TIPO_CUENTA, VINCULACION, diasHasta, fechaLarga, pesos,
  type ConfigTalento, type CuentaCobro, type EstadoCuenta, type Vinculacion,
} from '@/lib/talento'
import { nombreArchivoCuenta, pdfCuentaCobro, descargarBlob } from '@/lib/talento-pdf'
import { abrirFirmadaCuenta } from '@/app/components/talento/secciones'
import { achicar } from '@/app/components/talento/ficha'
import { FotoPersona } from '@/app/components/talento/espacio'
import { DEPARTAMENTOS } from '@/lib/departamentos'
import { CAMPO, Campo, Mensaje, TD, TH, Ventana, enviar, useCarga } from './comun'

/**
 * TALENTO HUMANO — lo de todas las personas.
 *   Personas        la ficha de cada quien, su contrato vigente y lo que tiene pendiente
 *   Cuentas de cobro  la bandeja: aprobar, devolver, marcar pagadas y descargar juntas
 *   Plantillas      razón social, NIT y quién firma los certificados
 * Solo departamentos Financiero y Ejecutivo (PUEDE.talentoHumano).
 */
type Sub = 'personas' | 'cuentas' | 'plantillas'

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
      <div className="mb-8 border-b border-linea">
        <Pestanas items={[
          { id: 'personas', label: 'Personas', activa: sub === 'personas', onClick: () => setSub('personas') },
          { id: 'cuentas', label: 'Cuentas de cobro', activa: sub === 'cuentas', onClick: () => setSub('cuentas') },
          { id: 'plantillas', label: 'Plantillas', activa: sub === 'plantillas', onClick: () => setSub('plantillas') },
        ]} />
      </div>
      {sub === 'personas' && <Personas />}
      {sub === 'cuentas' && <Bandeja />}
      {sub === 'plantillas' && <Plantillas />}
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
            className={`group relative flex gap-4 border border-linea bg-white px-5 py-5 transition-colors hover:border-bosque ${p.activo ? '' : 'opacity-50'}`}>
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

  const cuentas = data ?? []
  const elegidas = cuentas.filter((c) => sel.has(c.id))
  const total = cuentas.filter((c) => c.estado !== 'anulada').reduce((s, c) => s + Number(c.valor), 0)
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
      const filas = [['N.º', 'Fecha', 'Nombre', 'Documento', 'Banco', 'Tipo de cuenta', 'Número de cuenta', 'Concepto', 'Valor', 'Estado']]
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
        filas.push([String(c.consecutivo), c.fecha, `${p.nombres} ${p.apellidos}`, p.numero_documento, p.banco,
          TIPO_CUENTA[p.tipo_cuenta ?? ''] ?? '', p.numero_cuenta, c.concepto, String(c.valor), ESTADO_CUENTA[c.estado].nombre])
      }
      const csv = filas.map((f) => f.map((x) => /[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x).join(';')).join('\n')
      zip.file(`relacion-cuentas-de-cobro_${mes || 'todas'}.csv`, '﻿' + csv)
      descargarBlob(await zip.generateAsync({ type: 'blob' }), `cuentas-de-cobro_${mes || 'todas'}.zip`)
    } catch (e) { setMsg({ error: 'No se pudo armar el .zip: ' + (e as Error).message }) }
    setOcupado(false)
  }

  return (
    <>
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
      <Seccion titulo={`${cuentas.length} cuenta${cuentas.length === 1 ? '' : 's'} · ${pesos(total)}`} sub="El .zip lleva el PDF de cada cuenta, su planilla de seguridad social si la adjuntaron y una relación en CSV con los datos bancarios para el pago.">
        {data === null ? <Vacio>Cargando…</Vacio> : cuentas.length === 0 ? <Vacio>No hay cuentas de cobro en este mes</Vacio> : (
          <div className="overflow-x-auto border border-linea bg-white">
            <table className="w-full">
              <thead className="border-b border-linea bg-papel">
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
                      </td>
                      <td className={`${TD} tabular-nums`}>{String(c.consecutivo).padStart(3, '0')}<span className="block text-[11px] text-tenue">{fechaLarga(c.fecha)}</span></td>
                      <td className={`${TD} text-[12px]`}>{c.concepto}{c.observacion && c.estado === 'devuelta' && <span className="block text-red-700">{c.observacion}</span>}</td>
                      <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{pesos(c.valor)}</td>
                      <td className={`${TD} whitespace-nowrap`}><MarcaEstado color={ESTADO_CUENTA[c.estado].color}>{ESTADO_CUENTA[c.estado].nombre}</MarcaEstado></td>
                      <td className={`${TD} whitespace-nowrap text-right`}>
                        <button type="button" className={b} onClick={async () => descargarBlob(await pdfCuentaCobro(c), nombreArchivoCuenta(c))}>PDF</button>
                        {c.soporte_planilla && <button type="button" className={b} onClick={() => abrirFirmadaCuenta(c.id)}>Planilla</button>}
                        {c.estado === 'radicada' && <button type="button" className={b} onClick={() => una(c, 'aprobar')}>Aprobar</button>}
                        {['radicada', 'aprobada'].includes(c.estado) && <button type="button" className={b} onClick={() => una(c, 'devolver')}>Devolver</button>}
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

// ─── Plantillas ───────────────────────────────────────────────────────────────

function Plantillas() {
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
  async function firma(f: File | undefined) {
    if (!f) return
    const url = await achicar(f, 600, 240)
    if (url.length > 190000) { setMsg({ error: 'La imagen de la firma es muy pesada: recórtala.' }); return }
    pon('firmante_firma', url)
  }

  return (
    <div className="max-w-3xl">
      {(!v.nit || !v.firmante_nombre) && <Aviso tono="ambar" className="mb-6">Faltan el NIT y quién firma: sin ellos los certificados y las cuentas de cobro salen incompletos.</Aviso>}
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
      <Seccion titulo="Quién firma los certificados laborales">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre"><input className={CAMPO} value={v.firmante_nombre ?? ''} onChange={(e) => pon('firmante_nombre', e.target.value)} /></Campo>
          <Campo etiqueta="Cargo"><input className={CAMPO} value={v.firmante_cargo ?? ''} onChange={(e) => pon('firmante_cargo', e.target.value)} placeholder="Dirección administrativa y financiera" /></Campo>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <div className="grid h-24 w-64 place-items-center border border-dashed border-taupe bg-white">
            {v.firmante_firma ? <img src={v.firmante_firma} alt="Firma" className="max-h-20 max-w-60 object-contain" /> : <span className="text-[11px] text-tenue">Sin firma</span>}
          </div>
          <input type="file" accept="image/png,image/jpeg" className="text-[12px]" onChange={(e) => firma(e.target.files?.[0])} />
        </div>
      </Seccion>
      <Seccion titulo="Pie de las cuentas de cobro" sub="Las declaraciones que hace el contratista al radicar. Van en todas las cuentas nuevas.">
        <textarea className={`${CAMPO} min-h-28`} value={v.texto_cuenta_cobro ?? ''} onChange={(e) => pon('texto_cuenta_cobro', e.target.value)} />
      </Seccion>
      <Boton disabled={ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : 'Guardar'}</Boton>
      <Mensaje error={msg.error} ok={msg.ok} />
    </div>
  )
}
