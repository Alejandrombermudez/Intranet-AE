'use client'
import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Boton, MarcaEstado, Seccion } from '@/app/components/marca'
import {
  CATEGORIAS_INSUMO, esBodegaFisica, fechaCorta, pesos, TIPOS_BODEGA, UNIDADES_INVENTARIO,
  type Bodega, type Insumo,
} from '@/lib/administrativa'
import { CLASES, type ClaseElemento } from '@/lib/salidas'
import { CAMPO, Campo, enviar, Mensaje, TD, TH, Ventana, type Catalogo } from './comun'

/**
 * ELEMENTOS Y BODEGAS — el catálogo.
 * Los elementos (insumos, herramientas, EPP y dotación) son la lista cerrada de la
 * app de campo: allá nadie escribe uno a mano, elige de aquí. Cada uno tiene una
 * CLASE que dice qué se espera de él al cerrar una salida a campo. No se borran (el kardex los nombra): se
 * desactivan y dejan de aparecer para elegir.
 */
export default function CatalogoInsumos({ cat, recargar }: { cat: Catalogo; recargar: () => Promise<void> }) {
  const [insumo, setInsumo] = useState<Partial<Insumo> | null>(null)
  const [bodega, setBodega] = useState<Partial<Bodega> | null>(null)
  const proyecto = (c: string | null) => cat.proyectos.find((p) => p.codigo === c)?.nombre ?? '—'

  return (
    <>
      <Seccion
        titulo="Elementos"
        sub="Insumos, herramientas, EPP y dotación. La clase dice qué se espera: lo consumible se gasta; herramienta y EPP vuelven a bodega; la dotación se queda con quien la recibe. La unidad es en la que se cuenta (bulto, litro, unidad); si el proveedor factura en otra, al registrar la factura se pone cuántas de estas trae cada una."
        acciones={<Boton icono={<Plus size={13} />} onClick={() => setInsumo({ unidad: 'unidad', clase: 'consumible' })}>Nuevo elemento</Boton>}
      >
        <div className="overflow-x-auto vidrio rounded-2xl">
          <table className="w-full">
            <thead className="border-b border-linea/70 bg-white/40">
              <tr><th className={TH}>Elemento</th><th className={TH}>Clase</th><th className={TH}>Se cuenta en</th><th className={TH}>Presentación</th><th className={TH}>Categoría</th>
                <th className={`${TH} text-right`}>Costo promedio</th><th className={TH}>Última compra</th><th className={TH}></th></tr>
            </thead>
            <tbody>
              {cat.insumos.map((i) => (
                <tr key={i.id} className={`border-b border-fina ${i.activo ? '' : 'opacity-50'}`}>
                  <td className={TD}>{i.nombre}{!i.activo && <span className="ml-2 text-[11px] text-tenue">(inactivo)</span>}</td>
                  <td className={TD}><span className={i.clase === 'consumible' ? 'text-suave' : 'font-medium text-tinta'}>{CLASES[i.clase ?? 'consumible'].nombre}</span></td>
                  <td className={TD}>{i.unidad}</td>
                  <td className={`${TD} text-suave`}>{i.presentacion ?? '—'}</td>
                  <td className={`${TD} text-suave`}>{i.categoria ?? '—'}</td>
                  <td className={`${TD} text-right tabular-nums`}>{i.costo_promedio != null ? pesos(i.costo_promedio) : '—'}</td>
                  <td className={`${TD} text-suave`}>{fechaCorta(i.ultima_compra)}</td>
                  <td className={TD}><button type="button" className="text-tenue hover:text-tinta" title="Editar" onClick={() => setInsumo(i)}><Pencil size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion
        titulo="Bodegas"
        sub="La central recibe lo comprado; las sedes (vivero, Florencia, Escuela Bosque) guardan lo que vuelve de campo. Cada salida a campo y cada trabajador con elementos a su cargo tienen la suya, que se crea sola desde «Salidas a campo»."
        acciones={<Boton icono={<Plus size={13} />} onClick={() => setBodega({ tipo: 'sede' })}>Nueva bodega</Boton>}
      >
        <div className="overflow-x-auto vidrio rounded-2xl">
          <table className="w-full">
            <thead className="border-b border-linea/70 bg-white/40">
              <tr><th className={TH}>Bodega</th><th className={TH}>Tipo</th><th className={TH}>Proyecto</th><th className={TH}>Responsable</th><th className={TH}>Estado</th><th className={TH}></th></tr>
            </thead>
            <tbody>
              {cat.bodegas.filter((b) => esBodegaFisica(b.tipo)).map((b) => (
                <tr key={b.id} className="border-b border-fina">
                  <td className={TD}>{b.nombre}{b.notas && <span className="block text-[11px] text-tenue">{b.notas}</span>}</td>
                  <td className={TD}>{TIPOS_BODEGA[b.tipo]}</td>
                  <td className={TD}>{proyecto(b.proyecto)}</td>
                  <td className={`${TD} text-suave`}>{b.responsable ?? '—'}</td>
                  <td className={TD}><MarcaEstado color={b.activo ? 'var(--color-bosque)' : 'var(--color-tenue)'}>{b.activo ? 'Activa' : 'Inactiva'}</MarcaEstado></td>
                  <td className={TD}><button type="button" className="text-tenue hover:text-tinta" title="Editar" onClick={() => setBodega(b)}><Pencil size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cat.bodegas.some((b) => !esBodegaFisica(b.tipo)) && (
          <p className="mt-2 text-[11px] text-tenue">
            Además hay {cat.bodegas.filter((b) => b.tipo === 'campo').length} bodega(s) de salidas a campo y {cat.bodegas.filter((b) => b.tipo === 'persona').length} de trabajadores con elementos a su cargo: se ven en la pestaña «Salidas a campo».
          </p>
        )}
      </Seccion>

      {insumo && <EditarInsumo inicial={insumo} onCerrar={() => setInsumo(null)} onListo={recargar} />}
      {bodega && <EditarBodega inicial={bodega} cat={cat} onCerrar={() => setBodega(null)} onListo={recargar} />}
    </>
  )
}

function EditarInsumo({ inicial, onCerrar, onListo }: { inicial: Partial<Insumo>; onCerrar: () => void; onListo: () => Promise<void> }) {
  const [v, setV] = useState({
    nombre: inicial.nombre ?? '', unidad: inicial.unidad ?? 'unidad', presentacion: inicial.presentacion ?? '',
    categoria: inicial.categoria ?? '', notas: inicial.notas ?? '', activo: inicial.activo ?? true,
    clase: (inicial.clase ?? 'consumible') as ClaseElemento,
  })
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar() {
    setOcupado(true); setError(null)
    try {
      await enviar('/api/administrativa/insumos', inicial.id ? 'PATCH' : 'POST', { ...(inicial.id ? { id: inicial.id } : {}), ...v })
      await onListo(); onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo={inicial.id ? 'Editar elemento' : 'Nuevo elemento'} onCerrar={onCerrar}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" className="sm:col-span-2"><input className={CAMPO} value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} placeholder="Cal dolomita 70-25" /></Campo>
        <Campo etiqueta="Clase" className="sm:col-span-2">
          <select className={CAMPO} value={v.clase} onChange={(e) => setV({ ...v, clase: e.target.value as ClaseElemento })}>
            {(Object.keys(CLASES) as ClaseElemento[]).map((c) => <option key={c} value={c}>{CLASES[c].nombre} — {CLASES[c].que}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Se cuenta en">
          <input className={CAMPO} list="unidades-inv" value={v.unidad} onChange={(e) => setV({ ...v, unidad: e.target.value })} />
          <datalist id="unidades-inv">{UNIDADES_INVENTARIO.map((u) => <option key={u} value={u} />)}</datalist>
        </Campo>
        <Campo etiqueta="Presentación"><input className={CAMPO} value={v.presentacion} onChange={(e) => setV({ ...v, presentacion: e.target.value })} placeholder="Bulto x 50 kg" /></Campo>
        <Campo etiqueta="Categoría">
          <input className={CAMPO} list="categorias-inv" value={v.categoria} onChange={(e) => setV({ ...v, categoria: e.target.value })} />
          <datalist id="categorias-inv">{CATEGORIAS_INSUMO.map((u) => <option key={u} value={u} />)}</datalist>
        </Campo>
        <Campo etiqueta="Notas"><input className={CAMPO} value={v.notas} onChange={(e) => setV({ ...v, notas: e.target.value })} /></Campo>
      </div>
      {inicial.id && (
        <label className="mt-4 flex items-center gap-2 text-[12.5px] text-suave">
          <input type="checkbox" checked={v.activo} onChange={(e) => setV({ ...v, activo: e.target.checked })} />
          Activo (si lo desactivas, ya no aparece para elegir en facturas ni en la app de campo; su historial queda)
        </label>
      )}
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || !v.nombre.trim() || !v.unidad.trim()} onClick={guardar}>Guardar</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}

function EditarBodega({ inicial, cat, onCerrar, onListo }: { inicial: Partial<Bodega>; cat: Catalogo; onCerrar: () => void; onListo: () => Promise<void> }) {
  const [v, setV] = useState({
    nombre: inicial.nombre ?? '', tipo: inicial.tipo ?? 'proyecto', proyecto: inicial.proyecto ?? '',
    responsable: inicial.responsable ?? '', notas: inicial.notas ?? '', activo: inicial.activo ?? true,
  })
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function guardar() {
    setOcupado(true); setError(null)
    try {
      await enviar('/api/administrativa/bodegas', inicial.id ? 'PATCH' : 'POST', { ...(inicial.id ? { id: inicial.id } : {}), ...v, proyecto: v.proyecto || null })
      await onListo(); onCerrar()
    } catch (e) { setError((e as Error).message) }
    setOcupado(false)
  }

  return (
    <Ventana titulo={inicial.id ? 'Editar bodega' : 'Nueva bodega'} onCerrar={onCerrar}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre"><input className={CAMPO} value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} /></Campo>
        <Campo etiqueta="Tipo">
          <select className={CAMPO} value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as Bodega['tipo'] })}>
            {(Object.keys(TIPOS_BODEGA) as Bodega['tipo'][]).filter((t) => esBodegaFisica(t)).map((t) => <option key={t} value={t}>{TIPOS_BODEGA[t]}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Proyecto">
          <select className={CAMPO} value={v.proyecto} onChange={(e) => setV({ ...v, proyecto: e.target.value })}>
            <option value="">— Ninguno —</option>
            {cat.proyectos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Responsable"><input className={CAMPO} value={v.responsable} onChange={(e) => setV({ ...v, responsable: e.target.value })} placeholder="Cargo o persona" /></Campo>
        <Campo etiqueta="Notas" className="sm:col-span-2"><input className={CAMPO} value={v.notas} onChange={(e) => setV({ ...v, notas: e.target.value })} /></Campo>
      </div>
      {inicial.id && (
        <label className="mt-4 flex items-center gap-2 text-[12.5px] text-suave">
          <input type="checkbox" checked={v.activo} onChange={(e) => setV({ ...v, activo: e.target.checked })} /> Activa
        </label>
      )}
      <Mensaje error={error} />
      <div className="mt-5 flex gap-2">
        <Boton disabled={ocupado || !v.nombre.trim()} onClick={guardar}>Guardar</Boton>
        <Boton variante="fantasma" onClick={onCerrar}>Cancelar</Boton>
      </div>
    </Ventana>
  )
}
