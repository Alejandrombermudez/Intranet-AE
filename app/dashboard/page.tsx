'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * /dashboard fue fusionado en /calendar.
 * Este redirect asegura compatibilidad con bookmarks o enlaces antiguos.
 */
export default function DashboardRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/calendar')
  }, [router])
  return null
}
