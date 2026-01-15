'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/') 
      } else {
        setUser(user)
      }
    }
    getUser()
  }, [router])

  if (!user) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-900">
      <div className="animate-pulse font-semibold">Cargando perfil...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg border border-slate-300 p-8">
        
        {/* Encabezado: Cambiado a negro puro (text-black) */}
        <h1 className="text-3xl font-extrabold text-black mb-2">
          ¡Bienvenido, {user.user_metadata.full_name}!
        </h1>
        <p className="text-slate-600 mb-8 text-lg border-b pb-4 border-slate-200">
          Has ingresado correctamente a la Intranet de Amazonia Emprende.
        </p>
        
        {/* Caja de detalles */}
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 space-y-6">
          
          {/* ID */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Tu ID de Usuario (Supabase)
            </p>
            {/* ID: Cambiado a negro puro (text-black) */}
            <code className="block bg-slate-200 text-black p-3 rounded border border-slate-300 font-mono text-sm break-all font-bold">
              {user.id}
            </code>
          </div>
          
          {/* Correo */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Correo Corporativo
            </p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {/* Email: Cambiado a negro puro (text-black) */}
              <p className="text-black font-bold text-xl">
                {user.email}
              </p>
            </div>
          </div>

        </div>

        {/* Botón de Cerrar Sesión */}
        <div className="mt-8">
          <button 
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/')
            }}
            className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 font-semibold transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>

      </div>
    </div>
  )
}