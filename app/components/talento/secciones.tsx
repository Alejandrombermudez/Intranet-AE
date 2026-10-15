'use client'
/**
 * Las secciones de un expediente de talento humano: documentos, contratos,
 * certificados laborales y cuentas de cobro. Las usan «Mi perfil» (modo
 * 'persona') y la ficha que ve talento humano (modo 'rrhh'). Lo que cambia
 * entre los dos modos son los botones, no la información.
 */
import { useState } from 'react'
import { Download, FileText, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'
import { Aviso, Boton, MarcaEstado, Vacio } from '@/app/components/marca'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { pesosEnLetras } from '@/lib/numero-letras'
import {
  ESTADO_CUENTA, MODALIDAD, MODALIDADES_DE, TIPOS_DOCUMENTO_ARCHIVO, VINCULACION, contratoVigente, fechaLarga, mesDe, pesos,
  type Certificado, type Contrato, type CuentaCobro, type DocumentoPersona, type Persona, type Vinculacion,
} from '@/lib/talento'
import { descargarBlob, nombreArchivoCertificado, nombreArchivoCuenta, pdfCertificadoLaboral, pdfCuentaCobro } from '@/lib/talento-pdf'
import { CAMPO, Campo, Mensaje, ROTULO, TD, TH, Ventana, enviar } from '@/app/intranet/administrativa/comun'

export type Modo = 'persona' | 'rrhh'

async function abrirFirmada(url: string) {
  const r = await fetchConSesion(url)
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.url) { alert(j.error ?? 'No se pudo abrir el archivo.'); return }
  window.open(j.url, '_blank', 'noopener')
}

const hoy = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }

// ─── Documentos ───────────────────────────────────────────────────────────────

