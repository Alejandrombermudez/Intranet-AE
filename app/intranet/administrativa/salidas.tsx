'use client'
import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { Aviso, Boton, MarcaEstado, Pestanas, Seccion, Vacio } from '@/app/components/marca'
import { esBodegaFisica, fechaCorta, hoyISO } from '@/lib/administrativa'
import { AVISO_MIGRACION_SALIDAS, nombreTrabajador, type Salida, type Trabajador } from '@/lib/salidas'
import { CAMPO, Campo, enviar, Mensaje, TD, TH, useCarga, Ventana, type Catalogo } from './comun'
import FichaSalida from './salida-ficha'
import Trabajadores, { type TrabajadorConCargo } from './trabajadores'

/**
 * SALIDAS A CAMPO — el equipo sale con materiales, herramientas y EPP, y vuelve.
 *
 * Una salida es una bodega más, con responsable y fechas: lo que tiene a cargo el
 * equipo es su saldo. Se le entrega con actas, se consume desde la app de campo,
 * se devuelve contando y se CIERRA solo cuando todo lo que sigue en el saldo tiene
 * una explicación. Ver docs/PLAN_SALIDAS_CAMPO.md.
 */
interface Listado { salidas: Salida[]; faltaMigracion?: boolean; aviso?: string }
interface ListadoTrabajadores { trabajadores: TrabajadorConCargo[] }

