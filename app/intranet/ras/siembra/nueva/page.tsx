'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Shield, ArrowLeft, Loader2, Lock } from 'lucide-react'

// La creación de familias en Siembra ya no se realiza desde este formulario.
// Ahora el flujo es: Módulo Jurídico (HOJA 1 → 2 → 3, semáforo verde) →
// botón "Crear en Siembra" → la familia se prelena y el RAS completa la encuesta.

export default function NuevaFamiliaRedireccionada() {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department')
        .eq('email', user.email)
        .single()
      if (!profile?.is_admin && profile?.department !== 'RAS') {
        router.push('/'); return
      }
      setIsAdmin(profile?.is_admin ?? false)
      setAuthReady(true)
    })
  }, [router])

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="animate-spin text-stone-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Lock size={28} className="text-teal-500" />
        </div>
        <h1 className="text-2xl font-black text-stone-900 mb-3">
          Creación desde Jurídica
        </h1>
        <p className="text-stone-500 text-sm leading-relaxed mb-6">
          A partir de ahora, las familias en Siembra se crean automáticamente desde el{' '}
          <strong>Módulo Jurídico</strong> cuando el aliado completa el proceso de debida
          diligencia con semáforo <strong>verde o amarillo</strong>.
        </p>
        <div className="bg-white border border-stone-100 rounded-2xl p-5 mb-6 text-left space-y-3">
          <p className="text-xs font-bold text-stone-500 uppercase tracking-wider">Flujo actual</p>
          {[
            { paso: '1', texto: 'Abogada captura datos del aliado (HOJA 1)' },
            { paso: '2', texto: 'Revisión de antecedentes y listas (HOJA 2)' },
            { paso: '3', texto: 'Análisis jurídico del folio (HOJA 3)' },
            { paso: '✓', texto: 'Semáforo verde → familia creada en Siembra' },
          ].map(({ paso, texto }) => (
            <div key={paso} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-teal-50 text-teal-600 text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                {paso}
              </div>
              <p className="text-sm text-stone-600">{texto}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Link href="/intranet/ras/siembra"
            className="flex-1 flex items-center justify-center gap-2 py-3 border border-stone-200 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors">
            <ArrowLeft size={16} /> Volver a Siembra
          </Link>
          {isAdmin && (
            <Link href="/intranet/juridica"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors">
              <Shield size={16} /> Ir a Jurídica
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
