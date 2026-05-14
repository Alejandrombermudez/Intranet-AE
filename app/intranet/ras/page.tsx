'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Leaf, Trees, ShieldCheck, ChevronRight,
  Loader2, Pencil, ClipboardCheck, CheckCircle2,
} from 'lucide-react'

const PRIMARY = '#0d7377'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SiembraFamilia = {
  id: string
  nombre_propietario: string
  municipio: string
  vereda: string | null
  nombre_finca: string | null
  ha_potreros: number | null
  ha_bosque: number | null
  ha_otras: number | null
  ha_restauracion: number | null
  parcelas_monitoreo: number | null
  plantulas_sembradas: number | null
  especies_sembradas: number | null
  plan_restauracion: string | null
  shapefile_finca_url: string | null
  shapefile_restauracion_url: string | null
}

type RasFamilia = {
  id: string
  nombre_propietario: string
  municipio: string
  vereda: string | null
  nombre_finca: string | null
  ha_potreros: number | null
  ha_bosque: number | null
  ha_otras: number | null
  arboles_semilleros: number | null
  especies_forestales: number | null
  otros_indices: string | null
  shapefile_finca_url: string | null
  shapefile_conservacion_url: string | null
}

// ─── Lógica de campos faltantes ───────────────────────────────────────────────

const SIEMBRA_FIELDS: (keyof SiembraFamilia)[] = [
  'vereda', 'nombre_finca', 'ha_potreros', 'ha_bosque', 'ha_otras',
  'ha_restauracion', 'parcelas_monitoreo', 'plantulas_sembradas',
  'especies_sembradas', 'plan_restauracion',
  'shapefile_finca_url', 'shapefile_restauracion_url',
]

const SIEMBRA_LABELS: Record<string, string> = {
  vereda: 'Vereda', nombre_finca: 'Nombre finca',
  ha_potreros: 'Ha. potreros', ha_bosque: 'Ha. bosque', ha_otras: 'Ha. otras',
  ha_restauracion: 'Ha. restauración', parcelas_monitoreo: 'Parcelas',
  plantulas_sembradas: 'Plántulas', especies_sembradas: 'Especies',
  plan_restauracion: 'Plan restauración',
  shapefile_finca_url: 'SHP finca', shapefile_restauracion_url: 'SHP restauración',
}

const RAS_FIELDS: (keyof RasFamilia)[] = [
  'vereda', 'nombre_finca', 'ha_potreros', 'ha_bosque', 'ha_otras',
  'arboles_semilleros', 'especies_forestales', 'otros_indices',
  'shapefile_finca_url', 'shapefile_conservacion_url',
]

const RAS_LABELS: Record<string, string> = {
  vereda: 'Vereda', nombre_finca: 'Nombre finca',
  ha_potreros: 'Ha. potreros', ha_bosque: 'Ha. bosque', ha_otras: 'Ha. otras',
  arboles_semilleros: 'Árboles semilleros', especies_forestales: 'Especies forestales',
  otros_indices: 'Otros índices',
  shapefile_finca_url: 'SHP finca', shapefile_conservacion_url: 'SHP conservación',
}

function getSiembraMissing(f: SiembraFamilia): string[] {
  return SIEMBRA_FIELDS.filter((k) => {
    const v = f[k]; return v === null || v === undefined || v === ''
  }).map((k) => SIEMBRA_LABELS[k])
}

function getRasMissing(f: RasFamilia): string[] {
  return RAS_FIELDS.filter((k) => {
    const v = f[k]; return v === null || v === undefined || v === ''
  }).map((k) => RAS_LABELS[k])
}

// ─── CompletitudList ──────────────────────────────────────────────────────────

