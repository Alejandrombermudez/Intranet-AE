'use client'
import { useCallback, useEffect, useState } from 'react'
import { fechaBogota, fechaCorta, hoyBogota, hora12, horaBogota } from '@/lib/vehiculos/horas'
import { enviar, llamar, type MiReserva, type Vehiculo } from '@/lib/vehiculos/cliente'
import Calendario, { type Hueco } from './Calendario'
import ModalReserva from './ModalReserva'
import Escaner from './Escaner'

/**
 * Lo que ve quien no administra: blanco, centrado, dos botones.
 * «Recepción» (o «Devolución» si ya tiene un vehículo en la mano) y «Calendario».
 * En Recepción se elige el vehículo de la lista o se lee su QR.
 */

type Tipo = 'recepcion' | 'devolucion'

interface Disponible {
  id: string; nombre: string; corto: string; placa: string | null; color: string; foto: string | null
  estado: 'mio' | 'libre' | 'reservado' | 'ocupado' | 'enUso'
  quien?: string; desde?: string; hasta?: string; libreHasta?: string | null; proximo?: string | null
}
interface FilaReserva { id: string; vehicle_id: string; start_at: string; end_at: string; purpose: string | null; tomado_at: string | null; devuelto_at: string | null }
interface Estado {
  vehiculos: Disponible[]
  miEnUso: { reserva: FilaReserva; vehiculo: { id: string; nombre: string; placa: string | null; tarjeta: string | null } } | null
}
type Tomar =
  | { accion: Tipo; vehiculo: { id: string; nombre: string }; reserva: FilaReserva }
  | { accion: 'sin-reserva'; vehiculo: { id: string; nombre: string } }

const aMiReserva = (r: FilaReserva): MiReserva => ({
  id: r.id, vehicle_id: r.vehicle_id, start_at: r.start_at, end_at: r.end_at, motivo: r.purpose,
  tomado_at: r.tomado_at, devuelto_at: r.devuelto_at, checkInHecho: false, checkOutHecho: false,
})

