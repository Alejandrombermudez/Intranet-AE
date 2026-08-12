'use client'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Geometry } from 'geojson'
import {
  Loader2, ClipboardList, BarChart2, User, Calendar, MapPinned,
  Check, Pencil, Trash2, Plus, ChevronDown, ChevronRight, Image as ImageIcon,
  Download, AlertCircle,
} from 'lucide-react'
import type { CapaCampo } from '@/app/components/MapaCampo'
import { exportarRevisiones } from '@/lib/exportar-zonas'

const MapaCampo = dynamic(() => import('@/app/components/MapaCampo'), {
  ssr: false,
  loading: () => <div className="w-full h-96 rounded-xl border border-stone-200 bg-stone-100 flex items-center justify-center"><Loader2 className="animate-spin text-stone-400" size={28} /></div>,
})

// ─── Tipos que devuelve /api/sig/campo ───────────────────────────────────────
interface Revision {
  local_id: string | null
  zona_id: string | null
  accion: 'confirmada' | 'modificada' | 'nueva' | 'descartada'
  metodo: string | null
  geom_original: Geometry | null
  geom_corregida: Geometry | null
  area_ha_campo: number | null
  observaciones: string | null
  evaluador: string | null
  fecha: string | null
  created_at: string
}
type Json = Record<string, unknown>
interface CampoResumen {
  revisiones: Revision[]
  evaluacion: Json | null
  encuesta: Json | null
}

const ACCION: Record<Revision['accion'], { label: string; cls: string; Icon: typeof Check }> = {
  confirmada: { label: 'Confirmada',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: Check },
  modificada: { label: 'Límite corregido', cls: 'bg-blue-50 text-blue-700 border-blue-200',       Icon: Pencil },
  nueva:      { label: 'Zona nueva',    cls: 'bg-teal-50 text-teal-700 border-teal-200',          Icon: Plus },
  descartada: { label: 'Descartada',    cls: 'bg-rose-50 text-rose-700 border-rose-200',          Icon: Trash2 },
}

