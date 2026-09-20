'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { Feature, Geometry } from 'geojson'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { parsearShapefile, type ShapefileParseado } from '@/lib/shapefile-client'
import type { LoteSig } from '@/app/api/sig/lotes/route'
import type { NucleoGuardado } from '@/app/api/sig/nucleacion/route'
import {
  Loader2, FileUp, AlertCircle, AlertTriangle, CheckCircle2, Check, Save, Undo2, Sprout, MapPin, Info,
} from 'lucide-react'

const MapaZonas = dynamic(() => import('@/app/components/MapaZonas'), {
  ssr: false,
  loading: () => <div className="w-full h-80 rounded-xl border border-stone-200 bg-stone-100 flex items-center justify-center"><Loader2 className="animate-spin text-stone-400" size={28} /></div>,
})

const fmt = (n: number, d = 2) => n.toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d })

/**
 * NUCLEACIÓN — el paso que sigue después de que campo verifica las zonas.
 *
 * Dos momentos, en este orden:
 *   1. El SIG revisa lo que volvió de terreno y **confirma** cuáles zonas
 *      quedan. Cada zona confirmada es un LOTE de siembra. Un predio puede
 *      quedar con 0, 1 o n lotes — campo pudo haberlas descartado todas.
 *   2. Sobre esos lotes se sube la nucleación: un solo archivo con todos los
 *      núcleos del predio. La base le asigna a cada núcleo el lote que lo
 *      contiene, así nadie separa el shapefile a mano.
 *
 * Ojo con la palabra "lote": aquí es el pedazo de tierra donde se siembra, no
 * la carga de subida del versionado (`geo.zonas_carga`).
 */
