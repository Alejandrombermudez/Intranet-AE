import type { Metadata } from 'next'

/**
 * /cuenta-cobro vive en la intranet (mismo despliegue) pero es pública: la usan
 * operarios y contratistas sin correo corporativo, con el enlace que comparte
 * talento humano. No muestra ni enlaza nada de la intranet.
 */
export const metadata: Metadata = {
  title: 'Cuenta de cobro — Amazonía Emprende',
  description: 'Diligencie su cuenta de cobro, fírmela con el dedo y envíela a talento humano.',
  robots: { index: false, follow: false },
}

export default function CuentaCobroLayout({ children }: { children: React.ReactNode }) {
  return children
}
