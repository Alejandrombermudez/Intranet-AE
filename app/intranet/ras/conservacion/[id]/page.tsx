'use client'
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Loader2, ShieldCheck, Users, MapPin,
  Camera, FileArchive, Leaf, ExternalLink,
  CheckCircle2, XCircle, ChevronDown, Pencil, FileText, Image as ImageIcon,
  TreePine, BarChart3, MapPinned, AlertTriangle,
} from 'lucide-react'
import {
  fetchArbolesPorFamilia, fetchIndicadoresPorFamilia, cambiarFotoArbol,
  type ArbolSemillero, type IndicadoresPredio,
} from '@/lib/ras-arboles'
import { fetchEspecies, fotoAleatoriaCatalogo, type Especie } from '@/lib/catalogo'
import { parsearShapefileDesdeUrl } from '@/lib/shapefile-client'
import { EspecieInfoBlock } from '@/app/components/EspecieInfo'
import type { Feature } from 'geojson'

const MapaArboles = dynamic(() => import('@/app/components/MapaArboles'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-center text-stone-400 text-sm">
      Cargando mapa…
    </div>
  ),
})

const PRIMARY = '#0d7377'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Familia {
  id: string
  municipio: string
  vereda: string | null
  nombre_finca: string | null
  nombre_propietario: string
  adultos: number
  ninos: number
  tipo_documento: string | null
  numero_documento: string | null
  telefono: string | null
  nucleo: string | null
  departamento: string | null
  cant_mujeres: number | null
  cant_hombres: number | null
  actividad_economica: string | null
  tiene_espacio_vegetal: boolean | null
  empleos_locales: number | null
  num_individuos: number | null
  num_especies_inventario: number | null
  area_bosque_recorrida: number | null
  distancia_florencia_km: number | null
  tiempo_florencia_min: number | null
  ha_potreros: number | null
  ha_bosque: number | null
  ha_otras: number | null
  bajo_conservacion: boolean
  acuerdo_conservacion: boolean
  arboles_semilleros: number | null
  especies_forestales: number | null
  otros_indices: string | null
  shapefile_finca_url: string | null
  shapefile_conservacion_url: string | null
  documento_acuerdo_url: string | null
  created_by: string | null
  created_at: string
}

interface FotoPredio { id: string; url: string; categoria: string }
interface Foto { id: string; url: string }
interface Camara {
  id: string
  nombre: string
  latitud: number
  longitud: number
  fotos: Foto[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-stone-50 rounded-xl p-4">
      <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-bold text-stone-800">{value ?? <span className="text-stone-300 font-normal">—</span>}</p>
    </div>
  )
}

function BoolStat({ label, value }: { label: string; value: boolean }) {
  return (
    <div className="bg-stone-50 rounded-xl p-4">
      <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">{label}</p>
      {value
        ? <span className="flex items-center gap-1 text-sm font-bold text-emerald-600"><CheckCircle2 size={13} />Sí</span>
        : <span className="flex items-center gap-1 text-sm font-bold text-stone-400"><XCircle size={13} />No</span>
      }
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span style={{ color: PRIMARY }}>{icon}</span>
      <h2 className="text-base font-black text-stone-900">{title}</h2>
    </div>
  )
}

/** Compresión en cliente (Canvas) antes de subir — misma calidad que el catálogo. */
async function compressImage(file: File, maxW = 1400, q = 0.85): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file),
        'image/jpeg', q,
      )
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

