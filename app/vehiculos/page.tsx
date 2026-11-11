import { Suspense } from 'react'
import App from './App'

// ?qr=<vehículo> llega del QR pegado en cada vehículo (ver App y /api/vehiculos/tomar).
export default function VehiculosPage() {
  return (
    <Suspense fallback={<p className="cargando">Cargando…</p>}>
      <App />
    </Suspense>
  )
}
