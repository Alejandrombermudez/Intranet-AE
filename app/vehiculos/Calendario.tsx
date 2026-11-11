'use client'
import { useEffect, useMemo, useState } from 'react'
import { aInstante, diaSemanaBogota, fechaCorta, fechaLarga, hoyBogota, hora12, horaBogota, lunesDe, mesYAnio, minutosDelDia, nombreDia, sumarDias } from '@/lib/vehiculos/horas'
import { FOTON_ID, llamar, separarMotivo, type Reserva, type Vehiculo } from '@/lib/vehiculos/cliente'

const HORA_INI = 5
const HORA_FIN = 21
const PX_HORA = 46
const ALTO = (HORA_FIN - HORA_INI) * PX_HORA
const GUTTER = 48

interface Seg { r: Reserva; ini: number; fin: number }
interface SegCarril extends Seg { carril: number; carriles: number }

/** Parte de la reserva que cae en la fecha dada, en minutos desde las 00:00 de ese día. */
function segmento(r: Reserva, fecha: string): Seg | null {
  const dia0 = aInstante(fecha, '00:00').getTime()
  const dia1 = aInstante(sumarDias(fecha, 1), '00:00').getTime()
  const s = Math.max(new Date(r.start_at).getTime(), dia0)
  const e = Math.min(new Date(r.end_at).getTime(), dia1)
  if (e <= s) return null
  const ini = (s - dia0) / 60000
  const fin = (e - dia0) / 60000
  if (fin <= HORA_INI * 60 || ini >= HORA_FIN * 60) return null
  return { r, ini, fin }
}

/** Reparte en carriles las reservas que se cruzan, para que no se tapen entre sí. */
function repartir(segs: Seg[]): SegCarril[] {
  const orden = [...segs].sort((a, b) => a.ini - b.ini || a.fin - b.fin)
  const salida: SegCarril[] = []
  let grupo: SegCarril[] = []
  let finGrupo = -1
  let finCarril: number[] = []
  const cerrar = () => {
    for (const g of grupo) g.carriles = finCarril.length
    salida.push(...grupo)
    grupo = []
    finCarril = []
  }
  for (const s of orden) {
    if (grupo.length && s.ini >= finGrupo) cerrar()
    let c = finCarril.findIndex((f) => f <= s.ini)
    if (c === -1) { c = finCarril.length; finCarril.push(s.fin) } else finCarril[c] = s.fin
    grupo.push({ ...s, carril: c, carriles: 1 })
    finGrupo = Math.max(finGrupo, s.fin)
  }
  cerrar()
  return salida
}

const top = (min: number) => ((Math.max(min, HORA_INI * 60) - HORA_INI * 60) / 60) * PX_HORA
const alto = (a: number, b: number) => Math.max(((Math.min(b, HORA_FIN * 60) - Math.max(a, HORA_INI * 60)) / 60) * PX_HORA, 18)

export interface Hueco { vehicleId?: string; fecha: string; hora: string }

