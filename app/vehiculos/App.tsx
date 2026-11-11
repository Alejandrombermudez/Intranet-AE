'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fechaBogota, fechaCorta, hoyBogota, hora12, horaBogota } from '@/lib/vehiculos/horas'
import { enviar, llamar, separarMotivo, type MiReserva, type Persona, type Reserva, type Vehiculo, type Yo } from '@/lib/vehiculos/cliente'
import Ingreso, { SIN_AUTO_MICROSOFT } from './Ingreso'
import Inicio from './Inicio'
import Calendario, { type Hueco } from './Calendario'
import ModalReserva from './ModalReserva'
import Inspeccion from './Inspeccion'
import Flota from './Flota'
import Admin from './Admin'

type Vista = 'inicio' | 'calendario' | 'vehiculos' | 'admin'

interface FilaReserva { id: string; vehicle_id: string; start_at: string; end_at: string; purpose: string | null; tomado_at: string | null; devuelto_at: string | null }
type Tomar =
  | { accion: 'recepcion' | 'devolucion'; vehiculo: { id: string; nombre: string }; reserva: FilaReserva }
  | { accion: 'sin-reserva'; vehiculo: { id: string; nombre: string } }

const aMiReserva = (r: FilaReserva): MiReserva => ({
  id: r.id, vehicle_id: r.vehicle_id, start_at: r.start_at, end_at: r.end_at, motivo: r.purpose,
  tomado_at: r.tomado_at, devuelto_at: r.devuelto_at, checkInHecho: false, checkOutHecho: false,
})

/** La hora de ahora, redondeada hacia abajo a 15 minutos («08:45»). */
function horaAhora(): string {
  const [h, m] = horaBogota(new Date()).split(':').map(Number)
  return `${String(h).padStart(2, '0')}:${String(Math.floor(m / 15) * 15).padStart(2, '0')}`
}

