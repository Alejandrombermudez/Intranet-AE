'use client'
/**
 * El formulario de la ficha de talento humano. Lo usan «Mi perfil» (la persona
 * llena la suya) y talento humano (corrige la de cualquiera). Los campos salen
 * de CAMPOS_FICHA en lib/talento.ts: aquí no se escribe ninguno a mano.
 */
import { useMemo, useState } from 'react'
import { Check, PenLine } from 'lucide-react'
import { Aviso, Boton } from '@/app/components/marca'
import {
  AUTORIZACION_SENSIBLES, AUTORIZACION_TEXTO, CAMPOS_FICHA, GRUPOS_FICHA, LISTAS, completitud,
  type CampoFicha, type Persona,
} from '@/lib/talento'
import { CAMPO, ROTULO, Mensaje } from '@/app/intranet/administrativa/comun'

export function BarraCompletitud({ persona, esContratista }: { persona: Partial<Persona>; esContratista: boolean }) {
  const c = completitud(persona, esContratista)
  const pct = c.total ? Math.round((c.llenos / c.total) * 100) : 100
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[11px]">
        <span className="uppercase tracking-[.14em] text-tenue">Ficha completa</span>
        <span className="tabular-nums text-tinta">{pct} %</span>
      </div>
      <div className="h-1.5 w-full bg-fina"><div className="h-1.5 bg-bosque transition-all" style={{ width: `${pct}%` }} /></div>
      {c.faltan.length > 0 && (
        <p className="mt-2 text-[11.5px] text-suave">Falta: {c.faltan.slice(0, 6).map((f) => f.etiqueta.toLowerCase()).join(', ')}{c.faltan.length > 6 ? ` y ${c.faltan.length - 6} más` : ''}.</p>
      )}
    </div>
  )
}

