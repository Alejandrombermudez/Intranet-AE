'use client'
import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { enviar, llamar, type Vehiculo } from '@/lib/vehiculos/cliente'
import { fechaBogota, fechaCorta, hora12, horaBogota } from '@/lib/vehiculos/horas'
import { comprimir } from './Inspeccion'

interface Fila { id: string; nombre: string; email: string | null; esAdmin: boolean; activo: boolean; pin: 'sin' | 'inicial' | 'propio'; bloqueado: boolean }

const ESTADO_PIN = { sin: 'Sin PIN', inicial: 'PIN inicial (aún no lo cambia)', propio: 'Ya creó su PIN' }

/** Administración (quien entra con Microsoft siendo admin de la intranet o de Financiero). */
export default function Admin({ yoId, vehiculos, onCambio }: { yoId: string; vehiculos: Vehiculo[]; onCambio: () => void }) {
  const [vista, setVista] = useState<'registros' | 'personas' | 'vehiculos'>('registros')
  return (
    <div>
      <div className="pestanas">
        <button className={`pestana ${vista === 'registros' ? 'activa' : ''}`} onClick={() => setVista('registros')}>Recepciones y devoluciones</button>
        <button className={`pestana ${vista === 'personas' ? 'activa' : ''}`} onClick={() => setVista('personas')}>Personas y PIN</button>
        <button className={`pestana ${vista === 'vehiculos' ? 'activa' : ''}`} onClick={() => setVista('vehiculos')}>Vehículos y QR</button>
      </div>
      {vista === 'registros' && <Registros vehiculos={vehiculos} />}
      {vista === 'personas' && <Personas yoId={yoId} onCambio={onCambio} />}
      {vista === 'vehiculos' && <Vehiculos vehiculos={vehiculos} onCambio={onCambio} />}
    </div>
  )
}

