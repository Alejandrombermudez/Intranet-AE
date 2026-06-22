'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, FeatureCollection } from 'geojson'

/** Mapa pequeño con basemap OpenStreetMap que pinta zonas (polígonos) en 4326. */
export default function MapaZonas({ features, className }: { features: Feature[]; className?: string }) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
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

  // pinta / actualiza las zonas
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null }
    if (!features || features.length === 0) return
    const layer = L.geoJSON({ type: 'FeatureCollection', features } as FeatureCollection, {
      style: { color: '#0d9488', weight: 2, fillColor: '#14b8a6', fillOpacity: 0.25 },
    }).addTo(map)
    layerRef.current = layer
    try { map.fitBounds(layer.getBounds(), { padding: [20, 20], maxZoom: 16 }) } catch { /* sin bounds */ }
  }, [features])

  return <div ref={elRef} className={className ?? 'w-full h-80 rounded-xl overflow-hidden border border-stone-200 z-0'} />
}
