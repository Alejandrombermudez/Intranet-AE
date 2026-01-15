'use client'
import { useEffect, useState } from 'react'

export default function InstallPrompt() {
  const [isMobile, setIsMobile] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // 1. Detectar si es un dispositivo móvil
    const userAgent = window.navigator.userAgent.toLowerCase()
    const mobile = /iphone|ipad|ipod|android/i.test(userAgent)
    setIsMobile(mobile)

    // 2. Detectar si es iOS (iPhone/iPad) para dar instrucciones específicas
    const ios = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(ios)

    // 3. Detectar si la App YA está abierta en modo "Standalone" (Instalada)
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    setIsStandalone(isStandaloneMode)
  }, [])

  // Lógica Maestra: 
  // Si NO es móvil (es PC) O Si YA está en modo App -> NO MOSTRAR NADA
  if (!isMobile || isStandalone || !isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 text-white p-4 shadow-2xl z-50 border-t-4 border-green-500 animate-slide-up">
      <div className="max-w-md mx-auto">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-bold text-lg text-green-400">⚡ Instala la App</h3>
          <button onClick={() => setIsVisible(false)} className="text-gray-400 hover:text-white">✕</button>
        </div>
        
        <p className="text-sm text-gray-300 mb-4">
          Para una experiencia completa y sin bordes, agrega esta web a tu inicio.
        </p>

        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700">
          {isIOS ? (
            // Instrucciones para iPhone
            <div className="flex items-center gap-3 text-sm">
              <span className="text-2xl">1️⃣</span>
              <p>Toca el botón <strong>Compartir</strong> <span className="inline-block bg-gray-700 px-1 rounded">⎋</span> abajo.</p>
            </div>
          ) : (
             // Instrucciones para Android
            <div className="flex items-center gap-3 text-sm">
              <span className="text-2xl">1️⃣</span>
              <p>Toca los <strong>3 puntos</strong> arriba a la derecha.</p>
            </div>
          )}
          
          <div className="flex items-center gap-3 text-sm mt-2">
            <span className="text-2xl">2️⃣</span>
            <p>Selecciona <span className="font-bold text-white">"Agregar a inicio"</span> o "Instalar".</p>
          </div>
        </div>
      </div>
    </div>
  )
}