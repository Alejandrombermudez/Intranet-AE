'use client'
import { useCallback, useEffect, useState } from 'react'
import { fechaBogota, fechaCorta, hoyBogota, hora12, horaBogota } from '@/lib/vehiculos/horas'
import { enviar, llamar, separarMotivo, type MiReserva, type Vehiculo } from '@/lib/vehiculos/cliente'

type Tipo = 'recepcion' | 'devolucion'

/** Lo primero que se ve: recibir o entregar un vehículo, y mis reservas. */
export default function Inicio({
  vehiculos, recarga, onReservar, onInspeccion, onCambio,
}: {
  vehiculos: Vehiculo[]
  recarga: number
  onReservar: () => void
  onInspeccion: (r: MiReserva, tipo: Tipo) => void
  onCambio: () => void
}) {
  const [lista, setLista] = useState<MiReserva[] | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [elegir, setElegir] = useState<{ tipo: Tipo; opciones: MiReserva[] } | null>(null)
  const [borrar, setBorrar] = useState<string | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())
  const V = Object.fromEntries(vehiculos.map((v) => [v.id, v]))

  const cargar = useCallback(() => {
    llamar<{ reservas: MiReserva[] }>('/api/vehiculos/mis-reservas')
      .then((d) => { setLista(d.reservas); setAhora(Date.now()); setError('') })
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar, recarga])

  const hoy = hoyBogota()
  const paraRecibir = (lista ?? []).filter((r) => !r.tomado_at && !r.checkInHecho && fechaBogota(r.start_at) <= hoy && new Date(r.end_at).getTime() > ahora)
  const paraEntregar = (lista ?? []).filter((r) => (r.tomado_at || r.checkInHecho) && !r.devuelto_at && !r.checkOutHecho)

  const accion = (tipo: Tipo) => {
    setAviso('')
    const opciones = tipo === 'recepcion' ? paraRecibir : paraEntregar
    if (opciones.length === 1) return onInspeccion(opciones[0], tipo)
    if (opciones.length > 1) return setElegir({ tipo, opciones })
    setAviso(tipo === 'recepcion'
      ? 'No tienes reservas para recibir hoy. Reserva en el calendario, o lee el QR del vehículo para tomarlo ahora si está libre.'
      : 'No tienes ningún vehículo por devolver.')
  }

  const eliminar = async (id: string) => {
    try {
      await enviar(`/api/vehiculos/reservas?id=${id}`, 'DELETE')
      setBorrar(null); cargar(); onCambio()
    } catch (e) { setError((e as Error).message) }
  }

  const cuando = (r: MiReserva) => {
    const ultimo = fechaBogota(new Date(new Date(r.end_at).getTime() - 1))
    const mismoDia = fechaBogota(r.start_at) === ultimo
    return `${fechaCorta(fechaBogota(r.start_at))} · ${hora12(horaBogota(r.start_at))} → ${mismoDia ? '' : fechaCorta(ultimo) + ' · '}${hora12(horaBogota(r.end_at))}`
  }

  return (
    <div>
      <div className="acciones-grandes">
        <button className="accion recibir" onClick={() => accion('recepcion')}>
          <b>Recepción</b><span>Tomo el vehículo{paraRecibir.length ? ` · ${paraRecibir.length} para hoy` : ''}</span>
        </button>
        <button className="accion entregar" onClick={() => accion('devolucion')}>
          <b>Devolución</b><span>Entrego el vehículo{paraEntregar.length ? ` · ${paraEntregar.length} en uso` : ''}</span>
        </button>
      </div>
      <p className="tenue" style={{ marginBottom: 16 }}>Al tomar un vehículo, lee con la cámara el QR que tiene pegado: queda registrada la hora.</p>

      {aviso && <div className="aviso recordatorio">{aviso}</div>}
      {error && <div className="aviso error">{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px', gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Mis reservas</h2>
        <button className="btn ambar chico" onClick={onReservar}>+ Reservar</button>
      </div>

      {!lista ? <p className="cargando">Cargando…</p> : lista.length === 0 ? (
        <div className="vacio">No tienes reservas.</div>
      ) : (
        <div className="lista">
          {lista.map((r) => {
            const v = V[r.vehicle_id]
            const { proyecto, actividad } = separarMotivo(r.motivo)
            const tomado = r.tomado_at || r.checkInHecho
            const devuelto = r.devuelto_at || r.checkOutHecho
            const vencida = new Date(r.end_at).getTime() < ahora
            return (
              <div key={r.id} className="res" style={{ borderLeftColor: v?.color }}>
                <h3>{v?.nombre ?? r.vehicle_id}</h3>
                <div className="cuando">{cuando(r)}</div>
                {(actividad || proyecto) && <div className="motivo">{actividad}{proyecto ? ` · ${proyecto}` : ''}</div>}
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {r.tomado_at && <span className="etiqueta">Tomado {hora12(horaBogota(r.tomado_at))}</span>}
                  {r.devuelto_at && <span className="etiqueta">Devuelto {hora12(horaBogota(r.devuelto_at))}</span>}
                  {tomado && !devuelto && vencida && <span className="etiqueta roja">Falta devolverlo</span>}
                  {!tomado && vencida && <span className="etiqueta ambar">Sin usar</span>}
                </div>
                <div className="botones">
                  {paraRecibir.some((x) => x.id === r.id) && <button className="btn" onClick={() => onInspeccion(r, 'recepcion')}>Recepción</button>}
                  {paraEntregar.some((x) => x.id === r.id) && <button className="btn ambar" onClick={() => onInspeccion(r, 'devolucion')}>Devolución</button>}
                  {!tomado && !vencida && (borrar === r.id ? (
                    <>
                      <button className="btn peligro chico" onClick={() => eliminar(r.id)}>Sí, cancelar</button>
                      <button className="btn suave chico" onClick={() => setBorrar(null)}>No</button>
                    </>
                  ) : <button className="btn suave chico" onClick={() => setBorrar(r.id)}>Cancelar reserva</button>)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {elegir && (
        <div className="velo" onClick={() => setElegir(null)}>
          <div className="ventana" onClick={(e) => e.stopPropagation()}>
            <h2>{elegir.tipo === 'recepcion' ? '¿Cuál vas a tomar?' : '¿Cuál vas a entregar?'}</h2>
            <div className="lista">
              {elegir.opciones.map((r) => (
                <button key={r.id} className="res" style={{ borderLeftColor: V[r.vehicle_id]?.color, textAlign: 'left' }}
                  onClick={() => { setElegir(null); onInspeccion(r, elegir.tipo) }}>
                  <h3>{V[r.vehicle_id]?.nombre ?? r.vehicle_id}</h3>
                  <div className="cuando">{cuando(r)}</div>
                </button>
              ))}
            </div>
            <div className="acciones"><button className="btn suave" onClick={() => setElegir(null)}>Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
