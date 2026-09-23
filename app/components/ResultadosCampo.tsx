'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchConSesion } from '@/lib/fetch-sesion'
import dynamic from 'next/dynamic'
import type { Geometry, Position } from 'geojson'
import { area as turfArea } from '@turf/area'
import {
  Loader2, ClipboardList, BarChart2, User, Calendar, MapPinned,
  Check, Pencil, Trash2, Plus, ChevronDown, ChevronRight, Image as ImageIcon,
  Download, AlertCircle, AlertTriangle, CheckCircle2, FileUp, Sprout, Undo2, X, Save,
} from 'lucide-react'
import type { CapaCampo } from '@/app/components/MapaCampo'
import type { ContextoEditor } from '@/app/components/EditorZona'
import type { CampoResumen, DecisionSig, RevisionCampo } from '@/app/api/sig/campo/route'
import { exportarRevisiones, exportarZonas } from '@/lib/exportar-zonas'
import { parsearShapefile } from '@/lib/shapefile-client'
import { COLOR_CAMPO, COLOR_SELECCION } from '@/lib/colores-campo'

const cargandoMapa = () => (
  <div className="w-full h-96 rounded-xl border border-stone-200 bg-stone-100 flex items-center justify-center"><Loader2 className="animate-spin text-stone-400" size={28} /></div>
)
const MapaCampo  = dynamic(() => import('@/app/components/MapaCampo'),  { ssr: false, loading: cargandoMapa })
const EditorZona = dynamic(() => import('@/app/components/EditorZona'), { ssr: false, loading: cargandoMapa })

type Accion = RevisionCampo['accion']
type Filtro = 'todas' | 'pendientes' | Accion

// El color de cada acción es el mismo del mapa (lib/colores-campo.ts): la
// etiqueta y la línea sobre el satelital tienen que decir lo mismo. Por eso no
// usa clases de Tailwind, que siguen la paleta de marca.
const ACCION: Record<Accion, { label: string; color: string; Icon: typeof Check }> = {
  confirmada: { label: 'Confirmada',       color: COLOR_CAMPO.confirmada, Icon: Check },
  modificada: { label: 'Límite corregido', color: COLOR_CAMPO.modificada, Icon: Pencil },
  nueva:      { label: 'Zona nueva',       color: COLOR_CAMPO.nueva,      Icon: Plus },
  descartada: { label: 'Descartada',       color: COLOR_CAMPO.descartada, Icon: Trash2 },
}

// `label` va solo (etiquetas); `frase` va dentro de una oración ("Zona 2 · …").
const DECISION: Record<DecisionSig['decision'], { label: string; frase: string; Icon: typeof Check }> = {
  confirmada: { label: 'Confirmada por SIG', frase: 'confirmada por el SIG', Icon: CheckCircle2 },
  editada:    { label: 'Editada por SIG',    frase: 'editada por el SIG',    Icon: Pencil },
  eliminada:  { label: 'Eliminada por SIG',  frase: 'eliminada por el SIG',  Icon: Trash2 },
}

