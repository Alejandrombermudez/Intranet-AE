'use client'
import { useMemo, useState } from 'react'
import { Ban, Download, FileText, Upload } from 'lucide-react'
import { Aviso, Boton, MarcaEstado, Seccion, Vacio } from '@/app/components/marca'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { aligerarDocumento } from '@/lib/comprimir-pdf'
import { nombreUnidad } from '@/lib/factura-dian'
import { cantidad, fechaCorta, nitConDv, pesos, type FacturaItem, type FacturaResumen } from '@/lib/administrativa'
import { CAMPO, Campo, enviar, Mensaje, TD, TH, useCarga, Ventana, type Catalogo } from './comun'

/**
 * COMPRAS — las facturas registradas y el gasto.
 * Cada factura se abre con sus líneas: cuáles entraron a inventario (a qué
 * insumo y bodega, con qué factor) y cuáles quedaron como gasto.
 */

type Rango = 'mes' | 'anterior' | 'anio' | 'todo'

/** Registrada sin XML ni PDF: se avisa hasta que alguien adjunte el soporte. */
const sinSoporte = (f: Pick<FacturaResumen, 'archivo_pdf' | 'archivo_xml'>) => !f.archivo_pdf && !f.archivo_xml

function rangoFechas(r: Rango): { desde?: string; hasta?: string } {
  const h = new Date()
  const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  if (r === 'mes') return { desde: iso(new Date(h.getFullYear(), h.getMonth(), 1)) }
  if (r === 'anterior') return { desde: iso(new Date(h.getFullYear(), h.getMonth() - 1, 1)), hasta: iso(new Date(h.getFullYear(), h.getMonth(), 0)) }
  if (r === 'anio') return { desde: `${h.getFullYear()}-01-01` }
  return {}
}

