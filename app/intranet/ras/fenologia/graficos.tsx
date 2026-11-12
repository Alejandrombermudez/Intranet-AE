'use client'

/**
 * Gráficos del módulo de fenología, en SVG a mano (sin librería): tienen que
 * salir iguales en pantalla y en el PNG del informe, y los tamaños y colores
 * los fija el criterio técnico (§3 y §4). Cada uno se puede bajar en PNG a 300 dpi
 * con `descargarPng`.
 */

import { useId, type Ref } from 'react'
import {
  COLOR, MESES, type Celda, type MesClima, type ResumenEspecie,
} from '@/lib/fenologia'

const FUENTE = 'Poppins, Arial, sans-serif'

// ─── Exportar ────────────────────────────────────────────────────────────────

/** Baja un <svg> como PNG con fondo blanco. `pulgadas` = ancho impreso a 300 dpi. */
export async function descargarPng(svg: SVGSVGElement | null, nombre: string, pulgadas: number) {
  if (!svg) return
  const vb = svg.viewBox.baseVal
  const ancho = Math.round(pulgadas * 300)
  const alto = Math.round((ancho * vb.height) / vb.width)
  const clon = svg.cloneNode(true) as SVGSVGElement
  clon.setAttribute('width', String(ancho))
  clon.setAttribute('height', String(alto))
  clon.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clon)], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise<void>((ok, mal) => { img.onload = () => ok(); img.onerror = () => mal(new Error('No se pudo dibujar')); img.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = ancho
    canvas.height = alto
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, ancho, alto)
    ctx.drawImage(img, 0, 0, ancho, alto)
    const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'))
    if (png) descargarBlob(png, `${nombre}.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function descargarBlob(b: Blob, nombre: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b)
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

// ─── Piezas comunes ──────────────────────────────────────────────────────────

/** Trama para «sin monitoreo»: no es lo mismo que «sin actividad». */
function Trama({ id }: { id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="#fafaf8" />
      <line x1="0" y1="0" x2="0" y2="6" stroke="#d9d6cf" strokeWidth="1.4" />
    </pattern>
  )
}

/** Opacidad 0,3–1 según la categoría de Fournier (1–4), como pide el criterio §3.1. */
function alfa(c: Celda, intensidad: boolean) {
  if (!intensidad) return 1
  const f = c.media / 25
  return Math.min(1, 0.3 + (0.7 * Math.max(0, f - 1)) / 3)
}

function mezclar(a: string, b: string, t: number) {
  const p = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16)
  const c = [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * Math.max(0, Math.min(1, t))))
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

const fmt = (n: number, d = 0) => n.toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d })

// ─── Climograma (panel) ──────────────────────────────────────────────────────

/** Barras de lluvia (eje izquierdo) y línea de temperatura (eje derecho), dentro de un <g>. */
function PanelClima({
  meses, x0, ancho, y0, alto, lluviosos,
}: { meses: MesClima[]; x0: number; ancho: number; y0: number; alto: number; lluviosos: number[] }) {
  const col = ancho / 12
  const pmax = Math.max(100, ...meses.map((m) => m.precip_mm ?? 0))
  const escP = Math.ceil(pmax / 100) * 100
  const ts = meses.map((m) => m.temp_c).filter((v): v is number => v !== null)
  // Eje de temperatura desde 0: recortarlo exagera 2–3 °C de variación (criterio §5.2).
  const tmax = ts.length ? Math.ceil(Math.max(...ts) / 5) * 5 + 5 : 35
  const yP = (v: number) => y0 + alto - (v / escP) * alto
  const yT = (v: number) => y0 + alto - (v / tmax) * alto
  const puntos = meses.flatMap((m, i) => (m.temp_c === null ? [] : [`${x0 + col * (i + 0.5)},${yT(m.temp_c)}`]))
  return (
    <g fontFamily={FUENTE}>
      {lluviosos.map((i) => (
        <rect key={i} x={x0 + col * i} y={y0} width={col} height={alto} fill={COLOR.lluvia} opacity={0.15} />
      ))}
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={x0} x2={x0 + ancho} y1={y0 + alto - t * alto} y2={y0 + alto - t * alto} stroke="#e7e3da" />
          <text x={x0 - 6} y={y0 + alto - t * alto + 3} fontSize="9" textAnchor="end" fill={COLOR.lluvia}>{fmt(escP * t)}</text>
          <text x={x0 + ancho + 6} y={y0 + alto - t * alto + 3} fontSize="9" fill={COLOR.tempCalida}>{fmt(tmax * t)}</text>
        </g>
      ))}
      {meses.map((m, i) => m.precip_mm === null ? null : (
        <g key={i}>
          <rect x={x0 + col * i + col * 0.2} y={yP(m.precip_mm)} width={col * 0.6} height={y0 + alto - yP(m.precip_mm)} fill={COLOR.lluvia} rx={2} />
          <text x={x0 + col * (i + 0.5)} y={yP(m.precip_mm) - 3} fontSize="8" textAnchor="middle" fill="#4f7fa0">{fmt(m.precip_mm)}</text>
        </g>
      ))}
      {puntos.length > 1 && <polyline points={puntos.join(' ')} fill="none" stroke={COLOR.tempCalida} strokeWidth={1.8} />}
      {meses.map((m, i) => m.temp_c === null ? null : (
        <circle key={i} cx={x0 + col * (i + 0.5)} cy={yT(m.temp_c)} r={2.6} fill={COLOR.tempCalida} />
      ))}
      <text x={x0 - 6} y={y0 - 6} fontSize="9" textAnchor="end" fill={COLOR.lluvia}>mm</text>
      <text x={x0 + ancho + 6} y={y0 - 6} fontSize="9" fill={COLOR.tempCalida}>°C</text>
    </g>
  )
}

export function Climograma({
  meses, lluviosos, svgRef, titulo,
}: { meses: MesClima[]; lluviosos: number[]; svgRef?: Ref<SVGSVGElement>; titulo?: string }) {
  const W = 620, H = 300, x0 = 50, ancho = W - 100
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Climograma">
      <rect width={W} height={H} fill="#fff" />
      {titulo && <text x={W / 2} y={22} textAnchor="middle" fontFamily={FUENTE} fontSize="13" fontWeight={600} fill={COLOR.tinta}>{titulo}</text>}
      <PanelClima meses={meses} x0={x0} ancho={ancho} y0={44} alto={H - 90} lluviosos={lluviosos} />
      {MESES.map((m, i) => (
        <text key={m} x={x0 + (ancho / 12) * (i + 0.5)} y={H - 30} fontSize="10" textAnchor="middle" fontFamily={FUENTE} fill={COLOR.tinta}>{m}</text>
      ))}
      <g fontFamily={FUENTE} fontSize="9.5" fill={COLOR.tenue}>
        <rect x={x0} y={H - 16} width={10} height={8} fill={COLOR.lluvia} />
        <text x={x0 + 14} y={H - 9}>Precipitación media (mm)</text>
        <line x1={x0 + 170} x2={x0 + 186} y1={H - 12} y2={H - 12} stroke={COLOR.tempCalida} strokeWidth={2} />
        <text x={x0 + 190} y={H - 9}>Temperatura media (°C)</text>
        {lluviosos.length > 0 && <><rect x={x0 + 330} y={H - 16} width={10} height={8} fill={COLOR.lluvia} opacity={0.3} /><text x={x0 + 344} y={H - 9}>Meses lluviosos</text></>}
      </g>
    </svg>
  )
}

// ─── Calendario lineal multiespecie (§3.1 y §4.3) ────────────────────────────

export function CalendarioLineal({
  especies, intensidad, clima, lluviosos, svgRef, pie,
}: {
  especies: ResumenEspecie[]
  intensidad: boolean
  clima: MesClima[] | null
  lluviosos: number[]
  svgRef?: Ref<SVGSVGElement>
  pie?: string
}) {
  const trama = useId().replace(/:/g, '')
  const W = 1000, IZQ = 270, DER = 40, ancho = W - IZQ - DER, col = ancho / 12
  const FILA = 26, FRANJA = 10
  const altoClima = clima ? 150 : 0
  const yCal = 20 + altoClima + (clima ? 24 : 0) + 22
  const H = yCal + especies.length * FILA + 70 + (pie ? 18 : 0)
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Calendario fenológico lineal">
      <defs><Trama id={trama} /></defs>
      <rect width={W} height={H} fill="#fff" />
      {clima && <PanelClima meses={clima} x0={IZQ} ancho={ancho} y0={30} alto={altoClima - 10} lluviosos={lluviosos} />}
      {/* franja de meses lluviosos también sobre el calendario */}
      {lluviosos.map((i) => (
        <rect key={i} x={IZQ + col * i} y={yCal - 4} width={col} height={especies.length * FILA + 4} fill={COLOR.lluvia} opacity={0.15} />
      ))}
      {MESES.map((m, i) => (
        <text key={m} x={IZQ + col * (i + 0.5)} y={yCal - 10} fontSize="11" fontWeight={600} textAnchor="middle" fontFamily={FUENTE} fill={COLOR.tinta}>{m}</text>
      ))}
      {especies.map((e, r) => {
        const y = yCal + r * FILA
        return (
          <g key={e.especie} fontFamily={FUENTE}>
            <text x={IZQ - 10} y={y + 13} fontSize="11" textAnchor="end" fontStyle={e.especie.startsWith('(') ? 'normal' : 'italic'} fill={COLOR.tinta}>
              {e.especie.length > 34 ? e.especie.slice(0, 33) + '…' : e.especie}
              <tspan fontStyle="normal" fill={COLOR.tenue} fontSize="9">{`  n=${e.arboles}`}</tspan>
            </text>
            {(['flor', 'fruto'] as const).map((s, k) => {
              const cs = s === 'flor' ? e.flor : e.fruto
              const color = s === 'flor' ? COLOR.florLineal : COLOR.frutoLineal
              return cs.map((c, i) => (
                <rect key={`${s}${i}`} x={IZQ + col * i + 1} y={y + 2 + k * (FRANJA + 1)} width={col - 2} height={FRANJA}
                  fill={!c ? `url(#${trama})` : c.media > 0 ? color : '#f1efea'} opacity={c && c.media > 0 ? alfa(c, intensidad) : 1}>
                  <title>{`${e.especie} · ${MESES[i]} · ${s === 'flor' ? 'Floración' : 'Fructificación'}: ${c ? `Fournier ${fmt(c.media)} % · ${fmt(c.activos)} % de árboles en fase · ${c.arboles} árbol(es)` : 'sin monitoreo'}`}</title>
                </rect>
              ))
            })}
            <line x1={IZQ} x2={IZQ + ancho} y1={y + FILA - 1.5} y2={y + FILA - 1.5} stroke="#f0ede6" />
          </g>
        )
      })}
      <Leyenda x={IZQ} y={yCal + especies.length * FILA + 22} trama={trama} intensidad={intensidad}
        items={[{ c: COLOR.florLineal, t: 'Floración (botón floral o flor)' }, { c: COLOR.frutoLineal, t: 'Fructificación (fruto inmaduro o maduro)' }]} />
      {pie && <text x={20} y={H - 12} fontSize="9" fontFamily={FUENTE} fill={COLOR.tenue}>{pie}</text>}
    </svg>
  )
}

