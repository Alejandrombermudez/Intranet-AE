'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { PredioReporte } from '@/app/api/reporte/predios/route'
import { SEMAFORO, MARCA } from '@/lib/expediente-formato'
import Isotipo from '@/app/components/Isotipo'
import { ArrowLeft, Search, Loader2, ChevronRight } from 'lucide-react'

/** Los cuatro bloques que puede tener un expediente, en el orden del proceso. */
const BLOQUES = [
  { id: 'juridica' as const, label: 'Jurídica' },
  { id: 'zonas'    as const, label: 'Zonas' },
  { id: 'campo'    as const, label: 'Campo' },
  { id: 'encuesta' as const, label: 'Encuesta' },
]

export default function ReportePage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [filas, setFilas] = useState<PredioReporte[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [soloCompletos, setSoloCompletos] = useState(false)
  const [municipio, setMunicipio] = useState('')
  const [tope, setTope] = useState(30)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: p } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department, can_access_intranet')
        .eq('email', user.email).single()
      if (!p?.is_admin && !p?.can_access_intranet && !p?.department) { router.push('/'); return }
      setEmail(user.email ?? null)
    })
  }, [router])

  useEffect(() => {
    if (!email) return
    fetch(`/api/reporte/predios?email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then((d: PredioReporte[]) => { setFilas(Array.isArray(d) ? d : []); setCargando(false) })
      .catch(() => setCargando(false))
  }, [email])

  const municipios = useMemo(
    () => [...new Set(filas.map(f => f.municipio).filter((m): m is string => !!m))].sort((a, b) => a.localeCompare(b)),
    [filas])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return filas.filter(f => {
      if (soloCompletos && f.completitud < 3) return false
      if (municipio && f.municipio !== municipio) return false
      if (!q) return true
      return [f.nombre_predio, f.propietario, f.municipio, f.vereda, f.zona_ae]
        .some(v => v?.toLowerCase().includes(q))
    })
  }, [filas, busqueda, soloCompletos, municipio])

  const resumen = useMemo(() => ([
    { n: filas.length, l: 'predios en el sistema' },
    { n: filas.filter(f => f.tiene.zonas).length, l: 'con cartografía cargada' },
    { n: filas.filter(f => f.tiene.campo).length, l: 'con visita de campo' },
    { n: filas.filter(f => f.completitud === 4).length, l: 'con el expediente completo' },
  ]), [filas])

  if (cargando) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: MARCA.papel }}>
        <div className="text-center">
          <Loader2 className="animate-spin mx-auto mb-3" size={26} style={{ color: MARCA.bosque }} />
          <p className="text-[11px] uppercase tracking-[.16em]" style={{ color: '#7d7669' }}>
            Cargando predios…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: MARCA.papel, color: MARCA.tinta }}>
      {/* ── Cabecera ── */}
      <header style={{ background: MARCA.tinta, color: MARCA.hueso }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
          <div className="flex items-center justify-between gap-6 mb-10">
            <Link href="/intranet"
              className="flex items-center gap-2 text-[10px] uppercase tracking-[.2em] hover:opacity-70 transition-opacity"
              style={{ color: MARCA.taupe }}>
              <ArrowLeft size={13} /> Intranet
            </Link>
            <div className="flex items-center gap-2.5">
              <Isotipo className="w-[18px] h-[22px]" />
              <span className="text-[10px] uppercase tracking-[.26em] font-semibold"
                style={{ fontFamily: 'var(--font-josefin)' }}>
                Amazonía Emprende
              </span>
            </div>
          </div>

          <p className="text-[10.5px] uppercase tracking-[.28em] mb-4" style={{ color: MARCA.taupe }}>
            Módulo Reporte
          </p>
          <h1 className="text-4xl sm:text-5xl leading-none mb-4"
            style={{ fontFamily: 'var(--font-josefin)', fontWeight: 700, color: '#fff' }}>
            Expediente del predio
          </h1>
          <p className="text-sm font-light max-w-2xl" style={{ color: MARCA.hueso }}>
            Todo lo que el ecosistema sabe de una familia, reunido en un solo documento:
            identificación y propietario, situación jurídica, cartografía con las zonas de siembra,
            lo que el terreno corrigió, la evaluación biofísica y la encuesta socioeconómica.
            Se arma solo y se puede imprimir o guardar en PDF.
          </p>

          <dl className="flex flex-wrap mt-10 pt-7"
            style={{ borderTop: '1px solid rgba(228,222,210,.22)' }}>
            {resumen.map((c, i) => (
              <div key={i} className="flex-1 min-w-[8rem] px-5 first:pl-0"
                style={{ borderLeft: i === 0 ? 'none' : '1px solid rgba(228,222,210,.22)' }}>
                <dd className="text-3xl leading-none tabular-nums"
                  style={{ fontFamily: 'var(--font-josefin)', fontWeight: 700, color: '#fff' }}>{c.n}</dd>
                <dt className="text-[9.5px] uppercase tracking-[.14em] mt-2" style={{ color: MARCA.taupe }}>
                  {c.l}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        {/* ── Filtros ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-7">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2" style={{ color: '#a89f8f' }} />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por predio, propietario, vereda o núcleo"
              className="w-full pl-6 pr-2 py-2 text-sm bg-transparent focus:outline-none"
              style={{ borderBottom: `1px solid ${MARCA.taupe}` }} />
          </div>
          <select value={municipio} onChange={e => setMunicipio(e.target.value)}
            className="px-2 py-2 text-sm bg-transparent focus:outline-none"
            style={{ borderBottom: `1px solid ${MARCA.taupe}`, color: MARCA.tinta }}>
            <option value="">Todos los municipios</option>
            {municipios.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={() => setSoloCompletos(v => !v)}
            className="px-4 py-2 text-[10px] uppercase tracking-[.16em] transition-opacity hover:opacity-80 whitespace-nowrap"
            style={soloCompletos
              ? { background: MARCA.bosque, color: MARCA.papel }
              : { border: `1px solid ${MARCA.taupe}`, color: '#5c554b' }}>
            Con datos suficientes
          </button>
        </div>

        <p className="text-[10px] uppercase tracking-[.16em] mb-1" style={{ color: '#7d7669' }}>
          {visibles.length} de {filas.length} predios
        </p>

        {/* ── Listado ── */}
        <div style={{ borderTop: `1px solid ${MARCA.taupe}` }}>
          {visibles.slice(0, tope).map(f => {
            const sem = f.semaforo ? SEMAFORO[f.semaforo] : null
            return (
              <Link key={f.predio_id} href={`/intranet/reporte/${f.predio_id}`}
                className="group flex items-center gap-5 py-3.5 transition-colors"
                style={{ borderBottom: '1px solid #e6e0d5' }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2.5 mb-0.5">
                    <span className="truncate text-[15px]"
                      style={{ fontFamily: 'var(--font-josefin)', fontWeight: 600 }}>
                      {f.nombre_predio ?? 'Predio sin nombre'}
                    </span>
                    {sem && (
                      <span className="inline-flex items-center gap-1.5 text-[10px] shrink-0"
                        style={{ color: '#7d7669' }}>
                        <i className="inline-block w-[6px] h-[6px]" style={{ background: sem.hex }} />
                        {sem.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] truncate font-light" style={{ color: '#7d7669' }}>
                    {f.propietario ?? 'Sin propietario'}
                    {f.municipio && ` · ${f.municipio}`}
                    {f.vereda && `, ${f.vereda}`}
                    {f.num_zonas > 0 && ` · ${f.num_zonas} zonas · ${f.area_zonas_ha} ha`}
                  </p>
                </div>

                {/* Qué bloques del expediente tiene, sin convertirlo en semáforo. */}
                <div className="hidden sm:flex items-center gap-3 shrink-0">
                  {BLOQUES.map(b => (
                    <span key={b.id} title={`${b.label}: ${f.tiene[b.id] ? 'con datos' : 'sin datos'}`}
                      className="text-[9px] uppercase tracking-[.1em] flex items-center gap-1"
                      style={{ color: f.tiene[b.id] ? MARCA.bosque : '#c3baa9' }}>
                      <i className="inline-block w-[5px] h-[5px]"
                        style={{ background: f.tiene[b.id] ? MARCA.bosque : 'transparent',
                                 border: f.tiene[b.id] ? 'none' : '1px solid #c3baa9' }} />
                      {b.label}
                    </span>
                  ))}
                </div>

                <ChevronRight size={15} className="shrink-0 opacity-30 group-hover:opacity-70 transition-opacity" />
              </Link>
            )
          })}
        </div>

        {visibles.length > tope && (
          <button onClick={() => setTope(t => t + 30)}
            className="mt-6 w-full py-3 text-[10px] uppercase tracking-[.18em] transition-opacity hover:opacity-70"
            style={{ border: `1px solid ${MARCA.taupe}`, color: '#5c554b' }}>
            Ver {Math.min(30, visibles.length - tope)} más
          </button>
        )}

        {visibles.length === 0 && (
          <p className="text-center text-[11px] uppercase tracking-[.16em] py-16" style={{ color: '#7d7669' }}>
            Ningún predio coincide con el filtro
          </p>
        )}
      </main>
    </div>
  )
}
