'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fechaBogota, fechaCorta, hora12, horaBogota } from '@/lib/vehiculos/horas'
import { enviar, llamar, separarMotivo, type MiReserva, type Persona, type Reserva, type Vehiculo, type Yo } from '@/lib/vehiculos/cliente'
import Ingreso, { SIN_AUTO_MICROSOFT } from './Ingreso'
import Inicio from './Inicio'
import Calendario, { type Hueco } from './Calendario'
import ModalReserva from './ModalReserva'
import Inspeccion from './Inspeccion'
import Flota from './Flota'
import Admin from './Admin'
import Simple from './Simple'

type Vista = 'inicio' | 'calendario' | 'vehiculos' | 'admin'

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
  // Un administrador puede ver la app como la ve cualquier persona. El QR leído con la cámara
  // del celular (fuera de la app) también abre esta vista: quien lo lee va a tomar un vehículo.
  const [comoUsuario, setComoUsuario] = useState(!!qr)
  const [qrActivo, setQrActivo] = useState<string | null>(qr)

  const refrescar = useCallback(() => setRecarga((n) => n + 1), [])

  const cargarFlota = useCallback(async () => {
    try {
      const d = await llamar<{ vehiculos: Vehiculo[] }>('/api/vehiculos/flota')
      setVehiculos(d.vehiculos)
    } catch (e) { setError((e as Error).message) }
  }, [])

  const entro = useCallback(async (u: Yo) => {
    setYo(u)
    setVista('inicio')
    await cargarFlota()
  }, [cargarFlota])

  const qrUsado = useCallback(() => { setQrActivo(null); router.replace('/vehiculos') }, [router])

  // Service worker propio de /vehiculos: es lo que deja instalarla en el celular aparte de la intranet.
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.hostname !== 'localhost') {
      navigator.serviceWorker.register('/vehiculos-sw.js', { scope: '/vehiculos' }).catch(() => { /* sin SW: la página funciona igual */ })
    }
  }, [])

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

  // Quien no administra (o un admin mirando «como usuario»): la vista sencilla, blanca.
  if (!yo.esAdmin || comoUsuario) {
    return (
      <>
        <header className="cabecera blanca">
          <div className="marca"><b>Vehículos</b><span>Amazonía Emprende</span></div>
          <button className="salir" onClick={cambiarUsuario} title="Salir de este dispositivo y entrar con otra persona">Cambiar usuario</button>
        </header>
        {yo.esAdmin && (
          <div className="banda-vista">Así ve la app quien no administra.<button onClick={() => { setComoUsuario(false); refrescar() }}>Volver a administrar</button></div>
        )}
        <Simple nombre={yo.nombre} yoId={yo.id} vehiculos={vehiculos} qr={qrActivo} recarga={recarga}
          onQrUsado={qrUsado}
          onInspeccion={(r, tipo, texto) => { setAviso(texto ? `${texto} · completa la recepción` : ''); setInspeccion({ r, tipo }) }} />
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button className="btn suave chico" onClick={() => setComoUsuario(true)}>Ver como usuario</button>
        </div>
        <div className="pestanas">
          <button className={`pestana ${vista === 'inicio' ? 'activa' : ''}`} onClick={() => setVista('inicio')}>Inicio</button>
          <button className={`pestana ${vista === 'calendario' ? 'activa' : ''}`} onClick={() => setVista('calendario')}>Calendario</button>
          <button className={`pestana ${vista === 'vehiculos' ? 'activa' : ''}`} onClick={() => setVista('vehiculos')}>Vehículos y tarjetas</button>
          {yo.esAdmin && <button className={`pestana ${vista === 'admin' ? 'activa' : ''}`} onClick={() => setVista('admin')}>Administrar</button>}
        </div>

        {error && <div className="aviso error" onClick={() => setError('')}>{error}</div>}

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
        <ModalReserva vehiculos={vehiculos} hueco={hueco}
          onCerrar={() => setHueco(undefined)}
          onHecho={() => { setHueco(undefined); refrescar() }} />
      )}
      {verDetalle}
    </>
  )
}
