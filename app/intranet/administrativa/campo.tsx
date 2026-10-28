'use client'
import { useMemo, useState } from 'react'
import { ExternalLink, KeyRound, Plus } from 'lucide-react'
import { Aviso, Boton, MarcaEstado, Seccion, Vacio } from '@/app/components/marca'
import { cantidad, fechaCorta, pesos, ROLES_CAMPO, type TituloCampo } from '@/lib/administrativa'
import { CAMPO, Campo, enviar, Mensaje, TD, TH, useCarga, Ventana, type Catalogo } from './comun'

/**
 * APP DE CAMPO — quién entra y qué registró.
 *
 * La app de actividades (actividades-monitoreo-campo) no usa cuentas de
 * personas: se entra con un TÍTULO (BODEGA, SIEMBRA, MONITOREO…) y su clave.
 * Aquí se crean, se les pone clave y se les asignan bodegas. Cambiar la clave
 * saca de la app a todos los celulares que entraron con la anterior.
 */
export const URL_APP_CAMPO = 'https://actividades-monitoreo-campo.vercel.app'

interface Registro {
  id: string
  fecha: string
  predio: string
  municipio: string | null
  lote: string
  actividades: string[]
  n_nucleos: number
  nucleos_txt: string | null
  personas: number | null
  jornales: number | null
  bodega_id: string | null
  titulo: string | null
  notas: string | null
  insumos: { insumo_id: string; cantidad: number }[]
  costo_insumos: number
  costo_mano_obra: number
}

