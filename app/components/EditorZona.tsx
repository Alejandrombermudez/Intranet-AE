'use client'
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import type { Geometry, MultiPolygon, Polygon, Position } from 'geojson'
import { COLOR_CAMPO, COLOR_SELECCION } from '@/lib/colores-campo'

export interface ContextoEditor {
  geom: Geometry
  /** finca = límite del predio · antes = cómo estaba la zona · otra = las demás zonas */
  tipo: 'finca' | 'antes' | 'otra'
}

interface Props {
  /** La geometría que se edita. Cambiarla (p. ej. al cargar un .zip) rehace el editor. */
  geom: Geometry
  contexto?: ContextoEditor[]
  /** Cada vez que el usuario mueve, agrega o quita un vértice. */
  onCambio: (g: Geometry) => void
  className?: string
}

const ESTILO_CONTEXTO: Record<ContextoEditor['tipo'], L.PathOptions> = {
  finca: { color: COLOR_CAMPO.finca, weight: 2, dashArray: '6 4', fill: false, interactive: false },
  antes: { color: '#ffffff', weight: 2, dashArray: '3 5', fillColor: COLOR_CAMPO.antes, fillOpacity: 0.15, interactive: false },
  otra:  { color: '#e7e5e4', weight: 1.5, fillColor: '#e7e5e4', fillOpacity: 0.08, interactive: false },
}

// Leaflet guarda un MultiPolygon en UNA sola capa (L.Polygon con anillos
// anidados), así que casi siempre hay una capa. Si llegaran varias, se juntan
// en un MultiPolygon: la zona es una sola aunque tenga partes separadas.
function geometriaDe(capas: L.Polygon[]): Geometry | null {
  const partes: Position[][][] = []
  for (const c of capas) {
    const g = c.toGeoJSON().geometry as Polygon | MultiPolygon
    if (g.type === 'Polygon') partes.push(g.coordinates)
    else if (g.type === 'MultiPolygon') partes.push(...g.coordinates)
  }
  if (partes.length === 0) return null
  return partes.length === 1 ? { type: 'Polygon', coordinates: partes[0] } : { type: 'MultiPolygon', coordinates: partes }
}

/**
 * Editor de vértices para que el SIG corrija el límite de una zona sobre el
 * satelital. Usa leaflet-geoman con las mismas opciones que la app de campo:
 * arrastrar mueve un vértice, tocarlo lo quita, y el punto medio de cada lado
 * agrega uno. No deja cruzar el polígono sobre sí mismo.
 */
export default function EditorZona({ geom, contexto = [], onCambio, className }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const onCambioRef = useRef(onCambio)
  const contextoRef = useRef(contexto)

  useEffect(() => { onCambioRef.current = onCambio }, [onCambio])
  useEffect(() => { contextoRef.current = contexto }, [contexto])

  useEffect(() => {
    if (!elRef.current) return
    const map = L.map(elRef.current, { scrollWheelZoom: true })
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri', maxZoom: 19,
    }).addTo(map)

    for (const c of contextoRef.current) {
      try { L.geoJSON(c.geom, { style: ESTILO_CONTEXTO[c.tipo], pmIgnore: true } as L.GeoJSONOptions).addTo(map) }
      catch { /* geometría de contexto inválida: se omite */ }
    }

    let capas: L.Polygon[] = []
    try {
      const grupo = L.geoJSON(geom, {
        style: { color: COLOR_SELECCION, weight: 3, fillColor: COLOR_SELECCION, fillOpacity: 0.2 },
      }).addTo(map)
      capas = grupo.getLayers().filter((l): l is L.Polygon => l instanceof L.Polygon)
      const b = grupo.getBounds()
      if (b.isValid()) map.fitBounds(b, { padding: [40, 40], maxZoom: 18 })
    } catch {
      map.setView([1.6, -75.6], 8)
    }

    const avisar = () => {
      const g = geometriaDe(capas)
      if (g) onCambioRef.current(g)
    }
    for (const capa of capas) {
      // snappable:false — geoman imanta por defecto el vértice arrastrado a la
      // capa más cercana, y aquí las más cercanas son justo la sombra del
      // "antes" y las otras zonas: el vértice se iría pegando solo.
      capa.pm.enable({ allowSelfIntersection: false, removeVertexOn: 'click', snappable: false })
      capa.on('pm:edit', avisar)
    }

    return () => { map.remove() }
  }, [geom])

  return <div ref={elRef} className={className ?? 'w-full h-96 rounded-xl overflow-hidden border border-stone-200 z-0'} />
}
