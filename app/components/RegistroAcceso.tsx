'use client'
import { useEffect } from 'react'
import { registrarAcceso } from '@/lib/registro-acceso'

/**
 * Montado una vez en el layout raíz: registra el acceso al abrir cualquier
 * página con sesión y al volver a una pestaña que quedó abierta (una intranet
 * abierta desde el lunes cuenta como acceso el jueves, cuando se vuelve a mirar).
 * El límite de una vez cada 30 minutos lo pone `registrarAcceso`. No pinta nada.
 */
export default function RegistroAcceso() {
  useEffect(() => {
    registrarAcceso()
    const alVolver = () => {
      if (document.visibilityState === 'visible') registrarAcceso()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [])
  return null
}
