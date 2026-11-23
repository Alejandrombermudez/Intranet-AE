'use client'
import { usePathname } from 'next/navigation'
import InstallPrompt from './InstallPrompt'
import RegistroAcceso from './RegistroAcceso'
import BotonActualizar from './BotonActualizar'

/**
 * Lo que la intranet pone en todas sus páginas: el aviso de instalarla, el botón «Actualizar»
 * (borra TODOS los service workers, también el de vehículos) y el registro de acceso.
 * En /vehiculos no va nada de eso: es una app aparte que no debe llevar a la intranet ni
 * parecerse a ella, aunque viva en el mismo despliegue.
 */
export default function ExtrasIntranet() {
  const ruta = usePathname() ?? ''
  if (/^\/vehiculos(\/|$)/.test(ruta)) return null
  return (
    <>
      <InstallPrompt />
      <BotonActualizar />
      <RegistroAcceso />
    </>
  )
}