export function SeccionDocumentos({ documentos, personaId, modo, onCambio }: {
  documentos: DocumentoPersona[]; personaId: string; modo: Modo; onCambio: () => void
}) {
  const [tipo, setTipo] = useState('documento_identidad')
  const [error, setError] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  async function subir(f: File | undefined) {
    if (!f) return
    setSubiendo(true); setError(null)
    const form = new FormData()
    form.append('tipo', tipo); form.append('archivo', f)
    if (modo === 'rrhh') form.append('persona_id', personaId)
    const r = await fetchConSesion('/api/talento/documentos', { method: 'POST', body: form })
    const j = await r.json().catch(() => ({}))
    setSubiendo(false)
    if (!r.ok) { setError(j.error ?? 'No se pudo subir.'); return }
    onCambio()
  }
  async function borrar(d: DocumentoPersona) {
    if (!confirm(`¿Borrar «${d.nombre}»?`)) return
    const r = await fetchConSesion(`/api/talento/documentos/${d.id}`, { method: 'DELETE' })
    if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.error ?? 'No se pudo borrar.'); return }
    onCambio()
  }
  const faltan = ['documento_identidad', 'rut', 'certificacion_bancaria'].filter((t) => !documentos.some((d) => d.tipo === t))

  return (
    <div>
      {faltan.length > 0 && (
        <Aviso tono="ambar" className="mb-6">
          Falta subir: {faltan.map((t) => TIPOS_DOCUMENTO_ARCHIVO[t].toLowerCase()).join(', ')}.
        </Aviso>
      )}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Qué documento es" className="w-72">
          <select className={CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(TIPOS_DOCUMENTO_ARCHIVO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </Campo>
        <label className="inline-flex cursor-pointer items-center gap-2 bg-bosque px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-[.16em] text-papel hover:bg-primary-dark">
          <Upload size={13} /> {subiendo ? 'Subiendo…' : 'Subir PDF o foto'}
          <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" disabled={subiendo}
            onChange={(e) => { subir(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      </div>
      <Mensaje error={error} />
      {documentos.length === 0 ? <Vacio>Todavía no hay documentos</Vacio> : (
        <div className="border border-linea bg-white">
          {documentos.map((d) => (
            <div key={d.id} className="flex items-center gap-4 border-b border-fina px-4 py-3 last:border-0">
              <FileText size={16} className="shrink-0 text-tenue" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-tinta">{TIPOS_DOCUMENTO_ARCHIVO[d.tipo] ?? d.tipo}</p>
                <p className="truncate text-[11px] text-tenue">{d.nombre} · {fechaLarga(d.created_at)}{modo === 'rrhh' && d.subido_por ? ` · ${d.subido_por}` : ''}</p>
              </div>
              <Boton variante="fantasma" icono={<Download size={13} />} onClick={() => abrirFirmada(`/api/talento/documentos/${d.id}`)}>Ver</Boton>
              <button type="button" title="Borrar" className="text-tenue hover:text-red-700" onClick={() => borrar(d)}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Contratos ────────────────────────────────────────────────────────────────

export function SeccionContratos({ contratos, personaId, modo, proyectos, onCambio }: {
  contratos: Contrato[]; personaId: string; modo: Modo; proyectos: { codigo: string; nombre: string }[]; onCambio: () => void
}) {
  const [editando, setEditando] = useState<Partial<Contrato> | null>(null)
  const nombreProyecto = (c: string | null) => proyectos.find((p) => p.codigo === c)?.nombre ?? null
  return (
    <div>
      {modo === 'rrhh' && (
        <div className="mb-6"><Boton icono={<Plus size={13} />} onClick={() => setEditando({ vinculacion: 'contratista', fecha_inicio: hoy() })}>Registrar contrato</Boton></div>
      )}
      {contratos.length === 0 ? (
        <Vacio>{modo === 'persona' ? 'Talento humano todavía no ha cargado tus contratos' : 'Sin contratos'}</Vacio>
      ) : (
        <div className="space-y-4">
          {contratos.map((c) => (
            <article key={c.id} className={`border border-linea bg-white px-5 py-4 ${c.estado === 'anulado' ? 'opacity-50' : ''}`}>
              <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[.16em] text-tenue">{VINCULACION[c.vinculacion]}{c.modalidad ? ` · ${MODALIDAD[c.modalidad]}` : ''}</p>
                  <h4 className="font-display text-lg font-semibold text-tinta">{c.cargo}</h4>
                  <p className="text-[12.5px] text-suave">
                    {fechaLarga(c.fecha_inicio)} — {c.fecha_fin ? fechaLarga(c.fecha_fin) : 'indefinido'}
                    {c.numero ? ` · N.º ${c.numero}` : ''}{nombreProyecto(c.proyecto) ? ` · ${nombreProyecto(c.proyecto)}` : ''}
                  </p>
                  {c.objeto && <p className="mt-2 max-w-[80ch] text-[12.5px] font-light leading-relaxed text-suave">{c.objeto}</p>}
                </div>
                <div className="text-right">
                  <MarcaEstado color={c.estado === 'vigente' ? 'var(--color-bosque)' : 'var(--color-tenue)'}>
                    {c.estado === 'vigente' ? 'Vigente' : c.estado === 'terminado' ? `Terminado ${c.fecha_terminacion ? fechaLarga(c.fecha_terminacion) : ''}` : 'Anulado'}
                  </MarcaEstado>
                  {c.valor_mensual != null && <p className="mt-1 font-display text-lg tabular-nums text-tinta">{pesos(c.valor_mensual)}<span className="text-[11px] text-tenue"> /mes</span></p>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {c.archivo
                  ? <Boton variante="secundario" icono={<Download size={13} />} onClick={() => abrirFirmada(`/api/talento/contratos/${c.id}`)}>Contrato firmado</Boton>
                  : <span className="text-[11.5px] text-tenue">Sin el PDF firmado.</span>}
                {modo === 'rrhh' && <Boton variante="fantasma" icono={<Pencil size={13} />} onClick={() => setEditando(c)}>Editar</Boton>}
              </div>
            </article>
          ))}
        </div>
      )}
      {editando && <EditarContrato inicial={editando} personaId={personaId} proyectos={proyectos} onCerrar={() => setEditando(null)} onListo={onCambio} />}
    </div>
  )
}

function EditarContrato({ inicial, personaId, proyectos, onCerrar, onListo }: {
  inicial: Partial<Contrato>; personaId: string; proyectos: { codigo: string; nombre: string }[]; onCerrar: () => void; onListo: () => void
}) {
  const [v, setV] = useState<Record<string, unknown>>({ ...inicial, modalidad: inicial.modalidad ?? MODALIDADES_DE[(inicial.vinculacion ?? 'contratista') as Vinculacion][0] })
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const vin = (v.vinculacion as Vinculacion) ?? 'contratista'
  const pon = (k: string, x: unknown) => setV((o) => ({ ...o, [k]: x }))

  async function guardar(extra: Record<string, unknown> = {}) {
    setOcupado(true); setError(null)
    const form = new FormData()
    const campos = ['vinculacion', 'modalidad', 'numero', 'cargo', 'objeto', 'proyecto', 'fecha_inicio', 'fecha_fin', 'valor_mensual', 'valor_total', 'supervisor', 'notas']
    const datos: Record<string, unknown> = Object.fromEntries(campos.map((k) => [k, v[k] ?? null]))
    form.append('datos', JSON.stringify({ ...datos, ...(inicial.id ? {} : { persona_id: personaId }), ...extra }))
    if (archivo) form.append('archivo', archivo)
    const r = await fetchConSesion(inicial.id ? `/api/talento/contratos/${inicial.id}` : '/api/talento/contratos', { method: inicial.id ? 'PATCH' : 'POST', body: form })
    const j = await r.json().catch(() => ({}))
    setOcupado(false)
    if (!r.ok) { setError(j.error ?? 'No se pudo guardar.'); return }
    if (j.aviso) alert(j.aviso)
    onListo(); onCerrar()
  }
  async function terminar() {
    const fecha = prompt('Fecha de terminación (AAAA-MM-DD):', hoy()); if (!fecha) return
    const motivo = prompt('Motivo de la terminación:', 'Terminación del plazo') ?? ''
    await guardar({ estado: 'terminado', fecha_terminacion: fecha, motivo_terminacion: motivo })
  }

  return (
    <Ventana titulo={inicial.id ? 'Editar contrato' : 'Registrar contrato'} onCerrar={onCerrar} ancho="max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Vinculación">
          <select className={CAMPO} value={vin} onChange={(e) => { const x = e.target.value as Vinculacion; pon('vinculacion', x); pon('modalidad', MODALIDADES_DE[x][0]) }}>
            {(Object.keys(VINCULACION) as Vinculacion[]).map((k) => <option key={k} value={k}>{VINCULACION[k]}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Modalidad">
          <select className={CAMPO} value={(v.modalidad as string) ?? ''} onChange={(e) => pon('modalidad', e.target.value)}>
            {MODALIDADES_DE[vin].map((m) => <option key={m} value={m}>{MODALIDAD[m]}</option>)}
          </select>
        </Campo>
        <Campo etiqueta={vin === 'contratista' ? 'Rol' : 'Cargo'}><input className={CAMPO} value={(v.cargo as string) ?? ''} onChange={(e) => pon('cargo', e.target.value)} /></Campo>
        <Campo etiqueta="Número del contrato"><input className={CAMPO} value={(v.numero as string) ?? ''} onChange={(e) => pon('numero', e.target.value)} /></Campo>
        <Campo etiqueta="Fecha de inicio"><input type="date" className={CAMPO} value={(v.fecha_inicio as string) ?? ''} onChange={(e) => pon('fecha_inicio', e.target.value)} /></Campo>
        <Campo etiqueta="Fecha de fin (vacía = indefinido)"><input type="date" className={CAMPO} value={(v.fecha_fin as string) ?? ''} onChange={(e) => pon('fecha_fin', e.target.value || null)} /></Campo>
        <Campo etiqueta={vin === 'contratista' ? 'Honorarios mensuales (COP)' : 'Salario mensual (COP)'}>
          <input type="number" min="0" step="1000" className={CAMPO} value={(v.valor_mensual as number) ?? ''} onChange={(e) => pon('valor_mensual', e.target.value === '' ? null : Number(e.target.value))} />
        </Campo>
        <Campo etiqueta="Valor total del contrato (COP)">
          <input type="number" min="0" step="1000" className={CAMPO} value={(v.valor_total as number) ?? ''} onChange={(e) => pon('valor_total', e.target.value === '' ? null : Number(e.target.value))} />
        </Campo>
        <Campo etiqueta="Proyecto">
          <select className={CAMPO} value={(v.proyecto as string) ?? ''} onChange={(e) => pon('proyecto', e.target.value || null)}>
            <option value="">— General —</option>
            {proyectos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Supervisor(a)"><input className={CAMPO} value={(v.supervisor as string) ?? ''} onChange={(e) => pon('supervisor', e.target.value)} placeholder="Quién recibe el trabajo" /></Campo>
        {vin === 'contratista' && (
          <Campo etiqueta="Objeto del contrato" className="sm:col-span-2">
            <textarea className={`${CAMPO} min-h-20`} value={(v.objeto as string) ?? ''} onChange={(e) => pon('objeto', e.target.value)} />
          </Campo>
        )}
        <Campo etiqueta="Notas" className="sm:col-span-2"><input className={CAMPO} value={(v.notas as string) ?? ''} onChange={(e) => pon('notas', e.target.value)} /></Campo>
        <Campo etiqueta={inicial.archivo ? 'Reemplazar el PDF firmado' : 'PDF firmado'} className="sm:col-span-2">
          <input type="file" accept="application/pdf,image/jpeg,image/png" className="text-[12px]" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
        </Campo>
      </div>
      {typeof v.valor_mensual === 'number' && v.valor_mensual > 0 && <p className="mt-3 text-[11.5px] text-tenue">{pesosEnLetras(v.valor_mensual)}</p>}
      <Mensaje error={error} />
      <div className="mt-5 flex flex-wrap gap-2">
        <Boton disabled={ocupado} onClick={() => guardar()}>{ocupado ? 'Guardando…' : 'Guardar'}</Boton>
        {inicial.id && inicial.estado === 'vigente' && <Boton variante="secundario" disabled={ocupado} onClick={terminar}>Terminar contrato</Boton>}
        {inicial.id && inicial.estado !== 'anulado' && (
          <Boton variante="peligro" disabled={ocupado} onClick={() => { if (confirm('¿Anular este contrato? Se registró por error.')) guardar({ estado: 'anulado' }) }}>Anular</Boton>
        )}
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}

// ─── Certificados laborales ───────────────────────────────────────────────────

export function SeccionCertificados({ certificados, personaId, modo, hayContratos, onCambio }: {
  certificados: Certificado[]; personaId: string; modo: Modo; hayContratos: boolean; onCambio: () => void
}) {
  const [salario, setSalario] = useState(false)
  const [dirigido, setDirigido] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function expedir() {
    setOcupado(true); setError(null)
    try {
      const j = await enviar<{ certificado: Certificado }>('/api/talento/certificados', 'POST', {
        incluye_salario: salario, dirigido_a: dirigido, ...(modo === 'rrhh' ? { persona_id: personaId } : {}),
      })
      descargarBlob(await pdfCertificadoLaboral(j.certificado), nombreArchivoCertificado(j.certificado.datos, j.certificado.codigo))
      setDirigido(''); onCambio()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }
  async function volverADescargar(c: Certificado) {
    descargarBlob(await pdfCertificadoLaboral(c), nombreArchivoCertificado(c.datos, c.codigo))
  }

  return (
    <div>
      {!hayContratos ? (
        <Aviso tono="ambar" className="mb-6">Para expedir un certificado laboral, talento humano tiene que cargar primero {modo === 'persona' ? 'tu contrato' : 'el contrato'}.</Aviso>
      ) : (
        <div className="mb-8 border border-linea bg-white px-5 py-5">
          <p className="mb-4 text-[12.5px] text-suave">El certificado sale con los datos de la ficha y los contratos, la firma de quien firma por la organización y un código de verificación.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Dirigido a (opcional)"><input className={CAMPO} value={dirigido} onChange={(e) => setDirigido(e.target.value)} placeholder="A quien interese" /></Campo>
            <label className="flex items-center gap-2 pt-6 text-[12.5px] text-suave">
              <input type="checkbox" checked={salario} onChange={(e) => setSalario(e.target.checked)} /> Incluir el salario u honorarios
            </label>
          </div>
          <div className="mt-4"><Boton disabled={ocupado} icono={<FileText size={13} />} onClick={expedir}>{ocupado ? 'Generando…' : 'Generar certificado'}</Boton></div>
          <Mensaje error={error} />
        </div>
      )}
      {certificados.length > 0 && (
        <>
          <p className={ROTULO}>Expedidos</p>
          <div className="border border-linea bg-white">
            {certificados.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-4 border-b border-fina px-4 py-3 last:border-0">
                <span className="font-mono text-[12px] text-tinta">{c.codigo}</span>
                <span className="text-[12px] text-suave">{fechaLarga(c.created_at)}{c.dirigido_a ? ` · para ${c.dirigido_a}` : ''}{c.incluye_salario ? ' · con salario' : ''}</span>
                {modo === 'rrhh' && <span className="text-[11px] text-tenue">{c.generado_por}</span>}
                <Boton variante="fantasma" className="ml-auto" icono={<Download size={13} />} onClick={() => volverADescargar(c)}>PDF</Boton>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Cuentas de cobro ─────────────────────────────────────────────────────────

export function SeccionCuentas({ cuentas, contratos, persona, modo, onCambio }: {
  cuentas: CuentaCobro[]; contratos: Contrato[]; persona: Persona; modo: Modo; onCambio: () => void
}) {
  const vigente = contratoVigente(contratos.filter((c) => c.vinculacion === 'contratista'))
  const [nueva, setNueva] = useState<CuentaCobro | 'nueva' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function accion(c: CuentaCobro, a: string) {
    setError(null)
    let observacion: string | null = null
    if (['devolver', 'anular'].includes(a)) {
      observacion = prompt(a === 'devolver' ? '¿Qué hay que corregir? (lo ve la persona)' : '¿Por qué se anula?')
      if (!observacion?.trim()) return
    }
    try { await enviar(`/api/talento/cuentas/${c.id}`, 'PATCH', { accion: a, observacion }); onCambio() }
    catch (e) { setError((e as Error).message) }
  }

  return (
    <div>
      {modo === 'persona' && (
        vigente ? (
          <div className="mb-8 flex flex-wrap items-center gap-4 border border-linea bg-white px-5 py-4">
            <div className="min-w-0 flex-1 text-[12.5px] text-suave">
              Contrato {vigente.numero ? `N.º ${vigente.numero}` : 'vigente'} · {vigente.cargo}
              {vigente.valor_mensual ? <> · honorarios de <b className="text-tinta">{pesos(vigente.valor_mensual)}</b> al mes</> : null}
            </div>
            <Boton icono={<Plus size={13} />} onClick={() => setNueva('nueva')}>Nueva cuenta de cobro</Boton>
          </div>
        ) : (
          <Aviso tono="pizarra" className="mb-8">
            Las cuentas de cobro son para quien tiene un contrato de prestación de servicios vigente. Si eres contratista y no
            ves tu contrato en la pestaña Contratos, escríbele a talento humano.
          </Aviso>
        )
      )}
      <Mensaje error={error} />
      {cuentas.length === 0 ? <Vacio>Todavía no hay cuentas de cobro</Vacio> : (
        <div className="overflow-x-auto border border-linea bg-white">
          <table className="w-full">
            <thead className="border-b border-linea bg-papel">
              <tr><th className={TH}>N.º</th><th className={TH}>Fecha</th><th className={TH}>Concepto</th><th className={`${TH} text-right`}>Valor</th><th className={TH}>Estado</th><th className={TH}></th></tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.id} className={`border-b border-fina ${c.estado === 'anulada' ? 'opacity-50' : ''}`}>
                  <td className={`${TD} tabular-nums`}>{String(c.consecutivo).padStart(3, '0')}</td>
                  <td className={`${TD} whitespace-nowrap`}>{fechaLarga(c.fecha)}</td>
                  <td className={TD}>{c.concepto}
                    {c.periodo_desde && <span className="block text-[11px] text-tenue">Periodo {fechaLarga(c.periodo_desde)} – {fechaLarga(c.periodo_hasta)}</span>}
                    {c.observacion && ['devuelta', 'anulada'].includes(c.estado) && <span className="block text-[11.5px] text-red-700">{c.observacion}</span>}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{pesos(c.valor)}</td>
                  <td className={`${TD} whitespace-nowrap`}><MarcaEstado color={ESTADO_CUENTA[c.estado].color}>{ESTADO_CUENTA[c.estado].nombre}</MarcaEstado>
                    {c.estado === 'pagada' && c.pagada_at && <span className="block text-[11px] text-tenue">{fechaLarga(c.pagada_at)}</span>}
                  </td>
                  <td className={`${TD} whitespace-nowrap text-right`}>
                    <BotonesCuenta c={c} modo={modo} onAccion={(a) => accion(c, a)} onCorregir={() => setNueva(c)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nueva && vigente && (
        <NuevaCuenta contrato={vigente} persona={persona} corregir={nueva === 'nueva' ? null : nueva}
          onCerrar={() => setNueva(null)} onListo={onCambio} />
      )}
    </div>
  )
}

function BotonesCuenta({ c, modo, onAccion, onCorregir }: { c: CuentaCobro; modo: Modo; onAccion: (a: string) => void; onCorregir: () => void }) {
  const b = 'ml-3 text-[10.5px] uppercase tracking-[.14em] text-tenue hover:text-tinta'
  return (
    <>
      <button type="button" className={b} onClick={async () => descargarBlob(await pdfCuentaCobro(c), nombreArchivoCuenta(c))}>PDF</button>
      {c.soporte_planilla && <button type="button" className={b} onClick={() => abrirFirmadaCuenta(c.id)}>Planilla</button>}
      {modo === 'persona' && c.estado === 'devuelta' && <button type="button" className={b} onClick={onCorregir}>Corregir</button>}
      {modo === 'persona' && ['radicada', 'devuelta'].includes(c.estado) && <button type="button" className={b} onClick={() => { if (confirm('¿Anular esta cuenta de cobro?')) onAccion('anular') }}>Anular</button>}
      {modo === 'rrhh' && c.estado === 'radicada' && <button type="button" className={b} onClick={() => onAccion('aprobar')}>Aprobar</button>}
      {modo === 'rrhh' && ['radicada', 'aprobada'].includes(c.estado) && <button type="button" className={b} onClick={() => onAccion('devolver')}>Devolver</button>}
      {modo === 'rrhh' && c.estado === 'aprobada' && <button type="button" className={b} onClick={() => onAccion('pagar')}>Pagada</button>}
    </>
  )
}

export async function abrirFirmadaCuenta(id: string) {
  const r = await fetchConSesion(`/api/talento/cuentas/${id}`)
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.url_planilla) { alert(j.error ?? 'No se pudo abrir la planilla.'); return }
  window.open(j.url_planilla, '_blank', 'noopener')
}

/**
 * La cuenta de cobro nueva: solo pide el concepto y el valor (por defecto los
 * honorarios del contrato) y el periodo (por defecto el mes en curso). Lo demás
 * —número, fecha, nombre, documento, cuenta bancaria— lo pone el sistema.
 */
function NuevaCuenta({ contrato, persona, corregir, onCerrar, onListo }: {
  contrato: Contrato; persona: Persona; corregir: CuentaCobro | null; onCerrar: () => void; onListo: () => void
}) {
  const mes = mesDe(hoy())
  const nombreMes = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  const [concepto, setConcepto] = useState(corregir?.concepto ?? `Honorarios por la prestación de servicios del mes de ${nombreMes}`)
  const [valor, setValor] = useState<string>(String(corregir?.valor ?? contrato.valor_mensual ?? ''))
  const [desde, setDesde] = useState(corregir?.periodo_desde ?? mes.desde)
  const [hasta, setHasta] = useState(corregir?.periodo_hasta ?? mes.hasta)
  const [planilla, setPlanilla] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const faltaFicha = !persona.numero_documento || !persona.banco || !persona.numero_cuenta || !persona.nombres || !persona.apellidos
  const n = Number(valor)

  async function radicar() {
    setOcupado(true); setError(null)
    try {
      if (corregir) {
        await enviar(`/api/talento/cuentas/${corregir.id}`, 'PATCH', { accion: 'corregir', concepto, valor: n, periodo_desde: desde, periodo_hasta: hasta })
      } else {
        const form = new FormData()
        form.append('datos', JSON.stringify({ contrato_id: contrato.id, concepto, valor: n, periodo_desde: desde, periodo_hasta: hasta }))
        if (planilla) form.append('planilla', planilla)
        const r = await fetchConSesion('/api/talento/cuentas', { method: 'POST', body: form })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error ?? 'No se pudo radicar.')
        descargarBlob(await pdfCuentaCobro(j.cuenta), nombreArchivoCuenta(j.cuenta))
      }
      onListo(); onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo={corregir ? `Corregir la cuenta N.º ${String(corregir.consecutivo).padStart(3, '0')}` : 'Nueva cuenta de cobro'} onCerrar={onCerrar}>
      {faltaFicha && (
        <Aviso tono="arcilla" className="mb-5">Antes de pasar la cuenta completa en «Mis datos» tus nombres, apellidos, número de documento, banco y número de cuenta: son los que van en la cuenta.</Aviso>
      )}
      {corregir?.observacion && <Aviso tono="ambar" titulo="Lo que pidió talento humano" className="mb-5">{corregir.observacion}</Aviso>}
      <div className="grid gap-4">
        <Campo etiqueta="Concepto"><textarea className={`${CAMPO} min-h-20`} value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Campo>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo etiqueta="Valor (COP)"><input type="number" min="0" step="1000" className={CAMPO} value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
          <Campo etiqueta="Periodo desde"><input type="date" className={CAMPO} value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
          <Campo etiqueta="Periodo hasta"><input type="date" className={CAMPO} value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
        </div>
        {n > 0 && <p className="-mt-2 text-[11.5px] text-tenue">{pesosEnLetras(n)}</p>}
        {!corregir && (
          <Campo etiqueta="Planilla de seguridad social del periodo (PDF, opcional)">
            <input type="file" accept="application/pdf,image/jpeg,image/png" className="text-[12px]" onChange={(e) => setPlanilla(e.target.files?.[0] ?? null)} />
          </Campo>
        )}
        <p className="text-[11.5px] text-tenue">
          Se cobra a nombre de {persona.nombres} {persona.apellidos} y se paga en la cuenta {persona.tipo_cuenta ?? ''} {persona.numero_cuenta ?? '—'} de {persona.banco ?? '—'}.
          El número de la cuenta de cobro y la fecha los pone el sistema.
        </p>
      </div>
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || faltaFicha || !concepto.trim() || !(n > 0)} onClick={radicar}>
          {ocupado ? 'Enviando…' : corregir ? 'Enviar corregida' : 'Radicar y descargar PDF'}
        </Boton>
        <Boton variante="fantasma" icono={<X size={13} />} onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}