/** «4:00 p. m.» si es hoy; «13 nov 12:00 a. m.» si es otro día. */
function cuandoCorto(iso: string): string {
  const f = fechaBogota(new Date(new Date(iso).getTime() - 1))
  return f === hoyBogota() ? hora12(horaBogota(iso)) : `${fechaCorta(f)}`
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export default function Simple({
  nombre, yoId, vehiculos, qr, recarga, onInspeccion, onQrUsado,
}: {
  nombre: string
  yoId: string
  vehiculos: Vehiculo[]
  qr: string | null
  recarga: number
  onInspeccion: (r: MiReserva, tipo: Tipo, aviso?: string) => void
  onQrUsado: () => void
}) {
  const [pantalla, setPantalla] = useState<'inicio' | 'elegir' | 'qr' | 'hasta' | 'calendario'>('inicio')
  const [estado, setEstado] = useState<Estado | null>(null)
  const [proximas, setProximas] = useState<MiReserva[]>([])
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const [verTarjeta, setVerTarjeta] = useState(false)
  // «Hasta» de una toma sin reserva
  const [elegido, setElegido] = useState<Disponible | { id: string; nombre: string; libreHasta?: string | null } | null>(null)
  const [hastaHora, setHastaHora] = useState('')
  const [actividad, setActividad] = useState('')
  // Calendario
  const [hueco, setHueco] = useState<Hueco | null | undefined>(undefined)
  const [recargaCal, setRecargaCal] = useState(0)

  const cargar = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([
        llamar<Estado>('/api/vehiculos/disponibles'),
        llamar<{ reservas: MiReserva[] }>('/api/vehiculos/mis-reservas'),
      ])
      setEstado(d)
      setProximas(m.reservas.filter((r) => !r.tomado_at && !r.checkInHecho && new Date(r.end_at).getTime() > Date.now()))
      setError('')
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { cargar() }, [cargar, recarga])

  /** Elegir un vehículo (de la lista o por QR). */
  const tomar = useCallback(async (vehiculoId: string, extra?: { hasta: { fecha: string; hora: string }; actividad: string }) => {
    setTrabajando(true); setError('')
    try {
      const t = await enviar<Tomar>('/api/vehiculos/tomar', 'POST', { vehiculoId, ...extra })
      if (t.accion === 'sin-reserva') {
        const d = estado?.vehiculos.find((v) => v.id === vehiculoId)
        const ahora = Number(horaBogota(new Date()).slice(0, 2)) * 60 + Number(horaBogota(new Date()).slice(3, 5))
        let fin = Math.min(Math.ceil((ahora + 240) / 15) * 15, 23 * 60 + 45)
        if (d?.libreHasta && fechaBogota(d.libreHasta) === hoyBogota()) {
          const [h, m] = horaBogota(d.libreHasta).split(':').map(Number)
          fin = Math.min(fin, h * 60 + m)
        }
        setElegido(d ?? { id: t.vehiculo.id, nombre: t.vehiculo.nombre })
        setHastaHora(hhmm(fin))
        setActividad('')
        setPantalla('hasta')
        return
      }
      const aviso = t.accion === 'recepcion' && t.reserva.tomado_at
        ? `${t.vehiculo.nombre}: tomado a las ${hora12(horaBogota(t.reserva.tomado_at))}`
        : undefined
      onInspeccion(aMiReserva(t.reserva), t.accion, aviso)
    } catch (e) {
      setError((e as Error).message)
      setPantalla('elegir')
    } finally { setTrabajando(false) }
  }, [estado, onInspeccion])

  // QR que llegó en la dirección (lo leyó la cámara del celular, fuera de la app).
  useEffect(() => {
    if (qr && estado) { onQrUsado(); tomar(qr) }
  }, [qr, estado, tomar, onQrUsado])

  const cancelar = async (id: string) => {
    try { await enviar(`/api/vehiculos/reservas?id=${id}`, 'DELETE'); cargar() } catch (e) { setError((e as Error).message) }
  }

  const V = Object.fromEntries(vehiculos.map((v) => [v.id, v]))
  const enUso = estado?.miEnUso

  if (!estado) return <div className="simple"><p className="cargando">{error || 'Cargando…'}</p></div>

  // ── Calendario ──
  if (pantalla === 'calendario') {
    return (
      <div className="simple ancho">
        <div className="simple-barra">
          <button className="btn suave chico" onClick={() => { setPantalla('inicio'); cargar() }}>← Volver</button>
          <button className="btn ambar chico" onClick={() => setHueco(null)}>+ Reservar</button>
        </div>
        <Calendario vehiculos={vehiculos} recarga={recargaCal} yoId={yoId} puedeReservar onHueco={setHueco} onReserva={() => {}} />
        <p className="tenue centro" style={{ marginTop: 8 }}>Toca un espacio libre para reservar a esa hora.</p>
        {hueco !== undefined && (
          <ModalReserva vehiculos={vehiculos} hueco={hueco}
            onCerrar={() => setHueco(undefined)}
            onHecho={() => { setHueco(undefined); setRecargaCal((n) => n + 1) }} />
        )}
      </div>
    )
  }

  // ── Leer QR ──
  if (pantalla === 'qr') {
    return <div className="simple"><Escaner onLeido={(id) => { setPantalla('elegir'); tomar(id) }} onCerrar={() => setPantalla('elegir')} /></div>
  }

  // ── Tomar sin reserva: ¿hasta qué hora? ──
  if (pantalla === 'hasta' && elegido) {
    const lim = 'libreHasta' in elegido && elegido.libreHasta && fechaBogota(elegido.libreHasta) === hoyBogota() ? hora12(horaBogota(elegido.libreHasta)) : null
    return (
      <div className="simple">
        <h1>{elegido.nombre}</h1>
        <p className="tenue centro">No tenías reserva. Lo reservamos desde ahora.</p>
        <div className="tarjeta" style={{ width: '100%' }}>
          <label className="campo"><span>¿Hasta qué hora lo usas hoy?</span>
            <input type="time" step={900} value={hastaHora} onChange={(e) => setHastaHora(e.target.value)} />
          </label>
          {lim && <p className="tenue" style={{ marginTop: -6, marginBottom: 12 }}>Está libre hasta las {lim}.</p>}
          <label className="campo"><span>¿Para qué?</span>
            <input type="text" maxLength={100} value={actividad} onChange={(e) => setActividad(e.target.value)} placeholder="Ej: Visita a predios" />
          </label>
          {error && <div className="aviso error">{error}</div>}
          <button className="btn grande" disabled={trabajando || !actividad.trim() || !hastaHora}
            onClick={() => tomar(elegido.id, { hasta: { fecha: hoyBogota(), hora: hastaHora }, actividad })}>
            {trabajando ? 'Un momento…' : 'Tomar el vehículo'}
          </button>
        </div>
        <p className="tenue centro">¿Lo necesitas varios días? Resérvalo en el calendario.</p>
        <button className="btn suave grande" onClick={() => { setError(''); setPantalla('elegir') }}>Volver</button>
      </div>
    )
  }

  // ── Recepción: elegir el vehículo ──
  if (pantalla === 'elegir') {
    return (
      <div className="simple">
        <h1>¿Qué vehículo vas a tomar?</h1>
        <button className="btn grande" onClick={() => setPantalla('qr')}>Leer el QR del vehículo</button>
        {error && <div className="aviso error" style={{ width: '100%' }}>{error}</div>}
        <div className="elegir">
          {estado.vehiculos.map((v) => {
            const puede = v.estado === 'mio' || v.estado === 'libre'
            const detalle = v.estado === 'mio' ? `Tu reserva, hasta ${cuandoCorto(v.hasta!)}`
              : v.estado === 'libre' ? (v.libreHasta ? `Libre hasta ${fechaBogota(v.libreHasta) === hoyBogota() ? '' : fechaCorta(fechaBogota(v.libreHasta)) + ' · '}${hora12(horaBogota(v.libreHasta))}` : 'Libre')
              : v.estado === 'reservado' ? `Reservado por ${v.quien} hasta el ${cuandoCorto(v.hasta!)}`
              : v.estado === 'ocupado' ? `Lo tiene ${v.quien}`
              : 'Lo tienes tú'
            return (
              <button key={v.id} className={`opcion ${v.estado}`} disabled={!puede || trabajando} onClick={() => tomar(v.id)}>
                <span className="miniatura" style={{ background: v.color }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- enlace firmado del bucket privado */}
                  {v.foto && <img src={v.foto} alt="" />}
                </span>
                <span className="texto"><b>{v.nombre}</b><small>{detalle}</small></span>
              </button>
            )
          })}
        </div>
        <button className="btn suave grande" onClick={() => { setError(''); setPantalla('inicio') }}>Volver</button>
      </div>
    )
  }

  // ── Inicio ──
  return (
    <div className="simple">
      <p className="saludo">Hola, {nombre.split(' ')[0]}</p>
      {error && <div className="aviso error" style={{ width: '100%' }}>{error}</div>}

      {enUso ? (
        <>
          <button className="principal entregar" onClick={() => onInspeccion(aMiReserva(enUso.reserva), 'devolucion')}>
            Devolución
            <small>{enUso.vehiculo.nombre} · desde las {hora12(horaBogota(enUso.reserva.tomado_at!))}</small>
          </button>
          {enUso.vehiculo.tarjeta && <button className="btn suave grande" onClick={() => setVerTarjeta(true)}>Ver tarjeta de propiedad</button>}
        </>
      ) : (
        <button className="principal recibir" onClick={() => { setError(''); setPantalla('elegir') }} disabled={trabajando}>
          Recepción
          <small>Tomar un vehículo</small>
        </button>
      )}

      <button className="principal calendario" onClick={() => setPantalla('calendario')}>
        Calendario
        <small>Ver y reservar por horas</small>
      </button>

      {proximas.length > 0 && (
        <div className="proximas">
          <p className="tenue">Tus reservas</p>
          {proximas.map((r) => (
            <div key={r.id} className="proxima">
              <span><b>{V[r.vehicle_id]?.corto ?? r.vehicle_id}</b> · {fechaCorta(fechaBogota(r.start_at))} {hora12(horaBogota(r.start_at))} – {hora12(horaBogota(r.end_at))}</span>
              <button className="enlace" onClick={() => cancelar(r.id)}>Cancelar</button>
            </div>
          ))}
        </div>
      )}

      {verTarjeta && enUso?.vehiculo.tarjeta && (
        <div className="visor" onClick={() => setVerTarjeta(false)}>
          <p>Tarjeta de propiedad · {enUso.vehiculo.nombre}{enUso.vehiculo.placa ? ` · ${enUso.vehiculo.placa}` : ''}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- enlace firmado del bucket privado */}
          <img src={enUso.vehiculo.tarjeta} alt="Tarjeta de propiedad" />
          <button className="btn blanco" onClick={() => setVerTarjeta(false)}>Cerrar</button>
        </div>
      )}
    </div>
  )
}
