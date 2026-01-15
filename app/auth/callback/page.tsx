'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    // Esta función captura el "hash" (#access_token=...) que te manda Microsoft
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        // ¡Éxito! Tenemos sesión. Vamos al dashboard.
        router.push('/dashboard')
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
        <h2 className="text-xl">Validando credenciales...</h2>
        <p className="text-slate-400 text-sm mt-2">Estamos confirmando tu acceso con Microsoft</p>
      </div>
    </div>
  )
}