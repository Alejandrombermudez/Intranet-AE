'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

interface Props {
  /** Recibe la firma como PNG en base64 (data URL), o null si el recuadro quedó vacío. */
  onChange: (firma: string | null) => void
  error?: boolean
}

const ALTO = 170
/** Ancho de la imagen que se guarda. Fijo y pequeño: no depende de la pantalla ni de su densidad. */
const ANCHO_GUARDADO = 360

type Trazos = { x: number; y: number }[][]

/** Dibuja los trazos (normalizados por el ancho) en un contexto de `w` píxeles de ancho. */
function dibujar(ctx: CanvasRenderingContext2D, trazos: Trazos, w: number, grosor: number) {
  ctx.lineWidth = grosor
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#1c1917'
  ctx.fillStyle = '#1c1917'
  for (const t of trazos) {
    if (t.length === 1) {
      ctx.beginPath()
      ctx.arc(t[0].x * w, t[0].y * w, grosor / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    ctx.beginPath()
    t.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x * w, p.y * w)
      else ctx.lineTo(p.x * w, p.y * w)
    })
    ctx.stroke()
  }
}

/**
 * La imagen que viaja y se guarda: PNG de ANCHO_GUARDADO px, sin fondo, a 1x. Pesa unos
 * pocos KB y el navegador no la recomprime ni la reescala al enviarla.
 */
function exportar(trazos: Trazos, anchoPantalla: number): string {
  const c = document.createElement('canvas')
  c.width = ANCHO_GUARDADO
  c.height = Math.round((ALTO / anchoPantalla) * ANCHO_GUARDADO)
  const ctx = c.getContext('2d')
  if (!ctx) return ''
  dibujar(ctx, trazos, ANCHO_GUARDADO, Math.max(1.8, 2.2 * (ANCHO_GUARDADO / anchoPantalla)))
  return c.toDataURL('image/png')
}

/**
 * Recuadro para firmar con el dedo (celular) o el mouse (computador).
 * Los trazos se guardan normalizados por el ancho, así que al girar el celular o
 * cambiar el tamaño de la ventana se redibujan en vez de borrarse.
 */
export default function FirmaPad({ onChange, error }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null)
  const trazos = useRef<Trazos>([])
  const dibujando = useRef(false)
  const ancho = useRef(0)
  const [hayFirma, setHayFirma] = useState(false)

  const pintar = useCallback(() => {
    const c = lienzo.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !ancho.current) return
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, ancho.current, ALTO)
    dibujar(ctx, trazos.current, ancho.current, 2.2)
  }, [])

  // Ajusta el tamaño interno del canvas al ancho real (y a la densidad de la pantalla).
  useEffect(() => {
    const c = lienzo.current
    if (!c) return
    const ajustar = () => {
      const w = Math.round(c.getBoundingClientRect().width)
      if (!w || w === ancho.current) return
      ancho.current = w
      const dpr = window.devicePixelRatio || 1
      c.width = Math.round(w * dpr)
      c.height = Math.round(ALTO * dpr)
      pintar()
    }
    ajustar()
    const ro = new ResizeObserver(ajustar)
    ro.observe(c)
    return () => ro.disconnect()
  }, [pintar])

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / ancho.current, y: (e.clientY - r.top) / ancho.current }
  }

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* sin captura el trazo igual se dibuja */ }
    dibujando.current = true
    trazos.current.push([punto(e)])
    pintar()
  }

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return
    trazos.current[trazos.current.length - 1].push(punto(e))
    pintar()
  }

  const terminar = () => {
    if (!dibujando.current) return
    dibujando.current = false
    setHayFirma(true)
    onChange(exportar(trazos.current, ancho.current) || null)
  }

  const borrar = () => {
    trazos.current = []
    dibujando.current = false
    pintar()
    setHayFirma(false)
    onChange(null)
  }

  return (
    <div>
      <div className={`sin-vidrio relative border bg-white ${error ? 'border-red-400' : 'border-stone-300'}`}>
        <canvas
          ref={lienzo}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Recuadro de firma: firma con el dedo o con el mouse"
          style={{ height: ALTO, touchAction: 'none' }}
          className="block w-full cursor-crosshair"
        />
        {!hayFirma && (
          <span className="pointer-events-none absolute inset-0 grid place-items-center px-4 text-center text-sm text-stone-400">
            Firma aquí con el dedo o el mouse
          </span>
        )}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-stone-300" />
      </div>
      <button
        type="button"
        onClick={borrar}
        disabled={!hayFirma}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 transition-opacity hover:opacity-75 disabled:opacity-40"
      >
        <Eraser size={12} /> Borrar y firmar de nuevo
      </button>
    </div>
  )
}
