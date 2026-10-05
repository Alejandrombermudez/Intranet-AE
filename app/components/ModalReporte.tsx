'use client'
import { useEffect } from 'react'
import { FileText, Files, X } from 'lucide-react'
import type { ModoReporte } from '@/lib/reporte-juridico'

/**
 * Pregunta qué reporte jurídico se quiere, justo después de pulsar el botón:
 *  - completo: dictamen de viabilidad + todos los documentos adjuntos.
 *  - adjuntos: solo lo que subieron, sin el dictamen.
 * `cantidad` > 1 cuando viene de la selección del listado (sale un .zip).
 */
export default function ModalReporte({ cantidad, onElegir, onCerrar }: {
  cantidad: number
  onElegir: (modo: ModoReporte) => void
  onCerrar: () => void
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar])

  const opciones: { modo: ModoReporte; titulo: string; texto: string; icono: React.ReactNode }[] = [
    {
      modo: 'completo', titulo: 'Reporte completo', icono: <FileText size={20} />,
      texto: 'El dictamen de viabilidad (datos, análisis del folio y antecedentes) con un índice, y detrás todos los documentos adjuntos en un solo PDF.',
    },
    {
      modo: 'adjuntos', titulo: 'Solo lo que subieron', icono: <Files size={20} />,
      texto: 'Únicamente los documentos adjuntos, unidos en un PDF, sin el dictamen.',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-tinta/50 px-4" onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label="Reporte jurídico"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-linea bg-papel p-6 shadow-xl">
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-tinta">¿Qué reporte quieres descargar?</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-tenue hover:text-tinta">
            <X size={18} />
          </button>
        </div>
        <p className="mb-5 text-[12.5px] font-light text-suave">
          {cantidad === 1
            ? 'Se descarga un PDF de este predio.'
            : `Son ${cantidad} predios: se descarga un .zip con un PDF por predio.`}
        </p>
        <div className="space-y-3">
          {opciones.map((o) => (
            <button key={o.modo} type="button" onClick={() => onElegir(o.modo)}
              className="flex w-full items-start gap-3 border border-taupe bg-white px-4 py-3 text-left transition-colors hover:border-bosque hover:bg-hueso/40">
              <span className="mt-0.5 text-bosque">{o.icono}</span>
              <span>
                <span className="block text-[13px] font-medium text-tinta">{o.titulo}</span>
                <span className="mt-0.5 block text-[12px] font-light leading-relaxed text-suave">{o.texto}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
