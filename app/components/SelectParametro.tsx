'use client'
import { useState } from 'react'
import { Plus, Loader2, X } from 'lucide-react'
import { crearParametro, type ListaParametro, type Parametro } from '@/lib/parametros'

const INPUT = 'w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors bg-white'

/**
 * Desplegable de un catálogo parametrizable (tipo de proyecto, fuente de
 * información) con un «+ Agregar» que crea la opción sin salir del formulario.
 *
 * El botón existe porque estas listas crecen en campo, no en una reunión de
 * arquitectura: aparece un convenio nuevo o un aliado que trae su base de
 * predios y hay que poder registrarlo en el momento. La opción creada se guarda
 * en el catálogo compartido — la ve todo el mundo, no solo este formulario — y
 * queda seleccionada de una vez.
 *
 * `value` es el CÓDIGO (slug), no el id: es lo que se guarda en core.predios.
 */
export default function SelectParametro({
  label, hint, lista, opciones, value, onChange, onNueva, email, disabled,
}: {
  label:     string
  hint?:     string
  lista:     ListaParametro
  opciones:  Parametro[]
  value:     string
  onChange:  (codigo: string) => void
  /** El padre agrega la opción recién creada a su lista para que se vea al instante. */
  onNueva:   (p: Parametro) => void
  email:     string | null
  disabled?: boolean
}) {
  const [agregando, setAgregando] = useState(false)
  const [nombre, setNombre]       = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Una opción retirada (activo=false) no se ofrece, pero si el predio ya la
  // tenía debe seguir visible: si no, al guardar se le borraría el dato en
  // silencio a alguien que solo entró a corregir el nombre del predio.
  const visibles = opciones.filter((o) => o.activo || o.codigo === value)

  async function guardar() {
    const limpio = nombre.trim()
    if (!limpio || !email) return
    setGuardando(true); setError(null)
    const res = await crearParametro(lista, limpio, email)
    setGuardando(false)
    if (!res.ok) { setError(res.error); return }
    onNueva(res.parametro)
    onChange(res.parametro.codigo)
    setNombre('')
    setAgregando(false)
  }

  return (
    <div>
      <label className="block text-xs font-bold text-stone-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${INPUT} ${disabled ? 'bg-stone-50 text-stone-400 cursor-not-allowed' : ''}`}
      >
        <option value="">— Sin definir —</option>
        {visibles.map((o) => (
          <option key={o.codigo} value={o.codigo}>{o.nombre}</option>
        ))}
      </select>

      {agregando ? (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              // Enter dentro de un formulario largo lo enviaría entero; aquí solo
              // debe crear la opción.
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); guardar() }
                if (e.key === 'Escape') { setAgregando(false); setError(null) }
              }}
              placeholder="Nombre de la nueva opción…"
              className={INPUT}
            />
            <button type="button" onClick={guardar} disabled={guardando || !nombre.trim()}
              className="shrink-0 px-3 py-2.5 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-1">
              {guardando && <Loader2 size={12} className="animate-spin" />} Guardar
            </button>
            <button type="button" onClick={() => { setAgregando(false); setError(null) }}
              className="shrink-0 text-stone-400 hover:text-red-500"><X size={16} /></button>
          </div>
          <p className="text-[11px] text-stone-400">
            Queda disponible para todos los predios, no solo para este.
          </p>
          {error && <p className="text-[11px] text-red-500">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between mt-1 gap-3">
          {hint ? <p className="text-[11px] text-stone-400">{hint}</p> : <span />}
          {!disabled && (
            <button type="button" onClick={() => setAgregando(true)}
              className="shrink-0 flex items-center gap-0.5 text-xs font-bold text-teal-600 hover:underline">
              <Plus size={12} /> Agregar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
