'use client'
import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { opcionesVereda, normalizarVereda, type MunicipioCaqueta } from '@/lib/veredas-caqueta'

const INPUT = 'w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors bg-white'

/** Las veredas que ya usan los predios: una sola consulta por página, la comparten los selectores. */
let enUsoPendiente: Promise<Record<string, string[]>> | null = null
function veredasEnUso(): Promise<Record<string, string[]>> {
  enUsoPendiente ??= fetchConSesion('/api/juridica/veredas')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .catch(() => { enUsoPendiente = null; return {} })   // sin ellas queda la lista oficial; se reintenta al volver
  return enUsoPendiente
}

/**
 * Selector de vereda del predio, con «+ Agregar» para la que no esté en la lista.
 *
 * La lista es la del municipio (`VEREDAS_POR_MUNICIPIO`) más las que ya usan los
 * predios: una vereda agregada aquí se guarda con el predio y desde ese momento
 * le aparece a todo el mundo, sin tabla aparte. Lo que se escribe pasa por
 * `normalizarVereda`, así que «bocana aguacaliente» cae en la que ya existe en
 * vez de abrir otra; el servidor vuelve a normalizar al guardar.
 */
export default function SelectVereda({ municipio, value, onChange }: {
  municipio: MunicipioCaqueta | ''
  value:     string
  onChange:  (vereda: string) => void
}) {
  const [enUso, setEnUso]           = useState<Record<string, string[]>>({})
  const [agregadas, setAgregadas]   = useState<string[]>([])
  const [agregando, setAgregando]   = useState(false)
  const [nombre, setNombre]         = useState('')

  useEffect(() => {
    let vigente = true
    veredasEnUso().then((d) => { if (vigente) setEnUso(d) })
    return () => { vigente = false }
  }, [])

  const opciones = municipio ? opcionesVereda(municipio, [...(enUso[municipio] ?? []), ...agregadas]) : []
  // La vereda que ya tiene el predio se ofrece siempre, esté o no en la lista: si
  // no, el select la muestra vacía y al guardar se borra (pasaba con Guayabal, 16
  // predios, hasta el 2026-10-21).
  const visibles = value && !opciones.includes(value) ? [value, ...opciones] : opciones

  function agregar() {
    const v = normalizarVereda(municipio, nombre)
    if (!v) return
    setAgregadas((a) => (a.includes(v) ? a : [...a, v]))
    onChange(v)
    setNombre('')
    setAgregando(false)
  }

  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!municipio}
        className={`${INPUT} ${!municipio ? 'bg-stone-50 text-stone-400 cursor-not-allowed' : ''}`}
      >
        <option value="">— Seleccione vereda —</option>
        {visibles.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>

      {agregando ? (
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              // Enter dentro del formulario lo enviaría entero; aquí solo agrega la vereda.
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); agregar() }
                if (e.key === 'Escape') setAgregando(false)
              }}
              placeholder={`Vereda de ${municipio}…`}
              className={INPUT}
            />
            <button type="button" onClick={agregar} disabled={!nombre.trim()}
              className="shrink-0 px-3 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition-colors disabled:opacity-50">
              Usar
            </button>
            <button type="button" onClick={() => setAgregando(false)} aria-label="Cancelar"
              className="shrink-0 text-stone-400 hover:text-red-500"><X size={16} /></button>
          </div>
          <p className="text-[11px] text-stone-400">
            Queda en la lista de {municipio} para todos cuando guardes el predio.
          </p>
        </div>
      ) : municipio && (
        <div className="flex justify-end mt-1">
          <button type="button" onClick={() => setAgregando(true)}
            className="flex items-center gap-0.5 text-xs font-bold text-teal-600 hover:underline">
            <Plus size={12} /> Agregar vereda
          </button>
        </div>
      )}
    </div>
  )
}
