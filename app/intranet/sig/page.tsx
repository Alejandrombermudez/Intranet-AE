'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { Boton, Cabecera, Cargando } from '@/app/components/marca'
import type { SigWorklistRow } from '@/app/api/sig/worklist/route'
// El estado jurídico se lee con la MISMA configuración que el tablero de
// jurídica (etiquetas y colores): si allá cambia un nombre, aquí cambia solo.
import {
  ESTADO_CONFIG, ESTADOS_FLUJO, SEMAFORO_CONFIG,
  type EstadoAliado, type Semaforo,
} from '@/lib/juridica-schema'
import {
  Search, Loader2, ChevronRight, MapPin, Layers, Hexagon, Sprout, ClipboardCheck, HelpCircle, X,
  Info, Combine, Check, AlertTriangle, Users, Scale,
} from 'lucide-react'

const fmt = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 })

// ─── Las 4 fases del trabajo del SIG ─────────────────────────────────────────
// El eje real no es la etapa del expediente sino qué cartografía falta.
type Fase = SigWorklistRow['fase']

/**
 * Cada fase lleva su color, pero en velo: fondo translúcido sobre el papel y
 * filete del mismo tono, como manda el manual (filetes finos en vez de cajas de
 * color).
 *
 * Los cuatro tonos y el 20 % no salieron a ojo. La paleta de Tailwind está
 * remapeada a la marca, que es terrosa y de poco croma, y en `-50` las cuatro
 * tarjetas quedaban casi del mismo beige: medido en Lab, el par más parecido
 * ("Listo para campo" y "En campo") daba **ΔE 4.7** — o sea, no servían de guía.
 * Aguar más el color lo empeoraba: el azul pizarra y el verde bosque al 8 %
 * colapsan en el mismo gris (ΔE 2.8, indistinguibles).
 *
 * Lo que sí separa es elegir tonos con hue bien distinto —arcilla, ámbar,
 * **cielo** y **verde bosque**, los cuatro del manual— y subir el velo al 20 %:
 * el par más parecido pasa a **ΔE 8.1** y todos los textos quedan sobre 6:1 de
 * contraste (WCAG AA pide 4.5). Si se cambia un tono o el porcentaje, vale
 * volver a medirlo: bajar del 15 % devuelve las tarjetas al beige único.
 */
const FASES: { id: Fase; label: string; ayuda: string; cls: string; activo: string; punto: string }[] = [
  { id: 'sin_cartografia',  label: 'Sin cartografía',   ayuda: 'No tienen ni el polígono del predio',        cls: 'text-rose-700 bg-rose-400/20 border-rose-400/35',      activo: 'bg-rose-400/35 ring-rose-400/60',      punto: 'bg-rose-500' },
  { id: 'solo_predio',      label: 'Falta zonificar',   ayuda: 'Ya tienen predio, faltan zonas de siembra',  cls: 'text-amber-800 bg-amber-400/20 border-amber-400/40',   activo: 'bg-amber-400/35 ring-amber-400/60',    punto: 'bg-amber-400' },
  { id: 'listo_para_campo', label: 'Listo para campo',  ayuda: 'Predio y zonas cargadas, sin enviar',        cls: 'text-sky-700 bg-cielo/20 border-cielo/45',             activo: 'bg-cielo/35 ring-cielo/70',            punto: 'bg-cielo' },
  { id: 'en_campo',         label: 'En campo',          ayuda: 'Ya lo está trabajando el equipo de terreno', cls: 'text-emerald-800 bg-bosque/20 border-bosque/30',       activo: 'bg-bosque/32 ring-bosque/45',          punto: 'bg-bosque' },
]
const faseDe = (f: Fase) => FASES.find(x => x.id === f)!

// El estado jurídico que llega de la base puede no estar en el catálogo (dato
// viejo): en ese caso se muestra crudo en gris en vez de romper la fila.
const estadoCfg = (e: string) => ESTADO_CONFIG[e as EstadoAliado] ?? { label: e, bg: 'bg-stone-100', text: 'text-stone-500' }
const semaforoCfg = (s: string | null) => (s ? SEMAFORO_CONFIG[s as Semaforo] ?? null : null)

