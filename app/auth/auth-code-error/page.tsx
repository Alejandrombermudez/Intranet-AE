'use client'
import Link from 'next/link'

export default function ErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-red-100 max-w-md">
        <div className="text-5xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Acceso Restringido</h1>
        <p className="text-slate-600 mb-6">
          Tu cuenta de Microsoft no pertenece a la organización <strong>Amazonia Emprende</strong> o no tiene los permisos necesarios para acceder a esta Intranet.
        </p>
        
        <Link 
          href="/"
          className="inline-block bg-slate-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-black transition-all"
        >
          Volver al Inicio
        </Link>
      </div>
    </div>
  )
}