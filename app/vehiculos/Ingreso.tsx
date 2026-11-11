'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { enviar, type Persona, type Yo } from '@/lib/vehiculos/cliente'

export const SIN_AUTO_MICROSOFT = 'vh:sin-auto-microsoft'

/**
 * Dos maneras de entrar: Microsoft (quien tiene correo corporativo) o usuario + PIN.
 * El PIN que da administración es de una sola vez: con él se entra y enseguida se
 * crea el propio. Después el dispositivo queda recordado y no vuelve a preguntar.
 */
export default function Ingreso({ personas, qr, onEntro }: { personas: Persona[]; qr: string | null; onEntro: (yo: Yo) => void }) {
  const [id, setId] = useState('')
  const [pin, setPin] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [nuevo2, setNuevo2] = useState('')
  const [debeCambiar, setDebeCambiar] = useState(false)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [yendoMs, setYendoMs] = useState(false)

  const solo4 = (v: string) => v.replace(/\D/g, '').slice(0, 4)
  const persona = personas.find((p) => p.id === id)

  const conMicrosoft = async () => {
    setYendoMs(true)
    try {
      sessionStorage.setItem('ae:siguiente', qr ? `/vehiculos?qr=${encodeURIComponent(qr)}` : '/vehiculos')
      localStorage.removeItem(SIN_AUTO_MICROSOFT)
    } catch { /* sin storage: vuelve al inicio de la intranet */ }
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email profile',
        queryParams: { prompt: 'select_account' },
      },
    })
    if (e) { setError(e.message); setYendoMs(false) }
  }

  const entrar = async () => {
    setError('')
    if (!persona) return setError('Elige tu nombre.')
    if (pin.length !== 4) return setError('El PIN son 4 números.')
    if (debeCambiar) {
      if (nuevo.length !== 4) return setError('Tu PIN nuevo son 4 números.')
      if (nuevo !== nuevo2) return setError('Los dos PIN nuevos no son iguales.')
    }
    setEnviando(true)
    try {
      const r = await enviar<{ yo?: Yo; debeCambiar?: boolean }>('/api/vehiculos/entrar', 'POST', {
        conductorId: persona.id, pin, ...(debeCambiar ? { nuevoPin: nuevo } : {}),
      })
      if (r.debeCambiar) { setDebeCambiar(true); setEnviando(false); return }
      if (r.yo) onEntro(r.yo)
    } catch (e) {
      setError((e as Error).message)
      if (!debeCambiar) setPin('')
      setEnviando(false)
    }
  }

  return (
    <div className="ingreso">
      <div>
        <h1>Vehículos</h1>
        <p className="lead">{qr ? 'Entra para registrar el vehículo que vas a tomar.' : 'Reserva, recibe y entrega los vehículos.'}</p>
      </div>

      <button className="btn grande ms" onClick={conMicrosoft} disabled={yendoMs}>
        <svg viewBox="0 0 23 23" aria-hidden="true">
          <path fill="#F25022" d="M1 1H10V10H1V1Z" /><path fill="#00A4EF" d="M1 12H10V21H1V12Z" />
          <path fill="#7FBA00" d="M12 1H21V10H12V1Z" /><path fill="#FFB900" d="M12 12H21V21H12V12Z" />
        </svg>
        {yendoMs ? 'Abriendo Microsoft…' : 'Entrar con Microsoft'}
      </button>

      <div className="separador">o con usuario y PIN</div>

      <div className="tarjeta">
        <label className="campo"><span>¿Quién eres?</span>
          <select value={id} onChange={(e) => { setId(e.target.value); setPin(''); setNuevo(''); setNuevo2(''); setDebeCambiar(false); setError('') }}>
            <option value="">Elige tu nombre…</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </label>

        {persona && !debeCambiar && (
          <label className="campo"><span>Tu PIN</span>
            <input className="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} placeholder="••••"
              onChange={(e) => setPin(solo4(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') entrar() }} />
          </label>
        )}

        {debeCambiar && (
          <>
            <div className="aviso info">Ese PIN era de una sola vez. Crea el tuyo: 4 números que vas a usar siempre que entres desde otro celular o computador.</div>
            <label className="campo"><span>Tu PIN nuevo</span>
              <input className="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={nuevo} placeholder="••••"
                onChange={(e) => setNuevo(solo4(e.target.value))} />
            </label>
            <label className="campo"><span>Repite el PIN nuevo</span>
              <input className="pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={nuevo2} placeholder="••••"
                onChange={(e) => setNuevo2(solo4(e.target.value))}
                onKeyDown={(e) => { if (e.key === 'Enter') entrar() }} />
            </label>
          </>
        )}

        {error && <div className="aviso error">{error}</div>}
        <button className="btn grande" onClick={entrar} disabled={enviando || !persona}>
          {enviando ? 'Entrando…' : debeCambiar ? 'Guardar mi PIN y entrar' : 'Entrar'}
        </button>
        {personas.length === 0 && <p className="tenue centro" style={{ marginTop: 10 }}>Todavía nadie tiene PIN asignado.</p>}
      </div>
      <p className="tenue centro">¿No apareces en la lista o se te olvidó el PIN? Pídelo a administración.</p>
    </div>
  )
}