function CompletitudList<T extends { id: string; nombre_propietario: string; municipio: string }>({
  familias,
  getMissing,
  editBase,
}: {
  familias: T[]
  getMissing: (f: T) => string[]
  editBase: string
}) {
  const items = familias
    .map((f) => ({ familia: f, missing: getMissing(f) }))
    .filter(({ missing }) => missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <p className="text-lg font-black text-stone-700">¡Todas las familias están completas!</p>
        <p className="text-sm text-stone-400 max-w-xs">No hay campos faltantes en ningún registro.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(({ familia, missing }) => (
        <div key={familia.id} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-bold text-stone-900 text-sm">{familia.nombre_propietario}</p>
              <p className="text-xs text-stone-400 mt-0.5">{familia.municipio}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {missing.map((field) => (
                  <span key={field}
                    className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    {field}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-red-50 text-red-600">
                {missing.length} {missing.length === 1 ? 'faltante' : 'faltantes'}
              </span>
              <Link href={`${editBase}/${familia.id}/editar`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all"
                style={{ backgroundColor: PRIMARY }}>
                <Pencil size={11} /> Completar
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function RASHubPage() {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [activeTab, setActiveTab] = useState<'modulos' | 'completitud'>('modulos')
  const [subTab, setSubTab] = useState<'restauracion' | 'conservacion'>('restauracion')
  const [loadingComp, setLoadingComp] = useState(false)
  const [siembraFamilias, setSiembraFamilias] = useState<SiembraFamilia[]>([])
  const [rasFamilias, setRasFamilias] = useState<RasFamilia[]>([])
  const [compLoaded, setCompLoaded] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase
        .schema('people').from('user_profiles').select('is_admin, department').eq('email', user.email).single()
      if (!profile?.is_admin && profile?.department !== 'RAS') { router.push('/'); return }
      setAuthReady(true)
    })
  }, [router])

  const handleCompletitudTab = async () => {
    setActiveTab('completitud')
    if (compLoaded) return
    setLoadingComp(true)
    const [{ data: sData }, { data: rData }] = await Promise.all([
      supabase.schema('siembra').from('familias').select(
        'id, nombre_propietario, municipio, vereda, nombre_finca, ha_potreros, ha_bosque, ha_otras, ha_restauracion, parcelas_monitoreo, plantulas_sembradas, especies_sembradas, plan_restauracion, shapefile_finca_url, shapefile_restauracion_url'
      ),
      supabase.schema('ras').from('familias').select(
        'id, nombre_propietario, municipio, vereda, nombre_finca, ha_potreros, ha_bosque, ha_otras, arboles_semilleros, especies_forestales, otros_indices, shapefile_finca_url, shapefile_conservacion_url'
      ),
    ])
    setSiembraFamilias((sData ?? []) as SiembraFamilia[])
    setRasFamilias((rData ?? []) as RasFamilia[])
    setCompLoaded(true)
    setLoadingComp(false)
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 size={36} className="text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">

      {/* ── Header ── */}
      <header className="bg-white shadow-md border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/intranet"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-primary hover:text-primary hover:bg-primary/5 transition-all shrink-0">
              <ArrowLeft size={16} />
              <span className="hidden sm:block">Intranet</span>
            </Link>
            <div className="text-center flex-1">
              <div className="inline-flex items-center gap-2 mb-0.5">
                <Leaf size={20} className="text-primary" />
                <h1 className="text-2xl font-black text-stone-900 tracking-tight">Módulo RAS</h1>
              </div>
              <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">
                Restauración Ambiental y Social
              </p>
            </div>
            <div className="w-[92px]" />
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6">

        {/* Tabs */}
        <div className="flex gap-1 border-b border-stone-200 mb-8">
          <button
            onClick={() => setActiveTab('modulos')}
            className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'modulos'
                ? 'border-primary text-primary'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}>
            <Leaf size={14} /> Módulos
          </button>
          <button
            onClick={handleCompletitudTab}
            className={`flex items-center gap-1.5 pb-3 px-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'completitud'
                ? 'border-primary text-primary'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}>
            <ClipboardCheck size={14} /> Completitud
          </button>
        </div>

        {/* ── Panel Módulos ── */}
        {activeTab === 'modulos' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            <Link href="/intranet/ras/siembra"
              className="group bg-white rounded-2xl border-2 border-stone-200 shadow-md hover:border-primary hover:shadow-xl transition-all p-8 flex flex-col gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: '#0d737715' }}>
                <Trees size={28} style={{ color: PRIMARY }} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-black text-stone-900 mb-1">Restauración / Siembra</h2>
                <p className="text-sm text-stone-500 leading-relaxed">
                  Familias vinculadas a procesos de restauración activa: siembra de plántulas, monitoreos de supervivencia y cámaras trampa.
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm font-bold transition-colors text-stone-400 group-hover:text-primary">
                Ver familias <ChevronRight size={15} />
              </div>
            </Link>

            <Link href="/intranet/ras/conservacion"
              className="group bg-white rounded-2xl border-2 border-stone-200 shadow-md hover:border-primary hover:shadow-xl transition-all p-8 flex flex-col gap-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: '#0d737715' }}>
                <ShieldCheck size={28} style={{ color: PRIMARY }} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-black text-stone-900 mb-1">Conservación</h2>
                <p className="text-sm text-stone-500 leading-relaxed">
                  Familias bajo acuerdos y figuras de conservación: polígonos protegidos, árboles semilleros, especies nativas y cámaras trampa.
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm font-bold transition-colors text-stone-400 group-hover:text-primary">
                Ver familias <ChevronRight size={15} />
              </div>
            </Link>

          </div>
        )}

        {/* ── Panel Completitud ── */}
        {activeTab === 'completitud' && (
          <div>
            {/* Sub-tabs */}
            <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit mb-6">
              {(['restauracion', 'conservacion'] as const).map((tab) => (
                <button key={tab} onClick={() => setSubTab(tab)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    subTab === tab
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}>
                  {tab === 'restauracion' ? 'Restauración' : 'Conservación'}
                </button>
              ))}
            </div>

            {loadingComp ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={32} className="animate-spin" style={{ color: PRIMARY }} />
              </div>
            ) : subTab === 'restauracion' ? (
              <CompletitudList
                familias={siembraFamilias}
                getMissing={getSiembraMissing}
                editBase="/intranet/ras/siembra"
              />
            ) : (
              <CompletitudList
                familias={rasFamilias}
                getMissing={getRasMissing}
                editBase="/intranet/ras/conservacion"
              />
            )}
          </div>
        )}

      </main>

      <footer className="max-w-4xl mx-auto px-4 py-8 sm:px-6 text-center text-stone-500 text-sm">
        <p className="font-semibold">© {new Date().getFullYear()} Amazonia Emprende — Todos los derechos reservados</p>
      </footer>
    </div>
  )
}
