/**
 * CALENDARIOS FENOLÓGICOS — versión pública y sencilla de /intranet/ras/fenologia.
 *
 * Para compartir por enlace (como /entregables/guias-propagacion): no pide sesión
 * ni enlaza la intranet. Solo muestra resúmenes por especie y el clima promedio
 * (lib/fenologia-publica.ts); nada de predios, coordenadas, monitores ni fotos.
 */
import type { Metadata } from 'next'
import { fenologiaPublica, type FenologiaPublica } from '@/lib/fenologia-publica'
import Fenologia from './fenologia'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Calendarios fenológicos — Amazonía Emprende',
  description: 'Cuándo florece y cuándo da fruto cada especie de la Red de Árboles Semilleros de Amazonía Emprende.',
  robots: { index: false, follow: false },
}

export default async function Pagina() {
  let datos: FenologiaPublica | null = null
  try { datos = await fenologiaPublica() } catch { /* se muestra el aviso */ }
  return <Fenologia datos={datos} />
}
