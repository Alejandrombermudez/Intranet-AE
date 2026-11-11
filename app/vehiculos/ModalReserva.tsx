'use client'
import { useState } from 'react'
import { hoyBogota, horaBogota } from '@/lib/vehiculos/horas'
import { enviar, type Vehiculo } from '@/lib/vehiculos/cliente'
import type { Hueco } from './Calendario'

function sumarMinutos(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  const t = Math.min(h * 60 + m + min, 23 * 60 + 45)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export default function ModalReserva({ vehiculos, hueco, aviso, onCerrar, onHecho }: { vehiculos: Vehiculo[]; hueco: Hueco | null; aviso?: string; onCerrar: () => void; onHecho: () => void }) {
  const ahoraHHMM = horaBogota(new Date())
  const inicioPorDefecto = hueco?.hora ?? sumarMinutos(`${ahoraHHMM.slice(0, 2)}:00`, 60)
  const [vehicleId, setVehicleId] = useState(hueco?.vehicleId ?? '')
  const [fechaInicio, setFechaInicio] = useState(hueco?.fecha ?? hoyBogota())
  const [horaInicio, setHoraInicio] = useState(inicioPorDefecto)
  const [fechaFin, setFechaFin] = useState(hueco?.fecha ?? hoyBogota())
  const [horaFin, setHoraFin] = useState(sumarMinutos(inicioPorDefecto, 120))
  const [proyecto, setProyecto] = useState('')
  const [actividad, setActividad] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setError('')
    if (!vehicleId) return setError('Elige un vehículo.')
    if (!actividad.trim()) return setError('Cuéntanos la actividad.')
    setGuardando(true)
    try {
      await enviar('/api/vehiculos/reservas', 'POST', { vehicleId, fechaInicio, horaInicio, fechaFin, horaFin, proyecto, actividad })
      onHecho()
    } catch (e) {
      setError((e as Error).message)
      setGuardando(false)
    }
  }

  return (
    <div className="velo" onClick={onCerrar}>
      <div className="ventana" onClick={(e) => e.stopPropagation()}>
        <h2>Nueva reserva</h2>
        {aviso && <div className="aviso recordatorio">{aviso}</div>}

        <div className="elegir-vehiculo">
          {vehiculos.map((v) => (
            <button key={v.id} className={`vehiculo-op ${vehicleId === v.id ? 'on' : ''}`} onClick={() => setVehicleId(v.id)}>
              <i style={{ background: v.color }} />{v.nombre}
            </button>
          ))}
        </div>

        <div className="fila2">
          <label className="campo"><span>Sale · fecha</span>
            <input type="date" value={fechaInicio} min={hoyBogota()} onChange={(e) => { setFechaInicio(e.target.value); if (fechaFin < e.target.value) setFechaFin(e.target.value) }} />
          </label>
          <label className="campo"><span>Sale · hora</span>
            <input type="time" step={900} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
          </label>
          <label className="campo"><span>Regresa · fecha</span>
            <input type="date" value={fechaFin} min={fechaInicio} onChange={(e) => setFechaFin(e.target.value)} />
          </label>
          <label className="campo"><span>Regresa · hora</span>
            <input type="time" step={900} value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
          </label>
        </div>

        <label className="campo"><span>Actividad *</span>
          <input type="text" maxLength={100} value={actividad} onChange={(e) => setActividad(e.target.value)} placeholder="Ej: Visita a predios en Solano" />
        </label>
        <label className="campo"><span>Proyecto (opcional)</span>
          <input type="text" maxLength={50} value={proyecto} onChange={(e) => setProyecto(e.target.value)} placeholder="Ej: FAO" />
        </label>

        {error && <div className="aviso error">{error}</div>}

        <div className="acciones">
          <button className="btn suave" onClick={onCerrar}>Cancelar</button>
          <button className="btn" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Reservar'}</button>
        </div>
      </div>
    </div>
  )
}
