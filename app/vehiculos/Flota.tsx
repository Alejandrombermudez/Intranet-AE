'use client'
import { useState } from 'react'
import { diasHasta, type Vehiculo } from '@/lib/vehiculos/cliente'
import { fechaCorta } from '@/lib/vehiculos/horas'

function Vence({ etiqueta, fecha }: { etiqueta: string; fecha: string | null }) {
  const d = diasHasta(fecha)
  const estado = d === null ? <span className="tenue">Sin fecha</span>
    : d < 0 ? <span className="etiqueta roja">Vencido</span>
    : d <= 30 ? <span className="etiqueta ambar">Vence {fechaCorta(fecha!)}</span>
    : <span className="tenue">Vence {fechaCorta(fecha!)}</span>
  return <div className="vence"><span>{etiqueta}</span>{estado}</div>
}

/**
 * Los vehículos con su foto, sus vencimientos y la tarjeta de propiedad en pantalla
 * completa: si en la vía la piden, se muestra desde aquí (la tarjeta física no circula).
 */
export default function Flota({ vehiculos }: { vehiculos: Vehiculo[] }) {
  const [ver, setVer] = useState<Vehiculo | null>(null)
  return (
    <div>
      <div className="vehiculos">
        {vehiculos.map((v) => (
          <div key={v.id} className="vehiculo">
            <div className="foto">
              {v.foto
                // eslint-disable-next-line @next/next/no-img-element -- enlace firmado del bucket privado
                ? <img src={v.foto} alt={v.nombre} />
                : 'Sin foto'}
            </div>
            <div className="cuerpo">
              <h3><i style={{ background: v.color }} />{v.nombre}</h3>
              {v.placa && <p className="tenue">Placa {v.placa}</p>}
              <Vence etiqueta="SOAT" fecha={v.soat_vence} />
              <Vence etiqueta="Tecnomecánica" fecha={v.tecnomecanica_vence} />
              <button className="btn" disabled={!v.tarjeta} onClick={() => setVer(v)}>
                {v.tarjeta ? 'Ver tarjeta de propiedad' : 'Tarjeta sin cargar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {ver?.tarjeta && (
        <div className="visor" onClick={() => setVer(null)}>
          <p>Tarjeta de propiedad · {ver.nombre}{ver.placa ? ` · ${ver.placa}` : ''}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- enlace firmado del bucket privado */}
          <img src={ver.tarjeta} alt={`Tarjeta de propiedad de ${ver.nombre}`} />
          <button className="btn blanco" onClick={() => setVer(null)}>Cerrar</button>
        </div>
      )}
    </div>
  )
}
