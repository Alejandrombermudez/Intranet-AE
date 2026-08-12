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
}

/**
 * Mapa satelital que compara lo que el SIG dibujó con lo que campo devolvió.
 * La geometría "antes" va como sombra gris punteada debajo de la corregida.
 */
export default function MapaCampo({ capas, className }: Props) {
  const elRef  = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const grupoRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, { scrollWheelZoom: true }).setView([1.6, -75.6], 8)
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri', maxZoom: 19,
    }).addTo(map)
    grupoRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; grupoRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current, grupo = grupoRef.current
    if (!map || !grupo) return
    grupo.clearLayers()

    // El "antes" se pinta primero para que quede debajo de la versión vigente.
    const orden: CapaCampo['tipo'][] = ['finca', 'antes', 'descartada', 'confirmada', 'modificada', 'nueva']
    const ordenadas = [...capas].sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo))

    for (const c of ordenadas) {
      const base = ESTILOS[c.tipo]
      const estilo: L.PathOptions = c.destacada
        ? { ...base, weight: (base.weight ?? 2) + 3, fillOpacity: Math.min((base.fillOpacity ?? 0.2) + 0.2, 0.6) }
        : base
      const capa = L.geoJSON(c.geom, { style: estilo })
      if (c.etiqueta) capa.bindTooltip(c.etiqueta, { sticky: true })
      capa.addTo(grupo)
    }

    try {
      const b = L.featureGroup(grupo.getLayers() as L.Layer[]).getBounds()
      if (b.isValid()) map.fitBounds(b, { padding: [24, 24], maxZoom: 17 })
    } catch { /* sin geometrías válidas */ }
  }, [capas])

  return <div ref={elRef} className={className ?? 'w-full h-96 rounded-xl overflow-hidden border border-stone-200 z-0'} />
}
