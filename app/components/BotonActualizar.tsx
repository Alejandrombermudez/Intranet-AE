'use client'
import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

/** Versión (commit) con la que se construyó esta copia de la página. 'local' en desarrollo. */
const MI_VERSION = process.env.NEXT_PUBLIC_VERSION ?? 'local'

/**
 * Botón pequeño para recibir la última versión cuando el navegador se queda con una vieja.
 *
 * La intranet es una PWA: un Service Worker guarda páginas y archivos, y en celulares con
 * poca señal sigue entregando la copia guardada aunque ya haya una versión nueva, por más
 * que se recargue. «Actualizar» borra ese Service Worker y su caché y recarga desde la red.
 * El Service Worker se vuelve a registrar solo al abrir la página, así que no se pierde nada.
 *
 * Si la versión publicada es distinta de la que se está viendo, el botón se resalta.
 */
export default function BotonActualizar() {
  const [hayNueva, setHayNueva] = useState(false)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    // Después de actualizar, la dirección trae ?v=… para saltarse la caché: se quita para que no quede fea.
    const url = new URL(window.location.href)
    if (url.searchParams.has('v')) {
      url.searchParams.delete('v')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }

    let vivo = true
    const revisar = async () => {
      if (MI_VERSION === 'local') return
      try {
        const r = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' })
        if (!r.ok) return
        const { version } = (await r.json()) as { version?: string }
        if (vivo && version && version !== 'local') setHayNueva(version !== MI_VERSION)
      } catch { /* sin señal: no hay nada que avisar */ }
    }
    revisar()
    const alVolver = () => { if (document.visibilityState === 'visible') revisar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { vivo = false; document.removeEventListener('visibilitychange', alVolver) }
  }, [])

  const actualizar = async () => {
    setTrabajando(true)
    try {
      const registros = await navigator.serviceWorker?.getRegistrations()
      await Promise.all((registros ?? []).map((r) => r.unregister()))
    } catch { /* sin Service Worker: sigue */ }
    try {
      const claves = await caches.keys()
      await Promise.all(claves.map((k) => caches.delete(k)))
    } catch { /* sin Cache API: sigue */ }
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(Date.now()))
    window.location.replace(url.toString())
  }

  return (
    <button
      type="button"
      onClick={actualizar}
      disabled={trabajando}
      title="Si ves una versión vieja de la página, toca aquí para cargar la más reciente"
      className={`fixed bottom-3 right-3 z-40 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-sm transition-colors print:hidden ${
        hayNueva
          ? 'border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-200'
          : 'border-stone-300 bg-white text-stone-500 hover:text-stone-800'
      }`}
    >
      {trabajando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
      {trabajando ? 'Actualizando…' : hayNueva ? 'Hay una versión nueva · Actualizar' : 'Actualizar'}
    </button>
  )
}