function Personas({ yoId, onCambio }: { yoId: string; onCambio: () => void }) {
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [pines, setPines] = useState<Record<string, string>>({})
  const solo4 = (v: string) => v.replace(/\D/g, '').slice(0, 4)

  const cargar = useCallback(() => {
    llamar<{ personas: Fila[] }>('/api/vehiculos/admin/personas').then((d) => setFilas(d.personas)).catch((e: Error) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])

  const hecho = (texto: string) => { setAviso(texto); setError(''); cargar(); onCambio() }

  const agregar = async () => {
    try {
      await enviar('/api/vehiculos/admin/personas', 'POST', { nombre, email, pin })
      hecho(pin ? `${nombre} quedó con el PIN inicial ${pin}. Al entrar la primera vez creará el suyo.` : `${nombre} quedó en la lista. Ponle un PIN inicial para que pueda entrar sin correo.`)
      setNombre(''); setEmail(''); setPin('')
    } catch (e) { setError((e as Error).message) }
  }

  const ponerPin = async (f: Fila) => {
    const p = pines[f.id] ?? ''
    try {
      await enviar('/api/vehiculos/admin/personas', 'PATCH', { id: f.id, accion: 'pin', pin: p })
      setPines((x) => ({ ...x, [f.id]: '' }))
      hecho(`${f.nombre}: PIN inicial ${p}. Al entrar le pedirá crear el suyo.`)
    } catch (e) { setError((e as Error).message) }
  }

  const activar = async (f: Fila, accion: 'activar' | 'desactivar' | 'hacer-admin' | 'quitar-admin') => {
    try { await enviar('/api/vehiculos/admin/personas', 'PATCH', { id: f.id, accion }); hecho('') } catch (e) { setError((e as Error).message) }
  }

  return (
    <div>
      {error && <div className="aviso error">{error}</div>}
      {aviso && <div className="aviso info">{aviso}</div>}

      <div className="tarjeta" style={{ marginBottom: 16 }}>
        <b>Agregar a alguien</b>
        <p className="tenue" style={{ margin: '4px 0 12px' }}>Quien no tiene correo entra con su nombre y el PIN inicial; la primera vez crea el suyo.</p>
        <label className="campo"><span>Nombre completo</span><input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
        <div className="fila2">
          <label className="campo"><span>Correo (opcional)</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="campo"><span>PIN inicial</span><input type="text" inputMode="numeric" value={pin} onChange={(e) => setPin(solo4(e.target.value))} placeholder="4 números" /></label>
        </div>
        <button className="btn" onClick={agregar} disabled={nombre.trim().length < 3 || (pin !== '' && pin.length !== 4)}>Agregar</button>
      </div>

      <div className="tarjeta">
        {!filas ? <p className="cargando">Cargando…</p> : filas.map((f) => (
          <div key={f.id} className={`persona ${f.activo ? '' : 'inactiva'}`}>
            <div className="quien">
              <b>{f.nombre}</b> {f.esAdmin && <span className="etiqueta">Admin</span>} {f.bloqueado && <span className="etiqueta roja">Bloqueado</span>}
              <div className="tenue">{f.email ?? 'Sin correo'} · {ESTADO_PIN[f.pin]}{f.activo ? '' : ' · Inactiva'}</div>
            </div>
            <div className="botones">
              {f.activo && (
                <>
                  <input className="pin-chico" type="text" inputMode="numeric" placeholder="PIN" value={pines[f.id] ?? ''}
                    onChange={(e) => setPines((x) => ({ ...x, [f.id]: solo4(e.target.value) }))} />
                  <button className="btn suave chico" disabled={(pines[f.id] ?? '').length !== 4} onClick={() => ponerPin(f)}>
                    {f.pin === 'sin' ? 'Poner PIN inicial' : 'Reiniciar PIN'}
                  </button>
                </>
              )}
              {f.activo && f.id !== yoId && (
                <button className="btn suave chico" onClick={() => activar(f, f.esAdmin ? 'quitar-admin' : 'hacer-admin')}
                  title="Administrar: ver recepciones y devoluciones, personas y vehículos">
                  {f.esAdmin ? 'Quitar acceso a Administrar' : 'Dar acceso a Administrar'}
                </button>
              )}
              {f.activo
                ? f.id !== yoId && <button className="btn peligro chico" onClick={() => activar(f, 'desactivar')}>Desactivar</button>
                : <button className="btn suave chico" onClick={() => activar(f, 'activar')}>Activar</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Vehiculos({ vehiculos, onCambio }: { vehiculos: Vehiculo[]; onCambio: () => void }) {
  const [qrs, setQrs] = useState<Record<string, string>>({})
  const [datos, setDatos] = useState<Record<string, { placa: string; soat: string; tecno: string }>>({})
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [subiendo, setSubiendo] = useState<string | null>(null)

  useEffect(() => {
    const base = window.location.origin
    Promise.all(vehiculos.map(async (v) => [v.id, await QRCode.toDataURL(`${base}/vehiculos?qr=${v.id}`, { margin: 1, width: 600 })] as const))
      .then((pares) => setQrs(Object.fromEntries(pares)))
    setDatos(Object.fromEntries(vehiculos.map((v) => [v.id, { placa: v.placa ?? '', soat: v.soat_vence ?? '', tecno: v.tecnomecanica_vence ?? '' }])))
  }, [vehiculos])

  const guardar = async (v: Vehiculo) => {
    const d = datos[v.id]
    try {
      await enviar('/api/vehiculos/admin/vehiculos', 'PATCH', { id: v.id, placa: d.placa, soat_vence: d.soat, tecnomecanica_vence: d.tecno })
      setAviso(`${v.nombre}: guardado.`); setError(''); onCambio()
    } catch (e) { setError((e as Error).message) }
  }

  const subir = async (v: Vehiculo, cual: 'foto' | 'tarjeta', archivo: File | undefined) => {
    if (!archivo) return
    setSubiendo(`${v.id}:${cual}`); setError('')
    try {
      const fd = new FormData()
      fd.append('id', v.id)
      fd.append('cual', cual)
      // La tarjeta se deja más grande para que se lea la letra menuda.
      fd.append('archivo', await comprimir(archivo, cual === 'tarjeta' ? 2000 : 1280, 0.85), `${cual}.jpg`)
      const res = await fetch('/api/vehiculos/admin/vehiculos', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo subir.')
      setAviso(`${v.nombre}: ${cual === 'foto' ? 'foto' : 'tarjeta de propiedad'} actualizada.`)
      onCambio()
    } catch (e) { setError((e as Error).message) } finally { setSubiendo(null) }
  }

  const campo = (id: string, k: 'placa' | 'soat' | 'tecno', valor: string) =>
    setDatos((x) => ({ ...x, [id]: { ...x[id], [k]: valor } }))

  return (
    <div>
      {error && <div className="aviso error">{error}</div>}
      {aviso && <div className="aviso info">{aviso}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn suave" onClick={() => window.print()}>Imprimir los QR</button>
      </div>

      <div className="lista">
        {vehiculos.map((v) => {
          const d = datos[v.id] ?? { placa: '', soat: '', tecno: '' }
          return (
            <div key={v.id} className="tarjeta" style={{ borderLeft: `6px solid ${v.color}` }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>{v.nombre}</h3>
              <div className="fila2">
                <label className="campo"><span>Placa</span><input type="text" value={d.placa} onChange={(e) => campo(v.id, 'placa', e.target.value)} /></label>
                <span />
                <label className="campo"><span>SOAT vence</span><input type="date" value={d.soat} onChange={(e) => campo(v.id, 'soat', e.target.value)} /></label>
                <label className="campo"><span>Tecnomecánica vence</span><input type="date" value={d.tecno} onChange={(e) => campo(v.id, 'tecno', e.target.value)} /></label>
              </div>
              <button className="btn chico" onClick={() => guardar(v)}>Guardar datos</button>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '14px 0' }}>
                {(['foto', 'tarjeta'] as const).map((cual) => (
                  <label key={cual} className="btn suave chico" style={{ cursor: 'pointer' }}>
                    {subiendo === `${v.id}:${cual}` ? 'Subiendo…' : cual === 'foto'
                      ? (v.foto ? 'Cambiar foto del vehículo' : 'Subir foto del vehículo')
                      : (v.tarjeta ? 'Cambiar tarjeta de propiedad' : 'Subir tarjeta de propiedad')}
                    <input type="file" accept="image/*" hidden onChange={(e) => { subir(v, cual, e.target.files?.[0]); e.target.value = '' }} />
                  </label>
                ))}
              </div>

              {qrs[v.id] && (
                <div className="qr">
                  {/* eslint-disable-next-line @next/next/no-img-element -- QR generado en el navegador */}
                  <img src={qrs[v.id]} alt={`QR de ${v.nombre}`} />
                  <div>
                    <b>QR para pegar en el vehículo</b>
                    <p className="tenue">Al leerlo, queda registrada la hora en que se toma.</p>
                    <a className="btn suave chico" style={{ marginTop: 8 }} href={qrs[v.id]} download={`QR-${v.corto}.png`}>Descargar</a>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Hoja para imprimir: un QR grande por vehículo, con el nombre. */}
      <div className="imprimible" style={{ display: 'none' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24 }}>
          {vehiculos.map((v) => qrs[v.id] && (
            <div key={v.id} style={{ textAlign: 'center', border: '1px solid #ccc', borderRadius: 12, padding: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- QR generado en el navegador */}
              <img src={qrs[v.id]} alt="" style={{ width: '100%', maxWidth: 260 }} />
              <p style={{ fontWeight: 600, fontSize: 18, marginTop: 8 }}>{v.nombre}{v.placa ? ` · ${v.placa}` : ''}</p>
              <p style={{ fontSize: 12 }}>Léelo al tomar el vehículo</p>
            </div>
          ))}
        </div>
      </div>
      <style>{'@media print { .vh .imprimible { display: block !important; } }'}</style>
    </div>
  )
}

interface Registro {
  id: string; vehicle_id: string; user_name: string; start_at: string; end_at: string; purpose: string | null
  tomado_at: string | null; devuelto_at: string | null
  inspecciones: { tipo: 'recepcion' | 'devolucion'; cuando: string; km: number | null; novedades: string[]; fotos: string[] }[]
}

/** Quién tomó qué vehículo y cuándo, con kilometraje, novedades y fotos de cada inspección. */
function Registros({ vehiculos }: { vehiculos: Vehiculo[] }) {
  const [dias, setDias] = useState(30)
  const [lista, setLista] = useState<Registro[] | null>(null)
  const [error, setError] = useState('')
  const [solo, setSolo] = useState<'todos' | 'usados'>('usados')
  const [foto, setFoto] = useState<string | null>(null)
  const V = Object.fromEntries(vehiculos.map((v) => [v.id, v]))

  useEffect(() => {
    llamar<{ registros: Registro[] }>(`/api/vehiculos/admin/registros?dias=${dias}`)
      .then((d) => { setLista(d.registros); setError('') })
      .catch((e: Error) => setError(e.message))
  }, [dias])

  const cuando = (iso: string) => `${fechaCorta(fechaBogota(iso))} ${hora12(horaBogota(iso))}`
  const filas = (lista ?? []).filter((r) => solo === 'todos' || r.tomado_at || r.inspecciones.length)

  return (
    <div>
      <div className="barra-cal">
        <div className="grupo">
          <button className={solo === 'usados' ? 'on' : ''} onClick={() => setSolo('usados')}>Con recepción</button>
          <button className={solo === 'todos' ? 'on' : ''} onClick={() => setSolo('todos')}>Todas las reservas</button>
        </div>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))} style={{ width: 'auto' }}>
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
          <option value={365}>Último año</option>
        </select>
      </div>
      {error && <div className="aviso error">{error}</div>}
      {!lista ? <p className="cargando">Cargando…</p> : filas.length === 0 ? <div className="vacio">No hay registros en ese periodo.</div> : (
        <div className="lista">
          {filas.map((r) => {
            const v = V[r.vehicle_id]
            const sinDevolver = r.tomado_at && !r.devuelto_at
            return (
              <div key={r.id} className="registro" style={{ borderLeftColor: v?.color }}>
                <div className="linea-r">
                  <b>{v?.nombre ?? r.vehicle_id} · {r.user_name}</b>
                  <span className="tenue">Reserva {cuando(r.start_at)} → {cuando(r.end_at)}</span>
                </div>
                {r.purpose && <p className="tenue">{r.purpose}</p>}
                <div className="linea-r" style={{ marginTop: 6 }}>
                  <span>{r.tomado_at ? `Tomado ${cuando(r.tomado_at)}` : 'Sin tomar'}</span>
                  <span>{r.devuelto_at ? `Devuelto ${cuando(r.devuelto_at)}` : sinDevolver ? <span className="etiqueta roja">Sin devolver</span> : null}</span>
                </div>
                {[...r.inspecciones].sort((a, b) => a.cuando.localeCompare(b.cuando)).map((i) => (
                  <div key={i.tipo} style={{ marginTop: 10 }}>
                    <span className={`etiqueta ${i.tipo === 'devolucion' ? 'ambar' : ''}`}>{i.tipo === 'recepcion' ? 'Recepción' : 'Devolución'}</span>
                    <span className="tenue"> · {i.km != null ? `${i.km.toLocaleString('es-CO')} km` : 'sin km'} · {i.novedades.length ? `${i.novedades.length} novedad${i.novedades.length > 1 ? 'es' : ''}` : 'sin novedades'}</span>
                    {i.novedades.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>{i.novedades.map((n) => <li key={n}>{n}</li>)}</ul>}
                    {i.fotos.length > 0 && (
                      <div className="mini-fotos">
                        {/* eslint-disable-next-line @next/next/no-img-element -- fotos de la inspección */}
                        {i.fotos.map((f) => <img key={f} src={f} alt="" onClick={() => setFoto(f)} />)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
      {foto && (
        <div className="visor" onClick={() => setFoto(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- foto de la inspección */}
          <img src={foto} alt="" />
          <button className="btn blanco" onClick={() => setFoto(null)}>Cerrar</button>
        </div>
      )}
    </div>
  )
}