/**
 * Una línea de trabajo del tablero.
 *
 * La parte predial y la cartográfica no van una a una: un polígono de siembra
 * puede caer sobre varios predios. Cuando el SIG los fusiona, la **unidad** es
 * la línea de trabajo —con el predio principal a la cabeza y los demás
 * plegados debajo—, no N predios contándose como "sin cartografía" cada uno.
 */
interface Unidad {
  principal: SigWorklistRow
  miembros:  SigWorklistRow[]      // vacío = predio suelto
}
const predios = (u: Unidad) => [u.principal, ...u.miembros]

export default function SigPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [rows, setRows] = useState<SigWorklistRow[]>([])
  const [loading, setLoading] = useState(true)

  const [busqueda, setBusqueda]   = useState('')
  const [fase, setFase]           = useState<Fase | null>(null)
  const [municipio, setMunicipio] = useState('')
  const [zonaAe, setZonaAe]       = useState('')
  const [juridico, setJuridico]   = useState('')   // estado de la debida diligencia
  const [ayuda, setAyuda]         = useState(false)
  const [tope, setTope]           = useState(40)   // no volcar 111 filas de golpe

  // ── Fusionar predios en una unidad de siembra ──
  const [modoFusion, setModoFusion] = useState(false)
  const [seleccion, setSeleccion]   = useState<Set<string>>(new Set())
  const [confirmar, setConfirmar]   = useState(false)
  const [principal, setPrincipal]   = useState<string | null>(null)
  const [nombreUnidad, setNombre]   = useState('')
  const [fusionando, setFusionando] = useState(false)
  const [errFusion, setErrFusion]   = useState<string | null>(null)
  const [toast, setToast]           = useState<{ tipo: 'ok' | 'error'; msg: string } | null>(null)
  const avisar = (tipo: 'ok' | 'error', msg: string) => { setToast({ tipo, msg }); setTimeout(() => setToast(null), 4000) }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: p } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department, can_access_intranet')
        .eq('email', user.email)
        .single()
      if (!p?.is_admin && !p?.can_access_intranet && !p?.department) { router.push('/'); return }
      setUserEmail(user.email ?? null)
      setAuthReady(true)
    })
  }, [router])

  async function cargar() {
    const r = await fetchConSesion('/api/sig/worklist')
    const data: SigWorklistRow[] = await r.json()
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    if (!authReady || !userEmail) return
    cargar().catch(() => setLoading(false))
  }, [authReady, userEmail])

  // ── Plegar los predios fusionados bajo su principal ──
  const unidades = useMemo<Unidad[]>(() => {
    const porGrupo = new Map<string, SigWorklistRow[]>()
    const sueltos: SigWorklistRow[] = []
    for (const r of rows) {
      if (!r.grupo_id) { sueltos.push(r); continue }
      const l = porGrupo.get(r.grupo_id) ?? []
      l.push(r)
      porGrupo.set(r.grupo_id, l)
    }
    const us: Unidad[] = sueltos.map(r => ({ principal: r, miembros: [] }))
    for (const [, miembros] of porGrupo) {
      // Si el principal no llegó en esta página de datos, encabeza el primero:
      // la unidad se sigue viendo en vez de desaparecer del tablero.
      const cabeza = miembros.find(m => m.es_principal) ?? miembros[0]
      us.push({ principal: cabeza, miembros: miembros.filter(m => m !== cabeza) })
    }
    return us
  }, [rows])

  const conteos = useMemo(() => {
    const c: Record<Fase, number> = { sin_cartografia: 0, solo_predio: 0, listo_para_campo: 0, en_campo: 0 }
    for (const u of unidades) c[u.principal.fase]++
    return c
  }, [unidades])

  const municipios = useMemo(
    () => [...new Set(rows.map(r => r.municipio).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  )
  const zonas = useMemo(
    () => [...new Set(rows.map(r => r.zona_ae).filter((z): z is string => !!z))].sort((a, b) => a.localeCompare(b)),
    [rows],
  )
  // Estados jurídicos presentes, en el orden del flujo de jurídica (no alfabético)
  // y con cuántos predios hay en cada uno. No se ofrecen opciones vacías.
  const estadosJuridicos = useMemo(() => {
    const c = new Map<string, number>()
    for (const r of rows) c.set(r.dd_estado, (c.get(r.dd_estado) ?? 0) + 1)
    const orden = (e: string) => { const i = (ESTADOS_FLUJO as string[]).indexOf(e); return i < 0 ? 99 : i }
    return [...c].sort((a, b) => orden(a[0]) - orden(b[0]))
  }, [rows])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    // Un filtro que coincida con CUALQUIER predio de la unidad la deja visible:
    // si se busca la vereda de un miembro, la unidad tiene que aparecer.
    const coincide = (r: SigWorklistRow) => {
      if (municipio && r.municipio !== municipio) return false
      if (zonaAe && r.zona_ae !== zonaAe) return false
      if (juridico && r.dd_estado !== juridico) return false
      if (!q) return true
      return r.nombre_completo.toLowerCase().includes(q)
        || (r.nombre_predio ?? '').toLowerCase().includes(q)
        || (r.matricula_inmobiliaria ?? '').toLowerCase().includes(q)
        || r.municipio.toLowerCase().includes(q)
        || (r.vereda ?? '').toLowerCase().includes(q)
    }
    const filtrados = unidades.filter(u => {
      if (fase && u.principal.fase !== fase) return false   // la fase es la de la cartografía: la del principal
      return predios(u).some(coincide)
    })
    // Primero los que ya tienen trabajo encima: son los pocos que hay que
    // mirar. El grueso sin cartografía es la bolsa de pendientes y se llega a
    // ella por su tarjeta, no invadiendo la vista de entrada.
    const orden: Record<Fase, number> = { en_campo: 0, listo_para_campo: 1, solo_predio: 2, sin_cartografia: 3 }
    return filtrados.sort((a, b) =>
      orden[a.principal.fase] - orden[b.principal.fase] ||
      a.principal.municipio.localeCompare(b.principal.municipio) ||
      (a.principal.nombre_predio ?? '').localeCompare(b.principal.nombre_predio ?? ''),
    )
  }, [unidades, busqueda, fase, municipio, zonaAe, juridico])

  const hayFiltro = !!(fase || municipio || zonaAe || juridico || busqueda.trim())
  const limpiar = () => { setFase(null); setMunicipio(''); setZonaAe(''); setJuridico(''); setBusqueda(''); setTope(40) }
  const mostrados = visibles.slice(0, tope)

  // ── Selección para fusionar ──
  const porId = useMemo(() => new Map(rows.map(r => [r.predio_id, r])), [rows])
  const elegidos = useMemo(
    () => [...seleccion].map(id => porId.get(id)).filter((r): r is SigWorklistRow => !!r),
    [seleccion, porId],
  )
  const salirFusion = () => { setModoFusion(false); setSeleccion(new Set()); setConfirmar(false); setErrFusion(null) }
  const marcar = (id: string) => {
    const n = new Set(seleccion)
    if (n.has(id)) n.delete(id); else n.add(id)
    setSeleccion(n)
  }

  function abrirConfirmacion() {
    if (elegidos.length < 2) return
    // Por defecto lleva la cartografía el que ya tenga polígono; si ninguno, el primero.
    const conPoligono = elegidos.find(r => r.tiene_finca) ?? elegidos[0]
    setPrincipal(conPoligono.predio_id)
    setNombre(conPoligono.nombre_predio ?? '')
    setErrFusion(null)
    setConfirmar(true)
  }

  async function fusionar() {
    if (!principal || elegidos.length < 2 || fusionando) return
    setFusionando(true); setErrFusion(null)
    try {
      const res = await fetchConSesion('/api/sig/grupos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predio_ids: elegidos.map(r => r.predio_id),
          predio_principal_id: principal,
          nombre: nombreUnidad.trim() || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) { setErrFusion(body.error ?? 'No se pudo fusionar'); return }
      salirFusion()
      await cargar()
      avisar('ok', `Unidad de siembra creada con ${body.n_predios} predios. Sube el polígono total en el predio principal.`)
    } catch {
      setErrFusion('No se pudo fusionar. Revisa la conexión e intenta de nuevo.')
    } finally {
      setFusionando(false)
    }
  }

  const municipiosElegidos = new Set(elegidos.map(r => r.municipio))
  const duenosElegidos     = new Set(elegidos.map(r => r.aliado_id))

  if (!authReady) return <Cargando texto="Cargando la cola cartográfica…" />

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        volver={{ href: '/intranet', label: 'Intranet' }}
        modulo="Módulo SIG"
        titulo="Cola de trabajo cartográfico"
        descripcion={`${rows.length} predios, ordenados por lo que les falta de cartografía.`}
        acciones={
          <Boton variante="claro" onClick={() => setAyuda(a => !a)} icono={<HelpCircle size={14} />}>
            ¿Qué significa cada cosa?
          </Boton>
        }
      />

      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 space-y-5">

        {ayuda && (
          <div className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3 text-sm text-stone-600">
            <div className="flex items-start justify-between gap-3">
              <p className="font-black text-stone-800">Cómo leer este tablero</p>
              <button onClick={() => setAyuda(false)} className="text-stone-300 hover:text-stone-600"><X size={16} /></button>
            </div>
            <ul className="space-y-1.5 leading-relaxed">
              <li>· <strong>Predio</strong> = el polígono de la finca (el .zip del lindero). <strong>Zonas</strong> = los sitios de siembra dentro de ella.</li>
              <li>· Un predio solo puede enviarse a Campo cuando tiene <strong>al menos una zona de siembra</strong>.</li>
              <li>· <strong>Área medida</strong> es la que calcula PostGIS sobre el shapefile que subiste. Es la real.</li>
              <li>· <strong>Área registral</strong> es la que dice la escritura o el certificado de tradición, y la captura Jurídica a mano en el expediente — <em>no</em> sale del shapefile. Por eso hay predios con área registral y sin cartografía, y por eso las dos cifras casi nunca coinciden exactamente.</li>
              <li>· Si las dos difieren mucho, vale revisar: suele ser diferencia entre lo escriturado y lo realmente ocupado.</li>
              <li>· <strong>Unidad de siembra</strong> = varios predios que comparten un mismo polígono. Se arman con <strong>Fusionar predios</strong>: la parte predial sigue separada (cada uno con su matrícula, su dueño y su expediente) y el polígono total se sube una sola vez, en el predio principal.</li>
              <li>· El <strong>estado jurídico</strong> es el mismo que ve jurídica (la debida diligencia), con el punto del semáforo del análisis del folio. Sirve para no gastar cartografía en un predio que jurídica ya rechazó, o para ver por qué uno todavía no avanza. Se puede filtrar por él, y dentro de cada predio está el botón <strong>Ver caso jurídico</strong> con el expediente completo.</li>
            </ul>
          </div>
        )}

        {/* Fases — son los filtros principales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {FASES.map(f => {
            const activo = fase === f.id
            return (
              <button key={f.id} onClick={() => setFase(activo ? null : f.id)}
                aria-pressed={activo}
                className={`text-left rounded-2xl border px-4 py-3 transition-all ${f.cls} ${activo ? `ring-2 ${f.activo}` : 'hover:bg-white/40'}`}>
                <div className="flex items-baseline gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${f.punto} shrink-0`} />
                  <p className="text-2xl font-black leading-none">{conteos[f.id]}</p>
                </div>
                <p className="text-sm font-bold mt-1">{f.label}</p>
                <p className="text-[11px] opacity-70 leading-snug mt-0.5">{f.ayuda}</p>
              </button>
            )
          })}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por persona, predio, matrícula, municipio o vereda…"
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors"
            />
          </div>
          <select value={municipio} onChange={e => setMunicipio(e.target.value)}
            className="px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400">
            <option value="">Todos los municipios</option>
            {municipios.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {zonas.length > 0 && (
            <select value={zonaAe} onChange={e => setZonaAe(e.target.value)}
              className="px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400">
              <option value="">Todas las zonas AE</option>
              {zonas.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          )}
          {/* Estado jurídico — mismas etiquetas y mismo orden de flujo que el
              tablero de jurídica, para no tener dos vocabularios. */}
          <select value={juridico} onChange={e => setJuridico(e.target.value)}
            title="Estado de la debida diligencia, el mismo que ve jurídica"
            className="px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400">
            <option value="">Todo estado jurídico</option>
            {estadosJuridicos.map(([e, n]) => (
              <option key={e} value={e}>{estadoCfg(e).label} ({n})</option>
            ))}
          </select>
          {hayFiltro && (
            <button onClick={limpiar} className="flex items-center gap-1 px-3 py-2.5 text-xs font-bold text-stone-500 hover:text-stone-800">
              <X size={13} /> Limpiar
            </button>
          )}
          {modoFusion ? (
            <button onClick={salirFusion}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-stone-500 hover:text-stone-800 border border-stone-200 rounded-xl">
              <X size={13} /> Salir de fusionar
            </button>
          ) : (
            <button onClick={() => setModoFusion(true)}
              title="Varios predios que forman un solo polígono de siembra"
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-teal-700 border border-teal-200 rounded-xl hover:bg-teal-50 transition-colors">
              <Combine size={14} /> Fusionar predios
            </button>
          )}
        </div>

        {modoFusion && (
          <div className="flex items-start gap-2 bg-teal-50 border border-teal-100 rounded-xl px-4 py-3 text-xs text-teal-800">
            <Combine size={14} className="shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Marca los predios sobre los que cae <strong>un mismo polígono de siembra</strong>. No se funden los
              registros: cada predio conserva su matrícula, su dueño y su expediente jurídico — lo que se comparte
              es la cartografía, y el polígono total se sube una sola vez en el predio principal.
            </p>
          </div>
        )}

        <p className="text-xs text-stone-400">
          {visibles.length === unidades.length
            ? `${unidades.length} líneas de trabajo · primero las que ya tienen cartografía o están en campo`
            : `${visibles.length} de ${unidades.length} líneas de trabajo`}
        </p>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-stone-300" size={36} /></div>
        ) : visibles.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <Layers size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">{rows.length === 0 ? 'Aún no hay predios en SIG' : 'Ningún predio coincide con el filtro'}</p>
            {hayFiltro && <button onClick={limpiar} className="text-sm text-teal-600 font-bold mt-2 hover:underline">Quitar filtros</button>}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-100 divide-y divide-stone-50">
            {mostrados.map(u => (
              <FilaUnidad
                key={u.principal.grupo_id ?? u.principal.predio_id}
                unidad={u}
                modoFusion={modoFusion}
                seleccion={seleccion}
                onMarcar={marcar}
              />
            ))}

            {visibles.length > mostrados.length && (
              <button onClick={() => setTope(t => t + 60)}
                className="w-full py-3 text-sm font-bold text-teal-600 hover:bg-stone-50 transition-colors">
                Ver {Math.min(60, visibles.length - mostrados.length)} más
                <span className="text-stone-400 font-normal"> ({visibles.length - mostrados.length} restantes)</span>
              </button>
            )}
          </div>
        )}

        <div className="flex items-start gap-2 text-[11px] text-stone-400 px-1">
          <Info size={13} className="shrink-0 mt-0.5" />
          <p>
            La cifra grande es el <strong>área medida</strong> sobre el shapefile; la pequeña es el <strong>área registral</strong>
            que Jurídica captura de la escritura. Son dos fuentes distintas y no tienen por qué coincidir.
          </p>
        </div>
      </div>

      {/* Barra de acción de la selección */}
      {modoFusion && seleccion.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-stone-200 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-stone-600">
              <strong className="text-stone-900">{seleccion.size} predio{seleccion.size > 1 ? 's' : ''}</strong> seleccionado{seleccion.size > 1 ? 's' : ''}
              {seleccion.size < 2 && <span className="text-stone-400"> · marca al menos dos</span>}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setSeleccion(new Set())} className="px-3 py-2 text-xs font-bold text-stone-500 hover:text-stone-800">
                Quitar selección
              </button>
              <Boton onClick={abrirConfirmacion} disabled={seleccion.size < 2} icono={<Combine size={14} />}>
                Fusionar en una unidad
              </Boton>
            </div>
          </div>
        </div>
      )}

      {/* Confirmación: quién lleva la cartografía */}
      {confirmar && (
        <div className="fixed inset-0 z-40 bg-stone-900/40 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-stone-100 flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-stone-900">Fusionar {elegidos.length} predios</p>
                <p className="text-xs text-stone-500 mt-0.5">Un solo polígono de siembra para todos</p>
              </div>
              <button onClick={() => setConfirmar(false)} className="text-stone-300 hover:text-stone-600"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-500">Nombre de la unidad</label>
                <input value={nombreUnidad} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Unidad Rochela Alta"
                  className="w-full px-3 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400" />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-stone-500">¿Cuál predio lleva la cartografía?</p>
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  El polígono total se sube en ese predio. Conviene el que ya tenga el lindero cargado.
                </p>
                <div className="border border-stone-100 rounded-xl divide-y divide-stone-50">
                  {elegidos.map(r => {
                    const on = principal === r.predio_id
                    return (
                      <button key={r.predio_id} type="button" onClick={() => setPrincipal(r.predio_id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${on ? 'bg-teal-50' : 'hover:bg-stone-50'}`}>
                        <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${on ? 'border-teal-500 bg-teal-500' : 'border-stone-300'}`}>
                          {on && <Check size={10} className="text-white" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-stone-800 truncate">
                            {r.nombre_predio || '(predio sin nombre)'}
                          </span>
                          <span className="block text-[11px] text-stone-400 truncate">
                            {r.nombre_completo} · {r.municipio}
                          </span>
                        </span>
                        {r.tiene_finca && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 shrink-0">con lindero</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {(municipiosElegidos.size > 1 || duenosElegidos.size > 1) && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <div className="space-y-1 leading-relaxed">
                    {municipiosElegidos.size > 1 && (
                      <p>La unidad cruza <strong>{municipiosElegidos.size} municipios</strong> ({[...municipiosElegidos].join(', ')}). Confirma que es correcto.</p>
                    )}
                    {duenosElegidos.size > 1 && (
                      <p>Son <strong>{duenosElegidos.size} propietarios distintos</strong>. Cada uno conserva su expediente jurídico aparte; solo se comparte el polígono.</p>
                    )}
                  </div>
                </div>
              )}

              {errFusion && (
                <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">{errFusion}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmar(false)} className="px-3 py-2 text-xs font-bold text-stone-500 hover:text-stone-800">
                Cancelar
              </button>
              <Boton onClick={fusionar} disabled={fusionando || !principal}
                icono={fusionando ? <Loader2 size={14} className="animate-spin" /> : <Combine size={14} />}>
                {fusionando ? 'Fusionando…' : 'Fusionar'}
              </Boton>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-lg max-w-lg
          ${toast.tipo === 'ok' ? 'bg-teal-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── Una línea del tablero: predio suelto o unidad de siembra ────────────────
function FilaUnidad({
  unidad, modoFusion, seleccion, onMarcar,
}: {
  unidad: Unidad
  modoFusion: boolean
  seleccion: Set<string>
  onMarcar: (id: string) => void
}) {
  const r = unidad.principal
  const f = faseDe(r.fase)
  const esUnidad = unidad.miembros.length > 0
  const haRegistral = predios(unidad).reduce((s, x) => s + Number(x.area_registral ?? 0), 0)
  const jur = estadoCfg(r.dd_estado)
  const sem = semaforoCfg(r.semaforo)
  // En una unidad los predios pueden venir de jurídica en estados distintos: el
  // SIG tiene que verlo, porque un predio rechazado no debería recibir trabajo.
  const estadosMezclados = esUnidad && new Set(predios(unidad).map(x => x.dd_estado)).size > 1
  const algunoRechazado  = predios(unidad).some(x => x.dd_estado === 'rechazado')

  const cuerpo = (
    <>
      {/* Identidad */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-stone-900 truncate">
            {esUnidad
              ? (r.grupo_nombre || r.nombre_predio || '(unidad sin nombre)')
              : (r.nombre_predio || <span className="text-stone-300 font-normal">(predio sin nombre)</span>)}
          </p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${f.cls}`}>{f.label}</span>
          {esUnidad && (
            <span title="Varios predios, un solo polígono de siembra"
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
              <Combine size={10} /> Unidad · {unidad.miembros.length + 1} predios
            </span>
          )}
          {/* Estado jurídico: el mismo chip que usa el tablero de jurídica */}
          <span title={`Estado jurídico${sem ? ` · semáforo ${sem.label.toLowerCase()}` : ''}${estadosMezclados ? ' del predio principal (los de la unidad no coinciden)' : ''}`}
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${jur.bg} ${jur.text}`}>
            <Scale size={9} />
            {jur.label}
            {sem && <span className={`w-1.5 h-1.5 rounded-full ${sem.dot}`} />}
            {estadosMezclados && <span className="opacity-60">+</span>}
          </span>
        </div>
        <p className="text-xs text-stone-500 truncate">{r.nombre_completo}</p>
        <p className="text-xs text-stone-400 truncate flex items-center gap-1">
          <MapPin size={10} />{r.municipio}{r.vereda && ` · ${r.vereda}`}
          {r.matricula_inmobiliaria && ` · Mat. ${r.matricula_inmobiliaria}`}
        </p>
        {esUnidad && (
          <ul className="mt-1.5 space-y-0.5">
            {unidad.miembros.map(m => {
              const mj = estadoCfg(m.dd_estado)
              return (
                <li key={m.predio_id} className="text-[11px] text-stone-400 flex items-center gap-1.5 truncate">
                  <span className="text-stone-300">+</span>
                  <span className="font-bold text-stone-500">{m.nombre_predio || '(sin nombre)'}</span>
                  <span className="truncate">· {m.nombre_completo} · {m.municipio}</span>
                  {m.matricula_inmobiliaria && <span className="hidden sm:inline">· Mat. {m.matricula_inmobiliaria}</span>}
                  <span className={`shrink-0 text-[9px] font-bold px-1.5 rounded ${mj.bg} ${mj.text}`}>{mj.label}</span>
                </li>
              )
            })}
          </ul>
        )}
        {algunoRechazado && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-400/20 border border-rose-400/35 rounded-lg px-2 py-1">
            <AlertTriangle size={11} className="shrink-0" />
            Jurídica lo rechazó — confirma antes de trabajarle cartografía
          </p>
        )}
      </div>

      {/* Qué cartografía tiene */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <span title={r.tiene_finca ? 'Polígono del predio cargado' : 'Falta el polígono del predio'}
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${r.tiene_finca ? 'bg-teal-50 text-teal-700' : 'bg-stone-100 text-stone-400'}`}>
          <Hexagon size={11} /> {esUnidad ? 'Lindero' : 'Predio'}
        </span>
        <span title={`${r.n_zonas_siembra} zona(s) de siembra`}
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${r.n_zonas_siembra > 0 ? 'bg-teal-50 text-teal-700' : 'bg-stone-100 text-stone-400'}`}>
          <Sprout size={11} /> {r.n_zonas_siembra > 0 ? `${r.n_zonas_siembra} zona${r.n_zonas_siembra > 1 ? 's' : ''}` : 'Sin zonas'}
        </span>
        {r.n_descartadas > 0 && (
          <span title="Zonas que campo marcó como no aptas"
            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-rose-50 text-rose-600">
            {r.n_descartadas} desc.
          </span>
        )}
        {(r.tiene_eval_campo || r.tiene_encuesta || r.n_revisiones > 0) && (
          <span title="Campo ya devolvió información"
            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700">
            <ClipboardCheck size={11} /> Campo
          </span>
        )}
      </div>

      {/* Áreas */}
      <div className="hidden md:block text-right shrink-0 w-28">
        {r.ha_finca != null
          ? <p className="text-sm font-bold text-stone-800">{fmt(r.ha_finca)} ha</p>
          : <p className="text-sm text-stone-300">sin medir</p>}
        <p className="text-[11px] text-stone-400">
          {haRegistral > 0
            ? `${fmt(haRegistral)} ha registral${esUnidad ? ' (suma)' : ''}`
            : 'sin área registral'}
        </p>
      </div>
    </>
  )

  // En modo fusionar la fila no navega: se marca. Los predios de una unidad ya
  // formada no se pueden volver a marcar (la base lo rechaza de todos modos).
  if (modoFusion) {
    const yaEnUnidad = !!r.grupo_id
    const marcado = predios(unidad).some(p => seleccion.has(p.predio_id))
    return (
      <div className={`flex items-center gap-4 px-4 py-3 ${yaEnUnidad ? 'opacity-50' : marcado ? 'bg-teal-50/60' : 'hover:bg-stone-50/70'} transition-colors`}>
        <button
          type="button"
          disabled={yaEnUnidad}
          onClick={() => onMarcar(r.predio_id)}
          title={yaEnUnidad ? 'Ya está en una unidad de siembra' : 'Marcar para fusionar'}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
            ${yaEnUnidad ? 'border-stone-200 cursor-not-allowed' : marcado ? 'border-teal-500 bg-teal-500' : 'border-stone-300 hover:border-teal-400'}`}>
          {marcado && <Check size={12} className="text-white" />}
        </button>
        {cuerpo}
      </div>
    )
  }

  return (
    <Link href={`/intranet/sig/${r.predio_id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-stone-50/70 transition-colors group">
      {esUnidad && <Users size={14} className="text-stone-300 shrink-0" />}
      {cuerpo}
      <ChevronRight size={16} className="text-stone-300 group-hover:text-teal-600 transition-colors shrink-0" />
    </Link>
  )
}