function Leyenda({ x, y, items, trama, intensidad }: { x: number; y: number; items: { c: string; t: string }[]; trama: string; intensidad: boolean }) {
  const xs = items.map((_, i) => x + items.slice(0, i).reduce((s, it) => s + 30 + it.t.length * 5.6, 0))
  const cx = x + items.reduce((s, it) => s + 30 + it.t.length * 5.6, 0)
  return (
    <g fontFamily={FUENTE} fontSize="10" fill={COLOR.tenue}>
      {items.map((it, i) => (
        <g key={it.t}>
          <rect x={xs[i]} y={y - 9} width={16} height={10} fill={it.c} />
          <text x={xs[i] + 21} y={y}>{it.t}</text>
        </g>
      ))}
      <rect x={cx} y={y - 9} width={16} height={10} fill="#f1efea" stroke="#e2ded5" />
      <text x={cx + 21} y={y}>Sin actividad</text>
      <rect x={cx + 105} y={y - 9} width={16} height={10} fill={`url(#${trama})`} stroke="#e2ded5" />
      <text x={cx + 126} y={y}>Sin monitoreo</text>
      {intensidad && <text x={x} y={y + 18}>Intensidad = transparencia: más opaco, mayor índice de Fournier (promedio del % de copa).</text>}
    </g>
  )
}