export default function SalidasCampo({ cat, recargar }: { cat: Catalogo; recargar: () => Promise<void> }) {
  const [vista, setVista] = useState<'salidas' | 'trabajadores'>('salidas')
  const [abierta, setAbierta] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('salida')
  })
  const [creando, setCreando] = useState(false)

  const listado = useCarga<Listado>('/api/administrativa/salidas', (j) => ({
    salidas: (j.salidas as Salida[]) ?? [], faltaMigracion: j.faltaMigracion === true, aviso: j.aviso as string | undefined,
  }), 'No se pudieron leer las salidas.')
  const gente = useCarga<ListadoTrabajadores>('/api/administrativa/trabajadores', (j) => ({
    trabajadores: (j.trabajadores as TrabajadorConCargo[]) ?? [],
  }), 'No se pudieron leer los trabajadores.')

  const abrir = (id: string | null) => {
    setAbierta(id)
    const u = new URL(window.location.href)
    if (id) u.searchParams.set('salida', id); else u.searchParams.delete('salida')
    window.history.replaceState(null, '', u.toString())
  }

  const sinMigrar = cat.faltaSalidas || listado.data?.faltaMigracion
  if (sinMigrar) {
    return (
      <Aviso tono="ambar" titulo="Las salidas a campo todavía no tienen dónde guardar">
        {listado.data?.aviso ?? AVISO_MIGRACION_SALIDAS} Cuando esté corrida, recarga esta página.
      </Aviso>
    )
  }

  if (abierta) {
    return (
      <FichaSalida
        id={abierta} cat={cat} trabajadores={(gente.data?.trabajadores ?? []).filter((t) => t.activo)}
        onVolver={() => { abrir(null); void listado.recargar() }}
        onCambio={async () => { await Promise.all([recargar(), gente.recargar()]) }}
      />
    )
  }

  const salidas = listado.data?.salidas ?? []
  const responsable = (id: string | null) => nombreTrabajador((gente.data?.trabajadores ?? []).find((t) => t.id === id))

  return (
    <>
      <div className="mb-6">
        <Pestanas tono="claro" items={[
          { id: 'salidas', label: 'Salidas', activa: vista === 'salidas', onClick: () => setVista('salidas') },
          { id: 'trabajadores', label: 'Trabajadores', activa: vista === 'trabajadores', onClick: () => setVista('trabajadores') },
        ]} />
      </div>

      {listado.error && <Aviso tono="arcilla" className="mb-6">{listado.error}</Aviso>}

      {vista === 'trabajadores' ? (
        <Trabajadores lista={gente.data?.trabajadores ?? []} recargar={async () => { await gente.recargar(); await recargar() }} />
      ) : (
        <Seccion
          titulo="Salidas a campo"
          sub="Cada vez que el equipo sale con materiales: se entrega con acta, se consume en la app, se devuelve contando y se cierra cuando no queda nada sin explicar."
          acciones={<Boton icono={<Plus size={13} />} onClick={() => setCreando(true)}>Nueva salida</Boton>}
        >
          {listado.data === null ? <Vacio>Cargando…</Vacio> : salidas.length === 0 ? (
            <Vacio>Todavía no hay salidas. Crea la primera y registra su entrega inicial.</Vacio>
          ) : (
            <div className="overflow-x-auto vidrio rounded-2xl">
              <table className="w-full">
                <thead className="border-b border-linea/70 bg-white/40">
                  <tr><th className={TH}>Salida</th><th className={TH}>Responsable</th><th className={TH}>Fechas</th><th className={TH}>Estado</th>
                    <th className={TH}>Sin explicar</th><th className={TH}>Actas</th><th className={TH}></th></tr>
                </thead>
                <tbody>
                  {salidas.map((s) => (
                    <tr key={s.id} className="cursor-pointer border-b border-fina hover:bg-white/40" onClick={() => abrir(s.id)}>
                      <td className={TD}>
                        <span className="font-medium">{s.nombre}</span>
                        {s.proyecto && <span className="block text-[11px] text-tenue">{cat.proyectos.find((p) => p.codigo === s.proyecto)?.nombre ?? s.proyecto}</span>}
                      </td>
                      <td className={`${TD} text-suave`}>{s.responsable_id ? responsable(s.responsable_id) : '—'}</td>
                      <td className={`${TD} whitespace-nowrap text-suave`}>{fechaCorta(s.fecha_salida)}{s.fecha_cierre ? ` → ${fechaCorta(s.fecha_cierre)}` : ''}</td>
                      <td className={TD}>
                        <MarcaEstado color={s.estado === 'abierta' ? 'var(--color-ambar)' : 'var(--color-bosque)'}>{s.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</MarcaEstado>
                      </td>
                      <td className={TD}>
                        {s.estado === 'cerrada' ? <span className="text-tenue">—</span>
                          : (s.pendientes ?? 0) > 0 ? <span className="font-medium text-red-700">{s.pendientes} de {s.n_elementos}</span>
                          : <span className="text-bosque">Nada</span>}
                      </td>
                      <td className={TD}>
                        {s.n_actas ?? 0}
                        {(s.n_sin_firma ?? 0) > 0 && <span className="ml-1.5 text-[11px] text-ambar">{s.n_sin_firma} sin firma</span>}
                      </td>
                      <td className={TD}><ChevronRight size={15} className="text-tenue" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Seccion>
      )}

      {creando && (
        <NuevaSalida
          cat={cat} trabajadores={(gente.data?.trabajadores ?? []).filter((t) => t.activo)}
          onCerrar={() => setCreando(false)}
          onListo={async (id) => { await Promise.all([listado.recargar(), recargar()]); abrir(id) }}
        />
      )}
    </>
  )
}

function NuevaSalida({ cat, trabajadores, onCerrar, onListo }: {
  cat: Catalogo; trabajadores: Trabajador[]; onCerrar: () => void; onListo: (id: string) => Promise<void>
}) {
  const fisicas = cat.bodegas.filter((b) => b.activo && esBodegaFisica(b.tipo))
  const [v, setV] = useState(() => ({
    nombre: '', proyecto: '', responsable_id: '', bodega_retorno_id: fisicas.find((b) => b.tipo === 'vivero')?.id ?? '',
    fecha_salida: hoyISO(), notas: '',
  }))
  const [titulos, setTitulos] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // Solo se puede sumar la bodega a un título que ya tiene bodegas asignadas; los que ven todas la ven sin más.
  const conBodegas = cat.titulos.filter((t) => t.activo && t.bodega_ids.length > 0)

  async function guardar() {
    setOcupado(true); setError(null)
    try {
      const r = await enviar<{ id: string }>('/api/administrativa/salidas', 'POST', {
        ...v, proyecto: v.proyecto || null, responsable_id: v.responsable_id || null, bodega_retorno_id: v.bodega_retorno_id || null, titulo_ids: titulos,
      })
      await onListo(r.id); onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo="Nueva salida a campo" onCerrar={onCerrar}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" className="sm:col-span-2">
          <input className={CAMPO} value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} placeholder="Siembra piloto — La Guajira, Las Dalias y Versalles" />
        </Campo>
        <Campo etiqueta="Fecha de salida"><input type="date" className={CAMPO} value={v.fecha_salida} onChange={(e) => setV({ ...v, fecha_salida: e.target.value })} /></Campo>
        <Campo etiqueta="Proyecto">
          <select className={CAMPO} value={v.proyecto} onChange={(e) => setV({ ...v, proyecto: e.target.value })}>
            <option value="">— Ninguno —</option>
            {cat.proyectos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Responsable de la salida">
          <select className={CAMPO} value={v.responsable_id} onChange={(e) => setV({ ...v, responsable_id: e.target.value })}>
            <option value="">— Sin definir —</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{nombreTrabajador(t)}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Vuelve a">
          <select className={CAMPO} value={v.bodega_retorno_id} onChange={(e) => setV({ ...v, bodega_retorno_id: e.target.value })}>
            <option value="">— Sin definir —</option>
            {fisicas.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Notas" className="sm:col-span-2"><input className={CAMPO} value={v.notas} onChange={(e) => setV({ ...v, notas: e.target.value })} placeholder="Predios, cuadrilla, qué se va a hacer…" /></Campo>
      </div>

      {conBodegas.length > 0 && (
        <>
          <p className="mb-2 mt-5 text-[10px] uppercase tracking-[.16em] text-tenue">Títulos de la app que descuentan de esta salida</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {conBodegas.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-[12.5px] text-suave">
                <input type="checkbox" checked={titulos.includes(t.id)}
                       onChange={(e) => setTitulos(e.target.checked ? [...titulos, t.id] : titulos.filter((x) => x !== t.id))} />
                {t.nombre}
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-tenue">Un título sin bodegas asignadas ve el inventario de todas, también el de esta salida.</p>
        </>
      )}
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || !v.nombre.trim() || !v.fecha_salida} onClick={guardar}>Crear salida</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}
