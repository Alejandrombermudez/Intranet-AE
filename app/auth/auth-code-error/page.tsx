'use client'
import Link from 'next/link'
import { ShieldX } from 'lucide-react'

export default function ErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 p-4 text-center">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-red-100 max-w-md">
        <ShieldX size={48} className="text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-stone-800 mb-2">Acceso Restringido</h1>
        <p className="text-stone-600 mb-6">
          Tu cuenta de Microsoft no pertenece a la organizacion <strong>Amazonia Emprende</strong> o no tiene los permisos necesarios para acceder a esta Intranet.
        </p>

        <Link
          href="/"
          className="inline-block bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-dark transition-all"
        >
          Volver al Inicio
        </Link>
      </div>
    </div>
  )
}
