'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CATEGORIAS, CATEGORIAS_RECEPCION, FOTOS, categoriasIniciales, terminosDe,
  type Categorias, type ClaveCategoria,
} from '@/lib/vehiculos/inspeccion'
import { enviar, type MiReserva, type Vehiculo } from '@/lib/vehiculos/cliente'
import { fotoLiviana } from '@/lib/vehiculos/foto'
import { borrarBorrador, claveBorrador, guardarBorrador, leerBorrador } from '@/lib/vehiculos/borrador'

type Paso = 'terminos' | ClaveCategoria | 'fotos'

export default function Inspeccion({
  vehiculo, reserva, tipo, onSalir, onHecho,
}: {
  vehiculo: Vehiculo | undefined
  reserva: MiReserva
  tipo: 'recepcion' | 'devolucion'
  onSalir: () => void
  onHecho: () => void
}) {
  const esMoto = vehiculo?.tipo === 'moto'
  const recibo = tipo === 'recepcion'

  const pasos: Paso[] = useMemo(
    () => recibo
      ? ['terminos', ...CATEGORIAS_RECEPCION, 'fotos']
      : [...CATEGORIAS.map((c) => c.clave), 'fotos'],
    [recibo],
  )
  const [i, setI] = useState(0)
  const paso = pasos[i]

  const [aceptados, setAceptados] = useState<boolean[]>(() => terminosDe(esMoto).map(() => false))
  const [cats, setCats] = useState<Categorias>(categoriasIniciales)
  const [fotos, setFotos] = useState<Record<string, { blob: Blob; vista: string }>>({})
  const [km, setKm] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [terminado, setTerminado] = useState(false)
  const [procesando, setProcesando] = useState<string | null>(null)
  // Sin «capture»: deja elegir fotos ya tomadas. Para celulares donde abrir la cámara desde aquí
  // deja a Chrome sin memoria: se toman con la cámara normal y se eligen de la galería.
  const [galeria, setGaleria] = useState(false)
  const entradas = useRef<Record<string, HTMLInputElement | null>>({})
  const [cargado, setCargado] = useState(false)
  const [aviso, setAviso] = useState('')
  const clave = claveBorrador(reserva.id, tipo)

  useEffect(() => { window.scrollTo({ top: 0 }) }, [i])

  // Si Android cerró la app (pasa al abrir la cámara con poca memoria), se sigue donde iba.
  useEffect(() => {
    let vivo = true
    leerBorrador(clave).then((b) => {
      if (!vivo) return
      if (b) {
        setI(Math.min(b.paso, pasos.length - 1))
        if (b.aceptados?.length) setAceptados(b.aceptados)
        setCats(b.cats as Categorias)
        setKm(b.km)
        setFotos(Object.fromEntries(Object.entries(b.fotos ?? {}).map(([k, blob]) => [k, { blob, vista: URL.createObjectURL(blob) }])))
        if (b.camara) {
          setGaleria(true)
          setAviso('El celular cerró la app al abrir la cámara (le faltó memoria). Lo que habías llenado y las fotos ya tomadas se guardaron. '
            + 'Toma las fotos que faltan con la cámara del celular y elígelas de la galería.')
        } else {
          setAviso('Seguimos donde ibas.')
        }
      }
      setCargado(true)
    })
    return () => { vivo = false }
  }, [clave, pasos.length])

  const borrador = (camara = false) => ({
    paso: i, aceptados, cats, km, camara,
    fotos: Object.fromEntries(Object.entries(fotos).map(([k, f]) => [k, f.blob])),
  })

  // Guardar a medida que se llena (después de leer el borrador, para no pisarlo con el formulario vacío).
  useEffect(() => {
    if (!cargado || terminado) return
    guardarBorrador(clave, borrador())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- borrador() se arma con estos mismos valores
  }, [cargado, terminado, clave, i, aceptados, cats, km, fotos])

  const abrirFoto = (slot: string) => {
    // Con la cámara se marca el borrador: si Android cierra la app mientras está abierta, al volver se sabe.
    if (!galeria) guardarBorrador(clave, borrador(true))
    entradas.current[slot]?.click()
  }

  const cambiarCat = (k: ClaveCategoria, d: Partial<Categorias[ClaveCategoria]>) =>
    setCats((c) => ({ ...c, [k]: { ...c[k], ...d } }))

  const elegirFoto = async (slot: string, archivo: File | undefined) => {
    if (!archivo) return
    setProcesando(slot)
    try {
      const blob = await fotoLiviana(archivo)
      setFotos((f) => {
        if (f[slot]) URL.revokeObjectURL(f[slot].vista)
        return { ...f, [slot]: { blob, vista: URL.createObjectURL(blob) } }
      })
      setError('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setProcesando(null)
    }
  }

  // ¿Se puede avanzar desde este paso?
  const puedeSeguir = (() => {
    if (paso === 'terminos') return aceptados.every(Boolean)
    if (paso === 'fotos') return FOTOS.every((f) => fotos[f.clave]) && km.trim() !== '' && Number(km) >= 0
    const d = cats[paso as ClaveCategoria]
    return d.status === 'ok' || d.issues.length > 0 || d.other.trim().length > 0
  })()

  const esUltimo = i === pasos.length - 1

  const enviarTodo = async () => {
    setError('')
    setEnviando(true)
    try {
      const urls: Record<string, string> = {}
      for (const f of FOTOS) {
        const fd = new FormData()
        fd.append('archivo', fotos[f.clave].blob, `${f.clave}.jpg`)
        fd.append('reservaId', reserva.id)
        fd.append('tipo', tipo)
        fd.append('slot', f.clave)
        const res = await fetch('/api/vehiculos/foto', { method: 'POST', body: fd })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || `No pude subir la foto «${f.etiqueta}».`)
        urls[f.clave] = json.url
      }
      await enviar('/api/vehiculos/inspeccion', 'POST', {
        reservaId: reserva.id, tipo, categorias: cats, fotos: urls, kilometraje: Number(km),
      })
      setTerminado(true)
      borrarBorrador(clave)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const siguiente = () => { if (esUltimo) enviarTodo(); else setI(i + 1) }

  if (terminado) {
    const total = CATEGORIAS.reduce((n, c) => n + (cats[c.clave].status === 'issues' ? cats[c.clave].issues.length + (cats[c.clave].other.trim() ? 1 : 0) : 0), 0)
    return (
      <div className="insp centro" style={{ paddingTop: 30 }}>
        <div style={{ fontSize: 56 }}>✅</div>
        <h2 style={{ fontSize: 22, margin: '8px 0' }}>{recibo ? 'Recepción lista' : 'Devolución lista'}</h2>
        <p className="tenue">
          {vehiculo?.nombre}{recibo ? ' · Buen viaje.' : ' · Gracias por devolverlo.'}
          <br />{total === 0 ? 'Sin novedades reportadas.' : `Novedades reportadas: ${total}.`}
        </p>
        <button className="btn grande" style={{ marginTop: 18 }} onClick={onHecho}>Volver</button>
      </div>
    )
  }

  const cat = CATEGORIAS.find((c) => c.clave === paso)
  const termsTexto = terminosDe(esMoto)

  return (
    <div className="insp">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className={`etiqueta ${recibo ? '' : 'ambar'}`}>{recibo ? 'Recepción · tomo el vehículo' : 'Devolución · entrego el vehículo'}</span>
        <button className="btn suave chico" onClick={onSalir}>Cancelar</button>
      </div>
      <p className="tenue" style={{ margin: '8px 0 0' }}>{vehiculo?.nombre}</p>
      <div className="progreso"><div style={{ width: `${((i + 1) / pasos.length) * 100}%` }} /></div>

      {aviso && <div className="aviso recordatorio" style={{ marginTop: 12 }}>{aviso}</div>}

      {paso === 'terminos' && (
        <div>
          <h2>Compromiso de uso seguro</h2>
          <p className="tenue">Marca cada punto para continuar.</p>
          {termsTexto.map((t, k) => (
            <label key={k} className="problema" style={aceptados[k] ? { borderColor: 'var(--ok)', background: '#e6efe4' } : undefined}>
              <input type="checkbox" checked={aceptados[k]} onChange={() => setAceptados((a) => a.map((v, j) => (j === k ? !v : v)))} />
              <span>{t}</span>
            </label>
          ))}
        </div>
      )}

      {cat && (
        <div>
          <p className="tenue" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: 11 }}>{cat.grupo}</p>
          <h2>{cat.titulo}</h2>
          <div className="dosop">
            <button className={`op ${cats[cat.clave].status === 'ok' ? 'ok' : ''}`} onClick={() => cambiarCat(cat.clave, { status: 'ok', issues: [], other: '' })}>
              Todo en buen estado
            </button>
            <button className={`op ${cats[cat.clave].status === 'issues' ? 'mal' : ''}`} onClick={() => cambiarCat(cat.clave, { status: 'issues' })}>
              Reportar novedad
            </button>
          </div>
          {cats[cat.clave].status === 'issues' && (
            <div>
              {cat.problemas.map((p) => (
                <label key={p} className="problema">
                  <input
                    type="checkbox"
                    checked={cats[cat.clave].issues.includes(p)}
                    onChange={() => cambiarCat(cat.clave, {
                      issues: cats[cat.clave].issues.includes(p) ? cats[cat.clave].issues.filter((x) => x !== p) : [...cats[cat.clave].issues, p],
                    })}
                  />
                  <span>{p}</span>
                </label>
              ))}
              <label className="campo" style={{ marginTop: 10 }}><span>Otro (opcional)</span>
                <textarea rows={2} value={cats[cat.clave].other} onChange={(e) => cambiarCat(cat.clave, { other: e.target.value })} placeholder="Describe cualquier otro problema" />
              </label>
              {!puedeSeguir && <p className="tenue">Marca al menos un problema o descríbelo en «Otro».</p>}
            </div>
          )}
        </div>
      )}

      {paso === 'fotos' && (
        <div>
          <h2>Fotos y kilometraje</h2>
          <label className="campo"><span>Kilometraje actual *</span>
            <input type="number" inputMode="numeric" min={0} value={km} onChange={(e) => setKm(e.target.value)} placeholder="Ej: 45230" />
          </label>
          <p className="tenue">Toma las 5 fotos: se necesitan todas.</p>
          <div className="fotos">
            {FOTOS.map((f) => {
              const foto = fotos[f.clave]
              return (
                <div key={f.clave}>
                  <input ref={(el) => { entradas.current[f.clave] = el }} type="file" accept="image/*" capture={galeria ? undefined : 'environment'} hidden
                    onChange={(e) => { elegirFoto(f.clave, e.target.files?.[0]); e.target.value = '' }} />
                  <button className={`foto-slot ${foto ? 'lista' : ''}`} style={{ width: '100%', cursor: 'pointer' }} disabled={!!procesando}
                    onClick={() => abrirFoto(f.clave)}>
                    {procesando === f.clave ? (
                      <b>Preparando la foto…</b>
                    ) : foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={foto.vista} alt={f.etiqueta} />
                    ) : (
                      <><span style={{ fontSize: 26 }}>📷</span><b>{f.etiqueta}</b>{f.ayuda}</>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
          <p className="tenue" style={{ marginTop: 10 }}>
            {galeria
              ? <>Elige las fotos de la galería. <button className="enlace" onClick={() => setGaleria(false)}>Volver a usar la cámara</button></>
              : <>¿Se cierra la app o sale «Sin memoria» al tomar las fotos? Tómalas con la cámara del celular y <button className="enlace" onClick={() => setGaleria(true)}>elígelas de la galería</button>.</>}
          </p>
        </div>
      )}

      {error && <div className="aviso error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="acciones">
        <button className="btn suave" disabled={i === 0 || enviando} onClick={() => setI(i - 1)}>Atrás</button>
        <button className="btn" disabled={!puedeSeguir || enviando} onClick={siguiente}>
          {enviando ? 'Enviando…' : esUltimo ? (recibo ? 'Terminar recepción' : 'Terminar devolución') : 'Siguiente'}
        </button>
      </div>
    </div>
  )
}
