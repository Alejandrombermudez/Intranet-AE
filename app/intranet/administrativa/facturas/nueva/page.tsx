'use client'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, FileUp, Plus, Trash2 } from 'lucide-react'
import { Aviso, Boton, Cabecera, Cargando, Contenido, Seccion } from '@/app/components/marca'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { aligerarDocumento } from '@/lib/comprimir-pdf'
import { FacturaIlegible, leerArchivosFactura, nombreUnidad, type FacturaLeida } from '@/lib/factura-dian'
import { cantidad, esBodegaFisica, fechaCorta, hoyISO, nitConDv, pesos, UNIDADES_INVENTARIO, type Insumo, type LineaClasificada } from '@/lib/administrativa'
import { CAMPO, Campo, enviar, Mensaje, TD, TH, Ventana, useAccesoFinanciero, useCatalogo } from '../../comun'

/**
 * SUBIR UNA FACTURA
 * ─────────────────
 * 1. Se arrastra el .zip que llegó al correo (o el .xml suelto). La factura se
 *    lee en el navegador: proveedor, número, CUFE, líneas, IVA, totales.
 * 2. Cada línea se clasifica: GASTO (flete, servicio) o INVENTARIO (un insumo
 *    del catálogo, cuántas unidades de inventario trae cada unidad facturada y a
 *    qué bodega entra). Lo que se decidió la última vez con ese proveedor llega
 *    ya puesto.
 * 3. Guardar registra todo de una vez (financiero.registrar_factura) y guarda
 *    el XML y el PDF en el bucket privado.
 *
 * Con ?manual=1 es para lo que no trae XML: recibos, cuentas de cobro, compras
 * de contado a quien no factura electrónicamente.
 */

interface Proveedor { nit: string; dv: string; razon_social: string; email?: string | null; telefono?: string | null; direccion?: string | null; ciudad?: string | null; nombre_comercial?: string | null }
interface Linea extends LineaClasificada { origen?: 'aprendido' | 'nombre' | null; factorTxt: string }