export default function App() {
  const router = useRouter()
  const qr = useSearchParams().get('qr')
  const [cargado, setCargado] = useState(false)
  const [yo, setYo] = useState<Yo | null>(null)
  const [personas, setPersonas] = useState<Persona[]>([])
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([])
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [vista, setVista] = useState<Vista>('inicio')
  const [recarga, setRecarga] = useState(0)
  const [hueco, setHueco] = useState<Hueco | null | undefined>(undefined) // undefined = cerrado
  const [detalle, setDetalle] = useState<Reserva | null>(null)
  const [inspeccion, setInspeccion] = useState<{ r: MiReserva; tipo: 'recepcion' | 'devolucion' } | null>(null)
  const qrPendiente = useRef<string | null>(null)

  const refrescar = useCallback(() => setRecarga((n) => n + 1), [])

  const cargarFlota = useCallback(async () => {
    try {
      const d = await llamar<{ vehiculos: Vehiculo[] }>('/api/vehiculos/flota')
      setVehiculos(d.vehiculos)
    } catch (e) { setError((e as Error).message) }
  }, [])

  /** Lo que pasa al leer el QR del vehículo: registra la hora y abre lo que toca. */
  const leerQr = useCallback(async (vehiculoId: string) => {
    try {
      const t = await enviar<Tomar>('/api/vehiculos/tomar', 'POST', { vehiculoId })
      if (t.accion === 'sin-reserva') {
        qrPendiente.current = vehiculoId
        setAviso(`No tienes reserva de ${t.vehiculo.nombre} para hoy. Resérvalo desde ahora y queda registrado que lo tomaste.`)
        setHueco({ vehicleId: vehiculoId, fecha: hoyBogota(), hora: horaAhora() })
        return
      }
      qrPendiente.current = null
      if (t.accion === 'recepcion' && t.reserva.tomado_at) {
        setAviso(`${t.vehiculo.nombre}: tomado a las ${hora12(horaBogota(t.reserva.tomado_at))}. Ahora completa la recepción`)
      }
      setInspeccion({ r: aMiReserva(t.reserva), tipo: t.accion })
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const entro = useCallback(async (u: Yo) => {
    setYo(u)
    setVista('inicio')
    await cargarFlota()
    if (qr) {
      router.replace('/vehiculos')
      await leerQr(qr)
    }
  }, [cargarFlota, leerQr, qr, router])

  // Al abrir: ¿este dispositivo ya entró? Si no, y hay sesión de Microsoft de la intranet, se usa esa.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const d = await llamar<{ yo: Yo | null; personas: Persona[] }>('/api/vehiculos/estado')
        if (!vivo) return
        setPersonas(d.personas)
        if (d.yo) { await entro(d.yo); return }
        let sinAuto = false
        try { sinAuto = localStorage.getItem(SIN_AUTO_MICROSOFT) === '1' } catch { /* sin storage */ }
        if (!sinAuto) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.access_token && session.user.email?.toLowerCase().endsWith('@amazoniaemprende.com')) {
            const r = await llamar<{ yo: Yo }>('/api/vehiculos/entrar-microsoft', {
              method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` },
            })
            if (vivo) await entro(r.yo)
          }
        }
      } catch (e) {
        if (vivo) setError((e as Error).message)
      } finally {
        if (vivo) setCargado(true)
      }
    })()
    return () => { vivo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [])

  const cambiarUsuario = async () => {
    await enviar('/api/vehiculos/salir', 'POST').catch(() => {})
    try { localStorage.setItem(SIN_AUTO_MICROSOFT, '1') } catch { /* sin storage */ }
    setYo(null)
    setInspeccion(null)
    setVista('inicio')
    const d = await llamar<{ personas: Persona[] }>('/api/vehiculos/estado').catch(() => null)
    if (d) setPersonas(d.personas)
  }

  const borrarDetalle = async () => {
    if (!detalle) return
    try {
      await enviar(`/api/vehiculos/reservas?id=${detalle.id}`, 'DELETE')
      setDetalle(null)
      refrescar()
    } catch (e) {
      setError((e as Error).message)
      setDetalle(null)
    }
  }

  const reservaHecha = async () => {
    setHueco(undefined)
    refrescar()
    // Si se reservó desde el QR, se toma de una vez.
    if (qrPendiente.current) {
      const id = qrPendiente.current
      qrPendiente.current = null
      setAviso('')
      await leerQr(id)
    }
  }

  if (!cargado) return <p className="cargando">Cargando…</p>

  const cabecera = (
    <header className="cabecera">
      <div className="marca"><b>Vehículos</b><span>Amazonía Emprende</span></div>
      {yo && (
        <div className="usuario">
          <span className="nom">{yo.nombre}</span>
          <button className="btn fantasma chico" onClick={cambiarUsuario} title="Salir de este dispositivo y entrar con otra persona">Cambiar usuario</button>
        </div>
      )}
    </header>
  )

  if (!yo) {
    return (
      <>
        {cabecera}
        <main className="pagina">
          {error && <div className="aviso error" style={{ maxWidth: 420, margin: '0 auto 14px' }}>{error}</div>}
          <Ingreso personas={personas} qr={qr} onEntro={entro} />
        </main>
      </>
    )
  }

  if (inspeccion) {
    return (
      <>
        {cabecera}
        <main className="pagina">
          {aviso && <div className="aviso info insp">{aviso}</div>}
          <Inspeccion
            vehiculo={vehiculos.find((v) => v.id === inspeccion.r.vehicle_id)}
            reserva={inspeccion.r}
            tipo={inspeccion.tipo}
            onSalir={() => { setInspeccion(null); setAviso(''); refrescar() }}
            onHecho={() => { setInspeccion(null); setAviso(''); refrescar() }}
          />
        </main>
      </>
    )
  }

  const verDetalle = detalle && (() => {
    const v = vehiculos.find((x) => x.id === detalle.vehicle_id)
    const { proyecto, actividad } = separarMotivo(detalle.motivo)
    const fin = new Date(new Date(detalle.end_at).getTime() - 1)
    const puedeCancelar = detalle.conductor_id === yo.id || yo.esAdmin
    return (
      <div className="velo" onClick={() => setDetalle(null)}>
        <div className="ventana" onClick={(e) => e.stopPropagation()}>
          <h2 style={{ borderLeft: `6px solid ${v?.color}`, paddingLeft: 10 }}>{v?.nombre ?? detalle.vehicle_id}</h2>
          <p><b>{detalle.nombre}</b></p>
          <p>
            {fechaCorta(fechaBogota(detalle.start_at))} · {hora12(horaBogota(detalle.start_at))} →{' '}
            {fechaBogota(detalle.start_at) === fechaBogota(fin) ? '' : fechaCorta(fechaBogota(fin)) + ' · '}{hora12(horaBogota(detalle.end_at))}
          </p>
          {(actividad || proyecto) && <p className="tenue">{actividad}{proyecto ? ` · ${proyecto}` : ''}</p>}
          <div className="acciones">
            <button className="btn suave" onClick={() => setDetalle(null)}>Cerrar</button>
            {puedeCancelar && <button className="btn peligro" onClick={borrarDetalle}>Cancelar reserva</button>}
          </div>
        </div>
      </div>
    )
  })()

  return (
    <>
      {cabecera}
      <main className="pagina">
        <div className="pestanas">
          <button className={`pestana ${vista === 'inicio' ? 'activa' : ''}`} onClick={() => setVista('inicio')}>Inicio</button>
          <button className={`pestana ${vista === 'calendario' ? 'activa' : ''}`} onClick={() => setVista('calendario')}>Calendario</button>
          <button className={`pestana ${vista === 'vehiculos' ? 'activa' : ''}`} onClick={() => setVista('vehiculos')}>Vehículos y tarjetas</button>
          {yo.esAdmin && <button className={`pestana ${vista === 'admin' ? 'activa' : ''}`} onClick={() => setVista('admin')}>Administrar</button>}
        </div>

        {error && <div className="aviso error" onClick={() => setError('')}>{error}</div>}
        {aviso && hueco === undefined && <div className="aviso info" onClick={() => setAviso('')}>{aviso}</div>}

        {vista === 'inicio' && (
          <Inicio vehiculos={vehiculos} recarga={recarga} onReservar={() => setHueco(null)}
            onInspeccion={(r, tipo) => setInspeccion({ r, tipo })} onCambio={refrescar} />
        )}
        {vista === 'calendario' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button className="btn ambar" onClick={() => setHueco(null)}>+ Reservar</button>
            </div>
            <Calendario vehiculos={vehiculos} recarga={recarga} yoId={yo.id} puedeReservar onHueco={setHueco} onReserva={setDetalle} />
            <p className="tenue centro" style={{ marginTop: 8 }}>Toca un espacio libre del calendario para reservar a esa hora.</p>
          </>
        )}
        {vista === 'vehiculos' && <Flota vehiculos={vehiculos} />}
        {vista === 'admin' && yo.esAdmin && <Admin yoId={yo.id} vehiculos={vehiculos} onCambio={cargarFlota} />}
      </main>

      {hueco !== undefined && (
        <ModalReserva vehiculos={vehiculos} hueco={hueco} aviso={qrPendiente.current ? aviso : ''}
          onCerrar={() => { setHueco(undefined); qrPendiente.current = null; setAviso('') }}
          onHecho={reservaHecha} />
      )}
      {verDetalle}
    </>
  )
}
