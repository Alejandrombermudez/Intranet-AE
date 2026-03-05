'use client'
import { useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'

interface DeviceInfo {
  isMobile: boolean
  isIOS: boolean
  isStandalone: boolean
}

const emptySubscribe = () => () => {}

function getDeviceSnapshot(): DeviceInfo {
  const userAgent = window.navigator.userAgent.toLowerCase()
  return {
    isMobile: /iphone|ipad|ipod|android/i.test(userAgent),
    isIOS: /iphone|ipad|ipod/.test(userAgent),
    isStandalone: window.matchMedia('(display-mode: standalone)').matches || !!(window.navigator as never as { standalone?: boolean }).standalone,
  }
}

const SERVER_SNAPSHOT: DeviceInfo = { isMobile: false, isIOS: false, isStandalone: false }
function getServerSnapshot(): DeviceInfo {
  return SERVER_SNAPSHOT
}

let cachedSnapshot: DeviceInfo | null = null
function getCachedSnapshot(): DeviceInfo {
  if (!cachedSnapshot) cachedSnapshot = getDeviceSnapshot()
  return cachedSnapshot
}

export default function InstallPrompt() {
  const deviceInfo = useSyncExternalStore(emptySubscribe, getCachedSnapshot, getServerSnapshot)
  const [isVisible, setIsVisible] = useState(true)

  if (!deviceInfo.isMobile || deviceInfo.isStandalone || !isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-stone-900 text-white p-4 shadow-2xl z-50 border-t-4 border-primary animate-slide-up">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg text-primary-light">Instala la App</h3>
          <button onClick={() => setIsVisible(false)} className="text-stone-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-stone-300 mb-4">
          Para una experiencia completa e inmersiva, agrega esta web a tu inicio.
        </p>

        <div className="bg-stone-800 p-3 rounded-lg border border-stone-700">
          {deviceInfo.isIOS ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold shrink-0">1</span>
              <p>Toca el boton <strong>Compartir</strong> <span className="inline-block bg-stone-700 px-1.5 py-0.5 rounded text-xs">&#x23CB;</span> abajo.</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm">
              <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold shrink-0">1</span>
              <p>Toca los <strong>3 puntos</strong> arriba a la derecha.</p>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm mt-2">
            <span className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold shrink-0">2</span>
            <p>Selecciona <span className="font-bold text-white">&quot;Agregar a inicio&quot;</span> o &quot;Instalar&quot;.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
