'use client'
/**
 * Piezas compartidas por las pantallas del módulo administrativo y financiero:
 * el control de acceso, la carga del catálogo y algunos elementos de formulario.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchConSesion } from '@/lib/fetch-sesion'
import type { Bodega, Existencia, Insumo, Proyecto, TituloCampo } from '@/lib/administrativa'

export const CAMPO =
  'w-full border border-linea bg-white px-3 py-2 text-[13px] text-tinta outline-none transition-colors placeholder:text-tenue focus:border-bosque disabled:bg-papel disabled:text-tenue'
export const ROTULO = 'mb-1.5 block text-[10px] uppercase tracking-[.16em] text-tenue'
export const TH = 'px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-[.14em] text-tenue'
export const TD = 'px-3 py-2.5 align-top text-[12.5px] text-tinta'

/**
 * Quién entra: administradores y el departamento Financiero (María Fernanda,
 * Katys…). La regla real está en el servidor (PUEDE.financiero); esto solo
 * evita mostrar una pantalla vacía a quien no puede.
 */
export function useAccesoFinanciero() {
  const router = useRouter()
  const [listo, setListo] = useState(false)
  const [perfil, setPerfil] = useState<{ email: string; is_admin: boolean; department: string | null } | null>(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { router.push('/'); return }
      const r = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const p = r.ok ? await r.json() : null
      if (!p || !(p.is_admin || p.department === 'Financiero')) { router.push('/intranet'); return }
      if (vivo) { setPerfil(p); setListo(true) }
    })()
    return () => { vivo = false }
  }, [router])

  return { listo, perfil }
}

export interface Catalogo {
  bodegas: Bodega[]
  insumos: Insumo[]
  existencias: Existencia[]
  titulos: TituloCampo[]
  proyectos: Proyecto[]
  faltaMigracion?: boolean
  aviso?: string
}

const VACIO: Catalogo = { bodegas: [], insumos: [], existencias: [], titulos: [], proyectos: [] }

async function leerJson(url: string): Promise<{ ok: boolean; j: Record<string, unknown> }> {
  const r = await fetchConSesion(url)
  return { ok: r.ok, j: await r.json().catch(() => ({})) }
}

/**
 * Lee una ruta GET de la API al montar y cada vez que cambia `url` (null = no
 * leer todavía). `recargar` vuelve a leer y se puede esperar con await.
 * `extraer` saca del cuerpo lo que interesa.
 */
export function useCarga<T>(url: string | null, extraer: (j: Record<string, unknown>) => T, mensaje = 'No se pudo leer.') {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extraerFijo] = useState(() => extraer)

  const aplicar = useCallback((ok: boolean, j: Record<string, unknown>) => {
    if (!ok) { setError(typeof j.error === 'string' ? j.error : mensaje); setData((d) => d ?? extraerFijo({})) }
    else { setError(null); setData(extraerFijo(j)) }
  }, [extraerFijo, mensaje])

  useEffect(() => {
    if (!url) return
    let vivo = true
    leerJson(url).then(({ ok, j }) => { if (vivo) aplicar(ok, j) })
    return () => { vivo = false }
  }, [url, aplicar])

  const recargar = useCallback(async () => {
    if (!url) return
    const { ok, j } = await leerJson(url)
    aplicar(ok, j)
  }, [url, aplicar])

  return { data, error, recargar }
}

export function useCatalogo(activo: boolean) {
  const { data, error, recargar } = useCarga<Catalogo>(
    activo ? '/api/administrativa/catalogo' : null,
    (j) => ({ ...VACIO, ...(j as Partial<Catalogo>) }),
    'No se pudo leer el catálogo.',
  )
  return { cat: data ?? VACIO, cargando: activo && data === null, error, recargar }
}

/** POST/PATCH JSON con sesión. Devuelve el cuerpo o lanza Error con el mensaje del servidor. */
export async function enviar<T = Record<string, unknown>>(url: string, metodo: 'POST' | 'PATCH', cuerpo: unknown): Promise<T> {
  const r = await fetchConSesion(url, {
    method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error ?? 'No se pudo guardar.')
  return j as T
}

export function Campo({ etiqueta, children, className = '' }: { etiqueta: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className={ROTULO}>{etiqueta}</span>
      {children}
    </label>
  )
}

/** Ventana sobre la página. Se cierra con la X o con Escape. */
export function Ventana({ titulo, onCerrar, children, ancho = 'max-w-2xl' }: {
  titulo: ReactNode; onCerrar: () => void; children: ReactNode; ancho?: string
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onCerrar])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-tinta/50 px-4 py-10" onMouseDown={onCerrar}>
      <div className={`w-full ${ancho} border border-linea bg-papel shadow-xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-linea px-6 py-4">
          <h3 className="font-display text-lg font-semibold text-tinta">{titulo}</h3>
          <button type="button" onClick={onCerrar} className="text-tenue hover:text-tinta" aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

/** Mensaje de error o de éxito bajo un formulario. */
export function Mensaje({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <p className="mt-3 border-l-2 border-red-600 pl-3 text-[12.5px] text-red-700">{error}</p>
  if (ok) return <p className="mt-3 border-l-2 border-bosque pl-3 text-[12.5px] text-bosque">{ok}</p>
  return null
}

/** Saldo con su color: negativo en arcilla (faltante), cero en tenue. */
export function Saldo({ n, unidad, fuerte = false }: { n: number; unidad?: string; fuerte?: boolean }) {
  const v = Number(n) || 0
  const cls = v < -0.0001 ? 'text-red-700 font-semibold' : Math.abs(v) < 0.0001 ? 'text-tenue' : fuerte ? 'font-semibold text-tinta' : 'text-tinta'
  const txt = Math.abs(v) < 0.0001 ? '—' : v.toLocaleString('es-CO', { maximumFractionDigits: 2 })
  return <span className={`tabular-nums ${cls}`}>{txt}{unidad && Math.abs(v) >= 0.0001 ? <span className="ml-1 text-[10.5px] text-tenue">{unidad}</span> : null}</span>
}
