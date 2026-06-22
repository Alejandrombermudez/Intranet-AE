'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { parsearShapefile, perimetroGeom, type ShapefileParseado } from '@/lib/shapefile-client'
import type { Feature } from 'geojson'
import {
  Map as MapIcon, ArrowLeft, Loader2, Upload, FileUp, Save, AlertCircle,
  CheckCircle2, Ruler, Layers, ExternalLink,
} from 'lucide-react'

const MapaZonas = dynamic(() => import('@/app/components/MapaZonas'), {
  ssr: false,
  loading: () => <div className="w-full h-80 rounded-xl border border-stone-200 bg-stone-100 flex items-center justify-center"><Loader2 className="animate-spin text-stone-400" size={28} /></div>,
})

const fmt = (n: number, d = 2) => n.toLocaleString('es-CO', { maximumFractionDigits: d, minimumFractionDigits: d })

interface CasoInfo {
  nombre_predio?: string | null
  nombre_completo?: string
  municipio?: string
  vereda?: string | null
  expediente_id?: string | null
}

interface ZonaGuardada {
  id: string; nombre: string | null; tipo: string; estado: string
  area_ha: number | null; perimetro_m: number | null
  propiedades: Record<string, unknown> | null; geojson: string
}

export default function SigPredioPage() {
  const router = useRouter()
  const { predioId } = useParams<{ predioId: string }>()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [caso, setCaso] = useState<CasoInfo | null>(null)
  const [zonas, setZonas] = useState<ZonaGuardada[]>([])
  const [loading, setLoading] = useState(true)

  const [parsed, setParsed] = useState<ShapefileParseado | null>(null)
  const [parseando, setParseando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)

  const showToast = (tipo: 'ok' | 'error', msg: string) => { setToast({ tipo, msg }); setTimeout(() => setToast(null), 3500) }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: p } = await supabase.schema('people').from('user_profiles')
        .select('is_admin, department, can_access_intranet').eq('email', user.email).single()
      if (!p?.is_admin && !p?.can_access_intranet && !p?.department) { router.push('/'); return }
      setUserEmail(user.email ?? null)
      setAuthReady(true)
    })
  }, [router])

  const cargarZonas = useCallback(async (email: string) => {
    const r = await fetch(`/api/sig/zonas?predio_id=${predioId}&email=${encodeURIComponent(email)}`)
    const d = await r.json()
    setZonas(Array.isArray(d) ? d : [])
  }, [predioId])

  useEffect(() => {
    if (!authReady || !userEmail || !predioId) return
    Promise.all([
      fetch(`/api/juridica/aliados/${predioId}?email=${encodeURIComponent(userEmail)}`).then((r) => r.ok ? r.json() : null),
      cargarZonas(userEmail),
    ]).then(([c]) => { setCaso(c); setLoading(false) }).catch(() => setLoading(false))
  }, [authReady, userEmail, predioId, cargarZonas])

  async function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setParsed(null); setParseando(true)
    try {
      const res = await parsearShapefile(file)
      setParsed(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer el shapefile')
    } finally {
      setParseando(false)
    }
  }

  async function guardar() {
    if (!parsed || !userEmail) return
    setGuardando(true)
    try {
      const features = parsed.features.map((f) => ({
        geometry: f.geometry,
        properties: f.properties ?? {},
        perimetro_m: perimetroGeom(f.geometry),
      }))
      const res = await fetch('/api/sig/ingesta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predio_id: predioId,
          expediente_id: caso?.expediente_id ?? null,
          email: userEmail, tipo: 'restauracion', estado: 'potencial', features,
        }),
      })
      const body = await res.json()
      if (!res.ok) { showToast('error', body.error ?? 'Error al guardar'); return }
      showToast('ok', `${body.creadas} zona(s) guardada(s) en PostGIS`)
      setParsed(null)
      await cargarZonas(userEmail)
    } finally {
      setGuardando(false)
    }
  }

  // Features para el mapa: la previsualización si hay; si no, lo guardado
  const featuresMapa: Feature[] = parsed
    ? parsed.features
    : zonas.map((z) => ({ type: 'Feature', geometry: JSON.parse(z.geojson), properties: z.propiedades ?? {} } as Feature))

  if (!authReady || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-stone-50"><Loader2 className="animate-spin text-stone-400" size={32} /></div>
  }

  const m = parsed?.metrics

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/intranet/sig" className="text-stone-400 hover:text-stone-700 transition-colors"><ArrowLeft size={20} /></Link>
          <MapIcon size={18} className="text-teal-600" />
          <div className="min-w-0">
            <h1 className="text-lg font-black text-stone-900 truncate">
              SIG I · {caso?.nombre_predio ?? 'Predio'}
            </h1>
            <p className="text-xs text-stone-400 truncate">
              {caso?.nombre_completo} · {caso?.municipio}{caso?.vereda ? ` / ${caso.vereda}` : ''}
            </p>
          </div>
          {caso && (
            <Link href={`/intranet/juridica/${predioId}`} className="ml-auto shrink-0 flex items-center gap-1 text-xs font-bold text-stone-400 hover:text-teal-600 transition-colors">
              Ver caso jurídico <ExternalLink size={12} />
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
        {/* Subir shapefile */}
        <section className="bg-white rounded-2xl border border-stone-100 p-5">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider mb-3">Cargar shapefile (.zip)</h2>
          <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-stone-200 rounded-xl cursor-pointer hover:border-teal-400 transition-colors text-sm text-stone-500">
            {parseando ? <Loader2 size={18} className="animate-spin text-teal-500" /> : <FileUp size={18} className="text-stone-400" />}
            <span>{parseando ? 'Leyendo el shapefile…' : 'Selecciona el .zip (shp, dbf, prj, shx)'}</span>
            <input type="file" accept=".zip,application/zip" className="hidden" disabled={parseando} onChange={onArchivo} />
          </label>
          {error && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {parsed && (
            <div className="mt-3 flex items-center gap-2 text-xs text-stone-500">
              {parsed.reproyectado
                ? <><CheckCircle2 size={14} className="text-teal-500" /> Reproyectado a EPSG:4326 desde el .prj</>
                : <><CheckCircle2 size={14} className="text-teal-500" /> Coordenadas ya en EPSG:4326</>}
            </div>
          )}
        </section>

        {/* Métricas (previsualización) */}
        {m && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Zonas', value: String(m.numZonas), icon: <Layers size={15} /> },
              { label: 'Área', value: `${fmt(m.areaHa)} ha`, icon: <Layers size={15} /> },
              { label: 'Área', value: `${fmt(m.areaKm2, 4)} km²`, icon: <Layers size={15} /> },
              { label: 'Perímetro', value: `${fmt(m.perimetroKm, 3)} km`, icon: <Ruler size={15} /> },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-xl border border-stone-100 p-4">
                <div className="flex items-center gap-1.5 mb-1 text-teal-600">{c.icon}<span className="text-[11px] font-bold text-stone-500">{c.label}</span></div>
                <p className="text-xl font-black text-stone-900">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mapa */}
        {featuresMapa.length > 0 && (
          <section className="bg-white rounded-2xl border border-stone-100 p-5">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider mb-3">
              {parsed ? 'Previsualización' : 'Zonas guardadas'}
            </h2>
            <MapaZonas features={featuresMapa} />
          </section>
        )}

        {/* Tabla de atributos (verificación de lectura) */}
        {parsed && parsed.columnas.length > 0 && (
          <section className="bg-white rounded-2xl border border-stone-100 p-5">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider mb-1">Atributos leídos</h2>
            <p className="text-xs text-stone-400 mb-3">{parsed.features.length} registro(s) · {parsed.columnas.length} columna(s)</p>
            <div className="overflow-x-auto border border-stone-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    <th className="px-3 py-2 font-bold text-stone-400">#</th>
                    {parsed.columnas.map((c) => <th key={c} className="px-3 py-2 font-bold text-stone-500 whitespace-nowrap">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {parsed.features.slice(0, 50).map((f, i) => (
                    <tr key={i} className="border-b border-stone-50 last:border-0">
                      <td className="px-3 py-2 text-stone-400">{i + 1}</td>
                      {parsed.columnas.map((c) => {
                        const v = (f.properties ?? {})[c]
                        return <td key={c} className="px-3 py-2 text-stone-700 whitespace-nowrap">{v == null ? <span className="text-stone-300">—</span> : String(v)}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.features.length > 50 && <p className="text-xs text-stone-400 mt-2">Mostrando 50 de {parsed.features.length}.</p>}

            <button onClick={guardar} disabled={guardando}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-60">
              {guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Guardar {parsed.features.length} zona(s) en PostGIS
            </button>
          </section>
        )}

        {/* Zonas guardadas (resumen) */}
        {!parsed && zonas.length > 0 && (
          <section className="bg-white rounded-2xl border border-stone-100 p-5">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider mb-3">Zonas guardadas ({zonas.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-100">
                    {['Nombre', 'Tipo', 'Estado', 'Área (ha)', 'Perímetro (km)'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-[11px] font-bold text-stone-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {zonas.map((z) => (
                    <tr key={z.id} className="border-b border-stone-50 last:border-0">
                      <td className="px-4 py-2.5 text-stone-700">{z.nombre ?? <span className="text-stone-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-stone-600">{z.tipo}</td>
                      <td className="px-4 py-2.5"><span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">{z.estado}</span></td>
                      <td className="px-4 py-2.5 text-stone-700">{z.area_ha != null ? fmt(Number(z.area_ha)) : '—'}</td>
                      <td className="px-4 py-2.5 text-stone-700">{z.perimetro_m != null ? fmt(Number(z.perimetro_m) / 1000, 3) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!parsed && zonas.length === 0 && (
          <div className="text-center py-12 text-stone-400">
            <Upload size={36} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">Aún no hay zonas cargadas para este predio</p>
            <p className="text-sm mt-1">Sube el shapefile del SIG para generar las zonas potenciales.</p>
          </div>
        )}
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[1000] px-4 py-3 rounded-xl shadow-lg text-sm font-bold text-white ${toast.tipo === 'ok' ? 'bg-teal-600' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
