'use client'
import { useState } from 'react'
import { diasHasta, type Documento } from '@/lib/vehiculos/cliente'
import { fechaCorta } from '@/lib/vehiculos/horas'

export interface DocsVehiculo {
  nombre: string
  placa: string | null
  tarjeta: Documento | null
  soat: Documento | null
  tecno: Documento | null
  soat_vence: string | null
  tecnomecanica_vence: string | null
}

function Vence({ fecha }: { fecha: string | null }) {
  const d = diasHasta(fecha)
  if (d === null) return null
  if (d < 0) return <span className="etiqueta roja">Vencido el {fechaCorta(fecha!)}</span>
  if (d <= 30) return <span className="etiqueta ambar">Vence el {fechaCorta(fecha!)}</span>
  return <span className="tenue">Vigente hasta el {fechaCorta(fecha!)}</span>
}

/**
 * Los documentos del vehículo en una sola ventana, para mostrarlos en la vía desde el celular:
 * tarjeta de propiedad, SOAT y tecnomecánica (cada uno puede ser foto o PDF).
 */
export default function Documentos({ v, onCerrar }: { v: DocsVehiculo; onCerrar: () => void }) {
  const [imagen, setImagen] = useState<{ titulo: string; url: string } | null>(null)

  const abrir = (titulo: string, d: Documento | null) => {
    if (!d) return
    if (d.pdf) window.open(d.url, '_blank', 'noopener')
    else setImagen({ titulo, url: d.url })
  }

  const filas: { titulo: string; doc: Documento | null; vence?: string | null }[] = [
    { titulo: 'Tarjeta de propiedad', doc: v.tarjeta },
    { titulo: 'SOAT', doc: v.soat, vence: v.soat_vence },
    { titulo: 'Tecnomecánica', doc: v.tecno, vence: v.tecnomecanica_vence },
  ]

  return (
    <>
      <div className="velo" onClick={onCerrar}>
        <div className="ventana" onClick={(e) => e.stopPropagation()}>
          <h2>Documentos del vehículo</h2>
          <p className="tenue" style={{ marginTop: -8, marginBottom: 14 }}>{v.nombre}{v.placa ? ` · ${v.placa}` : ''}</p>
          <div className="docs">
            {filas.map((f) => (
              <div key={f.titulo} className="doc">
                <div>
                  <b>{f.titulo}</b>
                  {f.vence !== undefined && <div><Vence fecha={f.vence ?? null} /></div>}
                </div>
                {f.doc
                  ? <button className="btn chico" onClick={() => abrir(f.titulo, f.doc)}>Ver</button>
                  : <span className="tenue">Sin cargar</span>}
              </div>
            ))}
          </div>
          <div className="acciones"><button className="btn suave" onClick={onCerrar}>Cerrar</button></div>
        </div>
      </div>

      {imagen && (
        <div className="visor" style={{ zIndex: 90 }} onClick={() => setImagen(null)}>
          <p>{imagen.titulo} · {v.nombre}{v.placa ? ` · ${v.placa}` : ''}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- enlace firmado del bucket privado */}
          <img src={imagen.url} alt={imagen.titulo} />
          <button className="btn blanco" onClick={() => setImagen(null)}>Volver</button>
        </div>
      )}
    </>
  )
}
