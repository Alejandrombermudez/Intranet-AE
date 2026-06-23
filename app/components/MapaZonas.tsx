'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, FeatureCollection } from 'geojson'

interface Props {
  features: Feature[]
  baseFeatures?: Feature[]              // capa de fondo (p. ej. el polígono ya guardado), en gris
  selectedIndices?: number[]           // resalta varias features de `features`
  onSelect?: (index: number) => void   // clic en una feature → alterna su selección
  className?: string
}

/** Mapa con basemap OpenStreetMap que pinta zonas (polígonos) en 4326. */
export default function MapaZonas({ features, baseFeatures, selectedIndices, onSelect, className }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const baseRef = useRef<L.GeoJSON | null>(null)
  const layerRef = useRef<L.GeoJSON | null>(null)

  // init + cleanup
  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, { scrollWheelZoom: true }).setView([1.6, -75.6], 7) // Caquetá aprox.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap', maxZoom: 19,
    }).addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // capa base (gris, punteada)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (baseRef.current) { baseRef.current.remove(); baseRef.current = null }
    if (!baseFeatures || baseFeatures.length === 0) return
    baseRef.current = L.geoJSON({ type: 'FeatureCollection', features: baseFeatures } as FeatureCollection, {
      style: { color: '#78716c', weight: 2, fillColor: '#a8a29e', fillOpacity: 0.12, dashArray: '4 3' },
    }).addTo(map)
  }, [baseFeatures])

  // capa principal (con selección + clic)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null }

    const layer = L.geoJSON({ type: 'FeatureCollection', features } as FeatureCollection, {
      style: (feat) => {
        const idx = feat ? features.indexOf(feat as Feature) : -1
        const sel = idx >= 0 && (selectedIndices?.includes(idx) ?? false)
        return { color: sel ? '#0d9488' : '#94a3b8', weight: sel ? 3 : 1.5, fillColor: sel ? '#14b8a6' : '#cbd5e1', fillOpacity: sel ? 0.4 : 0.12 }
      },
      onEachFeature: onSelect
        ? (feat, lyr) => { const idx = features.indexOf(feat as Feature); lyr.on('click', () => onSelect(idx)) }
        : undefined,
    }).addTo(map)
    layerRef.current = layer

    // encuadrar a todo lo visible (base + features)
    try {
      const todo = L.geoJSON({ type: 'FeatureCollection', features: [...(baseFeatures ?? []), ...features] } as FeatureCollection)
      const b = todo.getBounds()
      if (b.isValid()) map.fitBounds(b, { padding: [20, 20], maxZoom: 16 })
    } catch { /* sin bounds */ }
  }, [features, baseFeatures, selectedIndices, onSelect])

  return <div ref={elRef} className={className ?? 'w-full h-80 rounded-xl overflow-hidden border border-stone-200 z-0'} />
}
