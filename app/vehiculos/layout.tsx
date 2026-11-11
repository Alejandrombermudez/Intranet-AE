import type { Metadata } from 'next'
import './vehiculos.css'

/**
 * /vehiculos vive en la intranet (mismo despliegue) pero no se parece a ella ni la
 * enlaza: la usan también personas sin correo corporativo, y ver la intranet las
 * confundiría. Su propio título y su propio manifiesto, para que al instalarla en el
 * celular abra directo aquí.
 */
export const metadata: Metadata = {
  title: 'Vehículos — Amazonía Emprende',
  description: 'Reserva, recepción y devolución de los vehículos de Amazonía Emprende.',
  manifest: '/vehiculos.webmanifest',
  icons: { icon: '/vehiculos/icon-192.png', apple: '/vehiculos/icon-180.png' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Vehículos AE' },
}

export default function VehiculosLayout({ children }: { children: React.ReactNode }) {
  return <div className="vh">{children}</div>
}
