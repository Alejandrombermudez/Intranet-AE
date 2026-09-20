'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { Boton, Cabecera, Cargando } from '@/app/components/marca'
import {
  type Aliado, type EstadoAliado, type Semaforo,
  ESTADO_CONFIG, ESTADOS_FLUJO, SEMAFORO_CONFIG, H1_CAMPOS_CLAVE, hoja3Habilitada,
} from '@/lib/juridica-schema'
import {
  Plus, Search, Filter, ChevronRight, Loader2, Shield, LayoutGrid,
} from 'lucide-react'
import { fetchParametros, nombreParametro, type Parametro } from '@/lib/parametros'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** HOJA 2 = análisis del folio: hecha cuando tiene semáforo. */
function h2Hecha(a: Aliado): boolean {
  return !!a.analisis_juridico?.semaforo
}

/** HOJA 3 = antecedentes: pendiente solo si ya se puede hacer y falta el veredicto. */
function h3Pendiente(a: Aliado): boolean {
  const semaforo = a.analisis_juridico?.semaforo ?? null
  return hoja3Habilitada(semaforo, !!a.antecedentes) && (a.antecedentes?.aprobado ?? null) === null
}

function h1Completitud(a: Aliado): { hechos: number; total: number } {
  const total = H1_CAMPOS_CLAVE.length
  const hechos = H1_CAMPOS_CLAVE.filter((k) => a[k] != null && a[k] !== '').length
  return { hechos, total }
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Stepper pequeño ──────────────────────────────────────────────────────────

// Mismo criterio que el stepper del detalle: el avance sale de las hojas, no
// del estado derivado. HOJA 1 siempre existe; HOJA 2 = análisis (semáforo);
// HOJA 3 = antecedentes (veredicto). En rojo la hoja que rechazó.
function MiniStepper({ aliado }: { aliado: Aliado }) {
  const semaforo  = aliado.analisis_juridico?.semaforo ?? null
  const veredicto = aliado.antecedentes?.aprobado ?? null
  const hojas = [
    { label: 'HOJA 1', done: true,              rojo: false },
    { label: 'HOJA 2', done: semaforo !== null,  rojo: semaforo === 'rojo' },
    { label: 'HOJA 3', done: veredicto !== null, rojo: veredicto === false },
  ]
  const activa = hojas.findIndex((h) => !h.done)

  return (
    <div className="flex items-center gap-1">
      {hojas.map((h, i) => {
        const dotClass = h.rojo
          ? 'bg-red-400'
          : h.done
            ? 'bg-teal-400'
            : i === activa
              ? 'bg-amber-400'
              : 'bg-stone-200'
        return (
          <div key={h.label} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-2 h-2 rounded-full ${dotClass}`} />
              <span className="text-[9px] text-stone-400 font-medium">{h.label}</span>
            </div>
            {i < 2 && <div className="w-4 h-px bg-stone-200 mb-3" />}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tarjeta de aliado ────────────────────────────────────────────────────────

// `prediosDelPropietario` = cuántos casos tiene esa misma persona en el listado.
// Un aliado con varios predios genera una tarjeta por predio; sin el nombre del
// predio a la vista las tarjetas se leen como propietarios duplicados.
function AliadoCard({ aliado, prediosDelPropietario, proyecto }: {
  aliado: Aliado
  prediosDelPropietario: number
  /** Nombre legible del proyecto, o null si el predio todavía no está clasificado. */
  proyecto: string | null
}) {
  const estadoCfg  = ESTADO_CONFIG[aliado.estado]
  const semaforo   = aliado.analisis_juridico?.semaforo as Semaforo | null
  const semCfg     = semaforo ? SEMAFORO_CONFIG[semaforo] : null
  const { hechos, total } = h1Completitud(aliado)
  const pct = Math.round((hechos / total) * 100)
  // El documento placeholder (S/D-…) no identifica a nadie: no vale mostrarlo.
  const documento = aliado.numero_documento.startsWith('S/D-')
    ? 'sin documento'
    : `${aliado.tipo_documento} ${aliado.numero_documento}`

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="font-bold text-stone-900 text-sm truncate">
            {aliado.nombre_predio || 'Predio sin nombre'}
          </p>
          {/* Bajo qué programa entra. Sin clasificar se marca en ámbar: es lo
              que hay que completar para poder separar los predios por proyecto. */}
          <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            proyecto ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            {proyecto ?? 'Sin proyecto'}
          </span>
          <p className="text-xs text-stone-500 mt-1 truncate">{aliado.nombre_completo}</p>
          <p className="text-xs text-stone-400 mt-0.5 truncate">
            {documento} · {aliado.municipio}
            {aliado.matricula_inmobiliaria && ` · MI ${aliado.matricula_inmobiliaria}`}
          </p>
          {prediosDelPropietario > 1 && (
            <p className="text-[10px] text-stone-400 mt-1">
              Este propietario tiene <strong>{prediosDelPropietario} predios</strong> — una ficha por predio, no están duplicados.
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estadoCfg.bg} ${estadoCfg.text}`}>
            {estadoCfg.label}
          </span>
          {semCfg && (
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${semCfg.dot}`} />
              <span className={`text-[10px] font-bold ${semCfg.color}`}>{semCfg.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Progreso HOJA 1 */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-stone-400">Datos HOJA 1</span>
          <span className="text-[10px] text-stone-400 font-medium">{hechos}/{total}</span>
        </div>
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-400 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <MiniStepper aliado={aliado} />
        <Link
          href={`/intranet/juridica/${aliado.id}`}
          className="flex items-center gap-0.5 text-[11px] font-bold text-stone-500 hover:text-stone-800 transition-colors"
        >
          Ver <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type FiltroEstado = 'todos' | EstadoAliado | 'pendiente_h1' | 'pendiente_h2' | 'pendiente_h3' | 'requiere_revision'

export default function JuridicaPage() {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [aliados, setAliados] = useState<Aliado[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroEstado>('todos')
  // 'todos' | 'sin_proyecto' | código de catalogo.proyectos
  const [filtroProyecto, setFiltroProyecto] = useState<string>('todos')
  const [proyectos, setProyectos] = useState<Parametro[]>([])

  useEffect(() => { fetchParametros('proyectos').then(setProyectos) }, [])

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department')
        .eq('email', user.email)
        .single()
      if (!profile?.is_admin && profile?.department !== 'Juridica') {
        router.push('/'); return
      }
      setUserEmail(user.email ?? null)
      setAuthReady(true)
    })
  }, [router])

  // Cargar aliados
  useEffect(() => {
    if (!authReady || !userEmail) return
    setLoading(true)
    fetchConSesion('/api/juridica/aliados')
      .then((r) => r.json())
      .then((data) => { setAliados(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [authReady, userEmail])

  // Cuántos casos tiene cada persona: sirve para explicar en la tarjeta por qué
  // el mismo propietario aparece varias veces (un predio = una ficha).
  const prediosPorPropietario = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of aliados) {
      const k = a.aliado_id ?? a.numero_documento
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [aliados])

  // Filtrado
  const visibles = useMemo(() => {
    let list = aliados
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      list = list.filter(
        (a) =>
          a.nombre_completo.toLowerCase().includes(q) ||
          a.numero_documento.toLowerCase().includes(q) ||
          a.municipio.toLowerCase().includes(q) ||
          (a.nombre_predio ?? '').toLowerCase().includes(q) ||
          (a.matricula_inmobiliaria ?? '').toLowerCase().includes(q)
      )
    }
    if (filtroProyecto === 'sin_proyecto') {
      list = list.filter((a) => !a.tipo_proyecto)
    } else if (filtroProyecto !== 'todos') {
      list = list.filter((a) => a.tipo_proyecto === filtroProyecto)
    }
    if (filtro === 'pendiente_h1') {
      list = list.filter((a) => h1Completitud(a).hechos < H1_CAMPOS_CLAVE.length)
    } else if (filtro === 'pendiente_h2') {
      list = list.filter((a) => !h2Hecha(a))
    } else if (filtro === 'pendiente_h3') {
      list = list.filter(h3Pendiente)
    } else if (filtro === 'requiere_revision') {
      list = list.filter((a) => a.estado === 'juridico_ok')
    } else if (filtro !== 'todos') {
      list = list.filter((a) => a.estado === filtro)
    }
    return list
  }, [aliados, busqueda, filtro, filtroProyecto])

  // Estadísticas rápidas
  const stats = useMemo(() => ({
    total:     aliados.length,
    aprobados: aliados.filter((a) => a.estado === 'aprobado').length,
    pendientes: aliados.filter((a) => ['borrador', 'analisis_ok', 'antecedentes_ok', 'juridico_ok'].includes(a.estado)).length,
    rechazados: aliados.filter((a) => a.estado === 'rechazado').length,
  }), [aliados])

  if (!authReady) return <Cargando texto="Cargando el módulo jurídico…" />

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        ancho="estrecho"
        volver={{ href: '/intranet', label: 'Intranet' }}
        modulo="Módulo jurídico"
        titulo="Debida diligencia de aliados"
        cifras={[
          { n: stats.total, l: 'Total' },
          { n: stats.pendientes, l: 'Pendientes' },
          { n: aliados.filter(a => a.estado === 'aprobado').length, l: 'Aprobados' },
          { n: stats.rechazados, l: 'Rechazados' },
        ]}
        acciones={<>
          <Boton variante="claro" href="/intranet/expedientes" icono={<LayoutGrid size={14} />}>Tablero</Boton>
          <Boton variante="luz" href="/intranet/juridica/nuevo" icono={<Plus size={14} />}>Nuevo aliado</Boton>
        </>}
      />

      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10 space-y-6">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por predio, matrícula, propietario, documento o municipio…"
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:border-teal-400 transition-colors"
            />
          </div>
          {/* flex-wrap: son dos desplegables; en celular no caben en una línea. */}
          <div className="flex items-center flex-wrap gap-2">
            <Filter size={14} className="text-stone-400 shrink-0" />
            {/* Filtro por programa. «Sin proyecto asignado» es la lista de trabajo
                para clasificar los predios que venían de antes de este campo. */}
            <select
              value={filtroProyecto}
              onChange={(e) => setFiltroProyecto(e.target.value)}
              className="text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-400 transition-colors"
            >
              <option value="todos">Todos los proyectos</option>
              <option value="sin_proyecto">Sin proyecto asignado</option>
              {proyectos.filter((p) => p.activo).map((p) => (
                <option key={p.codigo} value={p.codigo}>{p.nombre}</option>
              ))}
            </select>
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as FiltroEstado)}
              className="text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-400 transition-colors"
            >
              <option value="todos">Todos</option>
              <optgroup label="Por estado">
                {ESTADOS_FLUJO.map((s) => (
                  <option key={s} value={s}>{ESTADO_CONFIG[s].label}</option>
                ))}
              </optgroup>
              <optgroup label="Por completitud">
                <option value="pendiente_h1">Faltan datos HOJA 1</option>
                <option value="pendiente_h2">Pendiente HOJA 2 (análisis)</option>
                <option value="pendiente_h3">Pendiente HOJA 3 (antecedentes)</option>
                <option value="requiere_revision">Requieren revisión comité</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-stone-300" size={36} />
          </div>
        ) : visibles.length === 0 ? (
          <div className="text-center py-20 text-stone-400">
            <Shield size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">
              {aliados.length === 0 ? 'Aún no hay aliados registrados' : 'Ningún aliado coincide con el filtro'}
            </p>
            {aliados.length === 0 && (
              <Link href="/intranet/juridica/nuevo" className="mt-3 inline-block text-sm text-teal-600 font-bold hover:underline">
                Crear el primero →
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibles.map((a) => (
              <AliadoCard key={a.id} aliado={a}
                prediosDelPropietario={prediosPorPropietario.get(a.aliado_id ?? a.numero_documento) ?? 1}
                proyecto={nombreParametro(proyectos, a.tipo_proyecto)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