// ─── Mapa de calor (§3.2) ────────────────────────────────────────────────────

export function MapaCalor({
  filas, paneles, svgRef, pie,
}: {
  filas: { especie: string; n: number }[]
  /** Un panel por serie: título y, por fila, las 12 celdas. */
  paneles: { titulo: string; celdas: (Celda | null)[][] }[]
  svgRef?: Ref<SVGSVGElement>
  pie?: string
}) {
  const trama = useId().replace(/:/g, '')
  const IZQ = 250, CEL = 22, SEP = 30, FILA = 18
  const anchoPanel = CEL * 12
  const W = IZQ + paneles.length * anchoPanel + (paneles.length - 1) * SEP + 30
  const y0 = 56
  const H = y0 + filas.length * FILA + 70 + (pie ? 16 : 0)
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Mapa de calor fenológico">
      <defs><Trama id={trama} /></defs>
      <rect width={W} height={H} fill="#fff" />
      <g fontFamily={FUENTE}>
        {filas.map((f, r) => (
          <text key={f.especie} x={IZQ - 8} y={y0 + r * FILA + 13} fontSize="10.5" textAnchor="end" fontStyle={f.especie.startsWith('(') ? 'normal' : 'italic'} fill={COLOR.tinta}>
            {f.especie.length > 34 ? f.especie.slice(0, 33) + '…' : f.especie}
          </text>
        ))}
        {paneles.map((p, k) => {
          const px = IZQ + k * (anchoPanel + SEP)
          return (
            <g key={p.titulo}>
              <text x={px + anchoPanel / 2} y={20} fontSize="12" fontWeight={600} textAnchor="middle" fill={COLOR.tinta}>{p.titulo}</text>
              {MESES.map((m, i) => (
                <text key={m} x={px + CEL * (i + 0.5)} y={y0 - 8} fontSize="8.5" textAnchor="middle" fill={COLOR.tenue}>{m[0]}</text>
              ))}
              {p.celdas.map((fila, r) => fila.map((c, i) => (
                <rect key={`${r}-${i}`} x={px + CEL * i + 0.5} y={y0 + r * FILA + 0.5} width={CEL - 1} height={FILA - 1}
                  fill={c ? mezclar(COLOR.calorBajo, COLOR.calorAlto, c.media / 100) : `url(#${trama})`}>
                  <title>{`${filas[r].especie} · ${MESES[i]} · ${p.titulo}: ${c ? `Fournier ${fmt(c.media)} % (${fmt(c.media / 25, 1)} de 4) · ${c.arboles} árbol(es)` : 'sin monitoreo'}`}</title>
                </rect>
              )))}
            </g>
          )
        })}
        {/* escala */}
        <g transform={`translate(${IZQ}, ${y0 + filas.length * FILA + 22})`} fontSize="9.5" fill={COLOR.tenue}>
          {[0, 1, 2, 3, 4].map((f) => (
            <g key={f}>
              <rect x={f * 34} y={0} width={34} height={10} fill={mezclar(COLOR.calorBajo, COLOR.calorAlto, f / 4)} />
              <text x={f * 34 + 17} y={22} textAnchor="middle">{f}</text>
            </g>
          ))}
          <text x={180} y={9}>Índice de Fournier (0 = ausente · 4 = 76–100 % de copa)</text>
          <rect x={180} y={16} width={14} height={9} fill={`url(#${trama})`} stroke="#e2ded5" />
          <text x={198} y={24}>Sin monitoreo</text>
        </g>
        {pie && <text x={14} y={H - 10} fontSize="9" fill={COLOR.tenue}>{pie}</text>}
      </g>
    </svg>
  )
}

