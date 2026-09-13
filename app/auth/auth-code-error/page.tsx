'use client'
import { ShieldX } from 'lucide-react'
import { Boton, Firma, Rotulo } from '@/app/components/marca'

/** Cuenta de Microsoft que no pertenece a la organización. Sobre tinta, como la portada. */
export default function ErrorPage() {
  return (
    <div className="flex min-h-screen flex-col bg-tinta text-hueso">
      <div className="px-8 pt-8 sm:px-12">
        <Firma />
      </div>

      <div className="flex flex-1 items-center px-8 sm:px-12">
        <div className="max-w-lg py-16">
          <ShieldX size={34} strokeWidth={1.5} className="mb-6 text-ambar" />
          <Rotulo tono="taupe" className="mb-3">Intranet</Rotulo>
          <h1 className="mb-4 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
            Acceso restringido
          </h1>
          <p className="mb-9 text-sm font-light leading-relaxed text-hueso/80">
            Tu cuenta de Microsoft no pertenece a la organización{' '}
            <strong className="font-medium text-white">Amazonia Emprende</strong> o no tiene los permisos
            necesarios para acceder a esta Intranet.
          </p>
          <Boton href="/" variante="claro">Volver al inicio</Boton>
        </div>
      </div>
    </div>
  )
}
