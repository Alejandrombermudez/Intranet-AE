'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Geometry } from 'geojson'
import { COLOR_CAMPO, COLOR_SELECCION } from '@/lib/colores-campo'

/** Una capa del mapa de campo, ya clasificada por quien la dibuja. */
export interface CapaCampo {
  id: string
  geom: Geometry
  tipo: 'finca' | 'antes' | 'confirmada' | 'modificada' | 'nueva' | 'descartada'
  etiqueta?: string
  destacada?: boolean
  /** Marcada por el usuario (borde amarillo, como la selección en un GIS). */
  seleccionada?: boolean
  /** Texto fijo sobre la zona (p. ej. su número), para cruzarla con la lista. */
  rotulo?: string
  /** Se dibuja pero no cuenta para encuadrar (p. ej. el predio, al filtrar zonas). */
  sinEncuadre?: boolean
}

// Mismos colores que usa el técnico en la app de campo, para que la oficina y
// el terreno estén viendo literalmente lo mismo. Viven en lib/colores-campo.ts
// para que las leyendas lean de la misma fuente y no se desalineen del mapa.
const C = COLOR_CAMPO
const ESTILOS: Record<CapaCampo['tipo'], L.PathOptions> = {
  finca:       { color: C.finca, weight: 2, dashArray: '6 4', fill: false },
  antes:       { color: C.antes, weight: 2, dashArray: '3 5', fillColor: C.antes, fillOpacity: 0.15 },
  confirmada:  { color: C.confirmada, weight: 3, fillColor: C.confirmada, fillOpacity: 0.2 },
  modificada:  { color: C.modificada, weight: 3, fillColor: C.modificada, fillOpacity: 0.25 },
  nueva:       { color: C.nueva, weight: 3, fillColor: C.nueva, fillOpacity: 0.25 },
  descartada:  { color: C.descartada, weight: 2, dashArray: '4 6', fillColor: C.descartada, fillOpacity: 0.08 },
}

interface Props {
  capas: CapaCampo[]
  className?: string
  /** Estilos alternativos por tipo de capa. El informe corporativo usa la
   *  paleta del manual de marca; el SIG conserva los colores de campo. */
  estilos?: Partial<Record<CapaCampo['tipo'], L.PathOptions>>
  /** Capa base: 'satelital' (Esri, por defecto) o 'clara' para impresión. */
  base?: 'satelital' | 'clara'
  /** Clic sobre una zona (no sobre el límite del predio ni la sombra del "antes"). */
  onClickCapa?: (id: string) => void
  /**
   * Cuándo reencuadrar. Sin esta prop, el mapa se ajusta a las capas cada vez
   * que cambian. Con ella, solo cuando cambia su valor: así marcar una zona no
   * hace saltar el mapa mientras se trabaja.
   */
  encuadre?: string
}

/**
 * Mapa satelital que compara lo que el SIG dibujó con lo que campo devolvió.
 * La geometría "antes" va como sombra gris punteada debajo de la corregida.
 */
export default function MapaCampo({ capas, className, estilos, base = 'satelital', onClickCapa, encuadre }: Props) {
  const elRef  = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const grupoRef = useRef<L.LayerGroup | null>(null)
  const encuadreRef = useRef<string | null | undefined>(undefined)
  const clicRef = useRef(onClickCapa)

  useEffect(() => { clicRef.current = onClickCapa }, [onClickCapa])

  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, { scrollWheelZoom: true }).setView([1.6, -75.6], 8)
    const capaBase = base === 'clara'
      ? L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap, &copy; CARTO', maxZoom: 19,
        })
      : L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: '&copy; Esri', maxZoom: 19,
        })
    capaBase.addTo(map)
    grupoRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    encuadreRef.current = undefined
    return () => { map.remove(); mapRef.current = null; grupoRef.current = null }
  }, [base])

  useEffect(() => {
    const map = mapRef.current, grupo = grupoRef.current
    if (!map || !grupo) return
    grupo.clearLayers()

    // El "antes" se pinta primero para que quede debajo de la versión vigente,
    // y lo seleccionado al final para que su borde no quede tapado.
    const orden: CapaCampo['tipo'][] = ['finca', 'antes', 'descartada', 'confirmada', 'modificada', 'nueva']
    const ordenadas = [...capas].sort((a, b) =>
      (Number(!!a.seleccionada) - Number(!!b.seleccionada)) || (orden.indexOf(a.tipo) - orden.indexOf(b.tipo)))

    const paraEncuadrar: L.GeoJSON[] = []
    for (const c of ordenadas) {
      const propio = { ...ESTILOS[c.tipo], ...(estilos?.[c.tipo] ?? {}) }
      let estilo: L.PathOptions = c.destacada
        ? { ...propio, weight: (propio.weight ?? 2) + 3, fillOpacity: Math.min((propio.fillOpacity ?? 0.2) + 0.2, 0.6) }
        : propio
      if (c.seleccionada) {
        estilo = { ...estilo, color: COLOR_SELECCION, weight: 4, dashArray: undefined,
                   fillOpacity: Math.min((estilo.fillOpacity ?? 0.2) + 0.15, 0.5) }
      }
      const esZona = c.tipo !== 'finca' && c.tipo !== 'antes'
      // Una geometría corrupta hace que L.geoJSON lance y, al ser un efecto de
      // React, se lleve por delante la página entera. Mejor perder esa capa.
      try {
        const capa = L.geoJSON(c.geom, { style: estilo })
        if (c.etiqueta) capa.bindTooltip(c.etiqueta, { sticky: true })
        if (esZona && clicRef.current) {
          capa.on('click', (e) => { L.DomEvent.stopPropagation(e); clicRef.current?.(c.id) })
        }
        capa.addTo(grupo)
        if (!c.sinEncuadre) paraEncuadrar.push(capa)
        if (c.rotulo) {
          const centro = capa.getBounds().getCenter()
          L.tooltip({
            permanent: true, direction: 'center', interactive: false,
            className: 'bg-stone-900/75! text-white! border-0! shadow-none! rounded-md! px-1.5! py-0.5! text-[11px]! font-black! before:hidden!',
          }).setLatLng(centro).setContent(c.rotulo).addTo(grupo)
        }
      } catch {
        console.warn('Geometría inválida, capa omitida:', c.id)
      }
    }

    // Sin `encuadre`, se ajusta siempre (como antes). Con él, solo al cambiar.
    if (encuadre !== undefined && encuadreRef.current === encuadre) return
    encuadreRef.current = encuadre
    try {
      const b = L.featureGroup(paraEncuadrar).getBounds()
      if (b.isValid()) map.fitBounds(b, { padding: [24, 24], maxZoom: 17 })
    } catch { /* sin geometrías válidas */ }
  }, [capas, estilos, encuadre])

  return <div ref={elRef} className={className ?? 'w-full h-96 rounded-xl overflow-hidden border border-stone-200 z-0'} />
}
