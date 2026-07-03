'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Feature, FeatureCollection } from 'geojson'

export interface PuntoArbol {
  id: string
  latitud: number | null
  longitud: number | null
}

interface Poligonos {
  finca?: Feature[] | null
  conservacion?: Feature[] | null
}

interface Props {
  arboles: PuntoArbol[]
  poligonos?: Poligonos
  /** id del árbol seleccionado — se dibuja más grande con un halo de acento. */
  selectedId?: string | null
  /** clic en un árbol del mapa. Si no se provee, los árboles no son clicables. */
  onSelectArbol?: (id: string) => void
  className?: string
}

const PRIMARY = '#0d7377'
const ACCENT = '#f59e0b' // ámbar — árbol seleccionado

/**
 * Un predio real nunca abarca varios grados de lat/lon — si el bbox de un polígono
 * los supera (o cae fuera de rango geográfico), es señal de reproyección fallida
 * (shapefile sin .prj o mal convertido: coordenadas UTM crudas tratadas como grados).
 * Se descarta ese polígono para el zoom en vez de dejar el mapa pegado en la vista
 * inicial (toda Colombia, con los árboles reales superpuestos en un solo punto).
 */
function bboxRazonable(b: L.LatLngBounds): boolean {
  const sw = b.getSouthWest(); const ne = b.getNorthEast()
  if (Math.abs(sw.lat) > 90 || Math.abs(ne.lat) > 90 || Math.abs(sw.lng) > 180 || Math.abs(ne.lng) > 180) return false
  return Math.abs(ne.lat - sw.lat) <= 2 && Math.abs(ne.lng - sw.lng) <= 2
}

/** Mapa satelital que pinta el/los polígono(s) del predio y sus árboles semilleros (puntos seleccionables). */
export default function MapaArboles({ arboles, poligonos, selectedId, onSelectArbol, className }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const fitDoneRef = useRef<{ arboles: PuntoArbol[] | null; finca: Feature[] | null; conservacion: Feature[] | null }>({
    arboles: null, finca: null, conservacion: null,
  })

  const finca = poligonos?.finca ?? null
  const conservacion = poligonos?.conservacion ?? null

  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, { scrollWheelZoom: true }).setView([1.6, -75.6], 7)
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri', maxZoom: 19 }
    ).addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null }

    const group = L.layerGroup()

    // ── Polígonos (dibujados primero, para que los árboles queden por encima) ──
    if (finca && finca.length > 0) {
      L.geoJSON({ type: 'FeatureCollection', features: finca } as FeatureCollection, {
        style: { color: '#78716c', weight: 2, fillColor: '#a8a29e', fillOpacity: 0.12, dashArray: '4 3' },
      }).addTo(group)
    }
    if (conservacion && conservacion.length > 0) {
      L.geoJSON({ type: 'FeatureCollection', features: conservacion } as FeatureCollection, {
        style: { color: '#0d9488', weight: 2.5, fillColor: '#14b8a6', fillOpacity: 0.08 },
      }).addTo(group)
    }

    // ── Árboles ──
    const pts = arboles.filter((a) => a.latitud != null && a.longitud != null)
    for (const a of pts) {
      const latlng: [number, number] = [a.latitud as number, a.longitud as number]
      const seleccionado = a.id === selectedId
      if (seleccionado) {
        L.circleMarker(latlng, { radius: 14, color: ACCENT, weight: 1, fillColor: ACCENT, fillOpacity: 0.25 })
          .addTo(group)
      }
      const m = L.circleMarker(latlng, {
        radius: seleccionado ? 8 : 5,
        fillColor: seleccionado ? ACCENT : PRIMARY,
        color: '#fff',
        weight: seleccionado ? 2 : 1.5,
        fillOpacity: 0.92,
      })
      if (onSelectArbol) m.on('click', () => onSelectArbol(a.id))
      m.addTo(group)
    }
    group.addTo(map)
    layerRef.current = group

    const datasetChanged =
      fitDoneRef.current.arboles !== arboles ||
      fitDoneRef.current.finca !== finca ||
      fitDoneRef.current.conservacion !== conservacion

    if (datasetChanged) {
      fitDoneRef.current = { arboles, finca, conservacion }
      // Los puntos de árbol (coordenadas decimales en BD) son la fuente confiable de zoom.
      // Los polígonos (shapefiles subidos) solo se suman si su bbox es geográficamente
      // razonable — así un .prj faltante o mal reproyectado nunca deja el mapa sin zoom.
      let bounds = pts.length ? L.latLngBounds(pts.map((a) => [a.latitud as number, a.longitud as number])) : null
      for (const capa of [finca, conservacion]) {
        if (!capa || capa.length === 0) continue
        try {
          const polyBounds = L.geoJSON({ type: 'FeatureCollection', features: capa } as FeatureCollection).getBounds()
          if (polyBounds.isValid() && bboxRazonable(polyBounds)) {
            bounds = bounds ? bounds.extend(polyBounds) : polyBounds
          }
        } catch { /* polígono no aporta bounds; seguimos con lo que ya tengamos */ }
      }
      if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17 })
    } else if (selectedId) {
      const sel = pts.find((a) => a.id === selectedId)
      if (sel) map.panTo([sel.latitud as number, sel.longitud as number])
    }
  }, [arboles, finca, conservacion, selectedId, onSelectArbol])

  return <div ref={elRef} className={className ?? 'w-full h-96 rounded-xl overflow-hidden border border-stone-200 z-0'} />
}
