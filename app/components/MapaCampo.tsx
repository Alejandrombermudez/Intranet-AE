'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Geometry } from 'geojson'

/** Una capa del mapa de campo, ya clasificada por quien la dibuja. */
export interface CapaCampo {
  id: string
  geom: Geometry
  tipo: 'finca' | 'antes' | 'confirmada' | 'modificada' | 'nueva' | 'descartada'
  etiqueta?: string
  destacada?: boolean
}

// Mismos colores que usa el técnico en la app de campo, para que la oficina y
// el terreno estén viendo literalmente lo mismo.
const ESTILOS: Record<CapaCampo['tipo'], L.PathOptions> = {
  finca:       { color: '#57534e', weight: 2, dashArray: '6 4', fill: false },
  antes:       { color: '#6b7280', weight: 2, dashArray: '3 5', fillColor: '#6b7280', fillOpacity: 0.15 },
  confirmada:  { color: '#10b981', weight: 3, fillColor: '#10b981', fillOpacity: 0.2 },
  modificada:  { color: '#3b82f6', weight: 3, fillColor: '#3b82f6', fillOpacity: 0.25 },
  nueva:       { color: '#14b8a6', weight: 3, fillColor: '#14b8a6', fillOpacity: 0.25 },
  descartada:  { color: '#ef4444', weight: 2, dashArray: '4 6', fillColor: '#ef4444', fillOpacity: 0.08 },
}

interface Props {
  capas: CapaCampo[]
  className?: string
  /** Estilos alternativos por tipo de capa. El informe corporativo usa la
   *  paleta del manual de marca; el SIG conserva los colores de campo. */
  estilos?: Partial<Record<CapaCampo['tipo'], L.PathOptions>>
  /** Capa base: 'satelital' (Esri, por defecto) o 'clara' para impresión. */
  base?: 'satelital' | 'clara'
}

/**
 * Mapa satelital que compara lo que el SIG dibujó con lo que campo devolvió.
 * La geometría "antes" va como sombra gris punteada debajo de la corregida.
 */
export default function MapaCampo({ capas, className, estilos, base = 'satelital' }: Props) {
  const elRef  = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const grupoRef = useRef<L.LayerGroup | null>(null)

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
    return () => { map.remove(); mapRef.current = null; grupoRef.current = null }
  }, [base])

  useEffect(() => {
    const map = mapRef.current, grupo = grupoRef.current
    if (!map || !grupo) return
    grupo.clearLayers()

    // El "antes" se pinta primero para que quede debajo de la versión vigente.
    const orden: CapaCampo['tipo'][] = ['finca', 'antes', 'descartada', 'confirmada', 'modificada', 'nueva']
    const ordenadas = [...capas].sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo))

    for (const c of ordenadas) {
      const propio = { ...ESTILOS[c.tipo], ...(estilos?.[c.tipo] ?? {}) }
      const estilo: L.PathOptions = c.destacada
        ? { ...propio, weight: (propio.weight ?? 2) + 3, fillOpacity: Math.min((propio.fillOpacity ?? 0.2) + 0.2, 0.6) }
        : propio
      // Una geometría corrupta hace que L.geoJSON lance y, al ser un efecto de
      // React, se lleve por delante la página entera. Mejor perder esa capa.
      try {
        const capa = L.geoJSON(c.geom, { style: estilo })
        if (c.etiqueta) capa.bindTooltip(c.etiqueta, { sticky: true })
        capa.addTo(grupo)
      } catch {
        console.warn('Geometría inválida, capa omitida:', c.id)
      }
    }

    try {
      const b = L.featureGroup(grupo.getLayers() as L.Layer[]).getBounds()
      if (b.isValid()) map.fitBounds(b, { padding: [24, 24], maxZoom: 17 })
    } catch { /* sin geometrías válidas */ }
  }, [capas, estilos])

  return <div ref={elRef} className={className ?? 'w-full h-96 rounded-xl overflow-hidden border border-stone-200 z-0'} />
}