export default function Compras({ cat }: { cat: Catalogo }) {
  const [rango, setRango] = useState<Rango>('anio')
  const [abierta, setAbierta] = useState<string | null>(null)
  const [verAnuladas, setVerAnuladas] = useState(false)

  const url = useMemo(() => {
    const { desde, hasta } = rangoFechas(rango)
    const qs = new URLSearchParams()
    if (desde) qs.set('desde', desde)
    if (hasta) qs.set('hasta', hasta)
    return `/api/administrativa/facturas?${qs}`
  }, [rango])
  const { data: facturas, error, recargar: cargar } = useCarga<FacturaResumen[]>(
    url, (j) => (j.facturas as FacturaResumen[]) ?? [], 'No se pudieron leer las facturas.')

  const vigentes = useMemo(() => (facturas ?? []).filter((f) => f.estado === 'registrada'), [facturas])
  const faltan = useMemo(() => vigentes.filter(sinSoporte), [vigentes])
  const visibles = verAnuladas ? facturas ?? [] : vigentes
  const nombreProyecto = (c: string | null) => cat.proyectos.find((p) => p.codigo === c)?.nombre ?? (c ? c : 'Sin proyecto')

  const resumen = useMemo(() => {
    const porProveedor = new Map<string, { nombre: string; n: number; total: number }>()
    const porProyecto = new Map<string, { n: number; total: number }>()
    for (const f of vigentes) {
      const k = f.proveedor?.id ?? '—'
      const p = porProveedor.get(k) ?? { nombre: f.proveedor?.razon_social ?? '—', n: 0, total: 0 }
      p.n++; p.total += Number(f.total); porProveedor.set(k, p)
      const kp = f.proyecto ?? ''
      const q = porProyecto.get(kp) ?? { n: 0, total: 0 }
      q.n++; q.total += Number(f.total); porProyecto.set(kp, q)
    }
    return {
      total: vigentes.reduce((s, f) => s + Number(f.total), 0),
      iva: vigentes.reduce((s, f) => s + Number(f.impuestos), 0),
      proveedores: [...porProveedor.values()].sort((a, b) => b.total - a.total),
      proyectos: [...porProyecto.entries()].sort((a, b) => b[1].total - a[1].total),
    }
  }, [vigentes])

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end gap-4">
        <Campo etiqueta="Periodo" className="w-56">
          <select className={CAMPO} value={rango} onChange={(e) => setRango(e.target.value as Rango)}>
            <option value="mes">Este mes</option>
            <option value="anterior">Mes anterior</option>
            <option value="anio">Este año</option>
            <option value="todo">Todo</option>
          </select>
        </Campo>
        <label className="flex items-center gap-2 pb-2 text-[12px] text-suave">
          <input type="checkbox" checked={verAnuladas} onChange={(e) => setVerAnuladas(e.target.checked)} /> Mostrar anuladas
        </label>
        <div className="ml-auto flex gap-2">
          <Boton variante="secundario" href="/intranet/administrativa/facturas/nueva?manual=1">Registrar sin XML</Boton>
          <Boton href="/intranet/administrativa/facturas/nueva" icono={<FileText size={13} />}>Subir factura electrónica</Boton>
        </div>
      </div>

      {error && <Aviso tono="arcilla" className="mb-6">{error}</Aviso>}

      {faltan.length > 0 && (
        <Aviso tono="ambar" className="mb-8"
          titulo={`${faltan.length} factura${faltan.length === 1 ? '' : 's'} sin documento soporte (${pesos(faltan.reduce((s, f) => s + Number(f.total), 0))})`}>
          {faltan.map((f) => `${f.proveedor?.razon_social ?? '—'} ${f.numero}`).join(' · ')}.
          {' '}Cuentan en el gasto y en el inventario, pero no tienen el papel que las respalda. Se adjunta abriendo la factura.
        </Aviso>
      )}

      {facturas && vigentes.length > 0 && (
        <div className="mb-10 grid gap-8 md:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-[.16em] text-tenue">Total comprado</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums text-tinta">{pesos(resumen.total)}</p>
            <p className="mt-1 text-[12px] text-suave">{vigentes.length} factura{vigentes.length === 1 ? '' : 's'} · IVA {pesos(resumen.iva)}</p>
          </div>
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[.16em] text-tenue">Por proyecto</p>
            {resumen.proyectos.map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-fina py-1 text-[12.5px]">
                <span className="text-suave">{nombreProyecto(k || null)}</span>
                <span className="tabular-nums text-tinta">{pesos(v.total)}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[.16em] text-tenue">Principales proveedores</p>
            {resumen.proveedores.slice(0, 5).map((p) => (
              <div key={p.nombre} className="flex justify-between gap-3 border-b border-fina py-1 text-[12.5px]">
                <span className="truncate text-suave">{p.nombre}</span>
                <span className="shrink-0 tabular-nums text-tinta">{pesos(p.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Seccion titulo="Facturas" sub="Toca una factura para ver sus líneas y qué entró a cada bodega.">
        {facturas === null ? (
          <Vacio>Cargando…</Vacio>
        ) : visibles.length === 0 ? (
          <Vacio>No hay facturas en este periodo</Vacio>
        ) : (
          <div className="overflow-x-auto vidrio rounded-2xl">
            <table className="w-full">
              <thead className="border-b border-linea/70 bg-white/40">
                <tr>
                  <th className={TH}>Fecha</th><th className={TH}>Proveedor</th><th className={TH}>Número</th>
                  <th className={TH}>Proyecto</th><th className={TH}>Líneas</th><th className={`${TH} text-right`}>Total</th><th className={TH}></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.id} onClick={() => setAbierta(f.id)}
                      className={`cursor-pointer border-b border-fina hover:bg-papel ${f.estado === 'anulada' ? 'opacity-50' : ''}`}>
                    <td className={`${TD} whitespace-nowrap`}>{fechaCorta(f.fecha_emision)}</td>
                    <td className={TD}>
                      <span className="block">{f.proveedor?.razon_social ?? '—'}</span>
                      <span className="text-[11px] text-tenue">NIT {nitConDv(f.proveedor?.nit, f.proveedor?.dv)}</span>
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{f.numero}</td>
                    <td className={TD}>{f.proyecto ? nombreProyecto(f.proyecto) : <span className="text-tenue">—</span>}</td>
                    <td className={`${TD} whitespace-nowrap text-suave`}>{f.n_items} · {f.n_inventario} a inventario</td>
                    <td className={`${TD} text-right tabular-nums font-medium`}>{pesos(f.total)}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      {f.estado === 'anulada' ? <MarcaEstado color="var(--color-red-600)">Anulada</MarcaEstado>
                        : sinSoporte(f) ? <MarcaEstado color="var(--color-ambar)">Falta soporte</MarcaEstado>
                        : f.origen === 'manual' ? <MarcaEstado color="var(--color-taupe)">Sin XML</MarcaEstado>
                        : <MarcaEstado color="var(--color-bosque)">Electrónica</MarcaEstado>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>

      {abierta && <DetalleFactura id={abierta} cat={cat} onCerrar={() => setAbierta(null)} onCambio={cargar} />}
    </>
  )
}

interface FacturaDetalle extends Omit<FacturaResumen, 'proveedor' | 'n_items' | 'n_inventario'> {
  proveedor: { nit: string; dv: string | null; razon_social: string; email: string | null; ciudad: string | null } | null
  items: FacturaItem[]
  url_xml: string | null
  url_pdf: string | null
  anulada_por: string | null
  anulada_at: string | null
}

function DetalleFactura({ id, cat, onCerrar, onCambio }: { id: string; cat: Catalogo; onCerrar: () => void; onCambio: () => void }) {
  const { data, error: errorCarga, recargar: cargar } = useCarga<FacturaDetalle | null>(
    `/api/administrativa/facturas/${id}`, (j) => (j.factura as FacturaDetalle) ?? null, 'No se pudo abrir la factura.')
  const f = data ?? null
  const [errorAccion, setError] = useState<string | null>(null)
  const error = errorAccion ?? errorCarga
  const [anulando, setAnulando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)


  const insumo = (i: string | null) => cat.insumos.find((x) => x.id === i)
  const bodega = (b: string | null) => cat.bodegas.find((x) => x.id === b)?.nombre ?? '—'

  async function adjuntar(archivo: File) {
    setOcupado(true); setError(null)
    try {
      const form = new FormData()
      form.append('soporte', (await aligerarDocumento(archivo)).archivo)
      const r = await fetchConSesion(`/api/administrativa/facturas/${id}`, { method: 'POST', body: form })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'No se pudo subir el soporte.')
      await cargar(); onCambio()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  async function anular() {
    setOcupado(true); setError(null)
    try {
      await enviar(`/api/administrativa/facturas/${id}`, 'PATCH', { accion: 'anular', motivo })
      setAnulando(false); await cargar(); onCambio()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo={f ? `Factura ${f.numero}` : 'Factura'} onCerrar={onCerrar} ancho="max-w-5xl">
      {!f ? <p className="text-[12px] text-tenue">{error ?? 'Cargando…'}</p> : (
        <>
          <div className="mb-5 grid gap-x-8 gap-y-3 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-[10px] uppercase tracking-[.14em] text-tenue">Proveedor</p><p>{f.proveedor?.razon_social}</p><p className="text-tenue">NIT {nitConDv(f.proveedor?.nit, f.proveedor?.dv)}</p></div>
            <div><p className="text-[10px] uppercase tracking-[.14em] text-tenue">Fecha</p><p>{fechaCorta(f.fecha_emision)}</p>{f.fecha_vencimiento && <p className="text-tenue">Vence {fechaCorta(f.fecha_vencimiento)}</p>}</div>
            <div><p className="text-[10px] uppercase tracking-[.14em] text-tenue">Proyecto</p><p>{cat.proyectos.find((p) => p.codigo === f.proyecto)?.nombre ?? 'Sin proyecto'}</p><p className="text-tenue">{f.forma_pago === 'credito' ? 'A crédito' : f.forma_pago === 'contado' ? 'De contado' : ''}</p></div>
            <div><p className="text-[10px] uppercase tracking-[.14em] text-tenue">Registrada por</p><p className="truncate">{f.created_by ?? '—'}</p><p className="text-tenue">{fechaCorta(f.created_at)}</p></div>
          </div>
          {f.cufe && <p className="mb-5 break-all text-[10.5px] text-tenue">CUFE {f.cufe}</p>}
          {f.estado === 'registrada' && sinSoporte(f) && (
            <Aviso tono="ambar" titulo="Falta el documento soporte" className="mb-5">
              Esta compra cuenta en el gasto y en el inventario, pero no tiene el papel que la respalda. Cuando llegue, adjúntalo
              con «Adjuntar soporte», aquí abajo.
            </Aviso>
          )}
          {f.estado === 'anulada' && (
            <Aviso tono="arcilla" titulo="Factura anulada" className="mb-5">
              {f.motivo_anulacion} — {f.anulada_por}, {fechaCorta(f.anulada_at)}. Sus entradas ya no cuentan en el inventario.
            </Aviso>
          )}

          <div className="overflow-x-auto vidrio rounded-2xl">
            <table className="w-full">
              <thead className="border-b border-linea/70 bg-white/40">
                <tr><th className={TH}>#</th><th className={TH}>Descripción</th><th className={`${TH} text-right`}>Cantidad</th>
                  <th className={`${TH} text-right`}>Total</th><th className={TH}>Qué es</th></tr>
              </thead>
              <tbody>
                {f.items.map((it) => {
                  const ins = insumo(it.insumo_id)
                  return (
                    <tr key={it.id} className="border-b border-fina">
                      <td className={`${TD} text-tenue`}>{it.linea}</td>
                      <td className={TD}>{it.descripcion}{it.codigo && <span className="ml-1 text-[11px] text-tenue">({it.codigo})</span>}</td>
                      <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{cantidad(it.cantidad)} {nombreUnidad(it.unidad_medida) ?? ''}</td>
                      <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{pesos(it.total)}</td>
                      <td className={TD}>
                        {it.clase === 'inventario' && ins ? (
                          <span>
                            <span className="font-medium">{cantidad(Number(it.cantidad) * Number(it.factor))} {ins.unidad}</span> de {ins.nombre}
                            <span className="block text-[11px] text-tenue">a {bodega(it.bodega_id)}{Number(it.factor) !== 1 ? ` · factor ${cantidad(it.factor)}` : ''}</span>
                          </span>
                        ) : <span className="text-tenue">Gasto</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr><td colSpan={3} className={`${TD} text-right text-tenue`}>Subtotal</td><td className={`${TD} text-right tabular-nums`}>{pesos(f.subtotal)}</td><td /></tr>
                <tr><td colSpan={3} className={`${TD} text-right text-tenue`}>Impuestos</td><td className={`${TD} text-right tabular-nums`}>{pesos(f.impuestos)}</td><td /></tr>
                {Number(f.retenciones) > 0 && <tr><td colSpan={3} className={`${TD} text-right text-tenue`}>Retenciones (informativo)</td><td className={`${TD} text-right tabular-nums`}>{pesos(f.retenciones)}</td><td /></tr>}
                <tr><td colSpan={3} className={`${TD} text-right font-medium`}>Total</td><td className={`${TD} text-right font-semibold tabular-nums`}>{pesos(f.total)}</td><td /></tr>
              </tfoot>
            </table>
          </div>
          {f.notas && <p className="mt-4 text-[12.5px] text-suave">{f.notas}</p>}

          <div className="mt-6 flex flex-wrap gap-2">
            {f.url_pdf && <Boton variante="secundario" href={f.url_pdf} icono={<Download size={13} />}>Ver PDF / soporte</Boton>}
            {f.url_xml && <Boton variante="secundario" href={f.url_xml} icono={<Download size={13} />}>Descargar XML</Boton>}
            {f.estado === 'registrada' && (
              <label className={`inline-flex cursor-pointer items-center justify-center gap-2 px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-[.16em] transition-colors ${
                sinSoporte(f) ? 'bg-bosque text-papel hover:bg-primary-dark' : 'border border-taupe text-suave hover:bg-hueso/60'
              } ${ocupado ? 'pointer-events-none opacity-45' : ''}`}>
                <Upload size={13} />
                {ocupado ? 'Subiendo…' : f.archivo_pdf ? 'Reemplazar soporte' : 'Adjuntar soporte'}
                <input type="file" accept="application/pdf,image/*" className="hidden"
                  onChange={(e) => { const a = e.target.files?.[0]; e.target.value = ''; if (a) adjuntar(a) }} />
              </label>
            )}
            {f.estado === 'registrada' && !anulando && (
              <Boton variante="peligro" className="ml-auto" icono={<Ban size={13} />} onClick={() => setAnulando(true)}>Anular factura</Boton>
            )}
          </div>

          {anulando && (
            <div className="mt-5 border-t border-linea pt-5">
              <p className="mb-3 text-[12.5px] text-suave">
                La factura queda en el registro marcada como anulada y sus entradas dejan de contar en el saldo. Si esos
                insumos ya se repartieron, la bodega central puede quedar en negativo: es lo correcto, lo repartido tuvo que salir de algún lado.
              </p>
              <Campo etiqueta="Por qué se anula">
                <input className={CAMPO} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Se registró dos veces, el proveedor la anuló…" />
              </Campo>
              <div className="mt-3 flex gap-2">
                <Boton variante="peligro" disabled={ocupado || !motivo.trim()} onClick={anular}>Confirmar anulación</Boton>
                <Boton variante="fantasma" onClick={() => setAnulando(false)}>Cancelar</Boton>
              </div>
            </div>
          )}
          <Mensaje error={error} />
        </>
      )}
    </Ventana>
  )
}