export default function NuevaFactura() {
  const router = useRouter()
  const { listo } = useAccesoFinanciero()
  const { cat, cargando, recargar } = useCatalogo(listo)
  // ?manual=1 — se lee de la dirección; en el servidor no hay, y mientras se
  // verifica el acceso solo se pinta «Preparando», así que no hay nada que hidratar.
  const [manual] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('manual') === '1')

  // ── Lo leído ──
  const [leida, setLeida] = useState<FacturaLeida | null>(null)
  const [xml, setXml] = useState<{ nombre: string; contenido: string } | null>(null)
  const [pdf, setPdf] = useState<File | null>(null)
  const [errorLectura, setErrorLectura] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [duplicada, setDuplicada] = useState<{ numero: string; fecha_emision: string; estado: string } | null>(null)

  // ── Lo que se va a guardar ──
  const [proveedor, setProveedor] = useState<Proveedor>({ nit: '', dv: '', razon_social: '' })
  const [cab, setCab] = useState({ numero: '', fecha_emision: hoyISO(), fecha_vencimiento: '', forma_pago: '', tipo_documento: 'factura', proyecto: '', notas: '' })
  const [lineas, setLineas] = useState<Linea[]>([])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [nuevoInsumo, setNuevoInsumo] = useState<{ linea: number; nombre: string } | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)

  const central = cat.bodegas.find((b) => b.tipo === 'central' && b.activo) ?? cat.bodegas.find((b) => b.activo && esBodegaFisica(b.tipo))
  const insumosActivos = cat.insumos.filter((i) => i.activo)

  // En modo manual se arranca con una línea vacía (ajuste de estado durante el
  // render: el catálogo con la bodega central llega después del primer render).
  if (manual && !lineas.length && central) setLineas([lineaVacia(1, central.id)])

  async function leer(archivos: File[]) {
    if (!archivos.length) return
    setLeyendo(true); setErrorLectura(null); setDuplicada(null)
    try {
      const { factura, xml: x, pdf: p } = await leerArchivosFactura(archivos)
      setLeida(factura); setXml(x); setPdf(p)
      setProveedor({
        nit: factura.proveedor.nit, dv: factura.proveedor.dv ?? '', razon_social: factura.proveedor.razonSocial,
        email: factura.proveedor.email, telefono: factura.proveedor.telefono, direccion: factura.proveedor.direccion,
        ciudad: factura.proveedor.ciudad, nombre_comercial: factura.proveedor.nombreComercial,
      })
      setCab((c) => ({
        ...c, numero: factura.numero, fecha_emision: factura.fechaEmision, fecha_vencimiento: factura.fechaVencimiento ?? '',
        forma_pago: factura.formaPago ?? '', tipo_documento: factura.tipoDocumento,
      }))
      // Sugerencias: lo aprendido de este proveedor, o el insumo cuyo nombre aparece.
      const r = await fetchConSesion('/api/administrativa/facturas/sugerencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nit: factura.proveedor.nit, cufe: factura.cufe, numero: factura.numero,
          items: factura.lineas.map((l) => ({ linea: l.linea, codigo: l.codigo, descripcion: l.descripcion })) }),
      })
      const s = r.ok ? await r.json() : { items: [] }
      setDuplicada(s.duplicada ?? null)
      const sug = new Map<number, { origen: Linea['origen']; clase: string | null; insumo_id: string | null; factor: number }>(
        (s.items ?? []).map((x: { linea: number }) => [x.linea, x]),
      )
      setLineas(factura.lineas.map((l) => {
        const g = sug.get(l.linea)
        const clase = (g?.clase === 'inventario' && g.insumo_id ? 'inventario' : 'gasto') as Linea['clase']
        const factor = Number(g?.factor) || 1
        return {
          linea: l.linea, codigo: l.codigo, descripcion: l.descripcion, cantidad: l.cantidad, unidad_medida: l.unidad,
          precio_unitario: l.precioUnitario, subtotal: l.subtotal, impuesto_pct: l.impuestoPct, impuesto_valor: l.impuestoValor,
          total: l.total, clase, insumo_id: clase === 'inventario' ? g!.insumo_id : null, factor, factorTxt: String(factor),
          bodega_id: central?.id ?? null, origen: g?.origen ?? null,
        }
      }))
    } catch (e) {
      setLeida(null); setLineas([])
      setErrorLectura(e instanceof FacturaIlegible ? e.message : 'No se pudo leer el archivo.')
    }
    setLeyendo(false)
  }

  const cambiar = (k: number, cambios: Partial<Linea>) => setLineas((ls) => ls.map((l, j) => (j === k ? { ...l, ...cambios } : l)))

  const totales = useMemo(() => ({
    subtotal: lineas.reduce((s, l) => s + (Number(l.subtotal) || 0), 0),
    impuestos: lineas.reduce((s, l) => s + (Number(l.impuesto_valor) || 0), 0),
    total: lineas.reduce((s, l) => s + (Number(l.total) || 0), 0),
    inventario: lineas.filter((l) => l.clase === 'inventario').length,
  }), [lineas])

  const faltantes = lineas.filter((l) => l.clase === 'inventario' && (!l.insumo_id || !l.bodega_id || !(Number(l.factor) > 0) || !(Number(l.cantidad) > 0)))
  const puedeGuardar = !guardando && !duplicada && lineas.length > 0 && !faltantes.length
    && proveedor.nit.trim() && proveedor.razon_social.trim() && cab.numero.trim() && cab.fecha_emision
    && (!manual || lineas.every((l) => l.descripcion.trim()))

  async function guardar() {
    setGuardando(true); setError(null)
    const datos = {
      proveedor: { ...proveedor, nit: proveedor.nit.replace(/[^0-9A-Za-z-]/g, '') },
      factura: {
        tipo_documento: cab.tipo_documento, numero: cab.numero.trim(), cufe: leida?.cufe ?? null,
        fecha_emision: cab.fecha_emision, fecha_vencimiento: cab.fecha_vencimiento || null, moneda: leida?.moneda ?? 'COP',
        forma_pago: cab.forma_pago || null, proyecto: cab.proyecto || null, notas: cab.notas || null,
        adquiriente_nit: leida?.adquiriente.nit ?? null,
        subtotal: leida?.subtotal ?? totales.subtotal, descuentos: leida?.descuentos ?? 0,
        impuestos: leida?.impuestos ?? totales.impuestos, retenciones: leida?.retenciones ?? 0,
        total: leida?.total ?? totales.total,
      },
      items: lineas.map((l) => ({
        linea: l.linea, codigo: l.codigo, descripcion: l.descripcion, cantidad: l.cantidad, unidad_medida: l.unidad_medida,
        precio_unitario: l.precio_unitario, subtotal: l.subtotal, impuesto_pct: l.impuesto_pct, impuesto_valor: l.impuesto_valor,
        total: l.total, clase: l.clase, factor: l.factor, insumo_id: l.clase === 'inventario' ? l.insumo_id : null, bodega_id: l.clase === 'inventario' ? l.bodega_id : null,
      })),
    }
    const form = new FormData()
    form.append('datos', JSON.stringify(datos))
    if (xml) form.append('xml', new File([xml.contenido], xml.nombre, { type: 'application/xml' }))
    // Un escaneo de CamScanner pesaba 2,3 MB por dos páginas: se aligera aquí,
    // solo en sus fotos. Una factura electrónica nativa o un PDF firmado van intactos.
    if (pdf) form.append('pdf', (await aligerarDocumento(pdf)).archivo)
    const r = await fetchConSesion('/api/administrativa/facturas', { method: 'POST', body: form })
    const j = await r.json().catch(() => ({}))
    setGuardando(false)
    if (!r.ok) { setError(j.error ?? 'No se pudo guardar la factura.'); return }
    router.push('/intranet/administrativa?tab=compras')
  }

  if (!listo || cargando) return <Cargando texto="Preparando…" />

  const hayFactura = manual || !!leida

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        ancho="amplio" compacta
        volver={{ href: '/intranet/administrativa?tab=compras', label: 'Compras' }}
        modulo="Administrativa y financiera"
        titulo={manual ? 'Registrar compra sin factura electrónica' : 'Subir factura electrónica'}
        descripcion={manual
          ? 'Para recibos, cuentas de cobro o compras a quien no factura electrónicamente. Adjunta la foto o el PDF del soporte.'
          : 'Arrastra el .zip que llegó al correo del proveedor. Se lee solo: proveedor, número, líneas e IVA.'}
      />
      <Contenido ancho="amplio">
        {cat.faltaMigracion && <Aviso tono="ambar" className="mb-8">{cat.aviso}</Aviso>}

        {/* ── 1. El archivo ── */}
        {!manual && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); leer([...e.dataTransfer.files]) }}
            onClick={() => archivoRef.current?.click()}
            className="mb-10 cursor-pointer rounded-2xl border border-dashed border-taupe bg-white/45 px-6 py-10 text-center transition-colors hover:border-bosque"
          >
            <FileUp className="mx-auto mb-3 text-bosque" size={26} />
            <p className="text-[13px] text-tinta">{leyendo ? 'Leyendo…' : leida ? 'Cambiar de factura' : 'Arrastra aquí el .zip de la factura, o toca para buscarlo'}</p>
            <p className="mt-1 text-[11.5px] text-tenue">También sirve el .xml suelto, con su PDF al lado.</p>
            <input ref={archivoRef} type="file" multiple accept=".zip,.xml,.pdf,application/zip,application/xml,text/xml,application/pdf" className="hidden"
                   onChange={(e) => { leer([...(e.target.files ?? [])]); e.target.value = '' }} />
          </div>
        )}
        {errorLectura && <Aviso tono="arcilla" titulo="No se pudo leer" className="-mt-6 mb-10">{errorLectura}</Aviso>}

        {hayFactura && (
          <>
            {duplicada && (
              <Aviso tono="arcilla" titulo="Esta factura ya está registrada" className="mb-8">
                {duplicada.numero} del {fechaCorta(duplicada.fecha_emision)}{duplicada.estado === 'anulada' ? ' (anulada)' : ''}. No se puede registrar dos veces.
              </Aviso>
            )}
            {leida?.avisos.map((a) => <Aviso key={a} tono="ambar" className="mb-4">{a}</Aviso>)}

            {/* ── 2. Encabezado ── */}
            <Seccion n="01" titulo="Proveedor y factura">
              {leida ? (
                <div className="grid gap-x-10 gap-y-4 text-[12.5px] sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-[10px] uppercase tracking-[.14em] text-tenue">Proveedor</p><p className="font-medium">{proveedor.razon_social}</p><p className="text-tenue">NIT {nitConDv(proveedor.nit, proveedor.dv)}{proveedor.ciudad ? ` · ${proveedor.ciudad}` : ''}</p></div>
                  <div><p className="text-[10px] uppercase tracking-[.14em] text-tenue">Factura</p><p className="font-medium">{cab.numero}</p><p className="text-tenue">{leida.tipoDocumento === 'documento_soporte' ? 'Documento soporte' : 'Factura electrónica'}</p></div>
                  <div><p className="text-[10px] uppercase tracking-[.14em] text-tenue">Fecha</p><p>{fechaCorta(cab.fecha_emision)}</p><p className="text-tenue">{cab.forma_pago === 'credito' ? `A crédito${cab.fecha_vencimiento ? `, vence ${fechaCorta(cab.fecha_vencimiento)}` : ''}` : cab.forma_pago === 'contado' ? 'De contado' : ''}</p></div>
                  <div><p className="text-[10px] uppercase tracking-[.14em] text-tenue">A nombre de</p><p>{leida.adquiriente.nombre ?? '—'}</p><p className="text-tenue">NIT {nitConDv(leida.adquiriente.nit)}</p></div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Campo etiqueta="NIT o cédula del proveedor"><input className={CAMPO} value={proveedor.nit} onChange={(e) => setProveedor({ ...proveedor, nit: e.target.value })} /></Campo>
                  <Campo etiqueta="Nombre del proveedor"><input className={CAMPO} value={proveedor.razon_social} onChange={(e) => setProveedor({ ...proveedor, razon_social: e.target.value })} /></Campo>
                  <Campo etiqueta="Número del recibo o factura"><input className={CAMPO} value={cab.numero} onChange={(e) => setCab({ ...cab, numero: e.target.value })} /></Campo>
                  <Campo etiqueta="Fecha"><input type="date" className={CAMPO} value={cab.fecha_emision} onChange={(e) => setCab({ ...cab, fecha_emision: e.target.value })} /></Campo>
                  <Campo etiqueta="Tipo de soporte">
                    <select className={CAMPO} value={cab.tipo_documento} onChange={(e) => setCab({ ...cab, tipo_documento: e.target.value })}>
                      <option value="factura">Factura en papel o POS</option>
                      <option value="cuenta_cobro">Cuenta de cobro</option>
                      <option value="documento_soporte">Documento soporte</option>
                      <option value="otro">Otro</option>
                    </select>
                  </Campo>
                  <Campo etiqueta="Foto o PDF del soporte" className="lg:col-span-3">
                    <input type="file" accept="image/*,application/pdf" className="text-[12px]" onChange={(e) => setPdf(e.target.files?.[0] ?? null)} />
                  </Campo>
                </div>
              )}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Proyecto al que se carga (opcional)">
                  <select className={CAMPO} value={cab.proyecto} onChange={(e) => setCab({ ...cab, proyecto: e.target.value })}>
                    <option value="">— General / varios —</option>
                    {cat.proyectos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
                  </select>
                </Campo>
                <Campo etiqueta="Notas"><input className={CAMPO} value={cab.notas} onChange={(e) => setCab({ ...cab, notas: e.target.value })} placeholder="Para qué fue la compra, quién la pidió…" /></Campo>
              </div>
              {pdf && <p className="mt-3 text-[11.5px] text-tenue">Soporte adjunto: {pdf.name}</p>}
            </Seccion>

            {/* ── 3. Las líneas ── */}
            <Seccion n="02" titulo="Qué se compró"
              sub="Marca cada línea como gasto o como entrada a inventario. Si la factura viene en kilos y en bodega se cuentan bultos de 50 kg, el factor es 0,02 (cada kilo es 0,02 bultos).">
              <div className="overflow-x-auto vidrio rounded-2xl">
                <table className="w-full">
                  <thead className="border-b border-linea/70 bg-white/40">
                    <tr><th className={TH}>#</th><th className={TH}>Línea de la factura</th><th className={`${TH} text-right`}>Total</th><th className={TH}>Es</th><th className={TH}>Entra a inventario como</th>{manual && <th className={TH}></th>}</tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, k) => {
                      const ins = cat.insumos.find((i) => i.id === l.insumo_id)
                      const entran = (Number(l.cantidad) || 0) * (Number(l.factor) || 0)
                      return (
                        <tr key={k} className="border-b border-fina">
                          <td className={`${TD} text-tenue`}>{l.linea}</td>
                          <td className={`${TD} min-w-[16rem]`}>
                            {manual ? (
                              <div className="grid gap-2">
                                <input className={CAMPO} placeholder="Descripción" value={l.descripcion} onChange={(e) => cambiar(k, { descripcion: e.target.value })} />
                                <div className="grid grid-cols-3 gap-2">
                                  <input className={CAMPO} type="number" min="0" step="any" placeholder="Cantidad" value={l.cantidad || ''} onChange={(e) => cambiar(k, { cantidad: Number(e.target.value) })} />
                                  <input className={CAMPO} type="number" min="0" step="any" placeholder="Valor sin IVA" value={l.subtotal || ''}
                                         onChange={(e) => { const s = Number(e.target.value); cambiar(k, { subtotal: s, total: s + (Number(l.impuesto_valor) || 0), precio_unitario: l.cantidad ? s / l.cantidad : null }) }} />
                                  <input className={CAMPO} type="number" min="0" step="any" placeholder="IVA" value={l.impuesto_valor || ''}
                                         onChange={(e) => { const iv = Number(e.target.value); cambiar(k, { impuesto_valor: iv, total: (Number(l.subtotal) || 0) + iv }) }} />
                                </div>
                              </div>
                            ) : (
                              <>
                                <span>{l.descripcion}</span>
                                <span className="block text-[11px] text-tenue">
                                  {cantidad(l.cantidad)} {nombreUnidad(l.unidad_medida) ?? ''}{l.precio_unitario != null ? ` × ${pesos(l.precio_unitario)}` : ''}
                                  {l.impuesto_pct ? ` · IVA ${cantidad(l.impuesto_pct)} %` : ''}{l.codigo ? ` · cód. ${l.codigo}` : ''}
                                </span>
                              </>
                            )}
                          </td>
                          <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{pesos(l.total)}</td>
                          <td className={TD}>
                            <div className="inline-flex overflow-hidden rounded-full border border-linea">
                              {(['gasto', 'inventario'] as const).map((c) => (
                                <button key={c} type="button" onClick={() => cambiar(k, { clase: c })}
                                        className={`px-2.5 py-1.5 text-[10.5px] uppercase tracking-[.12em] ${l.clase === c ? 'bg-bosque text-papel' : 'text-tenue hover:text-tinta'}`}>
                                  {c === 'gasto' ? 'Gasto' : 'Inventario'}
                                </button>
                              ))}
                            </div>
                            {l.origen && <span className="mt-1 block text-[10.5px] text-tenue">{l.origen === 'aprendido' ? 'como la última vez' : 'por el nombre'}</span>}
                          </td>
                          <td className={`${TD} min-w-[22rem]`}>
                            {l.clase === 'inventario' ? (
                              <div className="grid gap-2">
                                <div className="flex gap-2">
                                  <select className={CAMPO} value={l.insumo_id ?? ''} onChange={(e) => {
                                    if (e.target.value === '__nuevo') setNuevoInsumo({ linea: k, nombre: l.descripcion })
                                    else cambiar(k, { insumo_id: e.target.value || null, origen: null })
                                  }}>
                                    <option value="">— Insumo del catálogo —</option>
                                    {insumosActivos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                                    <option value="__nuevo">+ Crear insumo nuevo…</option>
                                  </select>
                                </div>
                                <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
                                  <input className={CAMPO} type="number" min="0" step="any" value={l.factorTxt}
                                         title="Unidades de inventario por cada unidad facturada"
                                         onChange={(e) => cambiar(k, { factorTxt: e.target.value, factor: Number(e.target.value) })} />
                                  <span className="text-[11px] text-suave">
                                    {ins ? <>1 {nombreUnidad(l.unidad_medida) ?? 'unidad'} = {cantidad(l.factor)} {ins.unidad} · entran <b className="tabular-nums">{cantidad(entran)} {ins.unidad}</b>
                                      {entran > 0 && <> a {pesos(l.total / entran)} c/u</>}</> : 'factor de conversión'}
                                  </span>
                                </div>
                                <select className={CAMPO} value={l.bodega_id ?? ''} onChange={(e) => cambiar(k, { bodega_id: e.target.value || null })}>
                                  <option value="">— Bodega que recibe —</option>
                                  {cat.bodegas.filter((b) => b.activo && esBodegaFisica(b.tipo)).map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                                </select>
                              </div>
                            ) : <span className="text-[11.5px] text-tenue">Se registra como gasto; no entra a ninguna bodega.</span>}
                          </td>
                          {manual && (
                            <td className={TD}>
                              <button type="button" className="text-tenue hover:text-red-700" title="Quitar línea" onClick={() => setLineas(lineas.filter((_, j) => j !== k).map((x, j) => ({ ...x, linea: j + 1 })))}><Trash2 size={14} /></button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr><td colSpan={2} className={`${TD} text-right text-tenue`}>Subtotal · impuestos</td><td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{pesos(leida?.subtotal ?? totales.subtotal)} · {pesos(leida?.impuestos ?? totales.impuestos)}</td><td colSpan={manual ? 3 : 2} /></tr>
                    {leida && leida.retenciones > 0 && <tr><td colSpan={2} className={`${TD} text-right text-tenue`}>Retenciones (no cambian el costo)</td><td className={`${TD} text-right tabular-nums`}>{pesos(leida.retenciones)}</td><td colSpan={2} /></tr>}
                    <tr><td colSpan={2} className={`${TD} text-right font-medium`}>Total</td><td className={`${TD} whitespace-nowrap text-right font-semibold tabular-nums`}>{pesos(leida?.total ?? totales.total)}</td><td colSpan={manual ? 3 : 2} /></tr>
                  </tfoot>
                </table>
              </div>
              {manual && central && (
                <Boton variante="fantasma" className="mt-2" icono={<Plus size={13} />} onClick={() => setLineas([...lineas, lineaVacia(lineas.length + 1, central.id)])}>Otra línea</Boton>
              )}
            </Seccion>

            {faltantes.length > 0 && (
              <p className="mb-4 flex items-center gap-2 text-[12.5px] text-red-700"><AlertTriangle size={14} />
                Línea{faltantes.length > 1 ? 's' : ''} {faltantes.map((l) => l.linea).join(', ')}: falta elegir el insumo, la bodega o la cantidad para entrar a inventario.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Boton disabled={!puedeGuardar} onClick={guardar}>{guardando ? 'Guardando…' : `Guardar factura${totales.inventario ? ` y ${totales.inventario} entrada${totales.inventario > 1 ? 's' : ''} a inventario` : ''}`}</Boton>
              <Boton variante="fantasma" href="/intranet/administrativa?tab=compras">Cancelar</Boton>
            </div>
            <Mensaje error={error} />
          </>
        )}
      </Contenido>

      {nuevoInsumo && (
        <CrearInsumo
          sugerido={nuevoInsumo.nombre}
          onCerrar={() => setNuevoInsumo(null)}
          onCreado={async (ins) => {
            await recargar()
            cambiar(nuevoInsumo.linea, { insumo_id: ins.id, origen: null })
            setNuevoInsumo(null)
          }}
        />
      )}
    </div>
  )
}

function lineaVacia(n: number, bodega: string): Linea {
  return {
    linea: n, codigo: null, descripcion: '', cantidad: 0, unidad_medida: null, precio_unitario: null, subtotal: 0,
    impuesto_pct: null, impuesto_valor: 0, total: 0, clase: 'gasto', insumo_id: null, factor: 1, factorTxt: '1', bodega_id: bodega,
  }
}

/** Crear un insumo sin salir de la factura. El nombre arranca con la descripción de la línea, en limpio. */
function CrearInsumo({ sugerido, onCerrar, onCreado }: { sugerido: string; onCerrar: () => void; onCreado: (i: Insumo) => Promise<void> }) {
  const limpio = sugerido.toLowerCase().replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase())
  const [v, setV] = useState({ nombre: limpio, unidad: 'unidad', presentacion: '' })
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  async function guardar() {
    setOcupado(true); setError(null)
    try {
      const r = await enviar<{ insumo: Insumo }>('/api/administrativa/insumos', 'POST', v)
      await onCreado(r.insumo)
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }
  return (
    <Ventana titulo="Nuevo insumo" onCerrar={onCerrar}>
      <p className="mb-4 text-[12.5px] text-suave">Queda en el catálogo para las próximas facturas y para la app de campo. Escríbelo como lo dice la gente en campo.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" className="sm:col-span-2"><input className={CAMPO} value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} /></Campo>
        <Campo etiqueta="Se cuenta en">
          <input className={CAMPO} list="unidades-nuevo" value={v.unidad} onChange={(e) => setV({ ...v, unidad: e.target.value })} />
          <datalist id="unidades-nuevo">{UNIDADES_INVENTARIO.map((u) => <option key={u} value={u} />)}</datalist>
        </Campo>
        <Campo etiqueta="Presentación"><input className={CAMPO} value={v.presentacion} onChange={(e) => setV({ ...v, presentacion: e.target.value })} placeholder="Bulto x 50 kg" /></Campo>
      </div>
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || !v.nombre.trim() || !v.unidad.trim()} onClick={guardar}>Crear y usar</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}