const fmtHa = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ha`
const fmtFecha = (s: string | null) =>
  s ? new Date(s.length <= 10 ? s + 'T00:00:00' : s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const ms = (s: string) => new Date(s).getTime()
const haDe = (g: Geometry | null) => {
  if (!g) return null
  try { return turfArea({ type: 'Feature', geometry: g, properties: {} }) / 1e4 } catch { return null }
}

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

type Json = Record<string, unknown>

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

// ─── Una zona que campo tocó, con lo que el SIG decidió sobre ella ───────────
interface Ficha {
  zonaId: string
  /** El mismo "Zona N" del formulario de evaluación, para poder cruzarlos. */
  numero: number
  /** La última acción de campo sobre la zona. */
  campo: RevisionCampo
  /** La última decisión del SIG, si hay. */
  decision: DecisionSig | null
  /** La decisión del SIG sigue en pie (nadie la movió después). */
  decidida: boolean
  /** Falta que el SIG decida: nunca lo hizo, o campo o un «deshacer» la reabrió. */
  pendiente: boolean
  /** Hoy no cuenta como sitio de siembra: descartada o eliminada. */
  fuera: boolean
  /** Ya es lote de siembra (estado 'definitiva'). */
  lote: boolean
  /** No existe en geo.zonas (no se puede decidir sobre ella). */
  huerfana: boolean
  nNucleos: number
  estado: string | null
  /** Geometría vigente: la de geo.zonas, o la de la revisión si no está. */
  geom: Geometry | null
  areaHa: number | null
}

function armarFichas(data: CampoResumen): Ficha[] {
  const revsPorZona = new Map<string, RevisionCampo[]>()
  for (const r of data.revisiones) {
    if (!r.zona_id) continue
    const l = revsPorZona.get(r.zona_id) ?? []
    l.push(r)
    revsPorZona.set(r.zona_id, l)
  }
  const ultimaDecision = new Map<string, DecisionSig>()
  for (const d of data.decisiones) {
    if (!d.zona_id) continue
    const prev = ultimaDecision.get(d.zona_id)
    if (!prev || ms(d.created_at) > ms(prev.created_at)) ultimaDecision.set(d.zona_id, d)
  }
  const actuales = new Map(data.zonas.map(z => [z.id, z]))

  // Numeración: la del formulario de evaluación cuando la zona está allí; las
  // demás siguen después, en el orden en que campo las tocó por primera vez.
  const numEval = new Map<string, number>()
  for (const z of (data.evaluacion?.zonas_data as Json[] | undefined) ?? []) {
    const n = Number(z.zona_numero)
    if (typeof z.zona_id === 'string' && Number.isInteger(n) && n > 0) numEval.set(z.zona_id, n)
  }
  let siguiente = Math.max(0, ...numEval.values())

  const fichas: Ficha[] = []
  for (const [zonaId, revs] of revsPorZona) {
    const campo = revs.reduce((a, b) => (ms(b.created_at) >= ms(a.created_at) ? b : a))
    const decision = ultimaDecision.get(zonaId) ?? null
    const actual = actuales.get(zonaId) ?? null
    const lote = !!actual && actual.vigente && actual.estado === 'definitiva'
    const eliminada = !!actual && !actual.vigente
    // La decisión sigue en pie si es posterior a lo último que hizo campo y la
    // zona todavía está como la dejó (un «deshacer lote» en Nucleación la reabre).
    const decidida = !!decision && ms(decision.created_at) > ms(campo.created_at)
      && (decision.decision === 'eliminada' ? eliminada : lote)
    // Si la geometría actual no llegara como GeoJSON, mejor la del historial que un mapa vacío.
    const geomActual = actual?.geom && typeof actual.geom === 'object' && 'type' in actual.geom ? actual.geom : null
    const geom = geomActual ?? campo.geom_corregida ?? campo.geom_original
    fichas.push({
      zonaId,
      numero: numEval.get(zonaId) ?? ++siguiente,
      campo,
      decision,
      decidida,
      pendiente: !decidida && !lote,
      fuera: actual ? (!actual.vigente || actual.estado === 'descartada') : campo.accion === 'descartada',
      lote,
      huerfana: !actual,
      nNucleos: actual?.n_nucleos ?? 0,
      estado: actual?.estado ?? null,
      geom,
      areaHa: actual?.area_ha ?? haDe(geom),
    })
  }
  return fichas.sort((a, b) => a.numero - b.numero)
}

function estadoSig(f: Ficha): { texto: string; clase: string } {
  if (f.decidida && f.decision) {
    const { label } = DECISION[f.decision.decision]
    return f.decision.decision === 'eliminada'
      ? { texto: label, clase: 'bg-rose-50 text-rose-700 border-rose-200' }
      : { texto: `${label} · lote`, clase: 'bg-teal-50 text-teal-700 border-teal-200' }
  }
  if (f.lote) return { texto: 'Lote de siembra', clase: 'bg-teal-50 text-teal-700 border-teal-200' }
  if (f.decision && ms(f.campo.created_at) > ms(f.decision.created_at)) {
    return { texto: 'Pendiente · campo volvió a revisarla', clase: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  return { texto: 'Pendiente de SIG', clase: 'bg-amber-50 text-amber-700 border-amber-200' }
}

// Cómo se pinta hoy: con el color de lo que hizo campo, salvo que la zona haya
// quedado fuera (rojo punteado) o que el SIG sostenga una que campo descartó.
function tipoMapa(f: Ficha): CapaCampo['tipo'] {
  if (f.fuera) return 'descartada'
  if (f.campo.accion === 'descartada') return 'confirmada'
  return f.campo.accion
}

type Focal = { tipo: 'rev'; clave: string; rev: RevisionCampo } | { tipo: 'dec'; clave: string; dec: DecisionSig }
type Entrada = Focal & { t: number }

// ─── Componente principal ────────────────────────────────────────────────────
export default function ResultadosCampo({
  predioId, fincaGeoms, nombrePredio, onCambio,
}: {
  predioId: string
  /** Polígono(s) del predio, para dar contexto al mapa. */
  fincaGeoms: Geometry[]
  nombrePredio: string
  /** Después de una decisión del SIG: para que la página recargue sus zonas. */
  onCambio?: () => void
}) {
  const [data, setData] = useState<CampoResumen | null>(null)
  const [loading, setLoading] = useState(true)

  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [focal, setFocal] = useState<Focal | null>(null)     // una entrada de la bitácora, vista en el mapa

  const [trabajando, setTrabajando] = useState<'confirmar' | 'editar' | 'eliminar' | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [notaEliminar, setNotaEliminar] = useState('')

  // Edición del límite de una zona
  const [editando, setEditando] = useState<{ zonaId: string; numero: number; geom: Geometry; original: Geometry } | null>(null)
  const [geomEditada, setGeomEditada] = useState<Geometry | null>(null)
  const [cambiada, setCambiada] = useState(false)
  const [notaEdicion, setNotaEdicion] = useState('')
  const [leyendoZip, setLeyendoZip] = useState(false)
  const [avisoZip, setAvisoZip] = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)

  const [bajando, setBajando] = useState<string | null>(null)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)
  const mapaRef = useRef<HTMLDivElement>(null)

  const avisar = (tipo: 'ok' | 'error', msg: string) => { setAviso({ tipo, msg }); setTimeout(() => setAviso(null), 6000) }

  const cargar = useCallback(async () => {
    const r = await fetchConSesion(`/api/sig/campo?predio_id=${predioId}`)
    const d = await r.json()
    if (r.ok) setData(d as CampoResumen)
  }, [predioId])

  useEffect(() => {
    let vivo = true
    cargar().finally(() => { if (vivo) setLoading(false) })
    return () => { vivo = false }
  }, [cargar])

  async function descargar(revs: RevisionCampo[], sufijo: string, clave: string) {
    setBajando(clave); setErrorDescarga(null)
    try {
      await exportarRevisiones(revs, { predio: nombrePredio, sufijo })
    } catch (e) {
      setErrorDescarga(e instanceof Error ? e.message : 'No se pudo generar el shapefile.')
    } finally {
      setBajando(null)
    }
  }

  const fichas = useMemo(() => (data ? armarFichas(data) : []), [data])
  const numeroDe = useMemo(() => new Map(fichas.map(f => [f.zonaId, f.numero])), [fichas])

  const visibles = useMemo(() => fichas.filter(f =>
    filtro === 'todas' ? true : filtro === 'pendientes' ? f.pendiente : f.campo.accion === filtro,
  ), [fichas, filtro])

  const marcadas = useMemo(() => fichas.filter(f => sel.has(f.zonaId)), [fichas, sel])

  const cambiarFiltro = (f: Filtro) => {
    const nuevo = filtro === f ? 'todas' : f
    setFiltro(nuevo)
    setFocal(null)
    // Lo marcado que queda fuera del filtro se desmarca: no se decide sobre
    // algo que no se está viendo.
    const quedan = new Set(fichas.filter(x =>
      nuevo === 'todas' ? true : nuevo === 'pendientes' ? x.pendiente : x.campo.accion === nuevo,
    ).map(x => x.zonaId))
    setSel(s => new Set([...s].filter(id => quedan.has(id))))
  }

  // Una zona que ya no existe en geo.zonas se ve, pero no se puede decidir sobre ella.
  const huerfanas = useMemo(() => new Set(fichas.filter(f => f.huerfana).map(f => f.zonaId)), [fichas])

  const alternar = useCallback((zonaId: string) => {
    if (huerfanas.has(zonaId)) return
    setSel(s => {
      const n = new Set(s)
      if (n.has(zonaId)) n.delete(zonaId); else n.add(zonaId)
      return n
    })
  }, [huerfanas])

  const capas: CapaCampo[] = useMemo(() => {
    // Con un filtro o un cambio del historial a la vista, el mapa se acerca a
    // esas zonas; el límite del predio se sigue dibujando, pero no manda.
    const acercar = !!focal || (filtro !== 'todas' && visibles.some(f => f.geom))
    const base: CapaCampo[] = fincaGeoms.map((g, i) => ({
      id: `finca-${i}`, geom: g, tipo: 'finca', etiqueta: 'Límite del predio', sinEncuadre: acercar,
    }))

    if (focal?.tipo === 'rev') {
      const r = focal.rev
      if (r.accion === 'modificada' && r.geom_original) {
        base.push({ id: 'focal-antes', geom: r.geom_original, tipo: 'antes', etiqueta: 'Antes (SIG)' })
      }
      const g = r.geom_corregida ?? r.geom_original
      if (g) base.push({ id: 'focal', geom: g, tipo: r.accion, destacada: true, etiqueta: `Campo · ${ACCION[r.accion].label}` })
      return base
    }
    if (focal?.tipo === 'dec') {
      const d = focal.dec
      if (d.decision === 'editada' && d.geom_previa) {
        base.push({ id: 'focal-antes', geom: d.geom_previa, tipo: 'antes', etiqueta: 'Antes de la edición del SIG' })
      }
      const g = d.geom_nueva ?? d.geom_previa
      const tipo: CapaCampo['tipo'] = d.decision === 'eliminada' ? 'descartada' : d.decision === 'editada' ? 'modificada' : 'confirmada'
      if (g) base.push({ id: 'focal', geom: g, tipo, destacada: true, etiqueta: DECISION[d.decision].label })
      return base
    }

    for (const f of visibles) {
      // Sombra del "antes" solo cuando campo cambió la geometría
      if (f.campo.accion === 'modificada' && f.campo.geom_original) {
        base.push({ id: `${f.zonaId}-antes`, geom: f.campo.geom_original, tipo: 'antes', etiqueta: `Zona ${f.numero} · antes (SIG)` })
      }
      if (f.geom) {
        base.push({
          id: f.zonaId, geom: f.geom, tipo: tipoMapa(f),
          etiqueta: `Zona ${f.numero} · campo: ${ACCION[f.campo.accion].label.toLowerCase()} · ${fmtHa(f.areaHa)} · ${estadoSig(f).texto}`,
          seleccionada: sel.has(f.zonaId),
          rotulo: String(f.numero),
        })
      }
    }
    return base
  }, [fincaGeoms, focal, filtro, visibles, sel])

  const contextoEditor: ContextoEditor[] = useMemo(() => {
    if (!editando) return []
    return [
      ...fincaGeoms.map(g => ({ geom: g, tipo: 'finca' as const })),
      ...fichas.filter(f => f.zonaId !== editando.zonaId && !f.fuera && f.geom).map(f => ({ geom: f.geom!, tipo: 'otra' as const })),
      { geom: editando.original, tipo: 'antes' as const },
    ]
  }, [editando, fincaGeoms, fichas])

  const onCambioEditor = useCallback((g: Geometry) => { setGeomEditada(g); setCambiada(true) }, [])

  // ── Decisiones del SIG ────────────────────────────────────────────────────
  async function decidir(
    decision: 'confirmar' | 'editar' | 'eliminar',
    zonaIds: string[],
    extra: { geometry?: Geometry; nota?: string } = {},
  ): Promise<boolean> {
    if (zonaIds.length === 0 || trabajando) return false
    setTrabajando(decision)
    try {
      const res = await fetchConSesion('/api/sig/campo', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ predio_id: predioId, zona_ids: zonaIds, decision, ...extra }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { avisar('error', body.error ?? 'No se pudo guardar la decisión'); return false }
      const n = Number(body.decididas ?? zonaIds.length)
      avisar('ok',
        decision === 'confirmar' ? `${n} zona(s) confirmada(s) como lote de siembra.`
        : decision === 'editar'  ? `Zona ${numeroDe.get(zonaIds[0]) ?? ''} corregida y confirmada como lote de siembra.`
        : `${n} zona(s) eliminada(s). Siguen en el historial y se pueden volver a confirmar.`)
      setSel(new Set())
      await cargar()
      onCambio?.()
      return true
    } finally {
      setTrabajando(null)
    }
  }

  function empezarEdicion() {
    const f = marcadas[0]
    if (marcadas.length !== 1 || !f?.geom) return
    setFocal(null)
    setEditando({ zonaId: f.zonaId, numero: f.numero, geom: f.geom, original: f.geom })
    setGeomEditada(f.geom)
    setCambiada(false)
    setNotaEdicion('')
    setAvisoZip(null)
    mapaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function cancelarEdicion() {
    setEditando(null); setGeomEditada(null); setCambiada(false); setAvisoZip(null)
  }

  async function guardarEdicion() {
    if (!editando || !geomEditada || !cambiada) return
    const ok = await decidir('editar', [editando.zonaId], { geometry: geomEditada, nota: notaEdicion })
    if (ok) cancelarEdicion()
  }

  // Cargar el límite desde un .zip (p. ej. corregido en QGIS): reemplaza la
  // geometría del editor, donde todavía se puede ajustar antes de guardar.
  async function cargarZip(file: File) {
    setAvisoZip(null); setLeyendoZip(true)
    try {
      const p = await parsearShapefile(file)
      const partes: Position[][][] = []
      for (const f of p.features) {
        if (f.geometry.type === 'Polygon') partes.push(f.geometry.coordinates)
        else if (f.geometry.type === 'MultiPolygon') partes.push(...f.geometry.coordinates)
      }
      if (partes.length === 0) throw new Error('El .zip no trae polígonos.')
      const g: Geometry = partes.length === 1
        ? { type: 'Polygon', coordinates: partes[0] }
        : { type: 'MultiPolygon', coordinates: partes }
      setEditando(e => (e ? { ...e, geom: g } : e))
      setGeomEditada(g)
      setCambiada(true)
      setAvisoZip({
        tipo: 'ok',
        msg: p.features.length > 1
          ? `Se juntaron los ${p.features.length} polígonos del archivo en esta zona. Ajusta los vértices si hace falta y guarda.`
          : 'Límite cargado del archivo. Ajusta los vértices si hace falta y guarda.',
      })
    } catch (e) {
      setAvisoZip({ tipo: 'error', msg: e instanceof Error ? e.message : 'No se pudo leer el shapefile' })
    } finally {
      setLeyendoZip(false)
    }
  }

  async function bajarZonaEditada() {
    if (!editando) return
    const g = geomEditada ?? editando.geom
    setBajando('edicion'); setErrorDescarga(null)
    try {
      await exportarZonas([{
        id: editando.zonaId, nombre: `Zona ${editando.numero}`, tipo: 'restauracion',
        estado: fichas.find(f => f.zonaId === editando.zonaId)?.estado ?? '',
        area_ha: haDe(g), perimetro_m: null, geojson: JSON.stringify(g),
      }], { predio: nombrePredio, sufijo: `zona_${editando.numero}` })
    } catch (e) {
      setErrorDescarga(e instanceof Error ? e.message : 'No se pudo generar el shapefile.')
    } finally {
      setBajando(null)
    }
  }

  function verEnMapa(e: Focal) {
    setFocal(f => (f?.clave === e.clave ? null : e))
    mapaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  // Bitácora: lo de campo y lo del SIG en una sola línea de tiempo.
  const entradas: Entrada[] = useMemo(() => {
    if (!data) return []
    return [
      ...data.revisiones.map((rev, i) => ({ tipo: 'rev' as const, clave: `rev-${rev.local_id ?? i}`, rev, t: ms(rev.created_at) })),
      ...data.decisiones.map(dec => ({ tipo: 'dec' as const, clave: `dec-${dec.id}`, dec, t: ms(dec.created_at) })),
    ].sort((a, b) => b.t - a.t)
  }, [data])

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

  const conteo = fichas.reduce((a, f) => { a[f.campo.accion] = (a[f.campo.accion] ?? 0) + 1; return a }, {} as Record<string, number>)
  const nPendientes = fichas.filter(f => f.pendiente).length
  const evaluadores = [...new Set(revisiones.map(r => r.evaluador).filter(Boolean))]
  const zonasEval = (evaluacion?.zonas_data as Json[] | undefined) ?? []
  const cultivos = (encuesta?.sec_cultivos as Json[] | undefined) ?? []

  const bloqueado = !!data.falta_migracion || trabajando !== null
  const conNucleos = marcadas.some(f => f.nNucleos > 0)
  const motivoEditar = marcadas.length === 0 ? 'Marca una zona'
    : marcadas.length > 1 ? 'Las zonas se editan de a una'
    : conNucleos ? 'Tiene núcleos cargados: retira la nucleación antes de editarla'
    : undefined
  const motivoEliminar = marcadas.length === 0 ? 'Marca una o más zonas'
    : conNucleos ? 'Alguna tiene núcleos cargados: retira la nucleación antes de eliminarla'
    : marcadas.every(f => f.decidida && f.decision?.decision === 'eliminada') ? 'Ya están eliminadas'
    : undefined
  const motivoConfirmar = marcadas.length === 0 ? 'Marca una o más zonas'
    : marcadas.every(f => f.lote) ? 'Ya son lotes de siembra'
    : undefined
  const areaEditada = haDe(geomEditada)

  const etiquetaFiltro = filtro === 'todas' ? 'todas' : filtro === 'pendientes' ? 'pendientes de SIG' : ACCION[filtro].label.toLowerCase()

  return (
    <div className="space-y-5">

      {aviso && (
        <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm border
          ${aviso.tipo === 'ok' ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {aviso.tipo === 'ok' ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" /> : <AlertCircle size={16} className="shrink-0 mt-0.5" />}
          {aviso.msg}
        </div>
      )}

      {/* Lo que devolvió campo: filtros → mapa → zonas → decisión del SIG */}
      <div className="bg-white rounded-2xl border border-stone-100 p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Lo que devolvió campo</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Toca un resultado para verlo en el mapa. Marca zonas en el mapa o en la lista para decidir sobre ellas:
              el SIG tiene la última palabra y el historial de campo no se borra.
            </p>
          </div>
          {evaluadores.length > 0 && (
            <span className="text-xs text-stone-500 flex items-center gap-1"><User size={12} />{evaluadores.join(' · ')}</span>
          )}
        </div>

        {/* Filtros: cada resultado de campo es un botón */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => cambiarFiltro('todas')} disabled={!!editando}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50
              ${filtro === 'todas' ? 'border-stone-800 bg-stone-800 text-white font-bold' : 'border-stone-200 text-stone-700 hover:bg-stone-50'}`}>
            Todas · {fichas.length}
          </button>
          {(Object.keys(ACCION) as Accion[]).map(a => {
            const n = conteo[a] ?? 0
            const { label, color, Icon } = ACCION[a]
            const activo = filtro === a
            return (
              <button key={a} onClick={() => cambiarFiltro(a)} disabled={n === 0 || !!editando}
                aria-pressed={activo}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:cursor-not-allowed
                  ${n === 0 ? 'border-stone-100 text-stone-300' : activo ? 'font-bold text-stone-900' : 'border-stone-200 text-stone-800 hover:bg-stone-50'}`}
                style={activo ? { borderColor: color, background: `${color}1f` } : undefined}>
                <Icon size={12} style={n ? { color } : undefined} /> {n} {label.toLowerCase()}
              </button>
            )
          })}
          {(nPendientes > 0 || filtro === 'pendientes') && (
            <button onClick={() => cambiarFiltro('pendientes')} disabled={!!editando} aria-pressed={filtro === 'pendientes'}
              className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50
                ${filtro === 'pendientes' ? 'border-amber-500 bg-amber-100 text-amber-900 font-bold' : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'}`}>
              <AlertTriangle size={12} /> {nPendientes} pendiente(s) de SIG
            </button>
          )}
          <span className="flex items-center gap-2 sm:ml-auto">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${evaluacion ? 'bg-stone-50 text-stone-600 border-stone-200' : 'bg-stone-50 text-stone-300 border-stone-100'}`}>
              <ClipboardList size={12} /> Evaluación {evaluacion ? 'diligenciada' : 'pendiente'}
            </span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border ${encuesta ? 'bg-stone-50 text-stone-600 border-stone-200' : 'bg-stone-50 text-stone-300 border-stone-100'}`}>
              <BarChart2 size={12} /> Encuesta {encuesta ? 'diligenciada' : 'pendiente'}
            </span>
          </span>
        </div>

        {data.falta_migracion && (
          <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {data.falta_migracion}
          </p>
        )}

        {errorDescarga && (
          <p className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            <AlertCircle size={13} className="shrink-0 mt-0.5" /> {errorDescarga}
          </p>
        )}

        {/* Mapa (o editor) */}
        {fichas.length > 0 || revisiones.length > 0 ? (
          <div ref={mapaRef} className="space-y-3 scroll-mt-4">
            {editando ? (
              <>
                <div className="flex items-start justify-between gap-3 flex-wrap bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-stone-800">Editando la zona {editando.numero}</p>
                    <p className="text-[11px] text-stone-600 mt-0.5 leading-relaxed">
                      Arrastra un vértice para moverlo · tócalo para quitarlo · arrastra el punto medio de un lado para agregar uno.
                      La línea blanca punteada es el límite de antes. Si lo corregiste en QGIS, carga el .zip.
                    </p>
                  </div>
                  <p className="text-xs text-stone-700 shrink-0">
                    Área: <strong>{fmtHa(areaEditada)}</strong>
                  </p>
                </div>

                <EditorZona geom={editando.geom} contexto={contextoEditor} onCambio={onCambioEditor} />

                {avisoZip && (
                  <p className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border
                    ${avisoZip.tipo === 'ok' ? 'bg-teal-50 border-teal-200 text-teal-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                    {avisoZip.tipo === 'ok' ? <CheckCircle2 size={13} className="shrink-0 mt-0.5" /> : <AlertCircle size={13} className="shrink-0 mt-0.5" />}
                    {avisoZip.msg}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-colors cursor-pointer ${leyendoZip ? 'opacity-50 pointer-events-none' : ''}`}>
                    {leyendoZip ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />}
                    Cargar límite desde .zip
                    <input type="file" accept=".zip,application/zip" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) cargarZip(f) }} />
                  </label>
                  <button onClick={bajarZonaEditada} disabled={bajando !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-colors disabled:opacity-50">
                    {bajando === 'edicion' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    Bajar esta zona (.shp)
                  </button>
                  <input value={notaEdicion} onChange={e => setNotaEdicion(e.target.value)} maxLength={1000}
                    placeholder="Nota para el historial (opcional)"
                    className="flex-1 min-w-48 px-3 py-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:border-teal-400" />
                  <button onClick={cancelarEdicion} disabled={trabajando !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-stone-500 text-xs font-bold hover:text-stone-800 transition-colors">
                    <X size={13} /> Cancelar
                  </button>
                  <button onClick={guardarEdicion} disabled={!cambiada || bloqueado}
                    title={!cambiada ? 'Mueve al menos un vértice o carga un .zip' : undefined}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {trabajando === 'editar' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Guardar y confirmar como lote
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {focal ? (
                    <p className="text-xs text-stone-600 flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-stone-800">Viendo en el mapa:</span>
                      {focal.tipo === 'rev'
                        ? <>Zona {numeroDe.get(focal.rev.zona_id ?? '') ?? '—'} · campo · {ACCION[focal.rev.accion].label.toLowerCase()} · {fmtFecha(focal.rev.fecha ?? focal.rev.created_at)}</>
                        : <>Zona {numeroDe.get(focal.dec.zona_id ?? '') ?? '—'} · {DECISION[focal.dec.decision].frase} · {fmtFecha(focal.dec.created_at)}</>}
                      <button onClick={() => setFocal(null)} className="inline-flex items-center gap-1 font-bold text-teal-600 hover:underline">
                        <Undo2 size={12} /> Volver a las zonas
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-stone-500">
                      {visibles.length} zona(s) en el mapa{filtro !== 'todas' && <> · filtro: <strong>{etiquetaFiltro}</strong></>}
                    </p>
                  )}
                  <button
                    onClick={() => descargar(revisiones.filter(r => r.geom_original || r.geom_corregida), 'cambios_campo', 'todo')}
                    disabled={bajando !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-200 text-teal-700 text-xs font-bold hover:bg-teal-50 transition-colors disabled:opacity-50">
                    {bajando === 'todo' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    Descargar todos los cambios (.shp)
                  </button>
                </div>

                <MapaCampo
                  capas={capas}
                  onClickCapa={focal ? undefined : alternar}
                  encuadre={focal ? `focal:${focal.clave}` : `filtro:${filtro}`}
                />

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500">
                  {([
                    ['finca',      'Límite del predio',            true],
                    ['antes',      'Antes (lo que dibujó el SIG)', true],
                    ['confirmada', 'Confirmada',                   false],
                    ['modificada', 'Corregida',                    false],
                    ['nueva',      'Nueva (dibujada en campo)',    false],
                    ['descartada', 'Descartada o eliminada',       true],
                  ] as const).map(([tipo, texto, punteada]) => (
                    <span key={tipo} className="inline-flex items-center gap-1.5">
                      <i className={`w-3 h-2 ${tipo === 'finca' ? 'border-2' : 'border'} ${punteada ? 'border-dashed' : ''}`}
                        style={{ borderColor: COLOR_CAMPO[tipo], background: tipo === 'finca' ? undefined : `${COLOR_CAMPO[tipo]}55` }} />
                      {texto}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1.5">
                    <i className="w-3 h-2 border-2" style={{ borderColor: COLOR_SELECCION, background: `${COLOR_SELECCION}40` }} />
                    Marcada
                  </span>
                </div>
              </>
            )}
          </div>
        ) : null}

        {/* Zonas del filtro + decisión del SIG */}
        {!editando && fichas.length > 0 && (
          <div className="space-y-3">
            <div className="border border-stone-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-3 py-2 bg-stone-50 text-xs">
                <span className="font-bold text-stone-500">
                  {marcadas.length > 0 ? `${marcadas.length} de ${visibles.length} marcada(s)` : `${visibles.length} zona(s) · ${etiquetaFiltro}`}
                </span>
                <span className="flex items-center gap-3">
                  <button onClick={() => setSel(new Set(visibles.filter(f => !f.huerfana).map(f => f.zonaId)))}
                    className="font-bold text-teal-600 hover:underline">Marcar todas</button>
                  <button onClick={() => setSel(new Set())} className="font-bold text-stone-400 hover:underline">Limpiar</button>
                </span>
              </div>
              <div className="divide-y divide-stone-50 max-h-96 overflow-y-auto">
                {visibles.length === 0 && (
                  <p className="px-3 py-4 text-xs text-stone-400 text-center">Ninguna zona con este resultado.</p>
                )}
                {visibles.map(f => {
                  const on = sel.has(f.zonaId)
                  const { label, color, Icon } = ACCION[f.campo.accion]
                  const est = estadoSig(f)
                  return (
                    <button key={f.zonaId} type="button" onClick={() => alternar(f.zonaId)} disabled={f.huerfana}
                      title={f.huerfana ? 'Esta zona ya no existe en la base: no se puede decidir sobre ella' : undefined}
                      className={`w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                        ${on ? 'bg-amber-50/80' : 'hover:bg-stone-50'}`}>
                      <span className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${on ? 'border-amber-500 bg-amber-400' : 'border-stone-300'}`}>
                        {on && <Check size={11} className="text-white" />}
                      </span>
                      <span className="text-sm font-black text-stone-800 shrink-0 w-16">Zona {f.numero}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 border border-stone-200 text-stone-800" style={{ borderLeft: `3px solid ${color}` }}>
                            <Icon size={11} /> Campo: {label.toLowerCase()}
                          </span>
                          <span className="text-xs text-stone-600">{fmtHa(f.areaHa)}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${est.clase}`}>{est.texto}</span>
                          {f.nNucleos > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border bg-stone-50 text-stone-600 border-stone-200">
                              <Sprout size={11} /> {f.nNucleos} núcleo(s)
                            </span>
                          )}
                        </span>
                        <span className="block text-[11px] text-stone-400 mt-0.5">
                          <span className="inline-flex items-center gap-1"><User size={10} />{f.campo.evaluador ?? 'sin nombre'}</span>
                          {' · '}{fmtFecha(f.campo.fecha ?? f.campo.created_at)}
                          {f.campo.observaciones && <span className="italic"> · “{f.campo.observaciones}”</span>}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm font-bold text-stone-700">
                  {marcadas.length > 0 ? `Decidir sobre ${marcadas.length} zona(s)` : 'Marca zonas para decidir'}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => decidir('confirmar', marcadas.map(f => f.zonaId))}
                    disabled={bloqueado || !!motivoConfirmar} title={motivoConfirmar}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {trabajando === 'confirmar' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Confirmar
                  </button>
                  <button onClick={empezarEdicion}
                    disabled={bloqueado || !!motivoEditar} title={motivoEditar}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 text-xs font-bold hover:bg-stone-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <Pencil size={13} /> Editar
                  </button>
                  <button onClick={() => { setNotaEliminar(''); setConfirmarEliminar(true) }}
                    disabled={bloqueado || !!motivoEliminar} title={motivoEliminar}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-200 bg-white text-rose-700 text-xs font-bold hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {trabajando === 'eliminar' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Eliminar
                  </button>
                </div>
              </div>
              {marcadas.length > 0 && (motivoConfirmar || motivoEditar || motivoEliminar) && (
                <p className="flex items-start gap-1.5 text-[11px] text-amber-800">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  {[...new Set([motivoConfirmar, motivoEditar, motivoEliminar].filter(Boolean))].join(' · ')}
                </p>
              )}
              <p className="text-[11px] text-stone-500 leading-relaxed">
                <strong>Confirmar</strong> deja la zona como lote de siembra, aunque campo la haya descartado.{' '}
                <strong>Editar</strong> corrige el límite en el mapa (o desde un .zip) y la deja como lote.{' '}
                <strong>Eliminar</strong> la saca de los sitios de siembra y de la app de campo; no se borra y se puede volver a confirmar.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bitácora: campo y SIG en una sola línea de tiempo */}
      {entradas.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-stone-100">
            <h2 className="font-black text-stone-800 text-sm uppercase tracking-wider">Bitácora de revisiones</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Cada acción del equipo de campo y cada decisión del SIG, de la más reciente a la más antigua. Toca una
              para verla en el mapa. El ícono de descarga baja esa corrección de campo como shapefile, con el antes y el después.
            </p>
          </div>
          <div className="divide-y divide-stone-50">
            {entradas.map((e, i) => {
              const activo = focal?.clave === e.clave
              if (e.tipo === 'dec') {
                const d = e.dec
                const { frase, Icon } = DECISION[d.decision]
                return (
                  <button key={e.clave} onClick={() => verEnMapa(e)}
                    className={`w-full px-5 py-3 flex items-start gap-3 text-left transition-colors ${activo ? 'bg-teal-50/60' : 'hover:bg-stone-50/70'}`}>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded bg-stone-800 text-white shrink-0">
                      <Icon size={11} /> SIG
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-stone-700">
                        <strong>Zona {numeroDe.get(d.zona_id ?? '') ?? '—'}</strong> · {frase}
                        {d.decision === 'editada' && d.area_ha != null && <> · quedó en <strong>{fmtHa(d.area_ha)}</strong></>}
                        {d.decision !== 'eliminada' && <span className="text-stone-400"> · lote de siembra</span>}
                      </span>
                      {d.nota && <span className="block text-xs text-stone-500 mt-0.5 italic">“{d.nota}”</span>}
                      <span className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1"><User size={10} />{d.decidido_por ?? 'sin nombre'}</span>
                        <span className="inline-flex items-center gap-1"><Calendar size={10} />{fmtFecha(d.created_at)}</span>
                      </span>
                    </span>
                  </button>
                )
              }
              const r = e.rev
              const { label, color, Icon } = ACCION[r.accion]
              const tieneGeom = !!(r.geom_original || r.geom_corregida)
              return (
                <div key={e.clave}
                  className={`px-5 py-3 flex items-start gap-3 transition-colors ${activo ? 'bg-teal-50/60' : 'hover:bg-stone-50/70'}`}>
                  <button onClick={() => verEnMapa(e)} className="flex-1 min-w-0 flex items-start gap-3 text-left">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 border border-stone-200 text-stone-800 shrink-0" style={{ borderLeft: `3px solid ${color}` }}>
                      <Icon size={11} /> {label}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-stone-700">
                        {r.zona_id && numeroDe.has(r.zona_id) && <strong>Zona {numeroDe.get(r.zona_id)} · </strong>}
                        {r.accion === 'modificada' && r.area_ha_campo != null
                          ? <>Quedó en <strong>{fmtHa(r.area_ha_campo)}</strong>{r.metodo && <span className="text-stone-400"> · por {r.metodo}</span>}</>
                          : r.accion === 'nueva' && r.area_ha_campo != null
                            ? <>Zona dibujada en terreno de <strong>{fmtHa(r.area_ha_campo)}</strong></>
                            : <span className="text-stone-500">Sin cambio de geometría</span>}
                      </span>
                      {r.observaciones && <span className="block text-xs text-stone-500 mt-0.5 italic">“{r.observaciones}”</span>}
                      <span className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1"><User size={10} />{r.evaluador ?? 'sin nombre'}</span>
                        <span className="inline-flex items-center gap-1"><Calendar size={10} />{fmtFecha(r.fecha ?? r.created_at)}</span>
                      </span>
                    </span>
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

      {/* Confirmar eliminación */}
      {confirmarEliminar && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 size={20} className="text-rose-600" />
              <h3 className="font-black text-stone-900 text-lg">Eliminar {marcadas.length} zona(s)</h3>
            </div>
            <p className="text-sm text-stone-600 mb-2">
              {marcadas.length === 1
                ? `La zona ${marcadas[0].numero} deja de ser sitio de siembra: sale de los sitios de siembra, de Nucleación y de la app de campo.`
                : `Las zonas ${marcadas.map(f => f.numero).join(', ')} dejan de ser sitios de siembra: salen de los sitios de siembra, de Nucleación y de la app de campo.`}
            </p>
            <p className="text-[11px] text-stone-400 mb-3">
              No se borra nada: la zona queda en la base y en el historial, y se puede volver a confirmar desde aquí.
            </p>
            <textarea value={notaEliminar} onChange={e => setNotaEliminar(e.target.value)} maxLength={1000} rows={2}
              placeholder="Motivo (opcional, queda en el historial)"
              className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm mb-4 focus:outline-none focus:border-rose-300" />
            <div className="flex gap-3">
              <button onClick={() => setConfirmarEliminar(false)} disabled={trabajando !== null}
                className="flex-1 py-2.5 border border-stone-200 text-stone-600 rounded-xl text-sm font-bold hover:bg-stone-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  // Se cierra pase lo que pase: si falló, el aviso de arriba dice por qué.
                  await decidir('eliminar', marcadas.map(f => f.zonaId), { nota: notaEliminar })
                  setConfirmarEliminar(false)
                }}
                disabled={trabajando !== null}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                {trabajando === 'eliminar' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