const fmtHa = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ha`
const fmtFecha = (s: string | null) =>
  s ? new Date(s.length <= 10 ? s + 'T00:00:00' : s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

// ─── Render genérico de las secciones jsonb de los formularios ───────────────
// Las claves vienen en snake_case desde la PWA; se humanizan, con override
// para las que se leen mal por sí solas.
const ETIQUETAS: Record<string, string> = {
  pct_cobertura_boscosa: '% de cobertura boscosa',
  area_ha: 'Área (ha)',
  distancia_agua_m: 'Distancia al agua (m)',
  anio_siembra: 'Año de siembra',
  anio_adquisicion: 'Año de adquisición',
  anio_quema: 'Año de la quema',
  num_habitaciones: 'N.º de habitaciones',
  personas_vivienda: 'Personas en la vivienda',
  cabezas_poligono: 'Cabezas de ganado en el polígono',
  senal_celular: 'Señal de celular',
  senal_telefonica: 'Señal telefónica',
  tiempo_desde_via: 'Tiempo desde la vía',
  tiempo_predio_zona: 'Tiempo del predio a la zona',
  especies_arboreas_alturas: 'Especies arbóreas y alturas',
  ganado_activo_poligono: 'Ganado activo en el polígono',
  distancia_cabecera_km: 'Distancia a la cabecera (km)',
  medio_acceso_zonas: 'Medios de acceso',
  codigo_formato: 'Código de formato',
  zona_numero: 'Zona',
  area_ha_sig: 'Área según el SIG',
}
const humanizar = (k: string) =>
  ETIQUETAS[k] ?? k.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())

const OCULTAS = new Set(['zona_id', 'revision_local_id', 'descartada', 'version'])

function valorTexto(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (Array.isArray(v)) return v.length ? v.map(String).join(' · ') : null
  if (typeof v === 'number') return v.toLocaleString('es-CO', { maximumFractionDigits: 2 })
  return String(v)
}

function Campos({ data }: { data: Json | null | undefined }) {
  if (!data) return null
  const filas = Object.entries(data)
    .filter(([k]) => !OCULTAS.has(k))
    .map(([k, v]) => [k, valorTexto(v)] as const)
    .filter(([, v]) => v !== null)
  if (filas.length === 0) return <p className="text-sm text-stone-400 italic">Sin respuestas en esta sección.</p>

  return (
    <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
      {filas.map(([k, v]) => {
        const esFoto = k.endsWith('_url')
        return (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] font-bold text-stone-400 uppercase tracking-wide">{humanizar(k.replace(/_url$/, ''))}</dt>
            <dd className="text-sm text-stone-800 break-words">
              {esFoto
                ? <a href={v!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-600 font-bold hover:underline"><ImageIcon size={12} /> Ver foto</a>
                : v}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function Seccion({ titulo, children, defaultOpen = false }: { titulo: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-stone-100 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-stone-50 hover:bg-stone-100 transition-colors text-left">
        <span className="text-sm font-bold text-stone-700">{titulo}</span>
        {open ? <ChevronDown size={15} className="text-stone-400" /> : <ChevronRight size={15} className="text-stone-400" />}
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────
export default function ResultadosCampo({
  predioId, email, fincaGeoms, nombrePredio,
}: {
  predioId: string
  email: string
  /** Polígono(s) del predio, para dar contexto al mapa. */
  fincaGeoms: Geometry[]
  nombrePredio: string
}) {
  const [data, setData] = useState<CampoResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<string | null>(null)   // local_id de la revisión enfocada
  const [bajando, setBajando] = useState<string | null>(null)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  async function descargar(revs: Revision[], sufijo: string, clave: string) {
    setBajando(clave); setErrorDescarga(null)
    try {
      await exportarRevisiones(revs, { predio: nombrePredio, sufijo })
    } catch (e) {
      setErrorDescarga(e instanceof Error ? e.message : 'No se pudo generar el shapefile.')
    } finally {
      setBajando(null)
    }
  }

  useEffect(() => {
    let vivo = true
    fetch(`/api/sig/campo?predio_id=${predioId}&email=${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then((d: CampoResumen) => { if (vivo) { setData(d); setLoading(false) } })
      .catch(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [predioId, email])

  // Última revisión por zona: es el estado con el que quedó el predio.
  const ultimasPorZona = useMemo(() => {
    const m = new Map<string, Revision>()
    for (const r of data?.revisiones ?? []) {
      const k = r.zona_id ?? r.local_id ?? ''
      const prev = m.get(k)
      if (!prev || r.created_at > prev.created_at) m.set(k, r)
    }
    return [...m.values()]
  }, [data])

  const capas: CapaCampo[] = useMemo(() => {
    const base: CapaCampo[] = fincaGeoms.map((g, i) => ({ id: `finca-${i}`, geom: g, tipo: 'finca', etiqueta: 'Límite del predio' }))
    const focal = sel ? (data?.revisiones ?? []).find(r => r.local_id === sel) : null
    const lista = focal ? [focal] : ultimasPorZona

    for (const [i, r] of lista.entries()) {
      const id = r.local_id ?? r.zona_id ?? `rev-${i}`
      // Sombra del "antes" solo cuando hubo un cambio real de geometría
      if (r.accion === 'modificada' && r.geom_original) {
        base.push({ id: `${id}-antes`, geom: r.geom_original, tipo: 'antes', etiqueta: 'Antes (SIG)' })
      }
      const geom = r.geom_corregida ?? r.geom_original
      if (geom) {
        base.push({
          id, geom, tipo: r.accion,
          etiqueta: `${ACCION[r.accion].label}${r.area_ha_campo ? ` · ${fmtHa(r.area_ha_campo)}` : ''}`,
          destacada: !!focal,
        })
      }
    }
    return base
  }, [fincaGeoms, ultimasPorZona, sel, data])

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-stone-300" size={32} /></div>
  }
  if (!data) {
    return <p className="text-sm text-stone-400 py-8 text-center">No se pudieron cargar los resultados de campo.</p>
  }

  const { revisiones, evaluacion, encuesta } = data
  const sinNada = revisiones.length === 0 && !evaluacion && !encuesta

  if (sinNada) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 p-8 text-center text-stone-400">
        <MapPinned size={36} className="mx-auto mb-3 opacity-30" />
        <p className="font-bold text-stone-500">Campo todavía no ha devuelto nada de este predio</p>
        <p className="text-sm mt-1">Aquí aparecerán las correcciones de zonas y los formularios apenas el equipo sincronice.</p>
      </div>
    )
  }

  const conteo = revisiones.reduce((a, r) => { a[r.accion] = (a[r.accion] ?? 0) + 1; return a }, {} as Record<string, number>)
  const evaluadores = [...new Set(revisiones.map(r => r.evaluador).filter(Boolean))]
  const zonasEval = (evaluacion?.zonas_data as Json[] | undefined) ?? []
  const cultivos = (encuesta?.sec_cultivos as Json[] | undefined) ?? []

  return (
    <div className="space-y-5">

      {/* Resumen */}
      <div className="bg-white rounded-2xl border border-stone-100 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Lo que devolvió campo</h2>
          {evaluadores.length > 0 && (
            <span className="text-xs text-stone-500 flex items-center gap-1"><User size={12} />{evaluadores.join(' · ')}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ACCION) as Revision['accion'][]).map(a => {
            const n = conteo[a] ?? 0
            const { label, cls, Icon } = ACCION[a]
            return (
              <span key={a} className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${n ? cls : 'bg-stone-50 text-stone-300 border-stone-100'}`}>
                <Icon size={12} /> {n} {label.toLowerCase()}
              </span>
            )
          })}
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${evaluacion ? 'bg-stone-50 text-stone-600 border-stone-200' : 'bg-stone-50 text-stone-300 border-stone-100'}`}>
            <ClipboardList size={12} /> Evaluación {evaluacion ? 'diligenciada' : 'pendiente'}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${encuesta ? 'bg-stone-50 text-stone-600 border-stone-200' : 'bg-stone-50 text-stone-300 border-stone-100'}`}>
            <BarChart2 size={12} /> Encuesta {encuesta ? 'diligenciada' : 'pendiente'}
          </span>
        </div>
      </div>

      {/* Mapa de cambios */}
      {revisiones.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Cambios en el terreno</h2>
            <div className="flex items-center gap-3">
              {sel && <button onClick={() => setSel(null)} className="text-xs font-bold text-teal-600 hover:underline">Ver todos los cambios</button>}
              <button
                onClick={() => descargar(revisiones.filter(r => r.geom_original || r.geom_corregida), 'cambios_campo', 'todo')}
                disabled={bajando !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors disabled:opacity-50">
                {bajando === 'todo' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                Descargar todos los cambios (.shp)
              </button>
            </div>
          </div>

          {errorDescarga && (
            <p className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <AlertCircle size={13} className="shrink-0 mt-0.5" /> {errorDescarga}
            </p>
          )}

          <MapaCampo capas={capas} />

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
            <span className="inline-flex items-center gap-1.5"><i className="w-3 h-2 rounded-sm border-2 border-stone-500 border-dashed" /> Límite del predio</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-3 h-2 rounded-sm bg-gray-400/40 border border-gray-500 border-dashed" /> Antes (lo que dibujó el SIG)</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-3 h-2 rounded-sm bg-emerald-400/40 border border-emerald-500" /> Confirmada</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-3 h-2 rounded-sm bg-blue-400/40 border border-blue-500" /> Corregida en campo</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-3 h-2 rounded-sm bg-teal-400/40 border border-teal-500" /> Nueva (dibujada en campo)</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-3 h-2 rounded-sm bg-rose-400/30 border border-rose-500 border-dashed" /> Descartada</span>
          </div>
          <p className="text-[11px] text-stone-400">
            El mapa muestra cómo quedó cada zona. Toca una fila de la bitácora para ver ese cambio en particular,
            con la sombra gris del límite anterior. Las descargas salen en <strong>EPSG:4326 (WGS84)</strong>,
            el mismo sistema en el que quedan las geometrías después de la ingesta, con .prj y atributos en el .dbf.
          </p>
        </div>
      )}

      {/* Bitácora */}
      {revisiones.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Bitácora de revisiones</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Cada acción del equipo de campo sobre una zona, en orden. El ícono de descarga baja
              esa corrección como shapefile, con el polígono de antes y el de después.
            </p>
          </div>
          <div className="divide-y divide-stone-50">
            {[...revisiones].reverse().map((r, i) => {
              const { label, cls, Icon } = ACCION[r.accion]
              const activo = sel === r.local_id
              const tieneGeom = !!(r.geom_original || r.geom_corregida)
              return (
                <div key={r.local_id ?? i}
                  className={`px-5 py-3 flex items-start gap-3 transition-colors ${activo ? 'bg-teal-50/60' : 'hover:bg-stone-50/70'}`}>
                  <button onClick={() => setSel(activo ? null : r.local_id)}
                    className="flex-1 min-w-0 flex items-start gap-3 text-left">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border shrink-0 ${cls}`}>
                    <Icon size={11} /> {label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-700">
                      {r.accion === 'modificada' && r.area_ha_campo != null
                        ? <>Quedó en <strong>{fmtHa(r.area_ha_campo)}</strong>{r.metodo && <span className="text-stone-400"> · por {r.metodo}</span>}</>
                        : r.accion === 'nueva' && r.area_ha_campo != null
                          ? <>Zona dibujada en terreno de <strong>{fmtHa(r.area_ha_campo)}</strong></>
                          : <span className="text-stone-500">Sin cambio de geometría</span>}
                    </p>
                    {r.observaciones && <p className="text-xs text-stone-500 mt-0.5 italic">“{r.observaciones}”</p>}
                    <p className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1"><User size={10} />{r.evaluador ?? 'sin nombre'}</span>
                      <span className="inline-flex items-center gap-1"><Calendar size={10} />{fmtFecha(r.fecha ?? r.created_at)}</span>
                    </p>
                  </div>
                  </button>

                  {tieneGeom && (
                    <button
                      onClick={() => descargar([r], `zona_${(r.zona_id ?? '').slice(0, 8)}_${r.accion}`, r.local_id ?? `i${i}`)}
                      disabled={bajando !== null}
                      title="Descargar este cambio como shapefile (antes y después)"
                      className="shrink-0 p-2 rounded-lg text-stone-400 hover:text-teal-700 hover:bg-teal-50 transition-colors disabled:opacity-40">
                      {bajando === (r.local_id ?? `i${i}`) ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Evaluación de campo */}
      {evaluacion && (
        <div className="bg-white rounded-2xl border border-stone-100 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <ClipboardList size={15} className="text-teal-600" /> Evaluación de campo (AE-CAMPO-001)
            </h2>
            <span className="text-xs text-stone-500">
              {String(evaluacion.created_by ?? '—')} · {fmtFecha(evaluacion.fecha_visita as string | null)}
            </span>
          </div>

          <Seccion titulo="§1 Identificación" defaultOpen>
            <Campos data={evaluacion.seccion_1_data as Json} />
          </Seccion>
          <Seccion titulo="§2 Cartografía social">
            <Campos data={evaluacion.seccion_2_data as Json} />
          </Seccion>

          {zonasEval.map((z, i) => (
            <Seccion key={i} titulo={`Zona ${z.zona_numero ?? i + 1}${z.area_ha_sig ? ` · ${fmtHa(z.area_ha_sig as number)}` : ''}${z.descartada ? ' · descartada' : ''}`}>
              <div className="space-y-4">
                <div>
                  <p className="text-[11px] font-black text-teal-600 uppercase tracking-wider mb-1.5">§3 Cobertura vegetal</p>
                  <Campos data={z.cobertura as Json} />
                </div>
                <div>
                  <p className="text-[11px] font-black text-teal-600 uppercase tracking-wider mb-1.5">§4 Suelo y topografía</p>
                  <Campos data={z.suelo as Json} />
                </div>
                <div>
                  <p className="text-[11px] font-black text-teal-600 uppercase tracking-wider mb-1.5">§5 Logística y acceso</p>
                  <Campos data={z.logistica as Json} />
                </div>
              </div>
            </Seccion>
          ))}

          <Seccion titulo="§6 Riesgos y restricciones">
            <Campos data={evaluacion.seccion_6_data as Json} />
          </Seccion>

          {!!(evaluacion.firma_eval1_url || evaluacion.firma_eval2_url || evaluacion.firma_prop_url) && (
            <div className="flex gap-4 flex-wrap pt-1">
              {[['firma_eval1_url', 'Firma evaluador'], ['firma_eval2_url', 'Firma evaluador 2'], ['firma_prop_url', 'Firma propietario']].map(([k, label]) =>
                evaluacion[k] ? (
                  <a key={k} href={String(evaluacion[k])} target="_blank" rel="noreferrer"
                    className="text-xs font-bold text-teal-600 hover:underline inline-flex items-center gap-1"><ImageIcon size={12} /> {label}</a>
                ) : null,
              )}
            </div>
          )}
        </div>
      )}

      {/* Encuesta predial */}
      {encuesta && (
        <div className="bg-white rounded-2xl border border-stone-100 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <BarChart2 size={15} className="text-emerald-600" /> Encuesta predial
            </h2>
            <span className="text-xs text-stone-500">
              {String(encuesta.created_by ?? '—')} · {fmtFecha(encuesta.fecha_encuesta as string | null)}
            </span>
          </div>

          {([
            ['sec_general',    'Datos generales del predio'],
            ['sec_vivienda',   'Vivienda'],
            ['sec_familia',    'Familia y servicios'],
            ['sec_economia',   'Economía'],
            ['sec_ganaderia',  'Ganadería'],
            ['sec_tecnologia', 'Tecnología y manejo'],
            ['sec_bosque',     'Bosque y relaciones'],
          ] as const).map(([k, label]) => (
            <Seccion key={k} titulo={label}>
              <Campos data={encuesta[k] as Json} />
            </Seccion>
          ))}

          {cultivos.length > 0 && (
            <Seccion titulo="Cultivos">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="text-[11px] text-stone-400 uppercase tracking-wide border-b border-stone-100">
                      {['Cultivo', 'Área (ha)', 'Año', 'Densidad', 'Rendimiento', 'Destino'].map(h => (
                        <th key={h} className="py-1.5 pr-4 font-bold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cultivos.filter(c => Object.values(c).some(v => v !== '' && v != null)).map((c, i) => (
                      <tr key={i} className="border-b border-stone-50 last:border-0">
                        <td className="py-1.5 pr-4 font-medium text-stone-700">{String(c.cultivo ?? '—')}</td>
                        <td className="py-1.5 pr-4 text-stone-600">{valorTexto(c.area_ha) ?? '—'}</td>
                        <td className="py-1.5 pr-4 text-stone-600">{valorTexto(c.anio_siembra) ?? '—'}</td>
                        <td className="py-1.5 pr-4 text-stone-600">{valorTexto(c.densidad) ?? '—'}</td>
                        <td className="py-1.5 pr-4 text-stone-600">{valorTexto(c.rendimiento) ?? '—'}</td>
                        <td className="py-1.5 pr-4 text-stone-600">{valorTexto(c.destino) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Seccion>
          )}
        </div>
      )}
    </div>
  )
}
