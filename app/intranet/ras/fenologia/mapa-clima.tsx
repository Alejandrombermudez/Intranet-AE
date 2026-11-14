'use client'

/**
 * Mapa del clima por árbol: cada árbol es un punto con el color del valor de
 * su celda de Open-Meteo, y el centro de cada celda lleva su cifra. El color y
 * el texto los calcula la vista; aquí solo se dibuja. Se importa con
 * next/dynamic (sin SSR) porque Leaflet necesita `window`.
 */

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type PuntoMapa = { id: string; lat: number; lon: number; color: string; aproximado: boolean; texto: string }
export type CeldaMapa = { id: string; lat: number; lon: number; etiqueta: string; detalle: string }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

export default function MapaClima({ puntos, celdas }: { puntos: PuntoMapa[]; celdas: CeldaMapa[] }) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const capaRef = useRef<L.LayerGroup | null>(null)
  const encuadre = useRef(false)

  useEffect(() => {
    if (!elRef.current || mapRef.current) return
    const map = L.map(elRef.current, { scrollWheelZoom: false }).setView([0.69, -75.13], 11)
    // Fondo claro de entrada: sobre el satelital no se distingue la escala de color.
    // (CARTO pide clave desde 2026: Esri gris claro no.)
    const claro = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Mapa © Esri · Clima: Open-Meteo (CC BY 4.0)', maxZoom: 16,
    }).addTo(map)
    const satelital = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Imágenes © Esri · Clima: Open-Meteo (CC BY 4.0)', maxZoom: 18,
    })
    L.control.layers({ 'Mapa claro': claro, 'Satelital': satelital }, undefined, { position: 'topright' }).addTo(map)
    capaRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; encuadre.current = false }
  }, [])

  useEffect(() => {
    const map = mapRef.current, capa = capaRef.current
    if (!map || !capa) return
    capa.clearLayers()
    for (const c of celdas) {
      L.marker([c.lat, c.lon], {
        icon: L.divIcon({
          className: '',
          iconSize: [0, 0],
          html: `<div style="transform:translate(-50%,-50%);width:max-content;white-space:nowrap;background:rgba(255,255,255,.92);border:1px solid #2b2b28;border-radius:6px;padding:2px 6px;font:600 11px Poppins,Arial,sans-serif;color:#2b2b28;box-shadow:0 1px 3px rgba(0,0,0,.3)">${esc(c.etiqueta)}</div>`,
        }),
        zIndexOffset: 1000,
      }).bindTooltip(esc(c.detalle), { direction: 'top' }).addTo(capa)
    }
    for (const p of puntos) {
      L.circleMarker([p.lat, p.lon], {
        radius: 7, color: p.aproximado ? '#a0522d' : '#1d1d1b', weight: p.aproximado ? 2 : 1,
        dashArray: p.aproximado ? '2 2' : undefined, fillColor: p.color, fillOpacity: 0.95,
      }).bindTooltip(p.texto, { direction: 'top' }).addTo(capa)
    }
    if (!encuadre.current && puntos.length) {
      // Sin animación: si se cambia de pestaña a mitad del zoom, Leaflet
      // termina la transición sobre un mapa ya desmontado y lanza un error.
      map.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lon] as [number, number])).pad(0.15), { animate: false })
      encuadre.current = true
    }
  }, [puntos, celdas])

  return <div ref={elRef} className="h-[460px] w-full overflow-hidden rounded-2xl" />
}
