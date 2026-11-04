'use client'
import { useRef, useState } from 'react'
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText, Lock, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { Aviso, Boton, MarcaEstado, Seccion, Vacio } from '@/app/components/marca'
import { esBodegaFisica, fechaCorta, hoyISO } from '@/lib/administrativa'
import {
  CLASES, ESTADOS, MOTIVOS, TIPOS_ACTA, etiquetaActa, nombreTrabajador, normalizarFila, num, pendientes,
  type Acta, type EstadoConciliacion, type FilaConciliacion, type Motivo, type Salida, type TipoActa, type Trabajador,
} from '@/lib/salidas'
import { aligerarDocumento } from '@/lib/comprimir-pdf'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { descargarBlob } from '@/lib/talento-pdf'
import { nombreArchivoActa, pdfActa, type OrganizacionActa } from '@/lib/acta-pdf'
import { libroConciliacion, nombreArchivoConciliacion } from '@/lib/salidas-excel'
import { CAMPO, Campo, enviar, Mensaje, Saldo, TD, TH, useCarga, Ventana, type Catalogo } from './comun'

/**
 * LA FICHA DE UNA SALIDA — conciliación en vivo, actas y cierre.
 *
 * La tabla es la hoja de conciliación de Administrativa, calculada por la base
 * (inventario.v_conciliacion_salida). «Diferencia» es lo que sigue sin explicar:
 * cada fila se cierra con una devolución contada o con una justificación de lista.
 */
interface Detalle {
  salida: Salida
  conciliacion: FilaConciliacion[]
  actas: Acta[]
  en_camino: { id: string; insumo_id: string; cantidad: number; destino_id: string; acta_id: string | null; fecha: string }[]
  a_cargo: { trabajador_id: string; nombre: string; items: { insumo_id: string; motivo: string; cantidad: number }[] }[]
  organizacion: OrganizacionActa
}

const TONO: Record<'bien' | 'aviso' | 'mal' | 'neutro', string> = {
  bien: 'var(--color-bosque)', aviso: 'var(--color-ambar)', mal: 'var(--color-arcilla, #a4543b)', neutro: 'var(--color-tenue)',
}