export function FormularioFicha({
  persona, modo, esContratista, onGuardar,
}: {
  persona: Persona
  modo: 'persona' | 'rrhh'
  esContratista: boolean
  onGuardar: (datos: Record<string, unknown>) => Promise<string | null>
}) {
  const [v, setV] = useState<Record<string, unknown>>(() => ({ ...persona }))
  const [autoriza, setAutoriza] = useState(persona.autoriza_datos)
  const [sensibles, setSensibles] = useState(persona.autoriza_sensibles)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cambiado = useMemo(() => CAMPOS_FICHA.some((c) => (v[c.clave] ?? '') !== (persona[c.clave] ?? ''))
    || v.firma !== persona.firma || v.notas_rrhh !== persona.notas_rrhh
    || autoriza !== persona.autoriza_datos || sensibles !== persona.autoriza_sensibles, [v, persona, autoriza, sensibles])

  async function guardar() {
    setOcupado(true); setError(null); setOk(null)
    const datos: Record<string, unknown> = {}
    for (const c of CAMPOS_FICHA) datos[c.clave] = v[c.clave] ?? null
    datos.firma = v.firma ?? null
    if (modo === 'persona') { datos.autoriza_datos = autoriza; datos.autoriza_sensibles = sensibles }
    else { datos.notas_rrhh = v.notas_rrhh ?? null }
    const e = await onGuardar(datos)
    setOcupado(false)
    if (e) setError(e); else setOk('Guardado.')
  }

  const pon = (k: string, val: unknown) => { setV((x) => ({ ...x, [k]: val })); setOk(null) }

  return (
    <div>
      {modo === 'persona' && (
        <p className="mb-8 max-w-[70ch] text-[12.5px] font-light leading-relaxed text-suave">
          Estos datos los usa talento humano para tu contrato, tus pagos, tus afiliaciones y para atenderte si te pasa algo en
          campo. Solo los ves tú y el equipo de talento humano.
        </p>
      )}

      {GRUPOS_FICHA.map((g) => {
        const campos = CAMPOS_FICHA.filter((c) => c.grupo === g.id && (!c.soloContratista || esContratista || modo === 'rrhh'))
        if (!campos.length) return null
        return (
          <fieldset key={g.id} className="mb-9">
            <legend className="mb-4 w-full border-b border-linea pb-2 font-display text-[1.05rem] font-semibold text-tinta">{g.titulo}</legend>
            <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {campos.map((c) => (
                <CampoFichaInput key={c.clave} campo={c} valor={v[c.clave]} onCambio={(x) => pon(c.clave, x)}
                  bloqueado={!!c.sensible && modo === 'persona' && !sensibles} />
              ))}
            </div>
          </fieldset>
        )
      })}

      <fieldset className="mb-9">
        <legend className="mb-4 w-full border-b border-linea pb-2 font-display text-[1.05rem] font-semibold text-tinta">Firma</legend>
        <Firma valor={(v.firma as string) ?? null} onCambio={(x) => pon('firma', x)} />
      </fieldset>

      {modo === 'rrhh' && (
        <fieldset className="mb-9">
          <legend className="mb-4 w-full border-b border-linea pb-2 font-display text-[1.05rem] font-semibold text-tinta">Notas de talento humano</legend>
          <textarea className={`${CAMPO} min-h-24`} value={(v.notas_rrhh as string) ?? ''} onChange={(e) => pon('notas_rrhh', e.target.value)}
            placeholder="Solo las ve talento humano." />
          <Aviso tono="pizarra" className="mt-4">
            {persona.autoriza_datos
              ? `Autorizó el tratamiento de datos el ${new Date(persona.autoriza_at ?? '').toLocaleDateString('es-CO')}${persona.autoriza_sensibles ? ', incluidos los sensibles' : ', sin los sensibles (tipo de sangre e información médica)'}.`
              : 'Todavía no ha dado la autorización de tratamiento de datos: la da la persona desde Mi perfil.'}
          </Aviso>
        </fieldset>
      )}

      {modo === 'persona' && (
        <div className="mb-8 border-l-2 border-bosque bg-white px-5 py-4">
          <label className="flex items-start gap-3 text-[12.5px] leading-relaxed text-suave">
            <input type="checkbox" className="mt-1" checked={autoriza} onChange={(e) => { setAutoriza(e.target.checked); if (!e.target.checked) setSensibles(false) }} />
            <span>{AUTORIZACION_TEXTO}</span>
          </label>
          <label className="mt-3 flex items-start gap-3 text-[12.5px] leading-relaxed text-suave">
            <input type="checkbox" className="mt-1" disabled={!autoriza} checked={sensibles} onChange={(e) => setSensibles(e.target.checked)} />
            <span>{AUTORIZACION_SENSIBLES}</span>
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Boton disabled={ocupado || !cambiado || (modo === 'persona' && !autoriza)} icono={<Check size={13} />} onClick={guardar}>
          {ocupado ? 'Guardando…' : 'Guardar ficha'}
        </Boton>
        {modo === 'persona' && !autoriza && <span className="text-[12px] text-tenue">Para guardar, acepta la autorización de datos.</span>}
      </div>
      <Mensaje error={error} ok={ok} />
    </div>
  )
}

function CampoFichaInput({ campo: c, valor, onCambio, bloqueado }: { campo: CampoFicha; valor: unknown; onCambio: (v: unknown) => void; bloqueado: boolean }) {
  const id = `f_${c.clave}`
  const val = (valor as string) ?? ''
  const etiqueta = <>{c.etiqueta}{c.requerido && <span className="text-red-700"> *</span>}</>
  let control
  if (c.tipo === 'opciones') {
    control = (
      <select id={id} className={CAMPO} value={val} disabled={bloqueado} onChange={(e) => onCambio(e.target.value || null)}>
        <option value="">—</option>
        {Object.entries(c.opciones ?? {}).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
      </select>
    )
  } else if (c.tipo === 'si_no') {
    control = (
      <select id={id} className={CAMPO} value={valor === true ? 'si' : 'no'} onChange={(e) => onCambio(e.target.value === 'si')}>
        <option value="no">No</option><option value="si">Sí</option>
      </select>
    )
  } else if (c.tipo === 'area') {
    control = <textarea id={id} className={`${CAMPO} min-h-20`} value={val} disabled={bloqueado} onChange={(e) => onCambio(e.target.value)} />
  } else {
    const tipo = { fecha: 'date', tel: 'tel', email: 'email' }[c.tipo as string] ?? 'text'
    control = (
      <>
        <input id={id} type={tipo} className={CAMPO} value={val} disabled={bloqueado} list={c.lista ? `l_${c.lista}` : undefined}
          onChange={(e) => onCambio(e.target.value)} autoComplete="off" />
        {c.lista && <datalist id={`l_${c.lista}`}>{(LISTAS[c.lista] ?? []).map((x) => <option key={x} value={x} />)}</datalist>}
      </>
    )
  }
  return (
    <div className={c.ancho === 'completo' ? 'sm:col-span-2 lg:col-span-3' : ''}>
      <label htmlFor={id} className={ROTULO}>{etiqueta}</label>
      {control}
      {bloqueado
        ? <p className="mt-1 text-[11px] text-tenue">Dato sensible: acepta abajo la autorización de datos sensibles para llenarlo.</p>
        : c.ayuda && <p className="mt-1 text-[11px] text-tenue">{c.ayuda}</p>}
    </div>
  )
}

/** Firma: una imagen (foto de la firma en papel blanco) que va en las cuentas de cobro. */
function Firma({ valor, onCambio }: { valor: string | null; onCambio: (v: string | null) => void }) {
  const [error, setError] = useState<string | null>(null)
  async function cargar(f: File | undefined) {
    setError(null)
    if (!f) return
    if (!/^image\/(png|jpeg)$/.test(f.type)) { setError('Sube una imagen PNG o JPG.'); return }
    const url = await achicar(f, 600, 240)
    if (url.length > 190000) { setError('La imagen es muy pesada. Recórtala alrededor de la firma.'); return }
    onCambio(url)
  }
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="grid h-24 w-64 place-items-center border border-dashed border-taupe bg-white">
        {valor ? <img src={valor} alt="Firma" className="max-h-20 max-w-60 object-contain" /> : <PenLine className="text-taupe" size={22} />}
      </div>
      <div className="text-[12px] text-suave">
        <p className="mb-2 max-w-[42ch]">Una foto de tu firma en papel blanco. Va impresa en tus cuentas de cobro. Opcional.</p>
        <input type="file" accept="image/png,image/jpeg" className="text-[12px]" onChange={(e) => cargar(e.target.files?.[0])} />
        {valor && <button type="button" className="ml-3 text-[11px] uppercase tracking-[.14em] text-tenue hover:text-red-700" onClick={() => onCambio(null)}>Quitar</button>}
        {error && <p className="mt-1 text-red-700">{error}</p>}
      </div>
    </div>
  )
}

/** Reduce una imagen a lo justo (máx. ancho×alto) y la devuelve como PNG en base64. */
export function achicar(f: File, maxW: number, maxH: number): Promise<string> {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, maxW / img.width, maxH / img.height)
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      ok(c.toDataURL('image/png'))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = mal
    img.src = URL.createObjectURL(f)
  })
}