export default function Calendario({
  vehiculos, recarga, yoId, puedeReservar, onHueco, onReserva,
}: {
  vehiculos: Vehiculo[]
  recarga: number
  yoId: string | null
  puedeReservar: boolean
  onHueco: (h: Hueco) => void
  onReserva: (r: Reserva) => void
}) {
  const [modo, setModo] = useState<'dia' | 'semana'>('dia')
  const [fecha, setFecha] = useState(hoyBogota())
  const [vehiculo, setVehiculo] = useState<string>('todos')
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [error, setError] = useState('')
  const [cargadoPara, setCargadoPara] = useState('')
  const [ahora, setAhora] = useState(() => new Date())
  const VEHICULO = useMemo(() => Object.fromEntries(vehiculos.map((v) => [v.id, v])), [vehiculos])

  const desde = modo === 'dia' ? fecha : lunesDe(fecha)
  const hasta = modo === 'dia' ? fecha : sumarDias(lunesDe(fecha), 6)
  const dias = useMemo(() => (modo === 'dia' ? [fecha] : Array.from({ length: 7 }, (_, i) => sumarDias(desde, i))), [modo, fecha, desde])

  // «Cargando» mientras lo que se ve no corresponde a la semana/día pedido.
  const clave = `${desde}|${hasta}|${recarga}`
  const cargando = cargadoPara !== clave
  useEffect(() => {
    let vigente = true
    llamar<{ reservas: Reserva[] }>(`/api/vehiculos/reservas?desde=${desde}&hasta=${hasta}`)
      .then((d) => { if (vigente) { setReservas(d.reservas); setError('') } })
      .catch((e: Error) => { if (vigente) setError(e.message) })
      .finally(() => { if (vigente) setCargadoPara(`${desde}|${hasta}|${recarga}`) })
    return () => { vigente = false }
  }, [desde, hasta, recarga])

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const hoy = hoyBogota()
  const minAhora = minutosDelDia(ahora)

  const columnas: { clave: string; fecha: string; vehicleId?: string }[] =
    modo === 'dia'
      ? vehiculos.map((v) => ({ clave: v.id, fecha, vehicleId: v.id }))
      : dias.map((d) => ({ clave: d, fecha: d, vehicleId: vehiculo === 'todos' ? undefined : vehiculo }))

  const plantilla = `${GUTTER}px repeat(${columnas.length}, minmax(0, 1fr))`

  const mover = (n: number) => setFecha(sumarDias(fecha, modo === 'dia' ? n : 7 * n))

  const titulo = modo === 'dia'
    ? fechaLarga(fecha)
    : `${fechaCorta(desde)} – ${fechaCorta(hasta)} · ${mesYAnio(hasta)}`

  const clic = (e: React.MouseEvent<HTMLDivElement>, col: { fecha: string; vehicleId?: string }) => {
    if (!puedeReservar) return
    const caja = e.currentTarget.getBoundingClientRect()
    const min = HORA_INI * 60 + Math.floor(((e.clientY - caja.top) / PX_HORA) * 2) * 30
    const hh = String(Math.floor(min / 60)).padStart(2, '0')
    const mm = String(min % 60).padStart(2, '0')
    onHueco({ vehicleId: col.vehicleId, fecha: col.fecha, hora: `${hh}:${mm}` })
  }

  return (
    <div>
      <div className="barra-cal">
        <div className="grupo">
          <button onClick={() => mover(-1)} aria-label="Anterior">‹</button>
          <button onClick={() => setFecha(hoy)}>Hoy</button>
          <button onClick={() => mover(1)} aria-label="Siguiente">›</button>
        </div>
        <div className="titulo">{titulo}</div>
        <div className="grupo">
          <button className={modo === 'dia' ? 'on' : ''} onClick={() => setModo('dia')}>Día</button>
          <button className={modo === 'semana' ? 'on' : ''} onClick={() => setModo('semana')}>Semana</button>
        </div>
      </div>

      {modo === 'semana' && (
        <div className="chips">
          <button className={`chip ${vehiculo === 'todos' ? 'on' : ''}`} onClick={() => setVehiculo('todos')}>Todos</button>
          {vehiculos.map((v) => (
            <button key={v.id} className={`chip ${vehiculo === v.id ? 'on' : ''}`} onClick={() => setVehiculo(v.id)}>
              <i style={{ background: v.color }} />{v.corto}
            </button>
          ))}
        </div>
      )}

      {error && <div className="aviso error">{error}</div>}

      <div className="cal" style={{ opacity: cargando ? 0.7 : 1 }}>
        <div className={`cal-in ${modo}`}>
          <div className="cal-cab" style={{ gridTemplateColumns: plantilla }}>
            <div style={{ border: 0 }} />
            {columnas.map((c) => {
              const v = c.vehicleId && modo === 'dia' ? VEHICULO[c.vehicleId] : null
              return (
                <div key={c.clave} className={c.fecha === hoy && modo === 'semana' ? 'hoy' : ''}>
                  {v ? (<><span style={{ color: v.color }}>●</span> {v.corto}</>) : (<>{nombreDia(c.fecha).slice(0, 3)}<small>{fechaCorta(c.fecha)}</small></>)}
                </div>
              )
            })}
          </div>

          <div className="cal-cuerpo" style={{ gridTemplateColumns: plantilla, height: ALTO }}>
            <div className="horas">
              {Array.from({ length: HORA_FIN - HORA_INI }, (_, i) => (
                <span key={i} style={{ top: i * PX_HORA }}>{i === 0 ? '' : hora12(`${HORA_INI + i}:00`).replace(':00', '')}</span>
              ))}
            </div>

            {columnas.map((c) => {
              const delVehiculo = reservas.filter((r) => (c.vehicleId ? r.vehicle_id === c.vehicleId : true))
              const segs = delVehiculo.map((r) => segmento(r, c.fecha)).filter((s): s is Seg => !!s)
              const posicionados = repartir(segs)
              const fotonBloqueada = c.vehicleId === FOTON_ID && [1, 2].includes(diaSemanaBogota(aInstante(c.fecha, '12:00')))
              return (
                <div key={c.clave} className="col" style={{ cursor: puedeReservar ? 'cell' : 'default' }} onClick={(e) => clic(e, c)}>
                  {Array.from({ length: (HORA_FIN - HORA_INI) * 2 }, (_, i) => (
                    <div key={i} className={`linea ${i % 2 ? 'media' : ''}`} style={{ top: (i * PX_HORA) / 2 }} />
                  ))}
                  {fotonBloqueada && <div className="bloqueo">Uso interno</div>}
                  {c.fecha === hoy && minAhora >= HORA_INI * 60 && minAhora < HORA_FIN * 60 && (
                    <div className="ahora" style={{ top: top(minAhora) }} />
                  )}
                  {posicionados.map((s) => {
                    const v = VEHICULO[s.r.vehicle_id]
                    const { proyecto, actividad } = separarMotivo(s.r.motivo)
                    const ancho = 100 / s.carriles
                    return (
                      <button
                        key={`${s.r.id}-${c.clave}`}
                        className={`evento ${yoId && s.r.conductor_id === yoId ? 'mia' : ''}`}
                        style={{
                          top: top(s.ini), height: alto(s.ini, s.fin) - 2,
                          left: `calc(${s.carril * ancho}% + 2px)`, width: `calc(${ancho}% - 4px)`,
                          background: v?.color ?? '#555',
                        }}
                        onClick={(e) => { e.stopPropagation(); onReserva(s.r) }}
                        title={`${s.r.nombre} · ${horaBogota(s.r.start_at)}–${horaBogota(s.r.end_at)}`}
                      >
                        <b>{s.r.nombre}</b>
                        <span>{modo === 'semana' && vehiculo === 'todos' ? v?.corto + ' · ' : ''}{actividad || proyecto}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {cargando && <p className="tenue centro">Cargando…</p>}
    </div>
  )
}
