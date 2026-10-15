'use client'
import { useMemo, useState } from 'react'
import { ArrowRight, Paperclip, Plus, Scale, Send, Trash2 } from 'lucide-react'
import { Aviso, Boton, MarcaEstado, Seccion, Vacio } from '@/app/components/marca'
import { fetchConSesion } from '@/lib/fetch-sesion'
import {
  cantidad, ESTADO_MOV, fechaCorta, hoyISO, pesos, TIPO_MOV,
  type EstadoMovimiento, type Movimiento, type TipoMovimiento,
} from '@/lib/administrativa'
import { CAMPO, Campo, enviar, Mensaje, Saldo, TD, TH, useCarga, Ventana, type Catalogo } from './comun'

/**
 * INVENTARIO — el saldo de cada bodega, los envíos en camino y el kardex.
 * Desde aquí se reparte de la bodega central a las de proyecto: el envío queda
 * «en camino» hasta que la bodega que recibe lo acepta (en la app de campo o
 * aquí mismo).
 */

const COLOR_ESTADO: Record<EstadoMovimiento, string> = {
  confirmado: 'var(--color-bosque)',
  en_transito: 'var(--color-ambar)',
  rechazado: 'var(--color-red-600)',
  anulado: 'var(--color-tenue)',
}

export default function Inventario({ cat, recargar }: { cat: Catalogo; recargar: () => Promise<void> }) {
  const [filtro, setFiltro] = useState<{ bodega: string; insumo: string; tipo: string }>({ bodega: '', insumo: '', tipo: '' })
  const [ventana, setVentana] = useState<'repartir' | 'ajustar' | null>(null)
  const [soloConSaldo, setSoloConSaldo] = useState(true)
  const [errorAccion, setError] = useState<string | null>(null)

  const bodegas = useMemo(() => cat.bodegas.filter((b) => b.activo), [cat.bodegas])
  const insumo = (id: string) => cat.insumos.find((i) => i.id === id)
  const bodega = (id: string | null) => (id ? cat.bodegas.find((b) => b.id === id)?.nombre ?? '—' : '—')

  const urlKardex = useMemo(() => {
    const qs = new URLSearchParams()
    if (filtro.bodega) qs.set('bodega', filtro.bodega)
    if (filtro.insumo) qs.set('insumo', filtro.insumo)
    if (filtro.tipo) qs.set('tipo', filtro.tipo)
    return `/api/administrativa/movimientos?${qs}`
  }, [filtro])
  const extraer = (j: Record<string, unknown>) => (j.movimientos as Movimiento[]) ?? []
  const kardex = useCarga<Movimiento[]>(urlKardex, extraer, 'No se pudo leer el kardex.')
  const camino = useCarga<Movimiento[]>('/api/administrativa/movimientos?estado=en_transito', extraer)
  const movs = kardex.data
  const enCamino = camino.data ?? []
  const error = errorAccion ?? kardex.error
  const cargarMovs = () => Promise.all([kardex.recargar(), camino.recargar()])

  const tras = async () => { await Promise.all([recargar(), cargarMovs()]) }

  // ── Matriz insumo × bodega ──
  const matriz = useMemo(() => {
    const m = new Map<string, Map<string, { saldo: number; por: number }>>()
    for (const e of cat.existencias) {
      const fila = m.get(e.insumo_id) ?? new Map()
      fila.set(e.bodega_id, { saldo: Number(e.saldo), por: Number(e.por_recibir) })
      m.set(e.insumo_id, fila)
    }
    const filas = cat.insumos
      .filter((i) => i.activo || m.has(i.id))
      .map((i) => {
        const fila = m.get(i.id) ?? new Map()
        const total = [...fila.values()].reduce((s, v) => s + v.saldo, 0)
        return { insumo: i, fila, total, valor: Math.max(0, total) * (Number(i.costo_promedio) || 0) }
      })
    return soloConSaldo ? filas.filter((f) => [...f.fila.values()].some((v) => Math.abs(v.saldo) > 0.0001 || v.por > 0)) : filas
  }, [cat, soloConSaldo])

  async function resolver(m: Movimiento, accion: 'recibir' | 'rechazar' | 'anular') {
    let motivo: string | null = null
    if (accion === 'anular') {
      motivo = window.prompt('¿Por qué se anula este movimiento?')
      if (!motivo?.trim()) return
    }
    try {
      await enviar(`/api/administrativa/movimientos/${m.id}`, 'PATCH', { accion, motivo })
      await tras()
    } catch (e) { setError((e as Error).message) }
  }

  async function verSoporte(id: string) {
    const r = await fetchConSesion(`/api/administrativa/movimientos/${id}`)
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setError(j.error ?? 'No se pudo abrir el soporte.'); return }
    const datos: string = j.soporte.contenido
    const blob = await (await fetch(datos.startsWith('data:') ? datos : `data:${j.soporte.tipo || 'application/octet-stream'};base64,${datos}`)).blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  return (
    <>
      {error && <Aviso tono="arcilla" className="mb-6">{error}</Aviso>}

      <div className="mb-8 flex flex-wrap gap-2">
        <Boton icono={<Send size={13} />} onClick={() => setVentana('repartir')}>Repartir a una bodega</Boton>
        <Boton variante="secundario" icono={<Scale size={13} />} onClick={() => setVentana('ajustar')}>Ajuste por conteo</Boton>
      </div>

      {enCamino.length > 0 && (
        <Seccion titulo="En camino" sub="Envíos que todavía no acepta la bodega que recibe. Ya salieron del origen; entran al destino cuando se aceptan (en la app de campo o aquí).">
          <div className="vidrio rounded-2xl">
            {enCamino.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-fina px-4 py-3 last:border-0">
                <span className="text-[12px] text-tenue">{fechaCorta(m.fecha)}</span>
                <span className="text-[13px] font-medium text-tinta">{cantidad(m.cantidad)} {insumo(m.insumo_id)?.unidad} de {insumo(m.insumo_id)?.nombre}</span>
                <span className="flex items-center gap-1.5 text-[12.5px] text-suave">{bodega(m.origen_id)} <ArrowRight size={12} /> {bodega(m.destino_id)}</span>
                {m.notas && <span className="text-[12px] text-tenue">{m.notas}</span>}
                <span className="ml-auto flex gap-2">
                  <Boton variante="secundario" onClick={() => resolver(m, 'recibir')}>Marcar recibido</Boton>
                  <Boton variante="fantasma" onClick={() => resolver(m, 'rechazar')}>Rechazar</Boton>
                </span>
              </div>
            ))}
          </div>
        </Seccion>
      )}

      <Seccion
        titulo="Saldo por bodega"
        sub="Entradas confirmadas menos salidas. En rojo, un faltante: campo gastó más de lo que la bodega tenía registrado (falta registrar un envío, o hay que ajustar)."
        acciones={
          <label className="flex items-center gap-2 text-[11.5px] text-suave">
            <input type="checkbox" checked={soloConSaldo} onChange={(e) => setSoloConSaldo(e.target.checked)} /> Solo con movimiento
          </label>
        }
      >
        {matriz.length === 0 ? (
          <Vacio>Todavía no ha entrado nada. Sube la primera factura en Compras.</Vacio>
        ) : (
          <div className="overflow-x-auto vidrio rounded-2xl">
            <table className="w-full">
              <thead className="border-b border-linea/70 bg-white/40">
                <tr>
                  <th className={TH}>Insumo</th>
                  {bodegas.map((b) => <th key={b.id} className={`${TH} text-right`}>{b.nombre}</th>)}
                  <th className={`${TH} text-right`}>Total</th>
                  <th className={`${TH} text-right`}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {matriz.map(({ insumo: i, fila, total, valor }) => (
                  <tr key={i.id} className="border-b border-fina">
                    <td className={TD}>
                      <span className={i.activo ? '' : 'text-tenue line-through'}>{i.nombre}</span>
                      <span className="ml-1 text-[11px] text-tenue">{i.unidad}</span>
                    </td>
                    {bodegas.map((b) => {
                      const v = fila.get(b.id)
                      return (
                        <td key={b.id} className={`${TD} whitespace-nowrap text-right`}>
                          <Saldo n={v?.saldo ?? 0} />
                          {v && v.por > 0 && <span className="block text-[10.5px] text-ambar">+{cantidad(v.por)} en camino</span>}
                        </td>
                      )
                    })}
                    <td className={`${TD} text-right`}><Saldo n={total} fuerte /></td>
                    <td className={`${TD} whitespace-nowrap text-right tabular-nums text-suave`}>{valor ? pesos(valor) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-tenue">El valor usa el costo promedio de compra de cada insumo, con IVA.</p>
      </Seccion>

      <Seccion titulo="Kardex" sub="Cada entrada, envío, consumo y ajuste, en orden. Nada se borra: lo que se corrige queda anulado con su motivo.">
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Bodega">
            <select className={CAMPO} value={filtro.bodega} onChange={(e) => setFiltro({ ...filtro, bodega: e.target.value })}>
              <option value="">Todas</option>
              {cat.bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Insumo">
            <select className={CAMPO} value={filtro.insumo} onChange={(e) => setFiltro({ ...filtro, insumo: e.target.value })}>
              <option value="">Todos</option>
              {cat.insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Tipo">
            <select className={CAMPO} value={filtro.tipo} onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value })}>
              <option value="">Todos</option>
              {(Object.keys(TIPO_MOV) as TipoMovimiento[]).map((t) => <option key={t} value={t}>{TIPO_MOV[t]}</option>)}
            </select>
          </Campo>
        </div>
        {movs === null ? <Vacio>Cargando…</Vacio> : movs.length === 0 ? <Vacio>Sin movimientos</Vacio> : (
          <div className="overflow-x-auto vidrio rounded-2xl">
            <table className="w-full">
              <thead className="border-b border-linea/70 bg-white/40">
                <tr>
                  <th className={TH}>Fecha</th><th className={TH}>Tipo</th><th className={TH}>Insumo</th>
                  <th className={`${TH} text-right`}>Cantidad</th><th className={TH}>De → a</th><th className={TH}>Estado</th>
                  <th className={TH}>Detalle</th><th className={TH}></th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => {
                  const i = insumo(m.insumo_id)
                  const signo = filtro.bodega ? (m.destino_id === filtro.bodega ? '+' : '−') : ''
                  return (
                    <tr key={m.id} className={`border-b border-fina ${m.estado === 'anulado' ? 'opacity-50' : ''}`}>
                      <td className={`${TD} whitespace-nowrap`}>{fechaCorta(m.fecha)}</td>
                      <td className={`${TD} whitespace-nowrap`}>{TIPO_MOV[m.tipo]}</td>
                      <td className={TD}>{i?.nombre ?? '—'}</td>
                      <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{signo}{cantidad(m.cantidad)} <span className="text-[10.5px] text-tenue">{i?.unidad}</span></td>
                      <td className={`${TD} whitespace-nowrap text-suave`}>
                        {m.origen_id ? bodega(m.origen_id) : m.tipo === 'entrada' ? 'Proveedor' : '—'} → {m.destino_id ? bodega(m.destino_id) : m.tipo === 'consumo' ? 'Campo' : '—'}
                      </td>
                      <td className={`${TD} whitespace-nowrap`}><MarcaEstado color={COLOR_ESTADO[m.estado]}>{ESTADO_MOV[m.estado]}</MarcaEstado></td>
                      <td className={`${TD} text-[11.5px] text-suave`}>
                        {m.documento}{m.notas ? ` · ${m.notas}` : ''}
                        {m.costo_unitario != null && <span className="block text-tenue">{pesos(m.costo_unitario)} por {i?.unidad}</span>}
                        {m.motivo_anulacion && <span className="block text-red-700">Anulado: {m.motivo_anulacion}</span>}
                        <span className="block text-tenue">{m.creado_por}{m.recibido_por ? ` · recibió ${m.recibido_por}` : ''}</span>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {m.tiene_soporte && (
                          <button type="button" title="Ver soporte de entrega" className="mr-2 text-tenue hover:text-tinta" onClick={() => verSoporte(m.id)}><Paperclip size={14} /></button>
                        )}
                        {(m.tipo === 'traslado' || m.tipo === 'ajuste') && m.estado !== 'anulado' && (
                          <button type="button" title="Anular" className="text-tenue hover:text-red-700" onClick={() => resolver(m, 'anular')}><Trash2 size={14} /></button>
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

      {ventana === 'repartir' && <Repartir cat={cat} onCerrar={() => setVentana(null)} onListo={tras} />}
      {ventana === 'ajustar' && <Ajustar cat={cat} onCerrar={() => setVentana(null)} onListo={tras} />}
    </>
  )
}

function Repartir({ cat, onCerrar, onListo }: { cat: Catalogo; onCerrar: () => void; onListo: () => Promise<void> }) {
  const bodegas = cat.bodegas.filter((b) => b.activo)
  const central = bodegas.find((b) => b.tipo === 'central')
  const [origen, setOrigen] = useState(central?.id ?? '')
  const [destino, setDestino] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [notas, setNotas] = useState('')
  const [entregado, setEntregado] = useState(false)
  const [items, setItems] = useState<{ insumo_id: string; cantidad: string }[]>([{ insumo_id: '', cantidad: '' }])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const saldo = (b: string, i: string) => Number(cat.existencias.find((e) => e.bodega_id === b && e.insumo_id === i)?.saldo ?? 0)
  const conSaldo = cat.insumos.filter((i) => i.activo && (!origen || saldo(origen, i.id) > 0))

  async function guardar() {
    setOcupado(true); setError(null)
    try {
      await enviar('/api/administrativa/movimientos', 'POST', {
        accion: 'trasladar', origen_id: origen, destino_id: destino, fecha, notas, entregado,
        items: items.filter((i) => i.insumo_id && Number(i.cantidad) > 0).map((i) => ({ insumo_id: i.insumo_id, cantidad: Number(i.cantidad) })),
      })
      await onListo(); onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo="Repartir a una bodega" onCerrar={onCerrar}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Sale de">
          <select className={CAMPO} value={origen} onChange={(e) => setOrigen(e.target.value)}>
            <option value="">—</option>
            {bodegas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Va para">
          <select className={CAMPO} value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">—</option>
            {bodegas.filter((b) => b.id !== origen).map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Fecha"><input type="date" className={CAMPO} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
      </div>

      <p className="mb-2 mt-5 text-[10px] uppercase tracking-[.16em] text-tenue">Insumos</p>
      {items.map((it, k) => {
        const ins = cat.insumos.find((i) => i.id === it.insumo_id)
        const disp = origen && it.insumo_id ? saldo(origen, it.insumo_id) : null
        return (
          <div key={k} className="mb-2 grid grid-cols-[1fr_8rem_2rem] items-start gap-2">
            <div>
              <select className={CAMPO} value={it.insumo_id} onChange={(e) => setItems(items.map((x, j) => j === k ? { ...x, insumo_id: e.target.value } : x))}>
                <option value="">— Insumo —</option>
                {conSaldo.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({cantidad(saldo(origen, i.id))} {i.unidad})</option>)}
              </select>
              {disp !== null && Number(it.cantidad) > disp && (
                <p className="mt-1 text-[11px] text-red-700">Hay {cantidad(disp)} {ins?.unidad} en el origen: el saldo quedará en negativo.</p>
              )}
            </div>
            <input className={CAMPO} type="number" min="0" step="any" placeholder={ins?.unidad ?? 'Cantidad'} value={it.cantidad}
                   onChange={(e) => setItems(items.map((x, j) => j === k ? { ...x, cantidad: e.target.value } : x))} />
            <button type="button" className="py-2 text-tenue hover:text-red-700" title="Quitar" onClick={() => setItems(items.filter((_, j) => j !== k))}><Trash2 size={15} /></button>
          </div>
        )
      })}
      <Boton variante="fantasma" icono={<Plus size={13} />} onClick={() => setItems([...items, { insumo_id: '', cantidad: '' }])}>Otro insumo</Boton>

      <Campo etiqueta="Notas" className="mt-4">
        <input className={CAMPO} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Quién lo lleva, para qué predio…" />
      </Campo>
      <label className="mt-4 flex items-start gap-2 text-[12.5px] text-suave">
        <input type="checkbox" className="mt-0.5" checked={entregado} onChange={(e) => setEntregado(e.target.checked)} />
        <span>Ya se entregó. Entra de una vez al destino, sin esperar a que lo acepten. Úsalo para registrar entregas pasadas.</span>
      </label>
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || !origen || !destino} onClick={guardar}>{entregado ? 'Registrar entrega' : 'Enviar'}</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}

function Ajustar({ cat, onCerrar, onListo }: { cat: Catalogo; onCerrar: () => void; onListo: () => Promise<void> }) {
  const [bodega, setBodega] = useState('')
  const [insumoId, setInsumoId] = useState('')
  const [conteo, setConteo] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [notas, setNotas] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const ins = cat.insumos.find((i) => i.id === insumoId)
  const saldo = Number(cat.existencias.find((e) => e.bodega_id === bodega && e.insumo_id === insumoId)?.saldo ?? 0)
  const diferencia = conteo === '' ? null : Number(conteo) - saldo

  async function guardar() {
    if (diferencia === null || Math.abs(diferencia) < 0.0001) return
    setOcupado(true); setError(null)
    try {
      await enviar('/api/administrativa/movimientos', 'POST', {
        accion: 'ajustar', bodega_id: bodega, insumo_id: insumoId, fecha,
        cantidad: Math.abs(diferencia), sentido: diferencia > 0 ? 'entra' : 'sale', notas,
      })
      await onListo(); onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo="Ajuste por conteo físico" onCerrar={onCerrar}>
      <p className="mb-4 text-[12.5px] text-suave">Escribe cuánto hay de verdad en la bodega. La diferencia con el saldo del sistema queda como un ajuste, con su motivo.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Bodega">
          <select className={CAMPO} value={bodega} onChange={(e) => setBodega(e.target.value)}>
            <option value="">—</option>
            {cat.bodegas.filter((b) => b.activo).map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Insumo">
          <select className={CAMPO} value={insumoId} onChange={(e) => setInsumoId(e.target.value)}>
            <option value="">—</option>
            {cat.insumos.filter((i) => i.activo).map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta={`Hay contado${ins ? ` (${ins.unidad})` : ''}`}>
          <input className={CAMPO} type="number" min="0" step="any" value={conteo} onChange={(e) => setConteo(e.target.value)} />
        </Campo>
        <Campo etiqueta="Fecha del conteo"><input type="date" className={CAMPO} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
      </div>
      {bodega && insumoId && (
        <p className="mt-3 text-[12.5px] text-suave">
          El sistema dice <b className="tabular-nums">{cantidad(saldo)}</b> {ins?.unidad}.
          {diferencia !== null && Math.abs(diferencia) >= 0.0001 && <> Se registra un {diferencia > 0 ? 'sobrante' : 'faltante'} de <b className="tabular-nums">{cantidad(Math.abs(diferencia))}</b>.</>}
          {diferencia !== null && Math.abs(diferencia) < 0.0001 && <> Coincide: no hay nada que ajustar.</>}
        </p>
      )}
      <Campo etiqueta="Motivo" className="mt-4">
        <input className={CAMPO} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Conteo de fin de mes, bulto dañado por agua…" />
      </Campo>
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || !bodega || !insumoId || diferencia === null || Math.abs(diferencia) < 0.0001 || !notas.trim()} onClick={guardar}>Registrar ajuste</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}
