'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { parsearShapefile, perimetroGeom, type ShapefileParseado } from '@/lib/shapefile-client'
import { area as turfArea } from '@turf/area'
import { booleanIntersects } from '@turf/boolean-intersects'
import type { Feature } from 'geojson'
import {
  Map as MapIcon, ArrowLeft, Loader2, FileUp, Save, AlertCircle, AlertTriangle,
  CheckCircle2, Ruler, Layers, Hexagon as Sq, ExternalLink, MousePointerClick, Check,
} from 'lucide-react'

const MapaZonas = dynamic(() => import('@/app/components/MapaZonas'), {
  ssr: false,
  loading: () => <div className="w-full h-80 rounded-xl border border-stone-200 bg-stone-100 flex items-center justify-center"><Loader2 className="animate-spin text-stone-400" size={28} /></div>,
})

const fmt = (n: number, d = 2) => n.toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d })

interface CasoInfo { nombre_predio?: string | null; nombre_completo?: string; municipio?: string; vereda?: string | null; expediente_id?: string | null }
interface ZonaGuardada {
  id: string; nombre: string | null; tipo: string; estado: string
  area_ha: number | null; perimetro_m: number | null
  propiedades: Record<string, unknown> | null; geojson: string
}
type Tab = 'poligono' | 'siembra'

const zonaToFeature = (z: ZonaGuardada): Feature => ({ type: 'Feature', geometry: JSON.parse(z.geojson), properties: { nombre: z.nombre, tipo: z.tipo } })
const todos = (n: number) => new Set(Array.from({ length: n }, (_, i) => i))
const resumenProps = (f: Feature) => Object.values(f.properties ?? {}).filter((v) => v != null && v !== '').slice(0, 2).map(String).join(' · ')