/** Imagen con lista de fuentes: intenta cada una en orden y cae a la siguiente si falla. */
function FotoConFallback({ fuentes, alt, className }: { fuentes: (string | null | undefined)[]; alt: string; className?: string }) {
  const lista = fuentes.filter((s): s is string => !!s)
  const [idx, setIdx] = useState(0)
  if (lista.length === 0 || idx >= lista.length) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={lista[idx]} alt={alt} className={className} onError={() => setIdx((i) => i + 1)} />
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ConservacionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [familia, setFamilia] = useState<Familia | null>(null)
  const [camaras, setCamaras] = useState<Camara[]>([])
  const [fotosPredioCat, setFotosPredioCat] = useState<Record<string, FotoPredio[]>>({})
  const [otrosVisible, setOtrosVisible] = useState(false)
  const [arboles, setArboles] = useState<ArbolSemillero[]>([])
  const [indic, setIndic] = useState<IndicadoresPredio | null>(null)
  const [arbolesOpen, setArbolesOpen] = useState(false)
  const [especiesMap, setEspeciesMap] = useState<Map<string, Especie>>(new Map())
  const [poligonoFinca, setPoligonoFinca] = useState<Feature[] | null>(null)
  const [poligonoConservacion, setPoligonoConservacion] = useState<Feature[] | null>(null)
  const [selectedArbolId, setSelectedArbolId] = useState<string | null>(null)
  const [uploadingArbol, setUploadingArbol] = useState(false)
  const fotoArbolFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      // Auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase
        .schema('people').from('user_profiles').select('is_admin, department').eq('email', user.email).single()
      if (!profile?.is_admin && profile?.department !== 'RAS') { router.push('/'); return }

      // Familia
      const { data: fam, error: famErr } = await supabase
        .schema('ras').from('familias').select('*').eq('id', id).single()
      if (famErr || !fam) { router.push('/intranet/ras/conservacion'); return }
      setFamilia(fam)

      // Polígonos del predio para el mapa — no bloqueante (el mapa se puede ver sin ellos)
      if (fam.shapefile_finca_url) {
        parsearShapefileDesdeUrl(fam.shapefile_finca_url)
          .then((r) => setPoligonoFinca(r.features))
          .catch((e) => console.warn('[conservacion] shapefile finca:', e))
      }
      if (fam.shapefile_conservacion_url) {
        parsearShapefileDesdeUrl(fam.shapefile_conservacion_url)
          .then((r) => setPoligonoConservacion(r.features))
          .catch((e) => console.warn('[conservacion] shapefile conservación:', e))
      }

      // Cámaras trampa + fotos
      const { data: cams } = await supabase
        .schema('ras').from('camaras_trampa')
        .select('id, nombre, latitud, longitud')
        .eq('familia_id', id)
      const camarasConFotos: Camara[] = []
      for (const cam of (cams ?? [])) {
        const { data: fotos } = await supabase
          .schema('ras').from('fotos_camara')
          .select('id, url').eq('camara_id', cam.id)
        camarasConFotos.push({ ...cam, fotos: fotos ?? [] })
      }
      setCamaras(camarasConFotos)

      // Fotos de predio por categoría
      const { data: fpData } = await supabase
        .schema('ras').from('fotos_predio')
        .select('id, url, categoria').eq('familia_id', id)
      const fpByCat: Record<string, FotoPredio[]> = {}
      for (const fp of (fpData ?? [])) {
        if (!fpByCat[fp.categoria]) fpByCat[fp.categoria] = []
        fpByCat[fp.categoria].push(fp)
      }
      setFotosPredioCat(fpByCat)

      // Red de árboles semilleros + indicadores + catálogo (para la ficha de especie del panel)
      const [arbs, ind, especies] = await Promise.all([
        fetchArbolesPorFamilia(id),
        fetchIndicadoresPorFamilia(id),
        fetchEspecies(),
      ])
      setArboles(arbs)
      setIndic(ind)
      setEspeciesMap(new Map(especies.map((e) => [e.id, e])))

      setLoading(false)
    }
    init()
  }, [id, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 size={36} className="animate-spin" style={{ color: PRIMARY }} />
      </div>
    )
  }

  if (!familia) return null

  const nArboles = indic?.arboles_semilleros ?? arboles.length
  const nEspecies = indic?.especies_forestales ?? new Set(arboles.map((a) => a.nombre_cientifico).filter(Boolean)).size
  const conCoord = indic?.con_coordenada ?? arboles.filter((a) => a.latitud != null && a.longitud != null).length
  const arbolSel = arboles.find((a) => a.id === selectedArbolId) ?? null
  const especieSel = arbolSel?.especie_id ? especiesMap.get(arbolSel.especie_id) : undefined
  const fotoFamilia = fotosPredioCat['familia']?.[0]?.url ?? fotosPredioCat['predio']?.[0]?.url
    ?? fotoAleatoriaCatalogo(Array.from(especiesMap.values()), id)
  const fotoFamiliaEsReal = !!(fotosPredioCat['familia']?.[0]?.url ?? fotosPredioCat['predio']?.[0]?.url)
  // Foto propia del árbol solo si ya está en Supabase; las viejas de Kobo (privadas) se ignoran y se usa la foto de la especie.
  const fotoArbolPropia = arbolSel?.foto_url?.includes('supabase.co') ? arbolSel.foto_url : null

  async function onPickFotoArbol(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !arbolSel) return
    setUploadingArbol(true)
    const comp = await compressImage(file)
    const url = await cambiarFotoArbol(arbolSel.id, comp)
    setUploadingArbol(false)
    if (url) setArboles((prev) => prev.map((a) => (a.id === arbolSel.id ? { ...a, foto_url: url } : a)))
    if (fotoArbolFileRef.current) fotoArbolFileRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">

      {/* Header */}
      <header className="relative border-b border-stone-200 shadow-md overflow-hidden">
        {fotoFamilia ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fotoFamilia} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
          </>
        ) : (
          <div className="absolute inset-0 bg-white" />
        )}
        <div className={`relative w-full lg:w-[85%] max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-0 ${fotoFamilia ? 'py-10 sm:py-16' : 'py-5'}`}>
          <div className="flex items-center justify-between gap-4">
            <Link href="/intranet/ras/conservacion"
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-bold text-sm transition-all shrink-0 ${
                fotoFamilia
                  ? 'border-white/40 text-white hover:bg-white/15'
                  : 'border-stone-200 text-stone-600 hover:border-primary hover:text-primary hover:bg-primary/5'
              }`}>
              <ArrowLeft size={16} />
              <span className="hidden sm:block">Conservación</span>
            </Link>
            <div className="text-center flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 max-w-full">
                <ShieldCheck size={18} style={{ color: fotoFamilia ? '#fff' : PRIMARY }} />
                <h1 className={`text-xl font-black truncate max-w-xs ${fotoFamilia ? 'text-white drop-shadow' : 'text-stone-900'}`}>
                  {familia.nombre_propietario}
                </h1>
              </div>
              {familia.nombre_finca && (
                <p className={`text-xs mt-0.5 truncate ${fotoFamilia ? 'text-white/85' : 'text-stone-500'}`}>{familia.nombre_finca}</p>
              )}
              {fotoFamilia && !fotoFamiliaEsReal && (
                <p className="text-[10px] mt-1 text-white/60">Foto de muestra del catálogo — aún sin foto propia</p>
              )}
            </div>
            <Link href={`/intranet/ras/conservacion/${id}/editar`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0 shadow-sm hover:shadow-md transition-all"
              style={{ backgroundColor: PRIMARY }}>
              <Pencil size={15} />
              <span className="hidden sm:block">Editar</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="w-full lg:w-[85%] max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-0 space-y-8">

        {/* ── Mapa de la Red de Árboles Semilleros + ficha del árbol seleccionado ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <SectionTitle icon={<TreePine size={16} />} title="Red de Árboles Semilleros" />

          {arboles.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-6">
              Aún no hay árboles semilleros cargados para este predio.
            </p>
          ) : conCoord === 0 ? (
            <p className="text-sm text-stone-400 text-center py-6">
              Ninguno de los {nArboles.toLocaleString('es-CO')} árboles tiene coordenada todavía — pendiente de GPS.
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
              <div className="lg:col-span-3 lg:sticky lg:top-6">
                <MapaArboles
                  arboles={arboles}
                  poligonos={{ finca: poligonoFinca, conservacion: poligonoConservacion }}
                  selectedId={selectedArbolId}
                  onSelectArbol={setSelectedArbolId}
                  className="w-full h-80 lg:h-[560px] rounded-xl overflow-hidden border border-stone-200 z-0"
                />
              </div>

              <div className="lg:col-span-2">
                {/* Lista de árboles — tamaño fijo (scroll interno), para seleccionar sin
                    depender de los puntos del mapa cuando quedan superpuestos. */}
                <div className="mb-3">
                  <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2 px-1">
                    Lista de árboles ({arboles.length})
                  </p>
                  <div className="h-60 overflow-y-auto rounded-xl border border-stone-200 divide-y divide-stone-100">
                    {arboles.map((a) => {
                      const seleccionado = a.id === selectedArbolId
                      const sinCoord = a.latitud == null || a.longitud == null
                      return (
                        <button key={a.id} type="button" onClick={() => setSelectedArbolId(a.id)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs border-l-2 transition-colors ${
                            seleccionado ? 'bg-amber-50 border-l-amber-500' : 'border-l-transparent hover:bg-stone-50'
                          }`}>
                          <span className="min-w-0 truncate">
                            <span className="font-bold text-stone-700">#{a.codigo}</span>{' '}
                            <span className="text-stone-500 italic">{a.nombre_comun || a.nombre_cientifico || 'Sin determinar'}</span>
                          </span>
                          {sinCoord && <span className="text-[9px] font-bold text-stone-400 shrink-0">sin GPS</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {!arbolSel ? (
                  <div className="flex flex-col items-center justify-center text-center py-8 px-4 bg-stone-50 rounded-xl border border-stone-200">
                    <MapPinned size={28} className="text-stone-300 mb-2" />
                    <p className="text-sm text-stone-400">Selecciona un árbol en el mapa o en la lista para ver su ficha.</p>
                  </div>
                ) : (
                  <div className="border border-stone-200 rounded-xl overflow-hidden">
                    {especieSel ? (
                      <EspecieInfoBlock especie={especieSel} />
                    ) : (
                      <div className="p-4 bg-amber-50 text-amber-700 text-sm flex items-start gap-2">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <span>Especie sin determinar{arbolSel.especie_pendiente ? `: ${arbolSel.especie_pendiente}` : ''}.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Datos propios del árbol — ancho completo, debajo de mapa+ficha, para no quedar
              embutidos en la columna angosta del panel ni dejar espacio muerto bajo el mapa. */}
          {arbolSel && (
            <div className="mt-5 pt-5 border-t border-stone-100">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-3">
                Datos de este árbol · #{arbolSel.codigo}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4">
                <div>
                  <FotoConFallback
                    key={arbolSel.id}
                    fuentes={[fotoArbolPropia, especieSel?.foto_url]}
                    alt={`Árbol #${arbolSel.codigo}`}
                    className="w-full h-40 sm:h-full object-cover rounded-lg"
                  />
                  {!fotoArbolPropia && especieSel?.foto_url && (
                    <p className="text-[10px] text-stone-400 mt-1">Foto de la especie — sin foto propia aún.</p>
                  )}
                  <input ref={fotoArbolFileRef} type="file" accept="image/*" className="hidden" onChange={onPickFotoArbol} />
                  <button type="button" onClick={() => fotoArbolFileRef.current?.click()} disabled={uploadingArbol}
                    className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-stone-200 text-stone-600 text-xs font-bold hover:border-primary hover:text-primary transition-all disabled:opacity-50">
                    {uploadingArbol
                      ? <><Loader2 size={13} className="animate-spin" /> Subiendo…</>
                      : <><Camera size={13} /> {fotoArbolPropia ? 'Cambiar foto del árbol' : 'Subir foto del árbol'}</>}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 content-start">
                  <Stat label="DAP" value={arbolSel.dap_cm != null ? `${arbolSel.dap_cm} cm` : null} />
                  <Stat label="Altura" value={arbolSel.altura_total_m != null ? `${arbolSel.altura_total_m} m` : null} />
                  <Stat label="Área basal" value={arbolSel.ab_m2 != null ? `${arbolSel.ab_m2} m²` : null} />
                  <Stat label="Clase de copa" value={arbolSel.clase_copa} />
                  {arbolSel.especies_asociadas && <Stat label="Especies asociadas" value={arbolSel.especies_asociadas} />}
                  {arbolSel.fecha_registro && <Stat label="Fecha de registro" value={formatDate(arbolSel.fecha_registro)} />}
                  <Stat label="Verificación" value={arbolSel.estado_verificacion} />
                  {arbolSel.latitud != null && arbolSel.longitud != null && (
                    <Stat label="Coordenadas" value={`${arbolSel.latitud.toFixed(5)}, ${arbolSel.longitud.toFixed(5)}`} />
                  )}
                  {arbolSel.codigo_dron && <Stat label="Código dron" value={arbolSel.codigo_dron} />}
                  {arbolSel.ruta_dron && <Stat label="Ruta dron" value={arbolSel.ruta_dron} />}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Identificación y Contacto ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <SectionTitle icon={<Users size={16} />} title="Identificación y Contacto" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Stat label="Propietario" value={familia.nombre_propietario} />
            {familia.tipo_documento && <Stat label="Tipo documento" value={familia.tipo_documento} />}
            {familia.numero_documento && <Stat label="Número documento" value={familia.numero_documento} />}
            {familia.telefono && <Stat label="Teléfono" value={familia.telefono} />}
            {familia.nucleo && <Stat label="Núcleo" value={familia.nucleo} />}
            {familia.departamento && <Stat label="Departamento" value={familia.departamento} />}
            <Stat label="Municipio" value={familia.municipio} />
            {familia.vereda && <Stat label="Vereda" value={familia.vereda} />}
            {familia.nombre_finca && <Stat label="Finca" value={familia.nombre_finca} />}
            <Stat label="Registrado" value={formatDate(familia.created_at)} />
            {familia.created_by && <Stat label="Por" value={familia.created_by} />}
          </div>
        </section>

        {/* ── Composición del Hogar y Economía ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <SectionTitle icon={<Users size={16} />} title="Composición del Hogar y Economía" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Adultos" value={familia.adultos} />
            <Stat label="Niños" value={familia.ninos} />
            {familia.cant_mujeres != null && <Stat label="Mujeres" value={familia.cant_mujeres} />}
            {familia.cant_hombres != null && <Stat label="Hombres" value={familia.cant_hombres} />}
            {familia.actividad_economica && <Stat label="Actividad económica" value={familia.actividad_economica} />}
            {familia.empleos_locales != null && <Stat label="Empleos locales" value={familia.empleos_locales} />}
            {familia.tiene_espacio_vegetal != null && (
              <BoolStat label="Espacio material vegetal" value={familia.tiene_espacio_vegetal} />
            )}
          </div>
        </section>

        {/* ── Predio, Inventario y Accesibilidad ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <SectionTitle icon={<MapPin size={16} />} title="Predio, Inventario y Accesibilidad" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Stat label="Potreros" value={familia.ha_potreros != null ? `${familia.ha_potreros} ha` : null} />
            <Stat label="Bosque" value={familia.ha_bosque != null ? `${familia.ha_bosque} ha` : null} />
            <Stat label="Otras" value={familia.ha_otras != null ? `${familia.ha_otras} ha` : null} />
            <BoolStat label="Bajo figura de conservación" value={familia.bajo_conservacion} />
            <BoolStat label="Acuerdo de conservación" value={familia.acuerdo_conservacion} />
            {familia.num_individuos != null && <Stat label="Individuos (inventario)" value={familia.num_individuos.toLocaleString('es-CO')} />}
            {familia.num_especies_inventario != null && <Stat label="Especies identificadas" value={familia.num_especies_inventario} />}
            {familia.area_bosque_recorrida != null && <Stat label="Área bosque recorrida" value={`${familia.area_bosque_recorrida} ha`} />}
            {familia.distancia_florencia_km != null && <Stat label="Distancia Florencia" value={`${familia.distancia_florencia_km} km`} />}
            {familia.tiempo_florencia_min != null && <Stat label="Tiempo Florencia" value={`${familia.tiempo_florencia_min} min`} />}
          </div>
        </section>

        {/* ── Plan de Conservación ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <SectionTitle icon={<ShieldCheck size={16} />} title="Plan de Conservación" />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Árboles semilleros conservados"
              value={familia.arboles_semilleros != null ? familia.arboles_semilleros.toLocaleString('es-CO') : null} />
            <Stat label="Especies forestales nativas"
              value={familia.especies_forestales != null ? familia.especies_forestales.toLocaleString('es-CO') : null} />
          </div>
        </section>

        {/* ── Indicadores del Predio ── */}
        {arboles.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <SectionTitle icon={<BarChart3 size={16} />} title="Indicadores del Predio" />

            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">Diversidad</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <Stat label="Árboles semilleros" value={nArboles.toLocaleString('es-CO')} />
              <Stat label="Especies forestales" value={nEspecies} />
              {indic?.familias != null && <Stat label="Familias botánicas" value={indic.familias} />}
              {indic?.generos != null && <Stat label="Géneros" value={indic.generos} />}
              {indic?.shannon_h != null && <Stat label="Shannon (H')" value={indic.shannon_h} />}
              {indic?.simpson_1d != null && <Stat label="Simpson (1−D)" value={indic.simpson_1d} />}
              {indic?.pielou_j != null && <Stat label="Pielou (J')" value={indic.pielou_j} />}
              {indic?.margalef != null && <Stat label="Margalef" value={indic.margalef} />}
            </div>

            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">Estructura</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {indic?.area_basal_m2 != null && <Stat label="Área basal" value={`${indic.area_basal_m2} m²`} />}
              {indic?.dap_medio_cm != null && <Stat label="DAP medio" value={`${indic.dap_medio_cm} cm`} />}
              {indic?.arboles_grandes_dap50 != null && <Stat label="Árboles grandes (DAP≥50)" value={indic.arboles_grandes_dap50} />}
              {indic?.densidad_arb_ha != null && <Stat label="Densidad" value={`${indic.densidad_arb_ha} árb/ha`} />}
              <Stat label="Con coordenada" value={`${conCoord} / ${nArboles}`} />
            </div>

            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">Composición ecológica y amenaza</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {indic?.esp_amenazadas != null && <Stat label="Especies amenazadas" value={indic.esp_amenazadas} />}
              {indic?.arb_amenazados != null && <Stat label="Árboles amenazados" value={indic.arb_amenazados} />}
              {indic?.pioneras != null && <Stat label="Pioneras" value={indic.pioneras} />}
              {indic?.intermedias != null && <Stat label="Intermedias" value={indic.intermedias} />}
              {indic?.tardias != null && <Stat label="Tardías" value={indic.tardias} />}
              {indic?.zoocoria != null && <Stat label="Zoocoria" value={indic.zoocoria} />}
              {indic?.anemocoria != null && <Stat label="Anemocoria" value={indic.anemocoria} />}
              {indic?.autocoria != null && <Stat label="Autocoria" value={indic.autocoria} />}
              {indic?.barocoria != null && <Stat label="Barocoria" value={indic.barocoria} />}
            </div>
          </section>
        )}

        {/* ── Listado de árboles (colapsable) ── */}
        {arboles.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <button type="button"
              onClick={() => setArbolesOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors">
              <span className="flex items-center gap-2 text-sm font-black text-stone-700">
                <TreePine size={15} style={{ color: PRIMARY }} /> Listado de árboles ({arboles.length})
              </span>
              <ChevronDown size={16} className={`text-stone-400 transition-transform ${arbolesOpen ? 'rotate-180' : ''}`} />
            </button>
            {arbolesOpen && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider border-b border-stone-200">
                      <th className="py-2 pr-3">Código</th>
                      <th className="py-2 pr-3">Nombre común</th>
                      <th className="py-2 pr-3">Nombre científico</th>
                      <th className="py-2 pr-3">Familia</th>
                      <th className="py-2 pr-3 text-right">DAP (cm)</th>
                      <th className="py-2 pr-3 text-right">Altura (m)</th>
                      <th className="py-2 pr-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arboles.map((a) => (
                      <tr key={a.id} className="border-b border-stone-100 hover:bg-stone-50">
                        <td className="py-2 pr-3 font-bold text-stone-700">{a.codigo}</td>
                        <td className="py-2 pr-3 text-stone-700">{a.nombre_comun || '—'}</td>
                        <td className="py-2 pr-3 italic text-stone-500">{a.nombre_cientifico || 'Sin determinar'}</td>
                        <td className="py-2 pr-3 text-stone-500">{a.familia_botanica || '—'}</td>
                        <td className="py-2 pr-3 text-right text-stone-600">{a.dap_cm ?? '—'}</td>
                        <td className="py-2 pr-3 text-right text-stone-600">{a.altura_total_m ?? '—'}</td>
                        <td className="py-2 pr-3">
                          <span className={a.latitud != null ? 'text-emerald-600' : 'text-stone-400'}>
                            {a.latitud != null ? 'georreferenciado' : 'sin GPS'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ── Archivos Espaciales ── */}
        {(familia.shapefile_finca_url || familia.shapefile_conservacion_url || familia.documento_acuerdo_url) && (
          <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <SectionTitle icon={<FileArchive size={16} />} title="Archivos Espaciales y Documentos" />
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              {familia.shapefile_finca_url && (
                <a href={familia.shapefile_finca_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-stone-200 text-stone-700 font-bold text-sm hover:border-primary hover:text-primary transition-all">
                  <FileArchive size={16} /> Polígono finca <ExternalLink size={12} className="ml-auto text-stone-400" />
                </a>
              )}
              {familia.shapefile_conservacion_url && (
                <a href={familia.shapefile_conservacion_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-stone-200 text-stone-700 font-bold text-sm hover:border-primary hover:text-primary transition-all">
                  <FileArchive size={16} /> Polígono conservación <ExternalLink size={12} className="ml-auto text-stone-400" />
                </a>
              )}
              {familia.documento_acuerdo_url && (
                <a href={familia.documento_acuerdo_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-emerald-200 text-emerald-700 font-bold text-sm hover:border-emerald-400 transition-all">
                  <FileText size={16} /> Acuerdo / Tratamiento datos <ExternalLink size={12} className="ml-auto text-emerald-400" />
                </a>
              )}
            </div>
          </section>
        )}

        {/* ── Fotos del Predio ── */}
        {Object.keys(fotosPredioCat).length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <SectionTitle icon={<ImageIcon size={16} />} title="Fotos del Predio" />
            <div className="space-y-5">
              {['predio', 'familia', 'arboles', 'otras'].map((cat) => {
                const fotos = fotosPredioCat[cat]
                if (!fotos?.length) return null
                const catLabels: Record<string, string> = {
                  predio: 'Predio', familia: 'Familia', arboles: 'Árboles', otras: 'Otras',
                }
                return (
                  <div key={cat}>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                      {catLabels[cat] ?? cat} ({fotos.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {fotos.map((f) => (
                        <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={f.url} alt={cat} className="w-20 h-20 object-cover rounded-lg border border-stone-200 hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Cámaras trampa ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <SectionTitle icon={<Camera size={16} />} title={`Cámaras Trampa (${camaras.length})`} />
          {camaras.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-6">Sin cámaras trampa registradas.</p>
          ) : (
            <div className="space-y-4">
              {camaras.map((cam) => (
                <div key={cam.id} className="border border-stone-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-stone-50 border-b border-stone-100">
                    <Camera size={14} style={{ color: PRIMARY }} />
                    <span className="font-black text-stone-700 text-sm">{cam.nombre}</span>
                    <span className="ml-auto text-xs text-stone-400">
                      {cam.latitud}, {cam.longitud}
                    </span>
                  </div>
                  {cam.fotos.length > 0 ? (
                    <div className="p-4 flex flex-wrap gap-2">
                      {cam.fotos.map((foto) => (
                        <a key={foto.id} href={foto.url} target="_blank" rel="noopener noreferrer">
                          <img src={foto.url} alt="Foto cámara trampa"
                            className="w-20 h-20 object-cover rounded-lg border border-stone-200 hover:opacity-90 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400 px-4 py-3">Sin fotografías.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Otros índices ── */}
        {familia.otros_indices && (
          <section className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
            <button type="button"
              onClick={() => setOtrosVisible((v) => !v)}
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-stone-50 transition-colors">
              <div className="flex items-center gap-2">
                <Leaf size={15} style={{ color: PRIMARY }} />
                <span className="text-sm font-black text-stone-700">Otros índices de biodiversidad</span>
              </div>
              <ChevronDown size={16}
                className={`text-stone-400 transition-transform ${otrosVisible ? 'rotate-180' : ''}`} />
            </button>
            {otrosVisible && (
              <div className="px-6 pb-6 pt-0 border-t border-stone-100">
                <p className="text-sm text-stone-700 whitespace-pre-wrap mt-4">{familia.otros_indices}</p>
              </div>
            )}
          </section>
        )}

      </main>

      <footer className="w-full lg:w-[85%] max-w-[1600px] mx-auto px-4 py-8 sm:px-6 lg:px-0 text-center text-stone-500 text-sm">
        <p className="font-semibold">© {new Date().getFullYear()} Amazonia Emprende — Todos los derechos reservados</p>
      </footer>
    </div>
  )
}
