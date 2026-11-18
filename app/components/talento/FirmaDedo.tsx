'use client'
/**
 * Firmar con el dedo (o el mouse) en un recuadro. Devuelve la firma como PNG
 * recortado a su contorno, con fondo transparente, listo para el PDF.
 * Se guardan los trazos en coordenadas relativas, así que girar el celular o
 * cambiar el tamaño de la ventana no la deforma.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

type Punto = [number, number]
const TINTA = '#14213d'

export default function FirmaDedo({ onCambio, alto = 190, invalida = false }: {
  /** PNG en base64 (data URL), o null cuando se borra. */
  onCambio: (png: string | null) => void
  alto?: number
  invalida?: boolean
}) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const trazos = useRef<Punto[][]>([])
  const dibujando = useRef(false)
  const [hay, setHay] = useState(false)

  const pintar = useCallback(() => {
    const cv = lienzo.current; if (!cv) return
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1
    if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr) }
    const x = cv.getContext('2d')!
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, r.width, r.height)
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = TINTA; x.lineWidth = 2.4
    for (const s of trazos.current) {
      x.beginPath()
      s.forEach(([px, py], i) => (i ? x.lineTo(px * r.width, py * r.height) : x.moveTo(px * r.width, py * r.height)))
      if (s.length === 1) x.lineTo(s[0][0] * r.width + 0.1, s[0][1] * r.height)
      x.stroke()
    }
  }, [])

  useEffect(() => {
    pintar()
    window.addEventListener('resize', pintar)
    return () => window.removeEventListener('resize', pintar)
  }, [pintar])

  const punto = (e: React.PointerEvent): Punto => {
    const r = lienzo.current!.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }

  function exportar() {
    const cv = lienzo.current!; const r = cv.getBoundingClientRect()
    const W = 900, H = Math.round((900 * r.height) / r.width)
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const x = c.getContext('2d')!
    x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = TINTA; x.lineWidth = 5
    let minX = 1, minY = 1, maxX = 0, maxY = 0
    for (const s of trazos.current) {
      x.beginPath()
      s.forEach(([px, py], i) => {
        minX = Math.min(minX, px); minY = Math.min(minY, py); maxX = Math.max(maxX, px); maxY = Math.max(maxY, py)
        if (i) x.lineTo(px * W, py * H); else x.moveTo(px * W, py * H)
      })
      if (s.length === 1) x.lineTo(s[0][0] * W + 0.5, s[0][1] * H)
      x.stroke()
    }
    const pad = 8
    const sx = Math.max(0, minX * W - pad), sy = Math.max(0, minY * H - pad)
    const sw = Math.max(1, Math.min(W, maxX * W + pad) - sx), sh = Math.max(1, Math.min(H, maxY * H + pad) - sy)
    const o = document.createElement('canvas'); o.width = Math.round(sw); o.height = Math.round(sh)
    o.getContext('2d')!.drawImage(c, sx, sy, sw, sh, 0, 0, o.width, o.height)
    onCambio(o.toDataURL('image/png'))
  }

  function borrar() { trazos.current = []; setHay(false); pintar(); onCambio(null) }

  return (
    <div>
      <div className={`relative overflow-hidden rounded-2xl border-[1.5px] border-dashed bg-white sin-vidrio ${invalida ? 'border-red-600' : 'border-taupe'}`}
        style={{ height: alto, touchAction: 'none' }}>
        <canvas ref={lienzo} className="block h-full w-full cursor-crosshair"
          onPointerDown={(e) => {
            e.preventDefault()
            try { lienzo.current!.setPointerCapture(e.pointerId) } catch { /* sin captura */ }
            dibujando.current = true; trazos.current.push([punto(e)]); setHay(true); pintar()
          }}
          onPointerMove={(e) => {
            if (!dibujando.current) return
            e.preventDefault(); trazos.current[trazos.current.length - 1].push(punto(e)); pintar()
          }}
          onPointerUp={() => { if (dibujando.current) { dibujando.current = false; exportar() } }}
          onPointerCancel={() => { if (dibujando.current) { dibujando.current = false; exportar() } }}
        />
        {!hay && <span className="pointer-events-none absolute inset-0 grid place-items-center text-[13px] text-tenue">Firme aquí con el dedo</span>}
        <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-linea" />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11.5px] text-tenue">
        <span>Si necesita más espacio, gire el celular.</span>
        <button type="button" onClick={borrar} disabled={!hay} className="font-medium uppercase tracking-[.12em] text-bosque disabled:opacity-40">Borrar firma</button>
      </div>
    </div>
  )
}