// ─── Calendario circular (§3.3 y §4.1) ───────────────────────────────────────

const rad = (g: number) => (g * Math.PI) / 180
function punto(cx: number, cy: number, r: number, g: number) {
  return [cx + r * Math.sin(rad(g)), cy - r * Math.cos(rad(g))] as const
}
/** Sector anular de g0 a g1 grados (0 = arriba, sentido horario). */
function sector(cx: number, cy: number, r0: number, r1: number, g0: number, g1: number) {
  const [a, b] = punto(cx, cy, r1, g0)
  const [c, d] = punto(cx, cy, r1, g1)
  const [e, f] = punto(cx, cy, r0, g1)
  const [g, h] = punto(cx, cy, r0, g0)
  const grande = g1 - g0 > 180 ? 1 : 0
  return `M${a},${b} A${r1},${r1} 0 ${grande} 1 ${c},${d} L${e},${f} A${r0},${r0} 0 ${grande} 0 ${g},${h} Z`
}

export function CalendarioCircular({
  e, intensidad, clima, svgRef, pie,
}: {
  e: ResumenEspecie
  intensidad: boolean
  /** Con clima: anillo de temperatura y barras de lluvia por fuera (§4.1). */
  clima: MesClima[] | null
  svgRef?: Ref<SVGSVGElement>
  pie?: string
}) {
  const trama = useId().replace(/:/g, '')
  const R = { fi: 100, fe: 165, fl: 170, ext: 240 }
  const pmax = Math.max(100, ...(clima?.map((m) => m.precip_mm ?? 0) ?? [0]))
  const escP = Math.ceil(pmax / 100) * 100
  const rT0 = R.ext + 6, rT1 = R.ext + 34, rP0 = rT1 + 6, largoP = 95
  const rEtq = clima ? rP0 + largoP + 22 : R.ext + 20
  const W = 2 * rEtq + 70
  const cx = W / 2, cy = 120 + rEtq
  const H = cy + rEtq + 84 + (pie ? 14 : 0)
  // Escala fija de 20 a 30 °C: estirarla al mínimo y máximo del año pinta
  // 2 °C de diferencia como de fresco a muy cálido (criterio §5.2).
  const tono = (t: number) => (t - 20) / 10

  const anillo = (cs: (Celda | null)[], r0: number, r1: number, color: string, nombre: string) =>
    cs.map((c, i) => (
      <path key={`${nombre}${i}`} d={sector(cx, cy, r0, r1, i * 30, (i + 1) * 30)}
        fill={!c ? `url(#${trama})` : c.media > 0 ? color : COLOR.sinActividad}
        opacity={c && c.media > 0 ? alfa(c, intensidad) : 1} stroke="#fff" strokeWidth={2.5}>
        <title>{`${MESES[i]} · ${nombre}: ${c ? `Fournier ${fmt(c.media)} % · ${c.arboles} árbol(es)` : 'sin monitoreo'}`}</title>
      </path>
    ))

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Calendario fenológico de ${e.especie}`}>
      <defs><Trama id={trama} /></defs>
      <rect width={W} height={H} fill="#fff" />
      <g fontFamily={FUENTE}>
        {/* título en recuadro verde con borde negro */}
        <rect x={cx - 170} y={18} width={340} height={40} fill={COLOR.frutoAnillo} stroke="#000" strokeWidth={2} />
        <text x={cx} y={45} textAnchor="middle" fontSize="19" fontWeight={700} fill="#fff" letterSpacing="1.5">CALENDARIO FENOLÓGICO</text>
        <text x={cx} y={84} textAnchor="middle" fontSize="17" fontStyle={e.especie.startsWith('(') ? 'normal' : 'italic'} fill={COLOR.tinta}>{e.especie}</text>
        {e.comunes.length > 0 && <text x={cx} y={104} textAnchor="middle" fontSize="11.5" fill={COLOR.tenue}>{e.comunes.join(' · ')}</text>}

        {anillo(e.fruto, R.fi, R.fe, COLOR.frutoAnillo, 'Fructificación')}
        {anillo(e.flor, R.fl, R.ext, COLOR.florAnillo, 'Floración')}
        <circle cx={cx} cy={cy} r={R.fi - 1} fill="none" stroke="#000" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={R.ext + 1} fill="none" stroke="#000" strokeWidth={2} />

        {clima && clima.map((m, i) => {
          const medio = i * 30 + 15
          const t = m.temp_c
          const [tx, ty] = punto(cx, cy, (rT0 + rT1) / 2, medio)
          const largo = m.precip_mm === null ? 0 : (m.precip_mm / escP) * largoP
          const [px, py] = punto(cx, cy, rP0 + largo + 10, medio)
          return (
            <g key={`c${i}`}>
              <path d={sector(cx, cy, rT0, rT1, i * 30, (i + 1) * 30)} stroke="#fff" strokeWidth={1.5}
                fill={t === null ? '#f4f2ee' : mezclar(COLOR.tempFria, COLOR.tempCalida, tono(t))} />
              {t !== null && <text x={tx} y={ty + 3.5} fontSize="10" textAnchor="middle" fill={COLOR.tinta}>{fmt(t, 1)}°</text>}
              {largo > 0 && <path d={sector(cx, cy, rP0, rP0 + largo, i * 30 + 7, (i + 1) * 30 - 7)} fill={COLOR.lluvia} />}
              {m.precip_mm !== null && <text x={px} y={py + 3.5} fontSize="9.5" textAnchor="middle" fill="#4f7fa0">{fmt(m.precip_mm)}</text>}
            </g>
          )
        })}
        {clima && <circle cx={cx} cy={cy} r={rP0 + largoP} fill="none" stroke={COLOR.lluvia} strokeDasharray="3 4" />}

        {MESES.map((m, i) => {
          const g = i * 30 + 15
          const [x, y] = punto(cx, cy, rEtq, g)
          const giro = g > 90 && g < 270 ? g + 180 : g
          return (
            <text key={m} x={x} y={y} transform={`rotate(${giro} ${x} ${y})`} textAnchor="middle" dominantBaseline="middle"
              fontSize="14" fontWeight={700} fill={COLOR.tinta}>{m.toUpperCase()}</text>
          )
        })}

        {/* leyenda */}
        <g transform={`translate(${cx - 230}, ${cy + rEtq + 34})`} fontSize="11" fill={COLOR.tinta}>
          <rect width={14} height={14} fill={COLOR.florAnillo} /><text x={20} y={11}>Floración (anillo exterior)</text>
          <rect x={190} width={14} height={14} fill={COLOR.frutoAnillo} /><text x={210} y={11}>Fructificación (interior)</text>
          <rect x={375} width={14} height={14} fill={COLOR.sinActividad} /><text x={395} y={11}>Sin actividad</text>
          <rect y={22} width={14} height={14} fill={`url(#${trama})`} stroke="#ddd" /><text x={20} y={33}>Sin monitoreo</text>
          {clima && <text x={190} y={33} fill={COLOR.tenue}>Anillo: temperatura media (°C, escala 20–30). Barras: lluvia (mm); punteado = {fmt(escP)} mm.</text>}
        </g>
        {pie && <text x={14} y={H - 10} fontSize="9" fill={COLOR.tenue}>{pie}</text>}
      </g>
    </svg>
  )
}