export default function FichaSalida({ id, cat, trabajadores, onVolver, onCambio }: {
  id: string; cat: Catalogo; trabajadores: Trabajador[]; onVolver: () => void; onCambio: () => Promise<void>
}) {
  const { data, error, recargar } = useCarga<Detalle | null>(`/api/administrativa/salidas/${id}`, (j) =>
    j.salida ? ({ ...j, conciliacion: ((j.conciliacion as Record<string, unknown>[]) ?? []).map((f) => ({ ...normalizarFila(f), observacion: f.observacion as string | undefined })) } as unknown as Detalle) : null,
    'No se pudo leer la salida.')
  const [modal, setModal] = useState<
    | { k: 'acta'; tipo: TipoActa } | { k: 'recibir'; mov: Detalle['en_camino'][number] }
    | { k: 'justificar'; fila: FilaConciliacion } | { k: 'cerrar' } | { k: 'editar' } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const actaASubir = useRef<Acta | null>(null)

  if (!data) {
    return (
      <>
        <Boton variante="fantasma" icono={<ArrowLeft size={13} />} onClick={onVolver}>Salidas</Boton>
        {error ? <Aviso tono="arcilla" className="mt-4">{error}</Aviso> : <Vacio>Cargando…</Vacio>}
      </>
    )
  }

  const { salida, conciliacion, actas, en_camino, a_cargo, organizacion } = data
  const abierta = salida.estado === 'abierta'
  const sinExplicar = pendientes(conciliacion)
  const bodega = (b: string | null) => (b ? cat.bodegas.find((x) => x.id === b)?.nombre ?? '—' : '—')
  const insumo = (i: string) => cat.insumos.find((x) => x.id === i)
  const responsable = nombreTrabajador(trabajadores.find((t) => t.id === salida.responsable_id))

  const tras = async () => { await Promise.all([recargar(), onCambio()]) }

  async function descargarActa(a: Acta) {
    descargarBlob(await pdfActa(a, organizacion), nombreArchivoActa(a))
  }

  /** Registra el acta y deja descargado su PDF para imprimirlo y firmarlo. */
  async function tras_acta(numero: string) {
    await tras()
    const r = await fetchConSesion(`/api/administrativa/salidas/${id}`)
    const j = await r.json().catch(() => null)
    const a = (j?.actas as Acta[] | undefined)?.find((x) => x.numero === numero)
    if (a) await descargarActa(a)
    setAviso(`Acta ${numero} registrada. Se descargó el PDF: imprímelo, fírmalo y sube el escaneo.`)
  }

  async function subirFirmada(a: Acta, archivo: File) {
    setSubiendo(a.id); setAviso(null)
    try {
      const form = new FormData()
      form.append('archivo', (await aligerarDocumento(archivo)).archivo)
      const r = await fetchConSesion(`/api/administrativa/salidas/${id}/actas/${a.id}`, { method: 'POST', body: form })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'No se pudo subir el escaneo.')
      await recargar()
      setAviso(`Escaneo firmado del acta ${a.numero} guardado.`)
    } catch (e) { setAviso((e as Error).message) }
    setSubiendo(null)
  }

  async function verFirmada(a: Acta) {
    const r = await fetchConSesion(`/api/administrativa/salidas/${id}/actas/${a.id}`)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setAviso(j.error ?? 'No se pudo abrir el archivo.'); return }
    window.open(j.url, '_blank')
  }

  async function excel() {
    const corte = hoyISO()
    descargarBlob(await libroConciliacion(salida, conciliacion, corte), nombreArchivoConciliacion(salida, corte))
  }

  return (
    <>
      <input ref={entrada} type="file" accept="application/pdf,image/*" className="hidden"
             onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f && actaASubir.current) void subirFirmada(actaASubir.current, f) }} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Boton variante="fantasma" icono={<ArrowLeft size={13} />} onClick={onVolver} className="-ml-4">Salidas</Boton>
          <h2 className="font-titulo text-2xl text-tinta">{salida.nombre}</h2>
          <p className="mt-1 text-[12.5px] text-suave">
            Salió el {fechaCorta(salida.fecha_salida)}{salida.fecha_cierre ? ` · cerrada el ${fechaCorta(salida.fecha_cierre)}` : ''}
            {' · '}Responsable: {salida.responsable_id ? responsable : 'sin definir'}
            {salida.bodega_retorno_id ? ` · vuelve a ${bodega(salida.bodega_retorno_id)}` : ''}
          </p>
          {salida.notas && <p className="mt-1 text-[12px] text-tenue">{salida.notas}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MarcaEstado color={abierta ? 'var(--color-ambar)' : 'var(--color-bosque)'}>{abierta ? 'Abierta' : 'Cerrada'}</MarcaEstado>
          <Boton variante="fantasma" icono={<Pencil size={13} />} onClick={() => setModal({ k: 'editar' })}>Editar</Boton>
          <Boton variante="secundario" icono={<FileSpreadsheet size={13} />} onClick={excel}>Excel de conciliación</Boton>
        </div>
      </div>

      {error && <Aviso tono="arcilla" className="mb-6">{error}</Aviso>}
      {aviso && <Aviso tono="bosque" className="mb-6">{aviso}</Aviso>}

      {abierta && (
        <div className="mb-8 flex flex-wrap gap-2">
          <Boton icono={<Plus size={13} />} onClick={() => setModal({ k: 'acta', tipo: 'entrega' })}>Entrega inicial</Boton>
          <Boton variante="secundario" icono={<Plus size={13} />} onClick={() => setModal({ k: 'acta', tipo: 'adicional' })}>Entrega adicional</Boton>
          <Boton variante="secundario" icono={<Plus size={13} />} onClick={() => setModal({ k: 'acta', tipo: 'devolucion' })}>Devolución</Boton>
          <Boton variante="secundario" icono={<Plus size={13} />} onClick={() => setModal({ k: 'acta', tipo: 'epp' })}>EPP a un trabajador</Boton>
          <Boton variante="fantasma" icono={<Lock size={13} />} onClick={() => setModal({ k: 'cerrar' })} className="ml-auto">Cerrar salida</Boton>
        </div>
      )}

      {en_camino.length > 0 && (
        <Seccion titulo="Devoluciones por contar" sub="Lo que salió de la salida y todavía no se recibe. Quien recibe cuenta: si llega menos, la diferencia vuelve a la salida y hay que explicarla.">
          <div className="vidrio rounded-2xl">
            {en_camino.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-fina px-4 py-3 last:border-0">
                <span className="text-[12px] text-tenue">{fechaCorta(m.fecha)}</span>
                <span className="text-[13px] font-medium text-tinta">{num(m.cantidad)} {insumo(m.insumo_id)?.unidad} de {insumo(m.insumo_id)?.nombre}</span>
                <span className="text-[12.5px] text-suave">→ {bodega(m.destino_id)}</span>
                <span className="ml-auto"><Boton variante="secundario" onClick={() => setModal({ k: 'recibir', mov: m })}>Contar y recibir</Boton></span>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      <Seccion
        titulo="Conciliación"
        sub="Una fila por elemento. «Diferencia» es lo que sigue sin explicar: se cierra devolviéndolo contado o justificándolo."
        acciones={abierta && sinExplicar > 0 ? <span className="text-[12px] font-medium text-red-700">{sinExplicar} sin explicar</span> : undefined}
      >
        {conciliacion.length === 0 ? <Vacio>Todavía no hay movimientos. Registra la entrega inicial.</Vacio> : (
          <div className="overflow-x-auto vidrio rounded-2xl">
            <table className="w-full">
              <thead className="border-b border-linea/70 bg-white/40">
                <tr>
                  <th className={TH}>Elemento</th>
                  <th className={`${TH} text-right`}>Inicial</th><th className={`${TH} text-right`}>Adicional</th><th className={`${TH} text-right`}>Total a cargo</th>
                  <th className={`${TH} text-right`}>Consumido</th><th className={`${TH} text-right`}>Devuelto</th><th className={`${TH} text-right`}>A cargo</th>
                  <th className={`${TH} text-right`}>Justificado</th><th className={`${TH} text-right`}>Diferencia</th><th className={TH}>Estado</th><th className={TH}></th>
                </tr>
              </thead>
              <tbody>
                {conciliacion.map((f) => {
                  const e = ESTADOS[f.estado as EstadoConciliacion]
                  return (
                    <tr key={f.insumo_id} className="border-b border-fina">
                      <td className={TD}>
                        {f.nombre}<span className="ml-1.5 text-[10.5px] text-tenue">{f.unidad} · {CLASES[f.clase]?.nombre}</span>
                        {f.observacion && <span className="block max-w-md text-[11px] text-tenue">{f.observacion}</span>}
                      </td>
                      <td className={`${TD} text-right tabular-nums`}>{num(f.inicial)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{f.adicional ? num(f.adicional) : '—'}</td>
                      <td className={`${TD} text-right font-medium tabular-nums`}>{num(f.total)}</td>
                      <td className={`${TD} text-right tabular-nums`}>{f.consumido_app ? num(f.consumido_app) : '—'}</td>
                      <td className={`${TD} text-right tabular-nums`}>{f.devuelto ? num(f.devuelto) : '—'}{f.por_recibir > 0 && <span className="block text-[10.5px] text-ambar">+{num(f.por_recibir)} por contar</span>}</td>
                      <td className={`${TD} text-right tabular-nums`}>{f.a_cargo ? num(f.a_cargo) : '—'}</td>
                      <td className={`${TD} text-right tabular-nums`}>{f.justificado + f.dotacion + f.sobrante ? num(f.justificado + f.dotacion + f.sobrante) : '—'}</td>
                      <td className={`${TD} text-right`}><Saldo n={f.saldo} fuerte /></td>
                      <td className={TD}><MarcaEstado color={TONO[e.tono]}>{e.texto}</MarcaEstado></td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {abierta && Math.abs(f.saldo) > 0.0001 && f.por_recibir === 0 && (
                          <Boton variante="secundario" onClick={() => setModal({ k: 'justificar', fila: f })}>Justificar</Boton>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Actas" sub="Cada entrega, devolución y entrega de EPP lleva su acta. Se imprime, se firma y se sube el escaneo; hasta entonces queda «sin firma».">
        {actas.length === 0 ? <Vacio>Todavía no hay actas.</Vacio> : (
          <div className="overflow-x-auto vidrio rounded-2xl">
            <table className="w-full">
              <thead className="border-b border-linea/70 bg-white/40">
                <tr><th className={TH}>Acta</th><th className={TH}>Fecha</th><th className={TH}>Elementos</th><th className={TH}>Firma</th><th className={TH}></th></tr>
              </thead>
              <tbody>
                {actas.map((a) => (
                  <tr key={a.id} className="border-b border-fina">
                    <td className={TD}>
                      {etiquetaActa(a)}
                      {a.tipo === 'epp' && a.datos.trabajador && <span className="block text-[11px] text-tenue">{a.datos.trabajador}</span>}
                      {a.tipo !== 'epp' && <span className="block text-[11px] text-tenue">{a.datos.origen} → {a.datos.destino}</span>}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{fechaCorta(a.fecha)}</td>
                    <td className={`${TD} text-[12px] text-suave`}>{a.datos.items.map((i) => `${num(i.cantidad)} ${i.nombre}`).join(' · ')}</td>
                    <td className={TD}>
                      {a.firmada
                        ? <MarcaEstado color="var(--color-bosque)"><CheckCircle2 size={12} className="mr-0.5 inline" /> Firmada</MarcaEstado>
                        : <MarcaEstado color="var(--color-ambar)">Sin firma</MarcaEstado>}
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <button type="button" className="mr-3 text-tenue hover:text-tinta" title="Descargar el acta en PDF" onClick={() => void descargarActa(a)}><FileText size={15} /></button>
                      {a.archivo && <button type="button" className="mr-3 text-tenue hover:text-tinta" title="Ver el escaneo firmado" onClick={() => void verFirmada(a)}><Paperclip size={15} /></button>}
                      <button type="button" disabled={subiendo === a.id} className="text-tenue hover:text-tinta disabled:opacity-40"
                              title={a.archivo ? 'Reemplazar el escaneo' : 'Subir el escaneo firmado'}
                              onClick={() => { actaASubir.current = a; entrada.current?.click() }}>
                        {subiendo === a.id ? <Download size={15} /> : <Upload size={15} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      {a_cargo.length > 0 && (
        <Seccion titulo="A cargo de trabajadores" sub="Lo que esta salida dejó a nombre de cada uno. Para el estado actual de cada trabajador, mira la pestaña Trabajadores.">
          <div className="grid gap-3 sm:grid-cols-2">
            {a_cargo.map((t) => (
              <div key={t.trabajador_id} className="vidrio rounded-2xl p-4">
                <p className="text-[13px] font-medium text-tinta">{t.nombre}</p>
                <ul className="mt-1.5 space-y-0.5 text-[12px] text-suave">
                  {t.items.map((i) => (
                    <li key={i.insumo_id + i.motivo}>
                      <span className="tabular-nums">{num(i.cantidad)}</span> {insumo(i.insumo_id)?.unidad} · {insumo(i.insumo_id)?.nombre}
                      <span className="ml-1.5 text-[10.5px] text-tenue">{i.motivo === 'dotacion' ? 'dotación' : 'debe devolverlo'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      {modal?.k === 'acta' && (
        <ModalActa tipo={modal.tipo} salida={salida} cat={cat} filas={conciliacion} trabajadores={trabajadores}
                   onCerrar={() => setModal(null)} onListo={tras_acta} />
      )}
      {modal?.k === 'recibir' && (
        <ModalRecibir mov={modal.mov} salidaId={id} insumoNombre={insumo(modal.mov.insumo_id)?.nombre ?? ''} unidad={insumo(modal.mov.insumo_id)?.unidad ?? ''}
                      onCerrar={() => setModal(null)} onListo={tras} />
      )}
      {modal?.k === 'justificar' && (
        <ModalJustificar fila={modal.fila} salidaId={id} trabajadores={trabajadores} onCerrar={() => setModal(null)} onListo={tras} />
      )}
      {modal?.k === 'editar' && (
        <ModalEditar salida={salida} cat={cat} trabajadores={trabajadores} onCerrar={() => setModal(null)} onListo={tras} />
      )}
      {modal?.k === 'cerrar' && (
        <ModalCerrar salidaId={id} sinExplicar={sinExplicar} enCamino={en_camino.length}
                     sinFirma={actas.filter((a) => !a.firmada).length} onCerrar={() => setModal(null)} onListo={tras} />
      )}
    </>
  )
}

// ─── Acta nueva ───────────────────────────────────────────────────────────────

function ModalActa({ tipo, salida, cat, filas, trabajadores, onCerrar, onListo }: {
  tipo: TipoActa; salida: Salida; cat: Catalogo; filas: FilaConciliacion[]; trabajadores: Trabajador[]
  onCerrar: () => void; onListo: (numero: string) => Promise<void>
}) {
  const t = TIPOS_ACTA[tipo]
  const fisicas = cat.bodegas.filter((b) => b.activo && esBodegaFisica(b.tipo))
  const central = fisicas.find((b) => b.tipo === 'central')
  const [otra, setOtra] = useState(tipo === 'devolucion' ? salida.bodega_retorno_id ?? '' : central?.id ?? '')
  const [trab, setTrab] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [notas, setNotas] = useState('')
  const [recibido, setRecibido] = useState(false)
  // Una devolución sale ya con lo que sigue en el saldo de la salida.
  const [items, setItems] = useState<{ insumo_id: string; cantidad: string }[]>(
    tipo === 'devolucion'
      ? filas.filter((f) => f.saldo > 0.0001 && f.clase !== 'dotacion').map((f) => ({ insumo_id: f.insumo_id, cantidad: String(f.saldo) }))
      : [{ insumo_id: '', cantidad: '' }],
  )
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const saldoEn = (b: string, i: string) => Number(cat.existencias.find((e) => e.bodega_id === b && e.insumo_id === i)?.saldo ?? 0)
  const elegibles = cat.insumos.filter((i) => i.activo && (tipo !== 'epp' || i.clase !== 'consumible'))
  const esDevolucion = tipo === 'devolucion'

  async function guardar() {
    setOcupado(true); setError(null)
    try {
      const r = await enviar<{ numero: string }>(`/api/administrativa/salidas/${salida.id}`, 'POST', {
        accion: 'acta', tipo, fecha, bodega_otra_id: otra || null, trabajador_id: trab || null, notas, recibido,
        items: items.filter((i) => i.insumo_id && Number(i.cantidad) > 0).map((i) => ({ insumo_id: i.insumo_id, cantidad: Number(i.cantidad) })),
      })
      onCerrar()
      await onListo(r.numero)
    } catch (e) { setError((e as Error).message); setOcupado(false) }
  }

  return (
    <Ventana titulo={t.nombre} onCerrar={onCerrar} ancho="max-w-3xl">
      <p className="mb-4 text-[12.5px] text-suave">{t.que}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {tipo === 'epp' ? (
          <Campo etiqueta="Trabajador que recibe y firma" className="sm:col-span-2">
            <select className={CAMPO} value={trab} onChange={(e) => setTrab(e.target.value)}>
              <option value="">— Elige —</option>
              {trabajadores.map((x) => <option key={x.id} value={x.id}>{nombreTrabajador(x)}</option>)}
            </select>
            {trabajadores.length === 0 && <span className="mt-1 block text-[11px] text-red-700">Primero agrégalo en la pestaña Trabajadores.</span>}
          </Campo>
        ) : (
          <Campo etiqueta={esDevolucion ? 'Vuelve a' : 'Sale de'} className="sm:col-span-2">
            <select className={CAMPO} value={otra} onChange={(e) => setOtra(e.target.value)}>
              <option value="">— Elige —</option>
              {fisicas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </Campo>
        )}
        <Campo etiqueta="Fecha del acta"><input type="date" className={CAMPO} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
      </div>

      <p className="mb-2 mt-5 text-[10px] uppercase tracking-[.16em] text-tenue">Elementos</p>
      {items.map((it, k) => {
        const ins = cat.insumos.find((i) => i.id === it.insumo_id)
        const disp = !esDevolucion && tipo !== 'epp' && otra && it.insumo_id ? saldoEn(otra, it.insumo_id) : null
        const enSalida = filas.find((f) => f.insumo_id === it.insumo_id)?.saldo
        return (
          <div key={k} className="mb-2 grid grid-cols-[1fr_8rem_2rem] items-start gap-2">
            <div>
              <select className={CAMPO} value={it.insumo_id} onChange={(e) => setItems(items.map((x, j) => j === k ? { ...x, insumo_id: e.target.value } : x))}>
                <option value="">— Elemento —</option>
                {elegibles.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({CLASES[i.clase ?? 'consumible'].nombre.toLowerCase()})</option>)}
              </select>
              {disp !== null && Number(it.cantidad) > disp && (
                <p className="mt-1 text-[11px] text-red-700">En esa bodega hay {num(disp)} {ins?.unidad}: el saldo quedará en negativo.</p>
              )}
              {(esDevolucion || tipo === 'epp') && enSalida != null && Number(it.cantidad) > enSalida && (
                <p className="mt-1 text-[11px] text-red-700">En la salida hay {num(enSalida)} {ins?.unidad}.</p>
              )}
            </div>
            <input className={CAMPO} type="number" min="0" step="any" placeholder={ins?.unidad ?? 'Cantidad'} value={it.cantidad}
                   onChange={(e) => setItems(items.map((x, j) => j === k ? { ...x, cantidad: e.target.value } : x))} />
            <button type="button" className="py-2 text-tenue hover:text-red-700" title="Quitar" onClick={() => setItems(items.filter((_, j) => j !== k))}><Trash2 size={15} /></button>
          </div>
        )
      })}
      <Boton variante="fantasma" icono={<Plus size={13} />} onClick={() => setItems([...items, { insumo_id: '', cantidad: '' }])}>Otro elemento</Boton>

      <Campo etiqueta="Observaciones" className="mt-4">
        <input className={CAMPO} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Quién lo lleva, a qué predio…" />
      </Campo>
      {esDevolucion && (
        <label className="mt-4 flex items-start gap-2 text-[12.5px] text-suave">
          <input type="checkbox" className="mt-0.5" checked={recibido} onChange={(e) => setRecibido(e.target.checked)} />
          <span>Ya se contó al recibirla: entra de una vez. Si no, queda «por contar» hasta que quien recibe confirme la cantidad.</span>
        </label>
      )}
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || !fecha || (tipo === 'epp' ? !trab : !otra) || !items.some((i) => i.insumo_id && Number(i.cantidad) > 0)} onClick={guardar}>
          Registrar y descargar el acta
        </Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}

// ─── Contar una devolución ────────────────────────────────────────────────────

function ModalRecibir({ mov, salidaId, insumoNombre, unidad, onCerrar, onListo }: {
  mov: Detalle['en_camino'][number]; salidaId: string; insumoNombre: string; unidad: string
  onCerrar: () => void; onListo: () => Promise<void>
}) {
  const [contado, setContado] = useState(String(mov.cantidad))
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const menos = Number(contado) < mov.cantidad

  async function guardar() {
    setOcupado(true); setError(null)
    try {
      await enviar(`/api/administrativa/salidas/${salidaId}`, 'POST', { accion: 'recibir', movimiento_id: mov.id, cantidad: Number(contado) })
      await onListo(); onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo="Contar y recibir" onCerrar={onCerrar} ancho="max-w-md">
      <p className="text-[13px] text-tinta">{insumoNombre}</p>
      <p className="mb-4 text-[12.5px] text-suave">El acta dice {num(mov.cantidad)} {unidad}. Escribe lo que de verdad llegó.</p>
      <Campo etiqueta={`Cantidad contada (${unidad})`}>
        <input className={CAMPO} type="number" min="0" step="any" value={contado} onChange={(e) => setContado(e.target.value)} autoFocus />
      </Campo>
      {menos && contado !== '' && (
        <p className="mt-2 text-[12px] text-ambar">Llegaron {num(mov.cantidad - Number(contado))} menos: esa diferencia vuelve a la salida y hay que explicarla.</p>
      )}
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || contado === '' || Number(contado) < 0} onClick={guardar}>Recibir</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}

// ─── Justificar una diferencia ────────────────────────────────────────────────

function ModalJustificar({ fila, salidaId, trabajadores, onCerrar, onListo }: {
  fila: FilaConciliacion; salidaId: string; trabajadores: Trabajador[]; onCerrar: () => void; onListo: () => Promise<void>
}) {
  const demas = fila.saldo < 0
  const motivos = (Object.keys(MOTIVOS) as Motivo[]).filter((m) => (demas ? m === 'sobrante' : m !== 'sobrante'))
  const [motivo, setMotivo] = useState<Motivo>(demas ? 'sobrante' : fila.clase === 'consumible' ? 'consumido' : 'a_cargo')
  const [cantidad, setCantidad] = useState(String(Math.abs(fila.saldo)))
  const [nota, setNota] = useState('')
  const [trab, setTrab] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar() {
    setOcupado(true); setError(null)
    try {
      await enviar(`/api/administrativa/salidas/${salidaId}`, 'POST', {
        accion: 'justificar', insumo_id: fila.insumo_id, cantidad: Number(cantidad), motivo, nota, trabajador_id: trab || null,
      })
      await onListo(); onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo="Justificar la diferencia" onCerrar={onCerrar} ancho="max-w-xl">
      <p className="text-[13px] font-medium text-tinta">{fila.nombre}</p>
      <p className="mb-4 text-[12.5px] text-suave">
        A cargo {num(fila.total)} · consumido {num(fila.consumido_app)} · devuelto {num(fila.devuelto)} · diferencia <b>{num(fila.saldo)}</b> {fila.unidad}.
        {demas ? ' Se devolvió más de lo que se entregó.' : ' Ningún faltante queda sin explicación escrita.'}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Motivo" className="sm:col-span-2">
          <select className={CAMPO} value={motivo} onChange={(e) => setMotivo(e.target.value as Motivo)}>
            {motivos.map((m) => <option key={m} value={m}>{MOTIVOS[m].nombre}</option>)}
          </select>
          <span className="mt-1 block text-[11px] text-tenue">{MOTIVOS[motivo].ayuda}</span>
        </Campo>
        <Campo etiqueta={`Cantidad (${fila.unidad})`}><input className={CAMPO} type="number" min="0" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></Campo>
      </div>
      {MOTIVOS[motivo].pideTrabajador && (
        <Campo etiqueta="Trabajador" className="mt-4">
          <select className={CAMPO} value={trab} onChange={(e) => setTrab(e.target.value)}>
            <option value="">— Elige —</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{nombreTrabajador(t)}</option>)}
          </select>
        </Campo>
      )}
      <Campo etiqueta="Explicación (obligatoria)" className="mt-4">
        <textarea className={CAMPO} rows={3} value={nota} onChange={(e) => setNota(e.target.value)}
                  placeholder="Qué pasó, quién lo sabe, dónde quedó…" />
      </Campo>
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || !nota.trim() || !(Number(cantidad) > 0) || (MOTIVOS[motivo].pideTrabajador === true && !trab)} onClick={guardar}>Guardar justificación</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}

// ─── Cerrar la salida ─────────────────────────────────────────────────────────

function ModalCerrar({ salidaId, sinExplicar, enCamino, sinFirma, onCerrar, onListo }: {
  salidaId: string; sinExplicar: number; enCamino: number; sinFirma: number; onCerrar: () => void; onListo: () => Promise<void>
}) {
  const [fecha, setFecha] = useState(hoyISO())
  const [forzar, setForzar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const bloqueada = sinExplicar > 0 || enCamino > 0

  async function guardar() {
    setOcupado(true); setError(null)
    try {
      await enviar(`/api/administrativa/salidas/${salidaId}`, 'POST', { accion: 'cerrar', fecha, confirmar_sin_firma: forzar })
      await onListo(); onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo="Cerrar la salida" onCerrar={onCerrar} ancho="max-w-lg">
      {bloqueada ? (
        <Aviso tono="arcilla" titulo="Todavía no se puede cerrar">
          {sinExplicar > 0 && <>Hay {sinExplicar} elemento(s) con diferencia sin explicar. </>}
          {enCamino > 0 && <>Hay {enCamino} devolución(es) sin contar. </>}
          Devuélvelos contados o justifícalos, y vuelve a intentar.
        </Aviso>
      ) : (
        <>
          <p className="text-[13px] text-suave">
            Al cerrar, la salida deja de recibir actas y movimientos, y la app de campo ya no descuenta de su bodega. Lo registrado se conserva.
          </p>
          <Campo etiqueta="Fecha de cierre" className="mt-4"><input type="date" className={CAMPO} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
          {sinFirma > 0 && (
            <label className="mt-4 flex items-start gap-2 text-[12.5px] text-ambar">
              <input type="checkbox" className="mt-0.5" checked={forzar} onChange={(e) => setForzar(e.target.checked)} />
              <span>Hay {sinFirma} acta(s) sin el escaneo firmado. Cierro igual y las subo después.</span>
            </label>
          )}
        </>
      )}
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        {!bloqueada && <Boton disabled={ocupado || (sinFirma > 0 && !forzar)} onClick={guardar}>Cerrar salida</Boton>}
        <Boton variante="fantasma" onClick={onCerrar}>{bloqueada ? 'Entendido' : 'Cancelar'}</Boton>
      </div>
    </Ventana>
  )
}

// ─── Completar los datos de la salida ─────────────────────────────────────────

function ModalEditar({ salida, cat, trabajadores, onCerrar, onListo }: {
  salida: Salida; cat: Catalogo; trabajadores: Trabajador[]; onCerrar: () => void; onListo: () => Promise<void>
}) {
  const [v, setV] = useState({
    responsable_id: salida.responsable_id ?? '', bodega_retorno_id: salida.bodega_retorno_id ?? '',
    proyecto: salida.proyecto ?? '', notas: salida.notas ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar() {
    setOcupado(true); setError(null)
    try {
      await enviar(`/api/administrativa/salidas/${salida.id}`, 'PATCH', {
        responsable_id: v.responsable_id || null, bodega_retorno_id: v.bodega_retorno_id || null, proyecto: v.proyecto || null, notas: v.notas,
      })
      await onListo(); onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo="Datos de la salida" onCerrar={onCerrar} ancho="max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Responsable de la salida">
          <select className={CAMPO} value={v.responsable_id} onChange={(e) => setV({ ...v, responsable_id: e.target.value })}>
            <option value="">— Sin definir —</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{nombreTrabajador(t)}</option>)}
          </select>
          {trabajadores.length === 0 && <span className="mt-1 block text-[11px] text-tenue">Agrega al trabajador en la pestaña Trabajadores.</span>}
        </Campo>
        <Campo etiqueta="Vuelve a">
          <select className={CAMPO} value={v.bodega_retorno_id} onChange={(e) => setV({ ...v, bodega_retorno_id: e.target.value })}>
            <option value="">— Sin definir —</option>
            {cat.bodegas.filter((b) => b.activo && esBodegaFisica(b.tipo)).map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Proyecto">
          <select className={CAMPO} value={v.proyecto} onChange={(e) => setV({ ...v, proyecto: e.target.value })}>
            <option value="">— Ninguno —</option>
            {cat.proyectos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Notas" className="sm:col-span-2"><input className={CAMPO} value={v.notas} onChange={(e) => setV({ ...v, notas: e.target.value })} /></Campo>
      </div>
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado} onClick={guardar}>Guardar</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}