// Lista seleccionable de polígonos (con checkbox, "todos" y "limpiar")
function ListaSeleccion({ parse, sel, setSel }: { parse: ShapefileParseado; sel: Set<number>; setSel: (s: Set<number>) => void }) {
  const toggle = (i: number) => { const n = new Set(sel); if (n.has(i)) n.delete(i); else n.add(i); setSel(n) }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs">
        <span className="font-bold text-stone-500">{sel.size} de {parse.features.length} seleccionado(s)</span>
        <button type="button" onClick={() => setSel(todos(parse.features.length))} className="font-bold text-teal-600 hover:underline">Seleccionar todos</button>
        <button type="button" onClick={() => setSel(new Set())} className="font-bold text-stone-400 hover:underline">Limpiar</button>
      </div>
      <div className="border border-stone-100 rounded-xl divide-y divide-stone-50 max-h-60 overflow-y-auto">
        {parse.features.map((f, i) => {
          const on = sel.has(i)
          return (
            <button key={i} type="button" onClick={() => toggle(i)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${on ? 'bg-teal-50' : 'hover:bg-stone-50'}`}>
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${on ? 'border-teal-500 bg-teal-500' : 'border-stone-300'}`}>{on && <Check size={11} className="text-white" />}</span>
                <span className="font-bold text-stone-700 shrink-0">#{i + 1}</span>
                <span className="text-xs text-stone-400 truncate">{resumenProps(f)}</span>
              </span>
              <span className="text-xs text-stone-500 shrink-0">{fmt(turfArea(f) / 1e4)} ha</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function SigPredioPage() {
  const { predioId } = useParams<{ predioId: string }>()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [caso, setCaso] = useState<CasoInfo | null>(null)
  const [zonas, setZonas] = useState<ZonaGuardada[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('poligono')

  const [parsePoly, setParsePoly] = useState<ShapefileParseado | null>(null)
  const [selPoly, setSelPoly] = useState<Set<number>>(new Set())
  const [parseandoPoly, setParseandoPoly] = useState(false)
  const [errPoly, setErrPoly] = useState<string | null>(null)

  const [parseSites, setParseSites] = useState<ShapefileParseado | null>(null)
  const [selSites, setSelSites] = useState<Set<number>>(new Set())
  const [parseandoSites, setParseandoSites] = useState(false)
  const [errSites, setErrSites] = useState<string | null>(null)

  const [guardando, setGuardando] = useState(false)
  const [overlap, setOverlap] = useState<{ ids: string[]; lista: { nombre: string | null; area: number | null }[] } | null>(null)
  const [toast, setToast] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)
  const showToast = (tipo: 'ok' | 'error', msg: string) => { setToast({ tipo, msg }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: p } = await supabase.schema('people').from('user_profiles').select('is_admin, department, can_access_intranet').eq('email', user.email).single()
      if (!p?.is_admin && !p?.can_access_intranet && !p?.department) return
      setUserEmail(user.email ?? null); setAuthReady(true)
    })
  }, [])

  const cargarZonas = useCallback(async (email: string) => {
    const r = await fetch(`/api/sig/zonas?predio_id=${predioId}&email=${encodeURIComponent(email)}`)
    const d = await r.json(); setZonas(Array.isArray(d) ? d : [])
  }, [predioId])

  useEffect(() => {
    if (!authReady || !userEmail || !predioId) return
    Promise.all([
      fetch(`/api/juridica/aliados/${predioId}?email=${encodeURIComponent(userEmail)}`).then((r) => r.ok ? r.json() : null),
      cargarZonas(userEmail),
    ]).then(([c]) => { setCaso(c); setLoading(false) }).catch(() => setLoading(false))
  }, [authReady, userEmail, predioId, cargarZonas])

  const fincaZonas = useMemo(() => zonas.filter((z) => z.tipo === 'finca'), [zonas])
  const siembraZonas = useMemo(() => zonas.filter((z) => z.tipo === 'restauracion'), [zonas])
  const fincaFeatures = useMemo(() => fincaZonas.map(zonaToFeature), [fincaZonas])

  async function leerShp(file: File, set: (p: ShapefileParseado) => void, setErr: (e: string | null) => void, setP: (b: boolean) => void, setSel: (s: Set<number>) => void) {
    setErr(null); setP(true)
    try { const r = await parsearShapefile(file); set(r); setSel(new Set(r.features.length === 1 ? [0] : [])) }
    catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo leer el shapefile') }
    finally { setP(false) }
  }

  function toggle(set: Set<number>, setter: (s: Set<number>) => void, i: number) {
    const n = new Set(set); if (n.has(i)) n.delete(i); else n.add(i); setter(n)
  }

  // ── Guardar polígono(s) del predio ──
  async function intentarGuardarPoligono() {
    if (!parsePoly || selPoly.size === 0) return
    const feats = [...selPoly].map((i) => parsePoly.features[i])
    const sobre = fincaZonas.filter((z) => feats.some((f) => { try { return booleanIntersects(f, zonaToFeature(z)) } catch { return false } }))
    if (sobre.length > 0) { setOverlap({ ids: sobre.map((z) => z.id), lista: sobre.map((z) => ({ nombre: z.nombre, area: z.area_ha })) }); return }
    await guardarPoligono('insertar', [])
  }
  async function guardarPoligono(modo: 'insertar' | 'sobreescribir' | 'unir', unir_ids: string[]) {
    if (!parsePoly || !userEmail || selPoly.size === 0) return
    setGuardando(true)
    try {
      const features = [...selPoly].map((i) => parsePoly.features[i]).map((f) => ({ geometry: f.geometry, properties: f.properties ?? {}, perimetro_m: perimetroGeom(f.geometry) }))
      const res = await fetch('/api/sig/ingesta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predio_id: predioId, expediente_id: caso?.expediente_id ?? null, email: userEmail, tipo: 'finca', modo, unir_ids, features }),
      })
      const body = await res.json()
      if (!res.ok) { showToast('error', body.error ?? 'Error al guardar'); return }
      showToast('ok', modo === 'unir' ? 'Polígono unido y guardado' : `${body.creadas} polígono(s) del predio guardado(s)`)
      setParsePoly(null); setOverlap(null); await cargarZonas(userEmail)
    } finally { setGuardando(false) }
  }

  // ── Guardar sitios de siembra seleccionados ──
  async function guardarSitios() {
    if (!parseSites || !userEmail || selSites.size === 0) return
    setGuardando(true)
    try {
      const features = [...selSites].map((i) => parseSites.features[i]).map((f) => ({ geometry: f.geometry, properties: f.properties ?? {}, perimetro_m: perimetroGeom(f.geometry) }))
      const res = await fetch('/api/sig/ingesta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predio_id: predioId, expediente_id: caso?.expediente_id ?? null, email: userEmail, tipo: 'restauracion', modo: 'insertar', features }),
      })
      const body = await res.json()
      if (!res.ok) { showToast('error', body.error ?? 'Error al guardar'); return }
      showToast('ok', `${body.creadas} sitio(s) de siembra guardado(s)`)
      setParseSites(null); await cargarZonas(userEmail)
    } finally { setGuardando(false) }
  }

  if (!authReady || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="animate-spin text-stone-400" size={32} /></div>
  }

  const polyFeats = parsePoly ? [...selPoly].map((i) => parsePoly.features[i]) : []
  const polyArea = polyFeats.reduce((s, f) => s + turfArea(f) / 1e4, 0)
  const polyPerim = polyFeats.reduce((s, f) => s + perimetroGeom(f.geometry) / 1000, 0)
  const siteFeats = parseSites ? [...selSites].map((i) => parseSites.features[i]) : []
  const siteArea = siteFeats.reduce((s, f) => s + turfArea(f) / 1e4, 0)

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/intranet/sig" className="text-stone-400 hover:text-stone-700 transition-colors"><ArrowLeft size={20} /></Link>
          <MapIcon size={18} className="text-teal-600" />
          <div className="min-w-0">
            <h1 className="text-lg font-black text-stone-900 truncate">SIG I · {caso?.nombre_predio ?? 'Predio'}</h1>
            <p className="text-xs text-stone-400 truncate">{caso?.nombre_completo} · {caso?.municipio}{caso?.vereda ? ` / ${caso.vereda}` : ''}</p>
          </div>
          {caso && <Link href={`/intranet/juridica/${predioId}`} className="ml-auto shrink-0 flex items-center gap-1 text-xs font-bold text-stone-400 hover:text-teal-600 transition-colors">Ver caso jurídico <ExternalLink size={12} /></Link>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-stone-100 w-fit">
          {([['poligono', 'Polígono del predio'], ['siembra', 'Sitios de siembra']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as Tab)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${tab === k ? 'bg-teal-600 text-white' : 'text-stone-500 hover:bg-stone-100'}`}>
              {k === 'poligono' ? <Sq size={14} /> : <Layers size={14} />} {label}
              {k === 'poligono' && fincaZonas.length > 0 && <CheckCircle2 size={13} className={tab === k ? 'text-white' : 'text-teal-500'} />}
            </button>
          ))}
        </div>

        {/* ════ Polígono del predio ════ */}
        {tab === 'poligono' && (
          <>
            <section className="bg-white rounded-2xl border border-stone-100 p-5">
              <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider mb-1">Cargar polígono(s) del predio (.zip)</h2>
              <p className="text-xs text-stone-400 mb-3">El .zip puede traer varios polígonos. Marca uno o varios (clic en el mapa o en la lista) y guárdalos.</p>
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-stone-200 rounded-xl cursor-pointer hover:border-teal-400 transition-colors text-sm text-stone-500">
                {parseandoPoly ? <Loader2 size={18} className="animate-spin text-teal-500" /> : <FileUp size={18} className="text-stone-400" />}
                <span>{parseandoPoly ? 'Leyendo…' : 'Selecciona el .zip (shp, dbf, prj, shx)'}</span>
                <input type="file" accept=".zip,application/zip" className="hidden" disabled={parseandoPoly}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) leerShp(f, setParsePoly, setErrPoly, setParseandoPoly, setSelPoly) }} />
              </label>
              {errPoly && <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700"><AlertCircle size={16} className="shrink-0 mt-0.5" /> {errPoly}</div>}
              {parsePoly && <p className="mt-3 flex items-center gap-2 text-xs text-stone-500"><CheckCircle2 size={14} className="text-teal-500" /> {parsePoly.reproyectado ? 'Reproyectado a EPSG:4326 desde el .prj' : 'Coordenadas ya en EPSG:4326'} · {parsePoly.features.length} polígono(s)</p>}
            </section>

            {(parsePoly || fincaFeatures.length > 0) && (
              <section className="bg-white rounded-2xl border border-stone-100 p-5">
                <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider mb-3">{parsePoly ? 'Elige el/los polígono(s) del predio' : 'Polígono(s) guardado(s)'}</h2>
                {parsePoly && parsePoly.features.length > 1 && <p className="text-xs text-teal-600 font-bold mb-2 flex items-center gap-1"><MousePointerClick size={13} /> Haz clic en cada polígono que pertenezca al predio (o márcalos abajo).</p>}
                <MapaZonas
                  features={parsePoly ? parsePoly.features : fincaFeatures}
                  selectedIndices={parsePoly ? [...selPoly] : fincaFeatures.map((_, i) => i)}
                  onSelect={parsePoly ? (i) => toggle(selPoly, setSelPoly, i) : undefined}
                />
              </section>
            )}

            {parsePoly && (
              <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-stone-50 rounded-xl p-3"><div className="flex items-center gap-1.5 mb-1 text-teal-600"><Sq size={14} /><span className="text-[11px] font-bold text-stone-500">Seleccionados</span></div><p className="text-lg font-black text-stone-900">{selPoly.size}</p></div>
                  <div className="bg-stone-50 rounded-xl p-3"><div className="flex items-center gap-1.5 mb-1 text-teal-600"><Layers size={14} /><span className="text-[11px] font-bold text-stone-500">Área total</span></div><p className="text-lg font-black text-stone-900">{fmt(polyArea)} ha</p></div>
                  <div className="bg-stone-50 rounded-xl p-3"><div className="flex items-center gap-1.5 mb-1 text-teal-600"><Ruler size={14} /><span className="text-[11px] font-bold text-stone-500">Perímetro</span></div><p className="text-lg font-black text-stone-900">{fmt(polyPerim, 3)} km</p></div>
                </div>
                <ListaSeleccion parse={parsePoly} sel={selPoly} setSel={setSelPoly} />
                <button onClick={intentarGuardarPoligono} disabled={guardando || selPoly.size === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60">
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Guardar {selPoly.size} polígono(s) del predio
                </button>
              </section>
            )}

            {!parsePoly && fincaZonas.length > 0 && (
              <section className="bg-white rounded-2xl border border-stone-100 p-5">
                <p className="text-sm text-stone-600">{fincaZonas.length} polígono(s) guardado(s), <strong>{fmt(fincaZonas.reduce((s, z) => s + Number(z.area_ha ?? 0), 0))} ha</strong> en total. Sube otro .zip arriba para reemplazar o unir.</p>
              </section>
            )}
          </>
        )}

        {/* ════ Sitios de siembra ════ */}
        {tab === 'siembra' && (
          <>
            {fincaFeatures.length === 0 && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" /> Primero guarda el <strong>polígono del predio</strong> en la otra pestaña; los sitios de siembra se muestran sobre él.
              </div>
            )}
            <section className="bg-white rounded-2xl border border-stone-100 p-5">
              <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider mb-1">Cargar sitios de siembra (.zip)</h2>
              <p className="text-xs text-stone-400 mb-3">El .zip puede traer varios sitios. Marca uno o varios y guárdalos; se muestran superpuestos al polígono del predio.</p>
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-stone-200 rounded-xl cursor-pointer hover:border-teal-400 transition-colors text-sm text-stone-500">
                {parseandoSites ? <Loader2 size={18} className="animate-spin text-teal-500" /> : <FileUp size={18} className="text-stone-400" />}
                <span>{parseandoSites ? 'Leyendo…' : 'Selecciona el .zip de los sitios de siembra'}</span>
                <input type="file" accept=".zip,application/zip" className="hidden" disabled={parseandoSites}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) leerShp(f, setParseSites, setErrSites, setParseandoSites, setSelSites) }} />
              </label>
              {errSites && <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700"><AlertCircle size={16} className="shrink-0 mt-0.5" /> {errSites}</div>}
            </section>

            {(parseSites || fincaFeatures.length > 0 || siembraZonas.length > 0) && (
              <section className="bg-white rounded-2xl border border-stone-100 p-5">
                <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider mb-3">{parseSites ? 'Elige los sitios (sobre el polígono del predio)' : 'Sitios guardados'}</h2>
                {parseSites && parseSites.features.length > 1 && <p className="text-xs text-teal-600 font-bold mb-2 flex items-center gap-1"><MousePointerClick size={13} /> Marca los sitios que vas a guardar.</p>}
                <MapaZonas
                  baseFeatures={fincaFeatures}
                  features={parseSites ? parseSites.features : siembraZonas.map(zonaToFeature)}
                  selectedIndices={parseSites ? [...selSites] : siembraZonas.map((_, i) => i)}
                  onSelect={parseSites ? (i) => toggle(selSites, setSelSites, i) : undefined}
                />
              </section>
            )}

            {parseSites && (
              <section className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-stone-50 rounded-xl p-3"><div className="flex items-center gap-1.5 mb-1 text-teal-600"><Layers size={14} /><span className="text-[11px] font-bold text-stone-500">Sitios seleccionados</span></div><p className="text-lg font-black text-stone-900">{selSites.size}</p></div>
                  <div className="bg-stone-50 rounded-xl p-3"><div className="flex items-center gap-1.5 mb-1 text-teal-600"><Layers size={14} /><span className="text-[11px] font-bold text-stone-500">Área total</span></div><p className="text-lg font-black text-stone-900">{fmt(siteArea)} ha</p></div>
                </div>
                <ListaSeleccion parse={parseSites} sel={selSites} setSel={setSelSites} />
                <button onClick={guardarSitios} disabled={guardando || selSites.size === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60">
                  {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                  Guardar {selSites.size} sitio(s) de siembra
                </button>
              </section>
            )}
          </>
        )}
      </div>

      {/* Diálogo de sobreposición */}
      {overlap && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle size={20} className="text-amber-500" /><h3 className="font-black text-stone-900 text-lg">Se sobrepone con lo guardado</h3></div>
            <p className="text-sm text-stone-600 mb-3">Lo que vas a subir se sobrepone con {overlap.lista.length} polígono(s) ya guardado(s):</p>
            <ul className="text-sm text-stone-600 mb-5 space-y-1">
              {overlap.lista.map((z, i) => <li key={i} className="flex justify-between bg-stone-50 rounded-lg px-3 py-1.5"><span>{z.nombre ?? 'Polígono'}</span><span className="text-stone-400">{z.area != null ? `${fmt(Number(z.area))} ha` : ''}</span></li>)}
            </ul>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => guardarPoligono('sobreescribir', overlap.ids)} disabled={guardando} className="py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60">Sobreescribir</button>
              <button onClick={() => guardarPoligono('unir', overlap.ids)} disabled={guardando} className="py-2.5 border-2 border-teal-500 text-teal-700 rounded-xl text-sm font-bold hover:bg-teal-50 transition-colors disabled:opacity-60">Unir</button>
              <button onClick={() => setOverlap(null)} disabled={guardando} className="py-2.5 border border-stone-200 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-50 transition-colors">Cancelar</button>
            </div>
            <p className="text-[11px] text-stone-400 mt-3"><strong>Sobreescribir</strong>: reemplaza el/los anterior(es). <strong>Unir</strong>: los fusiona en uno solo.</p>
          </div>
        </div>
      )}

      {toast && <div className={`fixed bottom-6 right-6 z-[1000] px-4 py-3 rounded-xl shadow-lg text-sm font-bold text-white ${toast.tipo === 'ok' ? 'bg-teal-600' : 'bg-red-500'}`}>{toast.msg}</div>}
    </div>
  )
}