export default function AppCampo({ cat, recargar }: { cat: Catalogo; recargar: () => Promise<void> }) {
  const [editando, setEditando] = useState<Partial<TituloCampo> | null>(null)
  const { data: registros, error } = useCarga<Registro[]>(
    '/api/administrativa/actividades', (j) => (j.registros as Registro[]) ?? [], 'No se pudieron leer los registros de campo.')

  const bodega = (id: string | null) => cat.bodegas.find((b) => b.id === id)?.nombre ?? '—'
  const insumo = (id: string) => cat.insumos.find((i) => i.id === id)

  const totales = useMemo(() => {
    const rs = registros ?? []
    const jor = rs.reduce((s, r) => s + (Number(r.jornales) || 0), 0)
    const nuc = rs.reduce((s, r) => s + r.n_nucleos, 0)
    return {
      n: rs.length, jornales: jor, nucleos: nuc,
      insumos: rs.reduce((s, r) => s + r.costo_insumos, 0),
      mano: rs.reduce((s, r) => s + r.costo_mano_obra, 0),
    }
  }, [registros])

  return (
    <>
      <Seccion
        titulo="Títulos de acceso"
        sub="Con qué se entra a la app de actividades. No son personas: el mismo celular sirve a quien haga ese trabajo ese día. Cada título descuenta solo de sus bodegas; sin bodegas asignadas ve el inventario de todas."
        acciones={<>
          <Boton variante="secundario" href={URL_APP_CAMPO} icono={<ExternalLink size={13} />}>Abrir la app</Boton>
          <Boton icono={<Plus size={13} />} onClick={() => setEditando({ rol: 'siembra', bodega_ids: [] })}>Nuevo título</Boton>
        </>}
      >
        {cat.titulos.some((t) => t.activo && !t.tiene_clave) && (
          <Aviso tono="ambar" className="mb-4">Hay títulos sin clave: nadie puede entrar con ellos hasta que se la pongas.</Aviso>
        )}
        <div className="overflow-x-auto vidrio rounded-2xl">
          <table className="w-full">
            <thead className="border-b border-linea/70 bg-white/40">
              <tr><th className={TH}>Título</th><th className={TH}>Puede</th><th className={TH}>Bodegas</th><th className={TH}>Clave</th><th className={TH}>Último ingreso</th><th className={TH}></th></tr>
            </thead>
            <tbody>
              {cat.titulos.map((t) => (
                <tr key={t.id} className={`border-b border-fina ${t.activo ? '' : 'opacity-50'}`}>
                  <td className={`${TD} font-medium`}>{t.nombre}</td>
                  <td className={TD}>{ROLES_CAMPO[t.rol].nombre}<span className="block text-[11px] text-tenue">{ROLES_CAMPO[t.rol].que}</span></td>
                  <td className={`${TD} text-suave`}>{t.bodega_ids.length ? t.bodega_ids.map(bodega).join(', ') : 'Todas (solo ver)'}</td>
                  <td className={TD}>
                    {!t.activo ? <MarcaEstado color="var(--color-tenue)">Inactivo</MarcaEstado>
                      : !t.tiene_clave ? <MarcaEstado color="var(--color-ambar)">Sin clave</MarcaEstado>
                      : t.bloqueado_hasta && new Date(t.bloqueado_hasta) > new Date() ? <MarcaEstado color="var(--color-red-600)">Bloqueado 15 min</MarcaEstado>
                      : <MarcaEstado color="var(--color-bosque)">Con clave</MarcaEstado>}
                  </td>
                  <td className={`${TD} text-suave`}>{t.ultimo_ingreso ? fechaCorta(t.ultimo_ingreso) : 'Nunca'}</td>
                  <td className={TD}><Boton variante="fantasma" icono={<KeyRound size={13} />} onClick={() => setEditando(t)}>Editar</Boton></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="Lo que registró campo" sub="Cada día de trabajo sobre los núcleos de un lote, con los insumos que descontó de su bodega. El costo de insumos va al promedio de compra.">
        {error && <Aviso tono="arcilla" className="mb-4">{error}</Aviso>}
        {registros === null ? <Vacio>Cargando…</Vacio> : registros.length === 0 ? (
          <Vacio>Todavía no hay registros de la app de campo</Vacio>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap gap-x-10 gap-y-3 text-[12.5px]">
              <span><b className="font-display text-xl tabular-nums">{totales.n}</b> <span className="text-tenue">registros</span></span>
              <span><b className="font-display text-xl tabular-nums">{cantidad(totales.jornales)}</b> <span className="text-tenue">jornales</span></span>
              <span><b className="font-display text-xl tabular-nums">{totales.jornales ? cantidad(totales.nucleos / totales.jornales) : '—'}</b> <span className="text-tenue">núcleos por jornal</span></span>
              <span><b className="font-display text-xl tabular-nums">{pesos(totales.mano)}</b> <span className="text-tenue">mano de obra</span></span>
              <span><b className="font-display text-xl tabular-nums">{pesos(totales.insumos)}</b> <span className="text-tenue">insumos</span></span>
            </div>
            <div className="overflow-x-auto vidrio rounded-2xl">
              <table className="w-full">
                <thead className="border-b border-linea/70 bg-white/40">
                  <tr><th className={TH}>Fecha</th><th className={TH}>Predio · lote</th><th className={TH}>Actividades</th><th className={`${TH} text-right`}>Núcleos</th>
                    <th className={`${TH} text-right`}>Jornales</th><th className={TH}>Insumos</th><th className={`${TH} text-right`}>Costo</th><th className={TH}>Título</th></tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id} className="border-b border-fina">
                      <td className={`${TD} whitespace-nowrap`}>{fechaCorta(r.fecha)}</td>
                      <td className={TD}>{r.predio}<span className="block text-[11px] text-tenue">{r.lote}{r.municipio ? ` · ${r.municipio}` : ''}</span></td>
                      <td className={TD}>{r.actividades.join(', ')}</td>
                      <td className={`${TD} text-right tabular-nums`}>{r.n_nucleos}<span className="block text-[10.5px] text-tenue">{r.nucleos_txt}</span></td>
                      <td className={`${TD} text-right tabular-nums`}>{cantidad(r.jornales)}</td>
                      <td className={`${TD} text-[11.5px] text-suave`}>
                        {r.insumos.length ? r.insumos.map((i) => `${cantidad(i.cantidad)} ${insumo(i.insumo_id)?.unidad ?? ''} ${insumo(i.insumo_id)?.nombre ?? ''}`).join(' · ') : '—'}
                        {r.insumos.length > 0 && <span className="block text-tenue">de {bodega(r.bodega_id)}</span>}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{pesos(r.costo_insumos + r.costo_mano_obra)}</td>
                      <td className={`${TD} text-suave`}>{r.titulo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Seccion>

      {editando && <EditarTitulo inicial={editando} cat={cat} onCerrar={() => setEditando(null)} onListo={recargar} />}
    </>
  )
}

function claveAlAzar(): string {
  // 8 caracteres, sin los que se confunden al dictarlos por teléfono (0/O, 1/l/I).
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(crypto.getRandomValues(new Uint32Array(8)), (n) => letras[n % letras.length]).join('')
}

function EditarTitulo({ inicial, cat, onCerrar, onListo }: { inicial: Partial<TituloCampo>; cat: Catalogo; onCerrar: () => void; onListo: () => Promise<void> }) {
  const nuevo = !inicial.id
  const [nombre, setNombre] = useState(inicial.nombre ?? '')
  const [rol, setRol] = useState<TituloCampo['rol']>(inicial.rol ?? 'siembra')
  const [bodegas, setBodegas] = useState<string[]>(inicial.bodega_ids ?? [])
  const [activo, setActivo] = useState(inicial.activo ?? true)
  const [clave, setClave] = useState(nuevo ? claveAlAzar() : '')
  const [entregada, setEntregada] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar() {
    setOcupado(true); setError(null)
    try {
      if (nuevo) await enviar('/api/administrativa/titulos', 'POST', { nombre, rol, bodega_ids: bodegas, clave })
      else await enviar('/api/administrativa/titulos', 'PATCH', { id: inicial.id, rol, bodega_ids: bodegas, activo, ...(clave ? { clave } : {}) })
      await onListo()
      if (clave) setEntregada(clave)
      else onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  if (entregada) {
    return (
      <Ventana titulo="Clave para entregar" onCerrar={onCerrar}>
        <p className="text-[12.5px] text-suave">Pásale esto a quien va a usar la app. La clave no se vuelve a mostrar: si se pierde, se pone otra.</p>
        <div className="my-5 vidrio rounded-2xl px-5 py-4">
          <p className="text-[10px] uppercase tracking-[.16em] text-tenue">Título</p>
          <p className="font-display text-xl font-bold">{(nombre || inicial.nombre || '').toUpperCase()}</p>
          <p className="mt-3 text-[10px] uppercase tracking-[.16em] text-tenue">Clave</p>
          <p className="font-mono text-xl tracking-wider">{entregada}</p>
        </div>
        {!nuevo && <p className="text-[12px] text-tenue">Los celulares que estaban dentro con la clave anterior tendrán que volver a entrar.</p>}
        <div className="mt-5"><Boton onClick={onCerrar}>Listo</Boton></div>
      </Ventana>
    )
  }

  return (
    <Ventana titulo={nuevo ? 'Nuevo título' : `Título ${inicial.nombre}`} onCerrar={onCerrar}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Título">
          <input className={CAMPO} value={nombre} disabled={!nuevo} onChange={(e) => setNombre(e.target.value.toUpperCase())} placeholder="VIVERO" />
        </Campo>
        <Campo etiqueta="Qué puede hacer">
          <select className={CAMPO} value={rol} onChange={(e) => setRol(e.target.value as TituloCampo['rol'])}>
            {(Object.keys(ROLES_CAMPO) as TituloCampo['rol'][]).map((r) => <option key={r} value={r}>{ROLES_CAMPO[r].nombre}</option>)}
          </select>
        </Campo>
      </div>
      <p className="mt-2 text-[11.5px] text-tenue">{ROLES_CAMPO[rol].que}</p>

      <p className="mb-2 mt-5 text-[10px] uppercase tracking-[.16em] text-tenue">Sus bodegas</p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {cat.bodegas.filter((b) => b.activo && b.tipo !== 'persona').map((b) => (
          <label key={b.id} className="flex items-center gap-2 text-[12.5px] text-tinta">
            <input type="checkbox" checked={bodegas.includes(b.id)}
                   onChange={(e) => setBodegas(e.target.checked ? [...bodegas, b.id] : bodegas.filter((x) => x !== b.id))} />
            {b.nombre}
          </label>
        ))}
      </div>

      <Campo etiqueta={nuevo ? 'Clave (mínimo 6 caracteres)' : 'Clave nueva (déjala vacía para no cambiarla)'} className="mt-5">
        <div className="flex gap-2">
          <input className={`${CAMPO} font-mono`} value={clave} onChange={(e) => setClave(e.target.value)} />
          <Boton variante="secundario" onClick={() => setClave(claveAlAzar())}>Otra</Boton>
        </div>
      </Campo>
      {!nuevo && (
        <label className="mt-4 flex items-center gap-2 text-[12.5px] text-suave">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activo (desactivarlo saca de la app a todos los que entraron con él)
        </label>
      )}
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || (nuevo && (!nombre.trim() || clave.length < 6)) || (!!clave && clave.length < 6)} onClick={guardar}>Guardar</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}
