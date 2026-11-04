'use client'
import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Aviso, Boton, MarcaEstado, Seccion, Vacio } from '@/app/components/marca'
import { CLASES, nombreTrabajador, num, type ClaseElemento, type Trabajador } from '@/lib/salidas'
import { CAMPO, Campo, enviar, Mensaje, TD, TH, Ventana } from './comun'

/**
 * TRABAJADORES DE CAMPO — quien recibe materiales, herramientas o EPP a su nombre.
 *
 * No tienen correo de la organización, por eso no están en talento humano. Lo que
 * cada uno tiene a su cargo es el saldo de su bodega «a cargo de», que se crea sola
 * la primera vez que se le entrega algo. Son datos personales y el repositorio es
 * público: se cargan aquí, nunca en un .sql.
 */
export interface TrabajadorConCargo extends Trabajador {
  a_cargo: { insumo_id: string; nombre: string; unidad: string; clase: ClaseElemento; cantidad: number }[]
}

const TIPOS_DOC = ['CC', 'CE', 'TI', 'PEP', 'PPT', 'PA']

export default function Trabajadores({ lista, recargar }: { lista: TrabajadorConCargo[]; recargar: () => Promise<void> }) {
  const [editando, setEditando] = useState<Partial<Trabajador> | null>(null)
  const [soloActivos, setSoloActivos] = useState(true)
  const visibles = lista.filter((t) => !soloActivos || t.activo)

  return (
    <>
      <Seccion
        titulo="Trabajadores de campo"
        sub="Quien recibe y firma. Aquí se ve qué tiene cada uno a su cargo: mientras tenga algo, no hay paz y salvo."
        acciones={
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[11.5px] text-suave">
              <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} /> Solo activos
            </label>
            <Boton icono={<Plus size={13} />} onClick={() => setEditando({ tipo_documento: 'CC' })}>Nuevo trabajador</Boton>
          </div>
        }
      >
        {visibles.length === 0 ? (
          <Vacio>Todavía no hay trabajadores. Agrega a quien va a recibir materiales o EPP.</Vacio>
        ) : (
          <div className="overflow-x-auto vidrio rounded-2xl">
            <table className="w-full">
              <thead className="border-b border-linea/70 bg-white/40">
                <tr><th className={TH}>Nombre</th><th className={TH}>Documento</th><th className={TH}>Cargo</th><th className={TH}>Celular</th>
                  <th className={TH}>Tiene a su cargo</th><th className={TH}></th></tr>
              </thead>
              <tbody>
                {visibles.map((t) => (
                  <tr key={t.id} className={`border-b border-fina ${t.activo ? '' : 'opacity-50'}`}>
                    <td className={TD}>{nombreTrabajador(t)}{!t.activo && <span className="ml-2 text-[11px] text-tenue">(inactivo)</span>}</td>
                    <td className={`${TD} text-suave`}>{t.numero_documento ? `${t.tipo_documento ?? ''} ${t.numero_documento}`.trim() : '—'}</td>
                    <td className={`${TD} text-suave`}>{t.cargo ?? '—'}</td>
                    <td className={`${TD} text-suave`}>{t.celular ?? '—'}</td>
                    <td className={TD}>
                      {t.a_cargo.length === 0 ? <MarcaEstado color="var(--color-bosque)">Paz y salvo</MarcaEstado> : (
                        <ul className="space-y-0.5 text-[12px]">
                          {t.a_cargo.map((a) => (
                            <li key={a.insumo_id}>
                              <span className="tabular-nums">{num(a.cantidad)}</span> {a.unidad} · {a.nombre}
                              <span className="ml-1.5 text-[10.5px] text-tenue">{CLASES[a.clase]?.nombre}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className={TD}><button type="button" className="text-tenue hover:text-tinta" title="Editar" onClick={() => setEditando(t)}><Pencil size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>
      {editando && <EditarTrabajador inicial={editando} onCerrar={() => setEditando(null)} onListo={recargar} />}
    </>
  )
}

function EditarTrabajador({ inicial, onCerrar, onListo }: { inicial: Partial<Trabajador>; onCerrar: () => void; onListo: () => Promise<void> }) {
  const [v, setV] = useState({
    nombres: inicial.nombres ?? '', apellidos: inicial.apellidos ?? '', tipo_documento: inicial.tipo_documento ?? 'CC',
    numero_documento: inicial.numero_documento ?? '', celular: inicial.celular ?? '', cargo: inicial.cargo ?? '',
    notas: inicial.notas ?? '', activo: inicial.activo ?? true,
  })
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar() {
    setOcupado(true); setError(null)
    try {
      await enviar('/api/administrativa/trabajadores', inicial.id ? 'PATCH' : 'POST', { ...(inicial.id ? { id: inicial.id } : {}), ...v })
      await onListo(); onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo={inicial.id ? 'Editar trabajador' : 'Nuevo trabajador'} onCerrar={onCerrar}>
      <Aviso tono="ambar" className="mb-5">El documento y el celular son datos personales: se usan para las actas que firma y no salen de la intranet.</Aviso>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombres"><input className={CAMPO} value={v.nombres} onChange={(e) => setV({ ...v, nombres: e.target.value })} /></Campo>
        <Campo etiqueta="Apellidos"><input className={CAMPO} value={v.apellidos} onChange={(e) => setV({ ...v, apellidos: e.target.value })} /></Campo>
        <Campo etiqueta="Tipo de documento">
          <select className={CAMPO} value={v.tipo_documento} onChange={(e) => setV({ ...v, tipo_documento: e.target.value })}>
            {TIPOS_DOC.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Número de documento"><input className={CAMPO} inputMode="numeric" value={v.numero_documento} onChange={(e) => setV({ ...v, numero_documento: e.target.value })} /></Campo>
        <Campo etiqueta="Cargo"><input className={CAMPO} value={v.cargo} onChange={(e) => setV({ ...v, cargo: e.target.value })} placeholder="Operario, técnico, conductor…" /></Campo>
        <Campo etiqueta="Celular"><input className={CAMPO} inputMode="tel" value={v.celular} onChange={(e) => setV({ ...v, celular: e.target.value })} /></Campo>
        <Campo etiqueta="Notas" className="sm:col-span-2"><input className={CAMPO} value={v.notas} onChange={(e) => setV({ ...v, notas: e.target.value })} /></Campo>
      </div>
      {inicial.id && (
        <label className="mt-4 flex items-center gap-2 text-[12.5px] text-suave">
          <input type="checkbox" checked={v.activo} onChange={(e) => setV({ ...v, activo: e.target.checked })} />
          Activo (si lo desactivas, ya no aparece para elegir; sus actas y lo que tiene a cargo se conservan)
        </label>
      )}
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || !v.nombres.trim()} onClick={guardar}>Guardar</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}
