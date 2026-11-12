'use client'
import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

/**
 * Lee el QR pegado en el vehículo con la cámara trasera. El QR trae la dirección
 * /vehiculos?qr=<id>; también acepta el id solo. Devuelve el id del vehículo.
 */
export default function Escaner({ onLeido, onCerrar }: { onLeido: (vehiculoId: string) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let flujo: MediaStream | null = null
    let cuadro = 0
    let vivo = true
    const lienzo = document.createElement('canvas')
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })

    const mirar = () => {
      if (!vivo) return
      const v = video.current
      if (v && v.readyState === v.HAVE_ENOUGH_DATA && ctx) {
        lienzo.width = v.videoWidth
        lienzo.height = v.videoHeight
        ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height)
        const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height)
        const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
        if (qr?.data) {
          let id = qr.data.trim()
          try { id = new URL(qr.data).searchParams.get('qr') ?? id } catch { /* era el id solo */ }
          if (id) { vivo = false; onLeido(id); return }
        }
      }
      cuadro = requestAnimationFrame(mirar)
    }

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        flujo = s
        if (!video.current) return
        video.current.srcObject = s
        video.current.play().catch(() => {})
        cuadro = requestAnimationFrame(mirar)
      })
      .catch(() => setError('No se pudo abrir la cámara. Revisa el permiso de cámara o elige el vehículo de la lista.'))

    return () => {
      vivo = false
      cancelAnimationFrame(cuadro)
      flujo?.getTracks().forEach((t) => t.stop())
    }
  }, [onLeido])

  return (
    <div className="escaner">
      <p className="tenue centro">Apunta la cámara al QR pegado en el vehículo.</p>
      {error ? <div className="aviso error">{error}</div> : (
        <div className="visor-camara">
          <video ref={video} playsInline muted />
          <i />
        </div>
      )}
      <button className="btn suave grande" onClick={onCerrar}>Volver</button>
    </div>
  )
}