export default function Nucleacion({
  predioId, fincaGeoms,
}: {
  predioId: string
  fincaGeoms: Geometry[]
}) {
  const [lotes, setLotes] = useState<LoteSig[]>([])
  const [nucleos, setNucleos] = useState<NucleoGuardado[]>([])
  const [cargando, setCargando] = useState(true)

  const [sel, setSel] = useState<Set<string>>(new Set())      // zonas por confirmar
  const [confirmando, setConfirmando] = useState(false)
  const [deshaciendo, setDeshaciendo] = useState<string | null>(null)

  const [parse, setParse] = useState<ShapefileParseado | null>(null)
  const [parseando, setParseando] = useState(false)
  const [errArchivo, setErrArchivo] = useState<string | null>(null)
  const [reemplazar, setReemplazar] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)
  // Migración sin correr: hay que decirlo tal cual. Si se mostrara la pantalla
  // vacía, diría "este predio no tiene zonas" cuando sí las tiene.
  const [faltaMigracion, setFaltaMigracion] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const [rl, rn] = await Promise.all([
      fetchConSesion(`/api/sig/lotes?predio_id=${predioId}`),
      fetchConSesion(`/api/sig/nucleacion?predio_id=${predioId}`),
    ])
    const dl = await rl.json(), dn = await rn.json()
    if (rl.status === 503 || rn.status === 503) {
      setFaltaMigracion(dl?.error ?? dn?.error ?? 'Falta correr la migración de nucleación.')
    } else {
      setFaltaMigracion(null)
    }
    setLotes(Array.isArray(dl) ? dl : [])
    setNucleos(Array.isArray(dn) ? dn : [])
    setCargando(false)
  }, [predioId])

  useEffect(() => { cargar().catch(() => setCargando(false)) }, [cargar])

  const confirmados = useMemo(() => lotes.filter(l => l.estado === 'definitiva'), [lotes])
  const candidatas  = useMemo(() => lotes.filter(l => l.estado !== 'definitiva'), [lotes])
  const sinLote     = useMemo(() => nucleos.filter(n => !n.zona_id).length, [nucleos])
  const haLotes     = confirmados.reduce((s, l) => s + Number(l.area_ha ?? 0), 0)

  const avisar = (tipo: 'ok' | 'error', msg: string) => { setAviso({ tipo, msg }); setTimeout(() => setAviso(null), 6000) }

  async function confirmarLotes() {
    if (sel.size === 0 || confirmando) return
    setConfirmando(true)
    try {
      const res = await fetchConSesion('/api/sig/lotes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predio_id: predioId, zona_ids: [...sel] }),
      })
      const body = await res.json()
      if (!res.ok) { avisar('error', body.error ?? 'No se pudo confirmar'); return }
      avisar('ok', `${body.confirmadas} zona(s) confirmadas como lote de siembra`)
      setSel(new Set()); await cargar()
    } finally { setConfirmando(false) }
  }

  async function deshacer(zonaId: string) {
    if (deshaciendo) return
    setDeshaciendo(zonaId)
    try {
      const res = await fetchConSesion(`/api/sig/lotes?predio_id=${predioId}&zona_id=${zonaId}`, { method: 'DELETE' })
      const body = await res.json()
      if (!res.ok) { avisar('error', body.error ?? 'No se pudo deshacer'); return }
      avisar('ok', 'El lote volvió a ser una zona verificada')
      await cargar()
    } finally { setDeshaciendo(null) }
  }

  async function leerArchivo(file: File) {
    setErrArchivo(null); setParseando(true)
    try { setParse(await parsearShapefile(file)) }
    catch (e) { setErrArchivo(e instanceof Error ? e.message : 'No se pudo leer el shapefile') }
    finally { setParseando(false) }
  }

  async function guardar() {
    if (!parse || guardando || confirmados.length === 0) return
    setGuardando(true)
    try {
      const res = await fetchConSesion('/api/sig/nucleacion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predio_id: predioId,
          reemplazar,
          features: parse.features.map(f => ({ geometry: f.geometry, properties: f.properties ?? {} })),
        }),
      })
      const body = await res.json()
      if (!res.ok) { avisar('error', body.error ?? 'No se pudo guardar la nucleación'); return }
      const extra = [
        body.retirados ? `${body.retirados} de la carga anterior quedaron como respaldo` : '',
        body.sin_lote ? `${body.sin_lote} cayeron fuera de todo lote` : '',
      ].filter(Boolean).join(' · ')
      avisar('ok', `${body.creados} núcleo(s) guardados${extra ? ' · ' + extra : ''}`)
      setParse(null); await cargar()
    } finally { setGuardando(false) }
  }

  // Mapa: los lotes de fondo y, encima, lo que se va a subir o lo ya cargado
  const lotesFeatures: Feature[] = useMemo(
    () => confirmados.map(l => ({ type: 'Feature', geometry: JSON.parse(l.geojson) as Geometry, properties: { nombre: l.nombre } })),
    [confirmados],
  )
  const nucleosFeatures: Feature[] = useMemo(
    () => (parse
      ? parse.features
      : nucleos.map(n => ({ type: 'Feature', geometry: JSON.parse(n.geojson) as Geometry, properties: { nombre: n.nombre } } as Feature))),
    [parse, nucleos],
  )

  if (cargando) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-stone-300" size={32} /></div>
  }

  if (faltaMigracion) {
    return (
      <section className="bg-white rounded-2xl border border-amber-400/40 p-5 space-y-2">
        <h2 className="flex items-center gap-2 font-black text-stone-800 text-sm uppercase tracking-wider">
          <AlertTriangle size={15} className="text-amber-600" /> Nucleación todavía no habilitada
        </h2>
        <p className="text-xs text-stone-600 leading-relaxed">{faltaMigracion}</p>
        <p className="text-[11px] text-stone-400 leading-relaxed">
          Las zonas y el trabajo de campo de este predio no se tocan: la pestaña se activa sola en cuanto
          la migración esté corrida.
        </p>
      </section>
    )
  }

  return (
    <div className="space-y-5">
      {aviso && (
        <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm border
          ${aviso.tipo === 'ok' ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {aviso.tipo === 'ok' ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
          {aviso.msg}
        </div>
      )}

      {/* ── Paso 1: confirmar los lotes ── */}
      <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-3">
        <div>
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">1 · Confirmar los lotes de siembra</h2>
          <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
            Cada zona que volvió verificada de campo y que el SIG da por buena es un <strong>lote</strong>.
            Un predio puede quedar con 0, 1 o varios: si campo las descartó todas, no hay lote y no hay nucleación.
          </p>
        </div>

        {lotes.length === 0 ? (
          <p className="flex items-start gap-2 text-xs text-stone-500 bg-stone-50 border border-stone-100 rounded-xl px-3 py-2.5">
            <Info size={13} className="shrink-0 mt-0.5" />
            Este predio no tiene zonas de siembra vigentes. Primero cárgalas en la pestaña «Sitios de siembra» y espera la verificación de campo.
          </p>
        ) : (
          <>
            {candidatas.length > 0 && (
              <div className="space-y-2">
                <div className="border border-stone-100 rounded-xl divide-y divide-stone-50">
                  {candidatas.map(l => {
                    const on = sel.has(l.zona_id)
                    return (
                      <button key={l.zona_id} type="button"
                        onClick={() => { const n = new Set(sel); if (n.has(l.zona_id)) n.delete(l.zona_id); else n.add(l.zona_id); setSel(n) }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${on ? 'bg-teal-50' : 'hover:bg-stone-50'}`}>
                        <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${on ? 'border-teal-500 bg-teal-500' : 'border-stone-300'}`}>
                          {on && <Check size={11} className="text-white" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold text-stone-800 truncate">{l.nombre || '(zona sin nombre)'}</span>
                          <span className="block text-[11px] text-stone-400">
                            {l.estado === 'validada' ? 'Verificada en campo' : 'Sin verificar en campo todavía'}
                            {l.origen === 'campo' && ' · la dibujó el técnico en terreno'}
                          </span>
                        </span>
                        <span className="text-xs text-stone-500 shrink-0">{l.area_ha != null ? `${fmt(l.area_ha)} ha` : '—'}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-[11px] text-stone-400">
                    {sel.size > 0 ? `${sel.size} seleccionada(s)` : 'Marca las que quedan en firme'}
                  </p>
                  <button onClick={confirmarLotes} disabled={sel.size === 0 || confirmando}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {confirmando ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Confirmar como lote
                  </button>
                </div>
              </div>
            )}

            {confirmados.length > 0 && (
              <div className="border border-teal-100 rounded-xl divide-y divide-teal-50 bg-teal-50/30">
                {confirmados.map(l => (
                  <div key={l.zona_id} className="flex items-center gap-3 px-3 py-2.5">
                    <Sprout size={14} className="text-teal-600 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold text-stone-800 truncate">{l.nombre || '(lote sin nombre)'}</span>
                      <span className="block text-[11px] text-stone-500">
                        {l.area_ha != null ? `${fmt(l.area_ha)} ha` : 'sin área'}
                        {l.n_nucleos > 0
                          ? ` · ${l.n_nucleos} núcleo(s)${Number(l.ha_nucleos) > 0 ? ` · ${fmt(Number(l.ha_nucleos))} ha nucleadas` : ''}${l.plantas > 0 ? ` · ${l.plantas} plantas` : ''}`
                          : ' · sin nucleación'}
                      </span>
                    </span>
                    <button onClick={() => deshacer(l.zona_id)} disabled={deshaciendo === l.zona_id}
                      title={l.n_nucleos > 0 ? 'Tiene nucleación cargada: hay que reemplazarla antes' : 'Volver a dejarla como zona verificada'}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-stone-500 hover:bg-white hover:text-stone-800 transition-colors disabled:opacity-50 shrink-0">
                      {deshaciendo === l.zona_id ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />}
                      Deshacer
                    </button>
                  </div>
                ))}
                <p className="px-3 py-2 text-[11px] font-bold text-teal-800">
                  {confirmados.length} lote(s) · {fmt(haLotes)} ha en total
                </p>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Paso 2: subir la nucleación ── */}
      <section className={`bg-white rounded-2xl border p-5 space-y-3 ${confirmados.length === 0 ? 'border-stone-100 opacity-60' : 'border-stone-100'}`}>
        <div>
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">2 · Subir la nucleación</h2>
          <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
            Un solo archivo con todos los núcleos del predio, como polígonos o como puntos. Cada núcleo se
            asigna solo al lote que lo contiene; si alguno cae fuera de todos, se guarda igual y se avisa.
          </p>
        </div>

        {confirmados.length === 0 ? (
          <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-400/15 border border-amber-400/30 rounded-xl px-3 py-2.5">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
            Confirma primero al menos un lote arriba. Sin lotes no hay dónde poner los núcleos.
          </p>
        ) : (
          <>
            <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-stone-200 rounded-xl cursor-pointer hover:border-teal-400 transition-colors text-sm text-stone-500">
              {parseando ? <Loader2 size={18} className="animate-spin text-teal-500" /> : <FileUp size={18} className="text-stone-400" />}
              <span>{parseando ? 'Leyendo…' : 'Selecciona el .zip de nucleación (shp, dbf, prj, shx)'}</span>
              <input type="file" accept=".zip,application/zip" className="hidden" disabled={parseando}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) leerArchivo(f) }} />
            </label>

            {errArchivo && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
                <AlertCircle size={16} className="shrink-0 mt-0.5" /> {errArchivo}
              </div>
            )}

            {parse && (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-xs text-stone-500">
                  <CheckCircle2 size={14} className="text-teal-500" />
                  {parse.reproyectado ? 'Reproyectado a EPSG:4326 desde el .prj' : 'Coordenadas ya en EPSG:4326'}
                  {' · '}{parse.features.length} núcleo(s)
                  {parse.metrics.areaHa > 0 && ` · ${fmt(parse.metrics.areaHa)} ha`}
                </p>
                <label className="flex items-start gap-2 text-xs text-stone-600 bg-stone-50 border border-stone-100 rounded-xl px-3 py-2.5 cursor-pointer">
                  <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} className="mt-0.5" />
                  <span>
                    <strong className="text-stone-800">Reemplazar la nucleación anterior</strong> — la que había queda
                    como respaldo consultable, no se borra. Si lo dejas sin marcar, los núcleos nuevos se suman a los que ya estaban.
                  </span>
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => setParse(null)} className="px-3 py-2 text-xs font-bold text-stone-500 hover:text-stone-800">
                    Descartar
                  </button>
                  <button onClick={guardar} disabled={guardando}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-40">
                    {guardando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Guardar nucleación
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Mapa: lotes de fondo, núcleos encima ── */}
      {(lotesFeatures.length > 0 || nucleosFeatures.length > 0) && (
        <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">
              {parse ? 'Vista previa sobre los lotes' : 'Nucleación cargada'}
            </h2>
            <p className="text-[11px] text-stone-400 flex items-center gap-1">
              <MapPin size={11} /> {nucleosFeatures.length} núcleo(s) · {confirmados.length} lote(s)
            </p>
          </div>
          <MapaZonas
            features={nucleosFeatures}
            baseFeatures={[...lotesFeatures, ...fincaGeoms.map(g => ({ type: 'Feature', geometry: g, properties: {} } as Feature))]}
            selectedIndices={nucleosFeatures.map((_, i) => i)}
          />
          {sinLote > 0 && !parse && (
            <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-400/15 border border-amber-400/30 rounded-xl px-3 py-2.5">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <span>
                <strong>{sinLote} núcleo(s) quedaron fuera de todo lote.</strong> Están guardados, pero no cuelgan de
                ninguno: revisa si falta confirmar un lote o si el archivo trae núcleos de otro predio.
              </span>
            </p>
          )}
        </section>
      )}
    </div>
  )
}
