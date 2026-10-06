'use client'
import { useEffect, useState } from 'react'
import { FileSpreadsheet, Loader2, X } from 'lucide-react'
import { Aviso, Boton } from '@/app/components/marca'
import { exportarFormatos, type AvisoPredio, type FormatoCorpo } from '@/lib/formatos-corpoamazonia-descarga'

export interface PredioElegible { id: string; nombre: string; municipio: string | null; arboles: number | null }

const FORMATOS: { id: FormatoCorpo; titulo: string; texto: string }[] = [
  { id: 'ambos', titulo: 'Los dos formatos', texto: 'El F-LAR-071 y el F-LAR-072 de cada predio, con los árboles numerados igual en ambos.' },
  { id: '071', titulo: 'F-LAR-071 · Coordenadas', texto: 'Vértices del predio y del área en conservación, y un punto por árbol, en grados, minutos y segundos.' },
  { id: '072', titulo: 'F-LAR-072 · Censo', texto: 'Datos del predio, registro de individuos y resumen por especie.' },
]

/**
 * Exportar los formatos de Corpoamazonia: pregunta cuál formato y de qué
 * predios, y al terminar dice, predio por predio, qué quedó sin llenar.
 */
export default function ModalFormatosRas({ predios, onCerrar }: { predios: PredioElegible[]; onCerrar: () => void }) {
  const [formato, setFormato] = useState<FormatoCorpo>('ambos')
  const [soloProtocolo, setSoloProtocolo] = useState(true)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [progreso, setProgreso] = useState<string | null>(null)
  const [informe, setInforme] = useState<AvisoPredio[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape' && !progreso) onCerrar() }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onCerrar, progreso])

  const todos = predios.length > 0 && marcados.size === predios.length
  function alternar(id: string) {
    setMarcados((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  async function exportar() {
    // En el orden de la lista, no en el que se fueron marcando.
    const ids = predios.filter((p) => marcados.has(p.id)).map((p) => p.id)
    if (ids.length === 0) return
    setError(null); setProgreso('Preparando…')
    try {
      setInforme(await exportarFormatos(ids, formato, soloProtocolo, setProgreso))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron armar los formatos.')
    } finally {
      setProgreso(null)
    }
  }

  const archivos = marcados.size * (formato === 'ambos' ? 2 : 1)

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-tinta/50 px-4 py-6" onClick={() => { if (!progreso) onCerrar() }}>
      <div role="dialog" aria-modal="true" aria-label="Exportar formatos de Corpoamazonia"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-xl flex-col border border-linea bg-papel shadow-xl">
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-tinta">Exportar formatos de Corpoamazonia</h2>
            <p className="mt-1 text-[12.5px] font-light text-suave">
              Se llenan con lo que ya está guardado. Lo que falta queda en blanco y al final se lista.
            </p>
          </div>
          <button type="button" onClick={onCerrar} disabled={!!progreso} aria-label="Cerrar" className="text-tenue hover:text-tinta disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        {informe ? (
          <div className="overflow-y-auto px-6 py-5">
            <p className="mb-4 text-[13px] font-medium text-tinta">
              Descarga lista. Esto es lo que quedó pendiente en cada predio:
            </p>
            <div className="space-y-4">
              {informe.map((p) => (
                <div key={p.predio}>
                  <p className="text-[12.5px] font-medium text-tinta">{p.predio}</p>
                  {p.avisos.length === 0
                    ? <p className="text-[12px] font-light text-suave">Sin observaciones.</p>
                    : <ul className="mt-1 list-disc space-y-1 pl-5 text-[12px] font-light leading-relaxed text-suave">
                        {p.avisos.map((a) => <li key={a}>{a}</li>)}
                      </ul>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto px-6 py-5">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[.14em] text-tenue">Formato</p>
            <div className="space-y-2">
              {FORMATOS.map((f) => (
                <label key={f.id} className={`flex cursor-pointer items-start gap-3 border bg-white px-4 py-3 transition-colors ${formato === f.id ? 'border-bosque' : 'border-taupe hover:border-bosque'}`}>
                  <input type="radio" name="formato" checked={formato === f.id} onChange={() => setFormato(f.id)} className="mt-1 accent-bosque" />
                  <span>
                    <span className="block text-[13px] font-medium text-tinta">{f.titulo}</span>
                    <span className="mt-0.5 block text-[12px] font-light leading-relaxed text-suave">{f.texto}</span>
                  </span>
                </label>
              ))}
            </div>

            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={soloProtocolo} onChange={(e) => setSoloProtocolo(e.target.checked)} className="mt-0.5 h-4 w-4 accent-bosque" />
              <span className="text-[12.5px] text-tinta">
                Solo árboles de especies con protocolo
                <span className="block text-[12px] font-light text-suave">El F-LAR-072 es para esas especies. Desmárcalo para incluir todos los árboles del predio.</span>
              </span>
            </label>

            <div className="mb-2 mt-5 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[.14em] text-tenue">Predios</p>
              <button type="button" className="text-[12px] text-bosque hover:underline"
                onClick={() => setMarcados(todos ? new Set() : new Set(predios.map((p) => p.id)))}>
                {todos ? 'Quitar todos' : `Marcar los ${predios.length}`}
              </button>
            </div>
            <div className="max-h-56 divide-y divide-linea overflow-y-auto border border-taupe bg-white">
              {predios.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-3 px-4 py-2 hover:bg-hueso/40">
                  <input type="checkbox" checked={marcados.has(p.id)} onChange={() => alternar(p.id)} className="h-4 w-4 accent-bosque" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-tinta">{p.nombre}</span>
                  <span className="shrink-0 text-[11.5px] font-light text-suave">
                    {p.municipio ?? ''}{p.arboles !== null ? ` · ${p.arboles} árboles` : ''}
                  </span>
                </label>
              ))}
            </div>
            {error && <Aviso tono="arcilla" className="mt-4">{error}</Aviso>}
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-linea px-6 py-4">
          <p className="min-w-0 flex-1 truncate text-[12px] font-light text-suave">
            {progreso ?? (informe ? '' : marcados.size === 0 ? 'Marca al menos un predio.'
              : archivos === 1 ? 'Se descarga un archivo de Excel.' : `Se descarga un .zip con ${archivos} archivos de Excel.`)}
          </p>
          {informe
            ? <Boton onClick={onCerrar}>Cerrar</Boton>
            : <Boton onClick={exportar} disabled={!!progreso || marcados.size === 0}
                icono={progreso ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}>
                {progreso ? 'Armando…' : 'Exportar'}
              </Boton>}
        </div>
      </div>
    </div>
  )
}
