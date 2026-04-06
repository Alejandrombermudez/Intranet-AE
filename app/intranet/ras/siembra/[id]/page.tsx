'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Loader2, Trees, Users, MapPin, Activity,
  Camera, FileArchive, CalendarDays, Leaf, ExternalLink,
  CheckCircle2, XCircle, Pencil, FileText, Image as ImageIcon,
} from 'lucide-react'

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
  ha_potreros: number | null
  ha_bosque: number | null
  ha_otras: number | null
  bajo_conservacion: boolean
  empleos_locales: number
  plan_restauracion: string | null
  ha_restauracion: number | null
  parcelas_monitoreo: number | null
  plantulas_sembradas: number | null
  especies_sembradas: number | null
  shapefile_finca_url: string | null
  shapefile_restauracion_url: string | null
  shapefile_arboles_url: string | null
  documento_acuerdo_url: string | null
  created_by: string | null
  created_at: string
}

interface FotoPredio { id: string; url: string; categoria: string }

interface Monitoreo {
  id: string
  fecha: string
  supervivencia_pct: number
}

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

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span style={{ color: PRIMARY }}>{icon}</span>
      <h2 className="text-base font-black text-stone-900">{title}</h2>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function SiembraDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [familia, setFamilia] = useState<Familia | null>(null)
  const [monitoreos, setMonitoreos] = useState<Monitoreo[]>([])
  const [camaras, setCamaras] = useState<Camara[]>([])
  const [fotosPredioCat, setFotosPredioCat] = useState<Record<string, FotoPredio[]>>({})

  useEffect(() => {
    const init = async () => {
      // Auth
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase
        .from('user_profiles').select('is_admin, department').eq('email', user.email).single()
      if (!profile?.is_admin && profile?.department !== 'RAS') { router.push('/'); return }

      // Familia
      const { data: fam, error: famErr } = await supabase
        .schema('siembra').from('familias').select('*').eq('id', id).single()
      if (famErr || !fam) { router.push('/intranet/ras/siembra'); return }
      setFamilia(fam)

      // Monitoreos
      const { data: mons } = await supabase
        .schema('siembra').from('monitoreos')
        .select('id, fecha, supervivencia_pct')
        .eq('familia_id', id)
        .order('fecha', { ascending: true })
      setMonitoreos(mons ?? [])

      // Cámaras trampa + fotos
      const { data: cams } = await supabase
        .schema('siembra').from('camaras_trampa')
        .select('id, nombre, latitud, longitud')
        .eq('familia_id', id)
      const camarasConFotos: Camara[] = []
      for (const cam of (cams ?? [])) {
        const { data: fotos } = await supabase
          .schema('siembra').from('fotos_camara')
          .select('id, url').eq('camara_id', cam.id)
        camarasConFotos.push({ ...cam, fotos: fotos ?? [] })
      }

      // Fotos de predio por categoría
      const { data: fpData } = await supabase
        .schema('siembra').from('fotos_predio')
        .select('id, url, categoria').eq('familia_id', id)
      const fpByCat: Record<string, FotoPredio[]> = {}
      for (const fp of (fpData ?? [])) {
        if (!fpByCat[fp.categoria]) fpByCat[fp.categoria] = []
        fpByCat[fp.categoria].push(fp)
      }
      setFotosPredioCat(fpByCat)
      setCamaras(camarasConFotos)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-primary-50 to-stone-100">

      {/* Header */}
      <header className="bg-white shadow-md border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <Link href="/intranet/ras/siembra"
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-stone-200 text-stone-600 font-bold text-sm hover:border-primary hover:text-primary hover:bg-primary/5 transition-all shrink-0">
              <ArrowLeft size={16} />
              <span className="hidden sm:block">Restauración / Siembra</span>
            </Link>
            <div className="text-center flex-1">
              <div className="inline-flex items-center gap-2">
                <Leaf size={18} style={{ color: PRIMARY }} />
                <h1 className="text-xl font-black text-stone-900 truncate max-w-xs">
                  {familia.nombre_propietario}
                </h1>
              </div>
              {familia.nombre_finca && (
                <p className="text-xs text-stone-500 mt-0.5">{familia.nombre_finca}</p>
              )}
            </div>
            <Link href={`/intranet/ras/siembra/${id}/editar`}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shrink-0 shadow-sm hover:shadow-md transition-all"
              style={{ backgroundColor: PRIMARY }}>
              <Pencil size={15} />
              <span className="hidden sm:block">Editar</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 space-y-8">

        {/* ── Sección 1: Información Base ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <SectionTitle icon={<Users size={16} />} title="Información Base y Socioeconomía" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat label="Municipio" value={familia.municipio} />
            <Stat label="Vereda" value={familia.vereda} />
            <Stat label="Finca" value={familia.nombre_finca} />
            <Stat label="Adultos" value={familia.adultos} />
            <Stat label="Niños" value={familia.ninos} />
            <Stat label="Empleos locales" value={familia.empleos_locales} />
            <Stat label="Bajo figura de conservación" value={
              familia.bajo_conservacion
                ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={13} />Sí</span>
                : <span className="flex items-center gap-1 text-stone-400"><XCircle size={13} />No</span>
            } />
            <Stat label="Registrado" value={formatDate(familia.created_at)} />
            {familia.created_by && <Stat label="Por" value={familia.created_by} />}
          </div>
        </section>

        {/* ── Sección 2: Uso del suelo ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <SectionTitle icon={<MapPin size={16} />} title="Uso del Suelo (hectáreas)" />
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Potreros" value={familia.ha_potreros != null ? `${familia.ha_potreros} ha` : null} />
            <Stat label="Bosque" value={familia.ha_bosque != null ? `${familia.ha_bosque} ha` : null} />
            <Stat label="Otras" value={familia.ha_otras != null ? `${familia.ha_otras} ha` : null} />
          </div>
        </section>

        {/* ── Sección 3: Restauración ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <SectionTitle icon={<Trees size={16} />} title="Datos de Restauración" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat label="Ha. en restauración" value={familia.ha_restauracion != null ? `${familia.ha_restauracion} ha` : null} />
            <Stat label="Parcelas monitoreo" value={familia.parcelas_monitoreo} />
            <Stat label="Plántulas sembradas" value={familia.plantulas_sembradas} />
            <Stat label="Especies sembradas" value={familia.especies_sembradas} />
          </div>
          {familia.plan_restauracion && (
            <div className="bg-stone-50 rounded-xl p-4">
              <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1">Plan de restauración</p>
              <p className="text-sm text-stone-700 whitespace-pre-wrap">{familia.plan_restauracion}</p>
            </div>
          )}
        </section>

        {/* ── Sección 4: Shapefiles y Documentos ── */}
        {(familia.shapefile_finca_url || familia.shapefile_restauracion_url || familia.shapefile_arboles_url || familia.documento_acuerdo_url) && (
          <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <SectionTitle icon={<FileArchive size={16} />} title="Archivos Espaciales y Documentos" />
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              {familia.shapefile_finca_url && (
                <a href={familia.shapefile_finca_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-stone-200 text-stone-700 font-bold text-sm hover:border-primary hover:text-primary transition-all">
                  <FileArchive size={16} /> Polígono finca <ExternalLink size={12} className="ml-auto text-stone-400" />
                </a>
              )}
              {familia.shapefile_restauracion_url && (
                <a href={familia.shapefile_restauracion_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-stone-200 text-stone-700 font-bold text-sm hover:border-primary hover:text-primary transition-all">
                  <FileArchive size={16} /> Polígono restauración <ExternalLink size={12} className="ml-auto text-stone-400" />
                </a>
              )}
              {familia.shapefile_arboles_url && (
                <a href={familia.shapefile_arboles_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-stone-200 text-stone-700 font-bold text-sm hover:border-primary hover:text-primary transition-all">
                  <FileArchive size={16} /> Árboles (puntos) <ExternalLink size={12} className="ml-auto text-stone-400" />
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
              {['predio', 'familia', 'copa_arboles', 'tronco', 'otras'].map((cat) => {
                const fotos = fotosPredioCat[cat]
                if (!fotos?.length) return null
                const catLabels: Record<string, string> = {
                  predio: 'Predio', familia: 'Familia', copa_arboles: 'Copa de árboles', tronco: 'Tronco', otras: 'Otras',
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

        {/* ── Sección 5: Monitoreos ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <SectionTitle icon={<Activity size={16} />} title={`Monitoreos (${monitoreos.length})`} />
          {monitoreos.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-6">Sin eventos de monitoreo registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="pb-2 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Fecha</th>
                    <th className="pb-2 text-[11px] font-bold text-stone-400 uppercase tracking-wider">% Supervivencia</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoreos.map((m) => (
                    <tr key={m.id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="py-2.5 pr-6">
                        <span className="flex items-center gap-1.5 text-sm text-stone-700">
                          <CalendarDays size={13} className="text-stone-400" />
                          {new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold"
                          style={{
                            backgroundColor: m.supervivencia_pct >= 70 ? '#d1fae5' : m.supervivencia_pct >= 40 ? '#fef9c3' : '#fee2e2',
                            color: m.supervivencia_pct >= 70 ? '#065f46' : m.supervivencia_pct >= 40 ? '#713f12' : '#991b1b',
                          }}>
                          {m.supervivencia_pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Sección 6: Cámaras trampa ── */}
        <section className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <SectionTitle icon={<Camera size={16} />} title={`Cámaras Trampa (${camaras.length})`} />
          {camaras.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-6">Sin cámaras trampa registradas.</p>
          ) : (
            <div className="space-y-4">
              {camaras.map((cam, i) => (
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

      </main>

      <footer className="max-w-4xl mx-auto px-4 py-8 sm:px-6 text-center text-stone-500 text-sm">
        <p className="font-semibold">© {new Date().getFullYear()} Amazonia Emprende — Todos los derechos reservados</p>
      </footer>
    </div>
  )
}