// ─── Curvas por ronda ────────────────────────────────────────────────────────

export function CurvasRonda({
  rondas, series, svgRef, alto = 260,
}: {
  rondas: string[]
  series: { nombre: string; color: string; valores: (number | null)[] }[]
  svgRef?: Ref<SVGSVGElement>
  alto?: number
}) {
  const W = 760, x0 = 44, y0 = 16, ancho = W - x0 - 170, H = alto, altoG = H - 50
  const paso = rondas.length > 1 ? ancho / (rondas.length - 1) : 0
  const y = (v: number) => y0 + altoG - (v / 100) * altoG
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Fenofases por ronda">
      <rect width={W} height={H} fill="#fff" />
      <g fontFamily={FUENTE} fontSize="9.5" fill={COLOR.tenue}>
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={x0} x2={x0 + ancho} y1={y(v)} y2={y(v)} stroke="#eeeae2" />
            <text x={x0 - 6} y={y(v) + 3} textAnchor="end">{v}%</text>
          </g>
        ))}
        {rondas.map((r, i) => (
          <text key={r} x={x0 + paso * i} y={H - 18} textAnchor="middle">{`${MESES[Number(r.slice(5, 7)) - 1]} ${r.slice(2, 4)}`}</text>
        ))}
        {series.map((s, k) => {
          const pts = s.valores.map((v, i) => (v === null ? null : [x0 + paso * i, y(v)] as const))
          return (
            <g key={s.nombre}>
              <polyline points={pts.filter(Boolean).map((p) => p!.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth={2} />
              {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r={2.8} fill={s.color}><title>{`${s.nombre} · ${rondas[i]}: ${fmt(s.valores[i]!)} %`}</title></circle>)}
              <rect x={x0 + ancho + 20} y={y0 + k * 17} width={12} height={4} fill={s.color} />
              <text x={x0 + ancho + 38} y={y0 + k * 17 + 5} fill={COLOR.tinta}>{s.nombre}</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}

/** Doce casillas pequeñas para una fila de tabla (ventana de cosecha, árbol). */
export function TiraMeses({ celdas, color }: { celdas: (Celda | null)[]; color: string }) {
  return (
    <span className="inline-flex gap-[2px] align-middle">
      {celdas.map((c, i) => (
        <span key={i} title={`${MESES[i]}: ${c ? `${fmt(c.media)} %` : 'sin monitoreo'}`}
          className="inline-block h-3.5 w-3 rounded-[3px]"
          style={c
            ? { background: c.media > 0 ? color : COLOR.sinActividad, opacity: c.media > 0 ? Math.max(0.3, c.media / 100) : 1 }
            : { background: 'repeating-linear-gradient(45deg,#fafaf8 0 2px,#dedad2 2px 3px)' }} />
      ))}
    </span>
  )
}
